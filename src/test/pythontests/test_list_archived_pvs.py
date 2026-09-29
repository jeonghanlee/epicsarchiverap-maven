"""Exercise the shipped CLI with only the outer HTTP boundary controlled."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
import unittest
from urllib.parse import parse_qs, urlsplit

REPO = Path(__file__).resolve().parents[3]
SCRIPT = REPO / "docs/book/src/samples/listArchivedPVs.py"


class ListArchivedPVsTest(unittest.TestCase):
    def setUp(self):
        self.body = b'[]'
        self.status = 200
        self.delay = 0
        self.truncated = False
        self.requests = []
        case = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                case.requests.append(self.path)
                time.sleep(case.delay)
                try:
                    self.send_response(case.status)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(case.body) + (10 if case.truncated else 0)))
                    self.end_headers()
                    self.wfile.write(case.body)
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}/mgmt/bpl"
        self.env = os.environ.copy()
        self.env.update(NO_PROXY="*", no_proxy="*", PYTHONDONTWRITEBYTECODE="1")

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def cli(self, *args, url=None):
        return subprocess.run([sys.executable, str(SCRIPT), url or self.url, *args],
                              text=True, capture_output=True, timeout=5, env=self.env)

    def assert_failure(self, result, message, code=1):
        self.assertEqual(result.returncode, code, result.stderr)
        self.assertEqual(result.stdout, "")
        self.assertIn(message, result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_sorted_unique_complete_listing(self):
        self.body = json.dumps(["TEST:z", "TEST:A", "TEST:z", "TEST:a"]).encode()
        result = self.cli(url=self.url + "/")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "TEST:A\nTEST:a\nTEST:z\n")
        self.assertEqual(result.stderr, "")
        self.assertEqual(self.requests, ["/mgmt/bpl/getAllPVs?limit=-1"])

    def test_glob_and_limit_are_encoded(self):
        result = self.cli("--glob", "TEST:+&?*", "--limit", "7")
        self.assertEqual(result.returncode, 0, result.stderr)
        query = parse_qs(urlsplit(self.requests[0]).query)
        self.assertEqual(query, {"pv": ["TEST:+&?*"], "limit": ["7"]})

    def test_empty_result_is_success(self):
        result = self.cli()
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_malformed_json(self):
        self.body = b'not JSON'
        self.assert_failure(self.cli(), "not valid JSON")

    def test_truncated_response(self):
        self.truncated = True
        self.assert_failure(self.cli(), "error:")

    def test_unpaired_surrogates_never_print_partial_output(self):
        for name in ("\ud800", "\udcff"):
            with self.subTest(name=ascii(name)):
                self.body = json.dumps(["TEST:A", name]).encode()
                self.assert_failure(self.cli(), "error:")

    def test_stdout_encoding_is_checked_before_output(self):
        self.body = json.dumps(["TEST:A", "TEST:\u00e9"]).encode()
        self.env["PYTHONIOENCODING"] = "ascii"
        self.assert_failure(self.cli(), "error:")

    def test_timeout_upper_boundary(self):
        result = self.cli("--timeout", "86400")
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))
        self.requests.clear()
        for value in ("86400.1", "1e300"):
            with self.subTest(value=value):
                self.assert_failure(self.cli("--timeout", value), "error:", code=2)
        self.assertEqual(self.requests, [])

    def test_invalid_structures_never_print_partial_output(self):
        for body in ({"status": "error", "validation": "rejected"}, None, "TEST:A",
                     ["TEST:A", 123], ["TEST:A", ""], ["TEST:A", "TEST:B\nTEST:C"]):
            with self.subTest(body=body):
                self.body = json.dumps(body).encode()
                self.assert_failure(self.cli(), "expected a JSON array")

    def test_http_errors(self):
        for status in (404, 500, 204):
            with self.subTest(status=status):
                self.status = status
                self.assert_failure(self.cli(), f"HTTP {status}")

    def test_timeout(self):
        self.delay = 10
        start = time.monotonic()
        self.assert_failure(self.cli("--timeout", "1"), "timed out")
        self.assertLess(time.monotonic() - start, 5)
        self.assertEqual(len(self.requests), 1)

    def test_connection_refused(self):
        with socket.socket() as bound:
            bound.bind(("127.0.0.1", 0))
            url = f"http://127.0.0.1:{bound.getsockname()[1]}/mgmt/bpl"
            self.assert_failure(self.cli(url=url), "request failed")

    def test_invalid_arguments_make_no_request(self):
        for args in (("--timeout", "nan"), ("--timeout", "inf"), ("--timeout", "0"),
                     ("--timeout", "-1"), ("--timeout", "bad"), ("--limit", "0"),
                     ("--limit", "-2"), ("--limit", "2147483648"), ("--limit", "1.5"),
                     ("--glob", ""), ("--glob", "A\nB")):
            with self.subTest(args=args):
                self.assert_failure(self.cli(*args), "error:", code=2)
        self.assertEqual(self.requests, [])

    def test_invalid_urls_make_no_request(self):
        for url in ("file:///tmp/bpl", "http:///mgmt/bpl", self.url + "?limit=1",
                    self.url + "#fragment", self.url + "/getAllPVs", "http://host:bad/bpl",
                    "http://user:password@host/bpl", "http://host:0/bpl"):
            with self.subTest(url=url):
                self.assert_failure(self.cli(url=url), "BPL base URL", code=2)
        self.assertEqual(self.requests, [])


if __name__ == "__main__":
    unittest.main()
