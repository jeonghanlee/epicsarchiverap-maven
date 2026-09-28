#!/usr/bin/env bash
# Runs one development appliance with persistent configuration in a retained folder.
set -euo pipefail

readonly TOMCAT_VERSION='9.0.122'
readonly TOMCAT_ARCHIVE="apache-tomcat-${TOMCAT_VERSION}.tar.gz"
readonly TOMCAT_URL="https://archive.apache.org/dist/tomcat/tomcat-9/v${TOMCAT_VERSION}/bin/${TOMCAT_ARCHIVE}"
readonly TOMCAT_SHA_URL="${TOMCAT_URL}.sha512"
readonly REAP_SECONDS=5
readonly -a COMPONENTS=(mgmt engine etl retrieval)
readonly -a LOCAL_TOMCATS=(/opt/tomcat9 /opt/tomcat /usr/local/tomcat9 /usr/local/tomcat /usr/share/tomcat9)
# Keep JVM diagnostics from changing /proc/self/coredump_filter or shared temp files.
readonly -a JVM_COMMON_OPTIONS=(-XX:-UsePerfData -XX:+UnlockDiagnosticVMOptions
    -XX:-DumpPrivateMappingsInCore -XX:-DumpSharedMappingsInCore)

run_dir=''
war_dir='target'
tomcat_home="${TOMCAT_HOME:-${CATALINA_HOME:-}}"
java_home="${JAVA_HOME:-}"
port_base=17665
start_timeout=180
stop_timeout=300
stop_signal=0
boot_id=''
build_name=''
store_url_root=''
clock_cs=0
process_start=''
process_state=''
declare -a child_pids=()
declare -a child_starts=()

function die {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

function usage {
    cat <<'USAGE'
Usage: run-local-appliance.bash [OPTIONS] RUN_FOLDER

Run the four locally built WARs in separate foreground Tomcat 9 instances.
Stop with Ctrl-C or SIGTERM. The run folder, database, stores and logs remain.

Options:
  --war-dir DIR          Directory containing one build's four WARs (target)
  --tomcat-home DIR      Existing Tomcat 9; otherwise use TOMCAT_HOME,
                         CATALINA_HOME, standard locations, or download 9.0.122
  --port-base PORT       Loopback HTTP ports PORT..PORT+3; cluster PORT+5 (17665)
  --start-timeout SEC    Startup limit, integer seconds from 1 to 86400 (180)
  --stop-timeout SEC     Total graceful-stop limit, 1 to 86400 seconds (300)
  -h, --help            Show this help

Requires Linux, Bash 4+, JDK 21, Python 3, sqlite3, curl, unzip, tar,
sha512sum, flock and standard coreutils. This is a development launcher.
USAGE
}

function positive_integer {
    [[ "$2" =~ ^[0-9]{1,6}$ ]] || die "$1 must be a positive integer"
    (( 10#$2 >= 1 && 10#$2 <= 86400 )) || die "$1 must be between 1 and 86400"
}

function parse_args {
    local option
    local -a positional=()
    while (( $# )); do
        option="$1"
        case "$option" in
            -h|--help) usage; exit 0 ;;
            --war-dir|--tomcat-home|--port-base|--start-timeout|--stop-timeout)
                (( $# >= 2 )) || die "Missing value for $option"
                [[ -n "$2" ]] || die "Empty value for $option"
                case "$option" in
                    --war-dir) war_dir="$2" ;;
                    --tomcat-home) tomcat_home="$2" ;;
                    --port-base) positive_integer "$option" "$2"; port_base=$((10#$2)) ;;
                    --start-timeout) positive_integer "$option" "$2"; start_timeout=$((10#$2)) ;;
                    --stop-timeout) positive_integer "$option" "$2"; stop_timeout=$((10#$2)) ;;
                esac
                shift 2
                ;;
            --) shift; positional+=("$@"); break ;;
            -*) die "Unknown option: $option" ;;
            *) positional+=("$1"); shift ;;
        esac
    done
    (( ${#positional[@]} == 1 )) || die 'Supply exactly one run folder; see --help'
    (( port_base >= 1024 && port_base <= 65530 )) || die 'Port base must be between 1024 and 65530'
    run_dir="${positional[0]}"
    [[ "$run_dir" != *[$'\n\r\t?']* ]] || die 'Run folder must not contain a newline, tab, CR or question mark'
}

function require_tools {
    local tool resolved
    for tool in python3 sqlite3 curl unzip tar sha512sum flock realpath mkdir env sleep; do
        resolved=$(command -v "$tool") || die "Required executable not found: $tool"
        [[ -x "$resolved" ]] || die "Required executable is not executable: $tool"
    done
    [[ -r /proc/uptime && -r /proc/sys/kernel/random/boot_id ]] || die 'Linux /proc is required'
}

function select_wars {
    local component
    local -a candidates=()
    war_dir=$(realpath -e -- "$war_dir") || die "WAR directory not found: $war_dir"
    shopt -s nullglob
    candidates=("$war_dir"/*-mgmt.war)
    shopt -u nullglob
    (( ${#candidates[@]} == 1 )) || die 'WAR directory must contain exactly one build; run ./mvnw clean package first'
    build_name="${candidates[0]##*/}"
    build_name="${build_name%-mgmt.war}"
    for component in "${COMPONENTS[@]}"; do
        [[ -s "$war_dir/$build_name-$component.war" ]] || die "Missing WAR: $build_name-$component.war"
    done
}

# Linux start ticks and boot identity protect against PID reuse across invocations.
function read_process {
    local line
    local -a fields=()
    IFS= read -r line 2>/dev/null < "/proc/$1/stat" || return 1
    read -r -a fields <<< "${line##*) }"
    (( ${#fields[@]} >= 20 )) || return 1
    process_state="${fields[0]}"
    process_start="${fields[19]}"
}

function is_alive {
    read_process "$1" || return 1
    [[ "$process_start" == "$2" && "$process_state" != Z && "$process_state" != X ]]
}

function check_survivors {
    local saved_boot component pid started
    [[ -e "$run_dir/children.tsv" ]] || return 0
    [[ -s "$run_dir/children.tsv" ]] || return 0
    while IFS=$'\t' read -r saved_boot component pid started; do
        [[ "$pid" =~ ^[0-9]+$ && "$started" =~ ^[0-9]+$ ]] || die 'Invalid children.tsv; inspect the retained run folder'
        if [[ "$saved_boot" == "$boot_id" ]] && is_alive "$pid" "$started"; then
            die "Previous $component process $pid is still alive; run folder cannot be reused"
        fi
    done < "$run_dir/children.tsv"
}

function clock_now {
    local uptime _unused whole fraction
    read -r uptime _unused < /proc/uptime
    whole="${uptime%.*}"
    fraction="${uptime#*.}00"
    clock_cs=$((10#$whole * 100 + 10#${fraction:0:2}))
}

function any_alive {
    local i
    for i in "${!child_pids[@]}"; do
        if is_alive "${child_pids[i]}" "${child_starts[i]}"; then
            return 0
        fi
    done
    return 1
}

# All components share one deadline, including repeated termination signals.
function cleanup {
    local result=$? i deadline forced=0
    trap - EXIT
    trap '' INT TERM
    clock_now
    deadline=$((clock_cs + stop_timeout * 100))
    for ((i=${#child_pids[@]}-1; i>=0; i--)); do
        if is_alive "${child_pids[i]}" "${child_starts[i]}"; then
            printf 'Stopping %s (PID %s)\n' "${COMPONENTS[i]}" "${child_pids[i]}"
            kill -TERM "${child_pids[i]}" 2>/dev/null || true
            while is_alive "${child_pids[i]}" "${child_starts[i]}"; do
                clock_now
                (( clock_cs < deadline )) || break
                sleep 0.1
            done
        fi
        clock_now
        (( clock_cs < deadline )) || break
    done
    for i in "${!child_pids[@]}"; do
        if is_alive "${child_pids[i]}" "${child_starts[i]}"; then
            forced=1
            printf 'Forced stop: %s (PID %s); buffered samples may be unflushed\n' "${COMPONENTS[i]}" "${child_pids[i]}" >&2
            kill -KILL "${child_pids[i]}" 2>/dev/null || true
        fi
    done
    clock_now
    deadline=$((clock_cs + REAP_SECONDS * 100))
    while any_alive; do
        clock_now
        (( clock_cs < deadline )) || break
        sleep 0.1
    done
    for i in "${!child_pids[@]}"; do
        if is_alive "${child_pids[i]}" "${child_starts[i]}"; then
            forced=1
            printf 'Still alive: %s (PID %s, start %s); folder reuse is blocked\n' "${COMPONENTS[i]}" "${child_pids[i]}" "${child_starts[i]}" >&2
        else
            wait "${child_pids[i]}" 2>/dev/null || true
        fi
    done
    if (( forced )); then
        result=1
        printf 'incomplete-stop\n' > "$run_dir/status"
    else
        printf 'stopped\n' > "$run_dir/status"
    fi
    printf 'Run folder retained: %s\n' "$run_dir"
    exit "$result"
}

function usable_tomcat {
    local info
    [[ -r "$1/bin/catalina.sh" && -x "$1/bin/catalina.sh" && -r "$1/bin/setclasspath.sh" &&
       -r "$1/bin/bootstrap.jar" && -r "$1/bin/tomcat-juli.jar" &&
       -r "$1/conf/catalina.properties" && -r "$1/conf/web.xml" && -r "$1/lib/tomcat-jdbc.jar" ]] || return 1
    info=$(unzip -p "$1/lib/catalina.jar" org/apache/catalina/util/ServerInfo.properties 2>/dev/null) || return 1
    [[ "$info" == *'server.number=9.'* ]]
}

function select_tomcat {
    local candidate expected _checksum_filename archive
    if [[ -n "$tomcat_home" ]]; then
        usable_tomcat "$tomcat_home" || die "Explicit Tomcat home is not a usable Tomcat 9: $tomcat_home"
        tomcat_home=$(realpath -e -- "$tomcat_home")
        return
    fi
    for candidate in "${LOCAL_TOMCATS[@]}" "$run_dir/distribution/apache-tomcat-$TOMCAT_VERSION"; do
        if usable_tomcat "$candidate"; then
            tomcat_home=$(realpath -e -- "$candidate")
            return
        fi
    done
    mkdir -p -- "$run_dir/downloads" "$run_dir/distribution"
    archive="$run_dir/downloads/$TOMCAT_ARCHIVE"
    printf 'Downloading Tomcat %s from %s\n' "$TOMCAT_VERSION" "$TOMCAT_URL"
    curl -q --fail --location --proto '=https' --proto-redir '=https' --connect-timeout 15 --max-time 180 \
        --output "$archive.part" "$TOMCAT_URL"
    curl -q --fail --location --proto '=https' --proto-redir '=https' --connect-timeout 15 --max-time 60 \
        --output "$archive.sha512" "$TOMCAT_SHA_URL"
    [[ -s "$archive.part" && -s "$archive.sha512" ]] || die 'Empty Tomcat download'
    read -r expected _checksum_filename < "$archive.sha512" || [[ -n "${expected:-}" ]]
    [[ "$expected" =~ ^[a-fA-F0-9]{128}$ ]] || die 'Invalid Apache SHA-512 checksum'
    printf '%s  %s\n' "$expected" "$archive.part" | sha512sum --check --status || die 'Tomcat SHA-512 mismatch; archive was not extracted'
    mv -- "$archive.part" "$archive"
    printf 'SHA-512 verified: %s\n' "$TOMCAT_ARCHIVE"
    tar -xzf "$archive" -C "$run_dir/distribution" --no-same-owner
    tomcat_home="$run_dir/distribution/apache-tomcat-$TOMCAT_VERSION"
    usable_tomcat "$tomcat_home" || die 'Downloaded Tomcat is incomplete'
}

function configure {
    python3 - "$run_dir" "$war_dir" "$build_name" "$tomcat_home" "$port_base" <<'PY'
import json
import pathlib
import shutil
import socket
import sqlite3
import sys
import xml.etree.ElementTree as ET
import zipfile

root, wars, build, tomcat, first = sys.argv[1:]
root, wars, tomcat, first = pathlib.Path(root), pathlib.Path(wars), pathlib.Path(tomcat), int(first)
components = ("mgmt", "engine", "etl", "retrieval")

# Check ports before replacing a retained instance's generated configuration.
sockets = []
try:
    for port in [first, first + 1, first + 2, first + 3, first + 5]:
        sock = socket.socket()
        sockets.append(sock)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("127.0.0.1", port))
except OSError as exc:
    sys.exit(f"Component or cluster port {port} is unavailable: {exc}")
finally:
    for sock in sockets:
        sock.close()

for folder in ("config", "home", "stores/sts", "stores/mts", "stores/lts"):
    (root / folder).mkdir(parents=True, exist_ok=True)

def write_xml(path, tree):
    ET.indent(tree, space="    ")
    ET.ElementTree(tree).write(path, encoding="utf-8", xml_declaration=True)

appliances = ET.Element("appliances")
appliance = ET.SubElement(appliances, "appliance")
ET.SubElement(appliance, "identity").text = "appliance0"
ET.SubElement(appliance, "cluster_inetport").text = f"localhost:{first + 5}"
for offset, name in enumerate(components):
    ET.SubElement(appliance, name + "_url").text = f"http://127.0.0.1:{first + offset}/{name}/bpl"
ET.SubElement(appliance, "data_retrieval_url").text = f"http://127.0.0.1:{first + 3}/retrieval"
write_xml(root / "config/appliances.xml", appliances)

with zipfile.ZipFile(wars / f"{build}-mgmt.war") as archive:
    schema = archive.read("install/archappl_sqlite.sql").decode("utf-8")
    (root / "config/archappl_sqlite.sql").write_text(schema)
    for name in ("policies.py", "archappl.properties"):
        (root / "config" / name).write_bytes(archive.read("WEB-INF/classes/" + name))

database = root / "config/archappl.sqlite"
fresh = not database.exists()
with sqlite3.connect(database) as connection:
    if fresh:
        connection.executescript("BEGIN;\n" + schema + "\nCOMMIT;")
    expected = {"PVTypeInfo", "PVAliases", "ArchivePVRequests", "ExternalDataServers"}
    found = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if not expected <= found:
        sys.exit("Incomplete SQLite schema; database retained for inspection")
    connection.execute("PRAGMA journal_mode=WAL")

for offset, name in enumerate(components):
    base = root / "instances" / name
    for folder in ("bin", "conf", "logs", "temp", "work", "webapps"):
        (base / folder).mkdir(parents=True, exist_ok=True)
    for filename in ("catalina.properties", "web.xml"):
        shutil.copyfile(tomcat / "conf" / filename, base / "conf" / filename)
    (base / "bin/setenv.sh").write_text("# Environment is supplied by the local appliance launcher.\n")
    (base / "conf/logging.properties").write_text(
        "handlers=java.util.logging.ConsoleHandler\n.level=INFO\n"
        "java.util.logging.ConsoleHandler.level=INFO\n"
        "java.util.logging.ConsoleHandler.formatter=org.apache.juli.OneLineFormatter\n"
    )
    server = ET.Element("Server", port="-1")
    service = ET.SubElement(server, "Service", name="Catalina")
    ET.SubElement(service, "Connector", port=str(first + offset), address="127.0.0.1",
                  protocol="HTTP/1.1", connectionTimeout="20000", maxThreads="40")
    engine = ET.SubElement(service, "Engine", name="Catalina", defaultHost="localhost")
    ET.SubElement(engine, "Host", name="localhost", appBase="webapps", unpackWARs="true", autoDeploy="false")
    write_xml(base / "conf/server.xml", server)
    context = ET.Element("Context")
    if name == "mgmt":
        ET.SubElement(context, "Resource", name="jdbc/archappl", auth="Container",
                      factory="org.apache.tomcat.jdbc.pool.DataSourceFactory", type="javax.sql.DataSource",
                      driverClassName="org.sqlite.JDBC", url=f"jdbc:sqlite:{database}?journal_mode=WAL",
                      maxActive="1", maxIdle="1", minIdle="0", initialSize="0", maxWait="10000",
                      testOnBorrow="true", validationInterval="30000", validationQuery="SELECT 1")
    write_xml(base / "conf/context.xml", context)
    shutil.copyfile(wars / f"{build}-{name}.war", base / "webapps" / f"{name}.war")

(root / "run.json").write_text(json.dumps({"build": build, "tomcat_home": str(tomcat),
    "port_base": first, "database": str(database)}, indent=2) + "\n")
PY
}

function start_components {
    local i component base options pid
    : > "$run_dir/children.tsv"
    for i in "${!COMPONENTS[@]}"; do
        (( stop_signal == 0 )) || return 0
        component="${COMPONENTS[i]}"
        base="$run_dir/instances/$component"
        printf -v options '%q ' '-Xms32m' '-Xmx256m' '-XX:ActiveProcessorCount=2' "${JVM_COMMON_OPTIONS[@]}" \
            "-Duser.home=$run_dir/home" "-Dorg.sqlite.tmpdir=$base/temp" "-Dpython.cachedir=$base/temp/jython" \
            "-XX:ErrorFile=$base/logs/hs_err_pid%p.log"
        (
            exec 9>&-
            cd -- "$run_dir"
            exec env -i PATH="$PATH" LANG=C.UTF-8 \
                JAVA_HOME="$java_home" JRE_HOME="$java_home" CATALINA_HOME="$tomcat_home" \
                CATALINA_BASE="$base" CATALINA_TMPDIR="$base/temp" TMPDIR="$base/temp" CATALINA_OPTS="$options" \
                ARCHAPPL_MYIDENTITY=appliance0 ARCHAPPL_APPLIANCES="$run_dir/config/appliances.xml" \
                ARCHAPPL_POLICIES="$run_dir/config/policies.py" ARCHAPPL_PROPERTIES_FILENAME="$run_dir/config/archappl.properties" \
                ARCHAPPL_PERSISTENCE_LAYER=org.epics.archiverappliance.config.persistence.MySQLPersistence ARCHAPPL_DB_NAME=archappl \
                ARCHAPPL_SHORT_TERM_FOLDER="$store_url_root/sts" ARCHAPPL_MEDIUM_TERM_FOLDER="$store_url_root/mts" \
                ARCHAPPL_LONG_TERM_FOLDER="$store_url_root/lts" \
                EPICS_CA_AUTO_ADDR_LIST=NO EPICS_CA_ADDR_LIST="${EPICS_CA_ADDR_LIST:-127.0.0.1}" \
                EPICS_CA_SERVER_PORT="${EPICS_CA_SERVER_PORT:-5064}" EPICS_CA_MAX_ARRAY_BYTES="${EPICS_CA_MAX_ARRAY_BYTES:-16777216}" \
                EPICS_PVA_AUTO_ADDR_LIST=NO EPICS_PVA_ADDR_LIST="${EPICS_PVA_ADDR_LIST:-127.0.0.1}" \
                "$tomcat_home/bin/catalina.sh" run
        ) >> "$base/logs/console.log" 2>&1 &
        pid=$!
        child_pids+=("$pid")
        if read_process "$pid"; then
            child_starts+=("$process_start")
        else
            child_starts+=(0)
        fi
        printf '%s\t%s\t%s\t%s\n' "$boot_id" "$component" "$pid" "${child_starts[i]}" >> "$run_dir/children.tsv"
        printf '%s: http://127.0.0.1:%s/%s/ (PID %s, log %s/logs/console.log)\n' \
            "$component" "$((port_base+i))" "$component" "$pid" "$base"
    done
}

function ensure_children {
    local i
    for i in "${!child_pids[@]}"; do
        is_alive "${child_pids[i]}" "${child_starts[i]}" || die "Component exited: ${COMPONENTS[i]}; see its console.log"
    done
}

function wait_ready {
    local deadline i response ready
    clock_now
    deadline=$((clock_cs + start_timeout * 100))
    while (( stop_signal == 0 )); do
        ensure_children
        ready=1
        for i in "${!COMPONENTS[@]}"; do
            response=$(curl -q --noproxy '*' --fail --silent --max-time 1 \
                "http://127.0.0.1:$((port_base+i))/${COMPONENTS[i]}/bpl/startupState") || response=''
            [[ "$response" == *'"STARTUP_COMPLETE"'* ]] || ready=0
        done
        if (( ready )) && curl -q --noproxy '*' --fail --silent --max-time 1 \
            "http://127.0.0.1:$port_base/mgmt/bpl/getApplianceInfo" > "$run_dir/appliance-info.json"; then
            printf 'ready\n' > "$run_dir/status"
            printf 'Appliance ready. Stop with Ctrl-C or SIGTERM.\n'
            return
        fi
        clock_now
        (( clock_cs < deadline )) || die "Startup timed out after $start_timeout seconds"
        sleep 0.2
    done
}

function main {
    local version javac_path
    parse_args "$@"
    require_tools
    select_wars
    run_dir=$(realpath -m -- "$run_dir")
    [[ "$run_dir" != / && ! -L "$run_dir/.launcher.lock" ]] || die 'Invalid run folder or lock file'
    mkdir -p -- "$run_dir"
    exec 9>> "$run_dir/.launcher.lock"
    flock --exclusive --nonblock 9 || die "Run folder is already locked: $run_dir"
    IFS= read -r boot_id < /proc/sys/kernel/random/boot_id
    # Refuse redirected output paths before opening metadata or generated files.
    python3 - "$run_dir" <<'PY'
import pathlib, sys
root = pathlib.Path(sys.argv[1])
for path in root.rglob("*"):
    if path.is_symlink():
        sys.exit(f"Symlink inside run folder is unsupported: {path}")
PY
    check_survivors
    trap 'cleanup' EXIT
    trap 'stop_signal=130' INT
    trap 'stop_signal=143' TERM
    printf '%s\n' "$$" > "$run_dir/launcher.pid"
    printf 'preparing\n' > "$run_dir/status"
    printf 'Run folder: %s\nBuild: %s\nGraceful stop limit: %s seconds (+%s seconds to reap)\n' \
        "$run_dir" "$build_name" "$stop_timeout" "$REAP_SECONDS"
    if [[ -z "$java_home" ]]; then
        javac_path=$(command -v javac) || die 'JDK 21 javac not found'
        javac_path=$(realpath -e -- "$javac_path")
        java_home="${javac_path%/bin/javac}"
    fi
    [[ -x "$java_home/bin/java" && -x "$java_home/bin/javac" ]] || die 'JAVA_HOME must name a JDK 21 installation'
    java_home=$(realpath -e -- "$java_home")
    version=$(env -i PATH="$PATH" "$java_home/bin/java" "${JVM_COMMON_OPTIONS[@]}" -version 2>&1)
    [[ "$version" == *'version "21.'* || "$version" == *'version "21"'* ]] || die 'JDK 21 is required'
    select_tomcat
    printf 'Tomcat home: %s\n' "$tomcat_home"
    (( stop_signal == 0 )) || exit "$stop_signal"
    configure
    (( stop_signal == 0 )) || exit "$stop_signal"
    # Store macros are URI query values; the storage plugin decodes them to paths.
    store_url_root=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe="/"))' "$run_dir/stores")
    start_components
    wait_ready
    while (( stop_signal == 0 )); do
        ensure_children
        sleep 0.2
    done
    exit "$stop_signal"
}

main "$@"
