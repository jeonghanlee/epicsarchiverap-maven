"""Exercise the shipped checkTypeChangedPVs.bash with only the outer HTTP boundary controlled."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import threading
import time
import unittest

REPO = Path(__file__).resolve().parents[3]
SCRIPT = REPO / "docs/book/src/samples/checkTypeChangedPVs.bash"


class CheckTypeChangedPVsBashTest(unittest.TestCase):
    def setUp(self):
        self.status = 200
        self.body = b"[]"
        self.delay = 0
        self.requests = []
        case = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                case.requests.append(self.path)
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
        self.env = dict(os.environ, NO_PROXY="*", no_proxy="*")

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def cli(self, *args):
        return subprocess.run([str(SCRIPT), *args], text=True, capture_output=True, timeout=10, env=self.env)

    def test_empty_report_exits_0(self):
        result = self.cli(self.url)
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "No PVs have changed type\n", ""))
        self.assertEqual(self.requests, ["/mgmt/bpl/getPVsByDroppedEventsTypeChange"])

    def test_changed_pvs_are_listed_in_report_order_and_exit_1(self):
        self.body = json.dumps([{"pvName": "TEST:z", "eventsDropped": "9"}, {"pvName": "TEST:a", "eventsDropped": "1"}]).encode()
        result = self.cli(self.url)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "2 PVs have changed type\nTEST:z\nTEST:a\n")
        self.assertEqual(result.stderr, "")

    def test_failures_exit_3(self):
        self.status = 500
        self.assertEqual(self.cli(self.url).returncode, 3)
        self.status = 200
        for body in (b"[", b'{"pvName": "x"}', b'[{"pvName": ""}]', b'[{"eventsDropped": "1"}]'):
            self.body = body
            result = self.cli(self.url)
            self.assertEqual((result.returncode, result.stdout), (3, ""), body)
        self.delay = 2
        result = self.cli("--timeout", "0.5", self.url)
        self.assertEqual(result.returncode, 3)
        self.assertIn("timed out", result.stderr)

    def test_usage_help_and_invalid_arguments_exit_2(self):
        result = self.cli("-h")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage: checkTypeChangedPVs.bash [--timeout SEC] BPL_URL", result.stdout)
        for args in ((), ("http://host/mgmt",), ("--timeout", "-1", self.url), (self.url, "extra")):
            result = self.cli(*args)
            self.assertEqual(result.returncode, 2, args)
            self.assertEqual(result.stdout, "")
        self.assertEqual(self.requests, [])


if __name__ == "__main__":
    unittest.main()
