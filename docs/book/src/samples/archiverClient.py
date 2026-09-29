"""Shared transport, input validation and human-readable output for PV clients."""

import argparse
from http.client import HTTPException
import json
import math
from pathlib import Path
import re
import struct
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from listArchivedPVs import bpl_url, positive_timeout

DEFAULT_TIMEOUT = 30.0
FIELD_NAME = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
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


def resolve_inputs(parser, args, records, canonicalize=None):
    """Resolve configured aliases and reject overlapping identities before POST."""
    check_disjoint(parser, records)
    body = _request(args.bpl_url, "getAllAliases", args.timeout)
    if not isinstance(body, list):
        raise ClientError("expected an alias array")
    aliases = {}
    for row in body:
        if not isinstance(row, dict):
            raise ClientError("expected an alias object")
        alias = text_field(row.get("aliasName"), "alias name")
        real = text_field(row.get("srcPVName"), "alias target")
        if alias in aliases:
            raise ClientError("duplicate alias in response")
        aliases[alias] = real
    resolved = []
    for line, name in records:
        real = canonicalize(name) if canonicalize else normalized(name)
        visited = set()
        while real in aliases:
            if real in visited:
                raise ClientError("cyclic alias response")
            visited.add(real)
            real = canonicalize(aliases[real]) if canonicalize else aliases[real]
        try:
            info = _request(args.bpl_url, "getPVTypeInfo", args.timeout, {"pv": real})
        except ClientError as exc:
            if exc.code != 404:
                raise
        else:
            if not isinstance(info, dict):
                raise ClientError("expected a type-info object")
            identity = text_field(info.get("pvName"), "type-info pvName")
            if identity != real:
                raise ClientError("type-info identity contradicts the alias map")
        # Existing aliases name the configured target; other names retain their protocol/field.
        target = real if visited else name
        resolved.append((line, name, target, real))
    check_disjoint(parser, [(line, real) for line, _, _, real in resolved])
    return resolved


def operation_name(name):
    """Accept only names whose canonical form the bulk server preserves."""
    text_field(name, "PV name")
    if any(ord(c) < 33 or c in ",*?" for c in name):
        raise ClientError("unsupported PV name")
    for prefix in ("ca://", "pva://"):
        if name.startswith(prefix):
            name = name[len(prefix):]
            break
    if name.startswith(("ca://", "pva://")):
        raise ClientError("use at most one protocol prefix")
    parts = name.split(".")
    if not parts[0] or len(parts) > 2:
        raise ClientError("unsupported PV name or field modifier")
    if len(parts) == 2:
        field = parts[1]
        if not FIELD_NAME.fullmatch(field) or (field.startswith("VAL") and field != "VAL"):
            raise ClientError("unsupported PV field or field modifier")
    return name[:-4] if name.endswith(".VAL") else name


def pause_resume_result(body, target, pause):
    """Validate all component acknowledgements before reporting acceptance."""
    row = result_row(body)
    if row["pvName"] != target:
        raise ClientError("response identifies another PV")
    for key, value in row.items():
        if key.endswith("validation") and not isinstance(value, str):
            raise ClientError(f"expected a string {key}")
        if key.endswith("status"):
            text_field(value, key)
    if row.get("validation"):
        if "status" in row or any(key.startswith(("engine_", "etl_")) for key in row):
            raise ClientError(f"contradictory rejection: {row['validation']}")
        return row["validation"]
    for component in ("", "engine_", "etl_") if pause else ("", "engine_"):
        if row.get(component + "pvName") != target:
            raise ClientError(f"missing or wrong {component}pvName")
        if row.get(component + "validation"):
            raise ClientError(row[component + "validation"])
        if row.get(component + "status") != "ok":
            raise ClientError(f"{component}status did not confirm success: {row.get(component + 'status')}; "
                              f"{row.get(component + 'desc', '')}")
    return None


def pause_resume_main(pause, argv=None):
    verb = "pause" if pause else "resume"
    parser = parser_for(f"Request {verb} for existing PVs and report component acceptance.")
    args = parser.parse_args(argv)
    records = read_pvs(parser, args.file)
    for line, name in records:
        try:
            operation_name(name)
        except ClientError as exc:
            parser.error(f"line {line}: {exc}")
    try:
        resolved = resolve_inputs(parser, args, records, operation_name)
    except ClientError as exc:
        diagnostic(f"preflight failed; no {verb} requests sent: {exc}")
        return 1
    rows = []
    failures = 0
    for _, original, _, target in resolved:
        status = "Outcome unknown"
        try:
            body = _request(args.bpl_url, verb + "ArchivingPV", args.timeout, data=[target])
            rejection = pause_resume_result(body, target, pause)
            if rejection:
                status = "Rejected"
                raise ClientError(rejection)
            status = verb.capitalize() + " accepted"
        except ClientError as exc:
            failures += 1
            diagnostic(f"{original}: {status}: {exc}; check actual status before retrying")
        rows.append((original, status))
    print_results(rows, failures)
    return 1 if failures else 0
