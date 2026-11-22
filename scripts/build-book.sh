#!/bin/sh
# Builds the manual in docs/book with the shared jeonghanlee/mdbook image used by the GitHub Pages workflow, into a
# separate output folder, and then checks every link of the generated pages with check-book-links.pl.
# Usage: build-book.sh [-o OUTPUT_DIR] [-r]
#   -o OUTPUT_DIR  folder for the generated book; it must be empty, mdBook empties it (default: a new folder under ${TMPDIR:-/tmp})
#   -r             pull the published image again even when it exists locally
# Exit status: 0 when the book builds and every link resolves; 2 on a usage error or a folder that is not empty; 1 on a link
# failure or a missing tool; otherwise the status of the failing step (101 when mdBook cannot build the book).
set -eu

script_dir=$(cd "$(dirname "$0")" && pwd)
repo_root=$(cd "$script_dir/.." && pwd)
# mdBook 0.5.4; shared with .github/workflows/pages.yml.
image=jeonghanlee/mdbook@sha256:421d21518a898a5f021d8c480c10cc9d31f520bcd78705f7abd9c4ea0f4d778d
book_dir="$repo_root/docs/book"
output=''
refresh_image=0

usage() {
    sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//' >&2
}

while getopts 'o:rh' option; do
    case "$option" in
        o) output=$OPTARG ;;
        r) refresh_image=1 ;;
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

if [ "$refresh_image" -eq 1 ] || ! docker image inspect "$image" >/dev/null 2>&1; then
    docker pull "$image"
fi

printf 'book image: %s\n' "$image"
docker run --rm --user "$(id -u):$(id -g)" --entrypoint mdbook "$image" --version
docker run --rm --user "$(id -u):$(id -g)" -v "$book_dir:/book:ro" -v "$output:/out" \
    --workdir /book --entrypoint mdbook "$image" build -d /out

site_url=$(sed -n 's/^site-url *= *"\(.*\)"/\1/p' "$book_dir/book.toml")
echo "book written to $output"
exec perl "$script_dir/check-book-links.pl" "$output" ${site_url:+"$site_url"}
