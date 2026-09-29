#!/usr/bin/env python3
"""Submit archive requests and report acceptance without claiming data collection."""

import sys

from archiverClient import (
    ClientError, _request, check_disjoint, diagnostic, normalized, parser_for,
    print_results, read_pvs, resolve_inputs, result_row, sampling_period, text_field,
)

ACCEPTED = {"Archive request submitted", "Already submitted"}


def main(argv=None):
    parser = parser_for(__doc__)
    parser.add_argument("--sampling-method", choices=("MONITOR", "SCAN"), default="MONITOR")
    parser.add_argument("--sampling-period", type=sampling_period, default="1",
                        help="positive finite float32 seconds (default: 1); server minimum applies")
    args = parser.parse_args(argv)
    records = read_pvs(parser, args.file)
    try:
        resolved = resolve_inputs(parser, args, records)
    except ClientError as exc:
        diagnostic(f"preflight failed; no archive requests sent: {exc}")
        return 1
    rows = []
    failures = 0
    for _, name, target, real in resolved:
        status = "Outcome unknown"
        try:
            body = _request(args.bpl_url, "archivePV", args.timeout, data=[{
                "pv": target, "samplingmethod": args.sampling_method, "samplingperiod": args.sampling_period,
            }])
            row = result_row(body)
            if row["pvName"] not in {real, real.split(".", 1)[0]}:
                raise ClientError("archive response identifies another PV")
            if row.get("validation"):
                status = "Rejected"
                raise ClientError(row["validation"])
            actual = text_field(row.get("status"), "archive status")
            if actual not in ACCEPTED:
                raise ClientError(f"archive request was not confirmed: {actual}")
            status = actual
        except ClientError as exc:
            failures += 1
            diagnostic(f"{name}: {status}: {exc}; check actual status before retrying")
        rows.append((name, status))
    print_results(rows, failures)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
