import { useState, useMemo, useRef } from 'react';
import './App.css';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

// --- TYPES ---
interface Transaction {
  id: string;
  session_id: string;
  date: string;
  description_raw: string;
  description_clean: string | null;
  amount: number;
  type: 'credit' | 'debit';
  balance: number | null;
  category: string | null;
  category_confidence: number | null;
  is_recurring: boolean;
  recurring_group_id: string | null;
  metadata_json: Record<string, any> | null;
}

interface RecurringGroup {
  id: string;
  session_id: string;
  name: string;
  typical_amount: number;
  frequency: string;
  confidence: number;
  category: string;
  transactions: Transaction[];
}

interface AnalysisResult {
  id: string;
  session_id: string;
  metrics: {
    income: number;
    spend: number;
    savings: number;
    savings_rate: number;
    recurring_total?: number;
    monthly_spend?: Array<{ month: string; spend: number }>;
  };
  top_categories: Array<{ category: string; amount: number }>;
  biggest_transactions: Array<{ description: string; amount: number; date: string }>;
  insights: string[];
}

interface UploadSession {
  id: string;
  filename: string;
  file_type: string;
  status: 'pending' | 'parsing' | 'processing' | 'ready' | 'failed';
  error_message: string | null;
  bank_hint: string | null;
}

interface ColumnMapping {
  date: string | null;
  description: string | null;
  debit: string | null;
  credit: string | null;
  amount: string | null;
  balance: string | null;
}

interface CsvPreview {
  columns: string[];
  sample_rows: Record<string, any>[];
  suggested_mapping: ColumnMapping;
  header_row: number;
  confidence_score: number;
  auto_process: boolean;
}


// --- SAMPLE CSV CONTENT FOR THE DEMO BUTTON ---
const SAMPLE_HDFC_CSV = `Date,Narration,Chq./Ref.No.,Value Date,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/06/26,UPI/CR/987654321098/SALARY_CO/UPI/salary@company/98765,,01/06/26,,150000.00,175000.00
02/06/26,UPI/DR/111111111111/HOUSE_OWNER/UPI/rent@okaxis/11111,,02/06/26,35000.00,,140000.00
02/06/26,UPI/DR/123456789012/ZOMATO/UPI/zomato@paytm/12345,,02/06/26,450.00,,139550.00
03/06/26,UPI/DR/223344556677/UBER INDIA/UPI/uber@sbi/22334,,03/06/26,320.00,,139230.00
03/06/26,UPI/DR/009988776655/AMAZON INDIA/UPI/amazon@apl/00123,,03/06/26,2499.00,,136731.00
04/06/26,IMPS-654321-SPOTIFY-Spotify Premium,,04/06/26,119.00,,136612.00
05/06/26,UPI/DR/123456789012/SWIGGY/UPI/swiggy@axis/12345,,05/06/26,380.00,,136232.00
06/06/26,NEFT-N123456789-NETFLIX COM-Netflix Subscription,,06/06/26,649.00,,135583.00
07/06/26,UPI/DR/334455667788/ZERODHA FUNDING/UPI/zerodha@hdfc/33445,,07/06/26,15000.00,,120583.00
08/06/26,UPI/DR/445566000011/RETAIL STORE/UPI/groceries@okicici/44556,,08/06/26,3250.00,,117333.00
09/06/26,ACH/DR/SBI_HOME_LOAN/EMI_JUNE_2026/9876,,09/06/26,42000.00,,75333.00
10/06/26,IMPS-987654-FLIPKART PAY-Refund,,10/06/26,,1200.00,76533.00
11/06/26,UPI/DR/445566778899/OLA CABS/UPI/ola@olacabs/44556,,11/06/26,550.00,,75983.00
12/06/26,UPI/DR/998877665544/STARBUCKS/UPI/starbucks@okaxis/99887,,12/06/26,280.00,,75703.00
13/06/26,UPI/DR/776655443322/FLIPKART INDIA/UPI/flipkart@ybl/77665,,13/06/26,1899.00,,73804.00
14/06/26,UPI/CR/887766554433/FRIEND_REFUND/UPI/friend@paytm/88776,,14/06/26,,850.00,74654.00
15/06/26,UPI/DR/123456789012/SWIGGY/UPI/swiggy@axis/12345,,15/06/26,410.00,,74244.00
16/06/26,UPI/DR/009988776655/AMAZON INDIA/UPI/amazon@apl/00123,,16/06/26,799.00,,73445.00
17/06/26,UPI/DR/123456789012/ZOMATO/UPI/zomato@paytm/12345,,17/06/26,620.00,,72825.00
18/06/26,UPI/DR/334455667788/ZERODHA FUNDING/UPI/zerodha@hdfc/33445,,18/06/26,10000.00,,62825.00
19/06/26,UPI/DR/445566778899/OLA CABS/UPI/ola@olacabs/44556,,19/06/26,480.00,,62345.00
20/06/26,UPI/DR/554433221100/SHELL PETROL/UPI/shell@sbi/55443,,20/06/26,1500.00,,60845.00
21/06/26,UPI/DR/665544332211/LOCAL METRO/UPI/metro@dmrc/66554,,21/06/26,500.00,,60345.00
22/06/26,UPI/DR/123456789012/SWIGGY/UPI/swiggy@axis/12345,,22/06/26,320.00,,60025.00
23/06/26,UPI/DR/223344556677/UBER INDIA/UPI/uber@sbi/22334,,23/06/26,290.00,,59735.00
24/06/26,UPI/DR/123456789012/ZOMATO/UPI/zomato@paytm/12345,,24/06/26,750.00,,58985.00
25/06/26,UPI/DR/887766554433/ELECTRICITY BILL/UPI/bill@bescom/88776,,25/06/26,4500.00,,54485.00
26/06/26,UPI/DR/998877665544/ACT FIBERNET/UPI/act@act/99887,,26/06/26,1180.00,,53305.00
27/06/26,UPI/DR/334455667788/GROWW SIP/UPI/groww@hdfc/33445,,27/06/26,5000.00,,48305.00
28/06/26,UPI/DR/009988776655/AMAZON INDIA/UPI/amazon@apl/00123,,28/06/26,1250.00,,47055.00
29/06/26,UPI/DR/123456789012/SWIGGY/UPI/swiggy@axis/12345,,29/06/26,480.00,,46575.00
30/06/26,UPI/DR/223344556677/UBER INDIA/UPI/uber@sbi/22334,,30/06/26,350.00,,46225.00
01/07/26,UPI/CR/987654321098/SALARY_CO/UPI/salary@company/98765,,01/07/26,,150000.00,196225.00
02/07/26,UPI/DR/111111111111/HOUSE_OWNER/UPI/rent@okaxis/11111,,02/07/26,35000.00,,161225.00
02/07/26,UPI/DR/123456789012/ZOMATO/UPI/zomato@paytm/12345,,02/07/26,520.00,,160705.00
03/07/26,UPI/DR/223344556677/UBER INDIA/UPI/uber@sbi/22334,,03/07/26,310.00,,160395.00
04/07/26,IMPS-654321-SPOTIFY-Spotify Premium,,04/07/26,119.00,,160276.00
05/07/26,UPI/DR/123456789012/SWIGGY/UPI/swiggy@axis/12345,,05/07/26,390.00,,159886.00
06/07/26,NEFT-N123456789-NETFLIX COM-Netflix Subscription,,06/07/26,649.00,,159237.00
07/07/26,UPI/DR/334455667788/ZERODHA FUNDING/UPI/zerodha@hdfc/33445,,07/07/26,15000.00,,144237.00
08/07/26,UPI/DR/445566000011/RETAIL STORE/UPI/groceries@okicici/44556,,08/07/26,2800.00,,141437.00
09/07/26,ACH/DR/SBI_HOME_LOAN/EMI_JULY_2026/9876,,09/07/26,42000.00,,99437.00
11/07/26,UPI/DR/445566778899/OLA CABS/UPI/ola@olacabs/44556,,11/07/26,460.00,,98977.00
12/07/26,UPI/DR/998877665544/STARBUCKS/UPI/starbucks@okaxis/99887,,12/07/26,320.00,,98657.00
13/07/26,UPI/DR/776655443322/FLIPKART INDIA/UPI/flipkart@ybl/77665,,13/07/26,999.00,,97658.00
15/07/26,UPI/DR/123456789012/SWIGGY/UPI/swiggy@axis/12345,,15/07/26,350.00,,97308.00
16/07/26,UPI/DR/009988776655/AMAZON INDIA/UPI/amazon@apl/00123,,16/07/26,1450.00,,95858.00
17/07/26,UPI/DR/123456789012/ZOMATO/UPI/zomato@paytm/12345,,17/07/26,480.00,,95378.00
18/07/26,UPI/DR/334455667788/ZERODHA FUNDING/UPI/zerodha@hdfc/33445,,18/07/26,10000.00,,85378.00
19/07/26,UPI/DR/445566778899/OLA CABS/UPI/ola@olacabs/44556,,19/07/26,520.00,,84858.00
20/07/26,UPI/DR/554433221100/SHELL PETROL/UPI/shell@sbi/55443,,20/07/26,1600.00,,83258.00
22/07/26,UPI/DR/123456789012/SWIGGY/UPI/swiggy@axis/12345,,22/07/26,420.00,,82838.00
23/07/26,UPI/DR/223344556677/UBER INDIA/UPI/uber@sbi/22334,,23/07/26,310.00,,82528.00
24/07/26,UPI/DR/123456789012/ZOMATO/UPI/zomato@paytm/12345,,24/07/26,690.00,,81838.00
25/07/26,UPI/DR/887766554433/ELECTRICITY BILL/UPI/bill@bescom/88776,,25/07/26,4800.00,,77038.00
26/07/26,UPI/DR/998877665544/ACT FIBERNET/UPI/act@act/99887,,26/07/26,1180.00,,75858.00
27/07/26,UPI/DR/334455667788/GROWW SIP/UPI/groww@hdfc/33445,,27/07/26,5000.00,,70858.00
28/07/26,UPI/DR/009988776655/AMAZON INDIA/UPI/amazon@apl/00123,,28/07/26,890.00,,69968.00
29/07/26,UPI/DR/123456789012/SWIGGY/UPI/swiggy@axis/12345,,29/07/26,350.00,,69618.00
30/07/26,UPI/DR/223344556677/UBER INDIA/UPI/uber@sbi/22334,,30/07/26,280.00,,69338.00`;

function App() {
  const [viewState, setViewState] = useState<'idle' | 'uploading' | 'ready' | 'error'>('idle');
  const [uploadStep, setUploadStep] = useState<number>(0);
  const [session, setSession] = useState<UploadSession | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [analytics, setAnalytics] = useState<AnalysisResult | null>(null);
  const [recurringGroups, setRecurringGroups] = useState<RecurringGroup[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Column mapping state (kept for auto-detection)
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Navigation State
  const [activeTab, setActiveTab] = useState<'summary' | 'transactions' | 'recurring' | 'insights'>('summary');

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showThisMonthOnly, setShowThisMonthOnly] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePreviewFile = async (file: File) => {
    setSelectedFile(file);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/v1/upload/preview', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to preview CSV');
      }

      const previewData = await response.json();
      setCsvPreview(previewData);
      setColumnMapping(previewData.suggested_mapping);
      
      // Always auto-process with AI detection
      await handleUploadWithMapping();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to preview CSV');
      setViewState('error');
    }
  };

  const handleUploadWithMapping = async () => {
    if (!selectedFile || !columnMapping) return;

    setViewState('uploading');
    setUploadStep(0);
    setErrorMsg(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setUploadStep(1);

      const formData = new FormData();
      formData.append('file', selectedFile);
      
      // Add column mapping as JSON
      formData.append('column_mapping', JSON.stringify(columnMapping));
      formData.append('header_row', String(csvPreview?.header_row || 0));

      const response = await fetch('/api/v1/upload/upload-with-mapping', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error: ${response.statusText}`);
      }

      const sessionData = await response.json();
      setSession(sessionData);

      // Continue with the rest of the processing flow
      await new Promise((resolve) => setTimeout(resolve, 800));
      setUploadStep(2);

      const txResponse = await fetch(`/api/v1/sessions/${sessionData.id}/transactions`);
      if (!txResponse.ok) throw new Error('Failed to retrieve transactions.');
      const txData = await txResponse.json();

      await new Promise((resolve) => setTimeout(resolve, 800));
      setUploadStep(3);

      const analyticsResponse = await fetch(`/api/v1/sessions/${sessionData.id}/analytics`);
      if (!analyticsResponse.ok) throw new Error('Failed to retrieve analytics.');
      const analyticsData = await analyticsResponse.json();

      const recResponse = await fetch(`/api/v1/sessions/${sessionData.id}/recurring`);
      if (!recResponse.ok) throw new Error('Failed to retrieve recurring payments.');
      const recData = await recResponse.json();

      await new Promise((resolve) => setTimeout(resolve, 600));

      setTransactions(txData);
      setAnalytics(analyticsData);
      setRecurringGroups(recData);
      setActiveTab('summary');
      setViewState('ready');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An unexpected error occurred during processing.');
      setViewState('error');
    }
  };


  // Helper to format currency in INR style
  const formatINR = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  };

  const stepsList = [
    'Uploading bank statement file...',
    'Parsing columns & normalizing dates...',
    'Running smart categorization engine...',
    'Compiling financial health analytics...',
  ];

  // Run the animated flow sequence
  const startLoadingSequence = async (file: File) => {
    setViewState('uploading');
    setUploadStep(0);
    setErrorMsg(null);

    try {
      // Step 1: Upload (Simulate delay then hit real endpoint)
      await new Promise((resolve) => setTimeout(resolve, 600));
      setUploadStep(1);

      // Construct form data
      const formData = new FormData();
      formData.append('file', file);

      // Hit API upload
      const response = await fetch('/api/v1/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error: ${response.statusText}`);
      }

      const sessionData = await response.json();
      setSession(sessionData);

      // Step 2: Parsing done, categorizing
      await new Promise((resolve) => setTimeout(resolve, 800));
      setUploadStep(2);

      // Fetch transactions
      const txResponse = await fetch(`/api/v1/sessions/${sessionData.id}/transactions`);
      if (!txResponse.ok) throw new Error('Failed to retrieve transactions.');
      const txData = await txResponse.json();

      // Step 3: Categorized, compiling analytics
      await new Promise((resolve) => setTimeout(resolve, 800));
      setUploadStep(3);

      // Fetch analytics
      const analyticsResponse = await fetch(`/api/v1/sessions/${sessionData.id}/analytics`);
      if (!analyticsResponse.ok) throw new Error('Failed to retrieve analytics.');
      const analyticsData = await analyticsResponse.json();

      // Fetch recurring groups
      const recResponse = await fetch(`/api/v1/sessions/${sessionData.id}/recurring`);
      if (!recResponse.ok) throw new Error('Failed to retrieve recurring payments.');
      const recData = await recResponse.json();

      // Final short delay to show completion of compile step
      await new Promise((resolve) => setTimeout(resolve, 600));

      setTransactions(txData);
      setAnalytics(analyticsData);
      setRecurringGroups(recData);
      setActiveTab('summary');
      setViewState('ready');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An unexpected error occurred during processing.');
      setViewState('error');
    }
  };

  // Trigger browser file dialog
  const handleSelectFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handlePreviewFile(e.target.files[0]);
    }
  };

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        handlePreviewFile(file);
      } else {
        setErrorMsg('Only CSV files are supported.');
        setViewState('error');
      }
    }
  };

  // Use the pre-loaded HDFC CSV sample to simulate instant flow
  const handleLoadDemo = () => {
    const blob = new Blob([SAMPLE_HDFC_CSV], { type: 'text/csv' });
    const file = new File([blob], 'demo_hdfc_statement.csv', { type: 'text/csv' });
    startLoadingSequence(file);
  };

  // Reset state to upload screen
  const handleReset = () => {
    setViewState('idle');
    setSession(null);
    setTransactions([]);
    setAnalytics(null);
    setRecurringGroups([]);
    setErrorMsg(null);
    setSearchQuery('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setShowThisMonthOnly(false);
    setActiveTab('summary');
    setCsvPreview(null);
    setColumnMapping(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteSession = async () => {
    if (!session) {
      handleReset();
      return;
    }
    if (!window.confirm("Are you sure you want to permanently delete this session and all its transaction data?")) {
      return;
    }
    try {
      const response = await fetch(`/api/v1/sessions/${session.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete session on the server.');
      }
      handleReset();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error deleting session.');
    }
  };

  const handleCategoryChange = async (txnId: string, newCategory: string) => {
    if (!session) return;
    try {
      const response = await fetch(`/api/v1/sessions/${session.id}/transactions/${txnId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: newCategory }),
      });

      if (!response.ok) {
        throw new Error('Failed to update category.');
      }

      // Re-fetch all data to ensure dashboard and charts stay in sync
      const txResponse = await fetch(`/api/v1/sessions/${session.id}/transactions`);
      const txData = await txResponse.json();

      const analyticsResponse = await fetch(`/api/v1/sessions/${session.id}/analytics`);
      const analyticsData = await analyticsResponse.json();

      const recResponse = await fetch(`/api/v1/sessions/${session.id}/recurring`);
      const recData = await recResponse.json();

      setTransactions(txData);
      setAnalytics(analyticsData);
      setRecurringGroups(recData);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error updating category.');
    }
  };


  // Download raw sample CSV for manual testing
  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_HDFC_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_hdfc.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Latest Month calculation
  const latestMonth = useMemo(() => {
    if (transactions.length === 0) return '';
    const dates = transactions.map((t) => t.date).filter(Boolean);
    const maxDate = dates.reduce((a, b) => (a > b ? a : b), '');
    return maxDate.slice(0, 7); // YYYY-MM
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Search query match
      const descMatch = (tx.description_clean || tx.description_raw || '')
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const catMatchVal = (tx.category || '').toLowerCase().includes(searchQuery.toLowerCase());
      const queryMatch = descMatch || catMatchVal;

      // Type filter match
      const typeMatch =
        typeFilter === 'all' ||
        (typeFilter === 'credit' && tx.type === 'credit') ||
        (typeFilter === 'debit' && tx.type === 'debit');

      // Category filter match
      const catMatch = categoryFilter === 'all' || tx.category === categoryFilter;

      // This Month filter match
      if (showThisMonthOnly && latestMonth) {
        if (!tx.date.startsWith(latestMonth)) return false;
      }

      return queryMatch && typeMatch && catMatch;
    });
  }, [transactions, searchQuery, typeFilter, categoryFilter, showThisMonthOnly, latestMonth]);

  // Extract list of all unique categories in transactions for filter dropdown
  const uniqueCategories = useMemo(() => {
    const cats = transactions.map((t) => t.category).filter(Boolean) as string[];
    return Array.from(new Set(cats));
  }, [transactions]);

  // Render view
  return (
    <div className="min-h-screen text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* HEADER */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 009 11v-1.5M12 11a14 14 0 004-9.875M9 11h-.08m9.08.5a13.978 13.978 0 01-3.253 9.005M11 21a2 2 0 11-4 0m4 0a2 2 0 104 0m-4 0a1 1 0 11-2 0m2 0a1 1 0 102 0m-4 0a3.993 3.993 0 01-1.39-2.753m7.44-2.04l-.054-.09A13.916 13.916 0 0015 11v-1.5M15 11h.08" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                RupeeRadar
              </span>
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase">
                Phase 1 MVP
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {viewState === 'ready' && (
              <button
                onClick={handleDeleteSession}
                className="px-3.5 py-1.5 rounded-lg text-sm font-medium bg-rose-950/20 text-rose-400 border border-rose-900/30 hover:bg-rose-900/30 hover:border-rose-800 transition duration-200 flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Session
              </button>
            )}
            <a
              href="https://github.com/varun/RupeeRadar"
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 hover:text-white transition duration-200"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* MAIN BODY CONTENT */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">
        {/* VIEW 1: IDLE / FILE UPLOAD */}
        {viewState === 'idle' && (
          <div className="max-w-2xl mx-auto w-full text-center space-y-8 py-6">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
                Visualize Your Finances in Seconds
              </h1>
              <p className="text-zinc-400 text-lg max-w-xl mx-auto leading-relaxed">
                RupeeRadar scans your bank statement instantly, cleans UPI strings, automatically categorizes transactions, and uncovers spending insights.
              </p>
            </div>

            {/* DRAG AND DROP AREA */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 rounded-3xl p-10 sm:p-14 transition duration-300 relative group overflow-hidden animate-pulse-glow"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv"
                className="hidden"
              />

              <div className="space-y-6 relative z-10 flex flex-col items-center">
                {/* Glowing Icon Wrapper */}
                <div className="w-16 h-16 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center group-hover:scale-110 transition duration-300 group-hover:border-indigo-500/50 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>

                <div className="space-y-2">
                  <p className="text-zinc-200 font-semibold text-lg">
                    Drag & drop your bank statement here
                  </p>
                  <p className="text-zinc-500 text-sm">
                    Only <span className="text-indigo-400 font-medium">.csv</span> formats are supported (e.g. HDFC Bank)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSelectFileClick}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] text-white transition duration-200 cursor-pointer"
                >
                  Browse Files
                </button>
              </div>

              {/* Decorative Background Glow */}
              <div className="absolute inset-0 bg-radial-gradient from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>

            {/* DEMO / TEST BUTTONS */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleLoadDemo}
                className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-semibold bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Explore Demo Statement
              </button>

              <button
                type="button"
                onClick={handleDownloadSample}
                className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-semibold bg-zinc-950 border border-zinc-900 text-zinc-400 hover:text-zinc-200 transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Sample CSV
              </button>
            </div>
          </div>
        )}

        {/* VIEW 2: UPLOADING & PROCESSING */}
        {viewState === 'uploading' && (
          <div className="max-w-md mx-auto w-full py-12">
            <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="space-y-8">
                {/* Animated Spinner with Gradient Ring */}
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

                {/* Stepper Display */}
                <div className="space-y-4 pt-2 border-t border-zinc-800/60">
                  {stepsList.map((stepDesc, idx) => {
                    const isCompleted = uploadStep > idx;
                    const isActive = uploadStep === idx;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-4 transition-all duration-300 ${
                          isActive ? 'scale-[1.02] text-indigo-400' : isCompleted ? 'text-zinc-400' : 'text-zinc-600'
                        }`}
                      >
                        {/* Status Dot */}
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

                        <span className="text-sm font-medium">{stepDesc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Glowing Background Accent */}
              <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            </div>
          </div>
        )}

        {/* VIEW 3: ERROR STATE */}
        {viewState === 'error' && (
          <div className="max-w-md mx-auto w-full py-12 text-center">
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-8 shadow-2xl space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500 flex items-center justify-center text-rose-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-zinc-100">Processing Failed</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  {errorMsg || 'We encountered an error parsing your bank statement. Please make sure the structure matches the standard format.'}
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition duration-200 cursor-pointer"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={handleLoadDemo}
                  className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition cursor-pointer"
                >
                  Load Demo Data instead
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: READY / DASHBOARD */}
        {viewState === 'ready' && analytics && (
          <div className="space-y-8 animate-fadeIn">
            {/* Session Info / Quick Statistics Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
              <div>
                <h2 className="text-2xl font-extrabold text-zinc-100 tracking-tight">Statement Analytics Dashboard</h2>
                <p className="text-zinc-500 text-sm flex items-center gap-2 mt-1">
                  <span>File:</span>
                  <span className="font-semibold text-zinc-300">{session?.filename}</span>
                  <span className="text-zinc-700">•</span>
                  <span>Transactions:</span>
                  <span className="font-semibold text-zinc-300">{transactions.length}</span>
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 self-start md:self-auto">
                <a
                  href={`/api/v1/sessions/${session?.id}/export`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] text-white transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Download Report
                </a>

                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload New
                </button>
              </div>
            </div>

            {/* METRICS SUMMARY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Income Card */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 shadow-xl relative overflow-hidden hover:border-emerald-500/30 transition duration-300 group">
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-zinc-400 text-sm font-medium tracking-wide">Total Credits (Income)</span>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition duration-300">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4 relative z-10">
                  <h3 className="text-3xl font-extrabold text-emerald-400 tracking-tight">
                    {formatINR(analytics.metrics.income)}
                  </h3>
                  <p className="text-zinc-500 text-xs mt-1">Inflow added to your balance</p>
                </div>
                {/* Background Glow */}
                <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition duration-300 pointer-events-none" />
              </div>

              {/* Spend Card */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 shadow-xl relative overflow-hidden hover:border-rose-500/30 transition duration-300 group">
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-zinc-400 text-sm font-medium tracking-wide">Total Debits (Spend)</span>
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition duration-300">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4 relative z-10">
                  <h3 className="text-3xl font-extrabold text-rose-400 tracking-tight">
                    {formatINR(analytics.metrics.spend)}
                  </h3>
                  <p className="text-zinc-500 text-xs mt-1">Outflow deducted from your balance</p>
                </div>
                {/* Background Glow */}
                <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition duration-300 pointer-events-none" />
              </div>

              {/* Savings Card */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 shadow-xl relative overflow-hidden hover:border-indigo-500/30 transition duration-300 group sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-zinc-400 text-sm font-medium tracking-wide">Net Savings / Savings Rate</span>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition duration-300">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4 relative z-10 space-y-3">
                  <div className="flex justify-between items-baseline">
                    <h3 className={`text-3xl font-extrabold tracking-tight ${analytics.metrics.savings >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                      {formatINR(analytics.metrics.savings)}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${analytics.metrics.savings_rate >= 20 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                      {analytics.metrics.savings_rate.toFixed(1)}% Rate
                    </span>
                  </div>

                  {/* Savings progress bar */}
                  <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden border border-zinc-700/30">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(Math.max(analytics.metrics.savings_rate, 0), 100)}%` }}
                    />
                  </div>
                </div>
                {/* Background Glow */}
                <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition duration-300 pointer-events-none" />
              </div>
            </div>

            {/* TABS NAVIGATION */}
            <div className="border-b border-zinc-800">
              <nav className="-mb-px flex space-x-6">
                {[
                  { id: 'summary', name: 'Dashboard' },
                  { id: 'transactions', name: 'Transactions Ledger' },
                  { id: 'recurring', name: 'Recurring Payments' },
                  { id: 'insights', name: 'Smart Insights' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`
                      whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition cursor-pointer
                      ${activeTab === tab.id
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                      }
                    `}
                  >
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>

            {/* DASHBOARD TAB */}
            {activeTab === 'summary' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Monthly Spend Bar Chart */}
                  <div className="bg-zinc-900/20 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl">
                    <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Monthly Spend Trend
                    </h3>
                    <div className="h-64 w-full text-zinc-400 text-xs font-semibold">
                      {analytics.metrics.monthly_spend && analytics.metrics.monthly_spend.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.metrics.monthly_spend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis dataKey="month" stroke="#71717a" tickLine={false} axisLine={false} />
                            <YAxis stroke="#71717a" tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                            <ChartTooltip 
                              cursor={{ fill: '#27272a', opacity: 0.3 }}
                              contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#f4f4f5' }}
                              formatter={(value: any) => [formatINR(value), 'Spend']}
                            />
                            <Bar dataKey="spend" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center italic text-zinc-500">
                          Insufficient monthly data to show trends.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Category Spend Distribution Pie Chart */}
                  <div className="bg-zinc-900/20 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl">
                    <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                      </svg>
                      Category Distribution
                    </h3>
                    <div className="h-64 w-full">
                      {analytics.top_categories && analytics.top_categories.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analytics.top_categories}
                              dataKey="amount"
                              nameKey="category"
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={4}
                            >
                              {analytics.top_categories.map((entry, index) => {
                                const COLORS: Record<string, string> = {
                                  Salary: '#10B981',
                                  Subscriptions: '#8B5CF6',
                                  Food: '#F59E0B',
                                  Travel: '#0EA5E9',
                                  Investments: '#14B8A6',
                                  EMI: '#EF4444',
                                  Shopping: '#EC4899',
                                  Other: '#6B7280'
                                };
                                return <Cell key={`cell-${index}`} fill={COLORS[entry.category] || COLORS['Other']} />;
                              })}
                            </Pie>
                            <ChartTooltip
                              contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#f4f4f5' }}
                              formatter={(value: any) => [formatINR(value), 'Spend']}
                            />
                            <ChartLegend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center italic text-zinc-500">
                          No category spend data available.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Top Spending Areas Panel */}
                <div className="bg-zinc-900/20 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl">
                  <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
                    </svg>
                    Top Categories breakdown
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {analytics.top_categories.map((cat, idx) => (
                      <div key={idx} className="bg-zinc-950/40 border border-zinc-800/60 rounded-2xl p-4 space-y-2 hover:border-zinc-700 transition">
                        <div className="flex justify-between text-xs font-semibold text-zinc-400">
                          <span className="capitalize">{cat.category}</span>
                          <span>{formatINR(cat.amount)}</span>
                        </div>
                        <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-2 rounded-full"
                            style={{
                              width: `${(cat.amount / Math.max(...analytics.top_categories.map((c) => c.amount))) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {analytics.top_categories.length === 0 && (
                      <p className="text-zinc-500 text-sm italic col-span-4">No categories recorded.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TRANSACTIONS TAB */}
            {activeTab === 'transactions' && (
              <div className="bg-zinc-900/20 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6 animate-fadeIn">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    Transactions Ledger
                  </h3>

                  {/* Filter Controls */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Search Bar */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-xl py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-48 transition"
                      />
                      <svg className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>

                    {/* Type Filters tabs */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-1 flex gap-1 text-xs font-semibold">
                      <button
                        onClick={() => setTypeFilter('all')}
                        className={`px-3 py-1 rounded-lg transition cursor-pointer ${typeFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setTypeFilter('credit')}
                        className={`px-3 py-1 rounded-lg transition cursor-pointer ${typeFilter === 'credit' ? 'bg-emerald-600/20 text-emerald-400 shadow-md border border-emerald-500/20' : 'text-zinc-400 hover:text-zinc-200'}`}
                      >
                        Credits
                      </button>
                      <button
                        onClick={() => setTypeFilter('debit')}
                        className={`px-3 py-1 rounded-lg transition cursor-pointer ${typeFilter === 'debit' ? 'bg-rose-600/20 text-rose-400 shadow-md border border-rose-500/20' : 'text-zinc-400 hover:text-zinc-200'}`}
                      >
                        Debits
                      </button>
                    </div>

                    {/* Category Dropdown */}
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-xl py-1.5 px-3 text-xs focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                    >
                      <option value="all">All Categories</option>
                      {uniqueCategories.map((cat, idx) => (
                        <option key={idx} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    {/* This Month Filter */}
                    {latestMonth && (
                      <label className="flex items-center gap-2 text-xs text-zinc-400 font-semibold cursor-pointer select-none bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 hover:text-zinc-200 transition">
                        <input
                          type="checkbox"
                          checked={showThisMonthOnly}
                          onChange={(e) => setShowThisMonthOnly(e.target.checked)}
                          className="accent-indigo-500 rounded cursor-pointer"
                        />
                        Only {latestMonth}
                      </label>
                    )}
                  </div>
                </div>

                {/* TRANSACTIONS TABLE */}
                <div className="overflow-x-auto border border-zinc-800/60 rounded-2xl bg-zinc-950/40">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800/80 text-[10px] uppercase font-bold tracking-wider text-zinc-500 bg-zinc-950/80 select-none">
                        <th className="py-3.5 px-5">Date</th>
                        <th className="py-3.5 px-5">Narration / Details</th>
                        <th className="py-3.5 px-5">Category</th>
                        <th className="py-3.5 px-5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 text-sm">
                      {filteredTransactions.map((tx) => {
                        const isDebit = tx.type === 'debit';
                        const cleanDesc = tx.description_clean || tx.description_raw;

                        return (
                          <tr key={tx.id} className="hover:bg-zinc-900/30 transition group">
                            {/* DATE */}
                            <td className="py-3 px-5 font-mono text-xs text-zinc-400 whitespace-nowrap">
                              {tx.date}
                            </td>

                            {/* DESCRIPTION */}
                            <td className="py-3 px-5 max-w-md">
                              <div className="font-semibold text-zinc-200 truncate group-hover:text-white transition flex items-center gap-2">
                                <span>{cleanDesc}</span>
                                {tx.is_recurring && (
                                  <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" title="Detected recurring payment">
                                    🔁 Recurring
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-500 truncate mt-0.5" title={tx.description_raw}>
                                {tx.description_raw}
                              </div>
                            </td>

                            {/* CATEGORY (Interactive Dropdown) */}
                            <td className="py-3 px-5 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <select
                                  value={tx.category || 'Other'}
                                  onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                                  className={`
                                    bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 
                                    focus:outline-none focus:border-indigo-500 font-medium cursor-pointer transition
                                    ${tx.category === 'Salary' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : ''}
                                    ${tx.category === 'Subscriptions' ? 'text-purple-400 border-purple-500/20 bg-purple-500/5' : ''}
                                    ${tx.category === 'Food' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' : ''}
                                    ${tx.category === 'Travel' ? 'text-sky-400 border-sky-500/20 bg-sky-500/5' : ''}
                                    ${tx.category === 'Investments' ? 'text-teal-400 border-teal-500/20 bg-teal-500/5' : ''}
                                    ${tx.category === 'EMI' ? 'text-rose-400 border-rose-500/20 bg-rose-500/5' : ''}
                                    ${tx.category === 'Shopping' ? 'text-pink-400 border-pink-500/20 bg-pink-500/5' : ''}
                                    ${tx.category === 'Other' ? 'text-zinc-400 border-zinc-700/50 bg-zinc-800/10' : ''}
                                  `}
                                >
                                  {['Salary', 'Subscriptions', 'Food', 'Travel', 'Investments', 'EMI', 'Shopping', 'Other'].map((cat) => (
                                    <option key={cat} value={cat} className="bg-zinc-950 text-zinc-200">
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                                
                                {tx.category_confidence === 1.0 && (
                                  <span 
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                                    title="Manually set by user"
                                  >
                                    Edited
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* AMOUNT */}
                            <td className={`py-3 px-5 text-right font-bold whitespace-nowrap ${isDebit ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {isDebit ? '-' : '+'} {formatINR(Math.abs(tx.amount))}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredTransactions.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-zinc-500 italic text-sm">
                            No transactions match the selected filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RECURRING TAB */}
            {activeTab === 'recurring' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-200">Detected Recurring Payments</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Subscriptions, EMIs, and repeating cadences found in your statement</p>
                  </div>
                  {analytics.metrics.recurring_total !== undefined && (
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-4 py-2 text-right">
                      <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Total Recurring Commitments</span>
                      <div className="text-xl font-black text-indigo-300">{formatINR(analytics.metrics.recurring_total)}/month</div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recurringGroups.map((group) => {
                    let catColor = 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50';
                    if (group.category === 'Salary') catColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                    else if (group.category === 'Subscriptions') catColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                    else if (group.category === 'Food') catColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                    else if (group.category === 'Travel') catColor = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
                    else if (group.category === 'Investments') catColor = 'bg-teal-500/10 text-teal-400 border-teal-500/20';
                    else if (group.category === 'EMI') catColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                    else if (group.category === 'Shopping') catColor = 'bg-pink-500/10 text-pink-400 border-pink-500/20';

                    return (
                      <div key={group.id} className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between hover:border-indigo-500/25 transition duration-300 group">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${catColor}`}>
                              {group.category}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {(group.confidence * 100).toFixed(0)}% Confidence
                            </span>
                          </div>

                          <div>
                            <h4 className="text-base font-bold text-zinc-200 truncate group-hover:text-white transition">
                              {group.name}
                            </h4>
                            <p className="text-[10px] text-zinc-500 capitalize">{group.frequency} billing cycle</p>
                          </div>

                          <div className="flex items-baseline gap-1.5 border-t border-b border-zinc-800/60 py-2">
                            <span className="text-zinc-500 text-xs font-medium">Est. Cost:</span>
                            <span className="text-lg font-black text-indigo-400">{formatINR(group.typical_amount)}</span>
                            <span className="text-zinc-600 text-[10px]">/mo</span>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Occurrences</span>
                            <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                              {group.transactions.map((txn) => (
                                <div key={txn.id} className="flex justify-between text-xs font-mono text-zinc-400">
                                  <span>{txn.date}</span>
                                  <span>{formatINR(Math.abs(txn.amount))}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {recurringGroups.length === 0 && (
                    <div className="col-span-full bg-zinc-900/10 border border-dashed border-zinc-800 rounded-3xl p-12 text-center text-zinc-500 italic text-sm">
                      No recurring payments or subscriptions detected in this statement.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* INSIGHTS TAB */}
            {activeTab === 'insights' && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Smart Financial Insights
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Personalized automated summaries of your spending patterns</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analytics.insights.map((insight, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl p-5 flex gap-4 text-zinc-300 text-sm leading-relaxed transition"
                    >
                      <span className="text-indigo-400 text-xl select-none pt-0.5">✦</span>
                      <p>{insight}</p>
                    </div>
                  ))}
                  {analytics.insights.length === 0 && (
                    <p className="text-zinc-500 text-sm italic col-span-2">No insights generated for this statement.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-center text-xs text-zinc-600">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} RupeeRadar. Scan and categorize personal finances locally & securely.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
