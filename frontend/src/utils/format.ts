export function formatINR(amount: number): string {
  const abs = Math.abs(amount);
  const [whole, frac = "00"] = abs.toFixed(2).split(".");
  let formatted: string;
  if (whole.length <= 3) {
    formatted = whole;
  } else {
    const last3 = whole.slice(-3);
    let rest = whole.slice(0, -3);
    const groups: string[] = [];
    while (rest.length > 0) {
      groups.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    formatted = `${groups.join(",")},${last3}`;
  }
  const sign = amount < 0 ? "-" : "";
  return `${sign}₹${formatted}.${frac}`;
}

export const CATEGORY_COLORS: Record<string, string> = {
  Food: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  Travel: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  Shopping: "bg-pink-500/10 text-pink-400 border border-pink-500/20",
  Bills: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  EMI: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  Subscriptions: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  Salary: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  Rent: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
  Investments: "bg-teal-500/10 text-teal-400 border border-teal-500/20",
  Other: "bg-zinc-800/60 text-zinc-400 border border-zinc-700/50",
};
