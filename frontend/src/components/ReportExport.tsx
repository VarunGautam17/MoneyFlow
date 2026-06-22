import { useState } from "react";
import { getReportUrl } from "../api/client";

interface ReportExportProps {
  sessionId: string;
}

export default function ReportExport({ sessionId }: ReportExportProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadPdf() {
    setDownloading(true);
    setError(null);
    try {
      const response = await fetch(getReportUrl(sessionId, "pdf"));
      if (!response.ok) {
        throw new Error("Failed to generate PDF report");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `moneyflow-report-${sessionId.slice(0, 8)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  function openPrintView() {
    window.open(getReportUrl(sessionId, "html"), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={downloadPdf}
        disabled={downloading}
        className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] text-white transition duration-200 cursor-pointer disabled:opacity-60"
      >
        {downloading ? "Generating PDF…" : "Download PDF"}
      </button>
      <button
        type="button"
        onClick={openPrintView}
        className="px-4 py-2 rounded-xl text-sm font-semibold bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 transition duration-200 cursor-pointer"
      >
        Print / Share
      </button>
      {error && <p className="text-sm text-rose-400 font-medium">{error}</p>}
    </div>
  );
}
