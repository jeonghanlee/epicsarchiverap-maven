"""Verify that the real local launcher ends the whole appliance when one component exits."""

import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time
import unittest

REPO = Path(__file__).resolve().parents[3]
LAUNCHER = REPO / "scripts/run-local-appliance.bash"
WAR_DIR = REPO / "target"
PORT_BASE = 25665
START_DEADLINE = 300
STOP_DEADLINE = 120
STOP_TIMEOUT = 60
EXIT_LINE = "ERROR: Component exited: retrieval; see its console.log"


def same_process_alive(pid, start):
    try:
        fields = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()
    except FileNotFoundError:
        return False
    return fields[19] == start and fields[0] != "Z"


def newest_build_wars(wars_dir):
    """The four WARs of the newest build in wars_dir, by component, or None; the launcher takes exactly one build."""
    mgmt = sorted(wars_dir.glob("*-mgmt.war"), key=lambda path: path.stat().st_mtime)
    if not mgmt:
        return None
    build = mgmt[-1].name[: -len("-mgmt.war")]
    wars = {name: wars_dir / f"{build}-{name}.war" for name in ("mgmt", "engine", "etl", "retrieval")}
    return wars if all(path.is_file() for path in wars.values()) else None


def read_children(path):
    rows = [line.split("\t") for line in path.read_text().splitlines()] if path.exists() else []
    return [(row[1], int(row[2]), row[3]) for row in rows if len(row) == 4]


class LauncherComponentExitTest(unittest.TestCase):
    def test_retrieval_exit_stops_the_other_components(self):
        tomcat = os.environ.get("TOMCAT_HOME")
        built = newest_build_wars(WAR_DIR)
        if not tomcat or built is None:
            self.skipTest("requires TOMCAT_HOME and the four built WARs of one build in target")
        parent = Path(tempfile.mkdtemp(prefix="launcher-exit-", dir=REPO / "work"))
        root = parent / "appliance"
        war_dir = parent / "wars"
        war_dir.mkdir()
        for path in built.values():
            (war_dir / path.name).symlink_to(path)
        log_path = parent / "launcher.log"
        command = [str(LAUNCHER), "--port-base", str(PORT_BASE), "--tomcat-home", tomcat,
                   "--war-dir", str(war_dir), "--stop-timeout", str(STOP_TIMEOUT), str(root)]
        env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
        owned = []
        with log_path.open("w") as log:
            launcher = subprocess.Popen(command, cwd=REPO, env=env, stdout=log, stderr=subprocess.STDOUT)
        try:
            status_file = root / "status"
            deadline = time.monotonic() + START_DEADLINE
            while time.monotonic() < deadline:
                self.assertIsNone(launcher.poll(), f"launcher exited during startup; see {log_path}")
                if status_file.exists() and status_file.read_text().strip() == "ready":
                    break
                time.sleep(0.5)
            self.assertEqual(status_file.read_text().strip(), "ready", f"appliance not ready; see {log_path}")
            owned = read_children(root / "children.tsv")
            self.assertEqual(sorted(name for name, _, _ in owned), ["engine", "etl", "mgmt", "retrieval"])

            retrieval = next((pid, start) for name, pid, start in owned if name == "retrieval")
            self.assertTrue(same_process_alive(*retrieval))
            os.kill(retrieval[0], signal.SIGKILL)

            code = launcher.wait(timeout=STOP_DEADLINE)
            output = log_path.read_text()
            status = status_file.read_text().strip()
            remaining = [name for name, pid, start in owned if same_process_alive(pid, start)]
            (parent / "observation.txt").write_text(
                f"launcher exit {code}\nstatus {status}\nremaining {remaining}\nchildren.tsv after: "
                f"{read_children(root / 'children.tsv')}\n--- launcher output\n{output}")
            self.assertEqual(code, 1, f"launcher exit status; see {parent}")
            self.assertIn(EXIT_LINE, output, f"launcher did not name the ended component; see {parent}")
            self.assertEqual(status, "stopped", f"status after the stop; see {parent}")
            self.assertEqual(remaining, [], f"components left running; see {parent}")
        finally:
            if launcher.poll() is None:
                launcher.send_signal(signal.SIGTERM)
                try:
                    launcher.wait(timeout=STOP_DEADLINE)
                except subprocess.TimeoutExpired:
                    launcher.kill()
            for _, pid, start in owned:
                if same_process_alive(pid, start):
                    os.kill(pid, signal.SIGKILL)
            print(f"Evidence retained: {parent}", flush=True)


if __name__ == "__main__":
    unittest.main()
