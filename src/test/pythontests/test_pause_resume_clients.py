"""Exercise the actual pause/resume CLIs with only HTTP transport controlled."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from urllib.parse import parse_qs, urlsplit

SAMPLES = Path(__file__).resolve().parents[3] / "docs/book/src/samples"
SCRIPTS = ("pausePVList.py", "resumePVList.py")


class PauseResumeClientTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.file = Path(self.folder.name) / "pvs.txt"
        self.file.write_text("TEST:A\nTEST:B\n")
        self.requests = []
        self.aliases = []
        self.types = {}
        self.responses = {}
        self.raw = None
        self.code = 200
        self.delay = 0
        self.truncated = False
        case = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                url = urlsplit(self.path)
                action = url.path.rsplit("/", 1)[-1]
                params = parse_qs(url.query)
                case.requests.append(("GET", action, params, None))
                code, body = (200, case.aliases) if action == "getAllAliases" else case.types.get(
                    params["pv"][0], (404, {}))
                self.respond(code, json.dumps(body).encode())

            def do_POST(self):
                action = self.path.rsplit("/", 1)[-1]
                payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                case.requests.append(("POST", action, self.headers["Content-Type"], payload))
                name = payload[0]
                body = case.responses.get(name, [case.success(name, action.startswith("pause"))])
                time.sleep(case.delay)
                self.respond(case.code, case.raw if case.raw is not None else json.dumps(body).encode())

            def respond(self, code, data):
                try:
                    self.send_response(code)
                    self.send_header("Content-Length", str(len(data) + (10 if case.truncated else 0)))
                    self.end_headers()
                    self.wfile.write(data)
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}/mgmt/bpl"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.folder.cleanup()

    @staticmethod
    def success(name, pause):
        row = {"pvName": name, "status": "ok", "validation": ""}
        for component in ("engine", "etl") if pause else ("engine",):
            row.update({component + "_pvName": name, component + "_status": "ok",
                        component + "_validation": ""})
        return row

    def cli(self, script, *options, url=None, file=None):
        return subprocess.run([sys.executable, str(SAMPLES / script), url or self.url,
                               str(file or self.file), *options], capture_output=True, text=True,
                              timeout=8, env={**os.environ, "NO_PROXY": "*", "no_proxy": "*",
                                              "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "ascii"})

    def check(self, result, code, message=""):
        self.assertEqual(result.returncode, code, result.stderr)
        self.assertNotIn("Traceback", result.stderr)
        if message:
            self.assertIn(message, result.stderr)
        elif code == 0:
            self.assertEqual(result.stderr, "")

    def test_success_table_and_json_contract(self):
        for script in SCRIPTS:
            self.requests.clear()
            result = self.cli(script)
            self.check(result, 0)
            label = "Pause accepted" if script.startswith("pause") else "Resume accepted"
            dash = "-------   " + "-" * len(label)
            self.assertEqual(result.stdout, "\n".join((dash, "PV Name   Status", dash,
                             "TEST:A    " + label, "TEST:B    " + label, dash,
                             "Total 2   Successful 2   Failed 0", "")))
            self.assertEqual([r for r in self.requests if r[0] == "POST"], [
                ("POST", script[:6].rstrip("P") + "ArchivingPV", "application/json", [name])
                for name in ("TEST:A", "TEST:B")])

    def test_canonical_identity_and_original_display(self):
        for script in SCRIPTS:
            for name, target in (("ca://TEST:A.VAL", "TEST:A"), ("pva://TEST:A", "TEST:A"),
                                 ("TEST:A.HIHI", "TEST:A.HIHI"), ("TEST:alias", "TEST:A")):
                with self.subTest(script=script, name=name):
                    self.file.write_text(name + "\n")
                    self.aliases = [{"aliasName": "TEST:alias", "srcPVName": "TEST:A"}]
                    self.types[target] = (200, {"pvName": target})
                    self.requests.clear()
                    result = self.cli(script)
                    self.check(result, 0)
                    self.assertIn(name, result.stdout)
                    self.assertEqual([r[2]["pv"][0] for r in self.requests if r[1] == "getPVTypeInfo"], [target])
                    self.assertEqual([r[3] for r in self.requests if r[0] == "POST"], [[target]])

    def test_local_errors_send_no_http(self):
        for script in SCRIPTS:
            for value in ("", "TEST:A.VAL.[0:1]", "TEST:A.VALA", "TEST:A.", ".VAL", "TEST:A.*",
                          "TEST:A,TEST:B", "TEST:A x", "TEST:\u00e9", "TEST:A\nTEST:A.VAL",
                          "TEST:A\nca://TEST:A", "TEST:A\nTEST:A.HIHI"):
                with self.subTest(script=script, value=value):
                    self.file.write_text(value)
                    self.check(self.cli(script), 2)
            self.file.write_text("TEST:A\n")
            for timeout in ("0", "nan", "inf", "86401"):
                self.check(self.cli(script, "--timeout", timeout), 2)
            self.check(self.cli(script, file=self.file.parent / "absent"), 2)
            self.check(self.cli(script, url=self.url + "?bad=1"), 2)
            self.file.write_bytes(b"\xff")
            self.check(self.cli(script), 2)
        self.assertEqual(self.requests, [])

    def test_repeated_protocol_prefixes_send_no_mutations(self):
        for script in SCRIPTS:
            for name in ("ca://ca://TEST:A", "ca://pva://TEST:A", "pva://ca://TEST:A",
                         "pva://pva://TEST:A"):
                with self.subTest(script=script, name=name):
                    self.aliases = []
                    self.requests.clear()
                    self.file.write_text(name + "\n")
                    self.check(self.cli(script), 2)
                    self.assertEqual(self.requests, [])
                    self.file.write_text("TEST:alias\n")
                    self.aliases = [{"aliasName": "TEST:alias", "srcPVName": name}]
                    self.check(self.cli(script), 1)
                    self.assertFalse(any(r[0] == "POST" for r in self.requests))

    def test_preflight_failures_and_alias_collisions(self):
        for script in SCRIPTS:
            for aliases, types, code in (([{"aliasName": "TEST:B", "srcPVName": "TEST:A"}], {}, 2),
                    ([{"aliasName": "TEST:A", "srcPVName": "TEST:C.VAL.[0:1]"}], {}, 1),
                    ([{"aliasName": "TEST:A", "srcPVName": "TEST:B"},
                      {"aliasName": "TEST:B", "srcPVName": "TEST:A"}], {}, 1),
                    ({}, {}, 1), ([], {"TEST:A": (500, {})}, 1),
                    ([], {"TEST:A": (200, {"pvName": "TEST:wrong"})}, 1)):
                self.aliases, self.types = aliases, types
                self.check(self.cli(script), code)
        self.assertFalse(any(r[0] == "POST" for r in self.requests))

    def test_rejection_in_every_position_continues(self):
        names = ("TEST:A", "TEST:B", "TEST:C")
        self.file.write_text("\n".join(names))
        for script in SCRIPTS:
            for bad in names:
                self.responses = {bad: [{"pvName": bad, "validation": "already paused"}]}
                self.requests.clear()
                result = self.cli(script)
                self.check(result, 1, "already paused")
                self.assertIn("Rejected", result.stdout)
                self.assertIn("Total 3   Successful 2   Failed 1", result.stdout)
                self.assertEqual([r[3] for r in self.requests if r[0] == "POST"], [[n] for n in names])

    def test_component_failure_and_incomplete_contract_are_unknown(self):
        for script in SCRIPTS:
            pause = script.startswith("pause")
            base = self.success("TEST:A", pause)
            variants = [None, {}, [], [None], [base, base], [{**base, "pvName": "OTHER"}],
                        [{**base, "validation": "conflict"}], [{**base, "status": False}]]
            for component in ("engine", "etl") if pause else ("engine",):
                for field, value in (("status", "failed"), ("status", True), ("pvName", "OTHER"),
                                     ("validation", "component refused"), ("validation", False)):
                    variants.append([{**base, component + "_" + field: value}])
                for field in ("status", "pvName"):
                    variants.append([{k: v for k, v in base.items() if k != component + "_" + field}])
            for body in variants:
                with self.subTest(script=script, body=body):
                    self.responses = {"TEST:A": body}
                    result = self.cli(script)
                    self.check(result, 1)
                    self.assertIn("TEST:A    Outcome unknown", result.stdout)
                    self.assertIn("Successful 1   Failed 1", result.stdout)

    def test_transport_failures(self):
        for script in SCRIPTS:
            for code, raw in ((200, b"["), (500, b"error"), (204, b"")):
                self.code, self.raw = code, raw
                result = self.cli(script)
                self.check(result, 1)
                self.assertIn("Successful 0   Failed 2", result.stdout)
            self.code, self.raw = 200, None
            self.truncated = True
            self.check(self.cli(script), 1, "incomplete response")
            self.truncated = False
            with socket.socket() as sock:
                sock.bind(("127.0.0.1", 0))
                self.check(self.cli(script, url=f"http://127.0.0.1:{sock.getsockname()[1]}/mgmt/bpl"),
                           1, "request failed")

    def test_timeout_is_bounded_without_retry(self):
        self.file.write_text("TEST:A\n")
        self.delay = 10
        for script in SCRIPTS:
            self.requests.clear()
            started = time.monotonic()
            result = self.cli(script, "--timeout", "1")
            self.check(result, 1, "timed out")
            self.assertLess(time.monotonic() - started, 5)
            self.assertEqual(len([r for r in self.requests if r[0] == "POST"]), 1)


if __name__ == "__main__":
    unittest.main()
