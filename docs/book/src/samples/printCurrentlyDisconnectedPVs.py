#!/usr/bin/env python3
"""Print a complete disconnection report from an explicit management BPL URL."""

import argparse
import os
import re
import sys

from archiverClient import ClientError, DEFAULT_TIMEOUT, _request, diagnostic, text_field
from listArchivedPVs import bpl_url, positive_timeout

EPOCH = re.compile(r"[0-9]+")
TIME_FIELDS = ("connectionLostAt", "lastKnownEvent")


def time_field(value, label):
    """Preserve server locale text while excluding controls and line separators."""
    if not isinstance(value, str) or not value or any(
        ord(c) < 32 or 127 <= ord(c) <= 159 or ord(c) in (0x2028, 0x2029) for c in value
    ):
        raise ClientError(f"expected a nonempty {label} time string without controls or line separators")
    return value


def validate_report(body):
    if not isinstance(body, list):
        raise ClientError("expected a JSON array for the disconnection report")
    identities = set()
    for row in body:
        if not isinstance(row, dict):
            raise ClientError("expected a disconnection report row object")
        key = (text_field(row.get("instance"), "instance"), text_field(row.get("pvName"), "pvName"))
        if key in identities:
            raise ClientError("duplicate (instance, pvName) in disconnection report")
        identities.add(key)
        for field in TIME_FIELDS:
            time_field(row.get(field), field)
        epoch = row.get("noConnectionAsOfEpochSecs")
        if not isinstance(epoch, str) or not EPOCH.fullmatch(epoch):
            raise ClientError("expected a nonnegative decimal noConnectionAsOfEpochSecs string")
        for field in ("hostName", "commandThreadID"):
            if field in row and not isinstance(row[field], str):
                raise ClientError(f"expected a string {field}")
    return sorted(body, key=lambda row: (row["instance"], row["pvName"]))


def render(rows, only_na=False, no_na=False):
    lines = []
    instance = None
    for row in rows:
        if only_na and row["connectionLostAt"] != "N/A":
            continue
        if not only_na and no_na and row["connectionLostAt"] == "N/A":
            continue
        if row["instance"] != instance:
            instance = row["instance"]
            lines.append(f"Appliance {instance}:")
        lines.append(f'{row["pvName"]} {row["connectionLostAt"]}')
    return "".join(line + "\n" for line in lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", type=bpl_url, help="explicit management URL ending in /bpl")
    parser.add_argument("--timeout", type=positive_timeout, default=DEFAULT_TIMEOUT,
                        help="connect/read timeout, greater than 0 and at most 86400 seconds (default: 30)")
    parser.add_argument("--onlyNA", action="store_true", help="include only literal connectionLostAt=N/A")
    parser.add_argument("--noNA", action="store_true", help="exclude literal connectionLostAt=N/A")
    args = parser.parse_args(argv)
    try:
        rows = validate_report(_request(args.url, "getCurrentlyDisconnectedPVs", args.timeout))
        output = render(rows, args.onlyNA, args.noNA)
        encoding = sys.stdout.encoding or "utf-8"
        try:
            output.encode(encoding, errors="strict")
        except UnicodeError as error:
            raise ClientError(f"report output cannot be encoded as {encoding}") from error
        sys.stdout.write(output)
        sys.stdout.flush()
    except BrokenPipeError as error:
        diagnostic(f"disconnection report unavailable: {error}")
        # Prevent interpreter shutdown from flushing the failed pipe again.
        descriptor = os.open(os.devnull, os.O_WRONLY)
        try:
            os.dup2(descriptor, sys.stdout.fileno())
        finally:
            os.close(descriptor)
        return 1
    except (ClientError, OSError, UnicodeError) as error:
        diagnostic(f"disconnection report unavailable: {error}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
