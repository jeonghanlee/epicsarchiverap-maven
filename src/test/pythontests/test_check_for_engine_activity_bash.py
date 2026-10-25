"""Exercise the shipped checkForEngineActivity.bash on real folders; only the filesystem is controlled."""

import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import unittest

REPO = Path(__file__).resolve().parents[3]
SCRIPT = REPO / "docs/book/src/samples/checkForEngineActivity.bash"


class CheckForEngineActivityBashTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        (self.dir / "PV").mkdir()
        (self.dir / "PV/a.pb").write_bytes(b"x" * 10)

    def tearDown(self):
        for path in self.dir.rglob("*"):
            if path.is_dir():
                path.chmod(0o755)
        self.tmp.cleanup()

    def cli(self, *args):
        return subprocess.run([str(SCRIPT), *args], text=True, capture_output=True, timeout=20)

    def later(self, action, delay=0.5):
        timer = threading.Timer(delay, action)
        timer.start()
        return timer

    def test_growing_file_counts_as_a_change(self):
        timer = self.later(lambda: (self.dir / "PV/a.pb").write_bytes(b"x" * 20))
        result = self.cli("-t", "2", str(self.dir))
        timer.join()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "1 changes were detected in 2 seconds\n")

    def test_new_files_count_and_removals_do_not(self):
        (self.dir / "PV/old.pb").write_bytes(b"y")
        def act():
            (self.dir / "PV/old.pb").unlink()
            (self.dir / "PV/b.pb").write_bytes(b"z")
            (self.dir / "PV/c.pb").write_bytes(b"z")
        timer = self.later(act)
        result = self.cli("-t", "2", str(self.dir))
        timer.join()
        self.assertEqual(result.stdout, "2 changes were detected in 2 seconds\n")
        self.assertEqual(result.returncode, 0)

    def test_symbolic_link_to_a_file_counts_like_the_original(self):
        target = self.dir / "target.pb"
        target.write_bytes(b"t")
        timer = self.later(lambda: (self.dir / "PV/link.pb").symlink_to(target))
        result = self.cli("-t", "2", str(self.dir / "PV"))
        timer.join()
        self.assertEqual(result.stdout, "1 changes were detected in 2 seconds\n")

    def test_quiet_folder_exits_1(self):
        result = self.cli("-t", "1", str(self.dir))
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "No changes detected in the last 1 seconds\n")
        self.assertEqual(result.stderr, "")

    def test_unreadable_subfolder_is_skipped_with_a_diagnostic(self):
        locked = self.dir / "locked"
        locked.mkdir()
        (locked / "x.pb").write_bytes(b"x")
        locked.chmod(0)
        if os.access(locked, os.R_OK):
            self.skipTest("running with privileges that ignore folder permissions")
        result = self.cli("-t", "1", str(self.dir))
        self.assertEqual(result.returncode, 1)
        self.assertIn("Permission denied", result.stderr)

    def test_invalid_arguments_exit_2(self):
        for args, message in (((), "usage:"), (("-t", "0", str(self.dir)), "-t must be a positive integer"),
                              (("-t", "1.5", str(self.dir)), "-t must be"), (("-t", "1", str(self.dir / "nope")), "cannot read folder"),
                              (("-x", str(self.dir)), "unknown option")):
            result = self.cli(*args)
            self.assertEqual(result.returncode, 2, args)
            self.assertIn(message, result.stderr)
            self.assertEqual(result.stdout, "")

    def test_help(self):
        result = self.cli("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage: checkForEngineActivity.bash [-t SEC] FOLDER", result.stdout)


if __name__ == "__main__":
    unittest.main()
