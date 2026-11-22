#!/usr/bin/env bash
# Checks of the routines of the Analyzer pages under Node: the vendored D3 bundle and the shipped modules of
# src/main/org/epics/archiverappliance/staticcontent/js and of the data viewer, run by Node's own test runner over the
# files of src/test/js/analyzer. No package is installed. Node must read ES module syntax in a .js file, which Node 20.19,
# 22.7 and later do.
#
# Usage: bash scripts/ui-routine-checks.bash [--optional]
#   --optional  a missing or too old Node prints a notice and ends with status 0, for a job that may lack Node.
# Exit status 0 when every check passes; 1 when a check fails or, without --optional, Node is missing or too old.

set -euo pipefail

TOP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly TOP
TESTS="${TOP}/src/test/js/analyzer"
optional=0
[[ "${1:-}" == "--optional" ]] && optional=1

# Reports a missing or too old Node: a notice with status 0 under --optional, an error with status 1 otherwise.
_no_node() {
    if ((optional)); then
        printf 'ui-routine-checks: skipped, %s\n' "$1"
        exit 0
    fi
    printf 'ui-routine-checks: %s\n' "$1" >&2
    exit 1
}

command -v node > /dev/null 2>&1 || _no_node "node is not installed"
version="$(node --version)"
major="${version#v}"
major="${major%%.*}"
minor="${version#v*.}"
minor="${minor%%.*}"
# ES module syntax in a .js file is read from Node 20.19 and from Node 22.7.
if ((major < 20)) || ((major == 20 && minor < 19)) || ((major == 21)) || ((major == 22 && minor < 7)); then
    _no_node "node ${version} does not read ES module syntax in a .js file; use 20.19, 22.7 or later"
fi
printf 'ui-routine-checks: node %s\n' "${version}"

# The files are named one by one: the argument of the runner for a folder or a pattern differs between Node versions.
mapfile -t files < <(find "${TESTS}" -name '*.test.mjs' | sort)
((${#files[@]} > 0)) || { printf 'ui-routine-checks: no check files under %s\n' "${TESTS}" >&2; exit 1; }
exec node --test "${files[@]}"
