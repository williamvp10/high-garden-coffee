"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Globe2, TrendingUp, Leaf, Info } from "lucide-react";
import { api, useGarden, num } from "@/components/context";
import { HistoricalMarkets } from "@/components/history-markets";
import { ConsumptionChart } from "@/components/charts";
type Forecast = {
  horizon: number;
  period: string;
  predicted_consumption: number;
  projected_growth_pct: number | null;
  projected_yoy_growth_pct: number | null;
  market_classification: string;
};
type Prediction = {
  country: string;
  historical_last_consumption: number;
  config: string;
  annual_forecasts: Forecast[];
  forecast_origin: string;
  limitation: string;
};
export default function Dashboard() {
  const { catalog } = useGarden();
  const [country, setCountry] = useState("Viet Nam"),
    [horizon, setHorizon] = useState(10),
    [prediction, setPrediction] = useState<Prediction | null>(null),
    [history, setHistory] = useState<{ period: string; consumption: number }[]>(
      [],
    ),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(
      "country",
    );
    if (requested && catalog?.countries.some((c) => c.name === requested))
      setCountry(requested);
  }, [catalog]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      api("predictions?country=" + encodeURIComponent(country) + "&horizon=10"),
      api("history?country=" + encodeURIComponent(country)),
    ])
      .then(([p, h]) => {
        if (active) {
          setPrediction(p);
          setHistory(h.observations);
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [country]);
  const points =
    prediction?.annual_forecasts.filter((f) => f.horizon <= horizon) || [];
  const final = points.at(-1);
  const chart = [
    ...history
      .slice(-8)
      .map((h) => ({ period: h.period, observed: h.consumption / 1e6 })),
    ...points.map((p) => ({
      period: p.period,
      predicted: p.predicted_consumption / 1e6,
    })),
  ];
  if (history.length && points.length) {
    const last = chart[history.slice(-8).length - 1] as Record<string, unknown>;
    last.predicted = history.at(-1)!.consumption / 1e6;
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">DEL DATO A LA DECISIÓN</div>
          <h1>
            El futuro del consumo,
            <br />
            <span className="muted-heading">con evidencia.</span>
          </h1>
          <p className="muted">
            Explora la trayectoria anual de 55 mercados cafeteros.
          </p>
        </div>
        <span className="pill">
          <Leaf size={16} /> ARIMA · modelo seleccionado
        </span>
      </div>
      <div className="notice">
        <Info size={18} />
        <span>
          Proyecciones desde <strong>2019/20</strong>. No son pronósticos
          actuales; el horizonte de 10 años es exploratorio.
        </span>
      </div>
      <div className="filters">
        <label>
          Mercado
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {catalog?.countries.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
        <div>
          <span className="filter-label">Ventana de proyección</span>
          <div className="segments">
            {[1, 5, 10].map((h) => (
              <button
                key={h}
                className={horizon === h ? "selected" : ""}
                onClick={() => setHorizon(h)}
              >
                {h} {h === 1 ? "año" : "años"}
              </button>
            ))}
          </div>
        </div>
        <div className="data-stamp">
          <Globe2 size={17} />
          <span>
            Origen histórico<small>2019/20 → 2029/30</small>
          </span>
        </div>
      </div>
      {error ? (
        <div className="error">{error}</div>
      ) : loading ? (
        <div className="loading">Consultando los modelos ajustados…</div>
      ) : (
        prediction && (
          <>
            <div className="stats">
              <div className="stat">
                <span>Último consumo observado</span>
                <strong>
                  {num(prediction.historical_last_consumption / 1e6)}{" "}
                  <small>M</small>
                </strong>
                <footer>Periodo 2019/20</footer>
              </div>
              <div className="stat">
                <span>Consumo proyectado · año {horizon}</span>
                <strong>
                  {num((final?.predicted_consumption || 0) / 1e6)}{" "}
                  <small>M</small>
                </strong>
                <footer>{final?.period} · unidades reportadas</footer>
              </div>
              <div className="stat">
                <span>Cambio frente al origen</span>
                <strong
                  className={
                    (final?.projected_growth_pct || 0) < 0 ? "negative" : ""
                  }
                >
                  {num(final?.projected_growth_pct)}
                  <small>%</small>
                </strong>
                <footer>
                  <TrendingUp size={14} /> Variación al año {horizon}
                </footer>
              </div>
            </div>
            <section className="card">
              <div className="card-heading">
                <div>
                  <h2>Consumo observado y proyectado</h2>
                  <p className="muted small">
                    {country} · millones de unidades reportadas
                  </p>
                </div>
                <span className="badge">ARIMA ({prediction.config})</span>
              </div>
              <ConsumptionChart data={chart} />
              <p className="footnote">
                Línea continua: últimos ocho periodos observados. Línea
                discontinua: consumo anual proyectado a {horizon}{" "}
                {horizon === 1 ? "año" : "años"}. La proyección no es acumulada.
              </p>
            </section>
            <section className="card">
              <div className="card-heading">
                <div>
                  <h2>Histórico completo · {country}</h2>
                  <p className="muted small">
                    30 registros anuales observados; se conservan los consumos
                    cero.
                  </p>
                </div>
                <span className="badge">1990/91–2019/20</span>
              </div>
              <ConsumptionChart
                label={"Consumo histórico de " + country}
                data={history.map((h) => ({
                  period: h.period,
                  observed: h.consumption / 1e6,
                }))}
              />
            </section>
            <HistoricalMarkets />
            <section className="card">
              <div className="card-heading">
                <div>
                  <h2>La proyección, año a año</h2>
                  <p className="muted small">
                    Cada fila es consumo anual, no acumulado.
                  </p>
                </div>
                <ArrowUpRight size={20} />
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Año</th>
                      <th>Periodo</th>
                      <th>Consumo (millones)</th>
                      <th>Cambio desde 2019/20</th>
                      <th>Cambio interanual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((p) => (
                      <tr key={p.horizon}>
                        <td>{String(p.horizon).padStart(2, "0")}</td>
                        <td>{p.period}</td>
                        <td className="number">
                          {num(p.predicted_consumption / 1e6, 3)}
                        </td>
                        <td className="number">
                          {num(p.projected_growth_pct, 2)}%
                        </td>
                        <td className="number">
                          {num(p.projected_yoy_growth_pct, 2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <p className="footnote">
              El consumo doméstico no equivale a importaciones, ventas o
              rentabilidad. Unidad de origen pendiente de verificar.
            </p>
          </>
        )
      )}
    </>
  );
}
