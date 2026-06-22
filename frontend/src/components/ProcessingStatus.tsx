interface ProcessingStatusProps {
  message?: string;
}

export default function ProcessingStatus({ message = "Analyzing your statement…" }: ProcessingStatusProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-16 shadow-2xl relative overflow-hidden">
      <div className="relative mb-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500/10 border-t-indigo-500" />
        <div className="absolute inset-0 bg-indigo-500/20 blur-md rounded-full -z-10" />
      </div>
      <p className="mt-4 text-lg font-bold text-zinc-100">{message}</p>
      <p className="mt-2 text-sm text-zinc-400">Cleaning, categorizing, and generating insights</p>
    </div>
  );
}
