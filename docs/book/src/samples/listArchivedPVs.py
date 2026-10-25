#!/usr/bin/env python3
"""Print archived PV names from an explicit management BPL URL."""

import argparse
from http.client import HTTPException
import json
import math
import socket
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

DEFAULT_TIMEOUT = 30.0
MAX_TIMEOUT = 86400.0
UNLIMITED = -1
MAX_LIMIT = 2147483647


def bpl_url(value):
    """Require an HTTP BPL base URL without query parameters or credentials."""
    try:
        parsed = urlsplit(value)
        port = parsed.port
        valid = (
            parsed.scheme in ("http", "https")
            and parsed.hostname
            and (port is None or 1 <= port <= 65535)
            and parsed.path.rstrip("/").endswith("/bpl")
            and parsed.username is None
            and parsed.password is None
            and not parsed.query
            and not parsed.fragment
            and not any(character.isspace() for character in value)
        )
    except ValueError:
        valid = False
    if not valid:
        raise argparse.ArgumentTypeError("expected an HTTP(S) BPL base URL ending in /bpl")
    return value.rstrip("/")


def positive_timeout(value):
    try:
        seconds = float(value)
    except ValueError:
        seconds = 0
    if not math.isfinite(seconds) or not 0 < seconds <= MAX_TIMEOUT:
        raise argparse.ArgumentTypeError(f"timeout must be greater than 0 and at most {MAX_TIMEOUT:g} seconds")
    return seconds


def pv_limit(value):
    try:
        limit = int(value)
    except ValueError:
        limit = 0
    if limit != UNLIMITED and not 1 <= limit <= MAX_LIMIT:
        raise argparse.ArgumentTypeError(f"limit must be -1 or between 1 and {MAX_LIMIT}")
    return limit


def pv_glob(value):
    if not value or any(character in value for character in "\r\n\x00"):
        raise argparse.ArgumentTypeError("glob must be nonempty and contain no line breaks or NUL")
    return value


def _request(url, timeout):
    """Read and validate the getAllPVs response before producing any output."""
    request = Request(url, headers={"Accept": "application/json"})
    with urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise ValueError(f"HTTP {response.status}; expected 200")
        try:
            names = json.load(response)
        except (ValueError, UnicodeError) as exc:
            raise ValueError("response is not valid JSON") from exc
    if not isinstance(names, list) or any(
        not isinstance(name, str) or not name or any(c in name for c in "\r\n\x00")
        for name in names
    ):
        raise ValueError("expected a JSON array of nonempty PV name strings")
    return names


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bpl_url", type=bpl_url, help="management URL, such as http://localhost:17665/mgmt/bpl")
    parser.add_argument("--glob", type=pv_glob, help="server PV glob; quote * and ? to avoid shell expansion")
    parser.add_argument("--limit", type=pv_limit, default=UNLIMITED, help="server match limit; -1 returns all names (default)")
    parser.add_argument("--timeout", type=positive_timeout, default=DEFAULT_TIMEOUT,
                        help="connect/read timeout in seconds, at most 86400 (default: 30)")
    args = parser.parse_args(argv)
    params = {"limit": args.limit}
    if args.glob is not None:
        params["pv"] = args.glob
    try:
        names = _request(args.bpl_url + "/getAllPVs?" + urlencode(params), args.timeout)
        output = "".join(name + "\n" for name in sorted(set(names)))
        # Validate the complete result before a malformed name can produce partial output.
        for encoding in {"utf-8", sys.stdout.encoding or "utf-8"}:
            try:
                output.encode(encoding, errors="strict")
            except UnicodeError as exc:
                raise ValueError(f"PV names cannot be encoded as {encoding}") from exc
    except HTTPError as exc:
        print(f"error: HTTP {exc.code}: {exc.reason}", file=sys.stderr)
        return 1
    except (TimeoutError, socket.timeout):
        print(f"error: request timed out after {args.timeout:g} seconds", file=sys.stderr)
        return 1
    except URLError as exc:
        if isinstance(exc.reason, (TimeoutError, socket.timeout)):
            print(f"error: request timed out after {args.timeout:g} seconds", file=sys.stderr)
        else:
            print(f"error: request failed: {exc.reason}", file=sys.stderr)
        return 1
    except (HTTPException, OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    sys.stdout.write(output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
