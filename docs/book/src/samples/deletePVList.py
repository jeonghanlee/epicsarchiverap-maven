#!/usr/bin/env python3
"""Remove paused PV configurations; optionally request stored-data deletion."""

import sys

from archiverClient import (
    ClientError, _request, diagnostic, operation_name, parser_for, print_results,
    read_pvs, resolve_inputs,
)


def accepted(body):
    """Require management acknowledgement without claiming complete PB erasure."""
    if not isinstance(body, dict):
        raise ClientError("expected a deletion result object")
    for field in ("validation", "desc", "description"):
        if field in body and not isinstance(body[field], str):
            raise ClientError(f"expected a string {field}")
    if body.get("validation"):
        raise ClientError(body["validation"])
    if body.get("status") != "ok":
        raise ClientError(f"deletion was not confirmed: {body.get('status')}; {body.get('desc', '')}")


def main(argv=None):
    parser = parser_for(__doc__)
    parser.add_argument("--delete-data", action="store_true",
                        help="request irreversible stored-data deletion (default: retain data)")
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
        diagnostic(f"preflight failed; no delete requests sent: {exc}")
        return 1
    rows, failures = [], 0
    for _, original, _, target in resolved:
        status = "Outcome unknown"
        try:
            body = _request(args.bpl_url, "deletePV", args.timeout,
                            params={"pv": target, "deleteData": str(args.delete_data).lower()}, mutation=True)
            accepted(body)
            status = "Delete accepted"
        except ClientError as exc:
            failures += 1
            diagnostic(f"{original}: Outcome unknown: {exc}; "
                       "inspect configuration and stored data before retrying")
        rows.append((original, status))
    print_results(rows, failures)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
