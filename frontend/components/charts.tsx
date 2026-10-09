"use client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
export function ConsumptionChart({
  data,
  label = "Consumo observado y proyección anual",
}: {
  data: Record<string, unknown>[];
  label?: string;
}) {
  const hasForecast = data.some((d) => d.predicted != null);
  return (
    <div className="chart" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => Number(v).toLocaleString("es-CO")}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
            }}
          />
          <Legend />
          {hasForecast && (
            <ReferenceLine
              x="2019/20"
              stroke="var(--muted)"
              strokeDasharray="3 3"
              label={{
                value: "Origen",
                fontSize: 10,
                position: "insideTopRight",
              }}
            />
          )}
          <Line
            name="Observado (millones)"
            type="linear"
            dataKey="observed"
            stroke="var(--primary)"
            strokeWidth={3}
            dot={false}
          />
          {hasForecast && (
            <Line
              name="Proyección (millones)"
              type="linear"
              dataKey="predicted"
              stroke="var(--accent)"
              strokeWidth={3}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ModelChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <div
      className="chart compact-chart"
      role="img"
      aria-label="Error de validación y prueba por modelo"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="model" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar
            name="MASE validación"
            dataKey="validation"
            fill="var(--primary)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            name="MASE prueba"
            dataKey="test"
            fill="var(--accent)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MarketsChart({
  data,
  markets,
}: {
  data: Record<string, unknown>[];
  markets: string[];
}) {
  const colors = [
    "var(--primary)",
    "var(--accent)",
    "var(--chart-blue)",
    "var(--chart-purple)",
  ];
  return (
    <div
      className="chart"
      role="img"
      aria-label={"Consumo histórico comparado: " + markets.join(", ")}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="period"
            interval="preserveStartEnd"
            minTickGap={26}
            tick={{ fontSize: 11 }}
          />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          {markets.map((country, i) => (
            <Line
              key={country}
              name={country}
              dataKey={"market" + i}
              type="linear"
              stroke={colors[i]}
              strokeWidth={2.5}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
