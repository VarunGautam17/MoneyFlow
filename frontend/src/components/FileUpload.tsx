import { useCallback, useState } from "react";
import { 
  previewCsv, 
  uploadStatementWithMapping, 
  ColumnMapping, 
  CsvPreview 
} from "../api/client";

interface FileUploadProps {
  onUploaded: (sessionId: string) => void;
  onError: (message: string) => void;
}

const ACCEPTED_EXTENSIONS = [".csv", ".xlsx"];

export default function FileUpload({ onUploaded, onError }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  
  // Custom mapping modal states
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<CsvPreview | null>(null);
  const [userMapping, setUserMapping] = useState<ColumnMapping>({
    date: null,
    description: null,
    debit: null,
    credit: null,
    amount: null,
    balance: null
  });
  const [headerRow, setHeaderRow] = useState(0);

  const stepsList = [
    "Uploading bank statement file...",
    "Parsing columns & normalizing dates...",
    "Running smart categorization engine...",
    "Compiling financial health analytics..."
  ];

  const handleUploadExecution = async (file: File, mapping: ColumnMapping, hRow: number, bankCode?: string) => {
    setUploading(true);
    setUploadStep(0);
    try {
      // Step 0: Upload started
      await new Promise(r => setTimeout(r, 600));
      setUploadStep(1);
      
      // Step 1: Parsing columns
      const result = await uploadStatementWithMapping(file, mapping, hRow, bankCode);
      
      await new Promise(r => setTimeout(r, 800));
      setUploadStep(2);
      
      // Step 2: Categorization
      await new Promise(r => setTimeout(r, 800));
      setUploadStep(3);
      
      // Step 3: Compiling analytics
      await new Promise(r => setTimeout(r, 600));
      onUploaded(result.session_id);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Processing failed");
      setUploading(false);
    }
  };

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const lower = file.name.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
        onError("Please upload a CSV or Excel (.xlsx) bank statement.");
        return;
      }
      
      setUploading(true);
      setUploadStep(0); // Loading preview
      
      try {
        if (lower.endsWith(".xlsx")) {
          // Excel sheets cannot be previewed in UI, upload directly (uses backend excel loader)
          await handleUploadExecution(file, {
            date: null, description: null, debit: null, credit: null, amount: null, balance: null
          }, 0);
          return;
        }

        // CSV preview step
        const preview = await previewCsv(file);
        
        if (preview.auto_process && preview.confidence_score >= 0.6) {
          // High confidence, process automatically
          await handleUploadExecution(file, preview.suggested_mapping, preview.header_row);
        } else {
          // Low confidence, open column mapping wizard
          setCurrentFile(file);
          setPreviewData(preview);
          setUserMapping(preview.suggested_mapping);
          setHeaderRow(preview.header_row);
          setShowMappingModal(true);
          setUploading(false);
        }
      } catch (err) {
        onError(err instanceof Error ? err.message : "Failed to parse preview");
        setUploading(false);
      }
    },
    [onUploaded, onError]
  );

  const handleMappingSubmit = async () => {
    if (!currentFile) return;
    setShowMappingModal(false);
    await handleUploadExecution(currentFile, userMapping, headerRow);
  };

  return (
    <div className="space-y-6">
      {/* DRAG & DROP UPLOAD BOX */}
      {!uploading && !showMappingModal && (
        <div
          className={`rounded-3xl border-2 border-dashed p-12 text-center transition-all duration-300 relative group overflow-hidden ${
            dragOver 
              ? "border-indigo-500 bg-indigo-500/5 shadow-[0_0_20px_rgba(99,102,241,0.15)]" 
              : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files[0] ?? null);
          }}
        >
          <div className="space-y-6 flex flex-col items-center relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:scale-110 transition duration-300 group-hover:border-indigo-500/50 group-hover:shadow-[0_0_25px_rgba(99,102,241,0.2)]">
              <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>

            <div className="space-y-2">
              <p className="text-zinc-200 font-semibold text-lg">Drop your bank statement here</p>
              <p className="text-zinc-500 text-sm">
                HDFC · ICICI · Generic CSV · Excel (.xlsx) · max 10 MB
              </p>
            </div>

            <label className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] text-white transition duration-200 cursor-pointer inline-block">
              Browse Files
              <input
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                disabled={uploading}
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="absolute inset-0 bg-radial-gradient from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>
      )}

      {/* STEPPER LOADER DISPLAY */}
      {uploading && (
        <div className="max-w-md mx-auto w-full bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden animate-fadeIn">
          <div className="space-y-8">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin" />
                <div className="absolute inset-0 bg-indigo-500/20 blur-md rounded-full -z-10" />
              </div>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-zinc-100">Processing Statement</h3>
              <p className="text-zinc-400 text-sm">Please keep this tab open while we run the pipeline</p>
            </div>

            <div className="space-y-4 pt-2 border-t border-zinc-800/60">
              {stepsList.map((stepDesc, idx) => {
                const isCompleted = uploadStep > idx;
                const isActive = uploadStep === idx;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-4 transition-all duration-300 ${
                      isActive ? 'scale-[1.02] text-indigo-400 font-semibold' : isCompleted ? 'text-zinc-400' : 'text-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      {isCompleted ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500 flex items-center justify-center text-emerald-400">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : isActive ? (
                        <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 text-xs font-semibold">
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <span className="text-sm">{stepDesc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM COLUMN MAPPING MODAL */}
      {showMappingModal && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-zinc-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
            
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-200">Confirm Column Mappings</h3>
                <p className="text-xs text-zinc-500 mt-1">We couldn't automatically align the headers of your CSV. Please select them manually.</p>
              </div>
              <button 
                onClick={() => setShowMappingModal(false)}
                className="text-zinc-500 hover:text-zinc-300 transition text-lg"
              >
                &times;
              </button>
            </div>

            {/* MAPPING DROPDOWNS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Mapping */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Date Column *</label>
                <select
                  value={userMapping.date || ""}
                  onChange={(e) => setUserMapping({ ...userMapping, date: e.target.value || null })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select Date Column --</option>
                  {previewData.columns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Description Mapping */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Description/Narration Column *</label>
                <select
                  value={userMapping.description || ""}
                  onChange={(e) => setUserMapping({ ...userMapping, description: e.target.value || null })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select Description Column --</option>
                  {previewData.columns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Amount Mapping Option */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Single Amount Column (Fallback)</label>
                <select
                  value={userMapping.amount || ""}
                  disabled={!!(userMapping.debit || userMapping.credit)}
                  onChange={(e) => setUserMapping({ ...userMapping, amount: e.target.value || null })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                >
                  <option value="">-- Select Amount Column --</option>
                  {previewData.columns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Balance Mapping */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Running Balance Column</label>
                <select
                  value={userMapping.balance || ""}
                  onChange={(e) => setUserMapping({ ...userMapping, balance: e.target.value || null })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select Balance Column --</option>
                  {previewData.columns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Debit mapping */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Debit (Withdrawal) Column</label>
                <select
                  value={userMapping.debit || ""}
                  disabled={!!userMapping.amount}
                  onChange={(e) => setUserMapping({ ...userMapping, debit: e.target.value || null })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                >
                  <option value="">-- Select Debit Column --</option>
                  {previewData.columns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Credit mapping */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Credit (Deposit) Column</label>
                <select
                  value={userMapping.credit || ""}
                  disabled={!!userMapping.amount}
                  onChange={(e) => setUserMapping({ ...userMapping, credit: e.target.value || null })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                >
                  <option value="">-- Select Credit Column --</option>
                  {previewData.columns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* PREVIEW SAMPLE TABLE */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">CSV Data Sample</span>
              <div className="overflow-x-auto border border-zinc-800 rounded-2xl bg-zinc-950/50 max-h-40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 uppercase font-semibold">
                      {previewData.columns.map((c) => (
                        <th key={c} className="py-2 px-3 whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 font-mono text-zinc-300">
                    {previewData.sample_rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/30">
                        {previewData.columns.map((c) => (
                          <td key={c} className="py-2 px-3 whitespace-nowrap">{row[c] || ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* HEADER ROW INDEX */}
            <div className="flex items-center gap-4 border-t border-zinc-800 pt-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Header Row Index:</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={headerRow}
                  onChange={(e) => setHeaderRow(parseInt(e.target.value) || 0)}
                  className="w-16 bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1 text-center text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              
              <div className="ml-auto flex gap-3">
                <button
                  onClick={() => setShowMappingModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMappingSubmit}
                  disabled={!userMapping.date || !userMapping.description || (!userMapping.amount && !(userMapping.debit && userMapping.credit))}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 hover:shadow-[0_0_10px_rgba(99,102,241,0.3)] text-white transition cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  Process Statement
                </button>
              </div>
            </div>

            {/* Glowing Accent */}
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          </div>
        </div>
      )}
    </div>
  );
}
