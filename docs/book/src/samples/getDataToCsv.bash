#!/usr/bin/env bash
# Extracts the samples of up to 10 PVs over a time range of at most 7 days into one CSV file per PV.
# Each PV has its own GET /data/getData.json request, made one after the other, so that a response
# held in memory is that of one PV and a failure names its PV. A file is written only after the
# response of its PV has been checked; a failed PV is reported on stderr and the remaining PVs
# are still requested.
#
# The CSV columns are time_utc, secs, nanos, value, severity and status, one row per sample; the header
# line is plain text and the time and any text value are double-quoted. A waveform
# value is written as its elements joined by spaces in one field. The file of a PV is named after
# the PV with every character other than letters, digits, ".", "_" and "-" replaced by "_".
#
# Limits, checked before any request: at most 10 PVs, a range of at most 7 days, no duplicate PV
# name, no two names with the same file name, no existing output file. A response that holds very
# many samples is held in memory by jq; choose a shorter range for a PV with a high sample rate.
#
# Usage: getDataToCsv.bash [--timeout SEC] RETRIEVAL_URL PV_FILE FROM TO OUT_DIR
# Exit status: 0 every PV written, 1 no PV written, 2 invalid arguments or input, 3 some PVs written
# and some failed.

set -o nounset -o pipefail

SCRIPT_DIR="$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")"
# shellcheck source=archiverClient.bash
if ! source "$SCRIPT_DIR/archiverClient.bash"; then
    printf 'error: cannot load %s\n' "$SCRIPT_DIR/archiverClient.bash" >&2
    exit 1
fi

readonly MAX_PVS=10
readonly MAX_RANGE_DAYS=7
readonly SECONDS_PER_DAY=86400
readonly NANOS_PER_SECOND=1000000000
readonly TIME_PATTERN='^([0-9]{4}-[0-9]{2}-[0-9]{2})T([0-9]{2}:[0-9]{2}:[0-9]{2})(\.([0-9]{1,9}))?(Z|[+-][0-9]{2}:[0-9]{2})$'
readonly CSV_HEADER='time_utc,secs,nanos,value,severity,status'
readonly SAMPLE_FILTER='.[0].data[] | [
    ((.secs | todate | rtrimstr("Z")) + "." + (("000000000" + (.nanos | tostring))[-9:]) + "Z"),
    .secs, .nanos,
    (.val | if type == "array" then map(tostring) | join(" ") else . end),
    .severity, .status]'
readonly RESPONSE_FILTER='type == "array" and length == 1 and (.[0] | type == "object" and (.data | type == "array")
    and all(.data[]; type == "object" and has("val") and (.secs | type == "number") and (.nanos | type == "number")
    and (.severity | type == "number") and (.status | type == "number")))'

# Prints the usage text; with "help" on stdout and exit 0, otherwise on stderr and exit 2.
usage() {
    local text
    text="$(printf '%s\n' \
        "usage: $(basename -- "$0") [--timeout SEC] RETRIEVAL_URL PV_FILE FROM TO OUT_DIR" \
        "Write the samples of each PV in a time range to its own CSV file, one request per PV." \
        "  RETRIEVAL_URL  the data_retrieval_url of appliances.xml, for example http://localhost:17668/retrieval;" \
        "                 the script appends /data/getData.json" \
        "  PV_FILE        UTF-8 CSV file; the first column of each row is a PV name, at most $MAX_PVS PVs" \
        "  FROM, TO       ISO 8601 instants with seconds, such as 2026-09-24T08:00:00Z or 2026-09-24T01:00:00-07:00;" \
        "                 TO is after FROM by at most $MAX_RANGE_DAYS days" \
        "  OUT_DIR        folder for the CSV files, created when missing; an existing file is not replaced" \
        "  --timeout SEC  limit for each request, greater than 0 and at most $ARC_MAX_TIMEOUT (default $ARC_DEFAULT_TIMEOUT)" \
        "Exit status: 0 every PV written, 1 no PV written, 2 invalid arguments or input, 3 some PVs failed.")"
    if [[ "${1:-}" == help ]]; then
        printf '%s\n' "$text"
        exit "$ARC_EXIT_OK"
    fi
    printf '%s\n' "$text" >&2
    exit "$ARC_EXIT_USAGE"
}

# Parses an ISO 8601 instant with a Z or a numeric offset. Sets TIME_ISO to the UTC time in the form
# the server reads, with at least three fraction digits, and TIME_NANOS to the nanoseconds since the epoch.
# Returns 1 when the text is not such an instant.
parse_time() {
    local text="$1" fraction seconds
    if [[ ! "$text" =~ $TIME_PATTERN ]]; then
        return 1
    fi
    fraction="${BASH_REMATCH[4]}"
    if ! seconds="$(date -u -d "${BASH_REMATCH[1]}T${BASH_REMATCH[2]}${BASH_REMATCH[5]}" +%s 2>/dev/null)"; then
        return 1
    fi
    while (( ${#fraction} < 3 )); do
        fraction="${fraction}0"
    done
    TIME_ISO="$(date -u -d "@$seconds" +%Y-%m-%dT%H:%M:%S).${fraction}Z"
    fraction="${fraction}000000000"
    TIME_NANOS=$(( seconds * NANOS_PER_SECOND + 10#${fraction:0:9} ))
}

# Prints the file name, without folder, of a PV: every character other than letters, digits, ".", "_"
# and "-" replaced by "_", followed by ".csv".
file_name() {
    local name="$1"
    printf '%s.csv\n' "${name//[^A-Za-z0-9._-]/_}"
}

main() {
    local timeout="$ARC_DEFAULT_TIMEOUT" retrieval pv_file from to out_dir
    local from_iso from_nanos to_iso range_nanos written=0 failed=0 name file samples
    local -a positional=() files=()
    local -A seen_names=() seen_files=()
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
    (( ${#positional[@]} == 5 )) || usage
    pv_file="${positional[1]}"
    from="${positional[2]}"
    to="${positional[3]}"
    out_dir="${positional[4]}"
    arc_require_tools || exit "$ARC_EXIT_USAGE"
    if ! retrieval="$(arc_retrieval_url "${positional[0]}")"; then
        arc_error "RETRIEVAL_URL must be an http or https URL without credentials, query or fragment"
        exit "$ARC_EXIT_USAGE"
    fi
    if ! arc_timeout "$timeout"; then
        arc_error "timeout must be greater than 0 and at most $ARC_MAX_TIMEOUT seconds"
        exit "$ARC_EXIT_USAGE"
    fi
    if ! parse_time "$from"; then
        arc_error "invalid time: $from; use ISO 8601 such as 2026-09-24T08:00:00Z"
        exit "$ARC_EXIT_USAGE"
    fi
    from_iso="$TIME_ISO"
    from_nanos="$TIME_NANOS"
    if ! parse_time "$to"; then
        arc_error "invalid time: $to; use ISO 8601 such as 2026-09-24T08:00:00Z"
        exit "$ARC_EXIT_USAGE"
    fi
    to_iso="$TIME_ISO"
    range_nanos=$(( TIME_NANOS - from_nanos ))
    if (( range_nanos <= 0 )); then
        arc_error "the end time must be after the start time"
        exit "$ARC_EXIT_USAGE"
    fi
    if (( range_nanos > MAX_RANGE_DAYS * SECONDS_PER_DAY * NANOS_PER_SECOND )); then
        arc_error "the time range is limited to $MAX_RANGE_DAYS days ($((MAX_RANGE_DAYS * SECONDS_PER_DAY)) seconds); the given range is $(
            LC_ALL=C awk -v n="$range_nanos" -v s="$NANOS_PER_SECOND" 'BEGIN { printf "%.10g", n / s }') seconds"
        exit "$ARC_EXIT_USAGE"
    fi

    arc_read_rows "$pv_file" || exit "$ARC_EXIT_USAGE"
    if (( ${#ARC_NAMES[@]} == 0 )); then
        arc_error "PV file holds no PV name: $pv_file"
        exit "$ARC_EXIT_USAGE"
    fi
    if (( ${#ARC_NAMES[@]} > MAX_PVS )); then
        arc_error "at most $MAX_PVS PVs are allowed; ${#ARC_NAMES[@]} given"
        exit "$ARC_EXIT_USAGE"
    fi
    for name in "${ARC_NAMES[@]}"; do
        if [[ -n "${seen_names[$name]:-}" ]]; then
            arc_error "duplicate PV name: $name"
            exit "$ARC_EXIT_USAGE"
        fi
        seen_names[$name]=1
        file="$(file_name "$name")"
        if [[ -n "${seen_files[$file]:-}" ]]; then
            arc_error "PV names ${seen_files[$file]} and $name give the same file name $file"
            exit "$ARC_EXIT_USAGE"
        fi
        seen_files[$file]="$name"
        files+=("$out_dir/$file")
        if [[ -e "$out_dir/$file" ]]; then
            arc_error "output file exists: $out_dir/$file"
            exit "$ARC_EXIT_USAGE"
        fi
    done
    mkdir -p -- "$out_dir" || {
        arc_error "cannot create the output folder: $out_dir"
        exit "$ARC_EXIT_USAGE"
    }

    arc_make_tmp || exit "$ARC_EXIT_FAILED"
    for index in "${!ARC_NAMES[@]}"; do
        name="${ARC_NAMES[$index]}"
        file="${files[$index]}"
        if ! arc_get "$timeout" "$ARC_TMP/response.json" "$retrieval/data" getData.json \
            "pv=$name" "from=$from_iso" "to=$to_iso"; then
            arc_error "cannot read the samples of $name"
            failed=$((failed + 1))
            continue
        fi
        if ! arc_json_check "$ARC_TMP/response.json" "$RESPONSE_FILTER" "the samples of one PV"; then
            arc_error "the response for $name is not usable"
            failed=$((failed + 1))
            continue
        fi
        printf '%s\n' "$CSV_HEADER" > "$ARC_TMP/pv.csv"
        if ! jq -r "($SAMPLE_FILTER) | @csv" "$ARC_TMP/response.json" >> "$ARC_TMP/pv.csv" 2>"$ARC_TMP/jq.err"; then
            arc_error "cannot convert the samples of $name: $(head -n 1 "$ARC_TMP/jq.err")"
            failed=$((failed + 1))
            continue
        fi
        if ! mv -- "$ARC_TMP/pv.csv" "$file"; then
            arc_error "cannot write $file"
            failed=$((failed + 1))
            continue
        fi
        samples="$(jq '.[0].data | length' "$ARC_TMP/response.json")"
        printf '%s: %d samples written to %s\n' "$name" "$samples" "$file"
        written=$((written + 1))
    done
    if (( failed == 0 )); then
        exit "$ARC_EXIT_OK"
    fi
    if (( written == 0 )); then
        exit "$ARC_EXIT_FAILED"
    fi
    exit "$ARC_EXIT_INCOMPLETE"
}

main "$@"
