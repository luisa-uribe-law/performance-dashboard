"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Area, AreaChart, ReferenceDot,
} from "recharts";

interface TrendChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  xKey: string;
  lines?: { key: string; color: string; name: string }[];
  bars?: { key: string; color: string; name: string; stackId?: string }[];
  areas?: { key: string; color: string; name: string }[];
  height?: number;
  yDomain?: [number, number];
  yFormatter?: (v: number) => string;
  partialLast?: boolean; // If true, last data point is an incomplete month
}

function resolveColor(color: string): string {
  const map: Record<string, string> = {
    "var(--accent)": "#4D5BF9",
    "var(--accent-light)": "#7B88FF",
    "var(--yuno-blue)": "#4D5BF9",
    "var(--success)": "#6CCF7F",
    "var(--yuno-green)": "#6CCF7F",
    "var(--danger)": "#E06060",
    "var(--warning)": "#E8A44A",
    "var(--oncall)": "#A78BFA",
    "var(--oncall-light)": "#C4B5FD",
  };
  return map[color] || color;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatX(val: any): string {
  const s = String(val ?? "");
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split("-");
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${names[parseInt(m) - 1]} '${y.slice(2)}`;
  }
  return s;
}

const tooltipStyle = {
  background: "#252838",
  border: "1px solid #454870",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  color: "#FFFFFF",
};

export default function TrendChart({
  data, xKey, lines, bars, areas, height = 220, yDomain, yFormatter, partialLast,
}: TrendChartProps) {
  const yTickFormat = yFormatter ? (v: unknown) => yFormatter(v as number) : undefined;

  if (bars) {
    // For bar charts, just dim the last bar if partial
    const barData = data.map((d, i) => ({
      ...d,
      _isPartial: partialLast && i === data.length - 1,
    }));

    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#353858" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fill: "#B0B4D0", fontSize: 11 }} tickFormatter={(v, i) => {
            const label = formatX(v);
            return barData[i]?._isPartial ? `${label}*` : label;
          }} axisLine={{ stroke: "#333658" }} />
          <YAxis tick={{ fill: "#B0B4D0", fontSize: 11 }} domain={yDomain} tickFormatter={yTickFormat} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => {
            const label = formatX(v);
            const isPartial = barData.find(d => d[xKey] === v)?._isPartial;
            return isPartial ? `${label} (in progress)` : label;
          }} cursor={{ fill: "rgba(62, 79, 224, 0.1)" }} />
          {bars.map(b => (
            <Bar key={b.key} dataKey={b.key} fill={resolveColor(b.color)} name={b.name} stackId={b.stackId} radius={b.stackId ? [0, 0, 0, 0] : [6, 6, 0, 0]} animationDuration={800}
              fillOpacity={1}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              shape={(props: any) => {
                const isPartial = barData[props.index]?._isPartial;
                const { x, y, width, height: h } = props;
                const r = b.stackId ? 0 : 6;
                return (
                  <rect x={x} y={y} width={width} height={h} rx={r} ry={r}
                    fill={resolveColor(b.color)}
                    fillOpacity={isPartial ? 0.35 : 1}
                    strokeDasharray={isPartial ? "4 2" : undefined}
                    stroke={isPartial ? resolveColor(b.color) : undefined}
                    strokeWidth={isPartial ? 1.5 : 0}
                  />
                );
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (areas) {
    const isPartial = partialLast && data.length > 1;
    // For partial months: null out metric values so the area/line stops at the last complete month
    // We keep the x-axis entry so the month label still appears
    const areaData = isPartial
      ? data.map((d, i) => {
          if (i !== data.length - 1) return d;
          // Null out all area keys so the trendline doesn't extend here
          const nulled = { ...d };
          for (const a of areas) nulled[a.key] = null;
          return nulled;
        })
      : data;
    // Save the real partial values for ReferenceDots
    const partialPoint = isPartial ? data[data.length - 1] : null;

    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={areaData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <defs>
            {areas.map(a => (
              <linearGradient key={`grad-${a.key}`} id={`grad-${a.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={resolveColor(a.color)} stopOpacity={0.4} />
                <stop offset="100%" stopColor={resolveColor(a.color)} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#353858" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fill: "#B0B4D0", fontSize: 11 }} tickFormatter={(v) => {
            const label = formatX(v);
            return isPartial && v === data[data.length - 1][xKey] ? `${label}*` : label;
          }} axisLine={{ stroke: "#333658" }} />
          <YAxis tick={{ fill: "#B0B4D0", fontSize: 11 }} domain={yDomain} tickFormatter={yTickFormat} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => {
            const label = formatX(v);
            return isPartial && v === data[data.length - 1][xKey] ? `${label} (in progress)` : label;
          }} />
          {areas.map(a => (
            <Area key={a.key} type="monotone" dataKey={a.key} stroke={resolveColor(a.color)} fill={`url(#grad-${a.key})`} name={a.name}
              strokeWidth={2.5}
              dot={{ r: 4, fill: resolveColor(a.color), strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: resolveColor(a.color), fill: "#1C1E2E" }}
              animationDuration={800}
              connectNulls={false}
            />
          ))}
          {/* Isolated dot for partial month */}
          {partialPoint && areas.map(a => (
            <ReferenceDot
              key={`partial-${a.key}`}
              x={partialPoint[xKey]}
              y={partialPoint[a.key]}
              r={5}
              fill="#1C1E2E"
              stroke={resolveColor(a.color)}
              strokeWidth={2}
              strokeDasharray="3 2"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Line chart
  {
    const isPartial = partialLast && data.length > 1;
    const lastIdx = data.length - 1;

    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#353858" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fill: "#B0B4D0", fontSize: 11 }} tickFormatter={(v) => {
            const label = formatX(v);
            return isPartial && v === data[lastIdx][xKey] ? `${label}*` : label;
          }} axisLine={{ stroke: "#333658" }} />
          <YAxis tick={{ fill: "#B0B4D0", fontSize: 11 }} domain={yDomain} tickFormatter={yTickFormat} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => {
            const label = formatX(v);
            return isPartial && v === data[lastIdx][xKey] ? `${label} (in progress)` : label;
          }} />
          {lines?.map(l => (
            <Line key={l.key} type="monotone" dataKey={l.key} stroke={resolveColor(l.color)} name={l.name}
              strokeWidth={2.5}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              dot={(dotProps: any) => {
                const { cx, cy, index } = dotProps;
                const isLast = isPartial && index === lastIdx;
                return (
                  <circle
                    key={`dot-${l.key}-${index}`}
                    cx={cx} cy={cy}
                    r={isLast ? 5 : 4}
                    fill={isLast ? "#1C1E2E" : resolveColor(l.color)}
                    stroke={isLast ? resolveColor(l.color) : "none"}
                    strokeWidth={isLast ? 2 : 0}
                    strokeDasharray={isLast ? "3 2" : undefined}
                  />
                );
              }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: resolveColor(l.color), fill: "#1C1E2E" }}
              animationDuration={800}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }
}
