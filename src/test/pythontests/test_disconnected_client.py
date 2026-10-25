"""Execute the shipped report CLI; control only the outer management HTTP boundary."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
import unittest

REPO = Path(__file__).resolve().parents[3]
SCRIPT = REPO / "docs/book/src/samples/printCurrentlyDisconnectedPVs.py"


def row(pv="TEST:A", instance="appliance0", lost="N/A"):
    return {"pvName": pv, "instance": instance, "connectionLostAt": lost, "lastKnownEvent": "Never",
            "noConnectionAsOfEpochSecs": "0", "hostName": "N/A", "commandThreadID": "1"}


class DisconnectedClientTest(unittest.TestCase):
    def setUp(self):
        self.body = []
        self.raw = None
        self.code, self.delay = 200, 0
        self.close, self.truncated = False, False
        self.requests, self.executions = [], []
        case = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                case.requests.append({"method": self.command, "path": self.path})
                try:
                    if case.close:
                        self.close_connection = True
                        return
                    if case.delay:
                        time.sleep(case.delay)
                    body = case.raw if case.raw is not None else json.dumps(case.body).encode("utf-8")
                    self.send_response(case.code)
                    self.send_header("Content-Type", "application/json;charset=UTF-8")
                    self.send_header("Content-Length", str(len(body) + (20 if case.truncated else 0)))
                    self.end_headers()
                    self.wfile.write(body)
                    self.close_connection = True
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.server.server_port}/mgmt/bpl"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        evidence = REPO / "work/disconnected-client-evidence"
        evidence.mkdir(parents=True, exist_ok=True)
        (evidence / (self._testMethodName + ".json")).write_text(json.dumps({
            "requests": self.requests, "executions": self.executions}, indent=2))

    def cli(self, *options, url=None, encoding="utf-8", closed_stdout=False):
        command = [sys.executable, str(SCRIPT), url or self.url, *options]
        began = time.monotonic()
        env = {**os.environ, "NO_PROXY": "*", "no_proxy": "*",
               "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": encoding}
        if closed_stdout:
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
            process.stdout.close()
            process.stdout = None
            try:
                _, stderr = process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate(timeout=5)
                raise
            result = subprocess.CompletedProcess(command, process.returncode, b"", stderr)
        else:
            result = subprocess.run(command, capture_output=True, timeout=5, env=env)
        result.stdout = result.stdout.decode(encoding)
        result.stderr = result.stderr.decode(encoding)
        self.executions.append({"command": command, "encoding": encoding, "exit": result.returncode,
                                "stdout": result.stdout, "stderr": result.stderr,
                                "elapsed": time.monotonic() - began, "requests": list(self.requests),
                                "stdout_reader_closed": closed_stdout})
        return result

    def failure(self, result, text=None):
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertEqual(result.stdout, "")
        self.assertIn("disconnection report unavailable", result.stderr)
        self.assertNotIn("Traceback", result.stderr)
        if text:
            self.assertIn(text, result.stderr)

    def test_empty_and_method_path(self):
        result = self.cli()
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))
        self.assertEqual(self.requests, [{"method": "GET", "path": "/mgmt/bpl/getCurrentlyDisconnectedPVs"}])

    def test_sorted_case_preserving_groups(self):
        self.body = [row("Test:z", "b", "later"), row("TEST:z", "a", "Never"), row("TEST:A", "a")]
        result = self.cli()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "Appliance a:\nTEST:A N/A\nTEST:z Never\nAppliance b:\nTest:z later\n")

    def test_literal_filters_and_precedence(self):
        self.body = [row("TEST:A"), row("TEST:B", lost="time")]
        for flags, output in ((["--onlyNA"], "Appliance appliance0:\nTEST:A N/A\n"),
                              (["--noNA"], "Appliance appliance0:\nTEST:B time\n"),
                              (["--onlyNA", "--noNA"], "Appliance appliance0:\nTEST:A N/A\n")):
            result = self.cli(*flags)
            self.assertEqual((result.returncode, result.stdout, result.stderr), (0, output, ""))
        self.body = [row(lost="time")]
        result = self.cli("--onlyNA")
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_invalid_arguments_send_no_requests(self):
        for timeout in ("0", "-1", "nan", "inf", "86401", "text"):
            result = self.cli("--timeout", timeout)
            self.assertEqual(result.returncode, 2)
        for url in ("ftp://127.0.0.1/bpl", self.url + "?x=y", self.url + "#fragment",
                    self.url.replace("http://", "http://user@"), self.url + "/bad"):
            self.assertEqual(self.cli(url=url).returncode, 2)
        self.assertEqual(self.cli("unexpected-pv-file").returncode, 2)
        self.assertEqual(self.requests, [])

    def test_valid_timeout_bounds_and_trailing_slash(self):
        for timeout in ("0.1", "86400"):
            result = self.cli("--timeout", timeout, url=self.url + "/")
            self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_wrong_document_shapes(self):
        for body in (None, {}, 12, True, "text", [None], [12], [{}]):
            self.body = body
            self.failure(self.cli())

    def test_invalid_later_row_has_no_partial_output(self):
        for field in row():
            for value in (None, True, 12, [], {}):
                invalid = row("TEST:B")
                invalid[field] = value
                self.body = [row(), invalid]
                self.failure(self.cli())
        self.body = [row(), {**row("TEST:B", lost="time"), "noConnectionAsOfEpochSecs": "invalid"}]
        for flags in (("--onlyNA",), ("--noNA",)):
            self.failure(self.cli(*flags), "decimal")
        for field in ("pvName", "instance", "connectionLostAt", "lastKnownEvent", "noConnectionAsOfEpochSecs"):
            for missing in (True, False):
                invalid = row("TEST:B")
                if missing:
                    invalid.pop(field)
                else:
                    invalid[field] = ""
                self.body = [row(), invalid]
                self.failure(self.cli())

    def test_duplicate_identity_and_epoch_validation(self):
        self.body = [row(), row()]
        self.failure(self.cli(), "duplicate")
        for epoch in ("-1", "1.0", "+1", " 1", "1e2", "\u0661"):
            self.body = [{**row(), "noConnectionAsOfEpochSecs": epoch}]
            self.failure(self.cli(), "decimal")
        self.body = [row(instance="a"), row(instance="b")]
        self.assertEqual(self.cli().returncode, 0)

    def test_identity_ascii_and_timestamp_controls(self):
        for field in ("pvName", "instance"):
            for value in ("TEST:\u00e9", "name\n", "name\x7f"):
                self.body = [{**row(), field: value}]
                self.failure(self.cli(), "ASCII")
        for field in ("connectionLostAt", "lastKnownEvent"):
            for control in (0, 9, 10, 13, 31, 127, 128, 159, 0x2028, 0x2029):
                self.body = [row(), {**row("TEST:B"), field: "time" + chr(control)}]
                self.failure(self.cli(), "controls")

    def test_actual_formatter_locale_values_and_encoding_failure(self):
        capture = json.loads((REPO / "work/disconnected-locale.json").read_text())
        self.assertEqual(capture["epoch"], 1767225600)
        self.assertEqual(len(capture["rows"]), 3)
        self.assertEqual(capture["source_sha256"], hashlib.sha256((REPO /
            "src/main/org/epics/archiverappliance/common/TimeUtils.java").read_bytes()).hexdigest())
        self.assertEqual(capture["class_sha256"], hashlib.sha256((REPO /
            "target/classes/org/epics/archiverappliance/common/TimeUtils.class").read_bytes()).hexdigest())
        for captured in capture["rows"]:
            self.body = [captured]
            result = self.cli()
            self.assertEqual((result.returncode, result.stdout, result.stderr),
                             (0, f'Appliance appliance0:\n{captured["pvName"]} {captured["connectionLostAt"]}\n', ""))
            if not captured["connectionLostAt"].isascii():
                self.failure(self.cli(encoding="ascii"), "output cannot be encoded as ascii")

    def test_bad_truncated_json_and_http_error(self):
        for payload in (b"not-json", b"[", b"\xff"):
            self.raw = payload
            self.failure(self.cli())
        self.raw = None
        self.truncated = True
        self.failure(self.cli(), "incomplete")
        self.truncated = False
        self.code, self.body = 503, {"status": "error", "desc": "unavailable"}
        self.failure(self.cli(), "HTTP 503")

    def test_connection_loss_is_not_retried(self):
        self.close = True
        self.failure(self.cli())
        self.assertEqual(len(self.requests), 1)

    def test_closed_stdout_exits_one_with_output_diagnostic(self):
        self.body = [row()]
        self.failure(self.cli(closed_stdout=True), "Broken pipe")
        self.assertEqual(len(self.requests), 1)

    def test_closed_port_and_bounded_timeout(self):
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
        self.failure(self.cli(url=f"http://127.0.0.1:{port}/mgmt/bpl"), "request failed")
        self.delay = 10
        self.failure(self.cli("--timeout", "1"), "timed out")
        self.assertLess(self.executions[-1]["elapsed"], 5)
        self.assertEqual(len(self.requests), 1)


if __name__ == "__main__":
    unittest.main()
