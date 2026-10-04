"""Exercise the shipped unarchivedPVs.bash with only the outer HTTP boundary controlled."""

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
SCRIPT = REPO / "docs/book/src/samples/unarchivedPVs.bash"


class UnarchivedPVsBashTest(unittest.TestCase):
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

    def test_prints_original_rows_sorted_last_row_winning(self):
        path = self.csv("TEST:b,first\nTEST:a , meta\n\nTEST:known\nTEST:b,second\nTEST:B\n")
        self.body = json.dumps(["TEST:b", "TEST:a", "TEST:B"]).encode()
        result = self.cli(self.url, str(path))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "TEST:B\nTEST:a , meta\nTEST:b,second\n")
        self.assertEqual(result.stderr, "")
        path_sent, content_type, body = self.requests[0]
        self.assertEqual(path_sent, "/mgmt/bpl/unarchivedPVs")
        self.assertEqual(content_type, "application/json")
        self.assertEqual(json.loads(body), ["TEST:b", "TEST:a", "TEST:known", "TEST:b", "TEST:B"])

    def test_all_known_prints_nothing(self):
        result = self.cli("--timeout", "5", self.url, str(self.csv("TEST:a\n")))
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_empty_file_sends_an_empty_array(self):
        result = self.cli(self.url, str(self.csv("\n  \n")))
        self.assertEqual((result.returncode, result.stdout), (0, ""))
        self.assertEqual(json.loads(self.requests[0][2]), [])

    def test_runs_through_a_symlink_and_reads_a_pipe(self):
        link = self.dir / "link.bash"
        link.symlink_to(SCRIPT)
        self.body = b'["TEST:a"]'
        result = subprocess.run(["bash", "-c", 'exec "$0" "$1" <(printf "TEST:a,x\\n")', str(link), self.url],
                                text=True, capture_output=True, timeout=10, env=self.env)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "TEST:a,x\n")

    def test_help_goes_to_stdout_with_exit_0(self):
        result = self.cli("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage: unarchivedPVs.bash [--timeout SEC] BPL_URL FILE", result.stdout)
        self.assertIn("first column of each row is a PV name", result.stdout)
        self.assertEqual(result.stderr, "")

    def test_invalid_arguments_and_input_exit_2_before_http(self):
        cases = [
            ((self.url,), "usage:"),
            (("http://host/mgmt", str(self.csv("TEST:a\n"))), "BPL URL must be"),
            (("--timeout", "0", self.url, str(self.csv("TEST:a\n"))), "timeout must be"),
            (("--bogus", self.url, str(self.csv("TEST:a\n"))), "unknown option"),
            ((self.url, str(self.dir / "absent.csv")), "cannot read PV file"),
            ((self.url, str(self.dir)), "cannot read PV file"),
            ((self.url, str(self.csv(",meta\n"))), "line 1: the first column is empty"),
        ]
        for args, message in cases:
            result = self.cli(*args)
            self.assert_failure(result, message, code=2)
        self.assertEqual(self.requests, [])

    def test_http_error_exits_1(self):
        self.status = 500
        self.assert_failure(self.cli(self.url, str(self.csv("TEST:a\n"))), "HTTP 500")

    def test_malformed_or_foreign_response_exits_1(self):
        for body in (b'["TEST:a"', b'{"TEST:a": 1}', b'["TEST:other"]', b'[1]', b'["TEST:a"] ["TEST:a"]'):
            self.body = body
            self.assert_failure(self.cli(self.url, str(self.csv("TEST:a\n"))), "expected a JSON array of input names")

    def test_timeout_exits_1(self):
        self.delay = 2
        self.assert_failure(self.cli("--timeout", "0.5", self.url, str(self.csv("TEST:a\n"))), "timed out")


if __name__ == "__main__":
    unittest.main()
