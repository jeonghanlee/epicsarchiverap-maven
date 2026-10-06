"""Exercise the shipped csvStats.bash on CSV files and standard input, comparing with independent computations."""

import csv
import io
import math
import os
from pathlib import Path
import random
import statistics
import subprocess
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[3]
SCRIPT = REPO / "docs/book/src/samples/csvStats.bash"
HEADER = ["time_utc", "secs", "nanos", "value", "severity", "status"]
BASE_SECS = 1790000000


def csv_text(values, header=HEADER):
    """One row per value; a value of None is written as an empty field."""
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(header)
    for index, value in enumerate(values):
        secs = BASE_SECS + index
        stamp = f"2026-09-21T14:13:{20 + index % 40:02d}.{index:09d}Z"
        writer.writerow([stamp, secs, index, "" if value is None else value, 0, 0])
    return out.getvalue()


def close(test, actual, expected, relative=1e-9):
    test.assertTrue(math.isclose(actual, expected, rel_tol=relative, abs_tol=1e-12), f"{actual} != {expected}")


class CsvStatsBashTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.env = dict(os.environ, LC_ALL="C")

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, text, name="data.csv"):
        path = self.root / name
        path.write_text(text, encoding="utf-8")
        return str(path)

    def cli(self, *args, stdin=None):
        return subprocess.run([str(SCRIPT), *args], text=True, capture_output=True, timeout=30, env=self.env,
                              input=stdin)

    def summary(self, result):
        self.assertEqual(result.returncode, 0, result.stderr)
        fields = dict(part.split("=") for part in result.stdout.split())
        return {key: float(value) for key, value in fields.items()}

    def moving(self, result):
        self.assertEqual(result.returncode, 0, result.stderr)
        rows = list(csv.reader(io.StringIO(result.stdout)))
        self.assertEqual(rows[0], ["time_utc", "mean", "sd"])
        return [(row[0], float(row[1]), float(row[2])) for row in rows[1:]]

    def histogram(self, result):
        self.assertEqual(result.returncode, 0, result.stderr)
        rows = list(csv.reader(io.StringIO(result.stdout)))
        self.assertEqual(rows[0], ["bin_from", "bin_to", "count"])
        return [(float(row[0]), float(row[1]), int(row[2])) for row in rows[1:]]

    def test_summary_of_known_values(self):
        stats = self.summary(self.cli("summary", self.write(csv_text([1, 2, 4, 7, 11]))))
        self.assertEqual(stats["n"], 5)
        self.assertEqual(stats["skipped"], 0)
        close(self, stats["mean"], 5.0)
        close(self, stats["sd"], statistics.stdev([1, 2, 4, 7, 11]))
        self.assertEqual((stats["min"], stats["max"]), (1.0, 11.0))

    def test_a_quoted_header_is_accepted(self):
        text = csv_text([1, 2, 4, 7, 11])
        lines = text.splitlines()
        quoted = ",".join(f'"{name}"' for name in HEADER) + "\n" + "\n".join(lines[1:]) + "\n"
        stats = self.summary(self.cli("summary", self.write(quoted)))
        self.assertEqual((stats["n"], stats["mean"]), (5, 5.0))

    def test_summary_of_one_value_has_a_zero_standard_deviation(self):
        stats = self.summary(self.cli("summary", self.write(csv_text([3.5]))))
        self.assertEqual((stats["n"], stats["mean"], stats["sd"]), (1, 3.5, 0.0))

    def test_summary_matches_an_independent_computation_on_random_values(self):
        generator = random.Random(20261005)
        values = [generator.uniform(-1000, 1000) for _ in range(2000)] + [1e-3, -2.5e-4, 3e2]
        stats = self.summary(self.cli("summary", self.write(csv_text(values))))
        self.assertEqual(stats["n"], len(values))
        close(self, stats["mean"], statistics.fmean(values), 1e-9)
        close(self, stats["sd"], statistics.stdev(values), 1e-9)
        close(self, stats["min"], min(values), 1e-9)
        close(self, stats["max"], max(values), 1e-9)

    def test_rows_without_a_numeric_value_are_counted_and_skipped(self):
        values = [1, 2, "1 2 3", "text, with comma", None, 4, "nan", "1e", 7]
        result = self.cli("summary", self.write(csv_text(values)))
        stats = self.summary(result)
        self.assertEqual((stats["n"], stats["skipped"]), (4, 5))
        close(self, stats["mean"], statistics.fmean([1, 2, 4, 7]))
        self.assertIn("skipped 5 rows whose value is not a number", result.stderr)

    def test_exponent_and_signed_values_are_numbers(self):
        stats = self.summary(self.cli("summary", self.write(csv_text(["1e3", "-2.5E-1", "+4", "0.5"]))))
        self.assertEqual(stats["n"], 4)
        close(self, stats["mean"], statistics.fmean([1000, -0.25, 4, 0.5]))

    def test_moving_statistics_match_an_independent_window_computation(self):
        values = [1, 2, 4, 7, 11, 16, 22]
        rows = self.moving(self.cli("moving", "--window", "3", self.write(csv_text(values))))
        self.assertEqual(len(rows), 5)
        for position, (stamp, mean, sd) in enumerate(rows):
            window = values[position:position + 3]
            close(self, mean, statistics.fmean(window))
            close(self, sd, statistics.stdev(window))
            self.assertTrue(stamp.endswith("Z"))
        self.assertEqual(rows[0][0], "2026-09-21T14:13:22.000000002Z")

    def test_moving_window_of_one_has_zero_standard_deviation_and_equal_window_gives_one_row(self):
        values = [5, 6, 8]
        one = self.moving(self.cli("moving", "--window", "1", self.write(csv_text(values))))
        self.assertEqual([(mean, sd) for _, mean, sd in one], [(5.0, 0.0), (6.0, 0.0), (8.0, 0.0)])
        full = self.moving(self.cli("moving", "--window", "3", self.write(csv_text(values))))
        self.assertEqual(len(full), 1)
        close(self, full[0][1], statistics.fmean(values))

    def test_moving_statistics_skip_non_numeric_rows_before_forming_windows(self):
        values = [1, "text", 2, 3, None, 4]
        rows = self.moving(self.cli("moving", "--window", "2", self.write(csv_text(values))))
        self.assertEqual([round(mean, 6) for _, mean, _ in rows], [1.5, 2.5, 3.5])

    def test_moving_statistics_match_on_random_values_with_a_long_window(self):
        generator = random.Random(7)
        values = [generator.gauss(50, 20) for _ in range(500)]
        rows = self.moving(self.cli("moving", "--window", "25", self.write(csv_text(values))))
        self.assertEqual(len(rows), 476)
        for position in (0, 100, 475):
            window = values[position:position + 25]
            close(self, rows[position][1], statistics.fmean(window), 1e-8)
            close(self, rows[position][2], statistics.stdev(window), 1e-7)

    def test_a_window_larger_than_the_data_is_an_error(self):
        result = self.cli("moving", "--window", "4", self.write(csv_text([1, 2, 3])))
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "")
        self.assertIn("window of 4", result.stderr)
        self.assertIn("3 numeric rows", result.stderr)

    def test_histogram_with_the_data_bounds_puts_the_maximum_in_the_last_bin(self):
        rows = self.histogram(self.cli("histogram", "--bins", "2", self.write(csv_text([1, 2, 4, 7, 11]))))
        self.assertEqual(rows, [(1.0, 6.0, 3), (6.0, 11.0, 2)])

    def test_histogram_of_one_bin_and_of_equal_values(self):
        self.assertEqual(self.histogram(self.cli("histogram", "--bins", "1", self.write(csv_text([1, 2, 3])))),
                         [(1.0, 3.0, 3)])
        rows = self.histogram(self.cli("histogram", "--bins", "3", self.write(csv_text([5, 5, 5]))))
        self.assertEqual([count for _, _, count in rows], [3, 0, 0])

    def test_histogram_with_given_bounds_reports_values_outside_them(self):
        result = self.cli("histogram", "--bins", "2", "--min", "0", "--max", "10",
                          self.write(csv_text([-1, 0, 4, 5, 10, 11])))
        self.assertEqual(self.histogram(result), [(0.0, 5.0, 2), (5.0, 10.0, 2)])
        self.assertIn("2 values outside 0 to 10", result.stderr)

    def test_bins_up_to_the_limit_are_accepted_and_more_are_refused(self):
        data = self.write(csv_text([1, 2, 3]))
        result = self.cli("histogram", "--bins", "10000", data)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(result.stdout.splitlines()), 10001)
        result = self.cli("histogram", "--bins", "10001", data)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")
        self.assertIn("limited to 10000", result.stderr)
        self.assertIn("10001", result.stderr)
        result = self.cli("histogram", "--bins", "999999999", data)
        self.assertEqual(result.returncode, 2)

    def test_histogram_counts_match_an_independent_computation(self):
        generator = random.Random(11)
        values = [generator.uniform(0, 100) for _ in range(1000)]
        rows = self.histogram(self.cli("histogram", "--bins", "10", self.write(csv_text(values))))
        low, high = min(values), max(values)
        expected = [0] * 10
        for value in values:
            expected[min(9, int((value - low) / (high - low) * 10))] += 1
        self.assertEqual([count for _, _, count in rows], expected)
        self.assertEqual(sum(expected), 1000)

    def test_standard_input_is_read_when_the_file_is_a_dash(self):
        stats = self.summary(self.cli("summary", "-", stdin=csv_text([2, 4, 6])))
        self.assertEqual((stats["n"], stats["mean"]), (3, 4.0))

    def test_input_without_numeric_rows_exits_1(self):
        for text in (csv_text([]), csv_text(["a", "b"]), csv_text([None])):
            result = self.cli("summary", self.write(text))
            self.assertEqual(result.returncode, 1, text)
            self.assertEqual(result.stdout, "")
            self.assertIn("no numeric rows", result.stderr)

    def test_input_that_is_not_a_get_data_to_csv_file_is_refused(self):
        for text in ("a,b,c\n1,2,3\n", "", csv_text([1], ["time", "secs", "nanos", "value", "severity", "status"])):
            result = self.cli("summary", self.write(text))
            self.assertEqual(result.returncode, 2, text)
            self.assertEqual(result.stdout, "")

    def test_usage_help_and_invalid_arguments(self):
        result = self.cli("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage: csvStats.bash summary FILE", result.stdout)
        self.assertIn("csvStats.bash moving --window N FILE", result.stdout)
        self.assertIn("csvStats.bash histogram --bins N [--min X] [--max Y] FILE", result.stdout)
        data = self.write(csv_text([1, 2, 3]))
        for args in ((), ("unknown", data), ("summary",), ("summary", data, "extra"), ("moving", data),
                     ("moving", "--window", "0", data), ("moving", "--window", "1.5", data),
                     ("moving", "--window", "x", data), ("histogram", data), ("histogram", "--bins", "0", data),
                     ("histogram", "--bins", "2", "--min", "5", "--max", "5", data),
                     ("histogram", "--bins", "2", "--min", "6", "--max", "5", data),
                     ("histogram", "--bins", "2", "--min", "abc", data),
                     ("summary", str(self.root / "missing.csv")), ("summary", str(self.root))):
            result = self.cli(*args)
            self.assertEqual(result.returncode, 2, args)
            self.assertEqual(result.stdout, "", args)


if __name__ == "__main__":
    unittest.main()
