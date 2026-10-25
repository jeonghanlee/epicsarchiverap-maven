"""Exercise the shipped archiverClient.bash functions with only the outer HTTP boundary controlled."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
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
LIBRARY = REPO / "docs/book/src/samples/archiverClient.bash"


class ArchiverClientBashTest(unittest.TestCase):
    def setUp(self):
        self.body = b'["TEST:a"]'
        self.status = 200
        self.delay = 0
        self.truncated = False
        self.location = None
        self.requests = []
        case = self

        class Handler(BaseHTTPRequestHandler):
            def respond(self):
                time.sleep(case.delay)
                try:
                    self.send_response(case.status)
                    if case.location:
                        self.send_header("Location", case.location)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(case.body) + (10 if case.truncated else 0)))
                    self.end_headers()
                    self.wfile.write(case.body)
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def do_GET(self):
                case.requests.append(("GET", self.path, dict(self.headers), b""))
                self.respond()

            def do_POST(self):
                length = int(self.headers.get("Content-Length", "0"))
                case.requests.append(("POST", self.path, dict(self.headers), self.rfile.read(length)))
                self.respond()

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}/mgmt/bpl"
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.env = os.environ.copy()
        self.env.update(NO_PROXY="*", no_proxy="*")

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.tmp.cleanup()

    def bash(self, script, *args, env=None):
        command = f'source "{LIBRARY}"\n{script}'
        return subprocess.run(["bash", "-c", command, "bash", *args], text=True, capture_output=True,
                              timeout=10, env=env or self.env)

    def test_bpl_url_accepts_and_normalizes(self):
        for value, expected in [
            ("http://localhost:17665/mgmt/bpl", "http://localhost:17665/mgmt/bpl"),
            ("https://arch.example.org/mgmt/bpl//", "https://arch.example.org/mgmt/bpl"),
            ("http://[::1]:8080/bpl", "http://[::1]:8080/bpl"),
            ("http://arch_host:17665/mgmt/bpl", "http://arch_host:17665/mgmt/bpl"),
        ]:
            result = self.bash('arc_bpl_url "$1"', value)
            self.assertEqual(result.returncode, 0, value)
            self.assertEqual(result.stdout, expected + "\n")

    def test_bpl_url_rejects_invalid(self):
        for value in ["ftp://host/mgmt/bpl", "http://host/mgmt", "http://user:pw@host/mgmt/bpl",
                      "http://host/mgmt/bpl?x=1", "http://host/mgmt/bpl#f", "http://host:0/mgmt/bpl",
                      "http://host:65536/mgmt/bpl", "http://host/mg mt/bpl", "host/mgmt/bpl", ""]:
            result = self.bash('arc_bpl_url "$1"', value)
            self.assertEqual(result.returncode, 1, value)
            self.assertEqual(result.stdout, "")

    def test_timeout_bounds(self):
        for value in ["30", "0.5", ".25", "86400"]:
            self.assertEqual(self.bash('arc_timeout "$1"', value).returncode, 0, value)
        for value in ["0", "0.0", "-1", "86400.1", "1e3", "abc", "", "nan", "inf"]:
            self.assertNotEqual(self.bash('arc_timeout "$1"', value).returncode, 0, value)

    def test_read_rows_trims_skips_and_keeps_first_column(self):
        path = self.dir / "pvs.csv"
        path.write_bytes(b"  TEST:a , meta\r\n\n   \nTEST:b\n#TEST:c,x\nTEST:\xc3\xa9")
        result = self.bash('arc_read_rows "$1" && printf "%s|" "${ARC_NAMES[@]}" && echo && '
                           'printf "%s|" "${ARC_ROWS[@]}"', str(path))
        self.assertEqual(result.returncode, 0, result.stderr)
        names, rows = result.stdout.split("\n")
        self.assertEqual(names, "TEST:a|TEST:b|#TEST:c|TEST:é|")
        self.assertEqual(rows, "TEST:a , meta|TEST:b|#TEST:c,x|TEST:é|")

    def test_read_rows_rejects_empty_first_column_invalid_utf8_and_missing_file(self):
        empty = self.dir / "empty.csv"
        empty.write_text("TEST:a\n , meta\n")
        result = self.bash('arc_read_rows "$1"', str(empty))
        self.assertEqual(result.returncode, 1)
        self.assertIn("line 2: the first column is empty", result.stderr)
        invalid = self.dir / "invalid.csv"
        invalid.write_bytes(b"TEST:\xff\n")
        result = self.bash('arc_read_rows "$1"', str(invalid))
        self.assertEqual(result.returncode, 1)
        self.assertIn("not valid UTF-8", result.stderr)
        result = self.bash('arc_read_rows "$1"', str(self.dir / "absent.csv"))
        self.assertEqual(result.returncode, 1)
        self.assertIn("cannot read PV file", result.stderr)

    def test_get_encodes_parameters_and_stores_body(self):
        out = self.dir / "out.json"
        result = self.bash('arc_get 5 "$1" "$2" getPVDetails "pv=TEST:+&? x"', str(out), self.base)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(out.read_bytes(), self.body)
        method, path, headers, _ = self.requests[0]
        self.assertEqual(method, "GET")
        self.assertEqual(urlsplit(path).path, "/mgmt/bpl/getPVDetails")
        self.assertEqual(parse_qs(urlsplit(path).query), {"pv": ["TEST:+&? x"]})
        self.assertEqual(headers["Accept"], "application/json")

    def test_post_json_sends_exact_content_type_and_array(self):
        out = self.dir / "out.json"
        names = self.dir / "names.json"
        result = self.bash('arc_json_names "$1" "TEST:a" "TEST:\\"q\\"" "TEST:é" && '
                           'arc_post_json 5 "$2" "$3" unarchivedPVs "$1"', str(names), str(out), self.base)
        self.assertEqual(result.returncode, 0, result.stderr)
        method, path, headers, body = self.requests[0]
        self.assertEqual((method, path), ("POST", "/mgmt/bpl/unarchivedPVs"))
        self.assertEqual(headers["Content-Type"], "application/json")
        self.assertEqual(json.loads(body), ["TEST:a", 'TEST:"q"', "TEST:é"])

    def test_json_names_of_nothing_is_an_empty_array(self):
        names = self.dir / "names.json"
        result = self.bash('arc_json_names "$1"', str(names))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(names.read_text()), [])

    def test_non_200_status_fails(self):
        self.status = 500
        result = self.bash('arc_get 5 "$1" "$2" getAllPVs', str(self.dir / "o"), self.base)
        self.assertEqual(result.returncode, 1)
        self.assertIn("error: HTTP 500; expected 200", result.stderr)

    def test_redirect_is_not_followed(self):
        self.status = 302
        self.location = "/elsewhere"
        result = self.bash('arc_get 5 "$1" "$2" getAllPVs', str(self.dir / "o"), self.base)
        self.assertEqual(result.returncode, 1)
        self.assertIn("HTTP 302", result.stderr)
        self.assertEqual(len(self.requests), 1)

    def test_timeout_fails(self):
        self.delay = 2
        result = self.bash('arc_get 0.5 "$1" "$2" getAllPVs', str(self.dir / "o"), self.base)
        self.assertEqual(result.returncode, 1)
        self.assertIn("request timed out after 0.5 seconds", result.stderr)

    def test_truncated_body_fails(self):
        self.truncated = True
        result = self.bash('arc_get 5 "$1" "$2" getAllPVs', str(self.dir / "o"), self.base)
        self.assertEqual(result.returncode, 1)
        self.assertIn("request failed", result.stderr)

    def test_refused_connection_fails(self):
        port = self.server.server_port
        self.tearDown()
        self.setUp()
        result = self.bash('arc_get 2 "$1" "$2" getAllPVs', str(self.dir / "o"),
                           f"http://127.0.0.1:{port}/mgmt/bpl")
        self.assertEqual(result.returncode, 1)
        self.assertIn("request failed", result.stderr)

    def test_json_check(self):
        good = self.dir / "good.json"
        good.write_text('["a","b"]')
        bad = self.dir / "bad.json"
        bad.write_text('["a",')
        wrong = self.dir / "wrong.json"
        wrong.write_text('{"a":1}')
        two = self.dir / "two.json"
        two.write_text('5 ["a"]')
        empty = self.dir / "empty.json"
        empty.write_text('')
        check = 'arc_json_check "$1" "type == \\"array\\" and all(.[]; type == \\"string\\")" "a name array"'
        self.assertEqual(self.bash(check, str(good)).returncode, 0)
        for path in (bad, wrong, two, empty):
            result = self.bash(check, str(path))
            self.assertEqual(result.returncode, 1)
            self.assertIn("invalid or unexpected response: expected a name array", result.stderr)

    def test_sort_is_byte_order(self):
        result = self.bash('printf "b:x\\nB:y\\na_1\\nA-2\\n" | arc_sort')
        self.assertEqual(result.stdout.split(), sorted(["b:x", "B:y", "a_1", "A-2"]))

    def test_error_escapes_unprintable_bytes(self):
        result = self.bash('arc_error "$1"', "bad\x1bnameé")
        self.assertEqual(result.stderr, "error: bad?name??\n")

    def test_second_source_is_a_no_op(self):
        result = self.bash(f'source "{LIBRARY}" && echo "$ARC_EXIT_INCOMPLETE"')
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "3\n")
        self.assertEqual(result.stderr, "")

    def test_require_tools_reports_missing_tool(self):
        env = dict(self.env, PATH=str(self.dir))
        result = subprocess.run(["/bin/bash", "-c", f'source "{LIBRARY}"; arc_require_tools'], text=True,
                                capture_output=True, timeout=10, env=env)
        self.assertEqual(result.returncode, 1)
        self.assertIn("required tool not found: curl", result.stderr)


if __name__ == "__main__":
    unittest.main()
