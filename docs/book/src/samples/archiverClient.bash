# shellcheck shell=bash disable=SC2034
# SC2034: the constants are used by the scripts that source this file.
# Shared mechanics for the Bash sample clients: argument validation, input reading,
# one HTTP request per call through curl, JSON response checks and diagnostics.
# Source this file from a client script; it defines functions and constants only.

# A second source of this file is a no-op, so the constants stay defined once.
if [[ -n "${ARC_CLIENT_LOADED:-}" ]]; then
    return 0
fi
readonly ARC_CLIENT_LOADED=1

readonly ARC_EXIT_OK=0
readonly ARC_EXIT_FAILED=1
readonly ARC_EXIT_USAGE=2
readonly ARC_EXIT_INCOMPLETE=3
readonly ARC_DEFAULT_TIMEOUT=30
readonly ARC_MAX_TIMEOUT=86400
readonly ARC_JSON_TYPE="application/json"

ARC_TMP=""

# Prints one diagnostic line on stderr with bytes outside printable ASCII shown as "?".
arc_error() {
    local LC_ALL=C
    local message="$*"
    printf 'error: %s\n' "${message//[^[:print:]]/?}" >&2
}

# Fails unless every external tool the clients use is on PATH.
arc_require_tools() {
    local tool
    for tool in curl jq iconv; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            arc_error "required tool not found: $tool"
            return 1
        fi
    done
}

# Creates a private temporary directory in ARC_TMP, removed when the calling shell exits.
# It installs the EXIT trap, replacing any EXIT trap the caller set before.
arc_make_tmp() {
    ARC_TMP="$(mktemp -d)" || return 1
    trap 'rm -rf -- "$ARC_TMP"' EXIT
}

# Validates an HTTP(S) management base URL ending in /bpl, without credentials,
# query, fragment or whitespace, and prints it without trailing slashes.
arc_bpl_url() {
    local value="$1" stripped port
    local pattern='^https?://([A-Za-z0-9._-]+|\[[0-9A-Fa-f:.]+\])(:([0-9]{1,5}))?(/[^?#[:space:]@]*)?$'
    if [[ ! "$value" =~ $pattern ]]; then
        return 1
    fi
    port="${BASH_REMATCH[3]}"
    if [[ -n "$port" ]] && (( 10#$port < 1 || 10#$port > 65535 )); then
        return 1
    fi
    stripped="$value"
    while [[ "$stripped" == */ ]]; do
        stripped="${stripped%/}"
    done
    [[ "$stripped" == */bpl ]] || return 1
    printf '%s\n' "$stripped"
}

# Validates an HTTP(S) data retrieval base URL, such as the data_retrieval_url of appliances.xml,
# without credentials, query, fragment or whitespace, and prints it without trailing slashes.
arc_retrieval_url() {
    local value="$1" stripped port
    local pattern='^https?://([A-Za-z0-9._-]+|\[[0-9A-Fa-f:.]+\])(:([0-9]{1,5}))?(/[^?#[:space:]@]*)?$'
    if [[ ! "$value" =~ $pattern ]]; then
        return 1
    fi
    port="${BASH_REMATCH[3]}"
    if [[ -n "$port" ]] && (( 10#$port < 1 || 10#$port > 65535 )); then
        return 1
    fi
    stripped="$value"
    while [[ "$stripped" == */ ]]; do
        stripped="${stripped%/}"
    done
    printf '%s\n' "$stripped"
}

# Validates a timeout in seconds: a decimal number greater than 0 and at most 86400.
# Prints nothing; the return status is the result.
arc_timeout() {
    local value="$1"
    [[ "$value" =~ ^([0-9]+(\.[0-9]*)?|\.[0-9]+)$ ]] || return 1
    LC_ALL=C awk -v t="$value" -v max="$ARC_MAX_TIMEOUT" 'BEGIN { exit !(t + 0 > 0 && t + 0 <= max) }'
}

# Reads a UTF-8 CSV file whose first column names a PV. Surrounding whitespace is
# removed, blank lines are skipped, and a row whose first column is empty is
# rejected. Fills ARC_NAMES with the names and ARC_ROWS with the trimmed rows.
arc_read_rows() {
    local file="$1" content line row name number=0
    ARC_NAMES=()
    ARC_ROWS=()
    if [[ -d "$file" || ! -r "$file" ]]; then
        arc_error "cannot read PV file: $file"
        return 1
    fi
    # The file is read once, so a pipe or process substitution works as input.
    if ! content="$(iconv -f UTF-8 -t UTF-8 < "$file" 2>/dev/null && printf x)"; then
        arc_error "PV file is not valid UTF-8: $file"
        return 1
    fi
    content="${content%x}"
    while IFS= read -r line || [[ -n "$line" ]]; do
        number=$((number + 1))
        line="${line%$'\r'}"
        row="$(arc_trim "$line")"
        [[ -n "$row" ]] || continue
        name="$(arc_trim "${row%%,*}")"
        if [[ -z "$name" ]]; then
            arc_error "line $number: the first column is empty"
            return 1
        fi
        ARC_NAMES+=("$name")
        ARC_ROWS+=("$row")
    done <<< "$content"
}

# Prints the argument without leading and trailing whitespace.
arc_trim() {
    local text="$1"
    text="${text#"${text%%[![:space:]]*}"}"
    text="${text%"${text##*[![:space:]]}"}"
    printf '%s' "$text"
}

# Performs one HTTP request and stores the body in a file. Requires HTTP 200.
# Usage: arc_request <timeout> <outfile> <url> [curl arguments...]
# curl's own message goes to <outfile>.err, so place <outfile> under ARC_TMP.
# Redirects are not followed; a transport error, timeout, truncated body or other
# status is reported on stderr and returns 1.
arc_request() {
    local timeout="$1" outfile="$2" url="$3" status rc
    shift 3
    status="$(curl --silent --show-error --proto '=http,https' --max-time "$timeout" \
        --header "Accept: $ARC_JSON_TYPE" --output "$outfile" --write-out '%{http_code}' \
        "$@" -- "$url" 2>"$outfile.err")"
    rc=$?
    if (( rc == 28 )); then
        arc_error "request timed out after $timeout seconds"
        return 1
    fi
    if (( rc != 0 )); then
        arc_error "request failed: $(head -n 1 "$outfile.err")"
        return 1
    fi
    if [[ "$status" != "200" ]]; then
        arc_error "HTTP $status; expected 200"
        return 1
    fi
}

# GET <action> with URL-encoded query parameters given as name=value arguments.
# Usage: arc_get <timeout> <outfile> <base> <action> [name=value...]
arc_get() {
    local timeout="$1" outfile="$2" base="$3" action="$4" pair
    local -a args=(--get)
    shift 4
    for pair in "$@"; do
        args+=(--data-urlencode "$pair")
    done
    arc_request "$timeout" "$outfile" "$base/$action" "${args[@]}"
}

# POST a JSON document from a file to <action> with Content-Type exactly application/json.
# Usage: arc_post_json <timeout> <outfile> <base> <action> <jsonfile>
arc_post_json() {
    local timeout="$1" outfile="$2" base="$3" action="$4" jsonfile="$5"
    arc_request "$timeout" "$outfile" "$base/$action" \
        --header "Content-Type: $ARC_JSON_TYPE" --data-binary "@$jsonfile"
}

# Succeeds when the file holds exactly one JSON value for which the jq filter yields true.
# Usage: arc_json_check <file> <jq filter> <description>
arc_json_check() {
    local file="$1" filter="$2" what="$3"
    if ! jq -e -s "length == 1 and (.[0] | $filter)" "$file" >/dev/null 2>&1; then
        arc_error "invalid or unexpected response: expected $what"
        return 1
    fi
}

# Writes the names given as arguments as a JSON array of strings to a file.
arc_json_names() {
    local outfile="$1"
    shift
    if (( $# == 0 )); then
        printf '[]\n' > "$outfile"
        return
    fi
    printf '%s\0' "$@" | jq -R -s 'split("\u0000") | .[:-1]' > "$outfile"
}

# Sorts lines from stdin in byte order, as Python's sorted() orders str values.
arc_sort() {
    LC_ALL=C sort
}
