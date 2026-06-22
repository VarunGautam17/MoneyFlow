import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import FileUpload from "../components/FileUpload";
import { checkHealth } from "../api/client";

export default function HomePage() {
  const navigate = useNavigate();
  const [apiStatus, setApiStatus] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkHealth()
      .then((data) => setApiStatus(data.status === "ok" ? "ok" : "error"))
      .catch(() => setApiStatus("error"));
  }, []);

  return (
    <div className="min-h-screen text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white bg-[#09090b]">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" strokeOpacity="0.4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 17a5 5 0 100-10 5 5 0 000 10z" strokeOpacity="0.7" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6M9 11h5M12 8c2.5 0 3 1.25 3 2.5S13.5 13 12 13M9 13l5 5" />
              </svg>
            </div>
            <div className="flex items-center">
              <span className="font-bold text-lg tracking-tight pb-0.5 bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent font-display">
                RupeeRadar
              </span>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold border ${
              apiStatus === "ok"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : apiStatus === "loading"
                  ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}
          >
            API {apiStatus === "loading" ? "connecting…" : apiStatus === "ok" ? "connected" : "offline"}
          </span>
        </div>
      </header>

      <main className="flex-grow mx-auto max-w-3xl px-6 py-16 flex flex-col justify-center">
        <div className="mb-8 text-center space-y-4">
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight pb-2 bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent font-display">
            Understand where your money goes
          </h2>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto leading-relaxed">
            Upload HDFC, ICICI, or generic CSV/Excel bank statements for categorized spending insights.
          </p>
        </div>

        {apiStatus === "error" && (
          <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400 font-medium">
            Cannot reach the API. Start the backend with{" "}
            <code className="rounded bg-rose-500/25 px-1 font-mono">uvicorn app.main:app --reload</code>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400 font-medium">{error}</div>
        )}

        <FileUpload
          onUploaded={(sessionId) => navigate(`/analysis/${sessionId}`)}
          onError={setError}
        />

        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 px-5 py-4 text-xs leading-relaxed text-zinc-400">
          <strong className="text-zinc-300 font-semibold">Privacy:</strong> Your uploaded file is processed in memory
          and deleted immediately after parsing. Analysis data is stored temporarily (default 72 hours)
          and can be deleted anytime. We do not share your statement with third parties — only
          anonymized transaction descriptions are sent to the LLM for categorization when enabled.
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Sample fixtures: <code className="text-indigo-400 font-mono">backend/tests/fixtures/hdfc_messy.csv</code>,{" "}
          <code className="text-indigo-400 font-mono">icici_sample.csv</code> · Template: <code className="text-indigo-400 font-mono">docs/sample-statement-template.csv</code>
        </p>
      </main>

      <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-center text-xs text-zinc-600 mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} RupeeRadar. Scan and categorize personal finances locally & securely.</p>
        </div>
      </footer>
    </div>
  );
}
