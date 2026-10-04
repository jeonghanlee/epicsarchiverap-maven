"""Exercise the shipped storageSizeCheck.bash with only the outer HTTP boundary controlled."""

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
SCRIPT = REPO / "docs/book/src/samples/storageSizeCheck.bash"


def rate(pv, gb):
    return {"pvName": pv, "storageRate_GBperYear": gb, "storageRate_MBperDay": "0.0"}


class StorageSizeCheckBashTest(unittest.TestCase):
    def setUp(self):
        self.status = 200
        self.body = json.dumps([rate("TEST:a", "0.5")]).encode()
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

    def test_below_limit_exits_0_silently_with_default_report_limit(self):
        result = self.cli(self.url, "1")
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))
        self.assertEqual(urlsplit(self.requests[0]).path, "/mgmt/bpl/getStorageRateReport")
        self.assertEqual(parse_qs(urlsplit(self.requests[0]).query), {"limit": ["100"]})

    def test_over_limit_sorted_descending_with_last_rate_per_pv(self):
        self.body = json.dumps([rate("TEST:a", "2.0"), rate("TEST:b", "1.5E-4"), rate("TEST:c", "7.25"),
                                rate("TEST:a", "3.5"), rate("TEST:d", "3.5"), rate("TEST:e", "0.01")]).encode()
        result = self.cli("--limit", "7", self.url, "1E-4")
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertEqual(result.stdout, f"PVs with estimated storage greater than 1E-4 GB/year in {self.url}\n"
                                        "PV: TEST:c Size: 7.25 GB/year\n"
                                        "PV: TEST:a Size: 3.50 GB/year\n"
                                        "PV: TEST:d Size: 3.50 GB/year\n"
                                        "PV: TEST:e Size: 10.2 MB/year\n"
                                        "PV: TEST:b Size: 157 KB/year\n")
        self.assertEqual(parse_qs(urlsplit(self.requests[0]).query), {"limit": ["7"]})

    def test_negative_limit_reports_every_pv(self):
        result = self.cli(self.url, "-1")
        self.assertEqual(result.returncode, 1)
        self.assertIn("PV: TEST:a Size: 512 MB/year", result.stdout)

    def test_units_cover_bytes_to_terabytes_with_three_significant_digits(self):
        cases = [("0.0", "0 B/year"), ("4.656612873077393E-10", "0.500 B/year"), ("9.313225746154785E-10", "1.00 B/year"),
                 ("9.5367431640625E-7", "1.00 KB/year"), ("1.1175870895385742E-6", "1.17 KB/year"),
                 ("9.765625E-4", "1.00 MB/year"), ("0.0999", "102 MB/year"), ("0.99999", "1.00 GB/year"),
                 ("1.0", "1.00 GB/year"), ("1023.0", "1023 GB/year"), ("1024.0", "1.00 TB/year"),
                 ("2097152.0", "2048 TB/year"), (repr(9.996 / 1024), "10.0 MB/year"), (repr(99.96 / 1024), "100 MB/year"),
                 (repr(1023.6 / 1024), "1.00 GB/year"), (repr(1023.6 / 1024 / 1024), "1.00 MB/year")]
        self.body = json.dumps([rate(f"TEST:{i:02d}", gb) for i, (gb, _) in enumerate(cases)]).encode()
        result = self.cli(self.url, "-1")
        self.assertEqual(result.returncode, 1, result.stderr)
        got = {line.split()[1]: line.split("Size: ", 1)[1] for line in result.stdout.splitlines()[1:]}
        for i, (gb, expected) in enumerate(cases):
            self.assertEqual(got[f"TEST:{i:02d}"], expected, gb)

    def test_failures_exit_3(self):
        self.status = 500
        self.assertEqual(self.cli(self.url, "1").returncode, 3)
        self.status = 200
        for body in (b"[", b'{"pvName": "x"}', json.dumps([rate("TEST:a", "fast")]).encode(),
                     json.dumps([{"pvName": "TEST:a", "storageRate_GBperYear": 1.0}]).encode()):
            self.body = body
            result = self.cli(self.url, "1")
            self.assertEqual((result.returncode, result.stdout), (3, ""), body)
        self.delay = 2
        result = self.cli("--timeout", "0.5", self.url, "1")
        self.assertEqual(result.returncode, 3)
        self.assertIn("timed out", result.stderr)

    def test_usage_help_and_invalid_arguments_exit_2(self):
        result = self.cli("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage: storageSizeCheck.bash [--limit N] [--timeout SEC] BPL_URL MAXSIZE", result.stdout)
        for args in ((self.url,), ("http://host/mgmt", "1"), (self.url, "big"), ("--limit", "0", self.url, "1"),
                     ("--limit", "x", self.url, "1"), ("--timeout", "0", self.url, "1"), ("--bogus", self.url, "1")):
            result = self.cli(*args)
            self.assertEqual(result.returncode, 2, args)
            self.assertEqual(result.stdout, "")
        self.assertEqual(self.requests, [])


if __name__ == "__main__":
    unittest.main()
