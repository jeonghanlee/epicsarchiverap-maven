#!/usr/bin/env python3
"""Report appliance status for each PV in an explicit input file."""

import sys

from archiverClient import (
    ClientError, STATUS_VALUES, _request, diagnostic, parser_for,
    print_results, read_pvs, result_row, text_field,
)


def main(argv=None):
    parser = parser_for(__doc__)
    args = parser.parse_args(argv)
    records = read_pvs(parser, args.file)
    rows = []
    failures = 0
    for _, name in records:
        try:
            row = result_row(_request(args.bpl_url, "getPVStatus", args.timeout, {"pv": name}))
            if row["pvName"] != name:
                raise ClientError("status response identifies another PV")
            if row.get("validation"):
                raise ClientError(row["validation"])
            status = text_field(row.get("status"), "status")
            if status not in STATUS_VALUES:
                raise ClientError(f"unrecognized appliance status: {status}")
        except ClientError as exc:
            failures += 1
            status = "Query failed"
            diagnostic(f"{name}: {exc}")
        rows.append((name, status))
    print_results(rows, failures)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
