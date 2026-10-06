"""Exercise the shipped getDataToCsv.bash with only the outer HTTP boundary controlled."""

import csv
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import unittest
from urllib.parse import parse_qs, urlsplit

REPO = Path(__file__).resolve().parents[3]
SCRIPT = REPO / "docs/book/src/samples/getDataToCsv.bash"
HEADER = ["time_utc", "secs", "nanos", "value", "severity", "status"]
FROM = "2026-09-17T00:00:00Z"
TO = "2026-09-24T00:00:00Z"
SEVEN_DAYS_PLUS_ONE_SECOND = "2026-09-24T00:00:01Z"


def sample(secs, val, nanos=0, severity=0, status=0):
    return {"secs": secs, "val": val, "nanos": nanos, "severity": severity, "status": status}


def response(pv, samples):
    return (200, json.dumps([{"meta": {"name": pv}, "data": samples}]).encode())


class GetDataToCsvBashTest(unittest.TestCase):
    def setUp(self):
        self.responses = {}
        self.delay = 0
        self.requests = []
        case = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                url = urlsplit(self.path)
                query = parse_qs(url.query)
                case.requests.append((url.path, query))
                time.sleep(case.delay)
                pv = query.get("pv", [""])[0]
                status, body = case.responses.get(pv, response(pv, [sample(1790000000, 1.5)]))
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
        self.url = f"http://127.0.0.1:{self.server.server_port}/retrieval"
        self.env = dict(os.environ, NO_PROXY="*", no_proxy="*")
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.out = self.root / "out"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.tmp.cleanup()

    def pv_file(self, *names, text=None):
        path = self.root / "pvs.csv"
        path.write_text(text if text is not None else "".join(f"{name}\n" for name in names), encoding="utf-8")
        return str(path)

    def cli(self, *args):
        return subprocess.run([str(SCRIPT), *args], text=True, capture_output=True, timeout=30, env=self.env)

    def run_for(self, pv_file, start=FROM, end=TO, *extra):
        return self.cli(*extra, self.url, pv_file, start, end, str(self.out))

    def rows(self, name):
        text = (self.out / name).read_text(encoding="utf-8")
        return list(csv.reader(io.StringIO(text)))

    def files(self):
        return sorted(p.name for p in self.out.iterdir()) if self.out.exists() else []

    def test_writes_one_csv_per_pv_with_the_documented_columns(self):
        self.responses["TEST:a"] = response("TEST:a", [
            sample(1790000000, 1.0, 100000000), sample(1790000002, 4.0, 5, 1, 3)])
        self.responses["TEST:b"] = response("TEST:b", [sample(1790000001, 7)])
        result = self.run_for(self.pv_file("TEST:a", "TEST:b"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.files(), ["TEST_a.csv", "TEST_b.csv"])
        a = self.rows("TEST_a.csv")
        self.assertEqual(a[0], HEADER)
        self.assertEqual(a[1][0], "2026-09-21T14:13:20.100000000Z")
        self.assertEqual([int(a[1][1]), int(a[1][2]), float(a[1][3]), int(a[1][4]), int(a[1][5])],
                         [1790000000, 100000000, 1.0, 0, 0])
        self.assertEqual(a[2][0], "2026-09-21T14:13:22.000000005Z")
        self.assertEqual([int(a[2][1]), int(a[2][2]), float(a[2][3]), int(a[2][4]), int(a[2][5])],
                         [1790000002, 5, 4.0, 1, 3])
        self.assertEqual(len(a), 3)
        b = self.rows("TEST_b.csv")
        self.assertEqual([len(b), float(b[1][3])], [2, 7.0])
        self.assertIn("TEST:a: 2 samples written to", result.stdout)
        self.assertIn("TEST:b: 1 samples written to", result.stdout)
        self.assertEqual(result.stderr, "")

    def test_the_header_line_is_plain_text_and_the_rows_follow(self):
        self.responses["TEST:a"] = response("TEST:a", [sample(1790000000, 1.5)])
        result = self.run_for(self.pv_file("TEST:a"))
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = (self.out / "TEST_a.csv").read_text(encoding="utf-8").splitlines()
        self.assertEqual(lines[0], "time_utc,secs,nanos,value,severity,status")
        self.assertEqual(len(lines), 2)

    def test_the_written_file_is_read_by_csv_stats(self):
        values = [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]
        self.responses["TEST:a"] = response("TEST:a", [sample(1790000000 + i, v) for i, v in enumerate(values)])
        result = self.run_for(self.pv_file("TEST:a"))
        self.assertEqual(result.returncode, 0, result.stderr)
        stats = subprocess.run([str(REPO / "docs/book/src/samples/csvStats.bash"), "summary", str(self.out / "TEST_a.csv")],
                               text=True, capture_output=True, timeout=30, env=self.env)
        self.assertEqual(stats.returncode, 0, stats.stderr)
        fields = dict(part.split("=") for part in stats.stdout.split())
        self.assertEqual((int(fields["n"]), float(fields["mean"]), float(fields["min"]), float(fields["max"])),
                         (8, 5.0, 2.0, 9.0))
        self.assertAlmostEqual(float(fields["sd"]), 2.138089935, places=6)
        histogram = subprocess.run(
            [str(REPO / "docs/book/src/samples/csvStats.bash"), "histogram", "--bins", "2", str(self.out / "TEST_a.csv")],
            text=True, capture_output=True, timeout=30, env=self.env)
        self.assertEqual(histogram.returncode, 0, histogram.stderr)
        self.assertEqual([row[2] for row in list(csv.reader(io.StringIO(histogram.stdout)))[1:]], ["6", "2"])

    def test_one_request_per_pv_in_order_with_normalized_times(self):
        result = self.run_for(self.pv_file("TEST:a", "TEST:b", "TEST:c"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([path for path, _ in self.requests], ["/retrieval/data/getData.json"] * 3)
        self.assertEqual([query["pv"] for _, query in self.requests], [["TEST:a"], ["TEST:b"], ["TEST:c"]])
        self.assertEqual(self.requests[0][1]["from"], ["2026-09-17T00:00:00.000Z"])
        self.assertEqual(self.requests[0][1]["to"], ["2026-09-24T00:00:00.000Z"])

    def test_offset_and_fractional_times_are_normalized_to_utc(self):
        result = self.run_for(self.pv_file("TEST:a"), "2026-09-24T01:00:00-07:00", "2026-09-24T09:00:00.250Z")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.requests[0][1]["from"], ["2026-09-24T08:00:00.000Z"])
        self.assertEqual(self.requests[0][1]["to"], ["2026-09-24T09:00:00.250Z"])

    def test_pv_file_rows_are_trimmed_and_blank_lines_skipped(self):
        result = self.run_for(self.pv_file(text="  TEST:a , note\n\nTEST:b\r\n"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.files(), ["TEST_a.csv", "TEST_b.csv"])

    def test_waveform_text_and_missing_values(self):
        self.responses["TEST:w"] = response("TEST:w", [
            sample(1790000000, [1, 2.5, 3]), sample(1790000001, "text, with comma"), sample(1790000002, None)])
        result = self.run_for(self.pv_file("TEST:w"))
        self.assertEqual(result.returncode, 0, result.stderr)
        rows = self.rows("TEST_w.csv")
        self.assertEqual([row[3] for row in rows[1:]], ["1 2.5 3", "text, with comma", ""])

    def test_file_names_replace_other_characters_with_underscore(self):
        result = self.run_for(self.pv_file("TEST:a/b c", "plain-name_1.v2"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.files(), ["TEST_a_b_c.csv", "plain-name_1.v2.csv"])

    def test_names_that_give_one_file_name_stop_before_any_request(self):
        result = self.run_for(self.pv_file("A:1", "A_1"))
        self.assertEqual(result.returncode, 2)
        self.assertIn("A:1", result.stderr)
        self.assertIn("A_1", result.stderr)
        self.assertEqual(self.requests, [])
        self.assertEqual(self.files(), [])

    def test_duplicate_name_stops_before_any_request(self):
        result = self.run_for(self.pv_file("TEST:a", "TEST:b", "TEST:a"))
        self.assertEqual(result.returncode, 2)
        self.assertIn("duplicate PV name: TEST:a", result.stderr)
        self.assertEqual(self.requests, [])

    def test_ten_pvs_are_accepted_and_eleven_are_refused(self):
        names = [f"TEST:{i}" for i in range(10)]
        result = self.run_for(self.pv_file(*names))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(self.requests), 10)
        self.requests.clear()
        self.out = self.root / "out2"
        result = self.run_for(self.pv_file(*names, "TEST:10"))
        self.assertEqual(result.returncode, 2)
        self.assertIn("at most 10 PVs", result.stderr)
        self.assertIn("11", result.stderr)
        self.assertEqual(self.requests, [])
        self.assertEqual(self.files(), [])

    def test_seven_days_are_accepted_and_one_second_more_is_refused(self):
        result = self.run_for(self.pv_file("TEST:a"), FROM, TO)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.requests.clear()
        self.out = self.root / "out2"
        result = self.run_for(self.pv_file("TEST:a"), FROM, SEVEN_DAYS_PLUS_ONE_SECOND)
        self.assertEqual(result.returncode, 2)
        self.assertIn("7 days", result.stderr)
        self.assertIn("604801", result.stderr)
        self.assertEqual(self.requests, [])
        self.assertEqual(self.files(), [])

    def test_invalid_equal_and_reversed_times_are_refused_before_any_request(self):
        for start, end in (("yesterday", TO), (FROM, "2026-13-01T00:00:00Z"), (FROM, FROM), (TO, FROM),
                           ("2026-09-17", TO), ("2026-09-17T00:00:00", TO)):
            result = self.run_for(self.pv_file("TEST:a"), start, end)
            self.assertEqual(result.returncode, 2, (start, end))
            self.assertEqual(result.stdout, "")
        self.assertEqual(self.requests, [])
        self.assertEqual(self.files(), [])

    def test_one_refused_pv_leaves_the_others_written_and_exits_3(self):
        self.responses["TEST:b"] = (500, b"server error")
        result = self.run_for(self.pv_file("TEST:a", "TEST:b", "TEST:c"))
        self.assertEqual(result.returncode, 3)
        self.assertEqual(self.files(), ["TEST_a.csv", "TEST_c.csv"])
        self.assertIn("TEST:b", result.stderr)
        self.assertIn("HTTP 500", result.stderr)
        self.assertEqual(len(self.requests), 3)

    def test_every_pv_refused_exits_1_and_writes_nothing(self):
        for pv in ("TEST:a", "TEST:b"):
            self.responses[pv] = (404, b"not found")
        result = self.run_for(self.pv_file("TEST:a", "TEST:b"))
        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.files(), [])
        self.assertIn("TEST:a", result.stderr)
        self.assertIn("TEST:b", result.stderr)

    def test_malformed_or_unexpected_responses_are_reported_without_a_file(self):
        bad = {
            "TEST:json": (200, b"["),
            "TEST:object": (200, b'{"meta": {"name": "TEST:object"}, "data": []}'),
            "TEST:two": (200, json.dumps([{"meta": {"name": "x"}, "data": []}] * 2).encode()),
            "TEST:nodata": (200, b'[{"meta": {"name": "TEST:nodata"}}]'),
            "TEST:badrow": (200, b'[{"meta": {"name": "TEST:badrow"}, "data": [{"val": 1}]}]'),
        }
        self.responses.update(bad)
        result = self.run_for(self.pv_file(*bad, "TEST:good"))
        self.assertEqual(result.returncode, 3)
        self.assertEqual(self.files(), ["TEST_good.csv"])
        for pv in bad:
            self.assertIn(pv, result.stderr)

    def test_a_structured_value_fails_its_pv_without_a_file(self):
        self.responses["TEST:obj"] = (200, json.dumps([{"meta": {"name": "TEST:obj"}, "data": [
            {"secs": 1790000000, "val": {"a": 1}, "nanos": 0, "severity": 0, "status": 0}]}]).encode())
        result = self.run_for(self.pv_file("TEST:obj", "TEST:a"))
        self.assertEqual(result.returncode, 3)
        self.assertEqual(self.files(), ["TEST_a.csv"])
        self.assertIn("cannot convert the samples of TEST:obj", result.stderr)

    def test_pv_without_samples_gets_a_header_only_file(self):
        self.responses["TEST:empty"] = response("TEST:empty", [])
        result = self.run_for(self.pv_file("TEST:empty"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.rows("TEST_empty.csv"), [HEADER])
        self.assertIn("TEST:empty: 0 samples written to", result.stdout)

    def test_an_existing_output_file_is_refused_before_any_request(self):
        self.out.mkdir()
        (self.out / "TEST_a.csv").write_text("keep\n")
        result = self.run_for(self.pv_file("TEST:a", "TEST:b"))
        self.assertEqual(result.returncode, 2)
        self.assertIn("TEST_a.csv", result.stderr)
        self.assertEqual((self.out / "TEST_a.csv").read_text(), "keep\n")
        self.assertEqual(self.requests, [])
        self.assertEqual(self.files(), ["TEST_a.csv"])

    def test_the_output_folder_is_created_when_missing(self):
        self.assertFalse(self.out.exists())
        result = self.run_for(self.pv_file("TEST:a"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.files(), ["TEST_a.csv"])

    def test_usage_help_and_invalid_arguments(self):
        result = self.cli("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage: getDataToCsv.bash [--timeout SEC] RETRIEVAL_URL PV_FILE FROM TO OUT_DIR", result.stdout)
        pv_file = self.pv_file("TEST:a")
        for args in ((), (self.url, pv_file, FROM, TO), (self.url, pv_file, FROM, TO, str(self.out), "extra"),
                     ("http://host/x?y=1", pv_file, FROM, TO, str(self.out)),
                     ("ftp://host/x", pv_file, FROM, TO, str(self.out)),
                     (self.url, str(self.root / "missing.csv"), FROM, TO, str(self.out)),
                     ("--timeout", "0", self.url, pv_file, FROM, TO, str(self.out))):
            result = self.cli(*args)
            self.assertEqual(result.returncode, 2, args)
            self.assertEqual(result.stdout, "")
        self.assertEqual(self.requests, [])

    def test_a_pv_file_without_names_is_refused(self):
        result = self.run_for(self.pv_file(text="\n\n"))
        self.assertEqual(result.returncode, 2)
        self.assertEqual(self.requests, [])

    def test_timeout_is_reported_for_the_pv_and_exits_1(self):
        self.delay = 2
        result = self.run_for(self.pv_file("TEST:a"), FROM, TO, "--timeout", "0.5")
        self.assertEqual(result.returncode, 1)
        self.assertIn("timed out", result.stderr)
        self.assertIn("TEST:a", result.stderr)
        self.assertEqual(self.files(), [])


if __name__ == "__main__":
    unittest.main()
