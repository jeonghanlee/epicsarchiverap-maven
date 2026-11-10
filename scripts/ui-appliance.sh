#!/bin/sh
# Starts a soft IOC with N test PVs and one development appliance in a private network namespace, archives the PVs, runs
# COMMAND with the appliance on 127.0.0.1, then stops both. The namespace is private, so COMMAND (a browser driver, curl, a
# shell) must be started by this script; nothing outside can reach the appliance, and it never meets another appliance.
# Usage: ui-appliance.sh [OPTIONS] -- COMMAND [ARG...]
#   --count N          number of test PVs, written by gen-test-pvs.pl (default 1000)
#   --war-source DIR   folder with the four WARs of one build (default target)
#   --working-tree     put the static content of the working tree into the mgmt and retrieval WARs of the copy
#   --source-root DIR  take that static content from DIR (a copy of src/main/org/epics/archiverappliance, e.g. of git archive HEAD)
#   --tomcat-home DIR  Tomcat 9 (the namespace has no network, so a download by the launcher fails)
#   --softioc PATH     softIocPVX or softIoc (default $SOFTIOC, else the first found in PATH)
#   --run-dir DIR      folder for the run, its logs and the copied WARs (default a new folder under ${TMPDIR:-/tmp})
#   --port-base PORT   first of the four HTTP ports (default 17665)
#   --settle SECONDS   seconds to wait after the PVs are archived, to collect samples (default 0)
# COMMAND sees AA_MGMT_URL, AA_UI_URL (the Browse page folder), AA_PV_NAMES (file), AA_PV_COUNT and AA_RUN_DIR.
# A TERM sent to this script is handled after COMMAND ends; stop COMMAND to stop the appliance at once.
# The run folder stays after the run, about 1.3 GB (the copied WARs and the appliance data); remove it when it is not needed.
# Needs: unshare, ip, curl, zip, perl, JDK 21 (JAVA_HOME), the build of the WARs. Exit status: that of COMMAND, 2 on a usage error.
set -eu

script_dir=$(cd "$(dirname "$0")" && pwd)
repo_root=$(cd "$script_dir/.." && pwd)
source_root="$repo_root/src/main/org/epics/archiverappliance"
name=ui-appliance.sh
count=1000
war_source="$repo_root/target"
working_tree=0
tomcat_home=''
softioc="${SOFTIOC:-}"
run_dir=''
port_base=17665
settle=0
ready_timeout=300
archive_timeout=900
ioc_pid=''
app_pid=''

usage() {
    sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//' >&2
}

fail() {
    printf '%s: %s\n' "$name" "$1" >&2
    exit "${2:-1}"
}

usage_error() {
    printf '%s: %s\n' "$name" "$1" >&2
    usage
    exit 2
}

log() {
    printf '%s: %s\n' "$name" "$1" >&2
}

absolute_dir() {
    (cd "$1" 2>/dev/null && pwd) || fail "not a directory: $1"
}

# Everything below runs in the private namespace: the first call only enters it.
if [ -z "${AA_UI_APPLIANCE_INNER:-}" ]; then
    for option in "$@"; do
        case "$option" in -h|--help) usage; exit 0 ;; esac
    done
    command -v unshare >/dev/null 2>&1 || fail 'unshare is required'
    AA_UI_APPLIANCE_INNER=1
    export AA_UI_APPLIANCE_INNER
    exec unshare -rn sh "$0" "$@"
fi

while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        --working-tree) working_tree=1; shift ;;
        --count|--war-source|--source-root|--tomcat-home|--softioc|--run-dir|--port-base|--settle)
            [ $# -ge 2 ] || usage_error "$1 needs a value"
            case "$1" in
                --count) count=$2 ;;
                --war-source) war_source=$2 ;;
                --source-root) source_root=$2 ;;
                --tomcat-home) tomcat_home=$2 ;;
                --softioc) softioc=$2 ;;
                --run-dir) run_dir=$2 ;;
                --port-base) port_base=$2 ;;
                --settle) settle=$2 ;;
            esac
            shift 2 ;;
        --) shift; break ;;
        *) usage_error "unknown option: $1" ;;
    esac
done
[ $# -gt 0 ] || usage_error 'COMMAND is missing after --'
for number in "$count" "$port_base" "$settle"; do
    case "$number" in ''|*[!0-9]*) usage_error "not a number: $number" ;; esac
done

command -v curl >/dev/null 2>&1 || fail 'curl is required'
command -v zip >/dev/null 2>&1 || fail 'zip is required'
command -v perl >/dev/null 2>&1 || fail 'perl is required'
command -v ip >/dev/null 2>&1 || fail 'ip is required'
if [ -z "$softioc" ]; then
    softioc=$(command -v softIocPVX || command -v softIoc || true)
fi
if [ -z "$softioc" ] || [ ! -x "$softioc" ]; then
    fail 'no soft IOC: give --softioc or set SOFTIOC'
fi
war_source=$(absolute_dir "$war_source")
source_root=$(absolute_dir "$source_root")
[ -z "$tomcat_home" ] || tomcat_home=$(absolute_dir "$tomcat_home")

# shellcheck disable=SC2317  # run by the trap below
cleanup() {
    trap - EXIT INT TERM
    if [ -n "$app_pid" ]; then
        kill -TERM "$app_pid" 2>/dev/null || true
        wait "$app_pid" 2>/dev/null || true
    fi
    if [ -n "$ioc_pid" ]; then
        kill "$ioc_pid" 2>/dev/null || true
        wait "$ioc_pid" 2>/dev/null || true
    fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

ip link set lo up
EPICS_CA_AUTO_ADDR_LIST=NO
EPICS_CA_ADDR_LIST=127.0.0.1
EPICS_PVA_AUTO_ADDR_LIST=NO
EPICS_PVA_ADDR_LIST=127.0.0.1
# The default Channel Access array limit is 16384 bytes, the size of a 2048-element array of doubles; a camera frame of 2304000
# 16-bit pixels is 4.6 MB (9.2 MB as 32-bit values), so the soft IOC and the engine of the run take a limit of 16 MB.
EPICS_CA_MAX_ARRAY_BYTES=16000000
export EPICS_CA_AUTO_ADDR_LIST EPICS_CA_ADDR_LIST EPICS_PVA_AUTO_ADDR_LIST EPICS_PVA_ADDR_LIST EPICS_CA_MAX_ARRAY_BYTES

if [ -z "$run_dir" ]; then
    run_dir=$(mktemp -d "${TMPDIR:-/tmp}/aa-ui-appliance.XXXXXX")
else
    mkdir -p "$run_dir"
fi
run_dir=$(absolute_dir "$run_dir")
mgmt_url="http://127.0.0.1:$port_base/mgmt"
log "run folder $run_dir"

perl "$script_dir/gen-test-pvs.pl" --count "$count" --db "$run_dir/pvs.db" --names "$run_dir/names.txt"

wars="$run_dir/wars"
mkdir -p "$wars"
# The positional parameters of this script are COMMAND and its arguments, so a function takes the glob.
# It sets found_war instead of printing it: a command substitution would hide the exit of fail.
find_war() {
    war_folder=$1
    war_component=$2
    set -- "$war_folder"/*-"$war_component".war
    [ -f "$1" ] || fail "no $war_component WAR in $war_folder"
    found_war=$1
}
for component in mgmt engine etl retrieval; do
    find_war "$war_source" "$component"
    cp "$found_war" "$wars/"
done

# The static content of a WAR is under ui/; the files shared by the two web applications are under ui/comm/.
repack() {
    component=$1
    stage="$run_dir/stage-$component"
    mkdir -p "$stage/ui/comm"
    cp -R "$source_root/staticcontent/." "$stage/ui/comm/"
    cp -R "$source_root/$component/staticcontent/." "$stage/ui/"
    find_war "$wars" "$component"
    (cd "$stage" && zip -qr "$found_war" ui)
}
if [ "$working_tree" -eq 1 ]; then
    repack mgmt
    repack retrieval
    log 'static content of the working tree is in the mgmt and retrieval WARs'
fi

"$softioc" -S -d "$run_dir/pvs.db" >"$run_dir/ioc.log" 2>&1 &
ioc_pid=$!

start_appliance() {
    set -- --war-dir "$wars" --port-base "$port_base"
    [ -z "$tomcat_home" ] || set -- "$@" --tomcat-home "$tomcat_home"
    "$script_dir/run-local-appliance.bash" "$@" "$run_dir/appliance" >"$run_dir/appliance.log" 2>&1 &
    app_pid=$!
}
start_appliance

waited=0
until curl -s --noproxy '*' -m 3 "$mgmt_url/bpl/getApplianceInfo" 2>/dev/null | grep -q dataRetrievalURL; do
    kill -0 "$app_pid" 2>/dev/null || fail "the appliance stopped; see $run_dir/appliance.log"
    waited=$((waited + 2))
    [ "$waited" -le "$ready_timeout" ] || fail "the appliance is not ready after $ready_timeout s; see $run_dir/appliance.log"
    sleep 2
done
log "the appliance answers after about $waited s"

post() {
    curl -s --noproxy '*' -m 120 -H 'Content-Type: application/json' --data-binary @- "$mgmt_url/bpl/$1"
}
chunks=$(mktemp -d "$run_dir/chunks.XXXXXX")
split -l 100 "$run_dir/names.txt" "$chunks/archive."
for chunk in "$chunks"/archive.*; do
    awk 'BEGIN { printf "[" } { printf "%s{\"pv\":\"%s\",\"samplingperiod\":\"1\",\"samplingmethod\":\"MONITOR\"}", (NR > 1 ? "," : ""), $0 } END { print "]" }' "$chunk" | post archivePV >/dev/null
done
split -l 250 "$run_dir/names.txt" "$chunks/status."
waited=0
while :; do
    archived=0
    for chunk in "$chunks"/status.*; do
        found=$(awk 'BEGIN { printf "[" } { printf "%s{\"pv\":\"%s\"}", (NR > 1 ? "," : ""), $0 } END { print "]" }' "$chunk" | post 'getPVStatus?reporttype=short' | grep -o 'Being archived' | wc -l)
        archived=$((archived + found))
    done
    log "being archived: $archived of $count"
    [ "$archived" -lt "$count" ] || break
    waited=$((waited + 15))
    [ "$waited" -le "$archive_timeout" ] || fail "only $archived of $count PVs are archived after $archive_timeout s"
    sleep 15
done
[ "$settle" -eq 0 ] || { log "collecting samples for $settle s"; sleep "$settle"; }

AA_MGMT_URL=$mgmt_url
AA_UI_URL="$mgmt_url/ui/"
AA_PV_NAMES="$run_dir/names.txt"
AA_PV_COUNT=$count
AA_RUN_DIR=$run_dir
export AA_MGMT_URL AA_UI_URL AA_PV_NAMES AA_PV_COUNT AA_RUN_DIR
status=0
"$@" || status=$?
exit "$status"
