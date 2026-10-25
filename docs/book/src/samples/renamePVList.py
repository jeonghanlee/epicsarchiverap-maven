#!/usr/bin/env python3
"""Copy paused PV configuration and stored data while retaining both names."""

import sys

from archiverClient import (
    ClientError, _request, diagnostic, operation_name, parser_for, print_results,
    resolve_inputs,
)

HEADERS = ("Old PV Name", "New PV Name", "Status")


def read_pairs(parser, path):
    """Read a plain UTF-8 pair file and validate every name before HTTP."""
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        parser.error(f"cannot read pair file: {exc}")
    pairs = []
    for line, raw in enumerate(text.split("\n"), 1):
        if not raw.strip():
            continue
        parts = [part.strip() for part in raw.split(",")]
        if len(parts) != 2 or not all(parts):
            parser.error(f"line {line}: expected two nonempty PV names separated by one comma")
        for role, name in zip(("old", "new"), parts):
            try:
                operation_name(name)
            except ClientError as exc:
                parser.error(f"line {line} {role} column: {exc}")
        pairs.append((line, *parts))
    if not pairs:
        parser.error("pair file contains no names")
    return pairs


def accepted(body):
    """Validate the actual rename acknowledgement without claiming copy completion."""
    if not isinstance(body, dict):
        raise ClientError("expected a rename result object")
    for field in ("validation", "desc", "description"):
        if field in body and not isinstance(body[field], str):
            raise ClientError(f"expected a string {field}")
    if body.get("validation"):
        raise ClientError(body["validation"])
    if body.get("status") != "ok":
        raise ClientError(f"rename was not confirmed: {body.get('status')}; {body.get('desc', '')}")


def main(argv=None):
    parser = parser_for(__doc__, "UTF-8 file with one old,new pair per line; no quoting or comments")
    args = parser.parse_args(argv)
    pairs = read_pairs(parser, args.file)
    records = [(line, name) for line, old, new in pairs for name in (old, new)]
    roles = [role for _ in pairs for role in ("old", "new")]
    try:
        resolved = resolve_inputs(parser, args, records, operation_name, roles)
    except ClientError as exc:
        diagnostic(f"preflight failed; no rename requests sent: {exc}")
        return 1
    rows, failures = [], 0
    for index, (_, old, new) in enumerate(pairs):
        source, destination = resolved[2 * index][3], resolved[2 * index + 1][3]
        status = "Outcome unknown"
        try:
            body = _request(args.bpl_url, "renamePV", args.timeout,
                            params={"pv": source, "newname": destination}, mutation=True)
            accepted(body)
            status = "Rename accepted"
        except ClientError as exc:
            failures += 1
            diagnostic(f"{old} -> {new}: Outcome unknown: {exc}; "
                       "check both configurations and stored samples before retrying")
        rows.append((old, new, status))
    print_results(rows, failures, HEADERS)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
