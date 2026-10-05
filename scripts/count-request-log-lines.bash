#!/usr/bin/env bash
# Counts the INFO lines each appliance component writes for a fixed set of requests at the default log level.
# Starts the four WARs of one build with the local launcher and a softIocPVX that serves one archived PV, sends N data
# requests that reach the engine and N mgmt getApplianceInfo requests, then counts the lines written for them in each
# component console log. Run it on two builds with the same N to compare them.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly SCRIPT_DIR REPO_ROOT
readonly FIXTURE="$REPO_ROOT/src/resources/test/UnitTestPVs.db"
readonly PV_PREFIX='REQLOG:'
readonly PV_NAME="${PV_PREFIX}UnitTestNoNamingConvention:sine"
readonly -a COMPONENTS=(mgmt engine etl retrieval)
readonly START_WAIT_SECONDS=180
readonly ARCHIVE_WAIT_SECONDS=180
readonly DATA_WAIT_SECONDS=15
readonly FLUSH_WAIT_SECONDS=5
readonly DATA_WINDOW_BEFORE_SECONDS=60
readonly DATA_WINDOW_AFTER_SECONDS=5

war_dir='target'
port_base=17665
requests=20
run_folder=''
launcher_pid=''
ioc_pid=''
ioc_input=''

function die {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

function usage {
    cat <<'USAGE'
Usage: count-request-log-lines.bash [OPTIONS] RUN_FOLDER

Counts how many INFO lines each appliance component writes at the default log level for the same set of requests,
so that two builds can be compared.

Options:
  --war-dir DIR     Directory containing one build's four WARs (target)
  --port-base PORT  Loopback HTTP ports PORT..PORT+3; Channel Access port PORT+10 (17665)
  --requests N      Requests of each kind to send (20)
  -h, --help        Show this help

Requires JAVA_HOME and TOMCAT_HOME or a standard Tomcat 9 location as for run-local-appliance.bash, softIocPVX,
curl and GNU date in PATH. RUN_FOLDER must not exist. Prints one line per component with the counts of
`Servicing`, `Beginning request`, `Found a total of` and all INFO lines written while the requests ran.
Besides RUN_FOLDER it writes RUN_FOLDER.launcher.log (the launcher output, which holds the cause of a startup
failure), RUN_FOLDER.ioc.log and, while it runs, RUN_FOLDER.ioc.in.
USAGE
}

function parse_args {
    while (( $# )); do
        case "$1" in
            -h|--help) usage; exit 0 ;;
            --war-dir|--port-base|--requests)
                (( $# >= 2 )) || die "$1 needs a value"
                case "$1" in
                    --war-dir) war_dir="$2" ;;
                    --port-base) port_base="$2" ;;
                    --requests) requests="$2" ;;
                esac
                shift 2 ;;
            -*) die "unknown option $1" ;;
            *) [[ -z "$run_folder" ]] || die "only one RUN_FOLDER is accepted"; run_folder="$1"; shift ;;
        esac
    done
    [[ -n "$run_folder" ]] || { usage >&2; exit 2; }
    [[ ! -e "$run_folder" ]] || die "$run_folder exists"
    [[ "$port_base" =~ ^[0-9]+$ ]] || die "--port-base must be an integer"
    [[ "$requests" =~ ^[0-9]+$ ]] || die "--requests must be a positive integer"
    (( requests >= 1 )) || die "--requests must be a positive integer"
    command -v softIocPVX > /dev/null || die "softIocPVX is not in PATH"
    command -v curl > /dev/null || die "curl is not in PATH"
}

function cleanup {
    local status=$?
    if [[ -n "$launcher_pid" ]] && kill -0 "$launcher_pid" 2> /dev/null; then
        kill -TERM "$launcher_pid" 2> /dev/null || true
        wait "$launcher_pid" 2> /dev/null || true
    fi
    if [[ -n "$ioc_pid" ]]; then
        kill "$ioc_pid" 2> /dev/null || true
        wait "$ioc_pid" 2> /dev/null || true
    fi
    { exec 9>&-; } 2> /dev/null || true
    [[ -z "$ioc_input" ]] || rm -f "$ioc_input"
    exit "$status"
}

function wait_until {
    local seconds="$1" description="$2"
    shift 2
    local waited=0
    until "$@"; do
        (( waited < seconds )) || die "timed out waiting for $description"
        sleep 1
        waited=$((waited + 1))
    done
}

function appliance_ready {
    kill -0 "$launcher_pid" 2> /dev/null || die "the launcher exited before the appliance was ready; see $run_folder.launcher.log"
    [[ -f "$run_folder/status" && "$(cat "$run_folder/status")" == ready ]]
}

function pv_archived {
    curl -s -S "$mgmt/getPVStatus?pv=$PV_NAME" | grep -q 'Being archived'
}

function console_log {
    printf '%s/instances/%s/logs/console.log' "$run_folder" "$1"
}

function send_requests {
    local kind="$1" url code ok=0 from to
    for _ in $(seq 1 "$requests"); do
        if [[ "$kind" == data ]]; then
            from=$(date -u -d "-$DATA_WINDOW_BEFORE_SECONDS seconds" +%Y-%m-%dT%H:%M:%S.000Z)
            to=$(date -u -d "+$DATA_WINDOW_AFTER_SECONDS seconds" +%Y-%m-%dT%H:%M:%S.000Z)
            url="$retrieval?pv=$PV_NAME&from=$from&to=$to"
        else
            url="$mgmt/getApplianceInfo"
        fi
        code=$(curl -s -S -o /dev/null -w '%{http_code}' "$url")
        [[ "$code" == 200 ]] && ok=$((ok + 1))
    done
    printf '%s' "$ok"
}

parse_args "$@"
readonly mgmt="http://127.0.0.1:${port_base}/mgmt/bpl"
readonly retrieval="http://127.0.0.1:$((port_base + 3))/retrieval/data/getData.json"
readonly ca_port=$((port_base + 10))
trap cleanup EXIT

export NO_PROXY='*' no_proxy='*'
export EPICS_CA_AUTO_ADDR_LIST=NO EPICS_CA_ADDR_LIST=127.0.0.1
export EPICS_CA_SERVER_PORT="$ca_port" EPICS_CAS_SERVER_PORT="$ca_port"
export EPICS_CAS_INTF_ADDR_LIST=127.0.0.1 EPICS_CAS_BEACON_ADDR_LIST=127.0.0.1
export EPICS_PVAS_INTF_ADDR_LIST='224.0.1.1,1@127.0.0.1'

mkdir -p "$(dirname "$run_folder")"
"$SCRIPT_DIR/run-local-appliance.bash" --war-dir "$war_dir" --port-base "$port_base" "$run_folder" \
    > "$run_folder.launcher.log" 2>&1 &
launcher_pid=$!
wait_until "$START_WAIT_SECONDS" "the appliance to be ready" appliance_ready

# Holding the fifo open for writing keeps the IOC shell from reading end of input.
ioc_input="$run_folder.ioc.in"
mkfifo "$ioc_input"
exec 9<> "$ioc_input"
softIocPVX -m "P=$PV_PREFIX" -d "$FIXTURE" <&9 > "$run_folder.ioc.log" 2>&1 &
ioc_pid=$!
sleep 3
curl -s -S -X POST -H 'Content-Type: application/json' \
    -d "[{\"pv\":\"$PV_NAME\",\"samplingmethod\":\"MONITOR\",\"samplingperiod\":\"1\"}]" \
    "$mgmt/archivePV" > /dev/null
wait_until "$ARCHIVE_WAIT_SECONDS" "$PV_NAME to be archived" pv_archived
sleep "$DATA_WAIT_SECONDS"

declare -A mark
for component in "${COMPONENTS[@]}"; do
    mark[$component]=$(wc -l < "$(console_log "$component")")
done
data_ok=$(send_requests data)
info_ok=$(send_requests info)
sleep "$FLUSH_WAIT_SECONDS"

printf 'requests=%s data_200=%s getApplianceInfo_200=%s\n' "$requests" "$data_ok" "$info_ok"
for component in "${COMPONENTS[@]}"; do
    window=$(tail -n +"$((mark[$component] + 1))" "$(console_log "$component")")
    printf '%s servicing=%s beginning=%s found_total=%s info_total=%s\n' "$component" \
        "$(grep -c 'BasicDispatcher - Servicing' <<< "$window" || true)" \
        "$(grep -c 'Beginning.*request into Engine servlet' <<< "$window" || true)" \
        "$(grep -c 'GetEngineDataAction - Found a total of' <<< "$window" || true)" \
        "$(grep -c '<6>INFO' <<< "$window" || true)"
done
