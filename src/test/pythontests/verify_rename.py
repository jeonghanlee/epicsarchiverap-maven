#!/usr/bin/env python3
"""Verify retained rename data and filesystem failures through the shipped paths."""

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import re
import select
import shutil
import signal
import socket
import subprocess
import sys
import time
import uuid
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import ProxyHandler, Request, build_opener

from verify_list_archived_pvs import (
    ARCHIVE_TIMEOUT, FIXTURE, REPO, START_TIMEOUT, STOP_ALLOWANCE, STOP_TIMEOUT,
    digest, save, owned_jvms_alive, stop_owned_jvms,
)
from verify_pause_resume import ADAPTER, HTTP_TIMEOUT, READY_TIMEOUT, instant, sample_tuple, stamp

SAMPLES = REPO / "docs/book/src/samples"
COMPONENTS = ("mgmt", "engine", "etl", "retrieval")
COPIED_FIELDS = (
    "paused", "samplingMethod", "samplingPeriod", "DBRType", "scalar", "elementCount",
    "policyName", "dataStores", "archiveFields", "usePVAccess", "useDBEProperties", "creationTime",
)
BURST_SAMPLES = 12000
PROCESS_INTERVAL = 0.009
ARCHIVE_PERIOD = "0.1"
COPY_MIN_BYTES = 16384
FAULT_DELAY_SECONDS = 5


class ReaderFailure(RuntimeError):
    """A real PB file has not decoded successfully within the observation."""


def source_digests():
    paths = {REPO / "pom.xml"}
    for folder in ("src/main", "src/resources/main", "src/sitespecific/default"):
        paths.update((REPO / folder).rglob("*"))
    paths = sorted(paths)
    return {str(p.relative_to(REPO)): digest(p) for p in paths if p.is_file()}


def prepare_bundle(folder, classpath_file):
    """Build, record and isolate one actual four-WAR bundle before fixture execution."""
    folder = folder.resolve()
    folder.mkdir(parents=True, exist_ok=False)
    before = source_digests()
    commands = [[str(REPO / "mvnw"), "-B", "-ntp", "-DskipTests", "package"],
                [str(REPO / "mvnw"), "-B", "-ntp", "dependency:build-classpath",
                 "-Dmdep.outputFile=" + str(classpath_file.resolve())]]
    for index, command in enumerate(commands):
        with (folder / f"build-{index}.log").open("w") as log:
            subprocess.run(command, cwd=REPO, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=900)
    if before != source_digests():
        raise RuntimeError("production sources changed while preparing the bundle")
    log = (folder / "build-0.log").read_text()
    paths = [Path(p.strip()) for p in re.findall(r"Building war: (.+)", log)]
    basenames = {p.name.rsplit("-", 1)[0] for p in paths}
    if len(paths) != 4 or len(basenames) != 1 or "BUILD SUCCESS" not in log:
        raise RuntimeError("build did not produce one complete four-WAR bundle")
    basename = basenames.pop()
    if {p.name for p in paths} != {f"{basename}-{c}.war" for c in COMPONENTS}:
        raise RuntimeError("unexpected WAR components")
    for path in paths:
        shutil.copy2(path, folder / path.name)
    save(folder, "manifest.json", {
        "observed_at": instant(time.time_ns()), "war_basename": basename,
        "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip(),
        "commands": commands, "build_logs": {str(folder / f"build-{i}.log"): digest(folder / f"build-{i}.log")
                                                for i in range(len(commands))},
        "production_sources": before, "fixture": digest(FIXTURE),
        "wars": {str(folder / p.name): digest(folder / p.name) for p in paths},
    })
    print(f"Bundle: {folder}; basename: {basename}", flush=True)


class Verification:
    def __init__(self, args):
        self.args = args
        self.root = args.run_folder.resolve()
        self.root.mkdir(parents=True, exist_ok=False)
        self.env = {**os.environ, "NO_PROXY": "*", "no_proxy": "*", "PYTHONDONTWRITEBYTECODE": "1", "TZ": "UTC",
                    "EPICS_CA_AUTO_ADDR_LIST": "NO", "EPICS_CA_ADDR_LIST": "127.0.0.1",
                    "EPICS_CA_SERVER_PORT": str(args.ca_port), "EPICS_CAS_SERVER_PORT": str(args.ca_port),
                    "EPICS_CAS_INTF_ADDR_LIST": "127.0.0.1", "EPICS_CAS_BEACON_ADDR_LIST": "127.0.0.1",
                    "EPICS_PVAS_INTF_ADDR_LIST": "224.0.1.1,1@127.0.0.1"}
        self.bpl = f"http://127.0.0.1:{args.port_base}/mgmt/bpl"
        self.retrieval = f"http://127.0.0.1:{args.port_base + 3}/retrieval/data/getData.json"
        self.prefix = f"PVRENAME:{uuid.uuid4().hex[:8]}:"
        self.pvs = [self.prefix + f"test_{i}" for i in range(37)]
        self.control = self.pvs[35]
        self.app = self.ioc = self.tracer = None
        self.results, self.stores, self.cache, self.failed_paths = [], set(), {}, set()
        self.http = build_opener(ProxyHandler({}))
        self.began = time.time_ns()
        self.baselines, self.infos, self.successful = {}, {}, {}
        self.end = None
        deps = args.classpath_file.read_text().strip().split(os.pathsep)
        cp = os.pathsep.join([str(REPO / "target/test-classes"), str(REPO / "target/classes"), *deps])
        (self.root / "reader-log.xml").write_text(
            '<Configuration status="OFF"><Appenders/><Loggers><Root level="off"/></Loggers></Configuration>\n')
        self.java = [shutil.which("java"), "-Dlog4j2.configurationFile=" + str(self.root / "reader-log.xml"),
                     "-cp", cp, ADAPTER]
        evidence = json.loads(args.bundle_manifest.read_text())
        if any(digest(Path(path)) != expected for path, expected in evidence["build_logs"].items()):
            raise RuntimeError("build evidence changed")
        self.wars = {str(args.war_dir.resolve() / f"{args.war_basename}-{c}.war"):
                     digest(args.war_dir.resolve() / f"{args.war_basename}-{c}.war") for c in COMPONENTS}
        if self.wars != evidence["wars"] or source_digests() != evidence["production_sources"]:
            raise RuntimeError("WARs or production sources differ from their build evidence")
        if digest(FIXTURE) != evidence["fixture"]:
            raise RuntimeError("IOC fixture differs from its build evidence")
        if set(p.name for p in args.war_dir.glob("*.war")) != set(Path(p).name for p in self.wars):
            raise RuntimeError("war-dir must contain only the explicitly selected four-WAR bundle")
        sources = [Path(__file__), REPO / "src/test/org/epics/archiverappliance/mgmt/RenamePVTest.java",
                   REPO / "src/test/org/epics/archiverappliance/verification/PVSampleDump.java"]
        sources += [SAMPLES / name for name in ("renamePVList.py", "archiverClient.py", "archivePVList.bash", "archiverClient.bash",
                                               "pausePVList.py", "resumePVList.py", "getPVStatus.py", "listArchivedPVs.py")]
        save(self.root, "manifest.json", {
            "observed_at": instant(self.began), "head": subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip(),
            "sources": {str(p.relative_to(REPO)): digest(p) for p in sources}, "fixture": digest(FIXTURE),
            "bundle_manifest": digest(args.bundle_manifest), "wars": self.wars, "war_basename": args.war_basename,
            "adapter": digest(REPO / "target/test-classes" / (ADAPTER.replace(".", "/") + ".class")),
            "classpath": cp, "classpath_file": digest(args.classpath_file),
            "dependencies": {p: digest(Path(p)) for p in deps}, "prefix": self.prefix,
            "strace": subprocess.check_output([args.strace, "--version"], text=True).splitlines()[0],
        })
        print(f"Evidence: {self.root}", flush=True)

    def record(self, name, passed, **detail):
        self.results.append({"case": name, "passed": bool(passed), **detail})
        save(self.root, "results.json", self.results)
        print(f"[ {'PASS' if passed else 'FAIL'} ] {name}", flush=True)
        if not passed:
            raise RuntimeError(name + " failed")

    def wait(self, action, timeout, name, poll=1):
        began, last = time.monotonic(), None
        while time.monotonic() - began < timeout:
            for proc in (self.app, self.ioc):
                if proc is not None and proc.poll() is not None:
                    raise RuntimeError(f"owned process exited during {name}: {proc.returncode}")
            last = action()
            if last:
                save(self.root, name + "-wait.json", {"elapsed": time.monotonic() - began, "last": last})
                return last
            time.sleep(poll)
        save(self.root, name + "-wait.json", {"elapsed": time.monotonic() - began, "last": last, "expired": True})
        self.record(name + "-deadline", False, deadline=timeout)

    def api(self, action, params=None):
        url = self.bpl + "/" + action + ("?" + urlencode(params) if params else "")
        with self.http.open(Request(url), timeout=HTTP_TIMEOUT) as response:
            body = json.load(response)
        with (self.root / "http.jsonl").open("a") as out:
            out.write(json.dumps({"time": instant(time.time_ns()), "url": url, "response": body}) + "\n")
        return body

    def info(self, pv):
        body = self.api("getPVTypeInfo", {"pv": pv})
        if body.get("pvName") != pv:
            raise RuntimeError("unexpected type-info identity")
        return body

    def states(self, names):
        return {r["pvName"]: r["status"] for r in self.api("getPVStatus", {"pv": ",".join(names)})}

    def await_state(self, names, state, name, timeout=READY_TIMEOUT):
        self.wait(lambda: self.states(names) == dict.fromkeys(names, state), timeout, name)

    def cli(self, name, script, inputs, statuses=None, code=0, options=()):
        path = self.root / (name + ".txt")
        path.write_text("\n".join(inputs) + "\n")
        command = ["bash" if script.endswith(".bash") else sys.executable, str(SAMPLES / script), self.bpl, str(path), *options]
        # Observe the real HTTP syscalls without routing, replacing or replaying requests.
        trace = self.root / (name + "-http.trace")
        result = subprocess.run([self.args.strace, "-f", "-s", "65535", "-e", "trace=network",
                                 "-o", str(trace), *command], env=self.env, cwd=REPO, text=True,
                                capture_output=True, timeout=READY_TIMEOUT)
        (self.root / (name + ".stdout")).write_text(result.stdout)
        (self.root / (name + ".stderr")).write_text(result.stderr)
        rows = [re.split(r" {3,}", line) for line in result.stdout.splitlines() if line.startswith(self.prefix)]
        passed = result.returncode == code and "Traceback" not in result.stderr
        if code == 0:
            passed = passed and not result.stderr
        if statuses is not None:
            expected = [[*entry.split(","), status] if script == "renamePVList.py" else [entry, status]
                        for entry, status in zip(inputs, statuses)]
            passed = passed and rows == expected
        self.record(name, passed, command=command, exit=result.returncode)
        if script == "renamePVList.py":
            sent = len(re.findall(r'sendto\([^\n]*"GET /mgmt/bpl/renamePV\?', trace.read_text()))
            self.record(name + "-requests", sent == (len(inputs) if code in (0, 1) else 0), sent=sent)
        return result

    def values(self, pv, end=None):
        url = self.retrieval + "?" + urlencode({"pv": pv, "from": instant(self.began),
                                               "to": instant(end or time.time_ns())})
        with self.http.open(Request(url), timeout=HTTP_TIMEOUT) as response:
            body = json.load(response)
        with (self.root / "retrieval.jsonl").open("a") as out:
            out.write(json.dumps({"url": url, "response": body}) + "\n")
        if len(body) != 1 or body[0]["meta"]["name"] != pv:
            raise RuntimeError("unexpected retrieval structure or identity")
        rows = body[0]["data"]
        for row in rows:
            sample_tuple(row)
        return rows

    def multiset(self, rows, pv=None):
        return Counter(sample_tuple(row) for row in rows if
                       (pv is None or row["pvName"] == pv) and self.began <= stamp(row) <= self.end)

    def read_file(self, path, name, force=False):
        signature = (path.stat().st_size, path.stat().st_mtime_ns)
        if not force and path in self.cache and self.cache[path][0] == signature:
            return self.cache[path][1]
        began = time.time_ns()
        result = subprocess.run([*self.java, str(path)], env=self.env, cwd=REPO, text=True,
                                capture_output=True, timeout=HTTP_TIMEOUT)
        rows = [json.loads(line) for line in result.stdout.splitlines()]
        detail = {"path": str(path), "exists": True, "began": instant(began),
                  "completed": instant(time.time_ns()), "bytes": path.stat().st_size,
                  "sha256": digest(path), "reader_exit": result.returncode,
                  "stdout": result.stdout, "stderr": result.stderr}
        with (self.root / (name + "-files.jsonl")).open("a") as out:
            out.write(json.dumps(detail) + "\n")
        for row in rows:
            if row["kind"] == "sample":
                sample_tuple(row)
        if result.returncode and path not in self.failed_paths:
            raise ReaderFailure(f"unexplained PB reader failure: {path}; see {name}-files.jsonl")
        self.cache[path] = (signature, rows)
        return rows

    def pb(self, name, force=False):
        began, last = time.monotonic(), None
        while time.monotonic() - began < READY_TIMEOUT:
            try:
                rows = []
                for directory in sorted(self.stores):
                    for path in sorted(directory.rglob("*.pb")):
                        if time.monotonic() - began >= READY_TIMEOUT:
                            raise ReaderFailure("PB observation deadline exceeded")
                        rows.extend(row for row in self.read_file(path, name, force) if row["kind"] == "sample")
                return rows
            except (ReaderFailure, OSError) as exc:
                last = str(exc)
                save(self.root, name + "-last-reader-error.json", {"elapsed": time.monotonic() - began, "last": last})
                time.sleep(1)
        raise ReaderFailure(f"PB observation exceeded {READY_TIMEOUT}s: {last}")

    def check_copy(self, label, source, destination):
        self.await_state([source, destination], "Paused", label + "-paused")
        old, new = self.info(source), self.info(destination)
        self.record(label + "-settings", old == self.infos[source]
                    and all(old[k] == new[k] for k in COPIED_FIELDS),
                    source=old, destination=new)
        wanted = self.baselines[source]
        self.wait(lambda: self.multiset(self.values(destination, self.end)) == wanted,
                  READY_TIMEOUT, label + "-retrieval-copy")
        rows = self.pb(label)
        self.record(label + "-exact-data",
                    self.multiset(self.values(source, self.end)) == wanted
                    and self.multiset(rows, source) == wanted and self.multiset(rows, destination) == wanted,
                    count=sum(wanted.values()), distinct=len(wanted))
        self.successful[destination] = source

    def setup(self):
        for port, kind in [(self.args.port_base + n, socket.SOCK_STREAM) for n in (0, 1, 2, 3, 5)] + [
                (self.args.ca_port, socket.SOCK_STREAM), (self.args.ca_port, socket.SOCK_DGRAM)]:
            with socket.socket(type=kind) as probe:
                probe.bind(("127.0.0.1", port))
        command = [str(REPO / "scripts/run-local-appliance.bash"), "--port-base", str(self.args.port_base),
                   "--tomcat-home", str(Path(self.args.tomcat_home).resolve()), "--war-dir", str(self.args.war_dir.resolve()),
                   "--stop-timeout", str(STOP_TIMEOUT), str(self.root / "appliance")]
        save(self.root, "launcher-command.json", command)
        with (self.root / "launcher.log").open("w") as log:
            self.app = subprocess.Popen(command, env=self.env, cwd=REPO, stdout=log, stderr=subprocess.STDOUT)
        status = self.root / "appliance/status"
        self.wait(lambda: status.exists() and status.read_text().strip() == "ready", START_TIMEOUT, "startup")
        deployed = {c: digest(self.root / f"appliance/instances/{c}/webapps/{c}.war") for c in COMPONENTS}
        self.record("deployed-war-digests", deployed == {c: self.wars[str(
            self.args.war_dir.resolve() / f"{self.args.war_basename}-{c}.war")] for c in COMPONENTS}, deployed=deployed)
        command = [str(Path(self.args.ioc).resolve()), "-m", "P=" + self.prefix, "-d", str(FIXTURE)]
        save(self.root, "ioc-command.json", command)
        with (self.root / "ioc.log").open("w") as log:
            self.ioc = subprocess.Popen(command, env=self.env, cwd=self.root, stdin=subprocess.PIPE, text=True,
                                        stdout=log, stderr=subprocess.STDOUT)
        self.cli("archive", "archivePVList.bash", self.pvs, ["Archive request submitted"] * len(self.pvs),
                 options=("--sampling-period", ARCHIVE_PERIOD))
        self.await_state(self.pvs, "Being archived", "initial-archive", ARCHIVE_TIMEOUT)
        self.wait(lambda: all(len(self.values(pv)) >= 3 for pv in self.pvs), READY_TIMEOUT, "baseline")
        command = f'dbpf("{self.pvs[32]}.PROC", "1")\n'
        commands = command * BURST_SAMPLES
        (self.root / "ioc-processing-commands.txt").write_text(commands)
        descriptor = self.ioc.stdin.fileno()
        os.set_blocking(descriptor, False)
        began = time.monotonic()
        try:
            for _ in range(BURST_SAMPLES):
                pending = memoryview(command.encode())
                while pending:
                    if time.monotonic() - began >= READY_TIMEOUT or self.ioc.poll() is not None:
                        raise RuntimeError("IOC processing input deadline or early exit")
                    if select.select([], [descriptor], [], 0.1)[1]:
                        try:
                            pending = pending[os.write(descriptor, pending):]
                        except BlockingIOError:
                            continue
                time.sleep(PROCESS_INTERVAL)
        finally:
            os.set_blocking(descriptor, True)
        save(self.root, "ioc-processing-timing.json", {"count": BURST_SAMPLES,
             "interval": PROCESS_INTERVAL, "elapsed": time.monotonic() - began})
        paused = [pv for i, pv in enumerate(self.pvs) if i not in (28, 29, 30, 35, 36)]
        self.cli("pause", "pausePVList.py", paused, ["Pause accepted"] * len(paused))
        self.await_state(paused, "Paused", "paused")
        self.end = time.time_ns()
        children = (self.root / "appliance/children.tsv").read_text().splitlines()
        engine_pid = next(line.split("\t")[2] for line in children if line.split("\t")[1] == "engine")
        env = dict(item.split("=", 1) for item in Path(f"/proc/{engine_pid}/environ").read_text().split("\0") if "=" in item)
        for pv in self.pvs:
            self.infos[pv] = self.info(pv)
            self.baselines[pv] = self.multiset(self.values(pv, self.end))
            for store in self.infos[pv]["dataStores"]:
                folder = parse_qs(urlsplit(store).query)["rootFolder"][0]
                for key in ("ARCHAPPL_SHORT_TERM_FOLDER", "ARCHAPPL_MEDIUM_TERM_FOLDER", "ARCHAPPL_LONG_TERM_FOLDER"):
                    folder = folder.replace("$" + "{" + key + "}", env[key])
                self.stores.add(Path(folder).resolve())
        save(self.root, "baselines.json", {pv: list(records.items()) for pv, records in self.baselines.items()})
        save(self.root, "stores.json", {"roots": sorted(map(str, self.stores)),
                                     "urls": {pv: self.infos[pv]["dataStores"] for pv in self.pvs}})
        def persisted():
            rows = self.pb("baseline-persistence")
            return all(sum(self.baselines[pv].values()) >= 3 and
                       self.multiset(rows, pv) == self.baselines[pv] for pv in paused)
        self.wait(persisted, READY_TIMEOUT, "paused-baseline-persistence")
        self.record("paused-baseline-persistence", True)
        self.record("partial-copy-source-size", sum(p.stat().st_size for p in self.paths_for(self.pvs[32]))
                    > COPY_MIN_BYTES)

    def cases(self):
        pairs = [(self.pvs[i], self.prefix + f"copy_{i}") for i in range(3)]
        self.cli("all-success", "renamePVList.py", [a + "," + b for a, b in pairs], ["Rename accepted"] * 3)
        for i, (source, destination) in enumerate(pairs):
            self.check_copy(f"all-success-{i}", source, destination)
        alias = self.prefix + "configuredAlias"
        self.record("alias-setup", self.api("addAlias", {"pv": self.pvs[3], "aliasname": alias}).get("status") == "ok")
        self.infos[self.pvs[3]] = self.info(self.pvs[3])
        for label, source, displayed in (("alias", self.pvs[3], alias), ("val", self.pvs[4], self.pvs[4] + ".VAL")):
            destination = self.prefix + label + "_copy"
            self.cli(label, "renamePVList.py", [displayed + "," + destination], ["Rename accepted"])
            self.check_copy(label, source, destination)
        inventory = self.api("getAllPVs", {"limit": -1})
        for label, inputs in (
                ("chain", [self.pvs[5] + "," + self.prefix + "unused", self.prefix + "unused," + self.prefix + "other"]),
                ("repeat-source", [self.pvs[5] + "," + self.prefix + "unused", self.pvs[5] + "," + self.prefix + "other"]),
                ("repeat-destination", [self.pvs[5] + "," + self.prefix + "unused", self.pvs[6] + "," + self.prefix + "unused"]),
                ("alias-overlap", [alias + "," + self.prefix + "unused", self.pvs[3] + "," + self.prefix + "other"])):
            self.cli(label, "renamePVList.py", inputs, code=2)
            self.record(label + "-inventory", self.api("getAllPVs", {"limit": -1}) == inventory)
        index = 7
        for kind in ("occupied", "unpaused", "unknown"):
            for position in range(3):
                label = f"mixed-{kind}-{position}"
                good = self.pvs[index:index + 2]
                index += 2
                source = self.pvs[25 + position] if kind == "occupied" else (
                    self.pvs[28 + position] if kind == "unpaused" else self.prefix + "unknown_" + str(position))
                destination = self.control if kind == "occupied" else self.prefix + label + "_rejected"
                good_pairs = [(pv, self.prefix + label + f"_copy_{n}") for n, pv in enumerate(good)]
                pairs = good_pairs.copy()
                pairs.insert(position, (source, destination))
                before = {pv: self.info(pv) for pv in (source, destination) if pv in self.pvs}
                labels = ["Rename accepted"] * 3
                labels[position] = "Outcome unknown"
                self.cli(label, "renamePVList.py", [a + "," + b for a, b in pairs], labels, 1)
                for n, (old, new) in enumerate(good_pairs):
                    self.check_copy(label + f"-good-{n}", old, new)
                for pv, info in before.items():
                    self.record(label + "-retained-" + pv.rsplit(":", 1)[-1],
                                all(self.info(pv)[k] == info[k] for k in COPIED_FIELDS)
                                and self.multiset(self.values(pv, self.end)) == self.baselines[pv])
                if kind != "occupied":
                    self.record(label + "-destination-absent",
                                self.states([destination])[destination] == "Not being archived")
                if kind == "unknown":
                    self.record(label + "-source-absent", self.states([source])[source] == "Not being archived")
        control_now = self.values(self.control)
        self.record("control-keeps-updating", any(stamp(row) > self.end for row in control_now)
                    and self.multiset(control_now) == self.baselines[self.control])

    def paths_for(self, pv):
        self.pb("path-inventory")
        return sorted(path for path, (_, rows) in self.cache.items()
                      if any(row["kind"] == "header" and row["pvName"] == pv for row in rows))

    def fault_path(self, source, destination):
        paths = self.paths_for(source)
        if not paths:
            raise RuntimeError("source has no real PB path")
        old, new = source.rsplit(":", 1)[-1], destination.rsplit(":", 1)[-1]
        predicted = paths[0].with_name(paths[0].name.replace(old + ":", new + ":", 1))
        if predicted == paths[0]:
            raise RuntimeError("unexpected fixture path layout")
        return predicted

    def attach_trace(self, path, label, injection=None):
        mgmt = next(child for child in owned_jvms_alive(self.root) if child["component"] == "mgmt")
        command = [self.args.strace, "-f", "-ttt", "-yy", "-s", "96", "-p", mgmt["pid"], "-P", str(path),
                   "-e", "trace=openat,write,close,ftruncate", "-o", str(self.root / (label + "-filesystem.trace"))]
        if injection:
            command += ["-e", injection]
        save(self.root, label + "-trace-command.json", command)
        with (self.root / (label + "-trace.stderr")).open("w") as log:
            self.tracer = subprocess.Popen(command, env=self.env, stdout=log, stderr=log)
        began = time.monotonic()
        while time.monotonic() - began < 10:
            if self.tracer.poll() is not None:
                raise RuntimeError("filesystem tracing could not attach")
            if "attached" in (self.root / (label + "-trace.stderr")).read_text():
                return
            time.sleep(0.1)
        raise RuntimeError("filesystem tracing attach deadline")

    def detach_trace(self):
        if self.tracer is not None:
            if self.tracer.poll() is None:
                self.tracer.send_signal(signal.SIGINT)
            self.tracer.wait(timeout=10)
            self.tracer = None
        self.wait(lambda: self.states([self.control])[self.control] == "Being archived",
                  READY_TIMEOUT, "post-fault-ready")

    def filesystem_cases(self):
        for index, partial in enumerate((False, True)):
            label = "partial-copy-fault" if partial else "destination-write-fault"
            source, healthy = self.pvs[31 + index], self.pvs[33 + index]
            destination = self.prefix + label.replace("-", "_")
            later = destination + "_later"
            path = self.fault_path(source, destination)
            if path.exists():
                raise RuntimeError("fault destination must be unused")
            self.failed_paths.add(path)
            observed = []
            try:
                if partial:
                    self.record(label + "-source-size", sum(p.stat().st_size for p in self.paths_for(source))
                                > COPY_MIN_BYTES)
                    probe = destination + "_probe"
                    probe_path = self.fault_path(source, probe)
                    self.attach_trace(probe_path, label + "-probe")
                    try:
                        self.cli(label + "-probe", "renamePVList.py", [source + "," + probe], ["Rename accepted"])
                    finally:
                        self.detach_trace()
                    self.check_copy(label + "-probe", source, probe)
                    probe_trace = (self.root / (label + "-probe-filesystem.trace")).read_text()
                    writes = re.findall(r"write\([^\n]+ = ([0-9]+)", probe_trace)
                    self.record(label + "-probe-writes", len(writes) >= 2 and str(probe_path) in probe_trace,
                                successful_write_sizes=list(map(int, writes)), path=str(probe_path))
                    self.attach_trace(path, label,
                                      f"inject=write:error=EIO:when=2:delay_enter={FAULT_DELAY_SECONDS}s")
                    with ThreadPoolExecutor(max_workers=1) as pool:
                        future = pool.submit(self.cli, label, "renamePVList.py",
                                             [source + "," + destination, healthy + "," + later],
                                             ["Outcome unknown", "Rename accepted"], 1)
                        began = time.monotonic()
                        while not future.done() and time.monotonic() - began < READY_TIMEOUT:
                            if path.exists() and path.stat().st_size:
                                rows = self.read_file(path, label + "-copy-onset", force=True)
                                copied = [row for row in rows if row["kind"] == "sample"]
                                if copied:
                                    observed = copied
                            time.sleep(1)
                        future.result(timeout=READY_TIMEOUT)
                else:
                    path.touch(exist_ok=False)
                    path.chmod(0o400)
                    self.attach_trace(path, label)
                    self.cli(label, "renamePVList.py", [source + "," + destination, healthy + "," + later],
                             ["Outcome unknown", "Rename accepted"], 1)
            finally:
                if not partial and path.exists():
                    path.chmod(0o600)
                self.detach_trace()
            trace = (self.root / (label + "-filesystem.trace")).read_text()
            intended = str(path) in trace and ("EIO" in trace and "INJECTED" in trace if partial else
                                               "EACCES" in trace and "O_WRONLY" in trace)
            self.record(label + "-intended-fault", intended, path=str(path))
            if partial:
                self.record(label + "-actual-copy-onset", bool(observed)
                            and self.multiset(observed) <= self.baselines[source], records=len(observed))
            self.await_state([source, destination], "Paused", label + "-metadata-retained")
            self.record(label + "-source-control-settings", all(
                all(self.info(pv)[key] == self.infos[pv][key] for key in COPIED_FIELDS)
                for pv in (source, self.control)))
            rows = self.pb(label + "-after", force=True)
            self.record(label + "-source-control-data", all(
                self.multiset(rows, pv) == self.baselines[pv]
                and self.multiset(self.values(pv, self.end)) == self.baselines[pv] for pv in (source, self.control)))
            self.check_copy(label + "-later", healthy, later)
            if not path.exists():
                save(self.root, label + "-destination-file.json", {"path": str(path), "exists": False})
            else:
                self.read_file(path, label + "-destination", force=True)

    def documented_commands(self):
        source, destination = self.pvs[36], self.prefix + "documented_copy"
        source_file, pair_file, both_file = [self.root / (name + ".txt") for name in ("doc-source", "doc-pairs", "doc-both")]
        source_file.write_text(source + "\n")
        pair_file.write_text(source + "," + destination + "\n")
        both_file.write_text(source + "\n" + destination + "\n")
        page = (REPO / "docs/book/src/scripting.md").read_text()
        commands = page.split("## Rename a paused PV\n", 1)[1].split("```bash\n", 1)[1].split("```", 1)[0]
        result = subprocess.run(["bash", "-e", "-c", commands], cwd=REPO, capture_output=True, text=True,
                                timeout=READY_TIMEOUT, env={**self.env, "BPL_URL": self.bpl,
                                "SOURCE_FILE": str(source_file), "PAIR_FILE": str(pair_file), "BOTH_FILE": str(both_file)})
        (self.root / "documented-commands.stdout").write_text(result.stdout)
        (self.root / "documented-commands.stderr").write_text(result.stderr)
        rows = [re.split(r" {3,}", line) for line in result.stdout.splitlines() if line.startswith(self.prefix)]
        self.record("documented-commands", result.returncode == 0 and not result.stderr and rows == [
            [source, "Pause accepted"], [source, "Paused"], [source, destination, "Rename accepted"],
            [source, "Paused"], [destination, "Paused"]], commands=commands)
        self.infos[source] = self.info(source)
        self.check_copy("documented-copy", source, destination)

    def cleanup(self):
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        detail = {}
        try:
            try:
                if self.tracer is not None:
                    try:
                        if self.tracer.poll() is None:
                            self.tracer.send_signal(signal.SIGINT)
                        detail["tracer_exit"] = self.tracer.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        detail["tracer_forced_stop"] = True
                        self.tracer.kill()
                        detail["tracer_exit"] = self.tracer.wait(timeout=10)
            finally:
                if self.app is not None:
                    deadline = time.monotonic() + STOP_TIMEOUT + STOP_ALLOWANCE
                    try:
                        if self.app.poll() is None:
                            self.app.terminate()
                        detail["launcher_exit"] = self.app.wait(timeout=STOP_TIMEOUT + STOP_ALLOWANCE)
                    except subprocess.TimeoutExpired:
                        self.app.kill()
                        detail["launcher_forced_stop"] = True
                        detail["launcher_exit"] = self.app.wait(timeout=STOP_ALLOWANCE)
                    finally:
                        detail.update(stop_owned_jvms(self.root, deadline))
        finally:
            if self.ioc is not None:
                if self.ioc.poll() is None:
                    self.ioc.stdin.write("exit\n")
                    self.ioc.stdin.flush()
                try:
                    detail["ioc_exit"] = self.ioc.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    self.ioc.kill()
                    self.ioc.wait()
                    detail["ioc_forced_stop"] = True
                self.ioc.stdin.close()
            save(self.root, "cleanup.json", detail)
        if (detail.get("launcher_exit") != 143 or detail.get("ioc_exit") != 0
                or detail.get("owned_jvms_alive") or detail.get("fallback_terminated")
                or detail.get("fallback_killed") or detail.get("launcher_forced_stop")
                or detail.get("ioc_forced_stop") or detail.get("tracer_forced_stop")):
            raise RuntimeError(f"cleanup failed: {detail}")
        return detail


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_folder", type=Path)
    parser.add_argument("--prepare-bundle", action="store_true", help="build a bundle in run_folder and exit")
    parser.add_argument("--tomcat-home", default=os.environ.get("TOMCAT_HOME"))
    parser.add_argument("--ioc", default=shutil.which("softIocPVX"))
    parser.add_argument("--strace", default=shutil.which("strace"))
    parser.add_argument("--war-dir", type=Path)
    parser.add_argument("--war-basename")
    parser.add_argument("--bundle-manifest", type=Path)
    parser.add_argument("--classpath-file", type=Path, default=REPO / "work/rename-classpath.txt")
    parser.add_argument("--port-base", type=int, default=20665)
    parser.add_argument("--ca-port", type=int, default=20675)
    args = parser.parse_args()
    if args.prepare_bundle:
        prepare_bundle(args.run_folder, args.classpath_file)
        return
    if not all((args.tomcat_home, args.ioc, args.strace, args.war_dir, args.war_basename, args.bundle_manifest)):
        parser.error("live verification requires Tomcat, IOC, strace, war-dir, war-basename and bundle-manifest")
    if not 1024 <= args.port_base <= 65530 or not 1024 <= args.ca_port <= 65535:
        parser.error("ports must be unprivileged and leave room for appliance offsets")
    if args.ca_port in {args.port_base + n for n in (0, 1, 2, 3, 5)}:
        parser.error("CA port must be distinct from appliance ports")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", args.war_basename):
        parser.error("invalid WAR basename")
    verification = Verification(args)
    try:
        verification.setup()
        verification.cases()
        verification.filesystem_cases()
        verification.documented_commands()
    finally:
        verification.cleanup()
    rows = verification.pb("after-shutdown", force=True)
    verification.record("after-shutdown-retention", all(
        verification.multiset(rows, pv) == baseline for pv, baseline in verification.baselines.items())
        and all(verification.multiset(rows, destination) == verification.baselines[source]
                for destination, source in verification.successful.items()))
    print(f"PASS: {len(verification.results)} checks; owned appliance and IOC stopped", flush=True)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda signum, frame: sys.exit(1))
    main()
