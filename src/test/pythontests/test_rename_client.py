"""Run shipped mutation CLIs with only the outer HTTP boundary controlled."""

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
MUTATIONS = {"renamePV", "archivePV", "pauseArchivingPV", "resumeArchivingPV"}
SCRIPTS = ("renamePVList.py", "archivePVList.bash", "pausePVList.py", "resumePVList.py")


class RenameClientTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.file = Path(self.folder.name) / "pairs.txt"
        self.file.write_text("TEST:A,TEST:X\nTEST:B,TEST:Y\n", encoding="utf-8")
        self.requests, self.redirect_requests = [], []
        self.received, self.executions = [], []
        self.aliases, self.types, self.responses = [], {}, {}
        self.raw, self.redirect = None, None
        self.code, self.delay, self.truncated = 200, 0, False
        self.read_redirect = False
        case = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.respond()

            def do_POST(self):
                self.respond()

            def respond(self):
                url = urlsplit(self.path)
                action = url.path.rsplit("/", 1)[-1]
                params = parse_qs(url.query)
                payload = json.loads(self.rfile.read(int(self.headers["Content-Length"]))) \
                    if self.command == "POST" else None
                request = {"method": self.command, "action": action, "params": params,
                           "payload": payload, "path": self.path, "server_port": self.server.server_port}
                case.received.append(request)
                if action == "redirect-target":
                    case.redirect_requests.append(request)
                    code, body = 200, [{"pvName": "TEST:A", "status": "Paused"}]
                else:
                    case.requests.append(request)
                    code = 200
                    if action == "getAllAliases":
                        body = case.aliases
                    elif action == "getPVTypeInfo":
                        code, body = case.types.get(params["pv"][0], (404, {}))
                    elif action == "getPVStatus":
                        name = params["pv"][0]
                        body = [{"pvName": name, "status": "Paused"}]
                        if case.read_redirect:
                            code = 302
                    else:
                        name = params["pv"][0] if action == "renamePV" else (
                            payload[0]["pv"] if action == "archivePV" else payload[0])
                        body = case.responses.get(name, case.success(action, name))
                        code = case.code
                        if case.redirect and name == "TEST:A":
                            code = case.redirect[0]
                data = json.dumps(body).encode()
                if action in MUTATIONS:
                    time.sleep(case.delay)
                    if case.raw is not None:
                        data = case.raw
                try:
                    self.send_response(code)
                    if case.redirect and action in MUTATIONS and name == "TEST:A":
                        self.send_header("Location", case.redirect[1])
                    if case.read_redirect and action == "getPVStatus":
                        self.send_header("Location", case.url + "/redirect-target")
                    self.send_header("Content-Length", str(len(data) + (10 if case.truncated else 0)))
                    self.end_headers()
                    self.wfile.write(data)
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def log_message(self, *args):
                pass

        self.servers = [ThreadingHTTPServer(("127.0.0.1", 0), Handler) for _ in range(2)]
        self.threads = [threading.Thread(target=s.serve_forever, daemon=True) for s in self.servers]
        for thread in self.threads:
            thread.start()
        self.url = f"http://127.0.0.1:{self.servers[0].server_port}/mgmt/bpl"

    def tearDown(self):
        for server, thread in zip(self.servers, self.threads):
            server.shutdown()
            server.server_close()
            thread.join()
        evidence = SAMPLES.parents[3] / "work/rename-client-evidence"
        evidence.mkdir(parents=True, exist_ok=True)
        path = evidence / f"{self._testMethodName}-{os.getpid()}-{time.time_ns()}.json"
        path.write_text(json.dumps({"requests": self.received, "executions": self.executions}, indent=2) + "\n")
        self.folder.cleanup()

    @staticmethod
    def success(action, name):
        if action == "renamePV":
            return {"status": "ok", "desc": "Copied", "validation": ""}
        if action == "archivePV":
            return [{"pvName": name, "status": "Archive request submitted"}]
        row = {"pvName": name, "status": "ok"}
        for component in ("engine", "etl") if action.startswith("pause") else ("engine",):
            row.update({component + "_pvName": name, component + "_status": "ok"})
        return [row]

    def cli(self, *options, script="renamePVList.py", url=None, file=None, env=None):
        path = file or self.file
        command = ["bash" if script.endswith(".bash") else sys.executable, str(SAMPLES / script), url or self.url, str(path), *options]
        result = subprocess.run(command, capture_output=True, text=True, timeout=8,
                                env={**os.environ, "NO_PROXY": "*", "no_proxy": "*",
                                     "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "ascii",
                                     **(env or {})})
        self.executions.append({"command": command, "input_hex": path.read_bytes().hex() if path.exists() else None,
                                "exit": result.returncode, "stdout": result.stdout, "stderr": result.stderr})
        return result

    def check(self, result, code, message=""):
        self.assertEqual(result.returncode, code, result.stderr)
        self.assertNotIn("Traceback", result.stderr)
        if message:
            self.assertIn(message, result.stderr)
        elif code == 0:
            self.assertEqual(result.stderr, "")

    def mutations(self):
        return [r for r in self.requests if r["action"] in MUTATIONS]

    def test_table_and_get_parameters(self):
        result = self.cli()
        self.check(result, 0)
        dash = "-----------   -----------   ---------------"
        self.assertEqual(result.stdout, "\n".join((dash, "Old PV Name   New PV Name   Status", dash,
                         "TEST:A        TEST:X        Rename accepted", "TEST:B        TEST:Y        Rename accepted",
                         dash, "Total 2   Successful 2   Failed 0", "")))
        self.assertEqual([(r["method"], r["params"], r["payload"]) for r in self.mutations()], [
            ("GET", {"pv": [a], "newname": [b]}, None) for a, b in (("TEST:A", "TEST:X"), ("TEST:B", "TEST:Y"))])

    def test_canonical_aliases_and_literal_hash_encoding(self):
        self.aliases = [{"aliasName": "TEST:alias", "srcPVName": "TEST:A"},
                        {"aliasName": "TEST:dest", "srcPVName": "TEST:X"}]
        self.file.write_text(" ca://TEST:alias.VAL , pva://TEST:dest.VAL\r\n\nTEST:#C, TEST:Z&=+\n")
        self.check(self.cli(), 0)
        self.assertEqual([r["params"] for r in self.mutations()], [
            {"pv": ["TEST:A"], "newname": ["TEST:X"]}, {"pv": ["TEST:#C"], "newname": ["TEST:Z&=+"]}])
        self.assertIn("%23", self.mutations()[1]["path"])
        self.assertIn("%26%3D%2B", self.mutations()[1]["path"])
        lookups = [r["params"]["pv"][0] for r in self.requests if r["action"] == "getPVTypeInfo"]
        self.assertEqual(lookups, ["TEST:A", "TEST:X", "TEST:#C", "TEST:Z&=+"])

    def test_local_syntax_and_names_send_no_http(self):
        for text in ("", "\n", "TEST:A", "TEST:A,", ",TEST:X", "TEST:A,TEST:X,TEST:Y",
                     "TEST:A,TEST:B\nTEST:C", "TEST:A x,TEST:X", "TEST:*A,TEST:X", "TEST:A,TEST:?X",
                     "TEST:\u00e9,TEST:X", ".VAL,TEST:X", "TEST:A.VALA,TEST:X", "TEST:A,TEST:X.VAL.[0:1]",
                     "ca://pva://TEST:A,TEST:X", "TEST:A,TEST:X."):
            with self.subTest(text=text):
                self.file.write_text(text)
                self.check(self.cli(), 2)
        self.file.write_bytes(b"\xff")
        self.check(self.cli(), 2)
        self.check(self.cli(file=self.file.parent / "absent"), 2)
        self.file.write_text("TEST:A,TEST:X\n")
        for timeout in ("0", "-1", "nan", "inf", "86401"):
            self.check(self.cli("--timeout", timeout), 2)
        self.check(self.cli(url=self.url + "?bad=1"), 2)
        self.assertEqual(self.requests, [])

    def test_local_identity_conflicts_report_columns(self):
        for text in ("TEST:A,TEST:A.VAL", "TEST:A,TEST:X\nca://TEST:A.VAL,TEST:Y",
                     "TEST:A,TEST:X\nTEST:B,TEST:X.VAL", "TEST:A,TEST:X\nTEST:X,TEST:Y",
                     "TEST:A,TEST:X\nTEST:B,TEST:A.HIHI"):
            with self.subTest(text=text):
                self.file.write_text(text)
                result = self.cli()
                self.check(result, 2, "column")
                self.assertIn("line 1", result.stderr)
        self.assertEqual(self.requests, [])

    def test_remote_conflicts_send_only_preflight_requests(self):
        for aliases in ([{"aliasName": "TEST:X", "srcPVName": "TEST:A"}],
                        [{"aliasName": "TEST:Y", "srcPVName": "TEST:X"}],
                        [{"aliasName": "TEST:B", "srcPVName": "TEST:X"}]):
            self.aliases = aliases
            self.requests.clear()
            self.check(self.cli(), 2, "column")
            self.assertFalse(self.mutations())

    def test_bad_aliases_and_type_info_fail_preflight(self):
        variants = [({}, {}), ([None], {}),
                    ([{"aliasName": "TEST:A", "srcPVName": "ca://pva://TEST:Q"}], {}),
                    ([{"aliasName": "TEST:A", "srcPVName": "TEST:B"},
                      {"aliasName": "TEST:B", "srcPVName": "TEST:A"}], {}),
                    ([{"aliasName": "TEST:Q", "srcPVName": "TEST:R"},
                      {"aliasName": "ca://TEST:Q.VAL", "srcPVName": "TEST:R"}], {}),
                    ([], {"TEST:X": (503, {})}), ([], {"TEST:A": (200, [])}),
                    ([], {"TEST:A": (200, {"pvName": "TEST:other"})}),
                    ([], {"TEST:A": (200, {"pvName": "TEST:A.VAL.[0:1]"})})]
        for aliases, types in variants:
            self.aliases, self.types = aliases, types
            self.requests.clear()
            self.check(self.cli(), 1, "preflight failed")
            self.assertFalse(self.mutations())

    def test_failure_in_every_position_continues(self):
        pairs = [("TEST:A", "TEST:X"), ("TEST:B", "TEST:Y"), ("TEST:C", "TEST:Z")]
        self.file.write_text("\n".join(a + "," + b for a, b in pairs))
        for source, _ in pairs:
            self.responses = {source: {"validation": "copy failed"}}
            self.requests.clear()
            result = self.cli()
            self.check(result, 1, "copy failed")
            self.assertIn("Total 3   Successful 2   Failed 1", result.stdout)
            rows = [re.split(r" {3,}", r) for r in result.stdout.splitlines() if r.startswith("TEST:")]
            self.assertEqual(rows, [[a, b, "Outcome unknown" if a == source else "Rename accepted"] for a, b in pairs])
            self.assertEqual([r["params"]["pv"][0] for r in self.mutations()], [a for a, _ in pairs])

    def test_response_structure_and_optional_field_types(self):
        for body in (None, [], {}, {"status": True}, {"status": "failed"},
                     {"status": "ok", "validation": "copy failed"}, {"status": "ok", "validation": False},
                     {"status": "ok", "desc": []}, {"status": "ok", "description": 1}):
            self.responses = {"TEST:A": body}
            result = self.cli()
            self.check(result, 1)
            self.assertIn("Successful 1   Failed 1", result.stdout)

    def test_http_json_and_incomplete_responses(self):
        for code, raw in ((200, b"{"), (200, b"{}{}"), (500, b"error"), (204, b""), (300, b"{}")):
            self.code, self.raw = code, raw
            self.requests.clear()
            result = self.cli()
            self.check(result, 1)
            self.assertIn("Successful 0   Failed 2", result.stdout)
            self.assertEqual(len(self.mutations()), 2)
        self.code, self.raw, self.truncated = 200, None, True
        self.check(self.cli(), 1, "incomplete response")

    def test_closed_port(self):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            self.check(self.cli(url=f"http://127.0.0.1:{sock.getsockname()[1]}/mgmt/bpl"), 1, "request failed")
        self.assertFalse(self.mutations())

    def test_timeout_is_bounded_and_not_retried(self):
        self.file.write_text("TEST:A,TEST:X\n")
        self.delay = 10
        started = time.monotonic()
        self.check(self.cli("--timeout", "1"), 1, "timed out")
        self.assertLess(time.monotonic() - started, 5)
        self.assertEqual(len(self.mutations()), 1)

    def test_mutation_redirects_never_follow_location(self):
        for script in SCRIPTS:
            self.file.write_text("TEST:A,TEST:X\nTEST:B,TEST:Y\n" if script.startswith("rename") else "TEST:A\nTEST:B\n")
            for status in (301, 302, 303, 307, 308):
                for server in self.servers:
                    with self.subTest(script=script, status=status, port=server.server_port):
                        self.redirect = (status, f"http://127.0.0.1:{server.server_port}/redirect-target")
                        self.requests.clear()
                        self.redirect_requests.clear()
                        result = self.cli(script=script)
                        self.check(result, 1, f"HTTP {status}")
                        self.assertIn("Outcome unknown", result.stdout)
                        self.assertIn("Total 2   Successful 1   Failed 1", result.stdout)
                        self.assertEqual(len(self.mutations()), 2)
                        self.assertEqual(self.redirect_requests, [])

    def test_read_only_status_still_succeeds(self):
        self.file.write_text("TEST:A\n")
        self.read_redirect = True
        self.check(self.cli(script="getPVStatus.py"), 0)
        self.assertFalse(self.mutations())
        self.assertEqual(len(self.redirect_requests), 1)

    def test_archive_url_is_literal_and_each_action_is_sent_once(self):
        self.file.write_text("TEST:A\n")
        origin = self.url.rsplit("/mgmt/bpl", 1)[0]
        for base in ("/mgmt/{literal}/bpl", "/mgmt/{left,right}/bpl",
                     "/mgmt/[1-2]/bpl", "/mgmt/%7Bliteral%7D/bpl"):
            with self.subTest(base=base):
                self.requests.clear()
                self.received.clear()
                result = self.cli(script="archivePVList.bash", url=origin + base)
                self.check(result, 0)
                self.assertIn("Total 1   Successful 1   Failed 0", result.stdout)
                self.assertEqual([(r["method"], urlsplit(r["path"]).path) for r in self.received], [
                    ("GET", base + "/getAllAliases"),
                    ("GET", base + "/getPVTypeInfo"),
                    ("POST", base + "/archivePV"),
                ])
                self.assertEqual(self.mutations()[0]["payload"][0]["pv"], "TEST:A")

    def test_curl_config_cannot_enable_archive_redirects(self):
        self.file.write_text("TEST:A\n")
        (self.file.parent / ".curlrc").write_text("location\n")
        for code in (301, 302, 303, 307, 308):
            for server in self.servers:
                with self.subTest(code=code, port=server.server_port):
                    self.redirect = (code, f"http://127.0.0.1:{server.server_port}/redirect-target")
                    self.requests.clear()
                    self.redirect_requests.clear()
                    result = self.cli(script="archivePVList.bash", env={"CURL_HOME": str(self.file.parent)})
                    self.check(result, 1, f"HTTP {code}")
                    self.assertEqual(len(self.mutations()), 1)
                    self.assertEqual(self.redirect_requests, [])


if __name__ == "__main__":
    unittest.main()
