import type { Analytics } from "../api/client";
import { formatINR } from "../utils/format";

interface SummaryCardsProps {
  analytics: Analytics;
}

export default function SummaryCards({ analytics }: SummaryCardsProps) {
  const cards = [
    {
      label: "Total Income",
      value: formatINR(analytics.total_income),
      color: "text-emerald-400",
      borderColor: "hover:border-emerald-500/30",
    },
    {
      label: "Total Spend",
      value: formatINR(analytics.total_spend),
      color: "text-rose-400",
      borderColor: "hover:border-rose-500/30",
    },
    {
      label: "Savings",
      value: formatINR(analytics.savings),
      color: analytics.savings >= 0 ? "text-indigo-400" : "text-rose-400",
      borderColor: "hover:border-indigo-500/30",
    },
    {
      label: "Savings Rate",
      value: analytics.savings_rate !== null ? `${analytics.savings_rate.toFixed(1)}%` : "N/A",
      color: analytics.savings_rate !== null 
        ? analytics.savings_rate >= 20 
          ? "text-emerald-400" 
          : analytics.savings_rate >= 0 
            ? "text-amber-400" 
            : "text-rose-400"
        : "text-zinc-400",
      borderColor: "hover:border-zinc-700",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div 
          key={card.label} 
          className={`rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-xl transition duration-300 relative overflow-hidden group ${card.borderColor}`}
        >
          <p className="text-sm font-medium tracking-wide text-zinc-400">{card.label}</p>
          <p className={`mt-2 text-2xl font-black tracking-tight ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
