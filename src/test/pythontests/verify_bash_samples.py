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
import socketserver
import subprocess
import threading
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


class MailSink:
    """A loopback SMTP receiver without TLS or authentication that keeps each message's raw text."""

    def __init__(self):
        self.messages = []
        sink = self

        class Handler(socketserver.StreamRequestHandler):
            def handle(self):
                self.wfile.write(b"220 sink\r\n")
                while True:
                    line = self.rfile.readline()
                    if not line:
                        return
                    verb = line.strip().split(b" ", 1)[0].upper()
                    if verb in (b"EHLO", b"HELO"):
                        self.wfile.write(b"250 sink\r\n")
                    elif verb == b"DATA":
                        self.wfile.write(b"354 end with .\r\n")
                        data = []
                        for body_line in iter(self.rfile.readline, b""):
                            if body_line in (b".\r\n", b".\n"):
                                break
                            data.append(body_line[1:] if body_line.startswith(b"..") else body_line)
                        sink.messages.append(b"".join(data).decode("utf-8", "replace").replace("\r\n", "\n"))
                        self.wfile.write(b"250 queued\r\n")
                    elif verb == b"QUIT":
                        self.wfile.write(b"221 bye\r\n")
                        return
                    else:
                        self.wfile.write(b"250 ok\r\n")

        self.server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Handler)
        self.server.daemon_threads = True
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()
        self.server.server_close()


def mail_body(message):
    """Returns the body of one received plain-text message without its trailing newlines."""
    return message.split("\n\n", 1)[1].rstrip("\n") if "\n\n" in message else ""


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

    def mail_env(self):
        """Starts the loopback SMTP receiver and the mail configuration the original alert scripts read."""
        if getattr(self, "mail", None) is None:
            self.mail = MailSink()
            config = self.root / "mail-config.json"
            config.write_text(json.dumps({"from": "archiver@localhost", "to": ["operator@localhost", "second@localhost"],
                                          "smtphost": "127.0.0.1", "port": self.mail.port, "use_ssl": False,
                                          "use_tls": False, "username": "", "password": ""}))
            self.env["ARCHAPPL_NAGIOS_EMAIL_CONFIG"] = str(config)
            self.original("emailHandler")
        return self.mail

    def mail_compare(self, case, name, args, alert_expected):
        """Compares the mail an original sends with the replacement's stdout and exit status."""
        mail = self.mail_env()
        before = len(mail.messages)

        def judge(original, replacement):
            sent = mail.messages[before:]
            save(self.root, f"{case}.mail.json", sent)
            if original.returncode != 0:
                return f"original exit {original.returncode}"
            if alert_expected:
                if len(sent) != 1 or replacement.returncode != 1 or replacement.stderr:
                    return f"expected one mail and exit 1; got {len(sent)} mails, exit {replacement.returncode}"
                if mail_body(sent[0]) != replacement.stdout.rstrip("\n"):
                    return "mail body differs from the replacement's stdout"
            elif sent or replacement.returncode != 0 or replacement.stdout or replacement.stderr:
                return f"expected no mail and a silent exit 0; got {len(sent)} mails, exit {replacement.returncode}"
            return None

        self.compare(case, name, args, judge)

    def execute(self, label, command):
        result = subprocess.run(command, env=self.env, text=True, capture_output=True, timeout=HTTP_TIMEOUT + 60)
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


def archived_pvs_not_in_list_cases(run):
    configured = run.request("getAllPVs", {"limit": -1})
    save(run.root, "not-in-list-configured.json", configured)
    listed = run.pvs[:12] + [f"{run.prefix}unknown_0"]
    csv = run.root / "not-in-list-input.csv"
    csv.write_text("\n".join(f"{name},meta" for name in listed) + "\n")

    def expected_absent(original, replacement):
        reason = same_output(original, replacement)
        if reason:
            return reason
        expected = sorted(set(configured) - set(listed))
        if replacement.stdout.splitlines() != expected:
            return "output is not the configured PVs absent from the list"
        return None

    run.compare("archivedPVsNotInList-partial", "archivedPVsNotInList", [run.bpl, csv], expected_absent)

    everything = run.root / "not-in-list-all.csv"
    everything.write_text("\n".join(configured) + "\n")
    run.compare("archivedPVsNotInList-all-listed", "archivedPVsNotInList", [run.bpl, everything])

    empty = run.root / "not-in-list-empty.csv"
    empty.write_text("\n")

    def empty_rejected_before_http(original, replacement):
        # Intentional change: an input without names exits 2 before HTTP. The original sends
        # one empty name, which the server does not treat as empty, so it lists every configured PV.
        if replacement.returncode != 2 or replacement.stdout or "contains no names" not in replacement.stderr:
            return f"replacement exit {replacement.returncode}; expected 2 with a diagnostic"
        if original.returncode != 0 or original.stdout.splitlines() != sorted(configured):
            return "original did not list every configured PV for the blank line"
        return None

    run.compare("archivedPVsNotInList-empty", "archivedPVsNotInList", [run.bpl, empty], empty_rejected_before_http)


def ensure_type_change(run):
    """Give one archived PV a configured type that disagrees with its IOC record, through the shipped BPL."""
    if getattr(run, "type_changed_pv", None):
        return run.type_changed_pv
    pv = run.pvs[6]
    run.request("pauseArchivingPV", {"pv": pv})
    info = run.request("getPVTypeInfo", {"pv": pv})
    save(run.root, "type-original.json", info)
    info[next(key for key in info if key.lower() == "dbrtype")] = "DBR_SCALAR_FLOAT"
    run.request("putPVTypeInfo", {"pv": pv, "override": "true"}, data=info)
    run.request("resumeArchivingPV", {"pv": pv})
    changed = wait_for(lambda: [row for row in run.request("getPVsByDroppedEventsTypeChange") if row["pvName"] == pv],
                       90, "type-change report naming the changed PV")
    save(run.root, "type-changed.json", changed)
    run.type_changed_pv = pv
    return pv


def list_type_changes_cases(run):
    run.compare("listTypeChanges-empty", "listTypeChanges", [run.bpl])
    pv = ensure_type_change(run)

    def names_changed_pv(original, replacement):
        reason = same_output(original, replacement)
        if reason:
            return reason
        if pv not in replacement.stdout or "Current DBR_SCALAR_DOUBLE" not in replacement.stdout:
            return "output does not show the changed PV with its CA type"
        return None

    run.compare("listTypeChanges-changed", "listTypeChanges", [run.bpl], names_changed_pv)


def check_for_engine_activity_cases(run):
    sts = run.root / "appliance/stores/sts"
    interval = "25"

    def both_saw_changes(original, replacement):
        # The two runs cover different windows, so only the presence of changes is compared.
        if original.returncode != 0 or replacement.returncode != 0 or replacement.stderr:
            return f"exit {original.returncode}/{replacement.returncode}"
        for result in (original, replacement):
            words = result.stdout.split()
            if len(words) != 7 or not words[0].isdigit() or int(words[0]) < 1 \
                    or " ".join(words[1:]) != f"changes were detected in {interval} seconds":
                return f"unexpected output: {result.stdout!r}"
        return None

    run.compare("checkForEngineActivity-sts", "checkForEngineActivity", ["-t", interval, sts], both_saw_changes)

    quiet = run.root / "quiet-store"
    (quiet / "PV").mkdir(parents=True)
    (quiet / "PV/static.pb").write_bytes(b"static")

    def no_change_exits_1(original, replacement):
        # Intentional change: no change exits 1 instead of -1 (status 255).
        expected = "No changes detected in the last 3 seconds\n"
        if original.returncode != 255 or replacement.returncode != 1:
            return f"exit {original.returncode}/{replacement.returncode}; expected 255/1"
        if original.stdout != expected or replacement.stdout != expected or replacement.stderr:
            return "outputs differ"
        return None

    run.compare("checkForEngineActivity-quiet", "checkForEngineActivity", ["-t", "3", quiet], no_change_exits_1)


def check_connected_pvs_cases(run):
    run.mail_compare("checkConnectedPVs-quiet", "checkConnectedPVs", [run.bpl], alert_expected=False)
    run.mail_compare("checkConnectedPVs-alert", "checkConnectedPVs", ["-d", "-1", run.bpl], alert_expected=True)


def check_type_changed_pvs_cases(run):
    mail = run.mail_env()

    def report_matches(alert_expected):
        def judge(original, replacement):
            sent = mail.messages[judge.before:]
            save(run.root, f"checkTypeChangedPVs-{'changed' if alert_expected else 'empty'}.mail.json", sent)
            if original.returncode != 0 or replacement.stderr:
                return f"exit {original.returncode}/{replacement.returncode}"
            lines = replacement.stdout.splitlines()
            if not alert_expected:
                if sent or replacement.returncode != 0 or original.stdout != replacement.stdout:
                    return "expected no mail and the same no-change line"
                return None
            if len(sent) != 1 or replacement.returncode != 1:
                return f"expected one mail and exit 1; got {len(sent)}, exit {replacement.returncode}"
            if lines[0] != original.stdout.rstrip("\n") or lines[1:] != mail_body(sent[0]).splitlines()[1:]:
                return "count line or PV names differ from the original's output and mail"
            return None
        judge.before = len(mail.messages)
        return judge

    run.compare("checkTypeChangedPVs-empty", "checkTypeChangedPVs", [run.bpl], report_matches(False))
    ensure_type_change(run)
    run.compare("checkTypeChangedPVs-changed", "checkTypeChangedPVs", [run.bpl], report_matches(True))


def storage_size_check_cases(run):
    mail = run.mail_env()

    def rows(lines):
        parsed = []
        for line in lines:
            name, value = line[len("PV: "):].rsplit(" Size(GB/year): ", 1)
            parsed.append((name, float(value)))
        return parsed

    def judge_alert(original, replacement):
        sent = mail.messages[judge_alert.before:]
        save(run.root, "storageSizeCheck-alert.mail.json", sent)
        if original.returncode != 0 or replacement.returncode != 1 or replacement.stderr or len(sent) != 1:
            return f"exit {original.returncode}/{replacement.returncode}, {len(sent)} mails"
        body = mail_body(sent[0]).splitlines()
        lines = replacement.stdout.splitlines()
        if body[0] != lines[0]:
            return "header differs"
        # Intentional change: rates are printed as the server formats them, so values compare as numbers.
        if rows(body[1:]) != rows(lines[1:]) or not lines[1:]:
            return "PV order or rates differ from the mail"
        return None

    def judge_quiet(original, replacement):
        if mail.messages[judge_quiet.before:] or original.returncode != 0 or original.stdout:
            return "original mailed or printed"
        if replacement.returncode != 0 or replacement.stdout or replacement.stderr:
            return f"replacement exit {replacement.returncode} with output"
        return None

    judge_quiet.before = len(mail.messages)
    run.compare("storageSizeCheck-quiet", "storageSizeCheck", [run.bpl, "1000000"], judge_quiet)
    judge_alert.before = len(mail.messages)
    run.compare("storageSizeCheck-alert", "storageSizeCheck", [run.bpl, "-1.0", "--limit", "15"], judge_alert)


CASES = {"unarchivedPVs": unarchived_pvs_cases, "archivedPVsNotInList": archived_pvs_not_in_list_cases,
         "listTypeChanges": list_type_changes_cases, "checkForEngineActivity": check_for_engine_activity_cases,
         "checkConnectedPVs": check_connected_pvs_cases, "checkTypeChangedPVs": check_type_changed_pvs_cases,
         "storageSizeCheck": storage_size_check_cases}


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
