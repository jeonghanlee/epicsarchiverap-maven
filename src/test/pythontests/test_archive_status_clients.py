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
        self.truncated_action = None
        case = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.respond()

            def do_POST(self):
                self.respond()

            def respond(self):
                url = urlsplit(self.path)
                action = url.path.rsplit("/", 1)[-1]
                params = parse_qs(url.query, keep_blank_values=True)
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
                    truncated = case.truncated or case.truncated_action == action
                    self.send_header("Content-Length", str(len(data) + (10 if truncated else 0)))
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

    def cli(self, script="archivePVList.bash", *options, file=None, url=None, env=None):
        return subprocess.run(["bash" if script.endswith(".bash") else sys.executable, str(SAMPLES / script), url or self.url,
                               str(file or self.file), *options], capture_output=True, text=True,
                              timeout=8, env={**os.environ, "NO_PROXY": "*", "no_proxy": "*",
                                              "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "ascii",
                                              **(env or {})})

    def assert_result(self, result, code, message=""):
        self.assertEqual(result.returncode, code, result.stderr)
        self.assertNotIn("Traceback", result.stderr)
        if message:
            self.assertIn(message, result.stderr)
        elif code == 0:
            self.assertEqual(result.stderr, "")

    def test_archive_table_and_explicit_parameters(self):
        result = self.cli("archivePVList.bash", "--sampling-method", "SCAN", "--sampling-period", "2.5")
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
        result = self.cli("archivePVList.bash", "--sampling-period", "1_0")
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
        for script in ("archivePVList.bash", "getPVStatus.py"):
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
        for script in ("archivePVList.bash", "getPVStatus.py"):
            for code, raw in ((200, b"["), (500, b"failure"), (204, b"")):
                with self.subTest(script=script, code=code):
                    self.http_code, self.raw = code, raw
                    result = self.cli(script)
                    self.assert_result(result, 1)
                    self.assertIn("Outcome unknown" if script.startswith("archive") else "Query failed", result.stdout)

    def test_truncated_response(self):
        self.truncated = True
        for script in ("archivePVList.bash", "getPVStatus.py"):
            self.assert_result(self.cli(script), 1, "request failed" if script.endswith(".bash") else "incomplete response")

    def test_connection_refused(self):
        with socket.socket() as bound:
            bound.bind(("127.0.0.1", 0))
            url = f"http://127.0.0.1:{bound.getsockname()[1]}/mgmt/bpl"
            for script in ("archivePVList.bash", "getPVStatus.py"):
                self.assert_result(self.cli(script, url=url), 1, "request failed")

    def test_timeout_is_bounded_and_not_retried(self):
        self.file.write_text("TEST:A\n")
        self.delay = 10
        for script in ("archivePVList.bash", "getPVStatus.py"):
            self.requests.clear()
            started = time.monotonic()
            result = self.cli(script, "--timeout", "1")
            self.assert_result(result, 1, "timed out")
            self.assertLess(time.monotonic() - started, 5)
            self.assertEqual(len([r for r in self.requests if r[1] in ("archivePV", "getPVStatus")]), 1)

    def test_invalid_inputs_send_no_http(self):
        for script in ("archivePVList.bash", "getPVStatus.py"):
            for data in ("", " \n", "TEST:A\nTEST:*\n", "TEST:A,TEST:B\n", "TEST:A\x00\n", "TEST:\u00e9\n"):
                with self.subTest(script=script, data=data):
                    self.file.write_text(data)
                    self.assert_result(self.cli(script), 2)
        self.assertEqual(self.requests, [])

    def test_bad_file_and_url_send_no_http(self):
        for script in ("archivePVList.bash", "getPVStatus.py"):
            self.assert_result(self.cli(script, file=self.file.parent / "missing"), 2)
            self.assert_result(self.cli(script, url=self.url + "?query=1"), 2)
        self.file.write_bytes(b"\xff")
        self.assert_result(self.cli(), 2)
        self.assertEqual(self.requests, [])

    def test_numeric_arguments_send_no_http(self):
        for value in ("nan", "inf", "0", "-1", "1e100", "1e-100", "bad"):
            with self.subTest(value=value):
                self.assert_result(self.cli("archivePVList.bash", "--sampling-period", value), 2)
        for value in ("nan", "0", "86400.1", "1e300"):
            self.assert_result(self.cli("getPVStatus.py", "--timeout", value), 2)
        self.assert_result(self.cli("archivePVList.bash", "--sampling-method", "BAD"), 2)
        self.assertEqual(self.requests, [])

    def test_whitespace_crlf_and_hash_name(self):
        self.file.write_bytes(b"  TEST:#A \r\n\r\n TEST:B\r\n")
        for script in ("archivePVList.bash", "getPVStatus.py"):
            with self.subTest(script=script):
                result = self.cli(script)
                self.assert_result(result, 0)
                self.assertIn("TEST:#A", result.stdout)
                self.assertIn("Total 2", result.stdout)

    def test_cr_only_and_mixed_line_endings(self):
        for data in (b"TEST:A\rTEST:B\r", b"TEST:A\r\n\rTEST:B\n", b"TEST:A\rTEST:A\r"):
            with self.subTest(data=data):
                self.requests.clear()
                self.file.write_bytes(data)
                duplicate = data == b"TEST:A\rTEST:A\r"
                result = self.cli()
                self.assert_result(result, 2 if duplicate else 0, "lines 1 and 2" if duplicate else "")
                self.assertEqual([r[3][0]["pv"] for r in self.requests if r[0] == "POST"],
                                 [] if duplicate else ["TEST:A", "TEST:B"])

    def test_control_characters_cannot_turn_failure_into_success(self):
        self.file.write_text("TEST:A\n")
        for row, status in (({"pvName": "TEST:A", "status": "Archive request submitted\n"}, "Outcome unknown"),
                            ({"pvName": "TEST:A\n", "status": "Archive request submitted"}, "Outcome unknown"),
                            ({"pvName": "TEST:A", "status": "Archive request submitted", "validation": "\n"}, "Rejected"),
                            ({"pvName": "TEST:A", "status": "Archive request submitted", "validation": "\x00"}, "Rejected")):
            with self.subTest(row=row):
                self.requests.clear()
                self.raw = json.dumps([row]).encode()
                result = self.cli()
                self.assert_result(result, 1)
                self.assertIn(status, result.stdout)
                self.assertIn("Successful 0   Failed 1", result.stdout)
                self.assertNotIn("ignored null byte", result.stderr)
                self.assertEqual(len([r for r in self.requests if r[0] == "POST"]), 1)

    def test_alias_backslash_names_and_targets_are_preserved(self):
        for alias, target in (("TEST:\\ALIAS", "TEST:A"), ("TEST:ALIAS", "TEST:\\A")):
            with self.subTest(alias=alias, target=target):
                self.requests.clear()
                self.file.write_text(alias + "\n")
                self.aliases = [{"aliasName": alias, "srcPVName": target}]
                self.types = {target: (200, {"pvName": target})}
                self.assert_result(self.cli(), 0)
                self.assertEqual([r[3][0]["pv"] for r in self.requests if r[0] == "POST"], [target])

    def test_alias_backslash_overlap_sends_no_mutation(self):
        self.file.write_text("TEST:\\A\nTEST:ALIAS\n")
        self.aliases = [{"aliasName": "TEST:ALIAS", "srcPVName": "TEST:\\A"}]
        self.assert_result(self.cli(), 2, "overlapping")
        self.assertFalse(any(r[0] == "POST" for r in self.requests))

    def test_submillisecond_timeout_stays_bounded(self):
        self.file.write_text("TEST:A\n")
        self.delay = 1.25
        for timeout in ("0.0001", "1e-6", "1e-100"):
            with self.subTest(timeout=timeout):
                self.requests.clear()
                started = time.monotonic()
                result = self.cli("archivePVList.bash", "--timeout", timeout)
                self.assert_result(result, 1, "timed out after 0.001 seconds")
                self.assertLess(time.monotonic() - started, 1)
                self.assertTrue(self.requests)
                self.assertLessEqual(len([r for r in self.requests if r[0] == "POST"]), 1)

    def test_fractional_timeout_rounds_up_to_milliseconds(self):
        self.file.write_text("TEST:A\n")
        self.delay = 1.25
        result = self.cli("archivePVList.bash", "--timeout", "0.2501")
        self.assert_result(result, 1, "timed out after 0.251 seconds")
        self.assertEqual(len([r for r in self.requests if r[0] == "POST"]), 1)

    def test_curl_config_does_not_retry_posts(self):
        self.file.write_text("TEST:A\n")
        self.http_code = 503
        (self.file.parent / ".curlrc").write_text("retry = 1\nretry-delay = 1\n")
        result = self.cli(env={"CURL_HOME": str(self.file.parent)})
        self.assert_result(result, 1, "HTTP 503")
        self.assertEqual(len([r for r in self.requests if r[0] == "POST"]), 1)

    def test_sampling_float32_boundaries(self):
        self.file.write_text("TEST:A\n")
        for value in ("1e-45", "3.4028234663852886e38", "+.25", "0.000_1"):
            with self.subTest(value=value):
                self.assert_result(self.cli("archivePVList.bash", "--sampling-period=" + value), 0)
                self.assertEqual(float(self.requests[-1][3][0]["samplingperiod"]), float(value.replace("_", "")))
        self.requests.clear()
        for value in ("7.006492321624085e-46", "7.006492321624086e-46", "3.4028235677973366e38"):
            with self.subTest(value=value):
                self.assert_result(self.cli("archivePVList.bash", "--sampling-period", value), 2)
        self.assertEqual(self.requests, [])

    def test_protocol_and_val_target_preserved(self):
        for target in ("ca://TEST:A", "pva://TEST:A.VAL", "TEST:A.DESC"):
            with self.subTest(target=target):
                self.file.write_text(target + "\n")
                self.archive[target] = [{"pvName": "TEST:A", "status": "Archive request submitted"}]
                self.assert_result(self.cli(), 0)
                self.assertEqual(self.requests[-1][3][0]["pv"], target)

    def test_empty_normalized_identity_does_not_crash(self):
        self.file.write_text(".VAL\n")
        result = self.cli()
        self.assert_result(result, 1, "another PV")
        self.assertNotIn("bad array subscript", result.stderr)
        self.assertEqual(self.requests[-1][3][0]["pv"], ".VAL")

    def test_truncated_type_info_404_is_not_unknown_pv(self):
        self.truncated_action = "getPVTypeInfo"
        self.assert_result(self.cli(), 1, "no archive requests sent")
        self.assertFalse(any(r[0] == "POST" for r in self.requests))

    def test_later_type_info_failure_after_404_sends_no_mutation(self):
        self.types["TEST:B"] = (500, {})
        self.assert_result(self.cli(), 1, "HTTP 500")
        self.assertEqual([r[2]["pv"][0] for r in self.requests if r[1] == "getPVTypeInfo"],
                         ["TEST:A", "TEST:B"])
        self.assertFalse(any(r[0] == "POST" for r in self.requests))

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
        for body in ({}, [None], [{"aliasName": "TEST:A", "srcPVName": "TEST:A"}],
                     [{"aliasName": "TEST:A", "srcPVName": "OTHER"}] * 2,
                     [{"aliasName": "TEST:A", "srcPVName": "TEST:B"},
                      {"aliasName": "TEST:B", "srcPVName": "TEST:A"}]):
            self.aliases = body
            self.assert_result(self.cli(), 1)
        self.assertFalse(any(r[0] == "POST" for r in self.requests))


if __name__ == "__main__":
    unittest.main()
