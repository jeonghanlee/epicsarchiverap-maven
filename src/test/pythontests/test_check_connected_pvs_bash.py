"""Exercise the shipped checkConnectedPVs.bash with only the outer HTTP boundary controlled."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import threading
import time
import unittest

REPO = Path(__file__).resolve().parents[3]
SCRIPT = REPO / "docs/book/src/samples/checkConnectedPVs.bash"


def appliance(name, connected=None, disconnected=None):
    row = {"instance": name, "pvCount": "10"}
    if connected is not None:
        row["connectedPVCount"] = str(connected)
    if disconnected is not None:
        row["disconnectedPVCount"] = str(disconnected)
    return row


class CheckConnectedPVsBashTest(unittest.TestCase):
    def setUp(self):
        self.status = 200
        self.body = json.dumps([appliance("appliance0", 100, 2)]).encode()
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

    def metrics(self, *rows):
        self.body = json.dumps(list(rows)).encode()

    def test_below_threshold_exits_0_silently(self):
        result = self.cli(self.url)
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))
        self.assertEqual(self.requests, ["/mgmt/bpl/getApplianceMetrics"])

    def test_over_threshold_reports_in_the_mail_wording_and_exits_1(self):
        self.metrics(appliance("appliance0", 90, 10), appliance("appliance1", 99, 1))
        result = self.cli("-d", "5", self.url)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertEqual(result.stdout, f"Disconnected PVs in {self.url}\n"
                                        "10 of 100 PVs in appliance appliance0 are in a disconnected state\n")
        self.assertEqual(result.stderr, "")

    def test_negative_threshold_reports_every_appliance_with_pvs(self):
        self.metrics(appliance("appliance0", 5, 0), appliance("empty", 0, 0))
        result = self.cli("-d", "-1", self.url)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout.splitlines()[1:], ["0 of 5 PVs in appliance appliance0 are in a disconnected state"])

    def test_zero_pvs_is_not_an_alert(self):
        self.metrics(appliance("empty", 0, 0))
        result = self.cli(self.url)
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_missing_counts_exit_3_and_alerts_are_still_printed(self):
        self.metrics(appliance("down"), appliance("appliance1", 50, 50))
        result = self.cli(self.url)
        self.assertEqual(result.returncode, 3)
        self.assertIn("metrics unavailable for appliance down", result.stderr)
        self.assertIn("50 of 100 PVs in appliance appliance1", result.stdout)

    def test_empty_report_exits_3(self):
        self.metrics()
        result = self.cli(self.url)
        self.assertEqual((result.returncode, result.stdout), (3, ""))
        self.assertIn("Cannot obtain appliance metrics", result.stderr)

    def test_http_failure_malformed_response_and_timeout_exit_3(self):
        self.status = 503
        self.assertEqual(self.cli(self.url).returncode, 3)
        self.status = 200
        for body in (b"[", b'{"instance": "x"}', b'[{"connectedPVCount": "1"}]'):
            self.body = body
            result = self.cli(self.url)
            self.assertEqual((result.returncode, result.stdout), (3, ""), body)
        self.delay = 2
        result = self.cli("--timeout", "0.5", self.url)
        self.assertEqual(result.returncode, 3)
        self.assertIn("timed out", result.stderr)

    def test_usage_help_and_invalid_arguments_exit_2(self):
        result = self.cli("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("Exit status: 0 nothing to report, 1 alert, 2 invalid arguments, 3 check incomplete.", result.stdout)
        for args in ((), ("http://host/mgmt",), ("-d", "five", self.url), ("--timeout", "0", self.url), ("-x", self.url)):
            result = self.cli(*args)
            self.assertEqual(result.returncode, 2, args)
            self.assertEqual(result.stdout, "")
        self.assertEqual(self.requests, [])


if __name__ == "__main__":
    unittest.main()
