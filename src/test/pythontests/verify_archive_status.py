#!/usr/bin/env python3
"""Verify the shipped archive/status CLIs on a real local appliance and IOC."""

import argparse
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
from urllib.parse import urlencode
from urllib.request import ProxyHandler, Request, build_opener

from verify_list_archived_pvs import (
    ARCHIVE_TIMEOUT, FIXTURE, REPO, START_TIMEOUT, STOP_ALLOWANCE, STOP_TIMEOUT,
    digest, save, stop_owned_jvms, wait_for,
)

SAMPLES = REPO / "docs/book/src/samples"
HTTP_TIMEOUT = 30


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_folder", type=Path)
    parser.add_argument("--tomcat-home", default=os.environ.get("TOMCAT_HOME"), required=not os.environ.get("TOMCAT_HOME"))
    parser.add_argument("--ioc", default=shutil.which("softIocPVX"), required=not shutil.which("softIocPVX"))
    parser.add_argument("--war-dir", type=Path, default=REPO / "target")
    parser.add_argument("--port-base", type=int, default=18665)
    parser.add_argument("--ca-port", type=int, default=18675)
    args = parser.parse_args()
    if not 1024 <= args.port_base <= 65530 or not 1024 <= args.ca_port <= 65535:
        parser.error("ports must be unprivileged and leave room for the appliance offsets")
    if args.ca_port in {args.port_base + n for n in (0, 1, 2, 3, 5)}:
        parser.error("CA port must be distinct from appliance ports")
    root = args.run_folder.resolve()
    root.mkdir(parents=True, exist_ok=False)
    env = {**os.environ, "NO_PROXY": "*", "no_proxy": "*", "PYTHONDONTWRITEBYTECODE": "1",
           "EPICS_CA_AUTO_ADDR_LIST": "NO", "EPICS_CA_ADDR_LIST": "127.0.0.1",
           "EPICS_CA_SERVER_PORT": str(args.ca_port), "EPICS_CAS_SERVER_PORT": str(args.ca_port),
           "EPICS_CAS_INTF_ADDR_LIST": "127.0.0.1", "EPICS_CAS_BEACON_ADDR_LIST": "127.0.0.1",
           "EPICS_PVAS_INTF_ADDR_LIST": "224.0.1.1,1@127.0.0.1"}
    bpl = f"http://127.0.0.1:{args.port_base}/mgmt/bpl"
    prefix = f"PVCLI:{uuid.uuid4().hex[:8]}:"
    pvs = [prefix + f"test_{i}" for i in range(3)]
    unavailable = prefix + "unavailable"
    app = ioc = None
    results = []
    http = build_opener(ProxyHandler({}))
    sources = [SAMPLES / name for name in ("archivePVList.py", "getPVStatus.py", "archiverClient.py", "listArchivedPVs.py")]
    sources.extend((Path(__file__), Path(__file__).with_name("verify_list_archived_pvs.py")))
    save(root, "manifest.json", {
        "observed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip(),
        "sources": {str(path.relative_to(REPO)): digest(path) for path in sources},
        "fixture_sha256": digest(FIXTURE), "wars": {str(path): digest(path) for path in sorted(args.war_dir.resolve().glob("*.war"))},
        "bpl_url": bpl, "ca_port": args.ca_port, "prefix": prefix,
    })
    print(f"Evidence: {root}", flush=True)

    def request(action, params):
        url = bpl + "/" + action + "?" + urlencode(params)
        with http.open(Request(url), timeout=HTTP_TIMEOUT) as response:
            body = json.load(response)
        with (root / "http.jsonl").open("a") as out:
            out.write(json.dumps({"url": url, "response": body}) + "\n")
        return body

    def record(name, passed, **detail):
        results.append({"case": name, "passed": bool(passed), **detail})
        save(root, "results.json", results)
        print(f"[ {'PASS' if passed else 'FAIL'} ] {name}", flush=True)
        if not passed:
            raise RuntimeError(f"{name} failed; see {root}")

    def cli(name, script, names, statuses=None, options=(), code=0, message=None):
        input_file = root / (name + ".txt")
        input_file.write_text("\n".join(names) + "\n")
        command = [sys.executable, str(SAMPLES / script), bpl, str(input_file), *options]
        result = subprocess.run(command, env=env, capture_output=True, text=True, timeout=120)
        (root / (name + ".stdout")).write_text(result.stdout)
        (root / (name + ".stderr")).write_text(result.stderr)
        passed = result.returncode == code and "Traceback" not in result.stderr
        if code == 0:
            passed = passed and not result.stderr
        if statuses is not None:
            rows = [re.split(r" {3,}", line) for line in result.stdout.splitlines() if line.startswith(prefix)]
            passed = passed and rows == [[pv, status] for pv, status in zip(names, statuses)]
        if message is not None:
            passed = passed and message in result.stderr
        record(name, passed, command=command, exit=result.returncode)
        return result

    def states(names):
        return request("getPVStatus", {"pv": ",".join(names)})

    def await_archived(names):
        def check():
            if app.poll() is not None or ioc.poll() is not None:
                raise RuntimeError("owned appliance or IOC exited")
            body = states(names)
            save(root, "last-status.json", body)
            return body if {row["pvName"] for row in body if row["status"] == "Being archived"} == set(names) else None
        return wait_for(check, ARCHIVE_TIMEOUT, "requested fixture PVs Being archived")

    try:
        for port, kind in [(args.port_base + n, socket.SOCK_STREAM) for n in (0, 1, 2, 3, 5)] + [
                (args.ca_port, socket.SOCK_STREAM), (args.ca_port, socket.SOCK_DGRAM)]:
            with socket.socket(type=kind) as probe:
                probe.bind(("127.0.0.1", port))
        command = [str(REPO / "scripts/run-local-appliance.bash"), "--port-base", str(args.port_base),
                   "--tomcat-home", str(Path(args.tomcat_home).resolve()), "--war-dir", str(args.war_dir.resolve()),
                   "--stop-timeout", str(STOP_TIMEOUT), str(root / "appliance")]
        save(root, "launcher-command.json", command)
        with (root / "launcher.log").open("w") as log:
            app = subprocess.Popen(command, env=env, cwd=REPO, stdout=log, stderr=subprocess.STDOUT)

        def ready():
            if app.poll() is not None:
                raise RuntimeError("launcher exited before readiness")
            status = root / "appliance/status"
            return status.exists() and status.read_text().strip() == "ready"

        wait_for(ready, START_TIMEOUT, "appliance startup")
        cli("unknown", "getPVStatus.py", pvs + [unavailable], ["Not being archived"] * 4)
        cli("submit-monitor", "archivePVList.py", [pvs[0], unavailable], ["Archive request submitted"] * 2)
        cli("submit-scan", "archivePVList.py", [pvs[1]], ["Archive request submitted"], ("--sampling-method", "SCAN", "--sampling-period", "2"))
        cli("submit-minimum", "archivePVList.py", [pvs[2]], ["Archive request submitted"], ("--sampling-period", "0.000_1"))
        cli("initial-sampling", "getPVStatus.py", pvs + [unavailable], ["Initial sampling"] * 4)
        command = [str(Path(args.ioc).resolve()), "-m", "P=" + prefix, "-d", str(FIXTURE)]
        save(root, "ioc-command.json", command)
        with (root / "ioc.log").open("w") as log:
            ioc = subprocess.Popen(command, cwd=root, env=env, stdin=subprocess.PIPE,
                                   stdout=log, stderr=subprocess.STDOUT, text=True)
        actual = {row["pvName"]: row for row in await_archived(pvs)}
        record("effective-sampling", actual[pvs[0]]["isMonitored"] == "true" and actual[pvs[1]]["isMonitored"] == "false"
               and float(actual[pvs[0]]["samplingPeriod"]) == 1 and float(actual[pvs[1]]["samplingPeriod"]) == 2
               and abs(float(actual[pvs[2]]["samplingPeriod"]) - 0.1) < 1e-6, response=actual)
        cli("archived-and-pending", "getPVStatus.py", pvs + [unavailable], ["Being archived"] * 3 + ["Initial sampling"])
        cli("repeat", "archivePVList.py", pvs, ["Already submitted"] * 3, ("--sampling-method", "SCAN", "--sampling-period", "7"))
        after = {row["pvName"]: row for row in states(pvs)}
        record("repeat-preserves-settings", all((row["isMonitored"], row["samplingPeriod"]) ==
               (after[pv]["isMonitored"], after[pv]["samplingPeriod"]) for pv, row in actual.items()))
        alias = prefix + "configuredAlias"
        response = request("addAlias", {"pv": pvs[0], "aliasname": alias})
        record("alias-setup", response.get("status") == "ok")
        cli("alias-query", "getPVStatus.py", [alias], ["Being archived"])
        before = request("getAllPVs", {"limit": -1})
        cli("alias-overlap", "archivePVList.py", [pvs[0], alias], code=2, message="overlapping")
        cli("normalized-overlap", "archivePVList.py", [pvs[0], pvs[0] + ".VAL"], code=2, message="overlapping")
        record("overlap-preserves-config", before == request("getAllPVs", {"limit": -1}))
        cli("alias-repeat", "archivePVList.py", [alias], ["Already submitted"])
        for position in range(3):
            names = [prefix + f"test_{20 + position * 3 + j}" for j in range(3)]
            names[position] = prefix + f"invalid{position}."
            expected = ["Archive request submitted"] * 3
            expected[position] = "Outcome unknown"
            cli(f"mixed-{position}", "archivePVList.py", names, expected, code=1)
            good = [pv for pv in names if not pv.endswith(".")]
            await_archived(good)
            invalid_status = states([names[position]])
            record(f"mixed-state-{position}", invalid_status[0]["status"] == "Not being archived")
        page = (REPO / "docs/book/src/scripting.md").read_text()
        commands = page.split("## Request archiving and inspect status\n", 1)[1].split("```bash\n", 1)[1].split("```", 1)[0]
        command = ["bash", "-e", "-c", commands]
        result = subprocess.run(command, cwd=REPO, env={**env, "BPL_URL": bpl, "PV_FILE": str(root / "alias-repeat.txt")},
                                capture_output=True, text=True, timeout=120)
        (root / "documented-commands.stdout").write_text(result.stdout)
        (root / "documented-commands.stderr").write_text(result.stderr)
        rows = [re.split(r" {3,}", line) for line in result.stdout.splitlines() if line.startswith(alias)]
        record("documented-commands", result.returncode == 0 and not result.stderr and rows == [
            [alias, "Being archived"], [alias, "Already submitted"], [alias, "Being archived"]], command=command)
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
                    try:
                        ioc.stdin.write("exit\n")
                        ioc.stdin.flush()
                    except BrokenPipeError:
                        pass
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
    print(f"PASS: {len(results)} live checks; owned appliance and IOC stopped", flush=True)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda signum, frame: sys.exit(1))
    main()
