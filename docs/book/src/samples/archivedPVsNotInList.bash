#!/usr/bin/env bash
# Prints the configured PVs whose names are absent from the first column of a CSV file.
# "Configured" is the management service's getAllPVs set, without aliases or pending
# requests. One POST /archivedPVsNotInList carries all names as a JSON array; the returned
# names are printed one per line in byte order.
#
# Usage: archivedPVsNotInList.bash [--timeout SEC] BPL_URL FILE
# Exit status: 0 complete output, 1 request or response failure, 2 invalid arguments or input.

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
        "usage: $(basename -- "$0") [--timeout SEC] BPL_URL FILE" \
        "Print the configured PVs that do not appear in the first column of FILE." \
        "  BPL_URL        management BPL base URL, for example http://localhost:17665/mgmt/bpl" \
        "  FILE           UTF-8 CSV file; the first column of each row is a PV name" \
        "  --timeout SEC  limit for the request, greater than 0 and at most $ARC_MAX_TIMEOUT (default $ARC_DEFAULT_TIMEOUT)")"
    if [[ "${1:-}" == help ]]; then
        printf '%s\n' "$text"
        exit "$ARC_EXIT_OK"
    fi
    printf '%s\n' "$text" >&2
    exit "$ARC_EXIT_USAGE"
}

main() {
    local timeout="$ARC_DEFAULT_TIMEOUT" bpl file
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
    (( ${#positional[@]} == 2 )) || usage
    arc_require_tools || exit "$ARC_EXIT_USAGE"
    if ! bpl="$(arc_bpl_url "${positional[0]}")"; then
        arc_error "BPL URL must be an http or https URL ending in /bpl, without credentials, query or fragment"
        exit "$ARC_EXIT_USAGE"
    fi
    if ! arc_timeout "$timeout"; then
        arc_error "timeout must be greater than 0 and at most $ARC_MAX_TIMEOUT seconds"
        exit "$ARC_EXIT_USAGE"
    fi
    file="${positional[1]}"
    arc_read_rows "$file" || exit "$ARC_EXIT_USAGE"
    if (( ${#ARC_NAMES[@]} == 0 )); then
        arc_error "PV file contains no names; the server rejects an empty list"
        exit "$ARC_EXIT_USAGE"
    fi

    arc_make_tmp || exit "$ARC_EXIT_FAILED"
    arc_json_names "$ARC_TMP/names.json" "${ARC_NAMES[@]}"
    arc_post_json "$timeout" "$ARC_TMP/response.json" "$bpl" archivedPVsNotInList "$ARC_TMP/names.json" \
        || exit "$ARC_EXIT_FAILED"
    if ! jq -e -s --slurpfile names "$ARC_TMP/names.json" \
        'length == 1 and (.[0] | type == "array"
            and all(.[]; type == "string" and length > 0 and (. as $n | all($names[0][]; . != $n))))' \
        "$ARC_TMP/response.json" >/dev/null 2>&1; then
        arc_error "invalid or unexpected response: expected a JSON array of PV names absent from the input"
        exit "$ARC_EXIT_FAILED"
    fi

    jq -r '.[]' "$ARC_TMP/response.json" | arc_sort
    exit "$ARC_EXIT_OK"
}

main "$@"
