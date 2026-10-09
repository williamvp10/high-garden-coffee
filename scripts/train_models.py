"""Reentrenar offline con el histórico empaquetado y configuraciones de validación."""

from pathlib import Path
import hashlib, json, pickle, warnings
import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA

ROOT = Path(__file__).resolve().parents[1]
data = ROOT / "backend/data"
art = ROOT / "backend/artifacts"
history = pd.read_parquet(data / "country_history.parquet")
configs = pd.read_csv(data / "selected_configurations.csv")
models = {}
for row in configs[configs.model_name.eq("ARIMA")].itertuples():
    y = (
        history[history.country.eq(row.country)]
        .sort_values("year")
        .consumption.to_numpy(dtype=float)
    )
    factor = max(1.0, np.abs(y).mean())
    order = tuple(map(int, row.config.split(",")))
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        spec = ARIMA(y / factor, order=order, trend="n" if order[1] else "c")
        fit = spec.fit(method_kwargs={"maxiter": 200})
        if not fit.mle_retvals.get("converged", True):
            fit = spec.fit(method_kwargs={"method": "powell", "maxiter": 200})
        if not fit.mle_retvals.get("converged", True):
            raise RuntimeError("No convergió: " + row.country)
    models[row.country] = {
        "model": fit,
        "factor": factor,
        "config": row.config,
        "last": float(y[-1]),
    }
# Verificación previa a publicar el artefacto del mismo experimento.
reference = pd.read_parquet(data / "country_forecasts.parquet")
for country, entry in models.items():
    values = np.maximum(0, np.asarray(entry["model"].forecast(10)) * entry["factor"])
    expected = (
        reference[reference.country.eq(country)]
        .sort_values("horizon")
        .predicted_consumption
    )
    np.testing.assert_allclose(values, expected, rtol=1e-7, atol=1e-3)
payload = pickle.dumps(models, protocol=pickle.HIGHEST_PROTOCOL)
art.mkdir(exist_ok=True)
(art / "arima.pkl").write_bytes(payload)
(art / "manifest.json").write_text(
    json.dumps(
        {
            "sha256": hashlib.sha256(payload).hexdigest(),
            "countries": len(models),
            "origin": "2019/20",
            "dataset_sha256": json.loads((data / "manifest.json").read_text())[
                "sha256_dataset"
            ],
        },
        indent=2,
    )
)
print("55 modelos ajustados; 550 proyecciones verificadas.")
