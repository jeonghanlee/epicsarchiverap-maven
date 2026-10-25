#!/usr/bin/env python3
"""Check the Bash sample scripts on a dedicated local appliance.

The runner starts the real launcher and the shipped IOC fixture, archives a set of fixture PVs,
then runs each selected script's original (read from git at ORIGINAL_COMMIT) and its .bash
replacement on the same inputs. Outputs must agree except for the intentional changes each
case names. The scripts that have no original, getDataToCsv.bash and csvStats.bash, are checked
against independent requests and computations of the same samples. Evidence is retained in the run folder.
"""

import argparse
import csv
import datetime
import io
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import socketserver
import statistics
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

    def __init__(self, root, env, bpl, prefix, pvs, retrieval=None):
        self.root = root
        self.retrieval = retrieval
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


def list_type_changes_empty(run):
    run.compare("listTypeChanges-empty", "listTypeChanges", [run.bpl], expect_empty_type_report)


def expect_empty_type_report(original, replacement):
    reason = same_output(original, replacement)
    if reason:
        return reason
    return None if not replacement.stdout else "the type-change report is not empty"


def list_type_changes_cases(run):
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


def check_type_changed_pvs_empty(run):
    mail = run.mail_env()
    before = len(mail.messages)

    def judge(original, replacement):
        sent = mail.messages[before:]
        save(run.root, "checkTypeChangedPVs-empty.mail.json", sent)
        if sent or original.returncode != 0 or replacement.returncode != 0 or replacement.stderr:
            return f"expected no mail and exit 0; got {len(sent)} mails, exit {replacement.returncode}"
        if original.stdout != replacement.stdout or replacement.stdout != "No PVs have changed type\n":
            return "expected the same no-change line"
        return None

    run.compare("checkTypeChangedPVs-empty", "checkTypeChangedPVs", [run.bpl], judge)


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

    ensure_type_change(run)
    run.compare("checkTypeChangedPVs-changed", "checkTypeChangedPVs", [run.bpl], report_matches(True))


def storage_size_check_cases(run):
    mail = run.mail_env()

    units = {"B": 0, "KB": 1, "MB": 2, "GB": 3, "TB": 4}

    def original_rows(lines):
        rows = []
        for line in lines:
            name, value = line[len("PV: "):].rsplit(" Size(GB/year): ", 1)
            rows.append((name, float(value)))
        return rows

    def replacement_rows(lines):
        rows = []
        for line in lines:
            name, value = line[len("PV: "):].rsplit(" Size: ", 1)
            number, unit = value.removesuffix("/year").split(" ")
            rows.append((name, float(number) * 1024 ** units[unit] / 1024 ** 3))
        return rows

    def judge_alert(original, replacement):
        sent = mail.messages[judge_alert.before:]
        save(run.root, "storageSizeCheck-alert.mail.json", sent)
        if original.returncode != 0 or replacement.returncode != 1 or replacement.stderr or len(sent) != 1:
            return f"exit {original.returncode}/{replacement.returncode}, {len(sent)} mails"
        body = mail_body(sent[0]).splitlines()
        lines = replacement.stdout.splitlines()
        # Intentional change: the header puts a space before the unit and rates print in readable
        # units with three significant digits, so names compare exactly and rates within rounding.
        if body[0].replace("GB/year", " GB/year") != lines[0]:
            return "header differs"
        # The server re-estimates rates while archiving, so each printed rate must match, within
        # rounding, the original's mail or a report read right after the replacement ran.
        readback = {row["pvName"]: float(row["storageRate_GBperYear"])
                    for row in run.request("getStorageRateReport", {"limit": 15})}
        mailed, got = dict(original_rows(body[1:])), replacement_rows(lines[1:])
        if not got or {name for name, _ in got} != set(mailed):
            return "the replacement reports a different set of PVs than the mail"
        for name, value in got:
            if not any(abs(value - ref) <= 0.005 * ref for ref in (mailed[name], readback.get(name, -1.0))):
                return f"rate of {name} matches neither the mail nor the readback within rounding"
        if [value for _, value in got] != sorted((value for _, value in got), reverse=True):
            return "the replacement's rates are not in descending order"
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


def documented_cases(run):
    """Executes the scripting page's Bash sample commands verbatim against the appliance."""
    page = (REPO / "docs/book/src/scripting.md").read_text()
    section = page.split("## Bash sample scripts\n", 1)[1].split("\n## ", 1)[0]
    blocks = [part.split("```", 1)[0] for part in section.split("```bash\n")[1:]]
    pv_file = run.root / "documented-pvs.csv"
    pv_file.write_text("\n".join([f"{run.pvs[0]},meta", f"{run.prefix}unknown_doc"]) + "\n")
    env = dict(run.env, BPL_URL=run.bpl, PV_FILE=str(pv_file), STS_FOLDER=str(run.root / "appliance/stores/sts"))
    commands = "\n".join(blocks)
    command = ["bash", "-e", "-c", commands]
    result = subprocess.run(command, cwd=REPO, env=env, text=True, capture_output=True, timeout=300)
    (run.root / "documented-commands.stdout").write_text(result.stdout)
    (run.root / "documented-commands.stderr").write_text(result.stderr)
    lines = result.stdout.splitlines()
    expected_start = [f"{run.prefix}unknown_doc"]
    passed = (result.returncode == 0 and not result.stderr and len(blocks) == 3
              and lines[:1] == expected_start and any("changes were detected in 30 seconds" in line for line in lines))
    run.results.append({"case": "documented-commands", "blocks": len(blocks), "exit": result.returncode,
                        "lines": len(lines), "passed": passed})
    save(run.root, "results.json", run.results)
    print(f"[ {'PASS' if passed else 'FAIL'} ] documented-commands: {len(blocks)} blocks, exit {result.returncode}",
          flush=True)
    if not passed:
        raise RuntimeError("documented commands failed; see documented-commands.stdout and .stderr")


DATA_PV_NAMES = ("UnitTestNoNamingConvention:sine", "UnitTestNoNamingConvention:cosine", "--ArchUnitTest:sine")
DATA_WINDOW_SECONDS = 60
DATA_MINIMUM_SAMPLES = 25
DATA_TIMEOUT = 240
UTC_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


def retrieval_samples(run, pv, start, end):
    """Reads the samples of one PV with a request of its own, independent of the script under test."""
    query = urlencode({"pv": pv, "from": start, "to": end})
    with run.http.open(Request(f"{run.retrieval}/data/getData.json?{query}"), timeout=HTTP_TIMEOUT) as response:
        body = json.load(response)
    return body[0]["data"] if body else []


def data_window(run):
    """Archives the data PVs, waits until each holds enough samples, and returns a closed past window."""
    pvs = [run.prefix + name for name in DATA_PV_NAMES]

    def archived():
        states = run.request("getPVStatus", {"pv": run.prefix + "*", "limit": -1})
        return {row["pvName"] for row in states if row["status"] == "Being archived"}

    missing = [pv for pv in pvs if pv not in archived()]
    if missing:
        run.request("archivePV", data=[{"pv": pv, "samplingmethod": "MONITOR", "samplingperiod": "1"}
                                       for pv in missing])

    def ready():
        if not set(pvs) <= archived():
            return False
        end = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=3)
        start = end - datetime.timedelta(seconds=DATA_WINDOW_SECONDS)
        return all(len(retrieval_samples(run, pv, start.strftime(UTC_FORMAT), end.strftime(UTC_FORMAT)))
                   >= DATA_MINIMUM_SAMPLES for pv in pvs)

    wait_for(ready, DATA_TIMEOUT, f"{DATA_MINIMUM_SAMPLES} samples of each data PV")
    end = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0) - datetime.timedelta(seconds=3)
    start = end - datetime.timedelta(seconds=DATA_WINDOW_SECONDS)
    return pvs, start.strftime(UTC_FORMAT), end.strftime(UTC_FORMAT)


def file_name(pv):
    return "".join(ch if ch.isalnum() and ch.isascii() or ch in "._-" else "_" for ch in pv) + ".csv"


def record(run, case, passed, detail):
    run.results.append({"case": case, "passed": passed, **detail})
    save(run.root, "results.json", run.results)
    print(f"[ {'PASS' if passed else 'FAIL'} ] {case}: {detail.get('summary', '')}", flush=True)
    if not passed:
        raise RuntimeError(f"{case} failed: {detail}")


def expected_time(sample):
    moment = datetime.datetime.fromtimestamp(sample["secs"], datetime.timezone.utc)
    return moment.strftime("%Y-%m-%dT%H:%M:%S") + f".{sample['nanos']:09d}Z"


def get_data_to_csv_cases(run):
    """Runs getDataToCsv.bash on archived PVs and compares every CSV row with an independent request."""
    pvs, start, end = data_window(run)
    pv_file = run.root / "data-pvs.csv"
    pv_file.write_text("".join(f"{pv}\n" for pv in pvs))
    out = run.root / "data-csv"
    result = run.execute("getDataToCsv-real", [str(SAMPLES / "getDataToCsv.bash"), run.retrieval, str(pv_file),
                                              start, end, str(out)])
    problems = []
    if result.returncode != 0 or result.stderr:
        problems.append(f"exit {result.returncode}, stderr {result.stderr!r}")
    rows_total = 0
    for pv in pvs:
        expected = retrieval_samples(run, pv, start, end)
        path = out / file_name(pv)
        if not path.is_file():
            problems.append(f"missing {path.name}")
            continue
        rows = list(csv.reader(io.StringIO(path.read_text(encoding="utf-8"))))
        if rows[0] != ["time_utc", "secs", "nanos", "value", "severity", "status"]:
            problems.append(f"{path.name}: header {rows[0]}")
        body = rows[1:]
        rows_total += len(body)
        if len(body) != len(expected) or len(body) < DATA_MINIMUM_SAMPLES:
            problems.append(f"{path.name}: {len(body)} rows, independent request {len(expected)}")
            continue
        for row, sample in zip(body, expected):
            actual = (row[0], int(row[1]), int(row[2]), float(row[3]), int(row[4]), int(row[5]))
            wanted = (expected_time(sample), sample["secs"], sample["nanos"], float(sample["val"]),
                      sample["severity"], sample["status"])
            if actual != wanted:
                problems.append(f"{path.name}: row {actual} differs from {wanted}")
                break
    record(run, "getDataToCsv-real", not problems, {"summary": f"{len(pvs)} files, {rows_total} rows equal the "
           "independent requests" if not problems else "; ".join(problems), "pvs": pvs, "from": start, "to": end})
    unknown = run.prefix + "unknown_data"
    unknown_file = run.root / "data-unknown-pvs.csv"
    unknown_file.write_text(f"{pvs[0]}\n{unknown}\n")
    unknown_out = run.root / "data-csv-unknown"
    observed = run.execute("getDataToCsv-unknown", [str(SAMPLES / "getDataToCsv.bash"), run.retrieval,
                                                    str(unknown_file), start, end, str(unknown_out)])
    files = sorted(p.name for p in unknown_out.iterdir()) if unknown_out.exists() else []
    problems = []
    if observed.returncode != 3:
        problems.append(f"exit {observed.returncode}, expected 3")
    if files != [file_name(pvs[0])]:
        problems.append(f"files {files}, expected only the file of the known PV")
    if "HTTP 404" not in observed.stderr or unknown not in observed.stderr:
        problems.append(f"stderr does not name the unknown PV and HTTP 404: {observed.stderr!r}")
    if f"{pvs[0]}: " not in observed.stdout or unknown in observed.stdout:
        problems.append(f"stdout {observed.stdout!r}")
    record(run, "getDataToCsv-unknown-pv", not problems, {
        "summary": "the unknown PV answers HTTP 404, is reported by name, leaves no file, the known PV is written "
                   "and the exit status is 3" if not problems else "; ".join(problems),
        "exit": observed.returncode, "files": files})


def documented_data_cases(run):
    """Executes the commands of the extraction and statistics section of the scripting page verbatim."""
    page = (REPO / "docs/book/src/scripting.md").read_text()
    section = page.split("## Extract samples to CSV files and compute statistics\n", 1)[1].split("\n## ", 1)[0]
    blocks = [part.split("```", 1)[0] for part in section.split("```bash\n")[1:]]
    pvs, start, end = data_window(run)
    pv_file = run.root / "documented-data-pvs.csv"
    pv_file.write_text("".join(f"{pv}\n" for pv in pvs))
    out = run.root / "documented-data-csv"
    env = dict(run.env, RETRIEVAL_URL=run.retrieval, PV_FILE=str(pv_file), FROM=start, TO=end, OUT_DIR=str(out),
               CSV_FILE=str(out / file_name(pvs[0])))
    result = subprocess.run(["bash", "-e", "-c", "\n".join(blocks)], cwd=REPO, env=env, text=True,
                            capture_output=True, timeout=300)
    (run.root / "documented-data-commands.stdout").write_text(result.stdout)
    (run.root / "documented-data-commands.stderr").write_text(result.stderr)
    lines = result.stdout.splitlines()
    passed = (result.returncode == 0 and not result.stderr and len(blocks) == 2
              and sum("samples written to" in line for line in lines) == len(pvs)
              and any(line.startswith("n=") for line in lines) and "bin_from,bin_to,count" in lines
              and "time_utc,mean,sd" in lines)
    record(run, "documented-data-commands", passed, {
        "summary": f"{len(blocks)} blocks, exit {result.returncode}, {len(lines)} lines",
        "blocks": len(blocks), "exit": result.returncode})


def csv_stats_cases(run):
    """Runs csvStats.bash on a CSV from getDataToCsv.bash and compares each mode with an independent computation."""
    pvs, start, end = data_window(run)
    pv = pvs[0]
    out = run.root / "stats-csv"
    pv_file = run.root / "stats-pvs.csv"
    pv_file.write_text(f"{pv}\n")
    extraction = run.execute("csvStats-extract", [str(SAMPLES / "getDataToCsv.bash"), run.retrieval, str(pv_file),
                                                 start, end, str(out)])
    if extraction.returncode != 0:
        raise RuntimeError(f"extraction for the statistics failed: {extraction.stderr}")
    path = out / file_name(pv)
    values = [float(sample["val"]) for sample in retrieval_samples(run, pv, start, end)]
    times = [expected_time(sample) for sample in retrieval_samples(run, pv, start, end)]
    problems = []

    def close(label, actual, wanted):
        if not (abs(actual - wanted) <= 1e-9 * max(1.0, abs(wanted))):
            problems.append(f"{label}: {actual} != {wanted}")

    summary = run.execute("csvStats-summary", [str(SAMPLES / "csvStats.bash"), "summary", str(path)])
    fields = dict(part.split("=") for part in summary.stdout.split())
    if summary.returncode != 0 or int(fields.get("n", -1)) != len(values) or fields.get("skipped") != "0":
        problems.append(f"summary: exit {summary.returncode}, {summary.stdout!r}")
    else:
        close("mean", float(fields["mean"]), statistics.fmean(values))
        close("sd", float(fields["sd"]), statistics.stdev(values))
        close("min", float(fields["min"]), min(values))
        close("max", float(fields["max"]), max(values))
    window = 5
    moving = run.execute("csvStats-moving", [str(SAMPLES / "csvStats.bash"), "moving", "--window", str(window), str(path)])
    rows = list(csv.reader(io.StringIO(moving.stdout)))
    if moving.returncode != 0 or len(rows) - 1 != len(values) - window + 1:
        problems.append(f"moving: exit {moving.returncode}, {len(rows) - 1} rows for {len(values)} samples")
    else:
        for position, row in enumerate(rows[1:]):
            part = values[position:position + window]
            if row[0] != times[position + window - 1]:
                problems.append(f"moving row {position}: time {row[0]}")
                break
            close(f"moving mean {position}", float(row[1]), statistics.fmean(part))
            close(f"moving sd {position}", float(row[2]), statistics.stdev(part))
    bins = 6
    histogram = run.execute("csvStats-histogram", [str(SAMPLES / "csvStats.bash"), "histogram", "--bins", str(bins), str(path)])
    rows = list(csv.reader(io.StringIO(histogram.stdout)))
    low, high = min(values), max(values)
    wanted = [0] * bins
    for value in values:
        wanted[min(bins - 1, int((value - low) / (high - low) * bins))] += 1
    if histogram.returncode != 0 or [int(row[2]) for row in rows[1:]] != wanted:
        problems.append(f"histogram: exit {histogram.returncode}, {[row[2] for row in rows[1:]]} != {wanted}")
    record(run, "csvStats-real", not problems, {"summary": f"{len(values)} samples: summary, moving window {window} and "
           f"{bins}-bin histogram equal the independent computations" if not problems else "; ".join(problems)})


CASES = {"unarchivedPVs": unarchived_pvs_cases, "archivedPVsNotInList": archived_pvs_not_in_list_cases,
         "listTypeChanges": list_type_changes_cases, "checkForEngineActivity": check_for_engine_activity_cases,
         "checkConnectedPVs": check_connected_pvs_cases, "checkTypeChangedPVs": check_type_changed_pvs_cases,
         "storageSizeCheck": storage_size_check_cases, "getDataToCsv": get_data_to_csv_cases,
         "csvStats": csv_stats_cases, "documentedData": documented_data_cases, "documented": documented_cases}
# Cases that need the type-change report to be empty; they run before any case changes a type.
EMPTY_TYPE_REPORT_CASES = {"listTypeChanges": list_type_changes_empty, "checkTypeChangedPVs": check_type_changed_pvs_empty}


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
    # The documented commands run first, before any case makes a type change.
    scripts = sorted(args.script or CASES, key=lambda name: (name != "documented", name))
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
    run = Run(root, env, bpl, prefix, pvs, retrieval=f"http://127.0.0.1:{args.port_base + 3}/retrieval")
    app = ioc = None
    print(f"Evidence: {root}", flush=True)
    wars = sorted(args.war_dir.resolve().glob("*.war"))
    save(root, "manifest.json", {
        "observed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip(),
        "original_commit": ORIGINAL_COMMIT, "scripts": scripts, "python": sys.version,
        "replacements": {name: digest(SAMPLES / f"{name}.bash") for name in scripts if not name.startswith("documented")},
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
            if name in EMPTY_TYPE_REPORT_CASES:
                EMPTY_TYPE_REPORT_CASES[name](run)
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
