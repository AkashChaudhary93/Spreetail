'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  resetDatabaseAction,
  importCSVAction,
  getStagedExpensesAction,
  getLedgerAction,
  getMembershipsAction,
  resolveStagedExpenseAction,
  deleteExpenseAction,
  readOriginalCSVFileAction,
  updateMembershipDatesAction,
  executeSettlementAction,
  clearStagingAction
} from './actions';
import { calculateBalancesAndSettlements } from '@/lib/settlements';

// Helper to get initials and avatar styling (Monochrome light theme)
function getAvatarStyles(name: string) {
  const clean = name.trim().toUpperCase();
  const initials = clean.slice(0, 2);
  const bgGradient = 'from-white to-white';
  const borderGlow = 'border-black shadow-none';
  return { initials, bgGradient, borderGlow };
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'staged' | 'ledger' | 'settlements' | 'memberships'>('overview');
  const [stagedExpenses, setStagedExpenses] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [selectedUserAudit, setSelectedUserAudit] = useState<string | null>(null);
  
  // Ledger search filter
  const [searchQuery, setSearchQuery] = useState<string>('');

  // State for currency mode (false = INR, true = USD)
  const [useUSD, setUseUSD] = useState<boolean>(false);
  const EXCHANGE_RATE = 83.5; // conversion multiplier: 1 USD = 83.5 INR

  // CSV paste input state
  const [csvInput, setCsvInput] = useState<string>('');
  const [importReport, setImportReport] = useState<{
    success: boolean;
    count?: number;
    approvedCount?: number;
    pendingCount?: number;
    error?: string;
  } | null>(null);

  // Staged expense edit modal state
  const [editingStaged, setEditingStaged] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<{
    date: string;
    description: string;
    paid_by: string;
    amount: number;
    currency: string;
    split_type: string;
    split_with: string[];
    split_details: string;
  } | null>(null);

  // Membership editing state
  const [editingMembership, setEditingMembership] = useState<any | null>(null);
  const [membershipForm, setMembershipForm] = useState<{
    joinedAt: string;
    leftAt: string;
  }>({ joinedAt: '', leftAt: '' });

  const [isPending, startTransition] = useTransition();
  const [loadingMsg, setLoadingMsg] = useState('');

  // Fetch all data from server
  const loadData = async () => {
    try {
      const stagedData = await getStagedExpensesAction();
      const ledgerData = await getLedgerAction();
      const memData = await getMembershipsAction();
      
      setStagedExpenses(stagedData);
      setExpenses(ledgerData);
      setMemberships(memData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReset = () => {
    setLoadingMsg('Resetting database...');
    startTransition(async () => {
      await resetDatabaseAction();
      await loadData();
      setImportReport(null);
      setSelectedUserAudit(null);
    });
  };

  const handleLoadOriginalCSV = () => {
    setLoadingMsg('Reading expenses_export.csv...');
    startTransition(async () => {
      const res = await readOriginalCSVFileAction();
      if (res.success && res.content) {
        setCsvInput(res.content);
        setLoadingMsg('Importing and scanning CSV...');
        const importRes = await importCSVAction(res.content);
        if (importRes.success) {
          const approved = importRes.data?.filter((r: any) => r.status === 'APPROVED').length || 0;
          const pending = importRes.data?.filter((r: any) => r.status === 'PENDING').length || 0;
          setImportReport({
            success: true,
            count: importRes.count,
            approvedCount: approved,
            pendingCount: pending
          });
          await loadData();
        } else {
          setImportReport({ success: false, error: importRes.error });
        }
      } else {
        setImportReport({ success: false, error: res.error });
      }
    });
  };

  const handleManualImport = () => {
    if (!csvInput.trim()) return;
    setLoadingMsg('Importing and scanning CSV...');
    startTransition(async () => {
      const importRes = await importCSVAction(csvInput);
      if (importRes.success) {
        const approved = importRes.data?.filter((r: any) => r.status === 'APPROVED').length || 0;
        const pending = importRes.data?.filter((r: any) => r.status === 'PENDING').length || 0;
        setImportReport({
          success: true,
          count: importRes.count,
          approvedCount: approved,
          pendingCount: pending
        });
        await loadData();
      } else {
        setImportReport({ success: false, error: importRes.error });
      }
    });
  };

  const handleDeleteExpense = (id: string) => {
    setLoadingMsg('Deleting expense...');
    startTransition(async () => {
      const res = await deleteExpenseAction(id);
      if (res.success) {
        await loadData();
      }
    });
  };

  const handleClearStaging = () => {
    if (!confirm('Are you sure you want to clear all pending staged expenses?')) return;
    setLoadingMsg('Purging staging queue...');
    startTransition(async () => {
      const res = await clearStagingAction();
      if (res.success) {
        await loadData();
      }
    });
  };

  const handleExecuteSettlement = (from: string, to: string, amount: number, currency: string) => {
    setLoadingMsg(`Recording settlement: ${from} paid ${to}...`);
    startTransition(async () => {
      const res = await executeSettlementAction(from, to, amount, currency);
      if (res.success) {
        await loadData();
      } else {
        alert('Failed to execute settlement: ' + res.error);
      }
    });
  };

  // Open the review/edit modal for staged record
  const startReview = (staged: any) => {
    setEditingStaged(staged);
    const raw: any = JSON.parse(staged.rawRowData);
    
    // Resolve values
    const splitWith = raw.split_with ? raw.split_with.split(';').map((s: string) => s.trim()).filter(Boolean) : [];
    
    // Try to parse amount safely
    let amt = parseFloat(raw.amount.replace(/"/g, '').replace(/,/g, ''));
    if (isNaN(amt)) amt = 0;
    
    setEditForm({
      date: raw.date || '',
      description: raw.description || '',
      paid_by: raw.paid_by || '',
      amount: amt,
      currency: raw.currency || 'INR',
      split_type: (raw.split_type || 'equal').toLowerCase(),
      split_with: splitWith,
      split_details: raw.split_details || ''
    });
  };

  const handleApproveEdit = () => {
    if (!editingStaged || !editForm) return;
    setLoadingMsg('Saving and approving expense...');
    startTransition(async () => {
      const res = await resolveStagedExpenseAction(editingStaged.id, 'APPROVE', {
        ...editForm,
        split_type: editForm.split_type.toUpperCase()
      });
      if (res.success) {
        setEditingStaged(null);
        setEditForm(null);
        await loadData();
      } else {
        alert('Failed to approve: ' + res.error);
      }
    });
  };

  const handleRejectStaged = (id: string) => {
    setLoadingMsg('Rejecting staging record...');
    startTransition(async () => {
      const res = await resolveStagedExpenseAction(id, 'REJECT');
      if (res.success) {
        await loadData();
      }
    });
  };

  // Open editing membership timeline modal
  const startEditMembership = (mem: any) => {
    setEditingMembership(mem);
    setMembershipForm({
      joinedAt: new Date(mem.joinedAt).toISOString().slice(0, 10),
      leftAt: mem.leftAt ? new Date(mem.leftAt).toISOString().slice(0, 10) : ''
    });
  };

  const handleSaveMembership = () => {
    if (!editingMembership) return;
    setLoadingMsg('Updating group timeline...');
    startTransition(async () => {
      const res = await updateMembershipDatesAction(
        editingMembership.id,
        membershipForm.joinedAt,
        membershipForm.leftAt || null
      );
      if (res.success) {
        setEditingMembership(null);
        await loadData();
      } else {
        alert('Failed to update: ' + res.error);
      }
    });
  };

  // Compute balances and simplified cash flows
  const baseCurrency = 'INR';
  const { balances, settlements } = calculateBalancesAndSettlements(expenses, memberships, baseCurrency);

  // Format amount values for render
  const formatAmount = (amtInBase: number) => {
    const isNeg = amtInBase < 0;
    const absVal = Math.abs(amtInBase);
    if (useUSD) {
      const amtInUSD = absVal / EXCHANGE_RATE;
      const formatted = amtInUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${isNeg ? '-' : ''}$${formatted} USD`;
    }
    const formatted = absVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${isNeg ? '-' : ''}₹${formatted} INR`;
  };

  // Filter expenses list by user audit and search query
  const filteredLedger = expenses.filter(exp => {
    // 1. Audit User Filter
    if (selectedUserAudit) {
      const isPayer = exp.paidBy.name === selectedUserAudit;
      const isDebtor = exp.splits.some((s: any) => s.user.name === selectedUserAudit);
      if (!isPayer && !isDebtor) return false;
    }
    
    // 2. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const descMatch = exp.description.toLowerCase().includes(q);
      const notesMatch = exp.notes ? exp.notes.toLowerCase().includes(q) : false;
      const payerMatch = exp.paidBy.name.toLowerCase().includes(q);
      if (!descMatch && !notesMatch && !payerMatch) return false;
    }
    
    return true;
  });

  const renderExpenseChart = () => {
    // Sort expenses by date
    const sorted = [...expenses]
      .filter(e => !e.isSettlement)
      .sort((a, b) => new Date(a.dateIncurred).getTime() - new Date(b.dateIncurred).getTime());

    if (sorted.length === 0) {
      return (
        <div className="h-64 border border-zinc-200 flex items-center justify-center text-zinc-400 font-mono text-xs select-none">
          NO TRANSACTION DATA AVAILABLE FOR GRAPHING
        </div>
      );
    }

    // Calculate running total
    let total = 0;
    const points = sorted.map(e => {
      total += Number(e.amount) * Number(e.exchangeRate);
      return {
        time: new Date(e.dateIncurred).getTime(),
        displayDate: new Date(e.dateIncurred).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: total,
        desc: e.description,
        amount: Number(e.amount) * Number(e.exchangeRate)
      };
    });

    // Width and height of SVG
    const width = 800;
    const height = 240;
    const paddingLeft = 60;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const minTime = points[0].time;
    const maxTime = points[points.length - 1].time;
    const timespan = maxTime - minTime || 1;

    const minVal = 0;
    const maxVal = Math.max(...points.map(p => p.value)) * 1.1 || 1000;

    // Map data to SVG coordinates
    const svgPoints = points.map(p => {
      const x = paddingLeft + ((p.time - minTime) / timespan) * chartWidth;
      const y = paddingTop + chartHeight - (p.value / maxVal) * chartHeight;
      return { x, y, ...p };
    });

    // Build the path string
    let pathD = `M ${svgPoints[0].x} ${svgPoints[0].y}`;
    for (let i = 1; i < svgPoints.length; i++) {
      pathD += ` L ${svgPoints[i].x} ${svgPoints[i].y}`;
    }

    // Build the filled area path string
    const fillD = `${pathD} L ${svgPoints[svgPoints.length - 1].x} ${paddingTop + chartHeight} L ${svgPoints[0].x} ${paddingTop + chartHeight} Z`;

    // Generate grid lines
    const gridDivisions = 5;
    const xGrids = Array.from({ length: gridDivisions }).map((_, idx) => {
      return paddingLeft + (idx / (gridDivisions - 1)) * chartWidth;
    });

    const yGrids = Array.from({ length: 4 }).map((_, idx) => {
      return paddingTop + (idx / 3) * chartHeight;
    });

    return (
      <div className="bg-white border border-zinc-200 p-5 rounded-none font-mono">
        <div className="flex justify-between items-center mb-4 select-none">
          <div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">CUMULATIVE EXPENSE LEDGER VALUE</span>
            <div className="text-xl font-black text-black mt-1">
              {formatAmount(total)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-black px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse"></span>
            <span className="text-[8.5px] text-black font-bold uppercase tracking-wider">LIVE FEED</span>
          </div>
        </div>

        {/* SVG Canvas */}
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
            {/* Gradients */}
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="black" stopOpacity="0.06" />
                <stop offset="100%" stopColor="black" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {xGrids.map((x, idx) => (
              <line
                key={`x-grid-${idx}`}
                x1={x}
                y1={paddingTop}
                x2={x}
                y2={paddingTop + chartHeight}
                stroke="rgba(0,0,0,0.04)"
                strokeDasharray="2 2"
              />
            ))}
            {yGrids.map((y, idx) => (
              <line
                key={`y-grid-${idx}`}
                x1={paddingLeft}
                y1={y}
                x2={paddingLeft + chartWidth}
                y2={y}
                stroke="rgba(0,0,0,0.04)"
                strokeDasharray="2 2"
              />
            ))}

            {/* Y-Axis Labels */}
            {yGrids.map((y, idx) => {
              const val = maxVal - (idx / 3) * maxVal;
              return (
                <text
                  key={`y-label-${idx}`}
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#888"
                  fontSize="8.5"
                  fontWeight="bold"
                >
                  {useUSD ? `$${(val / EXCHANGE_RATE).toFixed(0)}` : `₹${val.toFixed(0)}`}
                </text>
              );
            })}

            {/* X-Axis Labels */}
            {svgPoints.filter((_, idx) => idx === 0 || idx === Math.floor(svgPoints.length / 2) || idx === svgPoints.length - 1).map((p, idx) => (
              <text
                key={`x-label-${idx}`}
                x={p.x}
                y={paddingTop + chartHeight + 16}
                textAnchor="middle"
                fill="#888"
                fontSize="8.5"
                fontWeight="bold"
              >
                {p.displayDate}
              </text>
            ))}

            {/* Area Fill */}
            <path d={fillD} fill="url(#chartGradient)" />

            {/* Path Line */}
            <path d={pathD} fill="none" stroke="black" strokeWidth="1.5" strokeLinecap="round" />

            {/* Data Points */}
            {svgPoints.map((p, idx) => (
              <circle
                key={`point-${idx}`}
                cx={p.x}
                cy={p.y}
                r="2"
                fill="white"
                stroke="black"
                strokeWidth="1.5"
                className="cursor-pointer hover:r-3.5 transition-all"
              >
                <title>{`${p.displayDate} - ${p.desc}: ${formatAmount(p.amount)} (Total: ${formatAmount(p.value)})`}</title>
              </circle>
            ))}
          </svg>
        </div>

        {/* Interval and controls */}
        <div className="flex justify-between items-center border-t border-zinc-200 mt-4 pt-3 text-[9px] select-none">
          <div className="flex gap-1">
            {['1D', '1M', '3M', '1Y', '5Y', 'ALL'].map(range => (
              <button
                key={range}
                className={`px-2 py-0.5 font-bold border transition-colors cursor-pointer ${
                  range === 'ALL'
                    ? 'bg-white text-black border-black border-2'
                    : 'bg-transparent text-zinc-400 border-transparent hover:border-zinc-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-zinc-400 font-bold">
            <button className="hover:text-black" title="Embed Chart">{'</>'}</button>
            <button className="hover:text-black" title="Candle View">📊</button>
            <button className="hover:text-black" title="Properties">⚙</button>
            <button className="hover:text-black" title="Fullscreen View">⛶</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-white text-black h-screen flex flex-col font-sans selection:bg-black selection:text-white overflow-hidden">
      {/* Top Header */}
      <header className="h-14 border-b border-zinc-200 px-6 flex items-center justify-between bg-white shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="bg-white text-black border border-black text-[9px] font-black tracking-widest uppercase px-2 py-0.5">
            SPREETAIL
          </span>
          <h1 className="text-xs font-black tracking-widest uppercase text-black font-mono">
            Shared Expenses Terminal v1.0
          </h1>
          <span className="text-zinc-300 text-[10px] hidden sm:inline">|</span>
          <p className="text-zinc-400 text-[9px] font-mono uppercase hidden sm:inline">
            Status: Active Ledger Running
          </p>
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-3">
          {/* Currency Toggle */}
          <div className="border border-black px-2 py-1 bg-white flex items-center gap-2">
            <span className={`text-[9px] font-bold font-mono ${!useUSD ? 'text-black' : 'text-zinc-400'}`}>INR</span>
            <button
              onClick={() => setUseUSD(!useUSD)}
              className="w-8 h-4 bg-white border border-black p-0.5 relative focus:outline-none cursor-pointer"
            >
              <div
                className={`w-3.5 h-2.5 bg-black transition-transform ${
                  useUSD ? 'translate-x-3.5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-[9px] font-bold font-mono ${useUSD ? 'text-black' : 'text-zinc-400'}`}>USD</span>
          </div>

          <button
            onClick={handleReset}
            disabled={isPending}
            className="border border-black hover:bg-zinc-100 text-black text-[9px] font-black px-3 py-1.5 bg-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            RESET
          </button>
          
          <button
            onClick={handleLoadOriginalCSV}
            disabled={isPending}
            className="bg-white hover:bg-zinc-100 border border-black text-black text-[9px] font-black px-3 py-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            IMPORT CSV
          </button>
        </div>
      </header>

      {/* Global Loading overlay */}
      {isPending && (
        <div className="fixed inset-0 bg-white/95 flex flex-col items-center justify-center z-50">
          <div className="animate-spin h-8 w-8 border border-zinc-300 border-t-black mb-3"></div>
          <p className="text-black font-black text-[10px] font-mono uppercase tracking-widest">{loadingMsg}</p>
        </div>
      )}

      {/* Main split dashboard pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Workspace */}
        <main className="flex-1 flex flex-col overflow-y-auto px-6 py-5 bg-white">
          {/* Navigation tabs styled as TradingView pills */}
          <div className="mb-5 flex overflow-x-auto gap-2.5 shrink-0 scrollbar-none select-none">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 font-bold text-[10px] tracking-wider uppercase rounded-full border transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-white text-black border-black border-2 font-black'
                  : 'bg-white text-zinc-500 border-zinc-200 hover:border-black hover:text-black'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('staged')}
              className={`px-3.5 py-1.5 font-bold text-[10px] tracking-wider uppercase rounded-full border transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'staged'
                  ? 'bg-white text-black border-black border-2 font-black'
                  : 'bg-white text-zinc-500 border-zinc-200 hover:border-black hover:text-black'
              }`}
            >
              Staged Buffer
              {stagedExpenses.filter(s => s.status === 'PENDING').length > 0 && (
                <span className={`text-[8.5px] px-1.5 py-0.25 font-bold rounded-full border ${
                  activeTab === 'staged' ? 'bg-white text-black border-black' : 'bg-white text-zinc-550 border-zinc-300'
                }`}>
                  {stagedExpenses.filter(s => s.status === 'PENDING').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3.5 py-1.5 font-bold text-[10px] tracking-wider uppercase rounded-full border transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ledger'
                  ? 'bg-white text-black border-black border-2 font-black'
                  : 'bg-white text-zinc-500 border-zinc-200 hover:border-black hover:text-black'
              }`}
            >
              Ledger Audit
              <span className={`text-[8.5px] px-1.5 py-0.25 font-bold rounded-full border ${
                activeTab === 'ledger' ? 'bg-white text-black border-black' : 'bg-white text-zinc-555 border-zinc-300'
              }`}>
                {expenses.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('settlements')}
              className={`px-3.5 py-1.5 font-bold text-[10px] tracking-wider uppercase rounded-full border transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'settlements'
                  ? 'bg-white text-black border-black border-2 font-black'
                  : 'bg-white text-zinc-500 border-zinc-200 hover:border-black hover:text-black'
              }`}
            >
              Cash Settlements
              {settlements.length > 0 && (
                <span className={`text-[8.5px] px-1.5 py-0.25 font-bold rounded-full border ${
                  activeTab === 'settlements' ? 'bg-white text-black border-black' : 'bg-white text-zinc-555 border-zinc-300'
                }`}>
                  {settlements.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('memberships')}
              className={`px-3.5 py-1.5 font-bold text-[10px] tracking-wider uppercase rounded-full border transition-all cursor-pointer ${
                activeTab === 'memberships'
                  ? 'bg-white text-black border-black border-2 font-black'
                  : 'bg-white text-zinc-500 border-zinc-200 hover:border-black hover:text-black'
              }`}
            >
              Timeline
            </button>
          </div>

          {/* Import report */}
          {importReport && (
            <div className={`mb-5 p-4 border rounded-none bg-white ${
              importReport.success ? 'border-black text-black' : 'border-zinc-300 text-zinc-500'
            }`}>
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                {importReport.success ? '✓ PARSE SUCCESSFUL' : '⚠ SCAN FAILURE'}
              </h3>
              {importReport.success ? (
                <p className="text-[11px] mt-1 text-zinc-655 leading-normal font-mono">
                  Parsed <strong className="text-black font-black">{importReport.count}</strong> rows. Committed: {importReport.approvedCount} | Staged: {importReport.pendingCount}
                </p>
              ) : (
                <p className="text-[11px] mt-1 text-zinc-500">{importReport.error}</p>
              )}
            </div>
          )}

          {/* Tab Content */}
          <div className="flex-1 min-h-0">
            {/* Tab 0: Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Horizontal Ticker cards registry at the top of the Overview panel */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 select-none">
                  {balances.map(b => {
                    const isNegative = b.netBalance < -0.01;
                    const isPositive = b.netBalance > 0.01;
                    const { initials, bgGradient, borderGlow } = getAvatarStyles(b.name);
                    
                    const totalSpending = expenses.reduce((acc, curr) => acc + (Number(curr.amount) * Number(curr.exchangeRate)), 0) || 1;
                    const rawPercent = (b.netBalance / totalSpending) * 100;
                    const percentDisplay = `${rawPercent >= 0 ? '+' : ''}${rawPercent.toFixed(1)}%`;

                    return (
                      <div
                        key={b.name}
                        onClick={() => {
                          setSelectedUserAudit(b.name);
                          setActiveTab('ledger');
                        }}
                        className={`p-3 border cursor-pointer hover:border-zinc-400 transition-all bg-white border-zinc-200 flex flex-col gap-1.5`}
                      >
                        <div className="flex items-center gap-1.5">
                          <div className={`w-5 h-5 bg-gradient-to-br ${bgGradient} border ${borderGlow} flex items-center justify-center text-[9px] font-bold text-black uppercase`}>
                            {initials}
                          </div>
                          <span className="text-[10px] font-black text-zinc-500 tracking-wider uppercase">{b.name}</span>
                        </div>

                        <div className="mt-1">
                          <div className="text-xs font-mono font-black text-black truncate">
                            {formatAmount(Math.abs(b.netBalance))}
                          </div>
                          <div className={`text-[8.5px] font-mono font-bold mt-0.5 ${
                            isPositive ? 'text-black' : isNegative ? 'text-zinc-500' : 'text-zinc-400'
                          }`}>
                            {isPositive ? '↑' : isNegative ? '↓' : ''} {percentDisplay}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live SVG Chart */}
                {renderExpenseChart()}

                {/* Recent Transactions list */}
                <div className="bg-white border border-zinc-200 p-4.5 rounded-none">
                  <div className="flex justify-between items-center mb-4 select-none">
                    <h2 className="text-xs font-black uppercase tracking-wider text-black font-mono">Recent Transactions Feed</h2>
                    <button
                      onClick={() => setActiveTab('ledger')}
                      className="text-[9px] text-zinc-550 hover:text-black border border-zinc-200 hover:border-black px-2 py-1 font-bold cursor-pointer bg-white transition-all"
                    >
                      VIEW FULL LEDGER
                    </button>
                  </div>

                  {expenses.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-zinc-200 rounded-none">
                      <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">No transaction history found.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-100">
                      {expenses.slice(0, 5).map(exp => {
                        const paidInBase = Number(exp.amount) * Number(exp.exchangeRate);
                        return (
                          <div key={exp.id} className="py-2.5 flex items-center justify-between text-xs font-mono">
                            <div>
                              <span className="text-zinc-400 mr-3">{new Date(exp.dateIncurred).toISOString().slice(5, 10)}</span>
                              <span className="font-bold text-black uppercase">{exp.description}</span>
                              <span className="text-zinc-500 ml-2">by {exp.paidBy.name}</span>
                            </div>
                            <div className="text-right font-black text-black font-mono">
                              {formatAmount(paidInBase)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 1: Staged buffer */}
            {activeTab === 'staged' && (
              <div className="space-y-5">
                {/* CSV Ingestion */}
                <div className="bg-white border border-zinc-200 p-4.5 rounded-none">
                  <div className="flex justify-between items-center mb-2.5">
                    <h2 className="text-xs font-black uppercase tracking-wider text-black">Paste raw CSV data</h2>
                    <span className="text-[9px] text-zinc-450 font-mono">HEADER IDENTIFIER RUNNING</span>
                  </div>
                  <textarea
                    value={csvInput}
                    onChange={e => setCsvInput(e.target.value)}
                    placeholder="date,description,paid_by,amount,currency,split_type,split_with,split_details,notes"
                    rows={4}
                    className="w-full bg-white border border-zinc-250 rounded-none p-3 text-xs font-mono text-black focus:outline-none focus:border-black transition-all resize-none"
                  />
                  <div className="mt-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <span className="text-[9px] text-zinc-500 font-mono">
                      Format: date | description | paid_by | amount | currency | split_type | split_with
                    </span>
                    <button
                      onClick={handleManualImport}
                      disabled={isPending || !csvInput.trim()}
                      className="bg-white hover:bg-zinc-100 border border-black text-black font-black text-xs px-4 py-2 rounded-none transition-all disabled:opacity-50 cursor-pointer"
                    >
                      SCAN & STREAM
                    </button>
                  </div>
                </div>

                {/* Staging Quarantine list */}
                <div className="bg-white border border-zinc-200 p-4.5 rounded-none">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
                    <div>
                      <h2 className="text-xs font-black uppercase tracking-wider">Quarantined Records Queue</h2>
                      <p className="text-zinc-500 text-[10px] mt-0.5">
                        Items requiring manual review due to formatting anomalies or membership date bounds.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto select-none">
                      {stagedExpenses.filter(s => s.status === 'PENDING').length > 0 && (
                        <button
                          onClick={handleClearStaging}
                          className="bg-white hover:bg-zinc-100 border border-black text-black font-extrabold text-[10px] px-3 py-1.5 rounded-none transition-all focus:outline-none cursor-pointer"
                        >
                          Clear All
                        </button>
                      )}
                      <div className="text-[10px] bg-white border border-black px-3 py-1.5 text-black font-bold">
                        Pending: {stagedExpenses.filter(s => s.status === 'PENDING').length}
                      </div>
                    </div>
                  </div>

                  {stagedExpenses.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-zinc-200 rounded-none">
                      <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">No staged items in quarantine buffer.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-200 text-zinc-500 font-bold uppercase tracking-wider">
                            <th className="pb-2 pr-2 font-mono">Date</th>
                            <th className="pb-2 px-3">Description</th>
                            <th className="pb-2 px-3">Payer</th>
                            <th className="pb-2 px-3">Amount</th>
                            <th className="pb-2 px-3">Anomaly Diagnostics</th>
                            <th className="pb-2 px-3">Status</th>
                            <th className="pb-2 pl-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {stagedExpenses.map(staged => {
                            const hasAnomalies = staged.anomalies.length > 0;
                            return (
                              <tr key={staged.id} className="hover:bg-zinc-50 transition-colors">
                                <td className="py-3 pr-2 font-mono text-zinc-400">{staged.dateRaw}</td>
                                <td className="py-3 px-3">
                                  <div className="font-bold text-black text-xs">{staged.description}</div>
                                  {staged.notesRaw && (
                                    <div className="text-[9px] text-zinc-500 italic mt-0.5 max-w-xs truncate" title={staged.notesRaw}>
                                      {staged.notesRaw}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-zinc-700">
                                  {staged.paidByRaw ? (
                                    <span className="font-bold">{staged.paidByRaw}</span>
                                  ) : (
                                    <span className="text-zinc-500 font-bold italic bg-white border border-zinc-300 px-1 rounded-none">missing</span>
                                  )}
                                </td>
                                <td className="py-3 px-3 font-bold font-mono text-zinc-600">
                                  {staged.amountRaw} {staged.currencyRaw || 'INR'}
                                </td>
                                <td className="py-3 px-3 max-w-xs">
                                  <div className="flex flex-wrap gap-1">
                                    {staged.anomalies.map((a: string, idx: number) => (
                                      <span
                                        key={`${a}-${idx}`}
                                        title={JSON.stringify(staged.anomalyDetails)}
                                        className="bg-white text-black border border-black text-[8px] font-black px-1.5 py-0.25 rounded-none uppercase tracking-wide font-mono"
                                      >
                                        {a.replace(/_/g, ' ')}
                                      </span>
                                    ))}
                                    {!hasAnomalies && (
                                      <span className="border border-zinc-200 text-zinc-400 text-[8px] px-1.5 py-0.25 rounded-none font-black uppercase font-mono">
                                        CLEAN
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <span className={`text-[9px] font-black uppercase tracking-wider ${
                                    staged.status === 'PENDING'
                                      ? 'text-black underline decoration-dotted'
                                      : 'text-zinc-400'
                                  }`}>
                                    {staged.status}
                                  </span>
                                </td>
                                <td className="py-3 pl-3 text-right">
                                  {staged.status === 'PENDING' ? (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => startReview(staged)}
                                        className="bg-white hover:bg-zinc-100 border border-black text-black font-black text-[9px] px-2.5 py-1 rounded-none transition-all focus:outline-none cursor-pointer"
                                      >
                                        Review
                                      </button>
                                      <button
                                        onClick={() => handleRejectStaged(staged.id)}
                                        className="bg-white hover:bg-zinc-100 text-black border border-black font-extrabold text-[9px] px-2 py-1 rounded-none transition-all focus:outline-none cursor-pointer"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[9px] text-zinc-400 font-mono uppercase">PROCESSED</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Committed Ledger */}
            {activeTab === 'ledger' && (
              <div className="space-y-4">
                {selectedUserAudit && (
                  <div className="bg-white border border-black p-4 rounded-none flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2 font-mono">
                        <span className="w-1.5 h-1.5 bg-black"></span>
                        Audit trail active: {selectedUserAudit}
                      </h3>
                      <p className="text-zinc-500 text-[10px] mt-0.5 font-mono">
                        Filtering records where {selectedUserAudit} is the payer or debtor.
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedUserAudit(null)}
                      className="bg-white hover:bg-zinc-100 border border-black text-black text-[10px] font-bold px-3 py-1.5 rounded-none transition-all cursor-pointer font-mono"
                    >
                      Clear Audit Filter
                    </button>
                  </div>
                )}

                <div className="bg-white border border-zinc-200 p-4.5 rounded-none">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h2 className="text-xs font-black uppercase tracking-wider">
                      {selectedUserAudit ? `${selectedUserAudit}'s Transaction Audit` : 'Active Expense Ledger'}
                    </h2>
                    <div className="w-full sm:max-w-xs relative select-none">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Filter description, payer..."
                        className="w-full bg-white border border-zinc-250 rounded-none px-3 py-1.5 text-xs text-black placeholder-zinc-400 focus:outline-none focus:border-black transition-all font-mono"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1.5 text-zinc-405 hover:text-black focus:outline-none text-xs cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {filteredLedger.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-zinc-200 rounded-none">
                      <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">No ledger entries matching query.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-200 text-zinc-500 font-bold uppercase tracking-wider">
                            <th className="pb-2 pr-2 font-mono">Date</th>
                            <th className="pb-2 px-3">Description</th>
                            <th className="pb-2 px-3">Paid By</th>
                            <th className="pb-2 px-3">Total Amount</th>
                            <th className="pb-2 px-3 font-mono">Type</th>
                            <th className="pb-2 px-3">Splits Breakdown</th>
                            {selectedUserAudit && <th className="pb-2 px-3">User Share</th>}
                            <th className="pb-2 pl-3 text-right">Delete</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {filteredLedger.map(exp => {
                            const paidInBase = Number(exp.amount) * Number(exp.exchangeRate);
                            const isSettlement = exp.isSettlement;
                            const auditUserSplit = exp.splits.find((s: any) => s.user.name === selectedUserAudit);
                            const auditUserShareInBase = auditUserSplit ? Number(auditUserSplit.amount) * Number(exp.exchangeRate) : 0;
                            const wasAuditUserPayer = exp.paidBy.name === selectedUserAudit;

                            return (
                              <tr key={exp.id} className="hover:bg-zinc-50 transition-colors">
                                <td className="py-3 pr-2 font-mono text-zinc-400">
                                  {new Date(exp.dateIncurred).toISOString().slice(0, 10)}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-black text-xs">{exp.description}</span>
                                    {isSettlement && (
                                      <span className="border border-black text-black text-[8px] px-1 py-0.25 rounded-none font-bold uppercase font-mono bg-white">
                                        SETTLEMENT
                                      </span>
                                    )}
                                    {exp.amount < 0 && (
                                      <span className="border border-black text-black text-[8px] px-1 py-0.25 rounded-none font-bold uppercase font-mono bg-white">
                                        REFUND
                                      </span>
                                    )}
                                  </div>
                                  {exp.notes && <div className="text-[9px] text-zinc-400 italic mt-0.5">{exp.notes}</div>}
                                </td>
                                <td className="py-3 px-3 text-zinc-700 font-bold">{exp.paidBy.name}</td>
                                <td className="py-3 px-3 font-bold font-mono text-black text-xs">
                                  <div>{formatAmount(paidInBase)}</div>
                                  {exp.currency.toUpperCase() !== 'INR' && (
                                    <div className="text-[9px] text-zinc-400 font-normal mt-0.5 font-mono">
                                      {exp.amount} {exp.currency} @ {exp.exchangeRate}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 capitalize text-zinc-500 font-mono">{exp.splitType.toLowerCase()}</td>
                                <td className="py-3 px-3">
                                  <div className="max-w-xs flex flex-wrap gap-1">
                                    {exp.splits.map((s: any) => {
                                      const splitAmtInBase = Number(s.amount) * Number(exp.exchangeRate);
                                      return (
                                        <span
                                          key={s.id}
                                          className={`text-[9px] font-bold px-1.5 py-0.25 rounded-none border font-mono ${
                                            selectedUserAudit === s.user.name
                                              ? 'border-black text-black bg-white border-2'
                                              : 'border-zinc-200 text-zinc-400 bg-white'
                                          }`}
                                        >
                                          {s.user.name}: {useUSD ? `$${(splitAmtInBase/EXCHANGE_RATE).toFixed(1)}` : `₹${splitAmtInBase.toFixed(0)}`}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </td>
                                {selectedUserAudit && (
                                  <td className="py-3 px-3 font-mono">
                                    <div className="flex flex-col gap-0.5 text-[10px]">
                                      {wasAuditUserPayer && (
                                        <span className="text-black font-black">
                                          PAID: +{formatAmount(paidInBase)}
                                        </span>
                                      )}
                                      {auditUserSplit && (
                                        <span className="text-zinc-500 font-bold">
                                          OWED: -{formatAmount(auditUserShareInBase)}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}
                                <td className="py-3 pl-3 text-right">
                                  <button
                                    onClick={() => handleDeleteExpense(exp.id)}
                                    className="text-zinc-400 hover:text-black transition-colors focus:outline-none p-1 cursor-pointer"
                                    title="Delete and restore to staged buffer"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-3.5 w-3.5"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Settlements list */}
            {activeTab === 'settlements' && (
              <div className="space-y-4">
                <div className="bg-white border border-zinc-200 p-4.5 rounded-none">
                  <h2 className="text-xs font-black uppercase tracking-wider mb-1">Debt settlements minimization</h2>
                  <p className="text-zinc-500 text-[10px] mb-4">
                    Optimized cash flow instructions calculated to balance roommates net credit using the fewest transactions.
                  </p>

                  {settlements.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-zinc-200 rounded-none">
                      <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider font-mono">ledger is fully balanced. no payments required.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {settlements.map((tx, idx) => (
                        <div
                          key={idx}
                          className="border border-zinc-200 p-3 rounded-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-extrabold text-black bg-white border border-black px-2 py-1 text-xs">
                              {tx.from}
                            </span>
                            <span className="text-zinc-500 font-extrabold text-[9px] uppercase tracking-wider font-mono">pays</span>
                            <span className="font-extrabold text-black bg-white border border-black px-2 py-1 text-xs">
                              {tx.to}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between sm:justify-end gap-3.5 font-mono">
                            <div className="text-sm font-black text-black">
                              {formatAmount(tx.amount)}
                            </div>
                            <button
                              onClick={() => handleExecuteSettlement(tx.from, tx.to, tx.amount, tx.currency)}
                              className="bg-white hover:bg-zinc-100 border border-black text-black font-black text-[9px] px-2.5 py-1.5 rounded-none transition-all focus:outline-none cursor-pointer"
                              title="Commit this payment to the database ledger"
                            >
                              MARK PAID
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: Timelines */}
            {activeTab === 'memberships' && (
              <div className="bg-white border border-zinc-200 p-4.5 rounded-none font-mono">
                <h2 className="text-xs font-black uppercase tracking-wider mb-1">Group timeline occupancy</h2>
                <p className="text-zinc-500 text-[10px] mb-5">
                  Visual calendar tracking each flatmate membership window. Expenses splits are constrained to active dates.
                </p>

                <div className="space-y-4">
                  {memberships.map(m => {
                    const joined = new Date(m.joinedAt);
                    const left = m.leftAt ? new Date(m.leftAt) : null;
                    const { initials, bgGradient, borderGlow } = getAvatarStyles(m.user.name);
                    
                    const tStart = new Date('2026-02-01T00:00:00Z').getTime();
                    const tEnd = new Date('2026-05-31T23:59:59Z').getTime();
                    const totalDiff = tEnd - tStart;
                    
                    const joinedDiff = joined.getTime() - tStart;
                    const leftDiff = (left ? left.getTime() : tEnd) - tStart;
                    
                    const leftPct = Math.max(0, Math.min(100, (joinedDiff / totalDiff) * 100));
                    const widthPct = Math.max(1, Math.min(100, ((leftDiff - joinedDiff) / totalDiff) * 100));
                    
                    const isActiveNow = !left;
                    
                    return (
                      <div key={m.id} className="grid grid-cols-12 items-center gap-3 border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
                        <div className="col-span-3 flex items-center gap-2">
                          <div className={`w-7 h-7 bg-gradient-to-br ${bgGradient} border ${borderGlow} flex items-center justify-center text-[9px] font-bold text-black uppercase rounded-none shrink-0`}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-zinc-800 text-xs truncate block">{m.user.name}</span>
                            <span className={`inline-block text-[7px] font-black uppercase tracking-wider mt-0.5 px-1.5 py-0.25 border ${
                              isActiveNow
                                ? 'bg-white text-black border-black border-2'
                                : 'bg-white text-zinc-500 border-zinc-200'
                            }`}>
                              {isActiveNow ? 'Active' : m.user.name === 'Dev' || m.user.name === 'Kabir' ? 'Visitor' : 'Former'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="col-span-7 bg-white h-4 rounded-none relative overflow-hidden border border-black">
                          <div
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            className={`absolute top-0 bottom-0 transition-all duration-350 ${
                              isActiveNow
                                ? 'bg-zinc-300 border-l border-r border-black'
                                : 'bg-zinc-100 border-l border-r border-zinc-300'
                            }`}
                          ></div>
                        </div>
                        
                        <div className="col-span-2 text-right">
                          <button
                            onClick={() => startEditMembership(m)}
                            className="bg-white hover:bg-zinc-100 border border-black text-black text-[9px] font-bold px-2 py-1 rounded-none transition-all cursor-pointer font-mono"
                          >
                            EDIT DATES
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-2 border-t border-zinc-100 grid grid-cols-12 text-[8px] text-zinc-450 font-bold font-mono uppercase pl-[25%] pr-[16.6%] select-none">
                  <div className="text-left col-span-3">FEB 2026</div>
                  <div className="text-center col-span-3">MAR 2026</div>
                  <div className="text-center col-span-3">APR 2026</div>
                  <div className="text-right col-span-3">MAY 2026</div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="w-80 border-l border-zinc-200 bg-white flex flex-col overflow-y-auto px-5 py-5 shrink-0 select-none">
          <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200 mb-4">
            <span className="text-xs font-black uppercase tracking-widest text-black font-mono">
              Roommate Registry
            </span>
            <span className="text-[9px] text-black font-mono uppercase font-bold">
              {balances.length} Flatmates
            </span>
          </div>

          {selectedUserAudit && (
            <div className="mb-4 bg-white border border-black p-3 font-mono">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold uppercase text-black">LEDGER FILTER RUNNING</span>
                <button
                  onClick={() => setSelectedUserAudit(null)}
                  className="text-black hover:text-zinc-650 text-[9px] font-bold focus:outline-none cursor-pointer"
                >
                  CLEAR
                </button>
              </div>
              <div className="text-xs font-black text-black mt-1 uppercase tracking-wider">
                {selectedUserAudit}'s AUDIT TRAIL
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            {balances.map(b => {
              const isNegative = b.netBalance < -0.01;
              const isPositive = b.netBalance > 0.01;
              const { initials, bgGradient, borderGlow } = getAvatarStyles(b.name);
              const isFiltered = selectedUserAudit === b.name;

              return (
                <div
                  key={b.name}
                  onClick={() => {
                    setSelectedUserAudit(b.name);
                    setActiveTab('ledger');
                  }}
                  className={`p-3 border transition-all duration-150 cursor-pointer flex flex-col gap-2 ${
                    isFiltered
                      ? 'bg-white border-black border-2'
                      : 'bg-white border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 bg-gradient-to-br ${bgGradient} border ${borderGlow} flex items-center justify-center text-[9px] font-bold text-black uppercase rounded-none shrink-0`}>
                        {initials}
                      </div>
                      <span className="text-xs font-black text-black uppercase tracking-wider">{b.name}</span>
                    </div>

                    <div className="text-right">
                      <div className={`text-xs font-mono font-black ${
                        isPositive ? 'text-black font-bold' : isNegative ? 'text-zinc-500' : 'text-zinc-300'
                      }`}>
                        {isPositive ? '↑ ' : isNegative ? '↓ ' : ''}
                        {formatAmount(Math.abs(b.netBalance))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 text-[9px] text-zinc-400 border-t border-zinc-100 pt-2 font-mono">
                    <div>PAID: {useUSD ? `$${(b.totalPaid/EXCHANGE_RATE).toFixed(0)}` : `₹${b.totalPaid.toFixed(0)}`}</div>
                    <div className="text-right">OWED: {useUSD ? `$${(b.totalOwed/EXCHANGE_RATE).toFixed(0)}` : `₹${b.totalOwed.toFixed(0)}`}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick diagnostics statistics */}
          <div className="mt-auto pt-6 border-t border-zinc-200">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3 font-mono">
              SYSTEM STATISTICS
            </h4>
            <div className="space-y-2 text-[9px] font-mono text-zinc-400">
              <div className="flex justify-between">
                <span>TOTAL EXPORTED:</span>
                <span className="text-black font-bold">{expenses.length + stagedExpenses.length} ROWS</span>
              </div>
              <div className="flex justify-between">
                <span>ACTIVE LEDGER:</span>
                <span className="text-black font-bold">{expenses.length} ROWS</span>
              </div>
              <div className="flex justify-between">
                <span>STAGED AUDITS:</span>
                <span className="text-black font-bold">{stagedExpenses.filter(s => s.status === 'PENDING').length} ROWS</span>
              </div>
              <div className="flex justify-between">
                <span>SETTLEMENTS DUE:</span>
                <span className="text-black font-bold">{settlements.length} CHECKS</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* MODAL 1: Resolve staged expense */}
      {editingStaged && editForm && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto font-mono">
          <div className="bg-white border border-black rounded-none w-full max-w-lg p-6 shadow-2xl relative my-8 text-black">
            <h3 className="text-xs font-black uppercase tracking-widest text-black mb-2">RECONCILE & COMMIT STAGED TRANSACTION</h3>
            <p className="text-zinc-500 text-[10px] mb-4">
              Correct data anomalies and memberships mismatch before saving into ledger.
            </p>

            {/* List of anomalies in modal */}
            <div className="mb-5 bg-white border border-black p-3.5 rounded-none">
              <div className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">ANOMALIES DIAGNOSED:</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {editingStaged.anomalies.map((a: string, idx: number) => (
                  <span key={`${a}-${idx}`} className="border border-black text-black text-[8px] font-black px-1.5 py-0.25 rounded-none uppercase font-mono bg-white">
                    {a.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
              <div className="text-[10px] text-zinc-500 mt-2.5 leading-relaxed">
                {Object.keys(editingStaged.anomalyDetails).map(k => (
                  <div key={k}>• {editingStaged.anomalyDetails[k]}</div>
                ))}
              </div>
            </div>

            {/* Edit Fields Form */}
            <div className="space-y-4 text-black">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-400 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-none px-3 py-2 text-xs text-black focus:outline-none focus:border-black font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-400 mb-1.5">Description</label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full bg-white border border-zinc-205 rounded-none px-3 py-2 text-xs text-black focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-400 mb-1.5">Payer</label>
                  <select
                    value={editForm.paid_by}
                    onChange={e => setEditForm({ ...editForm, paid_by: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-none px-2 py-2 text-xs text-black focus:outline-none focus:border-black"
                  >
                    <option value="">Select Payer</option>
                    {memberships.map(m => (
                      <option key={m.user.id} value={m.user.name}>{m.user.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-400 mb-1.5">Amount</label>
                  <input
                    type="number"
                    value={editForm.amount}
                    onChange={e => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-zinc-205 rounded-none px-3 py-2 text-xs text-black focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-400 mb-1.5">Currency</label>
                  <select
                    value={editForm.currency}
                    onChange={e => setEditForm({ ...editForm, currency: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-none px-2 py-2 text-xs text-black focus:outline-none focus:border-black"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] uppercase font-black text-zinc-400 mb-1.5">Split Type</label>
                <select
                  value={editForm.split_type}
                  onChange={e => setEditForm({ ...editForm, split_type: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-none px-2 py-2 text-xs text-black focus:outline-none focus:border-black"
                >
                  <option value="equal">Equal</option>
                  <option value="percentage">Percentage</option>
                  <option value="share">Share</option>
                  <option value="unequal">Unequal</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] uppercase font-black text-zinc-400 mb-1.5">Split With Members</label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {memberships.map(m => {
                    const isChecked = editForm.split_with.includes(m.user.name);
                    return (
                      <label key={m.user.id} className="flex items-center gap-2 bg-white border border-black p-2 rounded-none cursor-pointer hover:bg-zinc-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const updated = isChecked
                              ? editForm.split_with.filter(name => name !== m.user.name)
                              : [...editForm.split_with, m.user.name];
                            setEditForm({ ...editForm, split_with: updated });
                          }}
                          className="rounded-none text-black focus:ring-black bg-white border-zinc-300"
                        />
                        <span className="text-[10px] font-semibold text-black">{m.user.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {editForm.split_type !== 'equal' && (
                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-400 mb-1.5">Split Details / Shares / Percentages</label>
                  <input
                    type="text"
                    value={editForm.split_details}
                    onChange={e => setEditForm({ ...editForm, split_details: e.target.value })}
                    placeholder="e.g. Aisha 30%; Rohan 30%; Priya 40%"
                    className="w-full bg-white border border-zinc-205 rounded-none px-3 py-2 text-xs text-black focus:outline-none focus:border-black font-mono"
                  />
                  <span className="text-[9px] text-zinc-405 mt-1 block font-mono">
                    Format: Name 30%; Name 40% (sums to 100%) or Name 1; Name 2 (shares).
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => {
                  setEditingStaged(null);
                  setEditForm(null);
                }}
                className="bg-white hover:bg-zinc-100 border border-black text-black font-bold text-xs px-4 py-2 rounded-none transition-all focus:outline-none cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={handleApproveEdit}
                className="bg-white hover:bg-zinc-100 border border-black text-black font-black text-xs px-4 py-2 rounded-none transition-all focus:outline-none cursor-pointer"
              >
                APPROVE & COMMIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Modify Membership dates */}
      {editingMembership && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 font-mono">
          <div className="bg-white border border-black rounded-none w-full max-w-md p-6 shadow-2xl text-black">
            <h3 className="text-xs font-black uppercase tracking-widest text-black mb-1">ADJUST MEMB TIMELINE</h3>
            <p className="text-black text-[10px] mb-4">
              Modify occupancy duration for roommate <strong className="text-black">{editingMembership.user.name}</strong>.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase font-black text-black mb-1.5">Joined Group At</label>
                <input
                  type="date"
                  value={membershipForm.joinedAt}
                  onChange={e => setMembershipForm({ ...membershipForm, joinedAt: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-none px-3 py-2 text-xs text-black focus:outline-none focus:border-black font-mono"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-black text-zinc-400 mb-1.5">Left Group At (Blank if active)</label>
                <input
                  type="date"
                  value={membershipForm.leftAt}
                  onChange={e => setMembershipForm({ ...membershipForm, leftAt: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-none px-3 py-2 text-xs text-black focus:outline-none focus:border-black font-mono"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setEditingMembership(null)}
                className="bg-white hover:bg-zinc-100 border border-black text-black font-bold text-xs px-4 py-2.5 rounded-none transition-all focus:outline-none cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveMembership}
                className="bg-white hover:bg-zinc-100 border border-black text-black font-black text-xs px-4 py-2.5 rounded-none transition-all focus:outline-none cursor-pointer"
              >
                SAVE TIMELINE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
