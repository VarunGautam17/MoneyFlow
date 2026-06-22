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
      <div className="flex h-64 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/40 text-zinc-500 italic">
        No monthly data to chart
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 shadow-xl">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="month" stroke="#71717a" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#a1a1aa" }} />
          <YAxis stroke="#71717a" tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: "#a1a1aa" }} />
          <Tooltip 
            cursor={{ fill: '#27272a', opacity: 0.3 }}
            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
            itemStyle={{ color: "#f4f4f5" }}
            labelStyle={{ color: "#f4f4f5", fontWeight: "bold" }}
            formatter={(value) => formatINR(Number(value ?? 0))}
          />
          <Bar
            dataKey="spend"
            name="Spend"
            fill="#6366f1"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      {highlightMonth && (
        <p className="mt-2 text-center text-xs text-zinc-500 font-medium">
          Highlighted: latest statement month ({formatMonth(highlightMonth)})
        </p>
      )}
    </div>
  );
}
