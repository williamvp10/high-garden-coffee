"""Resumen ejecutivo del mismo histórico y las proyecciones del experimento."""
from collections import defaultdict
from fastapi import HTTPException
from app.core.db import rows


async def overview():
    observations = await rows("SELECT country,year,period,consumption FROM consumption ORDER BY year,country")
    forecasts = await rows("SELECT country,horizon,period,predicted_consumption FROM projections ORDER BY horizon,country")
    if not observations or not forecasts:
        raise HTTPException(503, "El resumen requiere histórico y proyecciones cargados")
    annual = defaultdict(float)
    by_country = defaultdict(list)
    for r in observations:
        annual[r["period"]] += r["consumption"]
        by_country[r["country"]].append(r)
    projected = defaultdict(float)
    fifth = {}
    for r in forecasts:
        projected[r["period"]] += r["predicted_consumption"]
        if r["horizon"] == 5:
            fifth[r["country"]] = r["predicted_consumption"]
    markets = []
    for country, history in by_country.items():
        last, base = history[-1]["consumption"], history[-6]["consumption"]
        future = fifth[country]
        markets.append({
            "country": country, "consumption": last,
            "projected_consumption": future, "absolute_growth": future - last,
            "projected_growth_pct": 100 * (future / last - 1) if last else None,
            "historical_cagr_pct": 100 * ((last / base) ** (1 / 5) - 1) if base else None,
        })
    markets.sort(key=lambda r: r["consumption"], reverse=True)
    total = sum(r["consumption"] for r in markets)
    for r in markets:
        r["share_pct"] = 100 * r["consumption"] / total if total else None
    first, end = next(iter(annual.values())), list(annual.values())[-1]
    origin = observations[-1]["period"]
    return {
        "origin": origin, "start": observations[0]["period"],
        "countries": len(markets), "records": len(observations),
        "total_consumption": total,
        "historical_growth_pct": 100 * (end / first - 1) if first else None,
        "top_three_share_pct": sum(r["share_pct"] or 0 for r in markets[:3]),
        "annual_totals": [{"period": period, "observed": value} for period, value in annual.items()],
        "projected_totals": [{"period": period, "predicted": value} for period, value in projected.items()],
        "markets": markets,
        "research_priorities": sorted(markets, key=lambda r: r["absolute_growth"], reverse=True)[:3],
        "unit": "unidades reportadas (sin verificar)",
        "scope": "Consumo doméstico de los países suministrados; no representa el total mundial, importaciones ni ventas de High Garden.",
    }
