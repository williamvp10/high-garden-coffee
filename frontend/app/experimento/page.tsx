"use client";
import { useEffect, useState } from "react";
import { api, num } from "@/components/context";
import { ModelChart } from "@/components/charts";
type Row = {
  model_name: string;
  horizon: number;
  development_MASE: number;
  MASE: number;
  WAPE: number;
  MAE: number;
  RMSE: number;
  selected: boolean;
};
export default function Experiment() {
  const [rows, setRows] = useState<Row[]>([]),
    [h, setH] = useState(5),
    [error, setError] = useState("");
  useEffect(() => {
    api("experiment")
      .then((r) => setRows(r.comparison))
      .catch((e) => setError(e.message));
  }, []);
  const names: Record<string, string> = {
    "Linear Regression": "Regresión lineal",
    ETS: "ETS",
    ARIMA: "ARIMA",
  };
  const selected = rows.filter((r) => r.horizon === h);
  return (
    <>
      <div className="eyebrow">EVIDENCIA ANTES DE COMPLEJIDAD</div>
      <h1>El experimento.</h1>
      <p className="muted">
        Tres métodos, el mismo histórico y una evaluación temporal separada.
      </p>
      <div className="notice">
        ARIMA ganó en validación. ETS obtuvo mejor MASE en la prueba final. El
        ganador no se cambia usando la prueba.
      </div>
      <div className="stats">
        <div className="stat">
          <span>Entrenamiento / desarrollo</span>
          <strong className="stat-text">1990–2014</strong>
          <footer>Cortes: 2004/05 y 2009/10</footer>
        </div>
        <div className="stat">
          <span>Prueba independiente</span>
          <strong className="stat-text">2015–2019</strong>
          <footer>Ventana de cinco años</footer>
        </div>
        <div className="stat">
          <span>Criterio de selección</span>
          <strong className="stat-text">MASE macro</strong>
          <footer>Igual peso por país y horizonte</footer>
        </div>
      </div>
      {error ? (
        <div className="error">{error}</div>
      ) : !rows.length ? (
        <div className="loading">Cargando métricas…</div>
      ) : (
        <>
          <section className="card">
            <div className="card-heading">
              <h2>Comparación por horizonte</h2>
              <div className="segments">
                {[1, 5].map((v) => (
                  <button
                    key={v}
                    className={h === v ? "selected" : ""}
                    onClick={() => setH(v)}
                  >
                    {v} {v === 1 ? "año" : "años"}
                  </button>
                ))}
              </div>
            </div>
            <ModelChart
              data={selected.map((r) => ({
                model: names[r.model_name],
                validation: r.development_MASE,
                test: r.MASE,
              }))}
            />
          </section>
          <section className="card">
            <h2>Métricas de prueba</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>MASE validación ↓</th>
                    <th>MASE prueba ↓</th>
                    <th>WAPE prueba ↓</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.map((r) => (
                    <tr key={r.model_name}>
                      <td>{names[r.model_name]}</td>
                      <td>{num(r.development_MASE, 3)}</td>
                      <td>{num(r.MASE, 3)}</td>
                      <td>{num(r.WAPE, 2)}%</td>
                      <td>
                        <span
                          className={
                            r.selected ? "badge selected-badge" : "badge"
                          }
                        >
                          {r.selected ? "Seleccionado" : "Referencia"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="footnote">
              MASE excluye escalas históricas cero: 49 países comunes en
              validación y 52 en prueba. WAPE pondera volumen; no representa la
              precisión de cada país.
            </p>
          </section>
        </>
      )}
    </>
  );
}
