"""Verify runner cleanup after the real local launcher is killed."""

import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import unittest

REPO = Path(__file__).resolve().parents[3]
RUNNER = REPO / "src/test/pythontests/verify_list_archived_pvs.py"
PORT_BASE = 24665
CA_PORT = 24675
START_DEADLINE = 30
STOP_DEADLINE = 310


def same_process_alive(pid, start):
    try:
        fields = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()
    except FileNotFoundError:
        return False
    return fields[19] == start and fields[0] != "Z"


class ListingRunnerCleanupTest(unittest.TestCase):
    def test_launcher_killed_leaves_no_owned_jvms(self):
        tomcat = os.environ.get("TOMCAT_HOME")
        ioc = shutil.which("softIocPVX")
        if not tomcat or not ioc:
            self.skipTest("requires TOMCAT_HOME, JAVA_HOME and softIocPVX on PATH")
        parent = Path(tempfile.mkdtemp(prefix="listing-cleanup-", dir=REPO / "work"))
        root = parent / "run"
        command = [sys.executable, str(RUNNER), str(root), "--tomcat-home", tomcat,
                   "--ioc", ioc, "--port-base", str(PORT_BASE), "--ca-port", str(CA_PORT)]
        owned = []
        launcher = None
        env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
        with (parent / "runner.log").open("w") as log:
            runner = subprocess.Popen(command, cwd=REPO, env=env, stdout=log, stderr=subprocess.STDOUT)
        try:
            deadline = time.monotonic() + START_DEADLINE
            children = root / "appliance/children.tsv"
            while time.monotonic() < deadline:
                if children.exists():
                    rows = [line.split("\t") for line in children.read_text().splitlines()]
                    owned = [(int(row[2]), row[3]) for row in rows if len(row) == 4]
                    if len(owned) == 4:
                        break
                self.assertIsNone(runner.poll(), f"runner exited during setup; see {parent}")
                time.sleep(0.1)
            self.assertEqual(len(owned), 4, f"four owned JVMs not recorded; see {parent}")
            child_ids = Path(f"/proc/{runner.pid}/task/{runner.pid}/children").read_text().split()
            launchers = []
            for pid in child_ids:
                cmdline = Path(f"/proc/{pid}/cmdline").read_bytes()
                if b"run-local-appliance.bash" in cmdline and str(root).encode() in cmdline:
                    launchers.append(int(pid))
            self.assertEqual(len(launchers), 1)
            launcher = launchers[0]
            os.kill(launcher, signal.SIGKILL)
            code = runner.wait(timeout=STOP_DEADLINE)
            cleanup = json.loads((root / "cleanup.json").read_text())
            remaining = [pid for pid, start in owned if same_process_alive(pid, start)]
            observation = {"runner_exit": code, "cleanup": cleanup, "remaining_jvms": remaining}
            (parent / "observation.json").write_text(json.dumps(observation, indent=2) + "\n")
            self.assertNotEqual(code, 0, "launcher death must still fail verification")
            self.assertEqual(cleanup["launcher_exit"], -signal.SIGKILL)
            self.assertEqual(remaining, [], f"runner left JVMs alive; see {parent}")
            self.assertEqual(cleanup["owned_jvms_alive"], [])
        finally:
            if runner.poll() is None:
                runner.send_signal(signal.SIGTERM)
            for pid, start in owned:
                if same_process_alive(pid, start):
                    os.kill(pid, signal.SIGTERM)
            deadline = time.monotonic() + START_DEADLINE
            while time.monotonic() < deadline and any(same_process_alive(pid, start) for pid, start in owned):
                time.sleep(0.1)
            for pid, start in owned:
                if same_process_alive(pid, start):
                    os.kill(pid, signal.SIGKILL)
            if runner.poll() is None:
                runner.wait(timeout=STOP_DEADLINE)
            print(f"Evidence retained: {parent}", flush=True)


if __name__ == "__main__":
    unittest.main()
