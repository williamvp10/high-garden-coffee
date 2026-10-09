"""Predicción con los ARIMA ajustados fuera del request; artefactos locales verificados."""

import hashlib, json, pickle
import numpy as np
from fastapi import HTTPException
from app.core.config import settings
from app.core.db import rows, safe_records
import pandas as pd


class PredictionService:
    def __init__(self):
        path = settings.artifact_dir / "arima.pkl"
        metadata = json.loads((settings.artifact_dir / "manifest.json").read_text())
        payload = path.read_bytes()
        if hashlib.sha256(payload).hexdigest() != metadata["sha256"]:
            raise RuntimeError("Artefacto ARIMA no coincide con su checksum")
        # Solo artefactos del build; no se aceptan pickles proporcionados por usuarios.
        self.models = pickle.loads(payload)
        self.metadata = json.loads(
            (settings.data_dir / "forecast_metadata.json").read_text()
        )

    def predict(self, country: str, horizon: int = 10):
        if country not in self.models:
            raise HTTPException(404, "País no encontrado")
        if not 1 <= horizon <= 10:
            raise HTTPException(422, "Horizonte permitido: 1–10")
        entry = self.models[country]
        values = np.maximum(
            0, np.asarray(entry["model"].forecast(horizon)) * entry["factor"]
        )
        previous = entry["last"]
        result = []
        for step, value in enumerate(values, 1):
            growth = 100 * (value / entry["last"] - 1) if entry["last"] > 0 else None
            yoy = 100 * (value / previous - 1) if previous > 0 else None
            category = (
                ("growing" if value > 0 else "stable")
                if entry["last"] == 0
                else (
                    "growing"
                    if growth > 5
                    else "declining" if growth < -5 else "stable"
                )
            )
            result.append(
                {
                    "horizon": step,
                    "period": f"{2019+step}/{str(2020+step)[-2:]}",
                    "predicted_consumption": float(value),
                    "projected_growth_pct": growth,
                    "projected_yoy_growth_pct": yoy,
                    "market_classification": category,
                }
            )
            previous = float(value)
        return {
            "country": country,
            "model_name": "ARIMA",
            "config": entry["config"],
            "historical_last_consumption": entry["last"],
            "forecast_origin": "2019/20",
            "unit": "unidades reportadas (sin verificar)",
            "limitation": "Proyección desde 2019/20; diez años no validados; no es pronóstico actual.",
            "annual_forecasts": result,
        }

    def opportunities(self, horizon=5, minimum_consumption=1_000_000):
        """Priorizar investigación por crecimiento proyectado, no por rentabilidad."""
        results = []
        for country in self.models:
            prediction = self.predict(country, horizon)
            end = prediction["annual_forecasts"][-1]
            results.append(
                {
                    "country": country,
                    "last_consumption": prediction["historical_last_consumption"],
                    **end,
                    "absolute_growth": end["predicted_consumption"]
                    - prediction["historical_last_consumption"],
                }
            )
        relative = [
            r
            for r in results
            if r["last_consumption"] >= minimum_consumption
            and r["projected_growth_pct"] is not None
        ]
        return {
            "forecast_origin": "2019/20",
            "horizon": horizon,
            "minimum_consumption": minimum_consumption,
            "top_absolute_growth": sorted(
                results, key=lambda r: r["absolute_growth"], reverse=True
            )[:10],
            "top_relative_growth": sorted(
                relative, key=lambda r: r["projected_growth_pct"], reverse=True
            )[:10],
            "classification_counts": {
                kind: sum(r["market_classification"] == kind for r in results)
                for kind in ["growing", "stable", "declining"]
            },
            "classification_rule": "Variación desde origen: mayor que 5% crecimiento; menor que -5% disminución; resto estable. Base cero: crecimiento solo si proyección positiva.",
            "limitation": "Hipótesis para investigación comercial; sin evidencia de importaciones, precios o rentabilidad.",
        }


async def history(country: str):
    result = await rows(
        "SELECT year,period,consumption FROM consumption WHERE country=%s ORDER BY year",
        (country,),
    )
    if not result:
        raise HTTPException(404, "País no encontrado")
    return {"country": country, "origin_end": "2019/20", "observations": result}


async def experiment(country: str | None = None):
    frame = pd.read_csv(settings.data_dir / "model_comparison.csv")
    comparison = safe_records(frame)
    scores = safe_records(
        frame.groupby("model_name", as_index=False)
        .agg(selection_score=("development_MASE", "mean"))
        .sort_values("selection_score")
    )
    metrics = (
        await rows(
            "SELECT payload FROM model_metrics WHERE country=%s ORDER BY stage,model_name,horizon",
            (country,),
        )
        if country
        else []
    )
    return {
        "selected_model": "ARIMA",
        "selection": "MASE en validación; ETS obtuvo mejor MASE en prueba",
        "comparison": comparison,
        "selection_scores": scores,
        "country_metrics": [r["payload"] for r in metrics],
        "metadata": json.loads(
            (settings.data_dir / "forecast_metadata.json").read_text()
        ),
    }
