#!/usr/bin/env python3
"""Verify deletion modes and actual filesystem failures without replacing appliance components."""

import argparse
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
import zipfile
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import ProxyHandler, build_opener

from verify_list_archived_pvs import (
    ARCHIVE_TIMEOUT, FIXTURE, REPO, START_TIMEOUT, STOP_ALLOWANCE, STOP_TIMEOUT,
    digest, save, owned_jvms_alive, stop_owned_jvms,
)
from verify_pause_resume import ADAPTER, READY_TIMEOUT, instant
from verify_rename import COMPONENTS, Verification as ApplianceObservations, prepare_bundle, source_digests

SAMPLES = REPO / "docs/book/src/samples"
ARCHIVE_PERIOD = "0.1"


class Verification(ApplianceObservations):
    """Reuse actual HTTP/PB observations; own the deletion fixture and assertions."""

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
        self.prefix = f"PVDELETE:{uuid.uuid4().hex[:8]}:"
        self.pvs = [self.prefix + f"test_{i}" for i in range(55)]
        self.control = self.pvs[48]
        self.app = self.ioc = self.tracer = None
        self.results, self.stores, self.cache, self.failed_paths = [], set(), {}, set()
        self.http = build_opener(ProxyHandler({}))
        self.began, self.end = time.time_ns(), None
        self.baselines, self.infos, self.deleted = {}, {}, {}
        self.aliases, self.round = {}, 0
        deps = args.classpath_file.read_text().strip().split(os.pathsep)
        cp = os.pathsep.join([str(REPO / "target/test-classes"), str(REPO / "target/classes"), *deps])
        (self.root / "reader-log.xml").write_text(
            '<Configuration status="OFF"><Appenders/><Loggers><Root level="off"/></Loggers></Configuration>\n')
        self.java = [shutil.which("java"), "-Dlog4j2.configurationFile=" + str(self.root / "reader-log.xml"),
                     "-cp", cp, ADAPTER]
        evidence = json.loads(args.bundle_manifest.read_text())
        self.wars = {str(args.war_dir.resolve() / f"{args.war_basename}-{c}.war"):
                     digest(args.war_dir.resolve() / f"{args.war_basename}-{c}.war") for c in COMPONENTS}
        if (self.wars != evidence["wars"] or source_digests() != evidence["production_sources"]
                or digest(FIXTURE) != evidence["fixture"] or any(
                    digest(Path(path)) != expected for path, expected in evidence["build_logs"].items())):
            raise RuntimeError("bundle sources, fixture, WARs or successful build evidence changed")
        if set(p.name for p in args.war_dir.glob("*.war")) != set(Path(p).name for p in self.wars):
            raise RuntimeError("war-dir must contain only the selected four-WAR bundle")
        sources = [Path(__file__), REPO / "src/test/pythontests/verify_rename.py",
                   REPO / "src/test/pythontests/verify_pause_resume.py",
                   REPO / "src/test/pythontests/verify_list_archived_pvs.py",
                   REPO / "src/test/org/epics/archiverappliance/mgmt/pauseresume/DeletePVTest.java",
                   REPO / "src/test/org/epics/archiverappliance/verification/PVSampleDump.java"]
        sources += [SAMPLES / name for name in ("deletePVList.py", "archiverClient.py", "archivePVList.py",
                                               "pausePVList.py", "getPVStatus.py", "listArchivedPVs.py")]
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

    def observe(self, name, passed, **detail):
        """Retain failure evidence without skipping independent fault observations."""
        self.results.append({"case": name, "passed": bool(passed), **detail})
        save(self.root, "results.json", self.results)
        print(f"[ {'PASS' if passed else 'FAIL'} ] {name}", flush=True)

    def wait(self, action, timeout, name, poll=1):
        began, last = time.monotonic(), None
        deadline = began + timeout
        while time.monotonic() < deadline:
            for proc in (self.app, self.ioc):
                if proc is not None and proc.poll() is not None:
                    raise RuntimeError(f"owned process exited during {name}: {proc.returncode}")
            last = action()
            now = time.monotonic()
            if now >= deadline:
                break
            if last:
                save(self.root, name + "-wait.json", {"elapsed": now - began, "last": last})
                return last
            time.sleep(min(poll, deadline - now))
        save(self.root, name + "-wait.json", {"elapsed": time.monotonic() - began, "last": last, "expired": True})
        self.record(name + "-deadline", False, deadline=timeout)

    def cli(self, name, script, inputs, statuses=None, code=0, options=(), defer=False):
        path = self.root / (name + ".txt")
        path.write_text("\n".join(inputs) + "\n")
        command = [sys.executable, str(SAMPLES / script), self.bpl, str(path), *options]
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
            passed = passed and rows == [[entry, status] for entry, status in zip(inputs, statuses)]
        record = self.observe if defer else self.record
        record(name, passed, command=command, exit=result.returncode, rows=rows)
        if script == "deletePVList.py":
            requests = [parse_qs(urlsplit(url).query) for url in re.findall(
                r"GET (/mgmt/bpl/deletePV\?[^ ]+) HTTP", trace.read_text())]
            expected = [{"pv": [self.aliases.get(entry, entry.removesuffix(".VAL"))],
                         "deleteData": ["true" if "--delete-data" in options else "false"]} for entry in inputs]
            record(name + "-single-requests", requests == (expected if code in (0, 1) else []), requests=requests)
        return result

    def start_appliance(self):
        self.round += 1
        command = [str(REPO / "scripts/run-local-appliance.bash"), "--port-base", str(self.args.port_base),
                   "--tomcat-home", str(Path(self.args.tomcat_home).resolve()),
                   "--war-dir", str(self.args.war_dir.resolve()), "--stop-timeout", str(STOP_TIMEOUT),
                   str(self.root / "appliance")]
        save(self.root, f"launcher-{self.round}-command.json", command)
        with (self.root / f"launcher-{self.round}.log").open("w") as log:
            self.app = subprocess.Popen(command, env=self.env, cwd=REPO, stdout=log, stderr=subprocess.STDOUT)
        def ready():
            status = self.root / "appliance/status"
            if len(owned_jvms_alive(self.root)) != 4 or not status.exists() or status.read_text().strip() != "ready":
                return False
            try:
                return isinstance(self.api("getAllPVs", {"limit": -1}), list)
            except (OSError, ValueError):
                return False
        self.wait(ready, START_TIMEOUT, f"startup-{self.round}")
        deployed = {c: digest(self.root / f"appliance/instances/{c}/webapps/{c}.war") for c in COMPONENTS}
        self.record(f"deployed-wars-{self.round}", deployed == {c: self.wars[str(
            self.args.war_dir.resolve() / f"{self.args.war_basename}-{c}.war")] for c in COMPONENTS}, deployed=deployed)
        for pv in self.deleted:
            self.metadata_absent(pv, f"restart-{self.round}-{pv.rsplit(':', 1)[-1]}")
        if self.infos:
            self.record(f"restart-control-{self.round}", self.info(self.control) == self.infos[self.control]
                        and self.multiset(self.values(self.control, self.end)) == self.baselines[self.control])

    def stop_appliance(self):
        if self.app is None:
            return
        detail = {}
        deadline = time.monotonic() + STOP_TIMEOUT + STOP_ALLOWANCE
        try:
            if self.app.poll() is None:
                self.app.terminate()
            detail["launcher_exit"] = self.app.wait(timeout=STOP_TIMEOUT + STOP_ALLOWANCE)
        except subprocess.TimeoutExpired:
            self.app.kill()
            detail["forced_stop"] = True
            detail["launcher_exit"] = self.app.wait(timeout=STOP_ALLOWANCE)
        finally:
            detail.update(stop_owned_jvms(self.root, deadline))
            save(self.root, f"stop-{self.round}.json", detail)
            self.app = None
        self.record(f"normal-stop-{self.round}", detail.get("launcher_exit") == 143
                    and not any(detail.get(k) for k in (
                        "forced_stop", "owned_jvms_alive", "fallback_terminated", "fallback_killed")), **detail)

    def setup(self):
        for port, kind in [(self.args.port_base + n, socket.SOCK_STREAM) for n in (0, 1, 2, 3, 5)] + [
                (self.args.ca_port, socket.SOCK_STREAM), (self.args.ca_port, socket.SOCK_DGRAM)]:
            with socket.socket(type=kind) as probe:
                probe.bind(("127.0.0.1", port))
        self.start_appliance()
        command = [str(Path(self.args.ioc).resolve()), "-m", "P=" + self.prefix, "-d", str(FIXTURE)]
        save(self.root, "ioc-command.json", command)
        with (self.root / "ioc.log").open("w") as log:
            self.ioc = subprocess.Popen(command, env=self.env, cwd=self.root, stdin=subprocess.PIPE, text=True,
                                        stdout=log, stderr=subprocess.STDOUT)
        self.cli("archive", "archivePVList.py", self.pvs, ["Archive request submitted"] * len(self.pvs),
                 options=("--sampling-period", ARCHIVE_PERIOD))
        self.await_state(self.pvs, "Being archived", "initial-archive", ARCHIVE_TIMEOUT)
        self.wait(lambda: all(len(self.values(pv)) >= 3 for pv in self.pvs), READY_TIMEOUT, "baseline")
        paused = [pv for i, pv in enumerate(self.pvs) if i not in (23, 47, 49, 50)]
        self.cli("pause", "pausePVList.py", paused, ["Pause accepted"] * len(paused))
        self.await_state(paused, "Paused", "paused")
        self.end = time.time_ns()
        engine = next(child for child in owned_jvms_alive(self.root) if child["component"] == "engine")
        env = dict(item.split("=", 1) for item in Path(f"/proc/{engine['pid']}/environ").read_text().split("\0")
                   if "=" in item)
        for pv in self.pvs:
            self.infos[pv] = self.info(pv)
            self.baselines[pv] = self.multiset(self.values(pv, self.end))
            for store in self.infos[pv]["dataStores"]:
                folder = parse_qs(urlsplit(store).query)["rootFolder"][0]
                for key in ("ARCHAPPL_SHORT_TERM_FOLDER", "ARCHAPPL_MEDIUM_TERM_FOLDER", "ARCHAPPL_LONG_TERM_FOLDER"):
                    folder = folder.replace("${" + key + "}", env[key])
                self.stores.add(Path(folder).resolve())
        save(self.root, "baselines.json", {pv: list(records.items()) for pv, records in self.baselines.items()})
        save(self.root, "stores.json", {"roots": sorted(map(str, self.stores)),
                                     "urls": {pv: self.infos[pv]["dataStores"] for pv in self.pvs}})
        def persisted():
            rows = self.pb("baseline-persistence")
            return all(sum(self.baselines[pv].values()) >= 3 and
                       self.multiset(rows, pv) == self.baselines[pv] for pv in paused)
        self.wait(persisted, READY_TIMEOUT, "paused-baseline-persistence")
        initial_control = self.infos[self.control]
        self.stop_appliance()
        self.infos = {}
        self.start_appliance()
        self.infos = {pv: self.info(pv) for pv in self.pvs}
        self.record("prepared-control-settings", all(
            self.infos[self.control].get(key) == value for key, value in initial_control.items())
            and self.infos[self.control]["paused"] == "true"
            and self.states([self.control])[self.control] == "Paused")
        self.record("prepared-control-data", self.multiset(self.values(self.control, self.end))
                    == self.baselines[self.control])
        self.pb("prepared-control-key")
        key = self.infos[self.control].get("chunkKey")
        self.record("prepared-control-key", isinstance(key, str) and bool(key) and any(
            path.relative_to(root).as_posix().startswith(key)
            for path in self.paths_for(self.control) for root in self.stores if path.is_relative_to(root)), key=key)
        save(self.root, "prepared-infos.json", self.infos)
        for offset in (0, 24):
            self.prepare_store(self.pvs[offset], "STS")
            self.prepare_store(self.pvs[offset + 1], "MTS")
            self.prepare_store(self.pvs[offset + 2], "LTS")
        self.prepare_store(self.pvs[51], "LTS")
        alias = self.prefix + "overlapAlias"
        self.record("overlap-alias-setup", self.api("addAlias", {"pv": self.pvs[53], "aliasname": alias}).get("status") == "ok")
        self.aliases[alias] = self.pvs[53]
        overlap_info = self.info(self.pvs[53])
        for label, names in (("literal-overlap", [self.pvs[53]] * 2),
                             ("val-overlap", [self.pvs[53], self.pvs[53] + ".VAL"]),
                             ("alias-overlap", [alias, self.pvs[53]])):
            self.cli(label, "deletePVList.py", names, code=2)
            self.record(label + "-unchanged", overlap_info["paused"] == "true"
                        and self.info(self.pvs[53]) == overlap_info
                        and self.multiset(self.values(self.pvs[53], self.end)) == self.baselines[self.pvs[53]])
        self.infos[self.pvs[53]] = self.info(self.pvs[53])
        for pv, name in ((self.pvs[51], "faultAlias"), (self.pvs[54], "zipFaultAlias")):
            alias = self.prefix + name
            self.record(name + "-setup", self.api("addAlias", {"pv": pv, "aliasname": alias}).get("status") == "ok")
            self.aliases[alias] = pv
            self.infos[pv] = self.info(pv)

    def metadata_retained(self, pv, label):
        """Observe failed-target metadata without hiding later independent checks."""
        try:
            info = self.info(pv)
        except HTTPError as exc:
            if exc.code != 404:
                raise
            info = None
        states, inventory, aliases = self.states([pv]), self.api("getAllPVs", {"limit": -1}), self.api("getAllAliases")
        expected = {alias for alias, source in self.aliases.items() if source == pv}
        retained = {row["aliasName"] for row in aliases if row["srcPVName"] == pv}
        save(self.root, label + "-metadata.json", {"info": info, "states": states,
             "inventory": inventory, "aliases": aliases, "expected_aliases": sorted(expected)})
        self.observe(label + "-paused-config", info == self.infos[pv] and info is not None
                     and info.get("paused") == "true" and states[pv] == "Paused")
        self.observe(label + "-inventory", pv in inventory)
        self.observe(label + "-aliases", bool(expected) and expected <= retained)

    def prepare_store(self, pv, storage):
        if storage != "STS":
            response = self.api("consolidateDataForPV", {"pv": pv, "storage": storage,
                                "date": instant(time.time_ns() + 366 * 86400 * 10**9)})
            self.record(pv.rsplit(":", 1)[-1] + "-consolidation-request", response.get("status") == "ok",
                        storage=storage, response=response)
        roots = [root for root in self.stores if root.name.lower() == storage.lower()]
        self.record(pv.rsplit(":", 1)[-1] + "-store-root", len(roots) == 1, storage=storage)
        def present():
            rows = []
            for path in roots[0].rglob("*.pb"):
                rows.extend(self.read_file(path, "store-preparation", force=True))
            return self.multiset([r for r in rows if r["kind"] == "sample"], pv) == self.baselines[pv]
        self.wait(present, READY_TIMEOUT, pv.rsplit(":", 1)[-1] + "-" + storage + "-actual-records")
        self.record(pv.rsplit(":", 1)[-1] + "-" + storage + "-nonempty", sum(self.baselines[pv].values()) >= 3)

    def metadata_absent(self, pv, label):
        def absent():
            try:
                self.api("getPVTypeInfo", {"pv": pv})
            except HTTPError as exc:
                if exc.code != 404:
                    raise
            else:
                return False
            aliases = self.api("getAllAliases")
            return (self.states([pv])[pv] == "Not being archived"
                    and all(row["srcPVName"] != pv for row in aliases)
                    and pv not in self.api("getAllPVs", {"limit": -1}))
        self.wait(absent, READY_TIMEOUT, label + "-metadata-absent")
        self.record(label + "-metadata-absent", True, pv=pv)

    def delete(self, label, inputs, good, mode, failed=None):
        statuses = ["Outcome unknown" if name == failed else "Delete accepted" for name in inputs]
        self.cli(label, "deletePVList.py", inputs, statuses, 1 if failed else 0,
                 ("--delete-data",) if mode else ())
        for pv in good:
            self.metadata_absent(pv, label + "-" + pv.rsplit(":", 1)[-1])
            self.deleted[pv] = mode

    def data_effects(self, label, uncertain=(), defer=False):
        if self.app is not None or owned_jvms_alive(self.root):
            raise RuntimeError("PB acceptance scans require orderly appliance shutdown")
        rows = self.pb(label, force=True)
        record = self.observe if defer else self.record
        unexplained = [str(path) for root in self.stores for path in root.rglob("*")
                       if path.is_file() and path.suffix != ".pb"]
        record(label + "-store-file-format", not unexplained, unexplained=unexplained)
        for pv, mode in self.deleted.items():
            paths = [path for root in self.stores for path in root.rglob("*")
                     if path.name.startswith(pv.rsplit(":", 1)[-1] + ":")]
            if mode:
                headers = [path for root in self.stores for path in root.rglob("*.pb")
                           if any(r["kind"] == "header" and r["pvName"] == pv for r in self.cache[path][1])]
                record(label + "-erased-" + pv.rsplit(":", 1)[-1], not headers and not paths,
                            remaining=list(map(str, set(paths + headers))))
            else:
                record(label + "-retained-" + pv.rsplit(":", 1)[-1],
                            self.multiset(rows, pv) == self.baselines[pv], count=sum(self.baselines[pv].values()))
        for pv in self.pvs:
            if pv not in self.deleted and pv not in uncertain:
                record(label + "-unaffected-" + pv.rsplit(":", 1)[-1],
                            self.multiset(rows, pv) == self.baselines[pv])

    def mode_cases(self, mode):
        offset, tag = (24, "erase") if mode else (0, "retain")
        self.delete(tag + "-all-success", self.pvs[offset:offset + 3], self.pvs[offset:offset + 3], mode)
        alias = self.prefix + tag + "Alias"
        source = self.pvs[offset + 3]
        self.record(tag + "-alias-setup", self.api("addAlias", {"pv": source, "aliasname": alias}).get("status") == "ok")
        self.aliases[alias] = source
        self.delete(tag + "-alias", [alias], [source], mode)
        source = self.pvs[offset + 4]
        self.delete(tag + "-val", [source + ".VAL"], [source], mode)
        index = offset + 5
        for kind in ("unpaused", "unknown", "repeated"):
            for position in range(3):
                label = f"{tag}-{kind}-{position}"
                good = self.pvs[index:index + 2]
                index += 2
                failed = self.pvs[offset + 23] if kind == "unpaused" else (
                    self.prefix + label + "_unknown" if kind == "unknown" else self.pvs[offset])
                before = self.info(failed) if kind == "unpaused" else None
                names = good.copy()
                names.insert(position, failed)
                self.delete(label, names, good, mode, failed)
                if before is not None:
                    self.record(label + "-rejected-state-data", self.info(failed) == before
                                and self.multiset(self.values(failed, self.end)) == self.baselines[failed])
                else:
                    self.metadata_absent(failed, label + "-rejected")
        self.documented_commands(mode)
        self.record(tag + "-control-settings", self.info(self.control) == self.infos[self.control]
                    and self.multiset(self.values(self.control, self.end)) == self.baselines[self.control])
        self.stop_appliance()
        self.data_effects(tag + "-stopped")
        self.start_appliance()

    def documented_commands(self, mode):
        tag, pv = ("erase", self.pvs[50]) if mode else ("retain", self.pvs[49])
        section = (REPO / "docs/book/src/scripting.md").read_text().split("## Delete paused PVs\n", 1)[1]
        commands = section.split("```bash\n")[2 if mode else 1].split("```", 1)[0]
        env = {**self.env, "BPL_URL": self.bpl, "DELETE_PV": pv, "DELETE_FILE": str(self.root / (tag + "-doc.txt"))}
        trace = self.root / (tag + "-doc-http.trace")
        result = subprocess.run([self.args.strace, "-f", "-s", "65535", "-e", "trace=network", "-o", str(trace),
                                 "bash", "-e", "-c", commands], env=env, cwd=REPO,
                                capture_output=True, text=True, timeout=READY_TIMEOUT)
        (self.root / (tag + "-doc.stdout")).write_text(result.stdout)
        (self.root / (tag + "-doc.stderr")).write_text(result.stderr)
        rows = [re.split(r" {3,}", line) for line in result.stdout.splitlines() if line.startswith(self.prefix)]
        self.record(tag + "-documented-commands", result.returncode == 0 and not result.stderr and rows == [
            [pv, "Pause accepted"], [pv, "Paused"], [pv, "Delete accepted"], [pv, "Not being archived"]], commands=commands)
        requests = [parse_qs(urlsplit(url).query) for url in re.findall(
            r"GET (/mgmt/bpl/deletePV\?[^ ]+) HTTP", trace.read_text())]
        self.record(tag + "-documented-single-request", requests == [
            {"pv": [pv], "deleteData": [str(mode).lower()]}], requests=requests)
        self.metadata_absent(pv, tag + "-documented")
        self.deleted[pv] = mode

    def detach_fault(self):
        if self.tracer is None:
            return
        proc, self.tracer = self.tracer, None
        try:
            if proc.poll() is None:
                proc.send_signal(signal.SIGINT)
            code = proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=10)
            raise RuntimeError("fault tracer required forced stop")
        self.record("fault-restored", code in (0, -signal.SIGINT), exit=code)

    def zip_records(self, label):
        """Reopen physical archives through the shipped ZIP filesystem and PB reader."""
        rows, archives = [], {}
        for root in sorted(self.stores):
            for archive in sorted(root.rglob("*_pb.zip")):
                with zipfile.ZipFile(archive) as container:
                    entries = sorted(name for name in container.namelist() if name.endswith(".pb"))
                if not entries:
                    continue
                result = subprocess.run([*self.java, *["jar:file://" + str(archive) + "!/" + name
                                         for name in entries]], env=self.env, cwd=REPO,
                                        capture_output=True, text=True, timeout=READY_TIMEOUT)
                save(self.root, label + "-" + archive.name + "-reader.json", {
                    "archive": str(archive), "sha256": digest(archive), "entries": entries,
                    "exit": result.returncode, "stdout": result.stdout, "stderr": result.stderr})
                if result.returncode:
                    raise RuntimeError("actual ZIP PB reader failed: " + str(archive))
                for line in result.stdout.splitlines():
                    row = json.loads(line)
                    if row["kind"] == "sample":
                        rows.append(row)
                    else:
                        archives.setdefault(row["pvName"], set()).add(archive)
        self.zip_archives = archives
        return rows

    def zip_cases(self):
        success, target, later = self.pvs[53], self.pvs[54], self.pvs[23]
        for pv in (success, target):
            original = next(url for url in self.info(pv)["dataStores"]
                            if parse_qs(urlsplit(url).query).get("name") == ["LTS"])
            specification = re.sub(r"&compress=[^&]*", "", original) + "&compress=ZIP_PER_PV"
            url = self.bpl + "/modifyStoreURLForPV?" + urlencode({
                "pv": pv, "storage": "LTS", "plugin_url": specification})
            with self.http.open(url, timeout=READY_TIMEOUT) as response:
                body, status = response.read().decode(), response.status
            save(self.root, pv.rsplit(":", 1)[-1] + "-zip-configuration.json", {
                "url": url, "status": status, "body": body})
            self.record(pv.rsplit(":", 1)[-1] + "-zip-configured", status == 200 and not body)
            self.wait(lambda: specification in self.info(pv)["dataStores"], READY_TIMEOUT,
                      pv.rsplit(":", 1)[-1] + "-zip-config-propagation")
            response = self.api("consolidateDataForPV", {"pv": pv, "storage": "LTS",
                                "date": instant(time.time_ns() + 366 * 86400 * 10**9)})
            self.record(pv.rsplit(":", 1)[-1] + "-zip-consolidation", response.get("status") == "ok")
            self.wait(lambda: self.multiset(self.zip_records("zip-preparation"), pv) == self.baselines[pv],
                      READY_TIMEOUT, pv.rsplit(":", 1)[-1] + "-zip-actual-records")
        self.stop_appliance()
        rows = self.zip_records("zip-baseline-stopped")
        self.record("zip-baseline-target", self.multiset(rows, target) == self.baselines[target])
        self.start_appliance()
        self.infos[target] = self.info(target)
        self.delete("zip-success", [success], [success], True)
        self.stop_appliance()
        rows = self.zip_records("zip-success-stopped")
        self.observe("zip-success-persisted", not self.multiset(rows, success)
                    and success not in self.zip_archives)
        self.record("zip-success-target-unchanged", self.multiset(rows, target) == self.baselines[target])
        self.start_appliance()
        self.infos[target] = self.info(target)
        self.cli("zip-later-pause", "pausePVList.py", [later], ["Pause accepted"])
        self.await_state([later], "Paused", "zip-later-paused")
        self.record("zip-target-configured", self.infos[target]["paused"] == "true")
        paths = sorted(self.zip_archives[target])
        self.record("zip-fault-real-path", len(paths) == 1, paths=list(map(str, paths)))
        path = paths[0]
        etl = next(child for child in owned_jvms_alive(self.root) if child["component"] == "etl")
        trace, errors = self.root / "zip-filesystem.trace", self.root / "zip-tracer.stderr"
        command = [self.args.strace, "-f", "-ttt", "-yy", "-s", "65535", "-p", etl["pid"], "-P", str(path),
                   "-e", "trace=unlink,unlinkat", "-e", "inject=unlink,unlinkat:error=EACCES", "-o", str(trace)]
        save(self.root, "zip-fault-command.json", command)
        try:
            with errors.open("w") as log:
                self.tracer = subprocess.Popen(command, env=self.env, stdout=log, stderr=log)
            self.wait(lambda: self.tracer.poll() is None and "attached" in errors.read_text(),
                      10, "zip-tracer-attached", poll=0.1)
            self.cli("zip-filesystem-fault", "deletePVList.py", [target, later],
                     ["Outcome unknown", "Delete accepted"], 1, ("--delete-data",), defer=True)
        finally:
            self.detach_fault()
        raw = trace.read_text()
        self.observe("zip-finalization-fault-observed", str(path) in raw and "EACCES" in raw and "INJECTED" in raw)
        self.metadata_retained(target, "zip-fault-before-stop")
        self.metadata_absent(later, "zip-fault-later")
        self.deleted[later] = True
        self.observe("zip-fault-control-config", self.info(self.control) == self.infos[self.control])
        self.stop_appliance()
        rows = self.zip_records("zip-fault-stopped")
        self.observe("zip-fault-target-records-retained", self.multiset(rows, target) == self.baselines[target])
        self.observe("zip-fault-control-records", self.multiset(self.pb("zip-control", force=True), self.control)
                     == self.baselines[self.control])
        self.start_appliance()
        self.metadata_retained(target, "zip-fault-after-restart")

    def filesystem_case(self):
        target, later = self.pvs[51:53]
        self.prepare_store(target, "LTS")
        paths = [path for path in self.paths_for(target) if path.exists()]
        self.record("fault-real-path", bool(paths), paths=list(map(str, paths)))
        path = paths[0]
        etl = next(child for child in owned_jvms_alive(self.root) if child["component"] == "etl")
        trace, errors = self.root / "delete-filesystem.trace", self.root / "delete-tracer.stderr"
        command = [self.args.strace, "-f", "-ttt", "-yy", "-s", "65535", "-p", etl["pid"], "-P", str(path),
                   "-e", "trace=unlink,unlinkat", "-e", "inject=unlink,unlinkat:error=EACCES", "-o", str(trace)]
        save(self.root, "delete-fault-command.json", command)
        try:
            with errors.open("w") as log:
                self.tracer = subprocess.Popen(command, env=self.env, stdout=log, stderr=log)
            began = time.monotonic()
            while time.monotonic() - began < 10:
                if self.tracer.poll() is not None:
                    raise RuntimeError("ETL tracing could not attach")
                if "attached" in errors.read_text():
                    break
                time.sleep(0.1)
            else:
                raise RuntimeError("ETL tracing attach deadline")
            self.cli("filesystem-fault", "deletePVList.py", [target, later],
                     ["Outcome unknown", "Delete accepted"], 1, ("--delete-data",), defer=True)
        finally:
            self.detach_fault()
        raw = trace.read_text()
        self.observe("fault-attempt-observed", str(path) in raw and "EACCES" in raw and "INJECTED" in raw,
                     path=str(path))
        self.observe("fault-target-file-survived", path.exists(), path=str(path))
        states = self.states([target, later, self.control])
        aliases = self.api("getAllAliases")
        inventory = self.api("getAllPVs", {"limit": -1})
        save(self.root, "fault-metadata.json", {"states": states, "aliases": aliases, "inventory": inventory})
        self.metadata_retained(target, "fault-before-stop")
        self.metadata_absent(later, "fault-later")
        self.deleted[later] = True
        self.observe("fault-control-config", self.info(self.control) == self.infos[self.control])
        self.stop_appliance()
        self.data_effects("fault-stopped", uncertain=(target,), defer=True)
        rows = self.pb("fault-target-records", force=True)
        remaining = self.multiset(rows, target)
        self.observe("fault-target-records-retained", bool(remaining) and remaining <= self.baselines[target],
                     remaining=list(remaining.items()), baseline=list(self.baselines[target].items()))
        self.start_appliance()
        self.metadata_retained(target, "fault-after-restart")
        for component in COMPONENTS:
            logs = self.root / f"appliance/instances/{component}/logs"
            save(self.root, "fault-" + component + "-logs.json", {
                str(p): digest(p) for p in logs.rglob("*") if p.is_file()})

    def cleanup(self):
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        errors, detail = [], {}
        try:
            self.detach_fault()
        except Exception as exc:
            errors.append(str(exc))
        try:
            self.stop_appliance()
        except Exception as exc:
            errors.append(str(exc))
        try:
            if self.ioc is not None:
                if self.ioc.poll() is None:
                    self.ioc.stdin.write("exit\n")
                    self.ioc.stdin.flush()
                try:
                    detail["ioc_exit"] = self.ioc.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    self.ioc.kill()
                    detail["ioc_exit"] = self.ioc.wait(timeout=10)
                    detail["ioc_forced_stop"] = True
                finally:
                    self.ioc.stdin.close()
        except Exception as exc:
            errors.append(str(exc))
        detail.update(errors=errors, owned_jvms_alive=owned_jvms_alive(self.root),
                      tracer_alive=self.tracer is not None and self.tracer.poll() is None)
        save(self.root, "cleanup.json", detail)
        self.record("cleanup", not errors and detail.get("ioc_exit") == 0
                    and not detail.get("ioc_forced_stop") and not detail["owned_jvms_alive"]
                    and not detail["tracer_alive"], **detail)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_folder", type=Path)
    parser.add_argument("--prepare-bundle", action="store_true")
    parser.add_argument("--zip-only", action="store_true", help="run the real ZIP cases after normal fixture setup")
    parser.add_argument("--tomcat-home", default=os.environ.get("TOMCAT_HOME"))
    parser.add_argument("--ioc", default=shutil.which("softIocPVX"))
    parser.add_argument("--strace", default=shutil.which("strace"))
    parser.add_argument("--war-dir", type=Path)
    parser.add_argument("--war-basename")
    parser.add_argument("--bundle-manifest", type=Path)
    parser.add_argument("--classpath-file", type=Path, default=REPO / "work/delete-classpath.txt")
    parser.add_argument("--port-base", type=int, default=21665)
    parser.add_argument("--ca-port", type=int, default=21675)
    args = parser.parse_args()
    if args.prepare_bundle:
        prepare_bundle(args.run_folder, args.classpath_file)
        return
    if not all((args.tomcat_home, args.ioc, args.strace, args.war_dir, args.war_basename, args.bundle_manifest)):
        parser.error("requires Tomcat, IOC, strace, war-dir, war-basename and bundle-manifest")
    if (not 1024 <= args.port_base <= 65530 or not 1024 <= args.ca_port <= 65535
            or args.ca_port in {args.port_base + n for n in (0, 1, 2, 3, 5)}):
        parser.error("use distinct unprivileged CA/appliance ports with room for offsets")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", args.war_basename):
        parser.error("invalid WAR basename")
    verification = Verification(args)
    try:
        verification.setup()
        if not args.zip_only:
            verification.mode_cases(False)
            verification.mode_cases(True)
            verification.filesystem_case()
        verification.zip_cases()
    finally:
        verification.cleanup()
    failed = [row["case"] for row in verification.results if not row["passed"]]
    if failed:
        raise RuntimeError("deletion assertions failed: " + ", ".join(failed))
    print(f"PASS: {len(verification.results)} checks; owned appliance and IOC stopped", flush=True)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda signum, frame: sys.exit(1))
    main()
