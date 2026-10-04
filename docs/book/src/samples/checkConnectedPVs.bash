#!/usr/bin/env bash
# Checks the share of disconnected PVs on each appliance of the cluster, once, and exits.
# One GET /getApplianceMetrics returns one object per appliance; the management service merges
# connectedPVCount and disconnectedPVCount from that appliance's engine and omits them when the
# engine does not answer. An appliance whose disconnected share exceeds the threshold is reported
# on stdout under a "Disconnected PVs in <BPL_URL>" line; an appliance with no PVs is not an alert.
#
# Usage: checkConnectedPVs.bash [-d PERCENT] [--timeout SEC] BPL_URL
# Exit status: 0 nothing to report, 1 alert reported on stdout, 2 invalid arguments,
#              3 the check could not complete for some or all appliances (stderr); 3 takes
#              precedence over 1, and alert lines found are still printed.

set -o nounset -o pipefail

SCRIPT_DIR="$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")"
# shellcheck source=archiverClient.bash
if ! source "$SCRIPT_DIR/archiverClient.bash"; then
    printf 'error: cannot load %s\n' "$SCRIPT_DIR/archiverClient.bash" >&2
    exit 1
fi

readonly DEFAULT_PERCENTAGE=5.0

# Prints the usage text; with "help" on stdout and exit 0, otherwise on stderr and exit 2.
usage() {
    local text
    text="$(printf '%s\n' \
        "usage: $(basename -- "$0") [-d PERCENT] [--timeout SEC] BPL_URL" \
        "Report appliances whose share of disconnected PVs exceeds PERCENT." \
        "  BPL_URL        management BPL base URL, for example http://localhost:17665/mgmt/bpl" \
        "  -d PERCENT     tolerated percentage of disconnected PVs (default $DEFAULT_PERCENTAGE)" \
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
    local timeout="$ARC_DEFAULT_TIMEOUT" percentage="$DEFAULT_PERCENTAGE" bpl count index
    local instance connected disconnected total alert=0 incomplete=0
    local -a positional=() lines=()
    while (( $# > 0 )); do
        case "$1" in
            -d|--disconnect_percentage)
                (( $# >= 2 )) || usage
                percentage="$2"
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
            -?*)
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
    if [[ ! "$percentage" =~ ^-?([0-9]+(\.[0-9]*)?|\.[0-9]+)$ ]]; then
        arc_error "-d must be a decimal percentage"
        exit "$ARC_EXIT_USAGE"
    fi
    if ! arc_timeout "$timeout"; then
        arc_error "timeout must be greater than 0 and at most $ARC_MAX_TIMEOUT seconds"
        exit "$ARC_EXIT_USAGE"
    fi

    arc_make_tmp || exit "$ARC_EXIT_INCOMPLETE"
    arc_get "$timeout" "$ARC_TMP/metrics.json" "$bpl" getApplianceMetrics || exit "$ARC_EXIT_INCOMPLETE"
    arc_json_check "$ARC_TMP/metrics.json" \
        'type == "array" and all(.[]; type == "object" and (.instance | type == "string"))' \
        'an array of appliance metrics objects with an instance' || exit "$ARC_EXIT_INCOMPLETE"
    count="$(jq 'length' "$ARC_TMP/metrics.json")"
    if (( count == 0 )); then
        arc_error "Cannot obtain appliance metrics"
        exit "$ARC_EXIT_INCOMPLETE"
    fi

    for (( index = 0; index < count; index++ )); do
        instance="$(jq -r --argjson i "$index" '.[$i].instance' "$ARC_TMP/metrics.json")"
        connected="$(jq -r --argjson i "$index" '.[$i].connectedPVCount // empty | tostring' "$ARC_TMP/metrics.json")"
        disconnected="$(jq -r --argjson i "$index" '.[$i].disconnectedPVCount // empty | tostring' "$ARC_TMP/metrics.json")"
        if [[ ! "$connected" =~ ^[0-9]+$ || ! "$disconnected" =~ ^[0-9]+$ ]]; then
            arc_error "metrics unavailable for appliance $instance"
            incomplete=1
            continue
        fi
        total=$(( 10#$connected + 10#$disconnected ))
        (( total > 0 )) || continue
        if LC_ALL=C awk -v d="$disconnected" -v t="$total" -v p="$percentage" 'BEGIN { exit !((d * 100.0) / t > p) }'; then
            lines+=("$((10#$disconnected)) of $total PVs in appliance $instance are in a disconnected state")
            alert=1
        fi
    done

    if (( alert )); then
        printf 'Disconnected PVs in %s\n' "$bpl"
        printf '%s\n' "${lines[@]}"
    fi
    if (( incomplete )); then
        exit "$ARC_EXIT_INCOMPLETE"
    fi
    if (( alert )); then
        exit "$ARC_EXIT_FAILED"
    fi
    exit "$ARC_EXIT_OK"
}

main "$@"
