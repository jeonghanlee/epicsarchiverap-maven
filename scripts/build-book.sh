#!/bin/sh
# Builds the manual in docs/book with the pinned aa-mdbook image, the way the GitHub Pages workflow does, into a
# separate output folder, and then checks every link of the generated pages with check-book-links.pl.
# Usage: build-book.sh [-o OUTPUT_DIR] [-r]
#   -o OUTPUT_DIR  folder for the generated book; it must be empty, mdBook empties it (default: a new folder under ${TMPDIR:-/tmp})
#   -r             build the aa-mdbook image again even when it exists
# Exit status: 0 when the book builds and every link resolves; 2 on a usage error or a folder that is not empty; 1 on a link
# failure or a missing tool; otherwise the status of the failing step (101 when mdBook cannot build the book).
set -eu

script_dir=$(cd "$(dirname "$0")" && pwd)
repo_root=$(cd "$script_dir/.." && pwd)
image=aa-mdbook
book_dir="$repo_root/docs/book"
output=''
rebuild=0

usage() {
    sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//' >&2
}

while getopts 'o:rh' option; do
    case "$option" in
        o) output=$OPTARG ;;
        r) rebuild=1 ;;
        h) usage; exit 0 ;;
        *) usage; exit 2 ;;
    esac
done

command -v docker >/dev/null 2>&1 || { echo "build-book.sh: docker is required" >&2; exit 1; }
[ -f "$book_dir/book.toml" ] || { echo "build-book.sh: $book_dir/book.toml not found" >&2; exit 1; }

if [ -z "$output" ]; then
    output=$(mktemp -d "${TMPDIR:-/tmp}/aa-book.XXXXXX")
else
    mkdir -p "$output"
fi
output=$(cd "$output" && pwd)
if [ -n "$(ls -A "$output")" ]; then
    echo "build-book.sh: $output is not empty; mdBook would remove its contents" >&2
    exit 2
fi

if [ "$rebuild" -eq 1 ] || ! docker image inspect "$image" >/dev/null 2>&1; then
    docker build -t "$image" "$book_dir"
fi

docker run --rm --user "$(id -u):$(id -g)" -v "$book_dir:/book:ro" -v "$output:/out" "$image" build -d /out

site_url=$(sed -n 's/^site-url *= *"\(.*\)"/\1/p' "$book_dir/book.toml")
echo "book written to $output"
exec perl "$script_dir/check-book-links.pl" "$output" ${site_url:+"$site_url"}
