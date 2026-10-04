#!/usr/bin/env bash
# Checks once whether any PV dropped events because its type changed, and exits. One GET
# /getPVsByDroppedEventsTypeChange returns the PVs the engines report (paused PVs excluded).
# When the report is not empty, "<count> PVs have changed type" and one PV name per line go to
# stdout; otherwise "No PVs have changed type". The management report drops an engine that does
# not answer, so an unavailable engine reads as an empty report.
#
# Usage: checkTypeChangedPVs.bash [--timeout SEC] BPL_URL
# Exit status: 0 nothing to report, 1 alert reported on stdout, 2 invalid arguments,
#              3 the check could not complete (stderr).

set -o nounset -o pipefail

SCRIPT_DIR="$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")"
# shellcheck source=archiverClient.bash
if ! source "$SCRIPT_DIR/archiverClient.bash"; then
    printf 'error: cannot load %s\n' "$SCRIPT_DIR/archiverClient.bash" >&2
    exit 1
fi

# Prints the usage text; with "help" on stdout and exit 0, otherwise on stderr and exit 2.
usage() {
    local text
    text="$(printf '%s\n' \
        "usage: $(basename -- "$0") [--timeout SEC] BPL_URL" \
        "Report PVs that drop events because their type changed." \
        "  BPL_URL        management BPL base URL, for example http://localhost:17665/mgmt/bpl" \
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
    local timeout="$ARC_DEFAULT_TIMEOUT" bpl count
    local -a positional=()
    while (( $# > 0 )); do
        case "$1" in
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
            -*)
                arc_error "unknown option: $1"
                usage
                ;;
            *)
                positional+=("$1")
                shift
                ;;
        esac
    done
    (( ${#positional[@]} == 1 )) || usage
    arc_require_tools || exit "$ARC_EXIT_USAGE"
    if ! bpl="$(arc_bpl_url "${positional[0]}")"; then
        arc_error "BPL URL must be an http or https URL ending in /bpl, without credentials, query or fragment"
        exit "$ARC_EXIT_USAGE"
    fi
    if ! arc_timeout "$timeout"; then
        arc_error "timeout must be greater than 0 and at most $ARC_MAX_TIMEOUT seconds"
        exit "$ARC_EXIT_USAGE"
    fi

    arc_make_tmp || exit "$ARC_EXIT_INCOMPLETE"
    arc_get "$timeout" "$ARC_TMP/report.json" "$bpl" getPVsByDroppedEventsTypeChange || exit "$ARC_EXIT_INCOMPLETE"
    arc_json_check "$ARC_TMP/report.json" \
        'type == "array" and all(.[]; type == "object" and (.pvName | type == "string" and length > 0))' \
        'a type-change report array of objects with pvName' || exit "$ARC_EXIT_INCOMPLETE"
    count="$(jq 'length' "$ARC_TMP/report.json")"
    if (( count == 0 )); then
        printf 'No PVs have changed type\n'
        exit "$ARC_EXIT_OK"
    fi
    printf '%d PVs have changed type\n' "$count"
    jq -r '.[].pvName' "$ARC_TMP/report.json"
    exit "$ARC_EXIT_FAILED"
}

main "$@"
