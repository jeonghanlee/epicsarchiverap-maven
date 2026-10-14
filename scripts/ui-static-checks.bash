#!/usr/bin/env bash
# Static checks of the management interface and the data viewer under src/main/org/epics/archiverappliance.
# A management page keeps the marker blocks the site overlay replaces, every full page carries a content
# security policy, no page has an inline script, an event-handler or style attribute, no interface file refers
# to jQuery or to an outside host, every element id a script reads exists in its page, the vendored chart
# library is the file its record names, and the text colors of the shared stylesheet keep their contrast.
# The last section copies the tree, breaks one thing per copy and requires the checks to refuse each copy.
#
# Usage: bash scripts/ui-static-checks.bash
# Exit status 0 when every check passes; the first failing check ends the run with status 1.

set -euo pipefail

TOP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly TOP

# The tree under test; a mutation run points this at a copy of the interface files.
ROOT="${UI_STATIC_TREE_UNDER_TEST:-${TOP}}"
UI="${ROOT}/src/main/org/epics/archiverappliance"
SITES="${ROOT}/src/sitespecific"
MAIN_CSS="${UI}/staticcontent/css/main.css"

# The interface files: the management pages and scripts, the data viewer, and the shared chart code.
# The shared stylesheet main.css is the site skin; only its text contrast is checked below.
INTERFACE_DIRS=(mgmt/staticcontent retrieval/staticcontent/viewer staticcontent/js)
INTERFACE_FILES=(staticcontent/css/chart.css)

PASS_COUNT=0
FAIL_COUNT=0
WORKSPACE="${WORKSPACE:-$(mktemp -d -t ui-static-checks.XXXXXX)}"
trap 'rm -rf "${WORKSPACE}"' EXIT

_record_pass() {
    PASS_COUNT=$((PASS_COUNT + 1))
    printf '  [OK]   %s\n' "$1"
}

_record_fail() {
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf '  [FAIL] %s\n' "$1" >&2
    if [[ -n "${2:-}" ]]; then
        printf '         %s\n' "$2" >&2
    fi
    exit 1
}

assert_eq() {
    local actual="$1" expected="$2" desc="$3"
    if [[ "${actual}" == "${expected}" ]]; then
        _record_pass "${desc}"
    else
        _record_fail "${desc}" "expected '${expected}', got '${actual}'"
    fi
}

assert_file() {
    local path="$1" desc="$2"
    if [[ -f "${path}" ]]; then
        _record_pass "${desc}"
    else
        _record_fail "${desc}" "missing: ${path}"
    fi
}

assert_dir() {
    local path="$1" desc="$2"
    if [[ -d "${path}" ]]; then
        _record_pass "${desc}"
    else
        _record_fail "${desc}" "missing dir: ${path}"
    fi
}

printf '\n=== Interface files: markers, content security, inline code and element ids ===\n'
assert_dir "${UI}/mgmt/staticcontent" "The management pages folder exists"
assert_dir "${UI}/retrieval/staticcontent/viewer" "The data viewer folder exists"

function interface_files {
    local dir file
    {
        for dir in "${INTERFACE_DIRS[@]}"; do
            find "${UI}/${dir}" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' \) ! -path '*/js/vendor/*'
        done
        for file in "${INTERFACE_FILES[@]}"; do
            printf '%s\n' "${UI}/${file}"
        done
    } | LC_ALL=C sort
}

function interface_pages {
    interface_files | grep -E '\.html$' || true
}

function is_forward {
    grep -q -E 'http-equiv="refresh"|js/forward\.js' "$1"
}

# ---- every page ------------------------------------------------------------------------------------
while IFS= read -r page; do
    name="${page#"${UI}/"}"

    inline=$(grep -n -E '<script' "${page}" | grep -v -E 'src=' || true)
    assert_eq "${inline}" "" "${name} has no inline script"

    handlers=$(grep -n -E '[[:space:]]on[a-z]+[[:space:]]*=' "${page}" || true)
    assert_eq "${handlers}" "" "${name} has no event-handler attribute"

    styles=$(grep -n -E '[[:space:]]style[[:space:]]*=' "${page}" || true)
    assert_eq "${styles}" "" "${name} has no inline style attribute"

    scripts=$(grep -n -E 'javascript:' "${page}" || true)
    assert_eq "${scripts}" "" "${name} has no javascript: address"

    if is_forward "${page}"; then
        continue
    fi

    case "$(cat "${page}")" in
        *"Content-Security-Policy"*"script-src 'self'"*) _record_pass "${name} carries a content security policy" ;;
        *) _record_fail "${name} carries a content security policy" "no script-src 'self' policy found" ;;
    esac

    case "${name}" in
        mgmt/staticcontent/*)
            for block in site_header site_logo site_navbar site_footer; do
                begins=$(grep -c -F "@begin(${block})" "${page}" || true)
                ends=$(grep -c -F "@end(${block})" "${page}" || true)
                if [[ "${begins}" == 1 && "${ends}" == 1 ]]; then
                    _record_pass "${name} keeps the marker block ${block}"
                else
                    _record_fail "${name} keeps the marker block ${block}" "marker block missing or repeated (begin ${begins}, end ${ends})"
                fi
            done
            # A screen reader announces the menu as a navigation region by its name and each dialog by its heading.
            menu=$(grep -c -F '<nav class="nav" aria-label="Main menu">' "${page}" || true)
            assert_eq "${menu}" "1" "${name} names its main menu navigation"
            unnamed=''
            while IFS= read -r dialog; do
                label=$(printf '%s' "${dialog}" | sed -n -E 's/.*aria-labelledby="([^"]+)".*/\1/p')
                if [[ -z "${label}" ]] || ! grep -q -F "id=\"${label}\"" "${page}"; then
                    unnamed+=" ${dialog}"
                fi
            done < <(grep -o -E '<dialog[^>]*>' "${page}" || true)
            assert_eq "${unnamed}" "" "${name} names every dialog by a heading (unnamed:${unnamed})"
            ;;
    esac
done < <(interface_pages)

# ---- every interface file --------------------------------------------------------------------------
while IFS= read -r file; do
    name="${file#"${UI}/"}"
    jquery=$(grep -n -i 'jquery' "${file}" || true)
    assert_eq "${jquery}" "" "${name} does not refer to jQuery"
    markup=$(grep -n -E 'innerHTML|outerHTML|insertAdjacentHTML|document\.write|[^a-zA-Z]eval\(|new Function' "${file}" || true)
    assert_eq "${markup}" "" "${name} does not turn text into markup or run text as code"
    # The SVG namespace is an identifier, not an address that is requested. The help page links to the manual, a page
    # the reader opens on purpose, not a resource the page loads.
    hosts=$(sed -e 's|http://www\.w3\.org/2000/svg||g' -e 's|href="https://jeonghanlee\.github\.io/epicsarchiverap-maven/"||g' "${file}" \
        | grep -n -E 'https?://' || true)
    assert_eq "${hosts}" "" "${name} does not refer to an outside host"
done < <(interface_files)

# ---- every server call is written with its literal path ---------------------------------------------
# StaticContentBPLCallsTest collects the pattern ../bpl/<name> from the management files and checks each name
# against the registered actions, so a call has to be written in that form to be checked there.
calls=$(grep -h -o -E '\.\./bpl/[A-Za-z]+(/[A-Za-z]+)*' -r "${UI}/mgmt/staticcontent" --include='*.js' --include='*.html' | sed 's|\.\./bpl/||' | LC_ALL=C sort -u)
case $'\n'"${calls}"$'\n' in
    *$'\ngetPVStatus\n'*) _record_pass "The management files name their server calls with the literal ../bpl/ path" ;;
    *) _record_fail "The management files name their server calls with the literal ../bpl/ path" "getPVStatus is not written as ../bpl/getPVStatus" ;;
esac
assert_eq "$([[ $(printf '%s\n' "${calls}" | wc -l) -ge 30 ]] && echo enough || echo few)" "enough" "At least 30 server calls are written with the literal path"

# ---- element ids read by a script exist in its page ------------------------------------------------
PAIRS=(
    "mgmt/staticcontent/index.html:mgmt/staticcontent/js/browse.js"
    "mgmt/staticcontent/system.html:mgmt/staticcontent/js/system.js"
    "mgmt/staticcontent/operations.html:mgmt/staticcontent/js/operations.js"
    "mgmt/staticcontent/retrieval.html:mgmt/staticcontent/js/retrieval.js"
    "mgmt/staticcontent/external.html:mgmt/staticcontent/js/external.js"
    "mgmt/staticcontent/archive.html:mgmt/staticcontent/js/archive.js"
    "retrieval/staticcontent/viewer/archViewer.html:retrieval/staticcontent/viewer/viewer.js"
)
for pair in "${PAIRS[@]}"; do
    page="${UI}/${pair%%:*}"
    script="${UI}/${pair##*:}"
    assert_file "${page}" "${pair%%:*} exists"
    assert_file "${script}" "${pair##*:} exists"
    missing=''
    while IFS= read -r id; do
        [[ -n "${id}" ]] || continue
        grep -q -F "id=\"${id}\"" "${page}" || missing+=" ${id}"
    done < <({ grep -o -E '(\$|getElementById)\("[A-Za-z0-9_-]+"\)' "${script}" | sed -E 's/.*\("([^"]+)"\)/\1/'
               grep -o -E '(fill|emptyRow)\("[A-Za-z0-9_-]+"' "${script}" | sed -E 's/.*\("([^"]+)"/\1/'; } | LC_ALL=C sort -u)
    assert_eq "${missing}" "" "${pair##*:} reads only element ids that ${pair%%:*} defines (no element for:${missing})"
done

# ---- no site overlay names jQuery ------------------------------------------------------------------
while IFS= read -r template; do
    site_jquery=$(grep -n -i 'jquery' "${template}" || true)
    assert_eq "${site_jquery}" "" "${template#"${ROOT}/"} does not refer to jQuery"
done < <(find "${SITES}" -mindepth 2 -maxdepth 2 -name template_changes.html | LC_ALL=C sort)

# ---- a PV name is a base name with an optional field --------------------------------------------
# The server archives X:Y.RBV as a PV of its own, so the name patterns of the pages must accept it.
for script in mgmt/staticcontent/js/browse.js mgmt/staticcontent/js/archive.js retrieval/staticcontent/viewer/viewer.js; do
    refused=$(python3 -I - "${UI}/${script}" <<'PY'
import re, sys
text = open(sys.argv[1], encoding="utf-8").read()
match = re.search(r"^const PV_NAME = /(.*)/;$", text, re.M)
if not match:
    print("no PV_NAME pattern")
    sys.exit(0)
pattern = re.compile(match.group(1))
bad = [n for n in ("UI:TEST:X1", "UI:TEST:X2.A", "SR:C01:BPM.RBV") if not pattern.search(n)]
bad += [n for n in ("bad name!", "X.", "X..Y") if pattern.search(n)]
print(" ".join(bad))
PY
)
    assert_eq "${refused}" "" "${script} accepts a PV name with a field and refuses a malformed name (wrong for: ${refused})"
done
system_links=$(grep -c 'pageHref(row.href)' "${UI}/mgmt/staticcontent/js/system.js" || true)
assert_eq "${system_links}" "1" "The System overview builds its detail links with the chosen appliance"

# ---- a reduced range does not fill empty intervals ---------------------------------------------------
# mean_N fills an interval without samples with the previous value; meanSample_N leaves it empty, so a lost connection
# is not drawn as a held line.
filling=$(grep -rn -E '`mean_\$' "${UI}/mgmt/staticcontent" "${UI}/retrieval/staticcontent/viewer" "${UI}/staticcontent/js" --include='*.js' || true)
assert_eq "${filling}" "" "No page asks the server for mean_N, which fills an interval without samples"

# ---- the vendored chart library is the file its record names -----------------------------------------
d3_recorded=$(grep -o -E '[0-9a-f]{64}' "${UI}/staticcontent/js/vendor/d3.SOURCE.txt" | head -1 || true)
d3_actual=$(sha256sum "${UI}/staticcontent/js/vendor/d3.min.js" | cut -d' ' -f1)
assert_eq "${d3_actual}" "${d3_recorded}" "d3.min.js matches the SHA-256 recorded in d3.SOURCE.txt"

# ---- scripts, styles and images named by a page exist ----------------------------------------------
# comm/ is the shared folder staticcontent/, which the build serves as ui/comm of every web application.
while IFS= read -r page; do
    name="${page#"${UI}/"}"
    dir="$(dirname "${name}")"
    while IFS= read -r reference; do
        [[ -n "${reference}" ]] || continue
        case "${reference}" in http*|//*) continue ;; esac
        resolved=$(realpath -m --relative-to="${UI}" "${UI}/${dir}/${reference}")
        shared="${resolved}"
        case "${reference}" in
            comm/*) shared="staticcontent/${reference#comm/}" ;;
            ../comm/*) shared="staticcontent/${reference#../comm/}" ;;
        esac
        if [[ -f "${UI}/${resolved}" || -f "${UI}/${shared}" ]]; then
            _record_pass "${name} finds ${reference}"
        else
            _record_fail "${name} finds ${reference}" "no such file under src/main/org/epics/archiverappliance"
        fi
    done < <(grep -o -E '(src|href|srcset)="[^"]+\.(js|css|svg)"' "${page}" | sed -E 's/^(src|href|srcset)="//; s/"$//')
done < <(interface_pages)

# ---- text colors keep a contrast of at least 4.5:1 -------------------------------------------------
# The tokens are read from the shared stylesheet; a token that points to another one is followed.
contrast=$(python3 -I - "${MAIN_CSS}" <<'PY'
import re, sys
text = open(sys.argv[1]).read()
tokens = dict(re.findall(r'^\s*(--[a-z0-9-]+):\s*([^;]+);', text, re.M))
def value(name):
    v = tokens[name].strip()
    m = re.fullmatch(r'var\((--[a-z0-9-]+)\)', v)
    return value(m.group(1)) if m else v
def luminance(h):
    h = h.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
def ratio(a, b):
    hi, lo = sorted((luminance(a), luminance(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)
failures = []
for foreground in ('--ink', '--ink-2', '--ink-3', '--accent', '--warn', '--alarm'):
    for background in ('--bg', '--focus-bg'):
        r = ratio(value(foreground), value(background))
        if r < 4.5:
            failures.append('%s on %s is %.2f:1' % (foreground, background, r))
print('; '.join(failures))
PY
)
assert_eq "${contrast}" "" "Every text color has a contrast of at least 4.5:1 on the page and on a selected row"

# ---- the checks reject a copy with one defect each -------------------------------------------------
# A check that cannot fail protects nothing: each copy below holds one defect and must be refused,
# and for the reason named, not for another one.
function expect_rejected {
    local description="$1" phrase="$2" relative="$3" snippet="$4"
    local tree="${WORKSPACE}/mutation-${description// /-}" output status=0
    mkdir -p "${tree}/src/main/org/epics/archiverappliance/mgmt" "${tree}/src/main/org/epics/archiverappliance/retrieval" "${tree}/src/sitespecific"
    cp -a "${UI}/mgmt/staticcontent" "${tree}/src/main/org/epics/archiverappliance/mgmt/staticcontent"
    cp -a "${UI}/retrieval/staticcontent" "${tree}/src/main/org/epics/archiverappliance/retrieval/staticcontent"
    cp -a "${UI}/staticcontent" "${tree}/src/main/org/epics/archiverappliance/staticcontent"
    cp -a "${SITES}/." "${tree}/src/sitespecific/"
    F="${tree}/src/${relative}" bash -c "${snippet}"
    output=$(UI_STATIC_TREE_UNDER_TEST="${tree}" bash "${BASH_SOURCE[0]}" 2>&1) || status=$?
    if [[ "${status}" -eq 0 ]]; then
        _record_fail "A copy with ${description} is refused" "the checks passed"
    fi
    case "${output}" in
        *"${phrase}"*) _record_pass "A copy with ${description} is refused: ${phrase}" ;;
        *) _record_fail "A copy with ${description} is refused for the named reason" "expected '${phrase}' in: ${output}" ;;
    esac
}

A="main/org/epics/archiverappliance"
if [[ -z "${UI_STATIC_TREE_UNDER_TEST:-}" ]]; then
    expect_rejected "a page without its navigation block" "marker block site_navbar" \
        "${A}/mgmt/staticcontent/system.html" "sed -i '/@begin(site_navbar)/d' \"\$F\""
    expect_rejected "a main menu without its navigation name" "names its main menu navigation" \
        "${A}/mgmt/staticcontent/system.html" "sed -i 's| aria-label=\"Main menu\"||' \"\$F\""
    expect_rejected "a dialog without its name" "names every dialog by a heading" \
        "${A}/mgmt/staticcontent/external.html" "sed -i 's| aria-labelledby=\"addTitle\"||' \"\$F\""
    expect_rejected "an inline script" "has no inline script" \
        "${A}/mgmt/staticcontent/system.html" "printf '<script>alert(1)</script>\\n' >> \"\$F\""
    expect_rejected "an event handler" "has no event-handler attribute" \
        "${A}/mgmt/staticcontent/external.html" "sed -i '0,/<button/s//<button onclick=\"go()\"/' \"\$F\""
    expect_rejected "a jQuery reference" "does not refer to jQuery" \
        "${A}/mgmt/staticcontent/js/browse.js" "printf '// jQuery\\n' >> \"\$F\""
    expect_rejected "an unknown element id" "no element for: noSuchElement" \
        "${A}/mgmt/staticcontent/js/browse.js" "printf 'document.getElementById(\"noSuchElement\");\\n' >> \"\$F\""
    expect_rejected "an outside host" "does not refer to an outside host" \
        "${A}/retrieval/staticcontent/viewer/viewer.js" "printf '// https://example.invalid/x.js\\n' >> \"\$F\""
    expect_rejected "an outside link on the help page" "help.html does not refer to an outside host" \
        "${A}/mgmt/staticcontent/help.html" "sed -i 's|jeonghanlee.github.io/epicsarchiverap-maven/|example.invalid/|' \"\$F\""
    expect_rejected "no content security policy" "carries a content security policy" \
        "${A}/mgmt/staticcontent/index.html" "sed -i '/Content-Security-Policy/d' \"\$F\""
    expect_rejected "a script that is not there" "finds js/missing.js" \
        "${A}/mgmt/staticcontent/index.html" "sed -i 's|js/browse.js|js/missing.js|' \"\$F\""
    expect_rejected "a picture source that is not there" "finds comm/img/missing.svg" \
        "${A}/mgmt/staticcontent/index.html" "sed -i 's|srcset=\"comm/img/wordmark.svg\"|srcset=\"comm/img/missing.svg\"|' \"\$F\""
    expect_rejected "data inserted as markup" "does not turn text into markup" \
        "${A}/mgmt/staticcontent/js/browse.js" "printf 'document.body.innerHTML = \"\";\\n' >> \"\$F\""
    expect_rejected "a server call built from parts" "name their server calls with the literal" \
        "${A}/mgmt/staticcontent/index.html" "grep -rl --include='*.js' --include='*.html' 'bpl/getPVStatus' \"\$(dirname \"\$F\")\" | xargs sed -i 's|bpl/getPVStatus|bpl/get\" + \"PVStatus|g'"
    expect_rejected "a site overlay that includes jQuery" "template_changes.html does not refer to jQuery" \
        "sitespecific/tests/template_changes.html" "printf '<script src=\"comm/js/jquery.js\"></script>\\n' >> \"\$F\""
    expect_rejected "a PV name pattern without the field" "accepts a PV name with a field" \
        "${A}/retrieval/staticcontent/viewer/viewer.js" "sed -i 's|(\\\\.\\[a-zA-Z_\\]\\[a-zA-Z0-9_\\]\\*)?||' \"\$F\""
    expect_rejected "a reduced range that fills empty intervals" "asks the server for mean_N" \
        "${A}/retrieval/staticcontent/viewer/viewer.js" "sed -i 's|meanSample_|mean_|' \"\$F\""
    expect_rejected "a vendored chart library that differs from its record" "matches the SHA-256 recorded" \
        "${A}/staticcontent/js/vendor/d3.min.js" "printf '\\n' >> \"\$F\""
    expect_rejected "a faint text color below the contrast limit" "contrast of at least 4.5:1" \
        "${A}/staticcontent/css/main.css" "sed -i 's|--ink-3: var(--c-muted);|--ink-3: #9aa9ae;|' \"\$F\""
fi

printf '\n[PASS] Interface files (passed=%d failed=%d)\n\n' "${PASS_COUNT}" "${FAIL_COUNT}"
