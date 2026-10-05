#!/usr/bin/env python3
"""Verify exact live, stored and mixed retrieval bounds on retained real WAR bundles."""

import argparse
from contextlib import contextmanager
import datetime
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
import uuid
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener
import zipfile

from verify_disconnected import identity, matching, require_free_ports, signal_matching
from verify_list_archived_pvs import FIXTURE, REPO, digest, save
from verify_pause_resume import instant, sample_tuple, stamp
from verify_rename import COMPONENTS, source_digests

START_TIMEOUT = 180
ARCHIVE_TIMEOUT = 360
OBSERVE_TIMEOUT = 120
HTTP_TIMEOUT = 15
ENGINE_URL_LOGGER = "edu.stanford.slac.archiverappliance.PBOverHTTP.PBOverHTTPStoragePlugin"
HTTP_READ_SIZE = 64 * 1024
READER_TIMEOUT = 20
STOP_TIMEOUT = 300
STOP_ALLOWANCE = 7
IOC_STOP_TIMEOUT = 30
NS = 1_000_000_000
ADAPTER = "org.epics.archiverappliance.retrieval.LiveRetrievalBoundsTest"
FILE_ADAPTER = "org.epics.archiverappliance.verification.PVSampleDump"
BUFFER_PROPERTY = "org.epics.archiverappliance.config.PVTypeInfo.secondsToBuffer"


@contextmanager
def bounded(seconds):
    """Limit an entire observation, including continuously arriving HTTP data."""
    previous_handler = signal.getsignal(signal.SIGALRM)
    previous_timer, previous_interval = signal.getitimer(signal.ITIMER_REAL)
    previous_end = time.monotonic() + previous_timer if previous_timer else None

    def expired(signum, frame):
        raise TimeoutError("observation wall-clock deadline expired")

    signal.signal(signal.SIGALRM, expired)
    signal.setitimer(signal.ITIMER_REAL, min(seconds, previous_timer) if previous_timer else seconds)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous_handler)
        if previous_end:
            signal.setitimer(signal.ITIMER_REAL, max(0.000001, previous_end - time.monotonic()), previous_interval)


def parse_instant(value):
    """Parse UTC ISO timestamps without rounding fractional nanoseconds."""
    whole, dot, fraction = value.removesuffix("Z").partition(".")
    seconds = int(datetime.datetime.fromisoformat(whole).replace(tzinfo=datetime.timezone.utc).timestamp())
    return seconds * NS + (int(fraction.ljust(9, "0")) if dot else 0)


class Verification:
    def __init__(self, args):
        self.args = args
        self.root = args.run_folder.resolve()
        self.root.mkdir(parents=True, exist_ok=False)
        self.results = []
        self.app = self.ioc = None
        self.launcher = None
        self.children = []
        self.generation = 0
        self.sequence = 0
        self.deadline = None
        self.http = build_opener(ProxyHandler({}))
        self.prefix = "RBND:" + uuid.uuid4().hex[:8] + ":"
        self.pv = self.prefix + "test_0"
        self.bpl = f"http://127.0.0.1:{args.port_base}/mgmt/bpl"
        self.engine = f"http://127.0.0.1:{args.port_base + 1}/engine/bpl/getData.raw"
        self.retrieval = f"http://127.0.0.1:{args.port_base + 3}/retrieval/data/getData.json"
        self.env = {**os.environ, "NO_PROXY": "*", "no_proxy": "*", "PYTHONDONTWRITEBYTECODE": "1",
                    "EPICS_CA_AUTO_ADDR_LIST": "NO", "EPICS_CA_ADDR_LIST": "127.0.0.1",
                    "EPICS_CA_SERVER_PORT": str(args.ca_port), "EPICS_CAS_SERVER_PORT": str(args.ca_port),
                    "EPICS_CAS_INTF_ADDR_LIST": "127.0.0.1", "EPICS_CAS_BEACON_ADDR_LIST": "127.0.0.1",
                    "EPICS_PVAS_INTF_ADDR_LIST": "224.0.1.1,1@127.0.0.1"}
        bundle = json.loads(args.bundle_manifest.read_text())
        self.wars = {str(args.war_dir.resolve() / f"{args.war_basename}-{c}.war"):
                     digest(args.war_dir.resolve() / f"{args.war_basename}-{c}.war") for c in COMPONENTS}
        if self.wars != bundle["wars"] or digest(FIXTURE) != bundle["fixture"]:
            raise RuntimeError("WARs or original IOC fixture differ from selected bundle")
        if any(digest(Path(p)) != d for p, d in bundle["build_logs"].items()):
            raise RuntimeError("bundle build logs changed")
        if {p.name for p in args.war_dir.glob("*.war")} != {Path(p).name for p in self.wars}:
            raise RuntimeError("war-dir must contain exactly the selected four WARs")
        if args.baseline_manifest:
            baseline = json.loads(args.baseline_manifest.read_text())
            if (baseline["bundle_manifest"] != digest(args.bundle_manifest) or baseline["wars"] != self.wars
                    or baseline["built_production_sources"] != bundle["production_sources"]
                    or baseline["fixture"] != bundle["fixture"]):
                raise RuntimeError("baseline replay provenance does not match original execution")
        elif source_digests() != bundle["production_sources"]:
            raise RuntimeError("production sources do not match selected bundle")
        deps = args.classpath_file.read_text().strip().split(os.pathsep)
        cp = os.pathsep.join([str(REPO / "target/test-classes"), str(REPO / "target/classes"), *deps])
        config = self.root / "reader-log.xml"
        config.write_text('<Configuration status="OFF"><Appenders/><Loggers><Root level="off"/></Loggers></Configuration>\n')
        self.java = [shutil.which("java"), "-Dlog4j2.configurationFile=" + str(config), "-cp", cp]
        with zipfile.ZipFile(args.war_dir / f"{args.war_basename}-engine.war") as war:
            props = war.read("WEB-INF/classes/archappl.properties").decode()
        match = re.search(r"^" + re.escape(BUFFER_PROPERTY) + r"\s*=\s*(\d+)\s*$", props, re.M)
        self.buffer_seconds = int(match.group(1)) if match else 60
        self.began = time.time_ns()
        save(self.root, "manifest.json", {
            "observed_at": instant(self.began), "bundle_manifest": digest(args.bundle_manifest),
            "wars": self.wars, "fixture": digest(FIXTURE), "built_production_sources": bundle["production_sources"],
            "current_production_sources": source_digests(), "runner": digest(Path(__file__)),
            "java_test": digest(REPO / "src/test" / (ADAPTER.replace(".", "/") + ".java")),
            "adapter": digest(REPO / "target/test-classes" / (ADAPTER.replace(".", "/") + ".class")),
            "file_adapter": digest(REPO / "target/test-classes" / (FILE_ADAPTER.replace(".", "/") + ".class")),
            "classpath": cp, "dependencies": {p: digest(Path(p)) for p in deps},
            "prefix": self.prefix, "pv": self.pv, "seconds_to_buffer": self.buffer_seconds,
            "launcher": digest(REPO / "scripts/run-local-appliance.bash")})

    def check(self, name, passed, **detail):
        self.results.append({"case": name, "passed": bool(passed), "observed_at": instant(time.time_ns()), **detail})
        save(self.root, "results.json", self.results)
        print(f"[ {'PASS' if passed else 'FAIL'} ] {name}", flush=True)
        return passed

    def require(self, name, passed, **detail):
        if not self.check(name, passed, **detail):
            raise RuntimeError(name + " failed")

    def budget(self, limit):
        remaining = self.deadline - time.monotonic() if self.deadline else limit
        if remaining <= 0:
            raise TimeoutError("observation deadline expired")
        return min(limit, remaining)

    def wait(self, name, seconds, check):
        previous = self.deadline
        self.deadline = min(previous, time.monotonic() + seconds) if previous else time.monotonic() + seconds
        began = time.monotonic()
        last = None
        try:
            while time.monotonic() < self.deadline:
                for proc in (self.app, self.ioc):
                    if proc is not None and proc.poll() is not None:
                        raise RuntimeError("owned process exited during " + name)
                last = check()
                if last:
                    return last
                time.sleep(self.budget(1))
            raise TimeoutError(name + " observation deadline expired")
        finally:
            save(self.root, name + "-wait.json", {"elapsed": time.monotonic() - began, "last": last})
            self.deadline = previous

    def request(self, url, params=None):
        self.sequence += 1
        name = f"http-{self.sequence:04d}"
        full = url + ("?" + urlencode(params) if params else "")
        path = self.root / (name + ".body")
        record = {"url": full, "started_at": instant(time.time_ns())}
        save(self.root, name + ".json", record)
        try:
            with bounded(self.budget(HTTP_TIMEOUT)):
                try:
                    response = self.http.open(Request(full), timeout=self.budget(HTTP_TIMEOUT))
                except HTTPError as error:
                    response = error
                with response:
                    record.update(status=response.status, content_type=response.headers.get("Content-Type"))
                    expected = response.headers.get("Content-Length")
                    received = 0
                    with path.open("wb") as output:
                        while chunk := response.read1(HTTP_READ_SIZE):
                            output.write(chunk)
                            received += len(chunk)
                    if expected is not None and received != int(expected):
                        raise RuntimeError(f"truncated HTTP response: expected {expected} bytes, received {received}")
                    record["response_complete"] = True
            body = path.read_bytes()
            record["body_sha256"] = digest(path)
            if record["status"] != 200:
                raise RuntimeError("unexpected HTTP status: " + str(record["status"]))
            return body, path
        except BaseException as error:
            record["error"] = repr(error)
            partial = getattr(error, "partial", None)
            if isinstance(partial, bytes):
                with path.open("ab") as output:
                    output.write(partial)
            if path.exists():
                record["body_sha256"] = digest(path)
                if not record.get("response_complete"):
                    record["partial"] = True
            raise
        finally:
            record["observed_at"] = instant(time.time_ns())
            save(self.root, name + ".json", record)

    def api(self, action, params=None):
        body = json.loads(self.request(self.bpl + "/" + action, params)[0])
        if isinstance(body, dict) and body.get("status") == "error":
            raise RuntimeError("management action rejected: " + str(body))
        return body

    def decode(self, path, adapter, extra=()):
        self.sequence += 1
        if adapter == FILE_ADAPTER:
            snapshot = self.root / f"stored-{self.sequence:04d}" / path.name
            snapshot.parent.mkdir()
            shutil.copyfile(path, snapshot)
            path = snapshot
        result = subprocess.run([*self.java, adapter, str(path), *extra], cwd=REPO, env=self.env,
                                text=True, capture_output=True, timeout=self.budget(READER_TIMEOUT))
        save(self.root, f"reader-{self.sequence:04d}.json", {"command": [*self.java, adapter, str(path), *extra],
                                                  "observed_at": instant(time.time_ns()), "input_sha256": digest(path),
                                                  "exit": result.returncode, "stdout": result.stdout, "stderr": result.stderr})
        if result.returncode:
            raise RuntimeError("native PB reader failed: " + result.stderr)
        rows = [json.loads(line) for line in result.stdout.splitlines()]
        for row in rows:
            if adapter == ADAPTER or row.get("kind") == "sample":
                sample_tuple(row)
        return rows

    def engine_rows(self, start):
        _, path = self.request(self.engine, {"pv": self.pv, "from": instant(start), "to": instant(time.time_ns() + NS)})
        return self.decode(path, ADAPTER, (instant(start),))

    def log_path(self, component):
        return self.root / f"appliance/instances/{component}/logs/console.log"

    def public(self, name, start, end, engine_expected):
        positions = {c: self.log_path(c).stat().st_size for c in ("retrieval", "engine")}
        body, _ = self.request(self.retrieval, {"pv": self.pv, "from": instant(start), "to": instant(end)})
        parsed = json.loads(body)
        if len(parsed) != 1 or parsed[0]["meta"]["name"] != self.pv:
            raise RuntimeError("retrieval identity or structure mismatch")
        rows = parsed[0]["data"]
        for row in rows:
            sample_tuple(row)
        logs = {}
        for c, position in positions.items():
            with self.log_path(c).open("rb") as source:
                source.seek(position)
                logs[c] = source.read().decode()
        urls = [line.split("URL to fetch data is ", 1)[1] for line in logs["retrieval"].splitlines()
                if "URL to fetch data is " + self.engine in line]
        completions = [line for line in logs["engine"].splitlines()
                       if "GetEngineDataAction" in line and "Found a total of" in line]
        save(self.root, name + "-sources.json", {"engine_urls": urls, "engine_completions": completions,
                                               "logs": logs, "start": instant(start), "end": instant(end)})
        self.require(name + "-engine-participation", len(urls) == 1 and len(completions) == 1
                     if engine_expected else not urls and not completions)
        if engine_expected:
            actual = parse_qs(urlsplit(urls[0]).query)
            self.check(name + "-internal-precision", parse_instant(actual["from"][0]) == start
                       and parse_instant(actual["to"][0]) == end, actual=actual)
        self.check(name + "-upper-bound", all(stamp(row) <= end for row in rows), rows=rows, end=instant(end))
        return rows

    def start_app(self):
        self.generation += 1
        for port in (self.args.port_base + n for n in (0, 1, 2, 3, 5)):
            with socket.socket() as probe:
                probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                probe.bind(("127.0.0.1", port))
        command = [str(REPO / "scripts/run-local-appliance.bash"), "--port-base", str(self.args.port_base),
                   "--tomcat-home", self.args.tomcat_home, "--war-dir", str(self.args.war_dir.resolve()),
                   "--stop-timeout", str(STOP_TIMEOUT), str(self.root / "appliance")]
        self.started = time.time_ns()
        save(self.root, f"launcher-{self.generation}-command.json", command)
        self.launcher_log = self.root / f"launcher-{self.generation}.log"
        with self.launcher_log.open("w") as log:
            self.app = subprocess.Popen(command, env=self.env, cwd=REPO, stdout=log, stderr=subprocess.STDOUT,
                                        start_new_session=True)
        self.launcher = identity(self.app.pid)
        status = self.root / "appliance/status"
        self.wait(f"startup-{self.generation}", START_TIMEOUT,
                  lambda: status.exists() and status.read_text().strip() == "ready")
        self.children = []
        for line in (self.root / "appliance/children.tsv").read_text().splitlines():
            boot, component, pid, ticks = line.split("\t")
            self.children.append({"boot": boot, "component": component, "pid": int(pid), "ticks": ticks})
        save(self.root, f"processes-{self.generation}.json", {"launcher": self.launcher, "children": self.children})
        self.require(f"deployed-{self.generation}", all(digest(self.root / f"appliance/instances/{c}/webapps/{c}.war")
                     == self.wars[str(self.args.war_dir.resolve() / f"{self.args.war_basename}-{c}.war")]
                     for c in COMPONENTS))
        self.log_engine_urls()

    def log_engine_urls(self):
        """Raises only the logger of the retrieval-to-engine plugin to DEBUG, since the URL line is not written at INFO."""
        self.request(f"http://127.0.0.1:{self.args.port_base + 3}/retrieval/bpl/setLogLevel",
                     {"logger": ENGINE_URL_LOGGER, "level": "DEBUG"})

    def stop_app(self):
        if self.app is None:
            return
        if self.app.poll() is None:
            signal_matching(self.launcher, signal.SIGTERM)
        code = self.app.wait(timeout=STOP_TIMEOUT + STOP_ALLOWANCE)
        remaining = [child for child in self.children if matching(child)]
        log = self.launcher_log.read_text()
        status = (self.root / "appliance/status").read_text().strip()
        save(self.root, f"cleanup-{self.generation}.json", {"exit": code, "remaining": remaining, "status": status})
        self.require(f"ordinary-cleanup-{self.generation}", code == 143 and not remaining and status == "stopped"
                     and "Forced stop:" not in log and "incomplete-stop" not in log)
        self.app = None

    def live_pair(self, name, from_time=None, after=None):
        rows = self.wait(name + "-native-samples", OBSERVE_TIMEOUT, lambda: self.engine_rows(self.started)
                         if self.api("getPVStatus", {"pv": self.pv})[0]["status"] == "Being archived" else None)
        target = rows[-1]
        self.require(name + "-fresh-target", stamp(target) > (after or self.started)
                     and target["nanos"] % 1_000_000 != 0, target=target, seconds_to_buffer=self.buffer_seconds)
        t = stamp(target)
        start = from_time if from_time is not None else t - 2 * NS
        self.require(name + "-buffer-before", sample_tuple(target) in
                     {sample_tuple(row) for row in self.engine_rows(start)})
        excluded = self.public(name + "-minus-one", start, t - 1, True)
        included = self.public(name + "-equal", start, t, True)
        self.require(name + "-buffer-after", sample_tuple(target) in
                     {sample_tuple(row) for row in self.engine_rows(start)})
        self.check(name + "-excluded", sample_tuple(target) not in {sample_tuple(row) for row in excluded})
        self.check(name + "-included", sample_tuple(target) in {sample_tuple(row) for row in included})
        rollover = self.public(name + "-second-rollover", start, target["secs"] * NS, True)
        self.check(name + "-rollover-target-excluded", sample_tuple(target) not in
                   {sample_tuple(row) for row in rollover})
        preceding = self.public(name + "-preceding", t + 1, t + NS // 2, True)
        self.check(name + "-preceding-retained", sample_tuple(target) in {sample_tuple(row) for row in preceding})
        save(self.root, name + "-target.json", target)
        return target, included

    def disk_rows(self):
        rows = []
        for path in sorted((self.root / "appliance/stores").rglob("*.pb")):
            for row in self.decode(path, FILE_ADAPTER):
                if row.get("kind") == "sample" and row["pvName"] == self.pv:
                    rows.append(row)
        return rows

    def run(self):
        require_free_ports(self.args.port_base, self.args.ca_port)
        self.start_app()
        command = [self.args.ioc, "-m", "P=" + self.prefix, "-d", str(FIXTURE)]
        save(self.root, "ioc-command.json", command)
        with (self.root / "ioc.log").open("w") as log:
            self.ioc = subprocess.Popen(command, env=self.env, cwd=REPO, stdin=subprocess.PIPE,
                                        text=True, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        self.api("archivePV", {"pv": self.pv, "samplingperiod": "0.1"})
        self.wait("initial-archive", ARCHIVE_TIMEOUT,
                  lambda: self.api("getPVStatus", {"pv": self.pv})[0]["status"] == "Being archived")
        self.wait("initial-acquisition", OBSERVE_TIMEOUT,
                  lambda: len(self.engine_rows(self.started)) >= 2)
        original, _ = self.live_pair("live")
        self.wait("actual-storage", OBSERVE_TIMEOUT,
                  lambda: sample_tuple(original) in {sample_tuple(row) for row in self.disk_rows()})
        self.wait("stored-only-selection", OBSERVE_TIMEOUT,
                  lambda: time.time_ns() // NS - original["secs"] >= 2 * self.buffer_seconds + 1)
        t = stamp(original)
        before = self.public("stored-minus-one", t - 2 * NS, t - 1, False)
        equal = self.public("stored-equal", t - 2 * NS, t, False)
        self.check("stored-excluded", sample_tuple(original) not in {sample_tuple(row) for row in before})
        self.check("stored-included", sample_tuple(original) in {sample_tuple(row) for row in equal})
        _, mixed = self.live_pair("mixed", t - 2 * NS)
        self.check("mixed-stored-target-retained", sample_tuple(original) in {sample_tuple(row) for row in mixed})
        self.stop_app()
        self.start_app()
        _, restarted = self.live_pair("restart", t - 2 * NS, self.started)
        self.check("restart-stored-target-retained", sample_tuple(original) in
                   {sample_tuple(row) for row in restarted})

    def cleanup(self):
        errors = []
        try:
            self.stop_app()
        except Exception as error:
            errors.append(repr(error))
            for child in self.children:
                if matching(child):
                    signal_matching(child, signal.SIGKILL)
            if self.app is not None and self.app.poll() is None:
                self.app.kill()
                self.app.wait(timeout=IOC_STOP_TIMEOUT)
        try:
            if self.ioc is not None:
                if self.ioc.poll() is None:
                    self.ioc.stdin.write("exit\n")
                    self.ioc.stdin.flush()
                code = self.ioc.wait(timeout=IOC_STOP_TIMEOUT)
                self.require("ordinary-ioc-cleanup", code == 0, exit=code, pid=self.ioc.pid)
        except Exception as error:
            errors.append(repr(error))
            if self.ioc is not None and self.ioc.poll() is None:
                self.ioc.kill()
                self.ioc.wait(timeout=IOC_STOP_TIMEOUT)
        if errors:
            self.check("cleanup-errors", False, errors=errors)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_folder", type=Path)
    parser.add_argument("--war-dir", type=Path, required=True)
    parser.add_argument("--war-basename", required=True)
    parser.add_argument("--bundle-manifest", type=Path, required=True)
    parser.add_argument("--classpath-file", type=Path, required=True)
    parser.add_argument("--baseline-manifest", type=Path)
    parser.add_argument("--tomcat-home", default=os.environ.get("TOMCAT_HOME"))
    parser.add_argument("--ioc", default=shutil.which("softIocPVX"))
    parser.add_argument("--port-base", type=int, default=30665)
    parser.add_argument("--ca-port", type=int, default=30675)
    args = parser.parse_args()
    if not args.tomcat_home or not args.ioc:
        parser.error("real Tomcat and softIocPVX are required")
    if not 1024 <= args.port_base <= 65530 or not 1024 <= args.ca_port <= 65535:
        parser.error("ports must be unprivileged and leave room for component offsets")
    if args.ca_port in {args.port_base + n for n in (0, 1, 2, 3, 5)}:
        parser.error("CA and appliance ports must differ")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", args.war_basename):
        parser.error("invalid WAR basename")
    verification = Verification(args)
    try:
        verification.run()
    except BaseException as error:
        verification.check("run-error", False, error=repr(error))
    finally:
        verification.cleanup()
    failed = sum(not row["passed"] for row in verification.results)
    save(verification.root, "summary.json", {"checks": len(verification.results), "failed": failed,
                                            "observed_at": instant(time.time_ns())})
    print(f"Checks: {len(verification.results)}; failed: {failed}; evidence: {verification.root}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
