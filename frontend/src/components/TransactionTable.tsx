import { useState } from "react";
import {
  CATEGORIES,
  type Category,
  type Transaction,
  updateTransactionCategory,
} from "../api/client";
import { CATEGORY_COLORS, formatINR } from "../utils/format";

interface TransactionTableProps {
  sessionId: string;
  transactions: Transaction[];
  onCategoryUpdated?: (txn: Transaction) => void;
}

export default function TransactionTable({
  sessionId,
  transactions,
  onCategoryUpdated,
}: TransactionTableProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCategoryChange(txnId: string, category: Category) {
    setUpdating(txnId);
    setError(null);
    try {
      const result = await updateTransactionCategory(sessionId, txnId, category);
      onCategoryUpdated?.(result.transaction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-400 font-medium">
          {error}
        </div>
      )}
      <div className="overflow-x-auto border border-zinc-800/60 rounded-2xl bg-zinc-950/40 shadow-xl">
        <table className="min-w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-800/80 text-[10px] uppercase font-bold tracking-wider text-zinc-500 bg-zinc-950/80 select-none">
              <th className="py-3.5 px-5">Date</th>
              <th className="py-3.5 px-5">Description</th>
              <th className="py-3.5 px-5 text-right">Amount</th>
              <th className="py-3.5 px-5">Category</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 text-sm">
            {transactions.map((txn) => (
              <tr key={txn.id} className="hover:bg-zinc-900/30 transition group">
                <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-zinc-400">
                  {txn.date}
                </td>
                <td className="px-5 py-3 max-w-md">
                  <div className="font-semibold text-zinc-200 truncate group-hover:text-white transition flex items-center gap-2">
                    <span>{txn.description_clean || txn.description_raw}</span>
                    {txn.is_recurring && (
                      <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        🔁 Recurring
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate mt-0.5" title={txn.description_raw}>
                    {txn.description_raw}
                  </div>
                </td>
                <td
                  className={`whitespace-nowrap px-5 py-3 font-bold text-right ${
                    txn.amount < 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {txn.amount < 0 ? "-" : "+"} {formatINR(Math.abs(txn.amount))}
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <select
                      value={txn.category}
                      disabled={updating === txn.id}
                      onChange={(e) => handleCategoryChange(txn.id, e.target.value as Category)}
                      className={`border rounded px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition ${
                        CATEGORY_COLORS[txn.category] ?? CATEGORY_COLORS.Other
                      }`}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat} className="bg-zinc-950 text-zinc-200">
                          {cat}
                        </option>
                      ))}
                    </select>
                    {txn.category_overridden && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        Edited
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
