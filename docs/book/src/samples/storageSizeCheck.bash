#!/usr/bin/env bash
# Checks once for PVs whose estimated storage rate exceeds a limit, and exits. One GET
# /getStorageRateReport?limit=N returns the engines' top entries; the management service forwards
# the limit to every engine and concatenates their reports, so the limit applies per appliance.
# Each PV keeps the last rate the report gives for it. PVs above MAXSIZE GB per year are printed
# in descending rate under a "PVs with estimated storage greater than ..." line, each rate in the
# largest of B, KB, MB, GB and TB per year that keeps it at least 1, in steps of 1024, with three
# significant digits. The report drops an engine that does not answer.
#
# Usage: storageSizeCheck.bash [--limit N] [--timeout SEC] BPL_URL MAXSIZE
# Exit status: 0 nothing to report, 1 alert reported on stdout, 2 invalid arguments,
#              3 the check could not complete (stderr).

set -o nounset -o pipefail

SCRIPT_DIR="$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")"
# shellcheck source=archiverClient.bash
if ! source "$SCRIPT_DIR/archiverClient.bash"; then
    printf 'error: cannot load %s\n' "$SCRIPT_DIR/archiverClient.bash" >&2
    exit 1
fi

readonly DEFAULT_LIMIT=100
readonly NUMBER='^-?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][-+]?[0-9]+)?$'

# Reads "<name><TAB><GB per year>" lines and prints "PV: <name> Size: <value> <unit>/year" lines.
# The unit is the largest of B to TB that keeps the value at least 1, in steps of 1024; a value
# that rounds to 1024 moves to the next unit. Three significant digits, without an exponent.
# shellcheck disable=SC2016  # the $ references belong to awk
readonly FORMAT_RATES='
function digits(v) {
    if (v >= 100) return sprintf("%.0f", v)
    if (v >= 10) return sprintf("%.1f", v)
    if (v >= 1) return sprintf("%.2f", v)
    return sprintf("%#.3g", v)
}
function readable(gb,    v, i, text) {
    v = gb * 1024 * 1024 * 1024
    if (v == 0) return "0 B"
    i = 1
    while (v >= 1024 && i < 5) { v /= 1024; i++ }
    text = digits(v)
    while (text + 0 >= 1024 && i < 5) { v /= 1024; i++; text = digits(v) }
    while (text != digits(text + 0)) text = digits(text + 0)
    return text " " unit[i]
}
BEGIN { FS = "\t"; split("B KB MB GB TB", unit, " ") }
{ printf "PV: %s Size: %s/year\n", $1, readable($2 + 0) }
'

# Prints the usage text; with "help" on stdout and exit 0, otherwise on stderr and exit 2.
usage() {
    local text
    text="$(printf '%s\n' \
        "usage: $(basename -- "$0") [--limit N] [--timeout SEC] BPL_URL MAXSIZE" \
        "Report PVs whose estimated storage rate exceeds MAXSIZE GB per year." \
        "  BPL_URL        management BPL base URL, for example http://localhost:17665/mgmt/bpl" \
        "  MAXSIZE        rate limit in GB per year, a decimal number" \
        "  --limit N      report entries requested from each appliance, a positive integer (default $DEFAULT_LIMIT)" \
        "  --timeout SEC  limit for the request, greater than 0 and at most $ARC_MAX_TIMEOUT (default $ARC_DEFAULT_TIMEOUT)" \
        "Exit status: 0 nothing to report, 1 alert, 2 invalid arguments, 3 check incomplete.")"
    if [[ "${1:-}" == help ]]; then
        printf '%s\n' "$text"
        exit "$ARC_EXIT_OK"
    fi
    printf '%s\n' "$text" >&2
    exit "$ARC_EXIT_USAGE"
}

main() {
    local timeout="$ARC_DEFAULT_TIMEOUT" limit="$DEFAULT_LIMIT" bpl maxsize
    local -a positional=() lines=()
    while (( $# > 0 )); do
        case "$1" in
            --limit)
                (( $# >= 2 )) || usage
                limit="$2"
                shift 2
                ;;
            --timeout)
                (( $# >= 2 )) || usage
                timeout="$2"
                shift 2
                ;;
            -h|--help)
                usage help
                ;;
            --)
                shift
                positional+=("$@")
                break
                ;;
            -[a-zA-Z-]*)
                arc_error "unknown option: $1"
                usage
                ;;
            *)
                positional+=("$1")
                shift
                ;;
        esac
    done
    (( ${#positional[@]} == 2 )) || usage
    arc_require_tools || exit "$ARC_EXIT_USAGE"
    if ! bpl="$(arc_bpl_url "${positional[0]}")"; then
        arc_error "BPL URL must be an http or https URL ending in /bpl, without credentials, query or fragment"
        exit "$ARC_EXIT_USAGE"
    fi
    maxsize="${positional[1]}"
    if [[ ! "$maxsize" =~ $NUMBER ]]; then
        arc_error "MAXSIZE must be a decimal number of GB per year"
        exit "$ARC_EXIT_USAGE"
    fi
    if [[ ! "$limit" =~ ^[0-9]+$ ]] || (( 10#$limit < 1 )); then
        arc_error "--limit must be a positive integer"
        exit "$ARC_EXIT_USAGE"
    fi
    if ! arc_timeout "$timeout"; then
        arc_error "timeout must be greater than 0 and at most $ARC_MAX_TIMEOUT seconds"
        exit "$ARC_EXIT_USAGE"
    fi

    arc_make_tmp || exit "$ARC_EXIT_INCOMPLETE"
    arc_get "$timeout" "$ARC_TMP/report.json" "$bpl" getStorageRateReport "limit=$((10#$limit))" \
        || exit "$ARC_EXIT_INCOMPLETE"
    arc_json_check "$ARC_TMP/report.json" \
        'type == "array" and all(.[]; type == "object" and (.pvName | type == "string" and length > 0)
            and (.storageRate_GBperYear | type == "string" and test("^-?[0-9.]+([eE][-+]?[0-9]+)?$")))' \
        'a storage rate report array with pvName and a numeric storageRate_GBperYear' || exit "$ARC_EXIT_INCOMPLETE"
    mapfile -t lines < <(jq -r --arg max "$maxsize" '
        reduce .[] as $row ({}; .[$row.pvName] = $row.storageRate_GBperYear)
        | to_entries
        | map(select((.value | tonumber) > ($max | tonumber)))
        | sort_by(-(.value | tonumber))
        | .[] | "\(.key)\t\(.value)"' "$ARC_TMP/report.json" | LC_ALL=C awk "$FORMAT_RATES")
    if (( ${#lines[@]} == 0 )); then
        exit "$ARC_EXIT_OK"
    fi
    printf 'PVs with estimated storage greater than %s GB/year in %s\n' "$maxsize" "$bpl"
    printf '%s\n' "${lines[@]}"
    exit "$ARC_EXIT_FAILED"
}

main "$@"
