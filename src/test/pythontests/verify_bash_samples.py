#!/usr/bin/env python3
"""Compare the Bash sample scripts with their Python originals on a dedicated local appliance.

The runner starts the real launcher and the shipped IOC fixture, archives a set of fixture PVs,
then runs each selected script's original (read from git at ORIGINAL_COMMIT) and its .bash
replacement on the same inputs. Outputs must agree except for the intentional changes each
case names. Evidence is retained in the run folder.
"""

import argparse
import datetime
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

from verify_list_archived_pvs import FIXTURE, REPO, digest, save, stop_owned_jvms, wait_for

SAMPLES = REPO / "docs/book/src/samples"
ORIGINAL_COMMIT = "d1cd363c"
PV_COUNT = 20
START_TIMEOUT = 180
ARCHIVE_TIMEOUT = 360
STOP_TIMEOUT = 300
STOP_ALLOWANCE = 7
HTTP_TIMEOUT = 30


class Run:
    """Holds the appliance, the evidence folder and the case results of one verification run."""

    def __init__(self, root, env, bpl, prefix, pvs):
        self.root = root
        self.env = env
        self.bpl = bpl
        self.prefix = prefix
        self.pvs = pvs
        self.results = []
        self.http = build_opener(ProxyHandler({}))
        self.originals = root / "originals"
        self.originals.mkdir()

    def request(self, action, params=None, data=None):
        url = self.bpl + "/" + action + ("?" + urlencode(params) if params else "")
        req = Request(url, data=json.dumps(data).encode() if data is not None else None,
                      headers={"Content-Type": "application/json"} if data is not None else {})
        with self.http.open(req, timeout=HTTP_TIMEOUT) as response:
            body = json.load(response)
        with (self.root / "http.jsonl").open("a") as out:
            out.write(json.dumps({"url": url, "request": data, "response": body}) + "\n")
        return body

    def original(self, name):
        path = self.originals / f"{name}.py"
        if not path.exists():
            source = subprocess.check_output(["git", "show", f"{ORIGINAL_COMMIT}:docs/book/src/samples/{name}.py"],
                                             cwd=REPO)
            path.write_bytes(source)
        return path

    def execute(self, label, command):
        result = subprocess.run(command, env=self.env, text=True, capture_output=True, timeout=HTTP_TIMEOUT + 30)
        (self.root / f"{label}.stdout").write_text(result.stdout)
        (self.root / f"{label}.stderr").write_text(result.stderr)
        return result

    def compare(self, case, name, args, expect=None):
        """Run original and replacement on the same arguments; expect(original, bash) returns a reason or None."""
        original = self.execute(f"{case}.original", [sys.executable, str(self.original(name)), *args])
        replacement = self.execute(f"{case}.bash", [str(SAMPLES / f"{name}.bash"), *args])
        reason = (expect or same_output)(original, replacement)
        passed = reason is None
        self.results.append({
            "case": case, "script": name, "args": [str(a) for a in args],
            "original_exit": original.returncode, "bash_exit": replacement.returncode,
            "original_lines": len(original.stdout.splitlines()), "bash_lines": len(replacement.stdout.splitlines()),
            "passed": passed, "reason": reason,
        })
        save(self.root, "results.json", self.results)
        print(f"[ {'PASS' if passed else 'FAIL'} ] {case}: original exit {original.returncode}, "
              f"bash exit {replacement.returncode}, {len(replacement.stdout.splitlines())} lines", flush=True)
        if not passed:
            raise RuntimeError(f"{case} failed: {reason}")


def same_output(original, replacement):
    if original.returncode != 0 or replacement.returncode != 0:
        return f"exit {original.returncode}/{replacement.returncode}"
    if replacement.stderr:
        return "replacement wrote to stderr"
    if original.stdout != replacement.stdout:
        return "stdout differs"
    return None


def unarchived_pvs_cases(run):
    archived = run.pvs[:10]
    unknown = [f"{run.prefix}unknown_{i}" for i in range(5)]
    rows = [f"{name},MONITOR,1" for name in archived]
    rows += [f"{name},row{i}" for i, name in enumerate(unknown)]
    rows += [f"{unknown[0]},duplicate-last", f"{archived[0]}.HIHI", f"{archived[1]}.VAL"]
    csv = run.root / "unarchived-input.csv"
    csv.write_text("\n".join(rows) + "\n")
    run.compare("unarchivedPVs-mixed", "unarchivedPVs", [run.bpl, csv])

    known = run.root / "unarchived-known.csv"
    known.write_text("\n".join(archived) + "\n")
    run.compare("unarchivedPVs-all-known", "unarchivedPVs", [run.bpl, known])

    blank = run.root / "unarchived-blank.csv"
    blank.write_text(f"{unknown[2]}\n\n{archived[2]}\n")

    def blank_line_skipped(original, replacement):
        # Intentional change: a blank line is skipped instead of being sent as an empty name.
        if original.returncode != 0 or replacement.returncode != 0:
            return f"exit {original.returncode}/{replacement.returncode}"
        if original.stdout != "\n" + replacement.stdout or replacement.stdout != unknown[2] + "\n":
            return "expected the original to add exactly one empty row for the blank line"
        return None

    run.compare("unarchivedPVs-blank-line", "unarchivedPVs", [run.bpl, blank], blank_line_skipped)

    padded = run.root / "unarchived-padded.csv"
    padded.write_text(f"{archived[3]} ,meta\n{unknown[3]},row\n  {unknown[3]} , padded\n")

    def first_column_trimmed(original, replacement):
        # Intentional change: the first column is trimmed, so a padded name matches its PV.
        # The original sends "<name> " and reports the archived PV as unarchived and the
        # padded unknown name as a second PV.
        if original.returncode != 0 or replacement.returncode != 0:
            return f"exit {original.returncode}/{replacement.returncode}"
        expected_original = f"{unknown[3]},row\n{unknown[3]} , padded\n{archived[3]} ,meta\n"
        if sorted(original.stdout.splitlines()) != sorted(expected_original.splitlines()):
            return "original did not report the padded archived name and both unknown rows"
        if replacement.stdout != f"{unknown[3]} , padded\n":
            return "replacement did not trim the first column"
        return None

    run.compare("unarchivedPVs-padded-first-column", "unarchivedPVs", [run.bpl, padded], first_column_trimmed)


CASES = {"unarchivedPVs": unarchived_pvs_cases}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("run_folder", type=Path, help="new evidence folder; retained after verification")
    parser.add_argument("--script", action="append", choices=sorted(CASES), help="script to compare (default: all)")
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
    scripts = args.script or sorted(CASES)
    root = args.run_folder.resolve()
    root.mkdir(parents=True, exist_ok=False)
    env = os.environ.copy()
    env.update(NO_PROXY="*", no_proxy="*", PYTHONDONTWRITEBYTECODE="1",
               EPICS_CA_AUTO_ADDR_LIST="NO", EPICS_CA_ADDR_LIST="127.0.0.1",
               EPICS_CA_SERVER_PORT=str(args.ca_port), EPICS_CAS_SERVER_PORT=str(args.ca_port),
               EPICS_CAS_INTF_ADDR_LIST="127.0.0.1", EPICS_CAS_BEACON_ADDR_LIST="127.0.0.1",
               EPICS_PVAS_INTF_ADDR_LIST="224.0.1.1,1@127.0.0.1")
    bpl = f"http://127.0.0.1:{args.port_base}/mgmt/bpl"
    prefix = f"M37BASH:{uuid.uuid4().hex[:8]}:"
    pvs = [f"{prefix}test_{i}" for i in range(PV_COUNT)]
    run = Run(root, env, bpl, prefix, pvs)
    app = ioc = None
    print(f"Evidence: {root}", flush=True)
    wars = sorted(args.war_dir.resolve().glob("*.war"))
    save(root, "manifest.json", {
        "observed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip(),
        "original_commit": ORIGINAL_COMMIT, "scripts": scripts, "python": sys.version,
        "replacements": {name: digest(SAMPLES / f"{name}.bash") for name in scripts},
        "client_sha256": digest(SAMPLES / "archiverClient.bash"), "fixture_sha256": digest(FIXTURE),
        "wars": {str(path): digest(path) for path in wars}, "prefix": prefix, "pvs": pvs,
        "ca_port": args.ca_port, "bpl_url": bpl,
    })
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
        command = [str(Path(args.ioc).resolve()), "-m", "P=" + prefix, "-d", str(FIXTURE)]
        save(root, "ioc-command.json", command)
        with (root / "ioc.log").open("w") as log:
            ioc = subprocess.Popen(command, cwd=root, env=env, stdin=subprocess.PIPE,
                                   stdout=log, stderr=subprocess.STDOUT, text=True)
        run.request("archivePV", data=[{"pv": pv, "samplingmethod": "MONITOR", "samplingperiod": "1"} for pv in pvs])

        def archived():
            if ioc.poll() is not None or app.poll() is not None:
                raise RuntimeError("owned IOC or appliance exited during archive preparation")
            states = run.request("getPVStatus", {"pv": prefix + "*", "limit": -1})
            save(root, "last-status.json", states)
            return {row["pvName"] for row in states if row["status"] == "Being archived"} == set(pvs)

        wait_for(archived, ARCHIVE_TIMEOUT, f"{PV_COUNT} PVs Being archived (last-status.json)")
        for name in scripts:
            CASES[name](run)
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
                                or cleanup.get("fallback_terminated") or cleanup.get("fallback_killed"))) \
                or (ioc is not None and cleanup.get("ioc_exit") != 0):
            raise RuntimeError(f"cleanup failed: {cleanup}")
    print(f"PASS: {len(run.results)} comparisons; launcher and IOC stopped", flush=True)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda signum, frame: sys.exit(1))
    main()
