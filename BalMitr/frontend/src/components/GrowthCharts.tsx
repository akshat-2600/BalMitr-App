import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Measurement } from "../types";
import { ChartSpec } from "../types_growth";

interface PointRow {
  x: number;
  sd3neg?: number;
  sd2neg?: number;
  median?: number;
  sd2?: number;
  sd3?: number;
  childVal?: number;
}

function mergeSeries(curves: NonNullable<ChartSpec["curves"]>, childPoints: { x: number; val: number }[]): PointRow[] {
  const byX = new Map<number, PointRow>();
  for (const c of curves) {
    byX.set(c.x, { ...c });
  }
  for (const p of childPoints) {
    const existing = byX.get(p.x);
    if (existing) {
      existing.childVal = p.val;
    } else {
      byX.set(p.x, { x: p.x, childVal: p.val });
    }
  }
  return Array.from(byX.values()).sort((a, b) => a.x - b.x);
}

function IndicatorChart({
  spec,
  childPoints,
}: {
  spec: ChartSpec;
  childPoints: { x: number; val: number }[];
}) {
  if (!spec.applicable || !spec.curves || spec.curves.length === 0) {
    return (
      <div className="card">
        <h3 style={{ fontSize: 17, marginBottom: 6 }}>{spec.label}</h3>
        <div className="muted" style={{ fontSize: 13 }}>
          {spec.reason || "Not applicable for this age"}
        </div>
      </div>
    );
  }

  const data = mergeSeries(spec.curves, childPoints);

  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <h3 style={{ fontSize: 17 }}>{spec.label}</h3>
        <span className="muted" style={{ fontSize: 12 }}>
          {spec.x_label} · WHO -3, -2, median, +2, +3 SD
        </span>
      </div>
      <div style={{ width: "100%", height: 250 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#e8e0d4" strokeDasharray="3 3" />
            <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 11 }} />
            <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={38} />
            <Tooltip />
            <Line type="monotone" dataKey="sd3neg" name="-3 SD" stroke="#c0392b" strokeDasharray="4 4" dot={false} connectNulls strokeWidth={1.3} />
            <Line type="monotone" dataKey="sd2neg" name="-2 SD" stroke="#c97a16" strokeDasharray="4 4" dot={false} connectNulls strokeWidth={1.3} />
            <Line type="monotone" dataKey="median" name="Median (0 SD)" stroke="#7a9e8c" dot={false} connectNulls strokeWidth={1.6} />
            <Line type="monotone" dataKey="sd2" name="+2 SD" stroke="#c97a16" strokeDasharray="4 4" dot={false} connectNulls strokeWidth={1.3} />
            <Line type="monotone" dataKey="sd3" name="+3 SD" stroke="#c0392b" strokeDasharray="4 4" dot={false} connectNulls strokeWidth={1.3} />
            <Line
              type="monotone"
              dataKey="childVal"
              name="Child"
              stroke="#1b6b45"
              strokeWidth={2.5}
              dot={{ r: 5, fill: "#1b6b45", stroke: "#fff", strokeWidth: 1.5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function GrowthCharts({
  charts,
  measurements,
}: {
  charts: {
    age_group: string;
    wfa: ChartSpec;
    hfa: ChartSpec;
    wfh: ChartSpec;
    bmi: ChartSpec;
  };
  measurements: Measurement[];
}) {
  const wfaPts = measurements.map((m) => ({ x: m.age_months, val: Number(m.weight_kg) }));
  const hfaPts = measurements.map((m) => ({
    x: m.age_months,
    val: Number(m.adjusted_height_cm ?? m.height_cm),
  }));
  const wfhPts = measurements.map((m) => ({
    x: Number(m.adjusted_height_cm ?? m.height_cm),
    val: Number(m.weight_kg),
  }));
  const bmiPts = measurements.map((m) => {
    const hm = Number(m.adjusted_height_cm ?? m.height_cm) / 100;
    return { x: m.age_months, val: Number((Number(m.weight_kg) / (hm * hm)).toFixed(2)) };
  });

  return (
    <div className="stack">
      <div className="row-between">
        <h2 style={{ fontSize: 21 }}>WHO growth charts</h2>
        <span className="chip chip-neutral">{charts.age_group}</span>
      </div>
      <div className="grid-2">
        {charts.wfa.applicable && <IndicatorChart spec={charts.wfa} childPoints={wfaPts} />}
        <IndicatorChart spec={charts.hfa} childPoints={hfaPts} />
        {charts.wfh.applicable ? (
          <IndicatorChart spec={charts.wfh} childPoints={wfhPts} />
        ) : (
          <IndicatorChart spec={charts.bmi} childPoints={bmiPts} />
        )}
        {!charts.wfh.applicable && <IndicatorChart spec={charts.wfh} childPoints={[]} />}
        {!charts.wfa.applicable && <IndicatorChart spec={charts.wfa} childPoints={[]} />}
      </div>
    </div>
  );
}
