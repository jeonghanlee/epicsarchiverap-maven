#!/usr/bin/env python3
"""Verify the deployed disconnection report with owned component and IOC lifecycles."""

import argparse
import datetime
import errno
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time
import uuid
from urllib.parse import urlencode
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener

from verify_list_archived_pvs import FIXTURE, REPO, digest, save
from verify_rename import COMPONENTS, source_digests
from verify_pause_resume import instant, sample_tuple

START_TIMEOUT = 180
STOP_TIMEOUT = 300
STOP_ALLOWANCE = 7
SUSPEND_TIMEOUT = 60
RESTORE_TIMEOUT = 5
ENGINE_STOP_TIMEOUT = 30
HTTP_TIMEOUT = 15
CLI = REPO / "docs/book/src/samples/printCurrentlyDisconnectedPVs.py"
BOOT_ID = Path("/proc/sys/kernel/random/boot_id").read_text().strip()


def identity(pid):
    """Read the kernel identity and state without accepting a recycled PID."""
    try:
        fields = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()
    except FileNotFoundError:
        return None
    return {"boot": BOOT_ID, "pid": int(pid), "ticks": fields[19], "state": fields[0]}


def matching(saved):
    current = identity(saved["pid"])
    if current and all(current[k] == saved[k] for k in ("boot", "pid", "ticks")):
        return current
    return None


def signal_matching(saved, sig):
    if not matching(saved):
        raise RuntimeError("owned process identity no longer matches")
    os.kill(saved["pid"], sig)


def require_free_ports(port_base, ca_port):
    ports = {port_base + n for n in (0, 1, 2, 3, 5)} | {ca_port}
    for port in sorted(ports):
        for kind in (socket.SOCK_STREAM, socket.SOCK_DGRAM):
            with socket.socket(type=kind) as probe:
                probe.bind(("0.0.0.0", port))


class Verification:
    def __init__(self, args):
        self.args = args
        self.root = args.run_folder.resolve()
        self.root.mkdir(parents=True, exist_ok=False)
        self.http = build_opener(ProxyHandler({}))
        self.app = self.ioc = None
        self.children = []
        self.launcher = None
        self.cleanup_deadline = None
        self.fault_expected = False
        self.results = []
        self.bpl = f"http://127.0.0.1:{args.port_base}/mgmt/bpl"
        self.env = {**os.environ, "NO_PROXY": "*", "no_proxy": "*",
                    "PYTHONDONTWRITEBYTECODE": "1", "EPICS_CA_AUTO_ADDR_LIST": "NO",
                    "EPICS_CA_ADDR_LIST": "127.0.0.1", "EPICS_CA_SERVER_PORT": str(args.ca_port),
                    "EPICS_CAS_SERVER_PORT": str(args.ca_port), "EPICS_CAS_INTF_ADDR_LIST": "127.0.0.1",
                    "EPICS_CAS_BEACON_ADDR_LIST": "127.0.0.1", "EPICS_PVAS_INTF_ADDR_LIST": "224.0.1.1,1@127.0.0.1"}
        manifest = json.loads(args.bundle_manifest.read_text())
        self.wars = {str(args.war_dir.resolve() / f"{args.war_basename}-{c}.war"):
                     digest(args.war_dir.resolve() / f"{args.war_basename}-{c}.war") for c in COMPONENTS}
        if self.wars != manifest["wars"] or digest(FIXTURE) != manifest["fixture"]:
            raise RuntimeError("selected WARs or IOC fixture do not match build evidence")
        if any(digest(Path(p)) != d for p, d in manifest["build_logs"].items()):
            raise RuntimeError("build logs do not match recorded evidence")
        if not args.baseline_manifest and source_digests() != manifest["production_sources"]:
            raise RuntimeError("current production sources do not match the bundle")
        if args.baseline_manifest:
            baseline = json.loads(args.baseline_manifest.read_text())
            if baseline["bundle_manifest"] != digest(args.bundle_manifest) or baseline["wars"] != self.wars:
                raise RuntimeError("baseline replay does not match the recorded original bundle")
            if baseline["production_sources"] != manifest["production_sources"] or baseline["fixture"] != manifest["fixture"]:
                raise RuntimeError("baseline did not run with the recorded build sources and fixture")
        if {p.name for p in args.war_dir.glob("*.war")} != {Path(p).name for p in self.wars}:
            raise RuntimeError("WAR directory must contain exactly the selected four WARs")
        self.prefix = "M17DISC:" + uuid.uuid4().hex[:8] + ":"
        self.pvs = [self.prefix + f"test_{n}" for n in range(3)]
        self.ioc_command = [args.ioc, "-m", "P=" + self.prefix, "-d", str(FIXTURE)]
        save(self.root, "manifest.json", {
            "observed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip(),
            "production_sources": source_digests(), "built_production_sources": manifest["production_sources"],
            "bundle_manifest": digest(args.bundle_manifest), "wars": self.wars,
            "war_basename": args.war_basename, "fixture": digest(FIXTURE),
            "runner": digest(Path(__file__)), "launcher": digest(REPO / "scripts/run-local-appliance.bash"),
            "cli": digest(CLI), "ioc_command": self.ioc_command,
            "port_base": args.port_base, "ca_port": args.ca_port, "python": sys.version,
            "prefix": self.prefix, "pvs": self.pvs,
            "sources": {str(path.relative_to(REPO)): digest(path) for path in [
                CLI, CLI.parent / "archiverClient.py", CLI.parent / "listArchivedPVs.py",
                CLI.parent / "archivePVList.py", CLI.parent / "pausePVList.py", Path(__file__).resolve(),
                REPO / "src/test/pythontests/test_disconnected_client.py",
                REPO / "src/test/org/epics/archiverappliance/mgmt/CurrentlyDisconnectedPVsTest.java",
                REPO / "src/test/org/epics/archiverappliance/mgmt/bpl/reports/CurrentlyDisconnectedPVsResponseTest.java",
                REPO / "docs/book/src/scripting.md", REPO / "TESTING.md"]}})

    def record(self, name, passed, **detail):
        self.results.append({"case": name, "passed": bool(passed), **detail})
        save(self.root, "results.json", self.results)
        print(f"[ {'PASS' if passed else 'FAIL'} ] {name}", flush=True)
        return passed

    def wait(self, check, deadline, name, poll=0.1):
        began, last = time.monotonic(), None
        previous_handler = signal.getsignal(signal.SIGALRM)
        previous_timer, previous_interval = signal.getitimer(signal.ITIMER_REAL)
        previous_deadline = began + previous_timer if previous_timer else None

        def expired(signum, frame):
            raise TimeoutError(name + " deadline expired during observation")

        remaining = min(deadline - began, previous_timer) if previous_timer else deadline - began
        signal.signal(signal.SIGALRM, expired)
        try:
            signal.setitimer(signal.ITIMER_REAL, max(0.000001, remaining))
            while time.monotonic() < deadline:
                last = check()
                if last:
                    return last
                time.sleep(min(poll, max(0, deadline - time.monotonic())))
            raise RuntimeError(f"{name} deadline expired; last={last}")
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
            signal.signal(signal.SIGALRM, previous_handler)
            if previous_deadline:
                signal.setitimer(signal.ITIMER_REAL, max(0, previous_deadline - time.monotonic()), previous_interval)
            save(self.root, name + "-wait.json", {"elapsed": time.monotonic() - began, "last": last})

    def raw(self, name, timeout=HTTP_TIMEOUT):
        started = time.monotonic()
        try:
            response = self.http.open(Request(self.bpl + "/getCurrentlyDisconnectedPVs"), timeout=timeout)
        except HTTPError as error:
            response = error
        with response:
            body = response.read()
            result = {"status": response.code, "content_type": response.headers.get("Content-Type"),
                      "body": body.decode("utf-8"), "elapsed": time.monotonic() - started}
        save(self.root, name + ".json", result)
        return result

    def start(self):
        require_free_ports(self.args.port_base, self.args.ca_port)
        command = [str(REPO / "scripts/run-local-appliance.bash"), "--port-base", str(self.args.port_base),
                   "--tomcat-home", self.args.tomcat_home, "--war-dir", str(self.args.war_dir.resolve()),
                   "--stop-timeout", str(STOP_TIMEOUT), str(self.root / "appliance")]
        save(self.root, "launcher-command.json", command)
        with (self.root / "launcher.log").open("w") as log:
            self.app = subprocess.Popen(command, cwd=REPO, env=self.env, stdout=log, stderr=subprocess.STDOUT)
        self.launcher = identity(self.app.pid)

        def ready():
            if self.app.poll() is not None:
                raise RuntimeError("launcher exited before startup")
            status = self.root / "appliance/status"
            return status.exists() and status.read_text().strip() == "ready"

        self.wait(ready, time.monotonic() + START_TIMEOUT, "startup")
        for line in (self.root / "appliance/children.tsv").read_text().splitlines():
            boot, component, pid, ticks = line.split("\t")
            self.children.append({"boot": boot, "component": component, "pid": int(pid), "ticks": ticks})
        save(self.root, "processes.json", {"launcher": self.launcher, "children": self.children})
        deployed = {c: digest(self.root / f"appliance/instances/{c}/webapps/{c}.war") for c in COMPONENTS}
        if not self.record("deployed-war-digests", deployed == {
            c: self.wars[str(self.args.war_dir.resolve() / f"{self.args.war_basename}-{c}.war")]
            for c in COMPONENTS}, deployed=deployed):
            raise RuntimeError("deployed WAR digests differ")
        healthy = self.raw("healthy-report")
        if not self.record("healthy-empty-report", healthy["status"] == 200 and json.loads(healthy["body"]) == []):
            raise RuntimeError("healthy report failed")
        if self.args.mode == "cli-fault":
            self.report_cli("healthy-cli", [])

    def stop(self, fault=False):
        if self.app is None:
            return
        fault = fault or self.fault_expected
        if self.cleanup_deadline is None:
            self.cleanup_deadline = time.monotonic() + STOP_TIMEOUT + STOP_ALLOWANCE
        if self.app.poll() is None and not fault:
            signal_matching(self.launcher, signal.SIGTERM)
        try:
            code = self.app.wait(timeout=max(0, self.cleanup_deadline - time.monotonic()))
        except subprocess.TimeoutExpired:
            remaining = [child for child in self.children if matching(child)]
            save(self.root, "cleanup.json", {"deadline_expired": True, "remaining": remaining})
            self.record("cleanup-deadline", False, remaining=remaining)
            raise
        log = (self.root / "launcher.log").read_text()
        status = (self.root / "appliance/status").read_text().strip()
        remaining = [child for child in self.children if matching(child)]
        passed = (code == (1 if fault else 143) and status == "stopped" and not remaining
                  and "incomplete-stop" not in log and "Forced stop:" not in log
                  and (not fault or "Component exited: engine; see its console.log" in log))
        save(self.root, "cleanup.json", {"launcher_exit": code, "status": status, "remaining": remaining})
        if not self.record("fault-cleanup" if fault else "ordinary-cleanup", passed):
            raise RuntimeError("owned process cleanup failed")

    def fault(self):
        engine = next(c for c in self.children if c["component"] == "engine")
        mgmt = next(c for c in self.children if c["component"] == "mgmt")
        began = time.monotonic()
        restore_by = began + SUSPEND_TIMEOUT - RESTORE_TIMEOUT
        engine_exited = False
        errors = []
        original_alarm = signal.getsignal(signal.SIGALRM)

        def expired(signum, frame):
            raise TimeoutError("pre-restoration suspension deadline expired")

        signal.signal(signal.SIGALRM, expired)
        signal.setitimer(signal.ITIMER_REAL, SUSPEND_TIMEOUT - RESTORE_TIMEOUT)
        try:
            signal_matching(self.launcher, signal.SIGSTOP)
            self.wait(lambda: (matching(self.launcher) or {}).get("state") in ("T", "t"),
                      min(began + RESTORE_TIMEOUT, restore_by), "launcher-suspended")
            signal_matching(engine, signal.SIGTERM)
            state = self.wait(lambda: ("exited" if not matching(engine) else
                                      ("zombie" if matching(engine)["state"] == "Z" else None)),
                              min(time.monotonic() + ENGINE_STOP_TIMEOUT, restore_by), "engine-exited")
            engine_exited = True
            self.fault_expected = True
            with socket.socket() as probe:
                probe.settimeout(min(1, max(0.01, restore_by - time.monotonic())))
                port_error = probe.connect_ex(("127.0.0.1", self.args.port_base + 1))
                refused = port_error == errno.ECONNREFUSED
            available = matching(mgmt)
            if not self.record("actual-engine-unavailable", refused and available and available["state"] != "Z",
                               engine_state=state, port_refused=refused, port_errno=port_error, mgmt=available):
                raise RuntimeError("actual fault setup failed")
            remaining = restore_by - time.monotonic()
            if remaining <= 0:
                raise RuntimeError("suspension budget expired")
            if self.args.mode == "raw-fault":
                result = self.raw("unavailable-report", min(HTTP_TIMEOUT, remaining))
                body = json.loads(result["body"])
                passed = (result["status"] == 503 and result["content_type"].startswith("application/json")
                          and isinstance(body, dict) and body.get("status") == "error"
                          and isinstance(body.get("desc"), str) and bool(body["desc"]))
                detail = {"status": result["status"], "elapsed": result["elapsed"]}
            else:
                command = [sys.executable, str(CLI), self.bpl, "--timeout", str(min(HTTP_TIMEOUT, remaining))]
                save(self.root, "fault-cli-command.json", command)
                result = subprocess.run(command, env=self.env, capture_output=True,
                                        timeout=min(20, remaining), text=True)
                (self.root / "fault-cli.stdout").write_text(result.stdout)
                (self.root / "fault-cli.stderr").write_text(result.stderr)
                passed = result.returncode == 1 and not result.stdout and bool(result.stderr)
                detail = {"exit": result.returncode}
            self.record("unavailable-report-error", passed, **detail)
        except Exception as error:
            errors.append(str(error))
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
            signal.signal(signal.SIGALRM, original_alarm)
            try:
                self.record("restoration-start-deadline", time.monotonic() <= restore_by,
                            elapsed=time.monotonic() - began)
                signal_matching(self.launcher, signal.SIGCONT)
                self.cleanup_deadline = time.monotonic() + STOP_TIMEOUT + STOP_ALLOWANCE
                self.wait(lambda: not matching(self.launcher) or matching(self.launcher)["state"] not in ("T", "t"),
                          time.monotonic() + RESTORE_TIMEOUT, "launcher-restored")
                if not self.record("suspension-budget", time.monotonic() - began <= SUSPEND_TIMEOUT,
                                   elapsed=time.monotonic() - began):
                    errors.append("suspension exceeded its deadline")
            except Exception as error:
                errors.append("restoration: " + str(error))
            try:
                self.stop(fault=engine_exited)
            except Exception as error:
                errors.append("appliance cleanup: " + str(error))
            save(self.root, "fault-errors.json", errors)
        if errors:
            raise RuntimeError("; ".join(errors))

    def api(self, action, params=None, base=None):
        url = (base or self.bpl) + "/" + action + ("?" + urlencode(params) if params else "")
        with self.http.open(Request(url), timeout=HTTP_TIMEOUT) as response:
            body = json.load(response)
        with (self.root / "http.jsonl").open("a") as out:
            out.write(json.dumps({"time": instant(time.time_ns()), "url": url, "response": body}) + "\n")
        return body

    def cli(self, name, script, inputs):
        path = self.root / (name + ".txt")
        path.write_text("\n".join(inputs) + "\n")
        command = [sys.executable, str(CLI.parent / script), self.bpl, str(path)]
        result = subprocess.run(command, cwd=REPO, env=self.env, text=True, capture_output=True, timeout=120)
        save(self.root, name + "-command.json", command)
        (self.root / (name + ".stdout")).write_text(result.stdout)
        (self.root / (name + ".stderr")).write_text(result.stderr)
        if not self.record(name, result.returncode == 0 and not result.stderr, exit=result.returncode):
            raise RuntimeError(name + " CLI failed")
        return result

    def report_cli(self, name, rows, options=()):
        command = [sys.executable, str(CLI), self.bpl, *options]
        result = subprocess.run(command, cwd=REPO, env=self.env, text=True, capture_output=True, timeout=35)
        save(self.root, name + "-command.json", command)
        (self.root / (name + ".stdout")).write_text(result.stdout)
        (self.root / (name + ".stderr")).write_text(result.stderr)
        expected, current = [], None
        for row in sorted(rows, key=lambda r: (r["instance"], r["pvName"])):
            if "--onlyNA" in options and row["connectionLostAt"] != "N/A":
                continue
            if "--onlyNA" not in options and "--noNA" in options and row["connectionLostAt"] == "N/A":
                continue
            if current != row["instance"]:
                current = row["instance"]
                expected.append("Appliance " + current + ":")
            expected.append(row["pvName"] + " " + row["connectionLostAt"])
        expected = "".join(line + "\n" for line in expected)
        if not self.record(name, result.returncode == 0 and not result.stderr and result.stdout == expected,
                           command=command, exit=result.returncode):
            raise RuntimeError(name + " report CLI failed")

    def start_ioc(self):
        name = "ioc-restart" if self.ioc is not None else "ioc-start"
        with (self.root / (name + ".log")).open("w") as log:
            self.ioc = subprocess.Popen(self.ioc_command, env=self.env, stdin=subprocess.PIPE,
                                        stdout=log, stderr=subprocess.STDOUT)
        save(self.root, name + "-command.json", {"command": self.ioc_command, "identity": identity(self.ioc.pid)})

    def stop_ioc(self):
        if self.ioc is None:
            return
        if self.ioc.poll() is None:
            self.ioc.stdin.write(b"exit\n")
            self.ioc.stdin.flush()
            self.ioc.stdin.close()
        code = self.ioc.wait(timeout=30)
        if not self.record("ioc-exit", code == 0, pid=self.ioc.pid, exit=code):
            raise RuntimeError("IOC did not exit normally")

    def connected(self, pv, wanted):
        details = self.api("getPVDetails", {"pv": pv})
        return any(row.get("source") == "pv" and row.get("name") == "Is this PV currently connected?"
                   and row.get("value") == wanted for row in details)

    def values(self, pv, end):
        base = f"http://127.0.0.1:{self.args.port_base + 3}/retrieval/data"
        body = self.api("getData.json", {"pv": pv, "from": instant(self.began), "to": instant(end)}, base)
        if len(body) != 1 or body[0]["meta"]["name"] != pv:
            raise RuntimeError("unexpected retrieval identity or structure")
        rows = body[0]["data"]
        for row in rows:
            sample_tuple(row)
        return rows

    def snapshot(self, end):
        return {"inventory": sorted(self.api("getAllPVs", {"limit": -1})),
                "type_info": {pv: self.api("getPVTypeInfo", {"pv": pv}) for pv in self.pvs},
                "retrieval": {pv: self.values(pv, end) for pv in self.pvs}}

    def observed_report(self, name, wanted):
        end = time.time_ns() - 2_000_000_000
        before = self.snapshot(end)
        result = self.raw(name + "-raw")
        rows = json.loads(result["body"])
        engine_rows = self.api("getCurrentlyDisconnectedPVsForThisAppliance", base=
                               f"http://127.0.0.1:{self.args.port_base + 1}/engine/bpl")
        names = {row["pvName"] for row in rows}
        passed = (result["status"] == 200 and names == set(wanted) and rows == engine_rows
                  and self.prefix + "unsubmitted" not in before["inventory"]
                  and self.prefix + "unsubmitted" not in names)
        if wanted:
            observed = time.time_ns()
            loss_details = {pv: self.api("getPVDetails", {"pv": pv}) for pv in wanted}
            save(self.root, name + "-loss-details.json", loss_details)
            for row in rows:
                epoch = int(row["noConnectionAsOfEpochSecs"])
                lost_times = [r.get("value") for r in loss_details[row["pvName"]]
                              if r.get("source") == "pv" and r.get("name") ==
                              "When did we last lose a connection to this PV?"]
                passed = (passed and epoch > 0 and self.loss_started // 1_000_000_000 <= epoch
                          <= observed // 1_000_000_000 and lost_times == [row["connectionLostAt"]])
        if not self.record(name + "-raw-and-engine", passed, rows=rows):
            raise RuntimeError(name + " report mismatch")
        for suffix, options in (("default", ()), ("timeout", ("--timeout", "15")),
                                ("onlyNA", ("--onlyNA",)), ("noNA", ("--noNA",))):
            self.report_cli(name + "-" + suffix, rows, options)
        after = self.snapshot(end)
        save(self.root, name + "-preservation.json", {"end": instant(end), "before": before, "after": after})
        if not self.record(name + "-configuration-and-baseline", before == after):
            raise RuntimeError("report changed configuration or saved retrieval baseline")
        return rows

    def ioc_workflow(self):
        self.began = time.time_ns()
        self.start_ioc()
        self.cli("archive-targets", "archivePVList.py", self.pvs)
        self.wait(lambda: all(row["status"] == "Being archived" for row in self.api(
            "getPVStatus", {"pv": ",".join(self.pvs)})), time.monotonic() + 360, "archived", poll=1)
        for pv in self.pvs:
            self.wait(lambda: self.connected(pv, "yes"), time.monotonic() + 120, "connected-" + pv, poll=1)
        self.wait(lambda: all(len([r for r in self.values(pv, time.time_ns())
                                 if isinstance(r.get("val"), (int, float))]) >= 3 for pv in self.pvs),
                  time.monotonic() + 120, "initial-samples", poll=1)
        self.observed_report("connected", [])
        self.cli("pause-control", "pausePVList.py", [self.pvs[2]])
        self.wait(lambda: self.api("getPVStatus", {"pv": self.pvs[2]})[0]["status"] == "Paused",
                  time.monotonic() + 120, "paused", poll=1)
        self.loss_started = time.time_ns()
        save(self.root, "ioc-loss-start.json", {"time": instant(self.loss_started), "epoch_ns": self.loss_started})
        self.stop_ioc()
        for pv in self.pvs[:2]:
            self.wait(lambda: self.connected(pv, "no"), time.monotonic() + 120, "disconnected-" + pv, poll=1)
        self.wait(lambda: {r["pvName"] for r in self.api("getCurrentlyDisconnectedPVs")} == set(self.pvs[:2]),
                  time.monotonic() + 120, "loss-report-ready", poll=1)
        self.observed_report("ioc-lost", self.pvs[:2])
        self.documented_commands()
        restart = time.time_ns()
        self.start_ioc()
        for pv in self.pvs[:2]:
            self.wait(lambda: self.connected(pv, "yes"), time.monotonic() + 120, "reconnected-" + pv, poll=1)
        self.wait(lambda: self.api("getCurrentlyDisconnectedPVs") == [],
                  time.monotonic() + 120, "recovery-report-ready", poll=1)
        self.wait(lambda: all(len([r for r in self.values(pv, time.time_ns())
                                 if r["secs"] * 1_000_000_000 + r.get("nanos", 0) > restart
                                 and isinstance(r.get("val"), (int, float))]) >= 3 for pv in self.pvs[:2]),
                  time.monotonic() + 120, "recovery-samples", poll=1)
        self.observed_report("recovered", [])

    def documented_commands(self):
        page = (REPO / "docs/book/src/scripting.md").read_text()
        commands = page.split("## Currently disconnected PVs\n", 1)[1].split("```bash\n", 1)[1].split("```", 1)[0]
        rows = self.api("getCurrentlyDisconnectedPVs")
        expected, current = [], None
        for row in sorted(rows, key=lambda r: (r["instance"], r["pvName"])):
            if current != row["instance"]:
                current = row["instance"]
                expected.append("Appliance " + current + ":")
            expected.append(row["pvName"] + " " + row["connectionLostAt"])
        expected = "".join(line + "\n" for line in expected)
        result = subprocess.run(["bash", "-e", "-c", commands], cwd=REPO,
                                env={**self.env, "BPL_URL": self.bpl}, capture_output=True, text=True, timeout=120)
        save(self.root, "documented-commands.json", {"shell": commands, "exit": result.returncode,
                                                  "stdout": result.stdout, "stderr": result.stderr})
        if not self.record("documented-commands", result.returncode == 0 and not result.stderr
                           and result.stdout == expected * 3):
            raise RuntimeError("documented report commands did not match the actual rows")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_folder", type=Path)
    parser.add_argument("--mode", choices=("raw-fault", "cli-fault", "healthy", "ioc"), required=True)
    parser.add_argument("--war-dir", type=Path, required=True)
    parser.add_argument("--war-basename", required=True)
    parser.add_argument("--bundle-manifest", type=Path, required=True)
    parser.add_argument("--baseline-manifest", type=Path, help="recorded original run provenance for baseline replay")
    parser.add_argument("--tomcat-home", required=True)
    parser.add_argument("--ioc", required=True)
    parser.add_argument("--port-base", type=int, default=27665)
    parser.add_argument("--ca-port", type=int, default=27675)
    args = parser.parse_args()
    if not 1024 <= args.port_base <= 65530 or not 1024 <= args.ca_port <= 65535:
        parser.error("fixture ports must be unprivileged valid ports")
    if args.ca_port in {args.port_base + n for n in (0, 1, 2, 3, 5)}:
        parser.error("CA port must differ from appliance ports")
    run = Verification(args)
    print(f"Evidence: {run.root}", flush=True)
    try:
        run.start()
        if args.mode == "ioc":
            run.ioc_workflow()
            run.stop()
        elif args.mode == "healthy":
            run.stop()
        else:
            run.fault()
    finally:
        errors = []
        try:
            if run.app is not None and run.app.poll() is None:
                current = matching(run.launcher)
                if current and current["state"] in ("T", "t"):
                    signal_matching(run.launcher, signal.SIGCONT)
                run.stop()
        except Exception as error:
            errors.append("appliance cleanup: " + str(error))
        try:
            run.stop_ioc()
        except Exception as error:
            errors.append("IOC cleanup: " + str(error))
        save(run.root, "final-cleanup.json", {"errors": errors,
                                             "ioc_exit": run.ioc.returncode if run.ioc is not None else None})
        if errors:
            raise RuntimeError("; ".join(errors))
    return 0 if all(r["passed"] for r in run.results) else 1


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda signum, frame: sys.exit(1))
    raise SystemExit(main())
