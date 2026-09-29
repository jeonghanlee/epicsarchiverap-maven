#!/usr/bin/env python3
"""Verify listing with 600 real fixture PVs on a dedicated local appliance."""

import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
import uuid
from urllib.parse import urlencode
from urllib.request import ProxyHandler, Request, build_opener

REPO = Path(__file__).resolve().parents[3]
SCRIPT = REPO / "docs/book/src/samples/listArchivedPVs.py"
FIXTURE = REPO / "src/resources/test/UnitTestPVs.db"
PV_COUNT = 600
START_TIMEOUT = 180
ARCHIVE_TIMEOUT = 360
STOP_TIMEOUT = 300
STOP_ALLOWANCE = 7
HTTP_TIMEOUT = 30


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(root, name, value):
    (root / name).write_text(json.dumps(value, indent=2) + "\n")


def wait_for(action, timeout, description):
    started = time.monotonic()
    last = None
    while time.monotonic() - started < timeout:
        last = action()
        if last:
            return last
        time.sleep(1)
    raise RuntimeError(f"{description} timed out after {time.monotonic() - started:.1f}s; last={last}")


def owned_jvms_alive(root):
    children = root / "appliance/children.tsv"
    alive = []
    if children.exists():
        boot = Path("/proc/sys/kernel/random/boot_id").read_text().strip()
        for line in children.read_text().splitlines():
            saved_boot, component, pid, started = line.split("\t")
            try:
                fields = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()
            except FileNotFoundError:
                continue
            if saved_boot == boot and fields[19] == started and fields[0] != "Z":
                alive.append({"component": component, "pid": pid})
    return alive


def signal_owned_jvms(root, sig):
    """Signal only live PIDs whose boot ID and start time match this run."""
    signalled = []
    for child in owned_jvms_alive(root):
        try:
            os.kill(int(child["pid"]), sig)
            signalled.append(child)
        except ProcessLookupError:
            pass
    return signalled


def stop_owned_jvms(root, deadline):
    """Recover cleanup when the launcher exits before reaping its JVMs."""
    result = {"fallback_terminated": signal_owned_jvms(root, signal.SIGTERM)}
    while owned_jvms_alive(root) and time.monotonic() < deadline:
        time.sleep(0.1)
    result["fallback_killed"] = signal_owned_jvms(root, signal.SIGKILL)
    while owned_jvms_alive(root) and time.monotonic() < deadline + STOP_ALLOWANCE:
        time.sleep(0.1)
    result["owned_jvms_alive"] = owned_jvms_alive(root)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_folder", type=Path, help="new evidence folder; retained after verification")
    parser.add_argument("--tomcat-home", default=os.environ.get("TOMCAT_HOME"), required=not os.environ.get("TOMCAT_HOME"))
    parser.add_argument("--ioc", default=shutil.which("softIocPVX"), required=not shutil.which("softIocPVX"))
    parser.add_argument("--war-dir", type=Path, default=REPO / "target")
    parser.add_argument("--port-base", type=int, default=17665)
    parser.add_argument("--ca-port", type=int, default=17675)
    args = parser.parse_args()
    if not 1024 <= args.port_base <= 65530:
        parser.error("port base must be between 1024 and 65530")
    if not 1024 <= args.ca_port <= 65535 or args.ca_port in {args.port_base + n for n in (0, 1, 2, 3, 5)}:
        parser.error("CA port must be between 1024 and 65535 and distinct from appliance ports")
    root = args.run_folder.resolve()
    root.mkdir(parents=True, exist_ok=False)
    env = os.environ.copy()
    env.update(NO_PROXY="*", no_proxy="*", PYTHONDONTWRITEBYTECODE="1",
               EPICS_CA_AUTO_ADDR_LIST="NO", EPICS_CA_ADDR_LIST="127.0.0.1",
               EPICS_CA_SERVER_PORT=str(args.ca_port), EPICS_CAS_SERVER_PORT=str(args.ca_port),
               EPICS_CAS_INTF_ADDR_LIST="127.0.0.1", EPICS_CAS_BEACON_ADDR_LIST="127.0.0.1",
               EPICS_PVAS_INTF_ADDR_LIST="224.0.1.1,1@127.0.0.1")
    bpl = f"http://127.0.0.1:{args.port_base}/mgmt/bpl"
    http = build_opener(ProxyHandler({}))
    prefix = f"M17LIST:{uuid.uuid4().hex[:8]}:"
    pvs = [f"{prefix}test_{i}" for i in range(PV_COUNT)]
    results = []
    app = ioc = None
    print(f"Evidence: {root}", flush=True)
    wars = sorted(args.war_dir.resolve().glob("*.war"))
    save(root, "manifest.json", {
        "observed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip(),
        "python": sys.version, "script_sha256": digest(SCRIPT), "fixture_sha256": digest(FIXTURE),
        "wars": {str(path): digest(path) for path in wars}, "prefix": prefix, "pvs": pvs,
        "ca_port": args.ca_port, "bpl_url": bpl,
    })

    def request(action, params=None, data=None):
        url = bpl + "/" + action + ("?" + urlencode(params) if params else "")
        req = Request(url, data=json.dumps(data).encode() if data is not None else None,
                      headers={"Content-Type": "application/json"} if data is not None else {})
        with http.open(req, timeout=HTTP_TIMEOUT) as response:
            body = json.load(response)
        with (root / "http.jsonl").open("a") as out:
            out.write(json.dumps({"url": url, "request": data, "response": body}) + "\n")
        return body

    def run_case(name, options, expected=None, count=None, url=bpl, code=0):
        command = [sys.executable, str(SCRIPT), url, *options]
        result = subprocess.run(command, env=env, text=True, capture_output=True, timeout=HTTP_TIMEOUT + 5)
        (root / f"{name}.stdout").write_text(result.stdout)
        (root / f"{name}.stderr").write_text(result.stderr)
        names = result.stdout.splitlines()
        passed = result.returncode == code
        if code == 0:
            passed = passed and not result.stderr and names == sorted(set(names))
            passed = passed and (names == sorted(expected) if expected is not None
                                 else len(names) == count and set(names) <= set(pvs))
        else:
            passed = passed and not names and "HTTP 404" in result.stderr
        results.append({"case": name, "command": command, "exit": result.returncode,
                        "count": len(names), "passed": passed})
        save(root, "results.json", results)
        print(f"[ {'PASS' if passed else 'FAIL'} ] {name}: {len(names)} names", flush=True)
        if not passed:
            raise RuntimeError(f"{name} failed; see retained stdout/stderr")

    def run_documented_commands():
        page = (REPO / "docs/book/src/scripting.md").read_text()
        commands = page.split("## List archived PVs\n", 1)[1].split("```bash\n", 1)[1].split("```", 1)[0]
        command = ["bash", "-e", "-c", commands]
        result = subprocess.run(command, cwd=REPO, env={**env, "BPL_URL": bpl},
                                text=True, capture_output=True, timeout=120)
        (root / "documented-commands.stdout").write_text(result.stdout)
        (root / "documented-commands.stderr").write_text(result.stderr)
        names = result.stdout.splitlines()
        passed = (result.returncode == 0 and not result.stderr
                  and names[:PV_COUNT] == sorted(pvs) and names[PV_COUNT:2 * PV_COUNT] == sorted(pvs)
                  and len(names) == 2 * PV_COUNT + 17
                  and names[2 * PV_COUNT:] == sorted(set(names[2 * PV_COUNT:]))
                  and set(names[2 * PV_COUNT:]) <= set(pvs))
        results.append({"case": "documented-commands", "command": command,
                        "exit": result.returncode, "count": len(names), "passed": passed})
        save(root, "results.json", results)
        if not passed:
            raise RuntimeError("documented commands failed; see retained stdout/stderr")
        print("[ PASS ] documented commands executed verbatim", flush=True)

    try:
        for offset in (0, 1, 2, 3, 5):
            with socket.socket() as probe:
                probe.bind(("127.0.0.1", args.port_base + offset))
        for kind in (socket.SOCK_STREAM, socket.SOCK_DGRAM):
            with socket.socket(type=kind) as probe:
                probe.bind(("127.0.0.1", args.ca_port))
        command = [str(REPO / "scripts/run-local-appliance.bash"), "--port-base", str(args.port_base),
                   "--tomcat-home", str(Path(args.tomcat_home).resolve()), "--war-dir", str(args.war_dir.resolve()),
                   "--stop-timeout", str(STOP_TIMEOUT), str(root / "appliance")]
        save(root, "launcher-command.json", command)
        with (root / "launcher.log").open("w") as log:
            app = subprocess.Popen(command, cwd=REPO, env=env, stdout=log, stderr=subprocess.STDOUT)

        def ready():
            if app.poll() is not None:
                raise RuntimeError("launcher exited before readiness; see launcher.log")
            status = root / "appliance/status"
            return status.exists() and status.read_text().strip() == "ready"

        wait_for(ready, START_TIMEOUT, "appliance startup")
        run_case("empty-appliance", [], expected=[])
        command = [str(Path(args.ioc).resolve()), "-m", "P=" + prefix, "-d", str(FIXTURE)]
        save(root, "ioc-command.json", command)
        with (root / "ioc.log").open("w") as log:
            ioc = subprocess.Popen(command, cwd=root, env=env, stdin=subprocess.PIPE,
                                   stdout=log, stderr=subprocess.STDOUT, text=True)
        request("archivePV", data=[{"pv": pv, "samplingmethod": "MONITOR", "samplingperiod": "1"} for pv in pvs])

        def archived():
            if ioc.poll() is not None or app.poll() is not None:
                raise RuntimeError("owned IOC or appliance exited during archive preparation")
            states = request("getPVStatus", {"pv": prefix + "*", "limit": -1})
            save(root, "last-status.json", states)
            return {row["pvName"] for row in states if row["status"] == "Being archived"} == set(pvs)

        wait_for(archived, ARCHIVE_TIMEOUT, "600 PVs Being archived (last-status.json)")
        save(root, "server-default.json", request("getAllPVs"))
        run_case("complete-default", [], expected=pvs)
        run_case("explicit-unlimited", ["--limit", "-1"], expected=pvs)
        run_case("glob", ["--glob", prefix + "test_5?"], expected=[prefix + f"test_{i}" for i in range(50, 60)])
        run_case("no-match", ["--glob", prefix + "missing*"], expected=[])
        run_case("documented-glob", ["--glob", "M17LIST:*"], expected=pvs)
        for limit in (1, 17, 500, 700):
            run_case(f"limit-{limit}", ["--limit", str(limit)], count=min(limit, PV_COUNT))
        run_case("glob-limit", ["--glob", prefix + "test_*", "--limit", "5"], count=5)
        run_case("live-404", [], url=bpl.replace("/mgmt/", "/missing/"), code=1)
        run_documented_commands()
    finally:
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        deadline = time.monotonic() + STOP_TIMEOUT
        cleanup = {}
        try:
            if app is not None:
                try:
                    if app.poll() is None:
                        app.send_signal(signal.SIGTERM)
                    try:
                        cleanup["launcher_exit"] = app.wait(timeout=max(0, deadline - time.monotonic()))
                    except subprocess.TimeoutExpired:
                        app.kill()
                        cleanup["launcher_forced_stop"] = True
                        cleanup["launcher_exit"] = app.wait(timeout=STOP_ALLOWANCE)
                finally:
                    cleanup.update(stop_owned_jvms(root, deadline))
        finally:
            if ioc is not None:
                if ioc.poll() is None:
                    ioc.stdin.write("exit\n")
                    ioc.stdin.flush()
                try:
                    cleanup["ioc_exit"] = ioc.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    ioc.kill()
                    ioc.wait()
                    cleanup["ioc_forced_stop"] = True
                ioc.stdin.close()
            save(root, "cleanup.json", cleanup)
        if (app is not None and (cleanup.get("launcher_exit") != 143 or cleanup.get("owned_jvms_alive")
                                or cleanup.get("fallback_terminated") or cleanup.get("fallback_killed"))) or (ioc is not None and cleanup.get("ioc_exit") != 0):
            raise RuntimeError(f"cleanup failed: {cleanup}")
    print(f"PASS: {len(results)} live CLI checks; launcher and IOC stopped", flush=True)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda signum, frame: sys.exit(1))
    main()
