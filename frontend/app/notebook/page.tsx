"use client";
import { useEffect, useState } from "react";
import { Download, ArrowUpRight } from "lucide-react";
import { api, useGarden, num } from "@/components/context";
import { ModelChart } from "@/components/charts";
type Metric = {
  model_name: string;
  horizon: number;
  development_MASE: number;
  MASE: number;
  WAPE: number;
};
type Evidence = {
  file: string;
  title: string;
  purpose: string;
  result: string;
};
const dataset: Evidence[] = [
  {
    file: "00_paises_por_etiqueta.png",
    title: "Países por etiqueta de café",
    purpose:
      "Describir la composición de la muestra por Arabica, Robusta y Mixto.",
    result:
      "La categoría corresponde al país. No es un desglose de cuántas unidades se consumieron de cada variedad.",
  },
  {
    file: "03_top_mercados.png",
    title: "Tamaño de los mercados · 2019/20",
    purpose:
      "Identificar los países de mayor consumo en el último periodo observado.",
    result:
      "Brasil lidera en volumen; Indonesia y Etiopía lo siguen. El ranking mide tamaño absoluto, no crecimiento porcentual.",
  },
  {
    file: "04_tendencias_agregadas.png",
    title: "Tendencia del conjunto de países",
    purpose:
      "Observar cómo evoluciona el consumo anual agregado y según la etiqueta del país.",
    result:
      "El consumo agregado aumentó 156,2% entre el primer y el último periodo. Es el conjunto suministrado, no todo el consumo mundial.",
  },
  {
    file: "05_tendencias_normalizadas.png",
    title: "Crecimiento relativo · base 100",
    purpose:
      "Comparar trayectorias aunque los países partan de volúmenes diferentes.",
    result:
      "Vietnam muestra el mayor crecimiento relativo entre los seis mercados graficados. Eso no significa que consuma más que Brasil.",
  },
];
const models: Evidence[] = [
  {
    file: "10_error_regresion.png",
    title: "Regresión lineal · error de validación por año",
    purpose:
      "Medir cómo aumenta el error escalado promedio al proyectar del primer al quinto año usando una tendencia lineal.",
    result:
      "Su error de validación aumenta con el horizonte y supera a ETS y ARIMA. Sirve como referencia para justificar modelos temporales.",
  },
  {
    file: "11_error_ets.png",
    title: "ETS · error de validación por año",
    purpose:
      "Observar el error escalado por año del suavizado exponencial con tendencia seleccionada en validación.",
    result:
      "El error de validación aumenta del primer al quinto año. ETS mejoró el MASE en la prueba final, pero no ganó el criterio de validación.",
  },
  {
    file: "12_error_arima.png",
    title: "ARIMA · error de validación por año",
    purpose:
      "Observar cuánto error de validación se acumula al alejarse del origen de proyección.",
    result:
      "El error escalado aumenta de aproximadamente 0,6 en el primer año a 3 en el quinto. ARIMA ganó en validación, pero la incertidumbre crece con el horizonte.",
  },
  {
    file: "08_history_vs_forecast.png",
    title: "Vietnam · tres métodos, tres trayectorias",
    purpose:
      "Contrastar el histórico con las proyecciones de regresión, ETS y ARIMA.",
    result:
      "ARIMA converge hacia una trayectoria más estable que los otros métodos en este ejemplo. Una curva visualmente atractiva no basta para seleccionar un modelo.",
  },
  {
    file: "13_proyeccion_ventanas_anuales.png",
    title: "Ventanas de 1, 5 y 10 años",
    purpose:
      "Mostrar el consumo anual proyectado en diferentes ventanas desde el mismo origen 2019/20.",
    result:
      "Diez años permite explorar escenarios; no se demostró precisión a ese horizonte ni se calcularon intervalos calibrados.",
  },
];
const comparison: Evidence[] = [
  {
    file: "07_model_comparison.png",
    title: "Comparación del experimento",
    purpose:
      "Comparar la precisión temporal de los tres modelos con las métricas exportadas.",
    result:
      "La selección se hace con validación temporal. La prueba final mide generalización y no se usa para cambiar el ganador.",
  },
  {
    file: "09_growth_opportunities.png",
    title: "Crecimiento proyectado · mercados para investigar",
    purpose:
      "Priorizar investigación comercial según variaciones proyectadas de consumo.",
    result:
      "Etiopía, Vietnam y Costa Rica encabezan el crecimiento absoluto proyectado a cinco y diez años. No demuestra rentabilidad, importaciones ni oportunidades comerciales garantizadas.",
  },
];
const names: Record<string, string> = {
  "Linear Regression": "Regresión lineal",
  ETS: "ETS",
  ARIMA: "ARIMA",
};
export default function Notebook() {
  const { catalog } = useGarden();
  const [assets, setAssets] = useState<{ name: string; type: string }[]>([]),
    [metrics, setMetrics] = useState<Metric[]>([]),
    [scores, setScores] = useState<
      { model_name: string; selection_score: number }[]
    >([]),
    [error, setError] = useState(""),
    [show, setShow] = useState(false),
    [tab, setTab] = useState("dataset");
  useEffect(() => {
    Promise.all([api("assets"), api("experiment")])
      .then(([a, e]) => {
        setAssets(a);
        setMetrics(e.comparison);
        setScores(e.selection_scores);
      })
      .catch((e) => setError(e.message));
  }, []);
  const evidence =
    tab === "dataset" ? dataset : tab === "models" ? models : comparison;
  return (
    <>
      <div className="eyebrow">EL ANÁLISIS, EXPLICADO</div>
      <h1>
        Del histórico
        <br />
        <span className="muted-heading">a la selección del modelo.</span>
      </h1>
      <p className="muted">
        Recorre la evidencia del notebook: qué muestran las gráficas, para qué
        sirven y qué podemos concluir.
      </p>
      <div className="actions">
        <button className="button" onClick={() => setShow(!show)}>
          {show ? "Ocultar notebook completo" : "Ver notebook completo"}
        </button>
        <a
          className="button secondary"
          href="/api/bff/assets/analysis.ipynb"
          download
        >
          <Download size={16} /> Descargar .ipynb
        </a>
        {catalog?.repository_url && (
          <a
            className="button secondary"
            href={catalog.repository_url}
            target="_blank"
            rel="noreferrer"
          >
            Repositorio <ArrowUpRight size={16} />
          </a>
        )}
      </div>
      {show && (
        <iframe
          className="notebook-frame"
          src="/api/bff/assets/analysis.html"
          sandbox=""
          title="Notebook ejecutado de analítica de café"
        />
      )}
      <nav className="analysis-tabs" aria-label="Secciones del análisis">
        {[
          ["dataset", "1. Análisis del dataset"],
          ["models", "2. Modelos y proyecciones"],
          ["comparison", "3. Comparación y selección"],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      {error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : !assets.length ? (
        <div className="loading">Cargando análisis…</div>
      ) : (
        <>
          {tab === "dataset" && (
            <div className="analysis-intro">
              <h2>Qué contienen los datos</h2>
              <p className="muted">
                55 países × 30 periodos anuales (1990/91–2019/20): 1.650
                observaciones. Los ceros se conservan como valores reportados.
                La unidad de consumo original está pendiente de verificar; por
                eso las figuras usan unidades reportadas.
              </p>
            </div>
          )}
          {tab === "models" && (
            <>
              <div className="analysis-intro">
                <h2>Cómo construimos las proyecciones</h2>
                <p className="muted">
                  Entrenamos cada método por país. Elegimos sus configuraciones
                  mediante cortes temporales y evaluamos años posteriores; no
                  damos observaciones futuras al modelo durante la validación.
                </p>
              </div>
              <div className="model-explanations">
                {[
                  [
                    "Regresión lineal",
                    "Extrapola una tendencia respecto al tiempo. Sirve como referencia sencilla.",
                  ],
                  [
                    "ETS",
                    "Da más peso a observaciones recientes y modela nivel y tendencia; puede amortiguarla.",
                  ],
                  [
                    "ARIMA",
                    "Modela dependencia de valores y errores pasados, diferenciando la serie cuando corresponde.",
                  ],
                ].map(([title, body]) => (
                  <article className="card" key={title}>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
              <div className="notice">
                Las proyecciones empiezan después de 2019/20. La prueba
                disponible valida uno y cinco años; diez años es exploratorio.
              </div>
            </>
          )}
          {tab === "comparison" && (
            <>
              <div className="analysis-intro">
                <h2>Por qué seleccionamos ARIMA</h2>
                <p className="muted">
                  El criterio fue el promedio del MASE de validación en los
                  horizontes de uno y cinco años, con igual peso por país
                  elegible. Se comparan 49 países comunes entre modelos. Los
                  resultados de prueba se mantienen separados.
                </p>
              </div>
              <section className="card">
                <h3>Puntaje de selección · menor es mejor</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Modelo</th>
                        <th>MASE promedio de validación</th>
                        <th>Decisión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scores.map((s) => (
                        <tr key={s.model_name}>
                          <td>{names[s.model_name]}</td>
                          <td>{num(s.selection_score, 3)}</td>
                          <td>
                            {s.model_name === "ARIMA"
                              ? "Seleccionado"
                              : "Referencia"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="footnote">
                  Cortes de validación: 2004/05 y 2009/10. Prueba independiente:
                  2015/16–2019/20.
                </p>
              </section>
              <section className="card">
                <h3>Validación frente a prueba · horizonte de cinco años</h3>
                <ModelChart
                  data={metrics
                    .filter((m) => m.horizon === 5)
                    .map((m) => ({
                      model: names[m.model_name],
                      validation: m.development_MASE,
                      test: m.MASE,
                    }))}
                />
                <div className="notice">
                  ETS consiguió menor MASE en prueba (2,087 frente a 2,177 de
                  ARIMA). Esto señala una limitación del modelo seleccionado;
                  cambiarlo con esa prueba contaminaría la evaluación.
                </div>
                <p className="footnote">
                  MASE compara error con una referencia ingenua usando la escala
                  de entrenamiento. Puede no estar definido en series
                  constantes: la prueba usa 52 países comunes. WAPE pondera
                  volumen y no equivale a precisión individual.
                </p>
              </section>
            </>
          )}
          <div className="gallery">
            {evidence
              .filter((e) => assets.some((a) => a.name === e.file))
              .map((e) => (
                <figure className="card evidence-card" key={e.file}>
                  <h3>{e.title}</h3>
                  <a
                    href={"/api/bff/assets/" + e.file}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={"/api/bff/assets/" + e.file}
                      alt={e.title}
                      loading="lazy"
                    />
                  </a>
                  <figcaption>
                    <p>
                      <strong>Para qué sirve:</strong> {e.purpose}
                    </p>
                    <p>
                      <strong>Resultado e interpretación:</strong> {e.result}
                    </p>
                  </figcaption>
                </figure>
              ))}
          </div>
        </>
      )}
    </>
  );
}
