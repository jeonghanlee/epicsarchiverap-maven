"""Run shipped CLI subprocesses against the controlled outer HTTP boundary."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from urllib.parse import parse_qs, urlsplit

REPO = Path(__file__).resolve().parents[3]
SAMPLES = REPO / "docs/book/src/samples"


class ArchiveStatusClientTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.file = Path(self.folder.name) / "pvs.txt"
        self.file.write_text("TEST:A\nTEST:B\n", encoding="utf-8")
        self.requests = []
        self.aliases = []
        self.types = {}
        self.states = {}
        self.archive = {}
        self.delay = 0
        self.raw = None
        self.http_code = 200
        self.truncated = False
        case = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.respond()

            def do_POST(self):
                self.respond()

            def respond(self):
                url = urlsplit(self.path)
                action = url.path.rsplit("/", 1)[-1]
                params = parse_qs(url.query)
                payload = json.loads(self.rfile.read(int(self.headers["Content-Length"]))) if self.command == "POST" else None
                case.requests.append((self.command, action, params, payload))
                code = 200
                if action == "getAllAliases":
                    body = case.aliases
                elif action == "getPVTypeInfo":
                    name = params["pv"][0]
                    code, body = case.types.get(name, (404, {}))
                elif action == "getPVStatus":
                    name = params["pv"][0]
                    body = case.states.get(name, [{"pvName": name, "status": "Not being archived"}])
                else:
                    name = payload[0]["pv"]
                    body = case.archive.get(name, [{"pvName": name, "status": "Archive request submitted"}])
                    self.assert_content_type()
                data = json.dumps(body).encode()
                if action in ("archivePV", "getPVStatus"):
                    time.sleep(case.delay)
                    code = case.http_code
                    if case.raw is not None:
                        data = case.raw
                try:
                    self.send_response(code)
                    self.send_header("Content-Length", str(len(data) + (10 if case.truncated else 0)))
                    self.end_headers()
                    self.wfile.write(data)
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def assert_content_type(self):
                case.assertEqual(self.headers["Content-Type"], "application/json")

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}/mgmt/bpl"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.folder.cleanup()

    def cli(self, script="archivePVList.py", *options, file=None, url=None):
        return subprocess.run([sys.executable, str(SAMPLES / script), url or self.url,
                               str(file or self.file), *options], capture_output=True, text=True,
                              timeout=8, env={**os.environ, "NO_PROXY": "*", "no_proxy": "*",
                                              "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "ascii"})

    def assert_result(self, result, code, message=""):
        self.assertEqual(result.returncode, code, result.stderr)
        self.assertNotIn("Traceback", result.stderr)
        if message:
            self.assertIn(message, result.stderr)
        elif code == 0:
            self.assertEqual(result.stderr, "")

    def test_archive_table_and_explicit_parameters(self):
        result = self.cli("archivePVList.py", "--sampling-method", "SCAN", "--sampling-period", "2.5")
        self.assert_result(result, 0)
        expected = "\n".join((
            "-------   -------------------------", "PV Name   Status", "-------   -------------------------",
            "TEST:A    Archive request submitted", "TEST:B    Archive request submitted",
            "-------   -------------------------", "Total 2   Successful 2   Failed 0", ""))
        self.assertEqual(result.stdout, expected)
        posts = [r[3] for r in self.requests if r[0] == "POST"]
        self.assertEqual(posts, [[{"pv": pv, "samplingmethod": "SCAN", "samplingperiod": "2.5"}]
                                for pv in ("TEST:A", "TEST:B")])

    def test_status_order_and_unknown_success(self):
        self.file.write_text("TEST:B\nTEST:A\nTEST:B\n")
        self.states["TEST:A"] = [{"pvName": "TEST:A", "status": "Initial sampling"}]
        result = self.cli("getPVStatus.py")
        self.assert_result(result, 0)
        self.assertIn("Total 3   Successful 3   Failed 0", result.stdout)
        rows = [line.split("   ", 1)[0].strip() for line in result.stdout.splitlines() if line.startswith("TEST:")]
        self.assertEqual(rows, ["TEST:B", "TEST:A", "TEST:B"])
        self.assertTrue(all(r[0] == "GET" for r in self.requests))

    def test_sampling_value_is_normalized_for_java(self):
        result = self.cli("archivePVList.py", "--sampling-period", "1_0")
        self.assert_result(result, 0)
        posts = [r[3] for r in self.requests if r[0] == "POST"]
        self.assertTrue(posts)
        self.assertEqual([p[0]["samplingperiod"] for p in posts], ["10.0", "10.0"])

    def test_all_known_statuses_are_query_success(self):
        for status in ("Not being archived", "Initial sampling", "Appliance assigned", "Being archived", "Paused", "Appliance Down"):
            with self.subTest(status=status):
                self.states["TEST:A"] = [{"pvName": "TEST:A", "status": status}]
                self.assert_result(self.cli("getPVStatus.py"), 0)

    def test_already_submitted_and_empty_validation(self):
        self.archive["TEST:A"] = [{"pvName": "TEST:A", "status": "Already submitted", "validation": ""}]
        result = self.cli()
        self.assert_result(result, 0)
        self.assertIn("Already submitted", result.stdout)

    def test_batch_rejection_in_each_position(self):
        self.file.write_text("TEST:A\nTEST:B\nTEST:C\n")
        for name in ("TEST:A", "TEST:B", "TEST:C"):
            with self.subTest(name=name):
                self.archive = {name: [{"pvName": name, "validation": "rejected by API"}]}
                self.requests.clear()
                result = self.cli()
                self.assert_result(result, 1, "rejected by API")
                self.assertIn("Total 3   Successful 2   Failed 1", result.stdout)
                self.assertEqual(len([r for r in self.requests if r[0] == "POST"]), 3)

    def test_bad_responses_fail_and_continue(self):
        for script in ("archivePVList.py", "getPVStatus.py"):
            for body in (None, {}, [], [None], [{"pvName": "OTHER", "status": "Being archived"}],
                         [{"pvName": "TEST:A", "status": "unexpected"}],
                         [{"pvName": "TEST:A", "status": "bad\nrow"}],
                         [{"pvName": "TEST:A", "status": "\udcff"}],
                         [{"pvName": "TEST:A", "status": "Being archived", "validation": False}]):
                with self.subTest(script=script, body=body):
                    self.raw = json.dumps(body).encode()
                    result = self.cli(script)
                    self.assert_result(result, 1, "error:")
                    self.assertIn("Successful 0   Failed 2", result.stdout)

    def test_malformed_json_and_http_failure(self):
        for script in ("archivePVList.py", "getPVStatus.py"):
            for code, raw in ((200, b"["), (500, b"failure"), (204, b"")):
                with self.subTest(script=script, code=code):
                    self.http_code, self.raw = code, raw
                    result = self.cli(script)
                    self.assert_result(result, 1)
                    self.assertIn("Outcome unknown" if script.startswith("archive") else "Query failed", result.stdout)

    def test_truncated_response(self):
        self.truncated = True
        for script in ("archivePVList.py", "getPVStatus.py"):
            self.assert_result(self.cli(script), 1, "incomplete response")

    def test_connection_refused(self):
        with socket.socket() as bound:
            bound.bind(("127.0.0.1", 0))
            url = f"http://127.0.0.1:{bound.getsockname()[1]}/mgmt/bpl"
            for script in ("archivePVList.py", "getPVStatus.py"):
                self.assert_result(self.cli(script, url=url), 1, "request failed")

    def test_timeout_is_bounded_and_not_retried(self):
        self.file.write_text("TEST:A\n")
        self.delay = 10
        for script in ("archivePVList.py", "getPVStatus.py"):
            self.requests.clear()
            started = time.monotonic()
            result = self.cli(script, "--timeout", "1")
            self.assert_result(result, 1, "timed out")
            self.assertLess(time.monotonic() - started, 5)
            self.assertEqual(len([r for r in self.requests if r[1] in ("archivePV", "getPVStatus")]), 1)

    def test_invalid_inputs_send_no_http(self):
        for script in ("archivePVList.py", "getPVStatus.py"):
            for data in ("", " \n", "TEST:A\nTEST:*\n", "TEST:A,TEST:B\n", "TEST:A\x00\n", "TEST:\u00e9\n"):
                with self.subTest(script=script, data=data):
                    self.file.write_text(data)
                    self.assert_result(self.cli(script), 2)
        self.assertEqual(self.requests, [])

    def test_bad_file_and_url_send_no_http(self):
        for script in ("archivePVList.py", "getPVStatus.py"):
            self.assert_result(self.cli(script, file=self.file.parent / "missing"), 2)
            self.assert_result(self.cli(script, url=self.url + "?query=1"), 2)
        self.file.write_bytes(b"\xff")
        self.assert_result(self.cli(), 2)
        self.assertEqual(self.requests, [])

    def test_numeric_arguments_send_no_http(self):
        for value in ("nan", "inf", "0", "-1", "1e100", "1e-100", "bad"):
            with self.subTest(value=value):
                self.assert_result(self.cli("archivePVList.py", "--sampling-period", value), 2)
        for value in ("nan", "0", "86400.1", "1e300"):
            self.assert_result(self.cli("getPVStatus.py", "--timeout", value), 2)
        self.assert_result(self.cli("archivePVList.py", "--sampling-method", "BAD"), 2)
        self.assertEqual(self.requests, [])

    def test_whitespace_crlf_and_hash_name(self):
        self.file.write_bytes(b"  TEST:#A \r\n\r\n TEST:B\r\n")
        result = self.cli("getPVStatus.py")
        self.assert_result(result, 0)
        self.assertIn("TEST:#A", result.stdout)
        self.assertIn("Total 2", result.stdout)

    def test_duplicate_normalized_and_record_inputs_send_no_http(self):
        for names in (("TEST:A", "TEST:A"), ("TEST:A", "TEST:A.VAL"),
                      ("ca://TEST:A", "pva://TEST:A"), ("TEST:A", "TEST:A.DESC")):
            with self.subTest(names=names):
                self.file.write_text("\n".join(names))
                self.assert_result(self.cli(), 2, "lines 1 and 2")
        self.assertEqual(self.requests, [])

    def test_alias_overlap_sends_no_mutation(self):
        self.aliases = [{"aliasName": "TEST:B", "srcPVName": "TEST:A"}]
        self.assert_result(self.cli(), 2, "overlapping")
        self.assertFalse(any(r[0] == "POST" for r in self.requests))

    def test_alias_single_input_uses_existing_target(self):
        self.file.write_text("TEST:B\n")
        self.aliases = [{"aliasName": "TEST:B", "srcPVName": "TEST:A"}]
        self.types["TEST:A"] = (200, {"pvName": "TEST:A"})
        self.archive["TEST:A"] = [{"pvName": "TEST:A", "status": "Already submitted"}]
        result = self.cli()
        self.assert_result(result, 0)
        self.assertIn("TEST:B", result.stdout)
        self.assertEqual([r[3][0]["pv"] for r in self.requests if r[0] == "POST"], ["TEST:A"])

    def test_preflight_failure_sends_no_mutation(self):
        for code, body in ((500, {}), (200, []), (200, {"pvName": "OTHER"})):
            with self.subTest(code=code, body=body):
                self.types["TEST:A"] = (code, body)
                self.assert_result(self.cli(), 1, "no archive requests sent")
        self.assertFalse(any(r[0] == "POST" for r in self.requests))

    def test_invalid_alias_response_sends_no_mutation(self):
        for body in ({}, [None], [{"aliasName": "TEST:A", "srcPVName": "TEST:A"}]):
            self.aliases = body
            self.assert_result(self.cli(), 1)
        self.assertFalse(any(r[0] == "POST" for r in self.requests))


if __name__ == "__main__":
    unittest.main()
