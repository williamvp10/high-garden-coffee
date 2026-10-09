"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ScatterChart,
  Scatter,
  ReferenceLine,
} from "recharts";
import { num } from "./context";
export type Market = {
  country: string;
  consumption: number;
  projected_consumption: number;
  absolute_growth: number;
  projected_growth_pct: number | null;
  historical_cagr_pct: number | null;
  share_pct: number;
};

export function ConcentrationChart({ markets }: { markets: Market[] }) {
  // La categoría Otros conserva el volumen de todos los países restantes.
  const data = [
    ...markets
      .slice(0, 6)
      .map((m) => ({ country: m.country, share: m.share_pct })),
    {
      country: "Otros países",
      share: markets.slice(6).reduce((s, m) => s + m.share_pct, 0),
    },
  ];
  return (
    <div
      className="chart"
      role="img"
      aria-label="Participación de los seis mayores mercados y los países restantes en el consumo total"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 5, right: 20 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tickFormatter={(v) => `${num(v, 0)}%`}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="country"
            width={90}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(v) => [`${num(Number(v), 2)}%`, "Participación"]}
          />
          <Bar dataKey="share" fill="var(--primary)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OpportunityChart({ markets }: { markets: Market[] }) {
  // log10(1 + consumo) permite mostrar también mercados con consumo cero.
  const data = markets.map((m) => ({
    ...m,
    size: Math.log10(1 + m.consumption),
    change: m.absolute_growth / 1e6,
  }));
  return (
    <div
      className="chart"
      role="img"
      aria-label="Los 55 mercados: tamaño observado frente al cambio absoluto proyectado a cinco años"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ left: 0, right: 20, bottom: 20, top: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="size"
            domain={[0, 10]}
            ticks={[0, 6, 7, 8, 9]}
            tickFormatter={(v) => num((10 ** v - 1) / 1e6, 0)}
            tick={{ fontSize: 11 }}
            label={{
              value: "Consumo observado (millones · escala log)",
              position: "insideBottom",
              offset: -15,
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="change"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => num(v)}
          />
          <ReferenceLine y={0} stroke="var(--muted)" />
          <Tooltip
            content={({ active, payload }) => {
              const m = payload?.[0]?.payload as Market | undefined;
              return active && m ? (
                <div className="market-tooltip">
                  <strong>{m.country}</strong>
                  <div>Observado: {num(m.consumption / 1e6, 2)} M</div>
                  <div>
                    Proyectado: {num(m.projected_consumption / 1e6, 2)} M
                  </div>
                  <div>
                    Cambio: {num(m.absolute_growth / 1e6, 2)} M ·{" "}
                    {num(m.projected_growth_pct, 2)}
                    {m.projected_growth_pct == null ? "" : "%"}
                  </div>
                </div>
              ) : null;
            }}
          />
          <Scatter
            name="Países"
            data={data}
            fill="var(--primary)"
            fillOpacity={0.7}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
