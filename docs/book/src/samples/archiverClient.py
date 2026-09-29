"""Shared transport, input validation and human-readable output for PV clients."""

import argparse
from http.client import HTTPException
import json
import math
from pathlib import Path
import struct
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from listArchivedPVs import bpl_url, positive_timeout

DEFAULT_TIMEOUT = 30.0
STATUS_VALUES = {
    "Not being archived", "Initial sampling", "Appliance assigned",
    "Being archived", "Paused", "Appliance Down",
}


class ClientError(Exception):
    """An HTTP or response failure, optionally carrying an HTTP status."""

    def __init__(self, message, code=None):
        super().__init__(message)
        self.code = code


def parser_for(description):
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("bpl_url", type=bpl_url, help="explicit management base URL ending in /bpl")
    parser.add_argument("file", type=Path, help="UTF-8 file with one explicit PV per line")
    parser.add_argument("--timeout", type=positive_timeout, default=DEFAULT_TIMEOUT,
                        help="connect/read timeout, greater than 0 and at most 86400 seconds (default: 30)")
    return parser


def read_pvs(parser, path):
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        parser.error(f"cannot read PV file: {exc}")
    records = []
    for line, raw in enumerate(text.split("\n"), 1):
        name = raw.strip()
        if not name:
            continue
        if any(ord(c) < 33 or ord(c) > 126 or c in ",*?" for c in name):
            parser.error(f"line {line}: use one printable ASCII PV name, without whitespace, commas or wildcards")
        records.append((line, name))
    if not records:
        parser.error("PV file contains no names")
    return records


def sampling_period(value):
    try:
        number = float(value)
        single = struct.unpack("!f", struct.pack("!f", number))[0]
    except (ValueError, OverflowError, struct.error):
        number = single = 0
    if not math.isfinite(number) or not math.isfinite(single) or number <= 0 or single <= 0:
        raise argparse.ArgumentTypeError("sampling period must be positive and representable as a finite float32")
    return str(number)


def _request(base, action, timeout, params=None, data=None):
    """Perform the sole HTTP path and require HTTP 200 with valid JSON."""
    url = base + "/" + action + ("?" + urlencode(params) if params else "")
    headers = {"Accept": "application/json"}
    payload = None
    if data is not None:
        payload = json.dumps(data, allow_nan=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    try:
        with urlopen(Request(url, data=payload, headers=headers), timeout=timeout) as response:
            if response.status != 200:
                raise ClientError(f"HTTP {response.status}; expected 200", response.status)
            return json.load(response)
    except HTTPError as exc:
        raise ClientError(f"HTTP {exc.code}: {exc.reason}", exc.code) from exc
    except URLError as exc:
        message = "request timed out" if isinstance(exc.reason, TimeoutError) else f"request failed: {exc.reason}"
        raise ClientError(message) from exc
    except TimeoutError as exc:
        raise ClientError(f"request timed out after {timeout:g} seconds") from exc
    except (HTTPException, OSError, ValueError) as exc:
        raise ClientError(f"invalid or incomplete response: {exc}") from exc


def text_field(value, label):
    if not isinstance(value, str) or not value or any(ord(c) < 32 or ord(c) > 126 for c in value):
        raise ClientError(f"expected a nonempty printable ASCII {label}")
    return value


def result_row(body):
    if not isinstance(body, list) or len(body) != 1 or not isinstance(body[0], dict):
        raise ClientError("expected exactly one PV result")
    row = body[0]
    text_field(row.get("pvName"), "pvName")
    if "validation" in row and not isinstance(row["validation"], str):
        raise ClientError("expected a string validation result")
    return row


def normalized(name):
    for prefix in ("ca://", "pva://"):
        if name.startswith(prefix):
            name = name[len(prefix):]
            break
    return name[:-4] if name.endswith(".VAL") else name


def check_disjoint(parser, records):
    """Reject shared record roots conservatively, including fields and protocols."""
    seen = {}
    for line, name in records:
        key = normalized(name).split(".", 1)[0]
        if key in seen:
            parser.error(f"lines {seen[key]} and {line}: overlapping PV identities ({name})")
        seen[key] = line


def diagnostic(message):
    safe = str(message).encode("ascii", "backslashreplace").decode("ascii")
    safe = "".join(c if 32 <= ord(c) <= 126 else f"\\x{ord(c):02x}" for c in safe)
    print(f"error: {safe}", file=sys.stderr)


def print_results(rows, failures):
    headers = ("PV Name", "Status")
    widths = [max(len(row[i]) for row in [headers, *rows]) for i in range(2)]
    separator = "   ".join("-" * width for width in widths)
    lines = [separator, f"{headers[0]:<{widths[0]}}   {headers[1]}", separator]
    lines.extend(f"{name:<{widths[0]}}   {status}" for name, status in rows)
    lines.extend((separator, f"Total {len(rows)}   Successful {len(rows) - failures}   Failed {failures}"))
    print("\n".join(lines))
