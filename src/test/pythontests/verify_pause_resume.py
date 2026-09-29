#!/usr/bin/env python3
"""Verify pause/resume on real IOC, appliance, retrieval and PB storage paths."""

import argparse
import datetime
import json
import math
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
import uuid
from urllib.parse import urlencode, urlsplit, parse_qs, unquote
from urllib.request import ProxyHandler, Request, build_opener

from verify_list_archived_pvs import (
    ARCHIVE_TIMEOUT, FIXTURE, REPO, START_TIMEOUT, STOP_ALLOWANCE, STOP_TIMEOUT,
    digest, save, stop_owned_jvms,
)

SAMPLES = REPO / "docs/book/src/samples"
READY_TIMEOUT = 120
HTTP_TIMEOUT = 30
ADAPTER = "org.epics.archiverappliance.verification.PVSampleDump"
BUFFER_PROPERTY = "org.epics.archiverappliance.config.PVTypeInfo.secondsToBuffer"
NS = 1_000_000_000
MONITOR_ROUNDING_NS = 500


def instant(value):
    seconds, nanos = divmod(value, NS)
    return datetime.datetime.fromtimestamp(seconds, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") + f".{nanos:09d}Z"


def sample_tuple(row):
    if (type(row.get("secs")) is not int or type(row.get("nanos")) is not int
            or not 0 <= row["nanos"] < NS or type(row.get("val")) not in (int, float)
            or not math.isfinite(row["val"]) or type(row.get("status")) is not int
            or type(row.get("severity")) is not int):
        raise RuntimeError(f"unclassifiable numeric fixture sample: {row}")
    return (row["secs"], row["nanos"], row["val"], row["status"], row["severity"])


def stamp(row):
    return row["secs"] * NS + row["nanos"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_folder", type=Path)
    parser.add_argument("--tomcat-home", default=os.environ.get("TOMCAT_HOME"), required=not os.environ.get("TOMCAT_HOME"))
    parser.add_argument("--ioc", default=shutil.which("softIocPVX"), required=not shutil.which("softIocPVX"))
    parser.add_argument("--monitor", default=shutil.which("camonitor"), required=not shutil.which("camonitor"))
    parser.add_argument("--war-dir", type=Path, default=REPO / "target")
    parser.add_argument("--classpath-file", type=Path, default=REPO / "work/pause-resume-classpath.txt")
    parser.add_argument("--port-base", type=int, default=19665)
    parser.add_argument("--ca-port", type=int, default=19675)
    args = parser.parse_args()
    if not 1024 <= args.port_base <= 65530 or not 1024 <= args.ca_port <= 65535:
        parser.error("ports must be unprivileged and leave room for appliance offsets")
    if args.ca_port in {args.port_base + n for n in (0, 1, 2, 3, 5)}:
        parser.error("CA port must be distinct from appliance ports")
    root = args.run_folder.resolve()
    root.mkdir(parents=True, exist_ok=False)
    deps = args.classpath_file.read_text().strip().split(os.pathsep)
    cp = os.pathsep.join([str(REPO / "target/test-classes"), str(REPO / "target/classes"), *deps])
    java = [shutil.which("java"), "-Dlog4j2.configurationFile=" + str(root / "reader-log.xml"), "-cp", cp, ADAPTER]
    (root / "reader-log.xml").write_text('<Configuration status="OFF"><Appenders/><Loggers><Root level="off"/></Loggers></Configuration>\n')
    env = {**os.environ, "NO_PROXY": "*", "no_proxy": "*", "PYTHONDONTWRITEBYTECODE": "1", "TZ": "UTC",
           "EPICS_CA_AUTO_ADDR_LIST": "NO", "EPICS_CA_ADDR_LIST": "127.0.0.1",
           "EPICS_CA_SERVER_PORT": str(args.ca_port), "EPICS_CAS_SERVER_PORT": str(args.ca_port),
           "EPICS_CAS_INTF_ADDR_LIST": "127.0.0.1", "EPICS_CAS_BEACON_ADDR_LIST": "127.0.0.1",
           "EPICS_PVAS_INTF_ADDR_LIST": "224.0.1.1,1@127.0.0.1"}
    bpl = f"http://127.0.0.1:{args.port_base}/mgmt/bpl"
    retrieval = f"http://127.0.0.1:{args.port_base + 3}/retrieval/data/getData.json"
    prefix = f"PVPAUSE:{uuid.uuid4().hex[:8]}:"
    pvs = [prefix + f"test_{i}" for i in range(12)]
    target, control = pvs[:2]
    app = ioc = monitor = None
    results, store_roots = [], set()
    http = build_opener(ProxyHandler({}))
    began = time.time_ns()
    sources = [SAMPLES / n for n in ("archivePVList.py", "getPVStatus.py", "pausePVList.py", "resumePVList.py", "archiverClient.py", "listArchivedPVs.py")]
    sources += [Path(__file__), Path(__file__).with_name("verify_list_archived_pvs.py"),
                REPO / "src/test/org/epics/archiverappliance/verification/PVSampleDump.java"]
    sources += [REPO / "src/main" / path for path in (
        "org/epics/archiverappliance/engine/ArchiveEngine.java",
        "org/epics/archiverappliance/engine/writer/WriterRunnable.java",
        "org/epics/archiverappliance/engine/model/ArchiveChannel.java",
        "org/epics/archiverappliance/engine/model/SampleBuffer.java",
        "edu/stanford/slac/archiverappliance/PlainPB/AppendDataStateData.java",
    )]
    save(root, "manifest.json", {
        "observed_at": instant(began), "prefix": prefix, "bpl_url": bpl, "python": sys.version,
        "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip(),
        "sources": {str(p.relative_to(REPO)): digest(p) for p in sources}, "fixture": digest(FIXTURE),
        "wars": {str(p): digest(p) for p in sorted(args.war_dir.resolve().glob("*.war"))},
        "adapter": digest(REPO / "target/test-classes" / (ADAPTER.replace(".", "/") + ".class")),
        "classpath_file": digest(args.classpath_file), "classpath": cp,
        "dependencies": {p: digest(Path(p)) for p in deps},
    })
    print(f"Evidence: {root}", flush=True)

    def record(name, passed, **detail):
        results.append({"case": name, "passed": bool(passed), **detail})
        save(root, "results.json", results)
        print(f"[ {'PASS' if passed else 'FAIL'} ] {name}", flush=True)
        if not passed:
            raise RuntimeError(name + " failed")

    def wait(action, timeout, name, poll_interval=1):
        started, last = time.monotonic(), None
        while time.monotonic() - started < timeout:
            for proc in (app, ioc, monitor):
                if proc is not None and proc.poll() is not None:
                    raise RuntimeError(f"owned process exited during {name}: {proc.returncode}")
            last = action()
            if last:
                save(root, name + "-wait.json", {"elapsed": time.monotonic() - started, "last": last})
                return last
            time.sleep(poll_interval)
        save(root, name + "-wait.json", {"elapsed": time.monotonic() - started, "last": last, "expired": True})
        results.append({"case": name, "passed": False, "elapsed": time.monotonic() - started, "deadline": timeout})
        save(root, "results.json", results)
        raise RuntimeError(f"{name} exceeded {timeout}s; see retained last observations")

    def request(url, params):
        url += "?" + urlencode(params)
        with http.open(Request(url), timeout=HTTP_TIMEOUT) as response:
            body = json.load(response)
        with (root / "http.jsonl").open("a") as out:
            out.write(json.dumps({"time": instant(time.time_ns()), "url": url, "response": body}) + "\n")
        return body

    def api(action, params):
        return request(bpl + "/" + action, params)

    def states(names):
        body = api("getPVStatus", {"pv": ",".join(names)})
        save(root, "last-status.json", body)
        return {r["pvName"]: r["status"] for r in body}

    def await_state(names, state, name, timeout=READY_TIMEOUT):
        wait(lambda: states(names) == dict.fromkeys(names, state), timeout, name)

    def cli(name, script, names, statuses=None, code=0):
        path = root / (name + ".txt")
        path.write_text("\n".join(names) + "\n")
        command = [sys.executable, str(SAMPLES / script), bpl, str(path)]
        result = subprocess.run(command, env=env, text=True, capture_output=True, timeout=READY_TIMEOUT)
        (root / (name + ".stdout")).write_text(result.stdout)
        (root / (name + ".stderr")).write_text(result.stderr)
        rows = [re.split(r" {3,}", line) for line in result.stdout.splitlines() if line.startswith(prefix)]
        passed = result.returncode == code and "Traceback" not in result.stderr
        if code == 0:
            passed = passed and not result.stderr
        if statuses is not None:
            passed = passed and rows == [[n, s] for n, s in zip(names, statuses)]
        record(name, passed, command=command, exit=result.returncode)
        return time.time_ns()

    def values(pv, start=began, end=None):
        body = request(retrieval, {"pv": pv, "from": instant(start), "to": instant(end or time.time_ns())})
        if not isinstance(body, list) or len(body) != 1 or body[0]["meta"]["name"] != pv:
            raise RuntimeError("unexpected retrieval identity or structure")
        rows = body[0]["data"]
        for row in rows:
            sample_tuple(row)
        return rows

    def monitored_samples():
        rows = []
        for line in (root / "monitor.log").read_text().splitlines():
            parts = line.split()
            if len(parts) >= 4 and parts[0] == target:
                try:
                    when = datetime.datetime.fromisoformat(parts[1] + "T" + parts[2]).replace(tzinfo=datetime.timezone.utc)
                    rows.append((int(when.timestamp()) * NS + when.microsecond * 1000, float(parts[3])))
                except ValueError:
                    continue
        return rows

    def pb_rows(name):
        files = sorted({p for directory in store_roots for p in directory.rglob("*.pb")})
        if not files:
            return []
        result = subprocess.run([*java, *map(str, files)], cwd=REPO, env=env,
                                capture_output=True, text=True, timeout=HTTP_TIMEOUT)
        (root / (name + "-pb.jsonl")).write_text(result.stdout)
        (root / (name + "-pb.stderr")).write_text(result.stderr)
        if result.returncode:
            return []
        rows = [json.loads(line) for line in result.stdout.splitlines()]
        samples = [r for r in rows if r["kind"] == "sample"]
        for row in samples:
            sample_tuple(row)
        headers = [r for r in rows if r["kind"] == "header"]
        save(root, name + "-excluded.json", {"reason": "header without sample payload", "count": len(headers), "records": headers})
        return samples

    def persisted(name, pv, expected):
        wanted = {sample_tuple(r) for r in expected}
        def check():
            rows = pb_rows(name)
            actual = {sample_tuple(r) for r in rows if r["pvName"] == pv}
            save(root, name + "-missing.json", sorted(wanted - actual))
            return rows if wanted <= actual else None
        return wait(check, READY_TIMEOUT, name)

    try:
        for port, kind in [(args.port_base + n, socket.SOCK_STREAM) for n in (0, 1, 2, 3, 5)] + [
                (args.ca_port, socket.SOCK_STREAM), (args.ca_port, socket.SOCK_DGRAM)]:
            with socket.socket(type=kind) as probe:
                probe.bind(("127.0.0.1", port))
        # The same canonicalization used by the shipped CLI is compared with the real server function.
        sys.path.insert(0, str(SAMPLES))
        from archiverClient import operation_name
        canonical = [operation_name(n) for n in (target, target + ".VAL", "ca://" + target,
                                                 "pva://" + target, target + ".HIHI", target + ".val")]
        check = subprocess.run([*java, "--normalize", *canonical], capture_output=True, text=True, timeout=HTTP_TIMEOUT)
        record("java-canonical-identities", check.returncode == 0 and check.stdout.splitlines() == canonical,
               inputs=canonical, output=check.stdout, stderr=check.stderr)
        command = [str(REPO / "scripts/run-local-appliance.bash"), "--port-base", str(args.port_base),
                   "--tomcat-home", str(Path(args.tomcat_home).resolve()), "--war-dir", str(args.war_dir.resolve()),
                   "--stop-timeout", str(STOP_TIMEOUT), str(root / "appliance")]
        save(root, "launcher-command.json", command)
        with (root / "launcher.log").open("w") as log:
            app = subprocess.Popen(command, env=env, cwd=REPO, stdout=log, stderr=subprocess.STDOUT)
        status = root / "appliance/status"
        wait(lambda: status.exists() and status.read_text().strip() == "ready", START_TIMEOUT, "startup")
        engine_pid = next(line.split("\t")[2] for line in (root / "appliance/children.tsv").read_text().splitlines()
                          if line.split("\t")[1] == "engine")
        engine_env = dict(item.split("=", 1) for item in Path(f"/proc/{engine_pid}/environ").read_text().split("\0") if "=" in item)
        properties = Path(engine_env["ARCHAPPL_PROPERTIES_FILENAME"])
        matches = re.findall(r"^\s*" + re.escape(BUFFER_PROPERTY) + r"\s*=\s*(\d+)\s*$", properties.read_text(), re.M)
        buffer_seconds = int(matches[-1]) if matches else 10
        record("effective-buffer", buffer_seconds > 0, seconds=buffer_seconds, property_file=str(properties),
               sha256=digest(properties), default_used=not matches)
        command = [str(Path(args.ioc).resolve()), "-m", "P=" + prefix, "-d", str(FIXTURE)]
        save(root, "ioc-command.json", command)
        with (root / "ioc.log").open("w") as log:
            ioc = subprocess.Popen(command, env=env, cwd=root, stdin=subprocess.PIPE, stdout=log,
                                   stderr=subprocess.STDOUT, text=True)
        cli("archive", "archivePVList.py", pvs, ["Archive request submitted"] * len(pvs))
        await_state(pvs, "Being archived", "initial-archiving", ARCHIVE_TIMEOUT)
        for pv in pvs:
            info = api("getPVTypeInfo", {"pv": pv})
            for url in info["dataStores"]:
                query = parse_qs(urlsplit(url).query)
                folder = query["rootFolder"][0]
                for key in ("ARCHAPPL_SHORT_TERM_FOLDER", "ARCHAPPL_MEDIUM_TERM_FOLDER", "ARCHAPPL_LONG_TERM_FOLDER"):
                    folder = folder.replace("${" + key + "}", engine_env[key])
                if "${" in folder:
                    raise RuntimeError("unresolved store root: " + folder)
                store_roots.add(Path(unquote(folder)).resolve())
        record("configured-stores", store_roots == {root / "appliance/stores" / n for n in ("sts", "mts", "lts")},
               roots=sorted(map(str, store_roots)))
        baseline = wait(lambda: (r if len(r) >= 3 else None) if (r := values(target)) else None,
                        READY_TIMEOUT, "baseline")[:3]
        save(root, "baseline.json", baseline)
        command = [str(Path(args.monitor).resolve()), "-t", "s", target]
        save(root, "monitor-command.json", command)
        with (root / "monitor.log").open("w") as log:
            monitor = subprocess.Popen(command, env=env, stdout=log, stderr=subprocess.STDOUT)
        wait(monitored_samples, READY_TIMEOUT, "monitor-ready")
        cli("pause", "pausePVList.py", [target], ["Pause accepted"])
        await_state([target], "Paused", "paused")
        stored = persisted("baseline-persistence", target, baseline)
        paused_rows = [r for r in stored if r["pvName"] == target]
        paused_samples = {sample_tuple(r) for r in paused_rows}
        save(root, "paused-snapshot.json", paused_rows)
        metadata_samples = [r for r in stored if r["pvName"] == target and r["fields"].get("startup")]
        record("numeric-connection-sample", bool(metadata_samples), samples=metadata_samples)
        t0 = time.time_ns()
        started = time.monotonic()
        while time.monotonic() - started < 2 * buffer_seconds + 5:
            if any(p.poll() is not None for p in (app, ioc, monitor)):
                raise RuntimeError("owned process exited during pause interval")
            time.sleep(1)
        paused_final = persisted("paused-final-persistence", target, paused_rows)
        record("paused-storage-unchanged", paused_samples == {
            sample_tuple(r) for r in paused_final if r["pvName"] == target})
        paused_retrieval = values(target)
        save(root, "paused-final-retrieval.json", paused_retrieval)
        record("paused-retrieval-unchanged", paused_samples == set(map(sample_tuple, paused_retrieval)))
        # Resume just after an IOC update to exercise its earlier-timestamped current value.
        last_update = max(monitored_samples())[0]
        wait(lambda: [r for r in monitored_samples() if r[0] > last_update],
             READY_TIMEOUT, "current-value-ready", poll_interval=0.02)
        t1 = time.time_ns()
        save(root, "pause-interval.json", {"t0": instant(t0), "t1": instant(t1), "elapsed": time.monotonic() - started})
        resumed = cli("resume", "resumePVList.py", [target], ["Resume accepted"])
        await_state([target], "Being archived", "resumed")
        post = wait(lambda: r if len(r := [v for v in values(target, resumed) if stamp(v) > resumed]) >= 3 else None,
                    READY_TIMEOUT, "resumed-retrieval")[:3]
        save(root, "resumed-samples.json", post)
        persisted("resumed-persistence", target, post)
        record("resumed-pb-samples", True, count=len(post))
        all_rows = values(target)
        current = [r for r in all_rows if stamp(r) < t1 and sample_tuple(r) not in paused_samples]
        prior_updates = [r for r in monitored_samples() if r[0] < t1]
        prior = max(prior_updates, default=None)
        observed = time.time_ns()
        record("resumed-current-value", len(current) == 1 and all(
            prior is not None and abs(stamp(r) - prior[0]) <= MONITOR_ROUNDING_NS and r["val"] == prior[1]
            and r.get("fields", {}).get("startup") == "true"
            and t1 // NS <= int(r["fields"].get("cnxregainedepsecs", -1)) <= observed // NS
            for r in current), samples=current, last_ioc_update_before_resume=prior)
        if current:
            persisted("resumed-current-persistence", target, current)
        observed_baseline = [sample_tuple(r) for r in all_rows if stamp(baseline[0]) <= stamp(r) <= stamp(baseline[-1])]
        record("baseline-preserved", sorted(map(sample_tuple, baseline)) == sorted(observed_baseline))
        boundaries = [r for r in all_rows if stamp(r) in (t0, t1)]
        save(root, "boundary-observations.json", {"count": len(boundaries), "records": boundaries})
        control_rows = [r for r in values(control) if t0 < stamp(r) < t1]
        record("control-progress", len({stamp(r) for r in control_rows}) >= 3
               and len({r["val"] for r in control_rows}) >= 3, samples=control_rows)
        monitor_rows = [row for row in monitored_samples() if t0 < row[0] < t1]
        record("ioc-monitor-progress", monitor.poll() is None and len({r[0] for r in monitor_rows}) >= 3
               and len({r[1] for r in monitor_rows}) >= 3, samples=monitor_rows)
        alias = prefix + "configuredAlias"
        record("alias-setup", api("addAlias", {"pv": target, "aliasname": alias}).get("status") == "ok")
        for script in ("pausePVList.py", "resumePVList.py"):
            for label, names in (("literal", [target, target]), ("val", [target, target + ".VAL"]),
                                 ("alias", [target, alias])):
                cli(script[:6] + "-overlap-" + label, script, names, code=2)
                record(script[:6] + "-unchanged-" + label, states([target])[target] == "Being archived")
                persisted(script[:6] + "-overlap-baseline-" + label, target, baseline)
        for label, name in (("val", target + ".VAL"), ("alias", alias)):
            cli(label + "-pause", "pausePVList.py", [name], ["Pause accepted"])
            await_state([target], "Paused", label + "-paused")
            cli(label + "-repeat-pause", "pausePVList.py", [name], ["Rejected"], 1)
            record(label + "-still-paused", states([target])[target] == "Paused")
            persisted(label + "-rejection-baseline", target, baseline)
            cli(label + "-resume", "resumePVList.py", [name], ["Resume accepted"])
            await_state([target], "Being archived", label + "-resumed")
            cli(label + "-repeat-resume", "resumePVList.py", [name], ["Rejected"], 1)
            record(label + "-still-archived", states([target])[target] == "Being archived")
            persisted(label + "-resume-rejection-baseline", target, baseline)
        unknown = prefix + "unknown"
        for verb in ("pause", "resume"):
            for position in range(3):
                good = pvs[2 + position * 2:4 + position * 2]
                if verb == "resume":
                    cli(f"prepare-{verb}-{position}", "pausePVList.py", good, ["Pause accepted"] * 2)
                    await_state(good, "Paused", f"prepared-{verb}-{position}")
                names = good.copy()
                names.insert(position, unknown)
                labels = [verb.capitalize() + " accepted"] * 3
                labels[position] = "Rejected"
                cli(f"mixed-{verb}-{position}", verb + "PVList.py", names, labels, 1)
                await_state(good, "Paused" if verb == "pause" else "Being archived", f"mixed-{verb}-{position}-state")
                record(f"unknown-{verb}-{position}", states([unknown])[unknown] == "Not being archived")
                if verb == "pause":
                    cli(f"restore-{verb}-{position}", "resumePVList.py", good, ["Resume accepted"] * 2)
                    await_state(good, "Being archived", f"restored-{position}")
        page = (REPO / "docs/book/src/scripting.md").read_text()
        commands = page.split("## Pause and resume archiving\n", 1)[1].split("```bash\n", 1)[1].split("```", 1)[0]
        result = subprocess.run(["bash", "-e", "-c", commands], cwd=REPO,
                                env={**env, "BPL_URL": bpl, "PV_FILE": str(root / "resume.txt")},
                                capture_output=True, text=True, timeout=READY_TIMEOUT)
        (root / "documented-commands.stdout").write_text(result.stdout)
        (root / "documented-commands.stderr").write_text(result.stderr)
        rows = [re.split(r" {3,}", line) for line in result.stdout.splitlines() if line.startswith(prefix)]
        record("documented-commands", result.returncode == 0 and not result.stderr and rows == [
            [target, s] for s in ("Pause accepted", "Paused", "Resume accepted", "Being archived")], commands=commands)
    finally:
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        cleanup = {}
        try:
            if monitor is not None:
                if monitor.poll() is None:
                    monitor.terminate()
                try:
                    cleanup["monitor_exit"] = monitor.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    monitor.kill()
                    monitor.wait()
                    cleanup["monitor_forced_stop"] = True
            deadline = time.monotonic() + STOP_TIMEOUT
            if app is not None:
                try:
                    if app.poll() is None:
                        app.send_signal(signal.SIGTERM)
                    try:
                        cleanup["launcher_exit"] = app.wait(timeout=max(0, deadline - time.monotonic()))
                    except subprocess.TimeoutExpired:
                        app.kill()
                        cleanup["launcher_forced_stop"] = True
                        cleanup["launcher_exit"] = app.wait(timeout=STOP_ALLOWANCE)
                finally:
                    cleanup.update(stop_owned_jvms(root, deadline))
        finally:
            if ioc is not None:
                if ioc.poll() is None:
                    try:
                        ioc.stdin.write("exit\n")
                        ioc.stdin.flush()
                    except BrokenPipeError:
                        pass
                try:
                    cleanup["ioc_exit"] = ioc.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    ioc.kill()
                    ioc.wait()
                    cleanup["ioc_forced_stop"] = True
                ioc.stdin.close()
            save(root, "cleanup.json", cleanup)
        if ((app is not None and (cleanup.get("launcher_exit") != 143 or cleanup.get("owned_jvms_alive")
                                 or cleanup.get("fallback_terminated") or cleanup.get("fallback_killed")))
                or (ioc is not None and cleanup.get("ioc_exit") != 0)
                or cleanup.get("monitor_forced_stop") or cleanup.get("launcher_forced_stop")):
            raise RuntimeError(f"cleanup failed: {cleanup}")
    print(f"PASS: {len(results)} checks; owned appliance, IOC and monitor stopped", flush=True)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda signum, frame: sys.exit(1))
    main()
