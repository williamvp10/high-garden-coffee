"use client";
import { useEffect, useState } from "react";
import { api, useGarden, num } from "./context";
import { MarketsChart } from "./charts";
type Observation = { period: string; consumption: number };
export function HistoricalMarkets() {
  const { catalog } = useGarden();
  const [markets, setMarkets] = useState(["Brazil", "Viet Nam", "Indonesia"]);
  const [candidate, setCandidate] = useState("Colombia"),
    [histories, setHistories] = useState<Observation[][]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all(
      markets.map((country) =>
        api("history?country=" + encodeURIComponent(country)),
      ),
    )
      .then((results) => {
        if (active) setHistories(results.map((r) => r.observations));
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [markets]);
  // Solo presentación: las observaciones siempre vienen de la API.
  const data =
    histories[0]?.map((row, i) =>
      Object.fromEntries([
        ["period", row.period],
        ...histories.map((h, j) => ["market" + j, h[i].consumption / 1e6]),
      ]),
    ) || [];
  return (
    <section className="card">
      <div className="card-heading">
        <div>
          <h2>Históricos por países</h2>
          <p className="muted small">
            1990/91–2019/20 · consumo anual en millones de unidades reportadas
          </p>
        </div>
        <span className="badge">30 periodos observados</span>
      </div>
      <div className="market-controls">
        <label htmlFor="compare-country">Añadir mercado</label>
        <select
          id="compare-country"
          value={candidate}
          onChange={(e) => setCandidate(e.target.value)}
        >
          {catalog?.countries.map((c) => (
            <option key={c.name} disabled={markets.includes(c.name)}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          className="button secondary"
          disabled={markets.length >= 4 || markets.includes(candidate)}
          onClick={() => setMarkets((m) => [...m, candidate])}
        >
          Comparar
        </button>
      </div>
      <div className="market-chips">
        {markets.map((m) => (
          <button
            key={m}
            disabled={markets.length === 1}
            onClick={() => setMarkets((list) => list.filter((c) => c !== m))}
            aria-label={"Quitar " + m}
          >
            {m} <span aria-hidden>×</span>
          </button>
        ))}
        <span className="small muted">
          Hasta cuatro países. Pulsa un país para retirarlo.
        </span>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : loading ? (
        <div className="loading">Cargando históricos…</div>
      ) : (
        <>
          <MarketsChart data={data} markets={markets} />
          <details className="data-details">
            <summary>Ver últimos valores históricos</summary>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>País</th>
                    <th>Periodo</th>
                    <th>Consumo (millones)</th>
                  </tr>
                </thead>
                <tbody>
                  {markets.map((m, i) => (
                    <tr key={m}>
                      <td>{m}</td>
                      <td>{histories[i]?.at(-1)?.period}</td>
                      <td>
                        {num((histories[i]?.at(-1)?.consumption || 0) / 1e6, 3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      <p className="footnote">
        Comparación de volúmenes absolutos. Un mercado grande puede crecer
        proporcionalmente menos que uno pequeño.
      </p>
    </section>
  );
}
