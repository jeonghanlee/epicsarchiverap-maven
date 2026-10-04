"""Exercise the shipped listTypeChanges.bash with only the outer HTTP boundary controlled."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import threading
import time
import unittest
from urllib.parse import parse_qs, urlsplit

REPO = Path(__file__).resolve().parents[3]
SCRIPT = REPO / "docs/book/src/samples/listTypeChanges.bash"
INITIAL = "Archiver DBR type (initial)"
CA = "Archiver DBR type (from CA)"


def details(pv, initial="DBR_SCALAR_DOUBLE", ca="DBR_SCALAR_FLOAT"):
    rows = [{"name": "PV Name", "value": pv}]
    if initial is not None:
        rows.append({"name": INITIAL, "value": initial})
    if ca is not None:
        rows.append({"name": CA, "value": ca})
    return rows


class ListTypeChangesBashTest(unittest.TestCase):
    def setUp(self):
        self.report = (200, json.dumps([{"pvName": "TEST:a", "eventsDropped": "3"}]).encode())
        self.details = {"TEST:a": (200, json.dumps(details("TEST:a")).encode())}
        self.delay = 0
        self.requests = []
        case = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                url = urlsplit(self.path)
                case.requests.append(self.path)
                time.sleep(case.delay)
                if url.path.endswith("/getPVsByDroppedEventsTypeChange"):
                    status, body = case.report
                else:
                    pv = parse_qs(url.query)["pv"][0]
                    status, body = case.details.get(pv, (404, b"not found"))
                try:
                    self.send_response(status)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
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

    def line(self, pv, previous="DBR_SCALAR_DOUBLE", current="DBR_SCALAR_FLOAT"):
        return f'PV: {pv:<40} Previous {previous:20} Current {current:20}\n'

    def test_lists_each_pv_in_report_order_with_original_layout(self):
        self.report = (200, json.dumps([{"pvName": "TEST:z"}, {"pvName": "TEST:a"}]).encode())
        self.details["TEST:z"] = (200, json.dumps(details("TEST:z", "DBR_SCALAR_INT", "DBR_SCALAR_ENUM")).encode())
        result = self.cli(self.url)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, self.line("TEST:z", "DBR_SCALAR_INT", "DBR_SCALAR_ENUM") + self.line("TEST:a"))
        self.assertEqual(result.stderr, "")
        self.assertEqual(urlsplit(self.requests[0]).path, "/mgmt/bpl/getPVsByDroppedEventsTypeChange")
        self.assertEqual(parse_qs(urlsplit(self.requests[2]).query), {"pv": ["TEST:a"]})

    def test_empty_report_prints_nothing(self):
        self.report = (200, b"[]")
        result = self.cli(self.url)
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_missing_field_or_404_is_reported_and_the_run_continues(self):
        self.report = (200, json.dumps([{"pvName": "TEST:gone"}, {"pvName": "TEST:half"}, {"pvName": "TEST:a"}]).encode())
        self.details["TEST:half"] = (200, json.dumps(details("TEST:half", ca=None)).encode())
        result = self.cli(self.url)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, self.line("TEST:a"))
        self.assertIn("HTTP 404", result.stderr)
        self.assertIn("cannot read the details of TEST:gone", result.stderr)
        self.assertIn("details of TEST:half with both type fields", result.stderr)

    def test_repeated_field_takes_the_last_value_like_the_original(self):
        rows = details("TEST:a") + [{"name": CA, "value": "DBR_SCALAR_SHORT"}]
        self.details["TEST:a"] = (200, json.dumps(rows).encode())
        result = self.cli(self.url)
        self.assertEqual(result.stdout, self.line("TEST:a", current="DBR_SCALAR_SHORT"))

    def test_padding_counts_characters_like_the_original(self):
        self.report = (200, json.dumps([{"pvName": "TEST:\u00e9"}]).encode())
        self.details["TEST:\u00e9"] = (200, json.dumps(details("TEST:\u00e9")).encode())
        result = self.cli(self.url)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, self.line("TEST:\u00e9"))

    def test_bad_report_exits_1(self):
        for report in ((500, b"[]"), (200, b'[{"name": 1}]'), (200, b'{"pvName": "TEST:a"}'), (200, b'[')):
            self.report = report
            result = self.cli(self.url)
            self.assertEqual(result.returncode, 1, report)
            self.assertEqual(result.stdout, "")

    def test_usage_help_and_invalid_arguments(self):
        result = self.cli("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage: listTypeChanges.bash [--timeout SEC] BPL_URL", result.stdout)
        for args in ((), (self.url, "extra"), ("http://host/x",), ("--timeout", "0", self.url)):
            result = self.cli(*args)
            self.assertEqual(result.returncode, 2, args)
            self.assertEqual(result.stdout, "")
        self.assertEqual(self.requests, [])

    def test_timeout_exits_1(self):
        self.delay = 2
        result = self.cli("--timeout", "0.5", self.url)
        self.assertEqual(result.returncode, 1)
        self.assertIn("timed out", result.stderr)


if __name__ == "__main__":
    unittest.main()
