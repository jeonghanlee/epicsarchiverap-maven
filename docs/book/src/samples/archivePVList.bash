#!/usr/bin/env bash
# Submits independent archive requests after resolving configured aliases and checking
# PV identities. Reports request acceptance separately from actual data collection.
# Usage: archivePVList.bash [options] BPL_URL FILE
# Exit status: 0 all accepted, 1 unconfirmed requests or preflight failure, 2 invalid input.

set -o nounset -o pipefail

SCRIPT_DIR="$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")"
# shellcheck source=archiverClient.bash
if ! source "$SCRIPT_DIR/archiverClient.bash"; then
    printf 'error: cannot load %s\n' "$SCRIPT_DIR/archiverClient.bash" >&2
    exit 1
fi

readonly DIGITS='[0-9](_?[0-9])*'
readonly NUMBER_PATTERN="^[+-]?($DIGITS(\.($DIGITS)?)?|\.$DIGITS)([eE][+-]?$DIGITS)?$"
readonly TEXT_FILTER='type == "string" and length > 0 and (explode | all(. >= 32 and . <= 126))'

function usage {
    local destination=2
    if [[ "${1:-}" == help ]]; then
        destination=1
    fi
    printf '%s\n' \
        'usage: archivePVList.bash [options] BPL_URL FILE' \
        'Submit requests for one explicit PV name per UTF-8 input line.' \
        '  --timeout SEC             request deadline, greater than 0 and at most 86400 (default: 30)' \
        '                            rounded up to milliseconds, minimum 0.001 seconds' \
        '  --sampling-method METHOD  MONITOR or SCAN (default: MONITOR)' \
        '  --sampling-period SEC     positive finite float32 seconds (default: 1)' >&"$destination"
    if [[ "$destination" == 1 ]]; then
        exit "$ARC_EXIT_OK"
    fi
    exit "$ARC_EXIT_USAGE"
}

# Accepts decimal/exponent syntax with digit separators and emits a Java-readable number.
# The float32 bounds account for rounding to zero and rounding to infinity.
# Request deadlines round up to positive milliseconds, never curl's unlimited zero.
function number {
    local value="$1" kind="$2" output
    value="$(arc_trim "$value")"
    [[ "$value" =~ $NUMBER_PATTERN ]] || return 1
    value="${value//_/}"
    if ! output="$(LC_ALL=C awk -v value="$value" -v kind="$kind" 'BEGIN {
        n = value + 0
        if (kind == "period") {
            if (!(n > 2 ^ -150 && n < 2 ^ 128 - 2 ^ 103)) exit 1
        } else {
            if (!(n > 0 && n <= 86400)) exit 1
            milliseconds = int(n * 1000)
            if (milliseconds < n * 1000) milliseconds++
            printf "%.3f", milliseconds / 1000
            exit
        }
        printf "%.17g", n
    }')"; then
        return 1
    fi
    if [[ "$output" =~ ^[0-9]+$ ]]; then
        output+='.0'
    fi
    printf '%s' "$output"
}

# Validates the complete input before any HTTP request, preserving line numbers and order.
function read_names {
    local file="$1"
    if [[ -d "$file" || ! -r "$file" ]]; then
        arc_error "cannot read PV file: $file"
        return 1
    fi
    if ! iconv -f UTF-8 -t UTF-8 < "$file" > "$ARC_TMP/input" 2>/dev/null; then
        arc_error "PV file is not valid UTF-8: $file"
        return 1
    fi
    if ! jq -Rs '
        def strip: gsub("^[\\p{Space}\u001c-\u001f]+|[\\p{Space}\u001c-\u001f]+$"; "");
        gsub("\r\n?"; "\n") | split("\n")
        | to_entries | map({line: (.key + 1), name: (.value | strip)})
        | map(select(.name != ""))
        | if length == 0 then error("PV file contains no names")
          elif any(.[]; (.name | test("^[!-~]+$") | not) or (.name | test("[,*?]")))
          then error("use one printable ASCII PV name, without whitespace, commas or wildcards")
          else . end' "$ARC_TMP/input" > "$ARC_TMP/names.json"; then
        return 1
    fi
    mapfile -t ARC_NAMES < <(jq -r '.[].name' "$ARC_TMP/names.json")
    mapfile -t ARC_LINES < <(jq -r '.[].line' "$ARC_TMP/names.json")
}

function normalized {
    local value="$1"
    case "$value" in
        ca://*) value="${value#ca://}" ;;
        pva://*) value="${value#pva://}" ;;
    esac
    printf '%s' "${value%.VAL}"
}

function check_disjoint {
    local name key index=0
    local -A seen=()
    for name in "$@"; do
        key="$(normalized "$name")"
        key="pv:${key%%.*}"
        if [[ -n "${seen[$key]:-}" ]]; then
            arc_error "lines ${seen[$key]} and ${ARC_LINES[$index]}: overlapping PV identities ($name)"
            return 1
        fi
        seen["$key"]="${ARC_LINES[$index]}"
        index=$((index + 1))
    done
}

# Resolves all names and validates available type information before the first mutation.
function resolve_inputs {
    local bpl="$1" timeout="$2" name real alias target index
    local -A aliases=() visited=()
    ARC_REAL=()
    ARC_TARGETS=()
    arc_get "$timeout" "$ARC_TMP/aliases.json" "$bpl" getAllAliases || return 1
    arc_json_check "$ARC_TMP/aliases.json" \
        "type == \"array\" and all(.[]; type == \"object\" and (.aliasName | $TEXT_FILTER)
        and (.srcPVName | $TEXT_FILTER)) and ([.[].aliasName] | length == (unique | length))" \
        'an alias array with unique printable names and targets' || return 1
    while IFS= read -r -d '' alias && IFS= read -r -d '' real; do
        aliases["$alias"]="$real"
    done < <(jq -j '.[] | .aliasName, "\u0000", .srcPVName, "\u0000"' "$ARC_TMP/aliases.json")
    for index in "${!ARC_NAMES[@]}"; do
        name="${ARC_NAMES[$index]}"
        real="$(normalized "$name")"
        target="$name"
        visited=()
        while [[ -n "$real" ]] && [[ -n "${aliases[$real]:-}" ]]; do
            if [[ -n "${visited[$real]:-}" ]]; then
                arc_error "cyclic alias response"
                return 1
            fi
            visited["$real"]=1
            real="${aliases[$real]}"
            target="$real"
        done
        if arc_get "$timeout" "$ARC_TMP/type.json" "$bpl" getPVTypeInfo "pv=$real" \
            2> "$ARC_TMP/type.err"; then
            arc_json_check "$ARC_TMP/type.json" "type == \"object\" and (.pvName | $TEXT_FILTER)" \
                'a type-info object with printable pvName' || return 1
            if [[ "$(jq -r '.pvName' "$ARC_TMP/type.json")" != "$real" ]]; then
                arc_error "type-info identity contradicts the alias map"
                return 1
            fi
        elif [[ "$ARC_HTTP_STATUS" != 404 ]]; then
            cat "$ARC_TMP/type.err" >&2
            return 1
        fi
        ARC_REAL+=("$real")
        ARC_TARGETS+=("$target")
    done
}

function submit {
    local bpl="$1" timeout="$2" method="$3" period="$4" target="$5" real="$6" response validation status
    ARCHIVE_STATUS='Outcome unknown'
    jq -n --arg pv "$target" --arg method "$method" --arg period "$period" \
        '[{pv: $pv, samplingmethod: $method, samplingperiod: $period}]' > "$ARC_TMP/request.json" || return 1
    arc_post_json "$timeout" "$ARC_TMP/response.json" "$bpl" archivePV "$ARC_TMP/request.json" || return 1
    arc_json_check "$ARC_TMP/response.json" \
        "type == \"array\" and length == 1 and (.[0] | type == \"object\" and (.pvName | $TEXT_FILTER)
        and ((has(\"validation\") | not) or (.validation | type == \"string\")))" \
        'exactly one PV result with printable pvName and string validation' || return 1
    response="$(jq -r '.[0].pvName' "$ARC_TMP/response.json")"
    if [[ "$response" != "$real" && "$response" != "${real%%.*}" ]]; then
        arc_error 'archive response identifies another PV'
        return 1
    fi
    if jq -e '.[0] | has("validation") and .validation != ""' "$ARC_TMP/response.json" >/dev/null; then
        ARCHIVE_STATUS=Rejected
        validation="$(jq -a '.[0].validation' "$ARC_TMP/response.json")"
        arc_error "$validation"
        return 1
    fi
    arc_json_check "$ARC_TMP/response.json" ".[0].status | $TEXT_FILTER" \
        'a nonempty printable ASCII archive status' || return 1
    status="$(jq -r '.[0].status' "$ARC_TMP/response.json")"
    case "$status" in
        'Archive request submitted'|'Already submitted') ARCHIVE_STATUS="$status" ;;
        *) arc_error "archive request was not confirmed: $status"; return 1 ;;
    esac
}

function print_results {
    local failures="$1" index name status name_width=7 status_width=6 dash_names dash_status
    for index in "${!ARC_NAMES[@]}"; do
        name="${ARC_NAMES[$index]}"
        status="${ARC_STATUSES[$index]}"
        (( ${#name} <= name_width )) || name_width=${#name}
        (( ${#status} <= status_width )) || status_width=${#status}
    done
    printf -v dash_names '%*s' "$name_width" ''
    printf -v dash_status '%*s' "$status_width" ''
    dash_names="${dash_names// /-}"
    dash_status="${dash_status// /-}"
    printf '%s   %s\n' "$dash_names" "$dash_status"
    printf '%-*s   %s\n' "$name_width" 'PV Name' Status
    printf '%s   %s\n' "$dash_names" "$dash_status"
    for index in "${!ARC_NAMES[@]}"; do
        printf '%-*s   %s\n' "$name_width" "${ARC_NAMES[$index]}" "${ARC_STATUSES[$index]}"
    done
    printf '%s   %s\n' "$dash_names" "$dash_status"
    printf 'Total %d   Successful %d   Failed %d\n' "${#ARC_NAMES[@]}" \
        "$(( ${#ARC_NAMES[@]} - failures ))" "$failures"
}

function main {
    local timeout=30 method=MONITOR period=1 bpl index failures=0 tool
    local -a positional=()
    while (( $# > 0 )); do
        case "$1" in
            --timeout=*) timeout="${1#*=}"; shift ;;
            --sampling-method=*) method="${1#*=}"; shift ;;
            --sampling-period=*) period="${1#*=}"; shift ;;
            --timeout|--sampling-method|--sampling-period)
                (( $# >= 2 )) || usage
                case "$1" in
                    --timeout) timeout="$2" ;;
                    --sampling-method) method="$2" ;;
                    --sampling-period) period="$2" ;;
                esac
                shift 2 ;;
            -h|--help) usage help ;;
            --) shift; positional+=("$@"); break ;;
            -*) arc_error "unknown option: $1"; usage ;;
            *) positional+=("$1"); shift ;;
        esac
    done
    (( ${#positional[@]} == 2 )) || usage
    for tool in curl jq iconv awk; do
        [[ -x "$(command -v "$tool" 2>/dev/null)" ]] || {
            arc_error "required tool not found: $tool"; exit "$ARC_EXIT_USAGE";
        }
    done
    bpl="$(arc_bpl_url "${positional[0]}")" || { arc_error 'invalid BPL URL'; exit "$ARC_EXIT_USAGE"; }
    timeout="$(number "$timeout" timeout)" || { arc_error 'invalid timeout'; exit "$ARC_EXIT_USAGE"; }
    period="$(number "$period" period)" || { arc_error 'invalid sampling period'; exit "$ARC_EXIT_USAGE"; }
    [[ "$method" == MONITOR || "$method" == SCAN ]] || { arc_error 'invalid sampling method'; exit "$ARC_EXIT_USAGE"; }
    arc_make_tmp || exit "$ARC_EXIT_FAILED"
    read_names "${positional[1]}" || exit "$ARC_EXIT_USAGE"
    check_disjoint "${ARC_NAMES[@]}" || exit "$ARC_EXIT_USAGE"
    if ! resolve_inputs "$bpl" "$timeout"; then
        arc_error 'preflight failed; no archive requests sent'
        exit "$ARC_EXIT_FAILED"
    fi
    check_disjoint "${ARC_REAL[@]}" || exit "$ARC_EXIT_USAGE"
    ARC_STATUSES=()
    for index in "${!ARC_NAMES[@]}"; do
        if ! submit "$bpl" "$timeout" "$method" "$period" "${ARC_TARGETS[$index]}" "${ARC_REAL[$index]}"; then
            failures=$((failures + 1))
            arc_error "${ARC_NAMES[$index]}: $ARCHIVE_STATUS; check actual status before retrying"
        fi
        ARC_STATUSES+=("$ARCHIVE_STATUS")
    done
    print_results "$failures"
    (( failures == 0 )) || exit "$ARC_EXIT_FAILED"
}

main "$@"
