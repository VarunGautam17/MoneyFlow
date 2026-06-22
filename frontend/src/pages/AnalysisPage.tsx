import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  deleteSession,
  getAnalytics,
  getInsights,
  getRecurring,
  getSession,
  getTransactions,
  type Analytics,
  type Insight,
  type RecurringGroup,
  type Transaction,
} from "../api/client";
import CategoryChart from "../components/CategoryChart";
import InsightCards from "../components/InsightCards";
import MonthlyTrendChart from "../components/MonthlyTrendChart";
import ProcessingStatus from "../components/ProcessingStatus";
import RecurringList from "../components/RecurringList";
import ReportExport from "../components/ReportExport";
import SummaryCards from "../components/SummaryCards";
import TransactionTable from "../components/TransactionTable";
import { formatINR } from "../utils/format";

type Tab = "summary" | "transactions" | "recurring" | "insights";

const TABS: { id: Tab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "transactions", label: "Transactions" },
  { id: "recurring", label: "Recurring" },
  { id: "insights", label: "Insights" },
];

export default function AnalysisPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [thisMonthOnly, setThisMonthOnly] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringGroups, setRecurringGroups] = useState<RecurringGroup[]>([]);
  const [recurringTotal, setRecurringTotal] = useState(0);
  const [filename, setFilename] = useState("");

  const latestMonth = useMemo(() => {
    if (!analytics?.period_end) return null;
    return analytics.period_end.slice(0, 7);
  }, [analytics?.period_end]);

  const filteredAnalytics = useMemo(() => {
    if (!analytics || !thisMonthOnly || !latestMonth) return analytics;

    const monthTxns = transactions.filter((t) => t.date.startsWith(latestMonth) && t.amount < 0);
    const spend = monthTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const categoryMap: Record<string, { amount: number; count: number }> = {};
    for (const t of monthTxns) {
      if (!categoryMap[t.category]) categoryMap[t.category] = { amount: 0, count: 0 };
      categoryMap[t.category].amount += Math.abs(t.amount);
      categoryMap[t.category].count += 1;
    }
    const top_categories = Object.entries(categoryMap)
      .map(([category, { amount, count }]) => ({ category, amount, count }))
      .sort((a, b) => b.amount - a.amount);

    return {
      ...analytics,
      total_spend: spend,
      top_categories,
      monthly_spend: analytics.monthly_spend.filter((m) => m.month === latestMonth),
    };
  }, [analytics, thisMonthOnly, latestMonth, transactions]);

  const refreshData = useCallback(async () => {
    if (!sessionId) return;
    const [analyticsData, insightsData, txnData, recurringData] = await Promise.all([
      getAnalytics(sessionId),
      getInsights(sessionId),
      getTransactions(sessionId, 1, 100),
      getRecurring(sessionId),
    ]);
    setAnalytics(analyticsData);
    setInsights(insightsData.insights);
    setTransactions(txnData.items);
    setRecurringGroups(recurringData.groups);
    setRecurringTotal(recurringData.recurring_total_monthly);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    async function load() {
      try {
        const session = await getSession(sessionId!);
        setFilename(session.filename);

        if (session.status !== "ready") {
          setError(session.error_message || "Session is not ready");
          setLoading(false);
          return;
        }

        await refreshData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analysis");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [sessionId, refreshData]);

  async function handleDeleteSession() {
    if (!sessionId) return;
    setIsDeleting(true);
    try {
      await deleteSession(sessionId);
      setShowDeleteModal(false);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete session");
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleCategoryUpdated() {
    await refreshData();
  }

  if (loading) {
    return (
      <PageShell>
        <ProcessingStatus />
      </PageShell>
    );
  }

  if (error || !analytics || !filteredAnalytics) {
    return (
      <PageShell>
        <div className="max-w-md mx-auto w-full py-12 text-center animate-fadeIn">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500 flex items-center justify-center text-rose-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-zinc-100">Analysis Failed</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{error || "Analysis not found"}</p>
            </div>
            <div className="pt-2">
              <Link to="/" className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition duration-200 shadow-lg shadow-indigo-500/20">
                Upload another statement
              </Link>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mb-8 space-y-2">
        <Link to="/" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition duration-200">
          ← Upload another statement
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold text-zinc-100 tracking-tight font-display">Spending Analysis</h1>
        <p className="text-sm text-zinc-400">
          <span className="font-semibold text-zinc-300">{filename}</span> · <span className="font-semibold text-zinc-300">{analytics.transaction_count}</span> transactions
          {analytics.period_start && analytics.period_end && (
            <> · <span className="font-semibold text-zinc-300">{analytics.period_start}</span> to <span className="font-semibold text-zinc-300">{analytics.period_end}</span></>
          )}
        </p>
        <div className="pt-2 flex flex-wrap items-center gap-4">
          {sessionId && <ReportExport sessionId={sessionId} />}
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="px-3.5 py-2 rounded-xl text-sm font-medium bg-rose-950/20 text-rose-400 border border-rose-900/30 hover:bg-rose-900/30 hover:border-rose-800 transition duration-200 flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Session
          </button>
        </div>
      </div>

      <div className="border-b border-zinc-800 mb-6">
        <nav className="-mb-px flex space-x-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition cursor-pointer
                ${activeTab === tab.id
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }
              `}
            >
              {tab.label}
              {tab.id === "recurring" && recurringGroups.length > 0 && (
                <span className="ml-1.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 text-xs">
                  {recurringGroups.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "summary" && (
        <section className="space-y-8 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-zinc-200">Overview</h2>
            {latestMonth && (
              <label className="flex items-center gap-2 text-xs text-zinc-400 font-semibold cursor-pointer select-none bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 hover:text-zinc-200 transition">
                <input
                  type="checkbox"
                  checked={thisMonthOnly}
                  onChange={(e) => setThisMonthOnly(e.target.checked)}
                  className="accent-indigo-500 rounded cursor-pointer"
                />
                Only {latestMonth}
              </label>
            )}
          </div>

          <SummaryCards analytics={thisMonthOnly ? filteredAnalytics : analytics} />

          {analytics.recurring_total_monthly > 0 && !thisMonthOnly && (
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-400 font-medium">
              Recurring commitments:{" "}
              <span className="font-bold text-indigo-300">{formatINR(analytics.recurring_total_monthly)}/month</span>
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                Spend by Category
              </h3>
              <CategoryChart analytics={filteredAnalytics} />
            </div>
            <div className="space-y-3">
              <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Monthly Trend
              </h3>
              <MonthlyTrendChart
                analytics={thisMonthOnly ? analytics : filteredAnalytics}
                highlightMonth={thisMonthOnly ? latestMonth : null}
              />
            </div>
          </div>
        </section>
      )}

      {activeTab === "transactions" && sessionId && (
        <section className="space-y-4 animate-fadeIn">
          <p className="text-sm text-zinc-400">
            Click a category dropdown to override — totals and charts update automatically.
          </p>
          <TransactionTable
            sessionId={sessionId}
            transactions={transactions}
            onCategoryUpdated={handleCategoryUpdated}
          />
        </section>
      )}

      {activeTab === "recurring" && (
        <section className="animate-fadeIn">
          <RecurringList groups={recurringGroups} totalMonthly={recurringTotal} />
        </section>
      )}

      {activeTab === "insights" && (
        <section className="animate-fadeIn">
          <InsightCards insights={insights} />
        </section>
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => !isDeleting && setShowDeleteModal(false)}
          />
          
          {/* Modal Container */}
          <div className="relative bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-6 transform scale-100 transition-all">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-zinc-100 font-display">Delete Analysis Session?</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  This will permanently delete this analysis and all associated transaction data. This action cannot be undone.
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition duration-200 disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteSession}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition duration-200 shadow-lg shadow-rose-600/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  "Delete Session"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
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
                MoneyFlow💸🌊
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-start">
        {children}
      </main>

      <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-center text-xs text-zinc-600 mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} MoneyFlow💸🌊. Scan and categorize personal finances locally & securely.</p>
        </div>
      </footer>
    </div>
  );
}
