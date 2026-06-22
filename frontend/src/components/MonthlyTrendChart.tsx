import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Analytics } from "../api/client";
import { formatINR } from "../utils/format";

interface MonthlyTrendChartProps {
  analytics: Analytics;
  highlightMonth?: string | null;
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

export default function MonthlyTrendChart({ analytics, highlightMonth }: MonthlyTrendChartProps) {
  const data = analytics.monthly_spend.map((m) => ({
    month: formatMonth(m.month),
    rawMonth: m.month,
    spend: m.amount,
    highlight: m.month === highlightMonth,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
        No monthly data to chart
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => formatINR(Number(value ?? 0))} />
          <Bar
            dataKey="spend"
            name="Spend"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      {highlightMonth && (
        <p className="mt-2 text-center text-xs text-slate-500">
          Highlighted: latest statement month ({formatMonth(highlightMonth)})
        </p>
      )}
    </div>
  );
}
