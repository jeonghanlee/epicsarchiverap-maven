"""Exercise the shipped deletion CLI with only the outer HTTP boundary controlled."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from urllib.parse import parse_qs, urlsplit

SAMPLES = Path(__file__).resolve().parents[3] / "docs/book/src/samples"


class DeleteClientTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.file = Path(self.folder.name) / "pvs.txt"
        self.file.write_text("TEST:A\nTEST:B\n")
        self.requests, self.redirect_requests = [], []
        self.executions = []
        self.aliases, self.types, self.responses = [], {}, {}
        self.code, self.raw, self.delay, self.redirect = 200, None, 0, None
        self.truncated = False
        case = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                url = urlsplit(self.path)
                action, params = url.path.rsplit("/", 1)[-1], parse_qs(url.query)
                entry = {"method": self.command, "action": action, "params": params}
                if action == "redirect-target":
                    case.redirect_requests.append(entry)
                else:
                    case.requests.append(entry)
                code = 200
                name = params.get("pv", [""])[0]
                if action == "getAllAliases":
                    body = case.aliases
                elif action == "getPVTypeInfo":
                    body = case.types.get(name, {"pvName": name})
                    if body == "absent":
                        code, body = 404, {}
                else:
                    body = case.responses.get(name, {"status": "ok", "validation": ""})
                    code = case.code
                    if case.redirect and name == "TEST:A":
                        code = case.redirect[0]
                    if case.delay:
                        time.sleep(case.delay)
                payload = case.raw if action == "deletePV" and case.raw is not None else json.dumps(body).encode()
                try:
                    self.send_response(code)
                    if case.redirect and action == "deletePV" and name == "TEST:A":
                        self.send_header("Location", case.redirect[1])
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(payload) + (20 if case.truncated else 0)))
                    self.end_headers()
                    self.wfile.write(payload)
                    self.close_connection = True
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def log_message(self, *args):
                pass

        self.servers = [ThreadingHTTPServer(("127.0.0.1", 0), Handler) for _ in range(2)]
        for server in self.servers:
            threading.Thread(target=server.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.servers[0].server_port}/mgmt/bpl"

    def tearDown(self):
        for server in self.servers:
            server.shutdown()
            server.server_close()
        evidence = SAMPLES.parents[3] / "work/delete-client-evidence"
        evidence.mkdir(parents=True, exist_ok=True)
        (evidence / (self._testMethodName + ".json")).write_text(json.dumps({
            "requests": self.requests, "redirect_requests": self.redirect_requests,
            "executions": self.executions,
        }, indent=2))
        self.folder.cleanup()

    def cli(self, *options, url=None, file=None):
        path = file or self.file
        command = [sys.executable, str(SAMPLES / "deletePVList.py"), url or self.url, str(path), *options]
        result = subprocess.run(command, capture_output=True, text=True, timeout=8,
                                env={**os.environ, "NO_PROXY": "*", "no_proxy": "*",
                                     "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "ascii"})
        self.executions.append({"command": command, "input_hex": path.read_bytes().hex() if path.exists() else None,
                                "exit": result.returncode, "stdout": result.stdout, "stderr": result.stderr,
                                "requests": list(self.requests), "redirect_requests": list(self.redirect_requests)})
        return result

    def mutations(self):
        return [r for r in self.requests if r["action"] == "deletePV"]

    def check(self, result, code, message=""):
        self.assertEqual(result.returncode, code, result.stderr)
        self.assertNotIn("Traceback", result.stderr)
        if message:
            self.assertIn(message, result.stderr)
        elif code == 0:
            self.assertEqual(result.stderr, "")

    def test_modes_and_exact_table(self):
        for options, mode in (((), "false"), (("--delete-data",), "true")):
            self.requests.clear()
            result = self.cli(*options)
            self.check(result, 0)
            dash = "-------   ---------------"
            self.assertEqual(result.stdout, "\n".join((dash, "PV Name   Status", dash,
                             "TEST:A    Delete accepted", "TEST:B    Delete accepted", dash,
                             "Total 2   Successful 2   Failed 0", "")))
            self.assertEqual(self.mutations(), [{"method": "GET", "action": "deletePV",
                             "params": {"pv": [name], "deleteData": [mode]}} for name in ("TEST:A", "TEST:B")])

    def test_canonical_alias_and_encoding(self):
        self.file.write_text(" ca://TEST:Alias.VAL \npva://TEST:Hash#Tag.VAL\n\n")
        self.aliases = [{"aliasName": "TEST:Alias", "srcPVName": "TEST:Real"}]
        self.check(self.cli(), 0)
        self.assertEqual([r["params"]["pv"][0] for r in self.mutations()], ["TEST:Real", "TEST:Hash#Tag"])
        self.assertEqual([r["params"]["pv"][0] for r in self.requests if r["action"] == "getPVTypeInfo"],
                         ["TEST:Real", "TEST:Hash#Tag"])

    def test_local_invalid_inputs_send_no_http(self):
        for content in ("", "\n", "TEST:*\n", "TEST:?\n", "TEST:A,TEST:B\n", "TEST:A B\n", "TEST:A\x00\n",
                        "TEST:\u00e9\n", "TEST:A.VAL$\n", "ca://pva://TEST:A\n", "TEST:A.VAL.more\n"):
            self.file.write_text(content)
            self.requests.clear()
            self.check(self.cli(), 2)
            self.assertEqual(self.requests, [])
        self.check(self.cli(file=Path(self.folder.name) / "missing"), 2)
        self.file.write_bytes(b"\xff")
        self.check(self.cli(), 2)
        self.assertEqual(self.requests, [])

    def test_invalid_timeout_and_url_send_no_http(self):
        for value in ("0", "-1", "nan", "inf", "86401"):
            self.check(self.cli("--timeout", value), 2)
        for url in ("http://user:password@localhost/mgmt/bpl", "http://localhost/mgmt", "file:///mgmt/bpl"):
            self.check(self.cli(url=url), 2)
        self.assertEqual(self.requests, [])

    def test_local_overlap_reports_lines(self):
        for content in ("TEST:A\nTEST:A\n", "ca://TEST:A.VAL\nTEST:A\n", "TEST:A.ADEL\nTEST:A\n"):
            self.file.write_text(content)
            self.check(self.cli(), 2, "lines 1 and 2")
            self.assertEqual(self.requests, [])

    def test_remote_overlap_sends_no_mutations(self):
        self.aliases = [{"aliasName": "TEST:A", "srcPVName": "TEST:B"}]
        self.check(self.cli(), 2, "lines 1 and 2")
        self.assertEqual(self.mutations(), [])

    def test_invalid_preflight_sends_no_mutations(self):
        for aliases in ({}, [None], [{"aliasName": "TEST:A", "srcPVName": ""}],
                        [{"aliasName": "TEST:A", "srcPVName": "TEST:A"}]):
            self.aliases = aliases
            self.check(self.cli(), 1, "preflight failed")
            self.assertEqual(self.mutations(), [])
        self.aliases = []
        for body in (None, [], {}, {"pvName": "TEST:Other"}, {"pvName": 1}):
            self.types = {"TEST:A": body}
            self.check(self.cli(), 1, "preflight failed")
            self.assertEqual(self.mutations(), [])

    def test_absence_does_not_skip_actual_mutation(self):
        self.types = {"TEST:A": "absent"}
        self.responses = {"TEST:A": {"validation": "Bad request"}}
        self.check(self.cli(), 1, "Bad request")
        self.assertEqual([r["params"]["pv"][0] for r in self.mutations()], ["TEST:A", "TEST:B"])

    def test_failed_item_in_each_position_continues_without_retry(self):
        names = ["TEST:A", "TEST:B", "TEST:C"]
        self.file.write_text("\n".join(names) + "\n")
        for mode in ((), ("--delete-data",)):
            for failed in names:
                self.requests.clear()
                self.responses = {failed: {"validation": "delete failed"}}
                result = self.cli(*mode)
                self.check(result, 1, "delete failed")
                rows = [re.split(r" {3,}", r) for r in result.stdout.splitlines() if r.startswith("TEST:")]
                self.assertEqual(rows, [[name, "Outcome unknown" if name == failed else "Delete accepted"]
                                        for name in names])
                self.assertEqual([r["params"]["pv"][0] for r in self.mutations()], names)
                self.assertIn("Total 3   Successful 2   Failed 1", result.stdout)

    def test_response_types_and_contradictions(self):
        for body in (None, [], {}, {"status": True}, {"status": "failed"},
                     {"status": "ok", "validation": "failed"}, {"status": "ok", "validation": False},
                     {"status": "ok", "desc": []}, {"status": "ok", "description": 1}):
            self.responses = {"TEST:A": body}
            result = self.cli()
            self.check(result, 1)
            self.assertIn("TEST:A    Outcome unknown", result.stdout)
            self.assertIn("Successful 1   Failed 1", result.stdout)
        self.responses = {"TEST:A": {"status": "ok"}}
        self.check(self.cli(), 0)

    def test_http_json_and_truncated_response(self):
        for code, raw in ((200, b"{"), (200, b"{}{}"), (400, b"error"), (500, b"error"), (204, b"")):
            self.code, self.raw = code, raw
            self.requests.clear()
            self.check(self.cli(), 1)
            self.assertEqual(len(self.mutations()), 2)
        self.code, self.raw, self.truncated = 200, None, True
        self.check(self.cli(), 1, "incomplete response")

    def test_closed_port(self):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            self.check(self.cli(url=f"http://127.0.0.1:{sock.getsockname()[1]}/mgmt/bpl"), 1, "request failed")
        self.assertEqual(self.mutations(), [])

    def test_timeout_is_bounded_without_retry(self):
        self.file.write_text("TEST:A\n")
        self.delay = 10
        began = time.monotonic()
        self.check(self.cli("--timeout", "1"), 1, "timed out")
        self.assertLess(time.monotonic() - began, 5)
        self.assertEqual(len(self.mutations()), 1)

    def test_redirects_never_follow_location(self):
        for code in (301, 302, 303, 307, 308):
            for server in self.servers:
                self.redirect = (code, f"http://127.0.0.1:{server.server_port}/redirect-target")
                self.requests.clear()
                self.redirect_requests.clear()
                result = self.cli()
                self.check(result, 1, f"HTTP {code}")
                self.assertIn("Total 2   Successful 1   Failed 1", result.stdout)
                self.assertEqual(len(self.mutations()), 2)
                self.assertEqual(self.redirect_requests, [])


if __name__ == "__main__":
    unittest.main()
