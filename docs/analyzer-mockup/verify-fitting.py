"""Check browser-exported fits against saved observations and SciPy."""

import csv
import hashlib
import json
from datetime import datetime
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares
from scipy.special import ndtr, xlogy
from scipy.stats import linregress, norm, poisson


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / "analyzer-signal-examples" / "data"


def verify_uncertainty(report, predict, csv_file):
    config, result = report["config"], report["result"]
    uncertainty = result["uncertainty"]
    free = [parameter for parameter in config["parameters"] if not parameter["fixed"]]
    assert uncertainty["parameterOrder"] == [parameter["name"] for parameter in free]
    assert uncertainty["confidenceLevel"] == 0.95
    assert uncertainty["criticalValue"] == norm.ppf(0.975)
    max_relative_error = None
    if uncertainty["status"] == "estimated":
        rows, p, model = result["rows"], result["parameters"], config["model"]
        y = np.array([row["y"] for row in rows])
        expected = predict(p)
        if report["view"] == "distribution":
            if model == "poisson":
                probability, derivative = [], []
                for row in rows:
                    k = np.arange(row["firstInteger"], row["lastInteger"] + 1)
                    pmf = poisson.pmf(k, p["lambda"])
                    probability.append(pmf.sum())
                    derivative.append(p["n"] * np.sum(pmf * (k / p["lambda"] - 1)))
                derivatives = {"n": probability, "lambda": derivative}
            else:
                low = np.array([row["lower"] for row in rows])
                high = np.array([row["upper"] for row in rows])
                a, b = (low - p["mu"]) / p["sigma"], (high - p["mu"]) / p["sigma"]
                derivatives = {"n": ndtr(b) - ndtr(a), "mu": p["n"] * (norm.pdf(a) - norm.pdf(b)) / p["sigma"],
                               "sigma": p["n"] * (a * norm.pdf(a) - b * norm.pdf(b)) / p["sigma"], "background": high - low}
        else:
            x = np.array([row["x"] for row in rows])
            if model == "peak":
                z = (x - p["mu"]) / p["sigma"]
                shape = np.exp(-0.5 * z ** 2)
                derivatives = {"b": np.ones(len(rows)), "a": shape,
                               "mu": p["a"] * shape * z / p["sigma"], "sigma": p["a"] * shape * z ** 2 / p["sigma"]}
            else:
                centered = x - config["x0"]
                derivatives = {"b": np.ones(len(rows)), "m": centered, "q": centered ** 2}
        jacobian = np.column_stack([derivatives[parameter["name"]] for parameter in free])
        if config["objective"] == "poisson":
            information = jacobian.T @ (jacobian / np.maximum(expected[:, None], 1e-12))
            variance_scale = 1
        else:
            information = jacobian.T @ jacobian
            variance_scale = np.sum((y - expected) ** 2) / result["df"]
        covariance = np.linalg.inv(information) * variance_scale
        standard_errors = np.sqrt(np.diag(covariance))
        exported_errors = np.array([uncertainty["parameters"][parameter["name"]]["standardError"] for parameter in free])
        np.testing.assert_allclose(exported_errors, standard_errors, rtol=2e-4, atol=0)
        normalization = np.outer(standard_errors, standard_errors)
        np.testing.assert_allclose(np.array(uncertainty["covariance"]) / normalization, covariance / normalization, rtol=5e-4, atol=1e-4)
        np.testing.assert_allclose(uncertainty["varianceScale"], variance_scale, rtol=2e-5)
        max_relative_error = float(np.max(np.abs(exported_errors / standard_errors - 1)))
        if model == "linear":
            regression = linregress(np.array([row["x"] for row in rows]) - config["x0"], y)
            np.testing.assert_allclose(uncertainty["parameters"]["m"]["standardError"], regression.stderr, rtol=1e-8)
            np.testing.assert_allclose(uncertainty["parameters"]["b"]["standardError"], regression.intercept_stderr, rtol=1e-8)
        for parameter in free:
            entry = uncertainty["parameters"][parameter["name"]]
            margin = norm.ppf(0.975) * entry["standardError"]
            np.testing.assert_allclose([entry["lower95"], entry["upper95"]],
                                       [p[parameter["name"]] - margin, p[parameter["name"]] + margin], rtol=1e-12)
    else:
        assert uncertainty["covariance"] is None
        assert uncertainty["reason"]
        assert all(entry["standardError"] is None and entry["lower95"] is None and entry["upper95"] is None
                   for entry in uncertainty["parameters"].values())
    csv_rows = list(csv.DictReader(csv_file.open()))
    assert len(csv_rows) == len(config["parameters"])
    for parameter, exported in zip(config["parameters"], csv_rows):
        entry = uncertainty["parameters"][parameter["name"]]
        assert exported["parameter"] == parameter["name"]
        assert exported["unit"] == parameter["unit"]
        assert exported["uncertainty_status"] == entry["status"]
        for field, key in [("standard_error", "standardError"), ("lower_95", "lower95"), ("upper_95", "upper95")]:
            assert exported[field] == "" if entry[key] is None else float(exported[field]) == entry[key]
        if parameter["fixed"]:
            assert entry["status"] == "fixed" and entry["standardError"] is None
    return {"status": uncertainty["status"], "max_relative_standard_error_difference": max_relative_error,
            "parameter_csv_matches_json": True}


def verify(filename):
    report = json.loads(filename.read_text())
    config, result = report["config"], report["result"]
    rows = result["rows"]
    selection = report["selection"]
    document = json.loads((SOURCE / (report["example"] + ".json")).read_text())
    origin = datetime.fromisoformat(document["time_origin_utc"].replace("Z", "+00:00")).timestamp() * 1000

    def observations(identifier):
        _, table, column = identifier.split(".")
        data = document["tables"][table]["data"]
        return {origin + time * 1000: value for time, value in zip(data["elapsed_s"], data[column])
                if value is not None and selection[2] <= origin + time * 1000 < selection[3]}

    histogram = report["view"] == "distribution"
    y = np.array([row["y"] for row in rows])
    if histogram:
        values = np.array(list(observations(selection[6][0]).values()))
        actual_counts = [np.count_nonzero((values >= row["lower"]) & ((values <= row["upper"]) if row.get("upperInclusive", False) else (values < row["upper"]))) for row in rows]
        np.testing.assert_array_equal(y, actual_counts)
    else:
        xs, ys = map(observations, selection[6])
        expected = [(time, x, ys[time]) for time, x in xs.items()
                    if time in ys and float(config["low"]) <= x <= float(config["high"])]
        np.testing.assert_array_equal([[row["time"], row["x"], row["y"]] for row in rows], expected)

    free = [p for p in config["parameters"] if not p["fixed"]]
    model = config["model"]

    def predict(p):
        if histogram:
            if model == "poisson":
                return p["n"] * np.array([poisson.pmf(np.arange(row["firstInteger"], row["lastInteger"] + 1), p["lambda"]).sum() for row in rows])
            low = np.array([row["lower"] for row in rows])
            high = np.array([row["upper"] for row in rows])
            expected = p["n"] * (ndtr((high - p["mu"]) / p["sigma"]) - ndtr((low - p["mu"]) / p["sigma"]))
            return expected + p.get("background", 0) * (high - low)
        x = np.array([row["x"] for row in rows])
        if model == "peak":
            return p["b"] + p["a"] * np.exp(-0.5 * ((x - p["mu"]) / p["sigma"]) ** 2)
        x = x - config["x0"]
        return p["b"] + p["m"] * x + p.get("q", 0) * x ** 2

    def unpack(free_values):
        parameters = {p["name"]: float(p["initial"]) for p in config["parameters"]}
        parameters.update(zip([p["name"] for p in free], free_values))
        return parameters

    def residual(parameters):
        expected = predict(parameters)
        if config["objective"] == "poisson":
            expected = np.maximum(expected, 1e-12)
            return np.sign(y - expected) * np.sqrt(np.maximum(0, 2 * (expected - y + xlogy(y, y / expected))))
        return y - expected

    if free:
        bounds = ([float(p["min"]) if p["min"] != "" else -np.inf for p in free],
                  [float(p["max"]) if p["max"] != "" else np.inf for p in free])
        reference = least_squares(lambda vector: residual(unpack(vector)), [float(p["initial"]) for p in free],
                                  bounds=bounds, x_scale=[p["scale"] for p in free],
                                  ftol=1e-12, xtol=1e-12, gtol=1e-12, max_nfev=5000)
        assert reference.success, (filename.name, reference.message)
        parameters = unpack(reference.x)
    else:
        parameters = unpack([])
    exported = np.array([row["fitted"] for row in rows])
    recomputed = predict(result["parameters"])
    np.testing.assert_allclose(exported, recomputed, rtol=1e-5, atol=2e-4)
    np.testing.assert_allclose([row["residual"] for row in rows], y - exported, rtol=1e-12, atol=1e-12)
    objective = float(np.sum(residual(parameters) ** 2))
    objective_difference = abs(result["objective"] - objective)
    assert objective_difference < 5e-5 * max(1, objective), (filename.name, result["objective"], objective)
    prediction_difference = float(np.max(np.abs(exported - predict(parameters))))
    assert prediction_difference < 0.02 if histogram else prediction_difference < 1e-5, (filename.name, prediction_difference)
    for parameter in config["parameters"]:
        value = result["parameters"][parameter["name"]]
        if parameter["fixed"]:
            assert value == float(parameter["initial"])
        if parameter["min"] != "":
            assert value >= float(parameter["min"]) - 1e-12
        if parameter["max"] != "":
            assert value <= float(parameter["max"]) + 1e-12
    csv_rows = list(csv.DictReader(filename.with_suffix(".csv").open()))
    for row in rows:
        exported_row = csv_rows[row["index"]]
        assert exported_row["included_in_fit"] == "true"
        assert float(exported_row["fitted"]) == row["fitted"]
        assert float(exported_row["residual"]) == row["residual"]
    return {"case": filename.stem, "rows": len(rows), "source_observations_match": True,
            "scipy_objective": objective, "objective_difference": objective_difference,
            "max_prediction_difference": prediction_difference, "csv_matches_json": True,
            "uncertainty": verify_uncertainty(report, predict, filename.with_name(filename.stem + "-parameters.csv"))}


def main():
    files = sorted(path for path in ROOT.glob("fit-*.json") if "result" in json.loads(path.read_text()))
    assert len(files) >= 15, "Run verify-fitting.cjs before the numerical comparison."
    results = [verify(path) for path in files]
    report = {"cases": results, "source_hashes": {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
              for name in ["fit-engine.js", "fit-ui.js", "mockup.js", "signal-data.js"]}}
    (ROOT / "fit-numerical-check.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
