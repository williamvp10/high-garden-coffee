"""Copiar la evidencia y ajustar los ARIMA seleccionados; no modificar el notebook original."""

from pathlib import Path
import hashlib, json, pickle, shutil, warnings, re
import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "Prueba Tecnica MLEng"
DATA, ART = ROOT / "backend/data", ROOT / "backend/artifacts"
DATA.mkdir(exist_ok=True)
ART.mkdir(exist_ok=True)
for name in [
    "country_history.parquet",
    "country_forecasts.parquet",
    "model_comparison.csv",
    "model_evaluation.csv",
    "selected_configurations.csv",
    "forecast_metadata.json",
    "manifest.json",
]:
    shutil.copy2(SOURCE / "resultados" / name, DATA / name)
assets = DATA / "assets"
assets.mkdir(exist_ok=True)
for path in (SOURCE / "resultados/figuras").glob("*.png"):
    shutil.copy2(path, assets / path.name)
shutil.copy2(SOURCE / "01_analisis_consumo_cafe.ipynb", assets / "analysis.ipynb")
# Exportar HTML sin ejecutar otra vez el entrenamiento.
import nbformat
from nbconvert import HTMLExporter

html, _ = HTMLExporter().from_notebook_node(
    nbformat.read(assets / "analysis.ipynb", as_version=4)
)
html = re.sub(r"<script\b[^>]*>.*?</script>", "", html, flags=re.S | re.I)
(assets / "analysis.html").write_text(html, encoding="utf-8")
raw = pd.read_parquet(SOURCE / "coffee_db.parquet").set_index("Country")
periods = sorted(c for c in raw if "/" in c)
configs = pd.read_csv(DATA / "selected_configurations.csv")
models = {}
for r in configs[configs.model_name.eq("ARIMA")].itertuples():
    y = raw.loc[r.country, periods].to_numpy(dtype=float)
    factor = max(1.0, np.abs(y).mean())
    order = tuple(map(int, r.config.split(",")))
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        spec = ARIMA(y / factor, order=order, trend="n" if order[1] else "c")
        result = spec.fit(method_kwargs={"maxiter": 200})
        if not result.mle_retvals.get("converged", True):
            result = spec.fit(method_kwargs={"method": "powell", "maxiter": 200})
        assert result.mle_retvals.get("converged", True), r.country
    models[r.country] = {
        "model": result,
        "factor": factor,
        "config": r.config,
        "last": float(y[-1]),
    }
payload = pickle.dumps(models, protocol=pickle.HIGHEST_PROTOCOL)
(ART / "arima.pkl").write_bytes(payload)
(ART / "manifest.json").write_text(
    json.dumps(
        {
            "sha256": hashlib.sha256(payload).hexdigest(),
            "countries": len(models),
            "origin": "2019/20",
            "dataset_sha256": json.loads((DATA / "manifest.json").read_text())[
                "sha256_dataset"
            ],
        },
        indent=2,
    )
)
reference = pd.read_parquet(DATA / "country_forecasts.parquet")
for country, entry in models.items():
    actual = np.maximum(0, np.asarray(entry["model"].forecast(10)) * entry["factor"])
    expected = (
        reference[reference.country.eq(country)]
        .sort_values("horizon")
        .predicted_consumption.to_numpy()
    )
    np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-3)
print("55 ARIMA preparados y verificados contra las 550 proyecciones del notebook.")
