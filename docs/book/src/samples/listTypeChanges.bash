#!/usr/bin/env bash
# Lists the PVs that the engines report as dropping events because of a type change, with the
# type each PV started with and the type Channel Access now reports. One GET
# /getPVsByDroppedEventsTypeChange selects the PVs (paused PVs are excluded by the engines);
# one GET /getPVDetails per PV reads "Archiver DBR type (initial)" and "Archiver DBR type (from CA)",
# which the management service merges from the engine's details.
#
# A PV whose details cannot be read or lack either field is reported on stderr and the run
# continues; the run then exits 1. The management report drops an engine that does not answer,
# so an unavailable engine reads as an empty report.
#
# Usage: listTypeChanges.bash [--timeout SEC] BPL_URL
# Exit status: 0 every listed PV resolved, 1 request, response or per-PV failure, 2 invalid arguments.

set -o nounset -o pipefail

SCRIPT_DIR="$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")"
# shellcheck source=archiverClient.bash
if ! source "$SCRIPT_DIR/archiverClient.bash"; then
    printf 'error: cannot load %s\n' "$SCRIPT_DIR/archiverClient.bash" >&2
    exit 1
fi

readonly INITIAL_TYPE_FIELD="Archiver DBR type (initial)"
readonly CA_TYPE_FIELD="Archiver DBR type (from CA)"

# Prints the text left-justified in the width counted in characters, as Python's format does;
# printf's width counts bytes, which shortens the padding of non-ASCII text.
pad() {
    local text="$1" width="$2"
    printf '%s%*s' "$text" $(( width > ${#text} ? width - ${#text} : 0 )) ''
}

# Prints the usage text; with "help" on stdout and exit 0, otherwise on stderr and exit 2.
usage() {
    local text
    text="$(printf '%s\n' \
        "usage: $(basename -- "$0") [--timeout SEC] BPL_URL" \
        "List PVs that drop events because their type changed, with the previous and current type." \
        "  BPL_URL        management BPL base URL, for example http://localhost:17665/mgmt/bpl" \
        "  --timeout SEC  limit for each request, greater than 0 and at most $ARC_MAX_TIMEOUT (default $ARC_DEFAULT_TIMEOUT)")"
    if [[ "${1:-}" == help ]]; then
        printf '%s\n' "$text"
        exit "$ARC_EXIT_OK"
    fi
    printf '%s\n' "$text" >&2
    exit "$ARC_EXIT_USAGE"
}

main() {
    local timeout="$ARC_DEFAULT_TIMEOUT" bpl pv previous current status="$ARC_EXIT_OK"
    local -a positional=() pvs=()
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

    arc_make_tmp || exit "$ARC_EXIT_FAILED"
    arc_get "$timeout" "$ARC_TMP/report.json" "$bpl" getPVsByDroppedEventsTypeChange || exit "$ARC_EXIT_FAILED"
    arc_json_check "$ARC_TMP/report.json" \
        'type == "array" and all(.[]; type == "object" and (.pvName | type == "string" and length > 0))' \
        'a type-change report array of objects with pvName' || exit "$ARC_EXIT_FAILED"
    mapfile -t pvs < <(jq -r '.[].pvName' "$ARC_TMP/report.json")

    for pv in "${pvs[@]}"; do
        if ! arc_get "$timeout" "$ARC_TMP/details.json" "$bpl" getPVDetails "pv=$pv"; then
            arc_error "cannot read the details of $pv"
            status="$ARC_EXIT_FAILED"
            continue
        fi
        if ! arc_json_check "$ARC_TMP/details.json" \
            "type == \"array\" and ([.[] | select(type == \"object\" and (.name == \"$INITIAL_TYPE_FIELD\" or .name == \"$CA_TYPE_FIELD\")) | .name] | unique | length == 2)" \
            "details of $pv with both type fields"; then
            status="$ARC_EXIT_FAILED"
            continue
        fi
        previous="$(jq -r --arg f "$INITIAL_TYPE_FIELD" '[.[] | select(.name == $f)][-1].value | tostring' "$ARC_TMP/details.json")"
        current="$(jq -r --arg f "$CA_TYPE_FIELD" '[.[] | select(.name == $f)][-1].value | tostring' "$ARC_TMP/details.json")"
        printf 'PV: %s Previous %s Current %s\n' "$(pad "$pv" 40)" "$(pad "$previous" 20)" "$(pad "$current" 20)"
    done
    exit "$status"
}

main "$@"
