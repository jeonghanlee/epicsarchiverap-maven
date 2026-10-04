"""Exercise the shipped archivedPVsNotInList.bash with only the outer HTTP boundary controlled."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import unittest

REPO = Path(__file__).resolve().parents[3]
SCRIPT = REPO / "docs/book/src/samples/archivedPVsNotInList.bash"


class ArchivedPVsNotInListBashTest(unittest.TestCase):
    def setUp(self):
        self.body = b'[]'
        self.status = 200
        self.delay = 0
        self.requests = []
        case = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                length = int(self.headers.get("Content-Length", "0"))
                case.requests.append((self.path, self.headers.get("Content-Type"), self.rfile.read(length)))
                time.sleep(case.delay)
                try:
                    self.send_response(case.status)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(case.body)))
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
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.env = dict(os.environ, NO_PROXY="*", no_proxy="*")

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.tmp.cleanup()

    def csv(self, text):
        path = self.dir / "pvs.csv"
        path.write_text(text)
        return path

    def cli(self, *args):
        return subprocess.run([str(SCRIPT), *args], text=True, capture_output=True, timeout=10, env=self.env)

    def assert_failure(self, result, message, code=1):
        self.assertEqual(result.returncode, code, result.stderr)
        self.assertEqual(result.stdout, "")
        self.assertIn(message, result.stderr)

    def test_prints_returned_names_in_byte_order(self):
        self.body = json.dumps(["TEST:z", "TEST:B", "TEST:a"]).encode()
        result = self.cli(self.url, str(self.csv("TEST:in , meta\n\nTEST:other\n")))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "TEST:B\nTEST:a\nTEST:z\n")
        self.assertEqual(result.stderr, "")
        path, content_type, body = self.requests[0]
        self.assertEqual((path, content_type), ("/mgmt/bpl/archivedPVsNotInList", "application/json"))
        self.assertEqual(json.loads(body), ["TEST:in", "TEST:other"])

    def test_nothing_missing_prints_nothing(self):
        result = self.cli(self.url, str(self.csv("TEST:a\n")))
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_help_goes_to_stdout_with_exit_0(self):
        result = self.cli("-h")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage: archivedPVsNotInList.bash [--timeout SEC] BPL_URL FILE", result.stdout)
        self.assertEqual(result.stderr, "")

    def test_invalid_arguments_and_input_exit_2_before_http(self):
        cases = [
            ((self.url,), "usage:"),
            (("http://host/mgmt", str(self.csv("TEST:a\n"))), "BPL URL must be"),
            (("--timeout", "x", self.url, str(self.csv("TEST:a\n"))), "timeout must be"),
            ((self.url, str(self.csv("\n \n"))), "PV file contains no names"),
            ((self.url, str(self.dir / "absent.csv")), "cannot read PV file"),
        ]
        for args, message in cases:
            self.assert_failure(self.cli(*args), message, code=2)
        self.assertEqual(self.requests, [])

    def test_http_error_exits_1(self):
        self.status = 400
        self.assert_failure(self.cli(self.url, str(self.csv("TEST:a\n"))), "HTTP 400")

    def test_malformed_or_contradictory_response_exits_1(self):
        for body in (b'["TEST:x"', b'{"TEST:x": 1}', b'["TEST:a"]', b'[""]', b'[1]'):
            self.body = body
            self.assert_failure(self.cli(self.url, str(self.csv("TEST:a\n"))), "expected a JSON array of PV names")

    def test_timeout_exits_1(self):
        self.delay = 2
        self.assert_failure(self.cli("--timeout", "0.5", self.url, str(self.csv("TEST:a\n"))), "timed out")


if __name__ == "__main__":
    unittest.main()
