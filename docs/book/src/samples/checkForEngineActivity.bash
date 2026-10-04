#!/usr/bin/env bash
# Checks for engine activity in a PB storage folder. The folder tree is walked twice, the given
# number of seconds apart, recording each file's path and size; a path and size seen only in the
# second walk counts as a change. A file removed between listing and reading its size, as ETL
# does when it moves partitions, is skipped. No HTTP request is made.
#
# Usage: checkForEngineActivity.bash [-t SEC] FOLDER
# Exit status: 0 changes seen, 1 no change seen, 2 invalid arguments or unreadable folder.

set -o nounset -o pipefail

SCRIPT_DIR="$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")"
# shellcheck source=archiverClient.bash
if ! source "$SCRIPT_DIR/archiverClient.bash"; then
    printf 'error: cannot load %s\n' "$SCRIPT_DIR/archiverClient.bash" >&2
    exit 1
fi

readonly DEFAULT_INTERVAL=30

# Prints the usage text; with "help" on stdout and exit 0, otherwise on stderr and exit 2.
usage() {
    local text
    text="$(printf '%s\n' \
        "usage: $(basename -- "$0") [-t SEC] FOLDER" \
        "Report whether any file under FOLDER changed path or size within SEC seconds." \
        "  FOLDER  the folder holding the PB files, for example the short-term store" \
        "  -t SEC  seconds between the two walks, a positive integer (default $DEFAULT_INTERVAL)")"
    if [[ "${1:-}" == help ]]; then
        printf '%s\n' "$text"
        exit "$ARC_EXIT_OK"
    fi
    printf '%s\n' "$text" >&2
    exit "$ARC_EXIT_USAGE"
}

# Prints one "<path>_<size>" line per file under the folder, in byte order, as os.walk and
# os.path.getsize see them: regular files with their size, symbolic links to files with the
# size of their target, symbolic links to folders not followed. A subfolder that cannot be
# read is reported on stderr by find and skipped; a file that disappears is skipped.
snapshot() {
    {
        find "$1" -ignore_readdir_race \( -type f -printf '%p_%s\n' \) \
            -o \( -type l -xtype f -exec stat -L --printf '%n_%s\n' {} + \) || true
    } 2> >(grep -v 'No such file or directory' >&2) | LC_ALL=C sort -u
}

main() {
    local interval="$DEFAULT_INTERVAL" folder changes
    local -a positional=()
    while (( $# > 0 )); do
        case "$1" in
            -t)
                (( $# >= 2 )) || usage
                interval="$2"
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
    if [[ ! "$interval" =~ ^[0-9]+$ ]] || (( 10#$interval < 1 )); then
        arc_error "-t must be a positive integer number of seconds"
        exit "$ARC_EXIT_USAGE"
    fi
    interval=$((10#$interval))
    folder="${positional[0]}"
    if [[ ! -d "$folder" || ! -r "$folder" || ! -x "$folder" ]]; then
        arc_error "cannot read folder: $folder"
        exit "$ARC_EXIT_USAGE"
    fi

    arc_make_tmp || exit "$ARC_EXIT_FAILED"
    snapshot "$folder" > "$ARC_TMP/before"
    sleep "$interval"
    snapshot "$folder" > "$ARC_TMP/after"
    changes="$(LC_ALL=C comm -13 "$ARC_TMP/before" "$ARC_TMP/after" | wc -l)"
    if (( changes > 0 )); then
        printf '%d changes were detected in %d seconds\n' "$changes" "$interval"
        exit "$ARC_EXIT_OK"
    fi
    printf 'No changes detected in the last %d seconds\n' "$interval"
    exit "$ARC_EXIT_FAILED"
}

main "$@"
