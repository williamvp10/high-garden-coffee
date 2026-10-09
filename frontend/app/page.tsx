"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Globe2, Info, Send, Github } from "lucide-react";
import { api, num, useGarden } from "@/components/context";
import { ConsumptionChart } from "@/components/charts";
import {
  ConcentrationChart,
  OpportunityChart,
  Market,
} from "@/components/executive-charts";
type Overview = {
  origin: string;
  start: string;
  countries: number;
  records: number;
  total_consumption: number;
  historical_growth_pct: number;
  top_three_share_pct: number;
  annual_totals: { period: string; observed: number }[];
  projected_totals: { period: string; predicted: number }[];
  markets: Market[];
  research_priorities: Market[];
  scope: string;
};
type Experiment = {
  selection_scores: { model_name: string; selection_score: number }[];
  comparison: {
    model_name: string;
    horizon: number;
    MASE: number;
    WAPE: number;
  }[];
};
export default function Home() {
  const { catalog } = useGarden();
  const [data, setData] = useState<Overview | null>(null),
    [experiment, setExperiment] = useState<Experiment | null>(null),
    [error, setError] = useState(""),
    [horizon, setHorizon] = useState(5);
  useEffect(() => {
    let active = true;
    Promise.all([api("overview"), api("experiment")])
      .then(([d, e]) => {
        if (active) {
          setData(d);
          setExperiment(e);
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, []);
  if (error)
    return (
      <div className="error">
        {error} <button onClick={() => location.reload()}>Reintentar</button>
      </div>
    );
  if (!data || !experiment)
    return <div className="loading">Preparando el resumen ejecutivo…</div>;
  const chart: Record<string, unknown>[] = data.annual_totals.map((r) => ({
    period: r.period,
    observed: r.observed / 1e6,
  }));
  chart[chart.length - 1].predicted = data.total_consumption / 1e6;
  chart.push(
    ...data.projected_totals
      .slice(0, horizon)
      .map((r) => ({ period: r.period, predicted: r.predicted / 1e6 })),
  );
  const arima = experiment.comparison.find(
    (r) => r.model_name === "ARIMA" && r.horizon === 5,
  );
  const actions: Record<string, string> = {
    Ethiopia:
      "Priorizar un estudio de acceso al mercado: compradores, importaciones, competencia local y viabilidad logística.",
    "Viet Nam":
      "Investigar segmentos y canales específicos; validar demanda importada frente a la oferta local. Su crecimiento histórico no implica el mismo ritmo futuro.",
    "Costa Rica":
      "Explorar un piloto acotado si se confirman compradores y margen; su menor escala requiere dimensionar la inversión.",
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">RESUMEN PARA LA DIRECCIÓN</div>
          <h1>
            Decidir dónde profundizar,
            <br />
            <span className="muted-heading">con evidencia.</span>
          </h1>
          <p className="muted analysis-intro">
            High Garden Coffee busca orientar su expansión internacional.
            Analizamos el consumo doméstico anual de {data.countries} países,
            identificamos tendencias y comparamos tres modelos para proyectar la
            demanda y priorizar investigación comercial.
          </p>
        </div>
        <span className="pill">
          <Globe2 size={16} /> {data.countries} países · {data.records}{" "}
          registros
        </span>
      </div>
      <section className="card garden-invitation">
        <div>
          <div className="eyebrow">CONOCE A GARDEN</div>
          <h2>Tu próxima pregunta sobre café, en Telegram.</h2>
          <p>
            Consulta proyecciones, interpreta los datos y explora temas de café
            con nuestro asistente. Prueba con:{" "}
            <strong>“Proyecta el consumo de Vietnam a cinco años”.</strong>
          </p>
        </div>
        <div className="invitation-actions">
          {catalog?.telegram_url && (
            <a
              className="button"
              href={catalog.telegram_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Send size={18} /> Probar en Telegram <ArrowUpRight size={16} />
            </a>
          )}
          {catalog?.repository_url && (
            <a
              className="button secondary"
              href={catalog.repository_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={17} /> Ver proyecto en GitHub
            </a>
          )}
        </div>
      </section>
      <div className="notice">
        <Info size={18} />
        <span>
          Base histórica {data.start}–{data.origin}. Las proyecciones parten de{" "}
          {data.origin}; deben actualizarse antes de decidir una inversión. No
          contamos con precios ni intervalos de incertidumbre calibrados.
        </span>
      </div>
      <div className="stats">
        <div className="stat">
          <span>Consumo del conjunto · {data.origin}</span>
          <strong>
            {num(data.total_consumption / 1e6)} <small>M</small>
          </strong>
          <footer>Millones de unidades reportadas</footer>
        </div>
        <div className="stat">
          <span>Crecimiento histórico del conjunto</span>
          <strong>
            +{num(data.historical_growth_pct)}
            <small>%</small>
          </strong>
          <footer>
            {data.start} → {data.origin}
          </footer>
        </div>
        <div className="stat">
          <span>Concentración en los tres mayores mercados</span>
          <strong>
            {num(data.top_three_share_pct)}
            <small>%</small>
          </strong>
          <footer>
            {data.markets
              .slice(0, 3)
              .map((m) => m.country)
              .join(" · ")}
          </footer>
        </div>
      </div>
      <section className="card executive-decision">
        <div className="eyebrow">QUÉ DEBERÍA HACER LA EMPRESA</div>
        <h2>Priorizar investigación antes de comprometer capital</h2>
        <p>
          Profundizar primero en{" "}
          <strong>
            {data.research_priorities.map((m) => m.country).join(", ")}
          </strong>
          , los mayores incrementos absolutos proyectados a cinco años. En
          paralelo, estudiar los mercados de mayor tamaño para identificar
          canales de entrada. Asignar presupuesto de investigación, validar
          compradores y ejecutar pilotos solo si se confirma margen comercial.
        </p>
        <div className="actions">
          <Link className="button" href="/predicciones">
            Explorar predicciones <ArrowUpRight size={16} />
          </Link>
          <Link className="button secondary" href="/chat">
            Consultar a Garden
          </Link>
        </div>
      </section>
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>Trayectoria conjunta: consumo observado y proyectado</h2>
            <p className="muted small">
              Suma anual de los {data.countries} países · millones de unidades
              reportadas
            </p>
          </div>
          <div className="segments" aria-label="Horizonte del conjunto">
            {[1, 5, 10].map((h) => (
              <button
                key={h}
                aria-pressed={horizon === h}
                className={horizon === h ? "selected" : ""}
                onClick={() => setHorizon(h)}
              >
                {h} {h === 1 ? "año" : "años"}
              </button>
            ))}
          </div>
        </div>
        <ConsumptionChart
          data={chart}
          label="Consumo total histórico y suma de las proyecciones por país"
        />
        <p className="footnote">
          El crecimiento histórico muestra una expansión del consumo del
          conjunto. La línea proyectada suma los ARIMA individuales; no es un
          modelo global independiente. Diez años es un escenario exploratorio
          sin validación a ese horizonte.
        </p>
      </section>
      <div className="executive-grid">
        <section className="card">
          <h2>¿Dónde se concentra el consumo?</h2>
          <p className="muted small">
            Participación en {data.origin} · todos los países incluidos
          </p>
          <ConcentrationChart markets={data.markets} />
          <p className="footnote">
            Los tres mayores concentran {num(data.top_three_share_pct)}%. Son
            una referencia de escala; comprobar apertura comercial y competencia
            antes de priorizar ventas. “Otros países” agrupa los{" "}
            {data.countries - 6} restantes.
          </p>
        </section>
        <section className="card">
          <h2>Tamaño y cambio esperado por mercado</h2>
          <p className="muted small">
            Cambio absoluto proyectado a cinco años · millones de unidades
          </p>
          <OpportunityChart markets={data.markets} />
          <p className="footnote">
            Cada punto representa un país. A la derecha: mayor tamaño; arriba de
            cero: aumento proyectado. Eje horizontal log10(1 + consumo), con
            etiquetas en millones, para incluir ceros. Consulta un punto o la
            tabla inferior para identificarlo.
          </p>
        </section>
      </div>
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>Mercados donde profundizar</h2>
            <p className="muted small">
              Prioridad por incremento absoluto de consumo · {data.origin} →
              2024/25
            </p>
          </div>
          <span className="badge">Hipótesis comercial</span>
        </div>
        <div className="research-list">
          {data.research_priorities.map((m, i) => (
            <article key={m.country}>
              <div className="eyebrow">PRIORIDAD {i + 1}</div>
              <h3>{m.country}</h3>
              <strong>
                +{num(m.absolute_growth / 1e6, 2)} M · +
                {num(m.projected_growth_pct, 2)}%
              </strong>
              <p>
                {actions[m.country] ||
                  "Validar compradores, importaciones y margen antes de invertir."}
              </p>
              <Link
                className="external-link"
                href={"/predicciones?country=" + encodeURIComponent(m.country)}
              >
                Ver proyección del país <ArrowUpRight size={16} />
              </Link>
            </article>
          ))}
        </div>
        <p className="footnote">
          Ranking por volumen adicional, no por rentabilidad. Viet Nam aumenta
          4,22% en cinco años: su incremento absoluto lo prioriza, aunque el
          umbral del análisis lo clasifica como estable (±5%).
        </p>
      </section>
      <section className="card">
        <h2>Qué respondió el experimento</h2>
        <div className="executive-grid">
          <div>
            <h3>Consumo futuro y tendencias</h3>
            <p>
              Disponemos de proyecciones anuales por país a 1, 5 y 10 años.
              ARIMA obtuvo el menor MASE de validación al dar igual peso a cada
              país elegible y a los horizontes de uno y cinco años.
            </p>
            <p className="muted small">
              Puntajes de selección:{" "}
              {experiment.selection_scores
                .map(
                  (s) =>
                    `${s.model_name === "Linear Regression" ? "Regresión lineal" : s.model_name} ${num(s.selection_score, 3)}`,
                )
                .join(" · ")}
              .
            </p>
          </div>
          <div>
            <h3>Precisión y límites de uso</h3>
            <p>
              En prueba a cinco años, ARIMA obtuvo MASE {num(arima?.MASE, 3)} y
              WAPE {num(arima?.WAPE, 2)}%. WAPE resume el error ponderado por
              volumen; no garantiza esa precisión en cada país. ETS logró menor
              MASE en prueba, por lo que conviene monitorear ambos al actualizar
              los datos.
            </p>
            <p>
              <strong>Precios futuros:</strong> el dataset no contiene precios.
              Para responder ese reto se requiere una serie adicional de precios
              y variables de mercado.
            </p>
          </div>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/experimento">
            Comparar los modelos
          </Link>
          <Link className="button secondary" href="/notebook">
            Ver análisis y metodología
          </Link>
        </div>
      </section>
      <section className="card">
        <h2>Próximas decisiones de la dirección</h2>
        <ol className="decision-steps">
          <li>
            <strong>Actualizar la evidencia.</strong> Obtener consumo reciente,
            verificar las unidades y reevaluar ARIMA frente a ETS con nuevos
            cortes temporales.
          </li>
          <li>
            <strong>Validar acceso y margen.</strong> Cruzar la lista corta con
            importaciones, precios, aranceles, costos logísticos, competencia y
            requisitos de entrada.
          </li>
          <li>
            <strong>Probar y medir.</strong> Diseñar pilotos con compradores
            identificados; medir margen neto, recompra y costo de distribución
            antes de escalar.
          </li>
        </ol>
        <p className="footnote">
          {data.scope} Las etiquetas Arabica/Robusta/Mixto corresponden al país
          y no desglosan el consumo por variedad. Los ceros se mantienen como
          observaciones reportadas.
        </p>
      </section>
      <details className="card data-details">
        <summary>
          Consultar los {data.countries} países y sus indicadores
        </summary>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">
              Indicadores históricos y proyección a cinco años por país
            </caption>
            <thead>
              <tr>
                <th>País</th>
                <th>Consumo 2019/20 (M)</th>
                <th>Participación</th>
                <th>CAGR histórico 5 años</th>
                <th>Proyección 2024/25 (M)</th>
                <th>Cambio absoluto (M)</th>
                <th>Cambio proyectado</th>
              </tr>
            </thead>
            <tbody>
              {data.markets.map((m) => (
                <tr key={m.country}>
                  <td>
                    <Link
                      href={
                        "/predicciones?country=" + encodeURIComponent(m.country)
                      }
                    >
                      {m.country}
                    </Link>
                  </td>
                  <td>{num(m.consumption / 1e6, 3)}</td>
                  <td>{num(m.share_pct, 2)}%</td>
                  <td>
                    {num(m.historical_cagr_pct, 2)}
                    {m.historical_cagr_pct == null ? "" : "%"}
                  </td>
                  <td>{num(m.projected_consumption / 1e6, 3)}</td>
                  <td>{num(m.absolute_growth / 1e6, 3)}</td>
                  <td>
                    {num(m.projected_growth_pct, 2)}
                    {m.projected_growth_pct == null ? "" : "%"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="footnote">
          CAGR: tasa anual compuesta entre 2014/15 y 2019/20. “—” indica
          porcentaje no definido por base cero. Cambio proyectado: variación
          total en cinco años, no tasa anual.
        </p>
      </details>
    </>
  );
}
