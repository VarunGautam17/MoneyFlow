export interface Insight {
  text: string;
  source: "template" | "ai";
}

interface InsightCardsProps {
  insights: Insight[];
}

export default function InsightCards({ insights }: InsightCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {insights.map((insight, index) => (
        <div
          key={index}
          className="bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700/80 rounded-2xl p-5 text-sm leading-relaxed text-zinc-300 transition duration-300 flex gap-3.5"
        >
          <span className="text-indigo-400 text-xl select-none pt-0.5">✦</span>
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Insight {index + 1}
              {insight.source === "ai" && (
                <span className="rounded bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold text-indigo-400">
                  AI
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">{insight.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
