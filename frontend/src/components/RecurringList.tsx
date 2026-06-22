import type { RecurringGroup } from "../api/client";
import { CATEGORY_COLORS, formatINR } from "../utils/format";

interface RecurringListProps {
  groups: RecurringGroup[];
  totalMonthly: number;
}

export default function RecurringList({ groups, totalMonthly }: RecurringListProps) {
  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8 text-center text-zinc-500 italic text-sm">
        No recurring payments detected in this statement.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-400 font-medium">
        {groups.length} recurring payment{groups.length !== 1 ? "s" : ""} totalling{" "}
        <span className="font-bold text-indigo-300">{formatINR(totalMonthly)}/month</span>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div
            key={group.id}
            className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between hover:border-indigo-500/25 transition duration-300 group"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-zinc-200 group-hover:text-white transition truncate">{group.label}</h3>
                  <p className="mt-0.5 text-xs text-zinc-500 capitalize">
                    {group.frequency} billing cycle
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-md px-2.5 py-0.5 text-[10px] font-bold border transition ${
                    CATEGORY_COLORS[group.category] ?? CATEGORY_COLORS.Other
                  }`}
                >
                  {group.category}
                </span>
              </div>
              
              <div className="flex items-baseline gap-1.5 border-t border-b border-zinc-800/60 py-2">
                <span className="text-zinc-500 text-xs font-medium">Est. Cost:</span>
                <span className="text-lg font-black text-indigo-400">{formatINR(group.typical_amount)}</span>
                <span className="text-zinc-600 text-[10px]">/mo</span>
              </div>

              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span>{group.transaction_ids.length} occurrences</span>
                <span className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {Math.round(group.confidence * 100)}% Confidence
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
