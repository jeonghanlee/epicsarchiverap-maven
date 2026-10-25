#!/usr/bin/env bash
# Computes statistics on the client from the value column of a CSV file written by getDataToCsv.bash:
#   summary    the count, mean, sample standard deviation, minimum and maximum of all numeric values;
#   moving     the mean and sample standard deviation of every window of N consecutive numeric samples;
#   histogram  the number of numeric values in each of N equal bins.
# Rows whose value is not a number, such as a waveform, a text or an empty value, are counted, reported
# on stderr and skipped before any window or bin is formed. The sample standard deviation divides by
# the count minus one and is 0 for one value. The server's post-processing operators are not used.
#
# The input is the first argument after the options, or "-" for standard input. The first line must be
# the header time_utc,secs,nanos,value,severity,status.
#
# Usage: csvStats.bash summary FILE
#        csvStats.bash moving --window N FILE
#        csvStats.bash histogram --bins N [--min X] [--max Y] FILE
# Exit status: 0 result printed, 1 no numeric rows or nothing to compute, 2 invalid arguments or input.

# The awk programs are single-quoted on purpose: awk, not the shell, evaluates them.
# shellcheck disable=SC2016
set -o nounset -o pipefail

SCRIPT_DIR="$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")"
# shellcheck source=archiverClient.bash
if ! source "$SCRIPT_DIR/archiverClient.bash"; then
    printf 'error: cannot load %s\n' "$SCRIPT_DIR/archiverClient.bash" >&2
    exit 1
fi

readonly EXPECTED_HEADER='time_utc,secs,nanos,value,severity,status'
readonly INTEGER_PATTERN='^[1-9][0-9]{0,8}$'
readonly MAX_BINS=10000
readonly NUMBER_PATTERN='^[-+]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][-+]?[0-9]+)?$'

# The awk program shared by the modes: it checks the header, keeps the numeric value of each row in x,
# counts the other rows and calls the mode's row function, then the mode's end function.
readonly AWK_COMMON='
function isnum(s) { return s ~ /^[-+]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][-+]?[0-9]+)?$/ }
function fail(code, message) { if (message != "") print "error: " message > "/dev/stderr"; failed = code; exit code }
BEGIN { FS = "," }
{ sub(/\r$/, "") }
NR == 1 { h = $0; gsub(/"/, "", h); if (h != header) fail(2, "the input is not a getDataToCsv.bash file; the first line must be " header); next }
{
    v = $4
    if (!isnum(v)) { skipped++; next }
    x = v + 0
    t = $1; gsub(/"/, "", t)
    n++
    row()
}
END {
    if (failed) exit failed
    if (NR == 0) fail(2, "the input is empty")
    if (skipped > 0) print "skipped " skipped " rows whose value is not a number" > "/dev/stderr"
    done()
}'

readonly AWK_SUMMARY='
function row() {
    d = x - mean; mean += d / n; m2 += d * (x - mean)
    if (n == 1 || x < mn) mn = x
    if (n == 1 || x > mx) mx = x
}
function done() {
    if (n == 0) fail(1, "no numeric rows")
    printf "n=%d skipped=%d mean=%.10g sd=%.10g min=%.10g max=%.10g\n", n, skipped, mean, (n > 1) ? sqrt(m2 / (n - 1)) : 0, mn, mx
}'

# Window sums are kept on values shifted by the first value and recomputed from the window every
# w rows, so that the rounding error of adding and removing values cannot grow without bound.
readonly AWK_MOVING='
function row(   y, old, i, k) {
    if (n == 1) shift = x
    y = x - shift
    k = n % w
    if (n > w) { old = buf[k]; sx -= old; sxx -= old * old }
    buf[k] = y; sx += y; sxx += y * y
    if (n >= w && n % w == 0) { sx = 0; sxx = 0; for (i = 0; i < w; i++) { sx += buf[i]; sxx += buf[i] * buf[i] } }
    if (n >= w) {
        if (!header_printed) { print "time_utc,mean,sd"; header_printed = 1 }
        var = (w > 1) ? (sxx - sx * sx / w) / (w - 1) : 0
        if (var < 0) var = 0
        printf "%s,%.10g,%.10g\n", t, shift + sx / w, sqrt(var)
    }
}
function done() {
    if (n == 0) fail(1, "no numeric rows")
    if (n < w) fail(1, "a window of " w " needs at least " w " numeric rows; the input has " n " numeric rows")
}'

readonly AWK_HISTOGRAM='
function row() { vals[n] = x }
function done(   i, k, lo, hi, outside, counts) {
    if (n == 0) fail(1, "no numeric rows")
    lo = has_min ? lo_arg + 0 : vals[1]; hi = has_max ? hi_arg + 0 : vals[1]
    for (i = 1; i <= n; i++) {
        if (!has_min && vals[i] < lo) lo = vals[i]
        if (!has_max && vals[i] > hi) hi = vals[i]
    }
    if (hi < lo) fail(1, "the bounds leave no range")
    for (k = 0; k < bins; k++) counts[k] = 0
    for (i = 1; i <= n; i++) {
        if (vals[i] < lo || vals[i] > hi) { outside++; continue }
        k = (hi == lo) ? 0 : int((vals[i] - lo) / (hi - lo) * bins)
        if (k >= bins) k = bins - 1
        counts[k]++
    }
    print "bin_from,bin_to,count"
    for (k = 0; k < bins; k++) printf "%.10g,%.10g,%d\n", lo + k * (hi - lo) / bins, lo + (k + 1) * (hi - lo) / bins, counts[k]
    if (outside > 0) printf "%d values outside %.10g to %.10g\n", outside, lo, hi > "/dev/stderr"
}'

# Prints the usage text; with "help" on stdout and exit 0, otherwise on stderr and exit 2.
usage() {
    local text
    text="$(printf '%s\n' \
        "usage: $(basename -- "$0") summary FILE" \
        "       $(basename -- "$0") moving --window N FILE" \
        "       $(basename -- "$0") histogram --bins N [--min X] [--max Y] FILE" \
        "Compute statistics of the numeric values of a CSV file written by getDataToCsv.bash." \
        "  FILE          the CSV file, or - for standard input" \
        "  --window N    samples per window, a whole number of at least 1" \
        "  --bins N      number of equal bins, a whole number from 1 to $MAX_BINS" \
        "  --min X, --max Y  bounds of the histogram; default the minimum and maximum of the data;" \
        "                values outside the bounds are not counted and are reported" \
        "Exit status: 0 result printed, 1 no numeric rows or nothing to compute, 2 invalid arguments or input.")"
    if [[ "${1:-}" == help ]]; then
        printf '%s\n' "$text"
        exit "$ARC_EXIT_OK"
    fi
    printf '%s\n' "$text" >&2
    exit "$ARC_EXIT_USAGE"
}

# Fails with the usage exit status unless the value is a whole number of at least 1 and at most 999999999.
require_count() {
    local option="$1" value="$2"
    if [[ ! "$value" =~ $INTEGER_PATTERN ]]; then
        arc_error "$option must be a whole number of at least 1"
        exit "$ARC_EXIT_USAGE"
    fi
}

# Fails with the usage exit status unless the value is a decimal number.
require_number() {
    local option="$1" value="$2"
    if [[ ! "$value" =~ $NUMBER_PATTERN ]]; then
        arc_error "$option must be a number"
        exit "$ARC_EXIT_USAGE"
    fi
}

# Succeeds when the option belongs to the current mode and is followed by its value.
# Usage: option_applies <current mode> <mode that takes the option> <number of remaining arguments>
option_applies() {
    local current="$1" needed="$2" remaining="$3"
    [[ "$current" == "$needed" ]] && (( remaining >= 2 ))
}

main() {
    local mode window="" bins="" lo="" hi="" file="" program
    local -a positional=()
    (( $# > 0 )) || usage
    case "$1" in
        -h|--help) usage help ;;
        summary|moving|histogram) mode="$1"; shift ;;
        *) arc_error "unknown mode: $1"; usage ;;
    esac
    while (( $# > 0 )); do
        case "$1" in
            --window) option_applies "$mode" moving "$#" || usage; window="$2"; shift 2 ;;
            --bins) option_applies "$mode" histogram "$#" || usage; bins="$2"; shift 2 ;;
            --min) option_applies "$mode" histogram "$#" || usage; lo="$2"; shift 2 ;;
            --max) option_applies "$mode" histogram "$#" || usage; hi="$2"; shift 2 ;;
            -h|--help) usage help ;;
            --) shift; positional+=("$@"); break ;;
            -) positional+=("$1"); shift ;;
            -*) arc_error "unknown option: $1"; usage ;;
            *) positional+=("$1"); shift ;;
        esac
    done
    (( ${#positional[@]} == 1 )) || usage
    file="${positional[0]}"
    command -v awk > /dev/null 2>&1 || { arc_error "required tool not found: awk"; exit "$ARC_EXIT_USAGE"; }
    case "$mode" in
        summary) program="$AWK_SUMMARY" ;;
        moving)
            [[ -n "$window" ]] || usage
            require_count --window "$window"
            program="$AWK_MOVING"
            ;;
        histogram)
            [[ -n "$bins" ]] || usage
            require_count --bins "$bins"
            if (( bins > MAX_BINS )); then
                arc_error "--bins is limited to $MAX_BINS; $bins given"
                exit "$ARC_EXIT_USAGE"
            fi
            [[ -z "$lo" ]] || require_number --min "$lo"
            [[ -z "$hi" ]] || require_number --max "$hi"
            if [[ -n "$lo" && -n "$hi" ]] && ! LC_ALL=C awk -v a="$lo" -v b="$hi" 'BEGIN { exit !(a + 0 < b + 0) }'; then
                arc_error "--min must be less than --max"
                exit "$ARC_EXIT_USAGE"
            fi
            program="$AWK_HISTOGRAM"
            ;;
    esac
    if [[ "$file" != "-" && ( -d "$file" || ! -r "$file" ) ]]; then
        arc_error "cannot read the input file: $file"
        exit "$ARC_EXIT_USAGE"
    fi

    LC_ALL=C awk -v header="$EXPECTED_HEADER" -v w="${window:-1}" -v bins="${bins:-1}" \
        -v has_min="$([[ -n "$lo" ]] && echo 1 || echo 0)" -v has_max="$([[ -n "$hi" ]] && echo 1 || echo 0)" \
        -v lo_arg="${lo:-0}" -v hi_arg="${hi:-0}" "$AWK_COMMON $program" "$file"
}

main "$@"
