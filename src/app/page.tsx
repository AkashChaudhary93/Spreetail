'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  getClientState,
  resetDatabase,
  readOriginalCSVFile,
  importCSVData,
  deleteExpense,
  clearStaging,
  executeSettlement,
  resolveStagedExpense,
  updateMembershipDates,
} from '@/lib/clientStore';
import { calculateBalancesAndSettlements } from '@/lib/settlements';



// Helper to get initials and avatar styling (Groww-style colored theme)
function getAvatarStyles(name: string) {
  const clean = name.trim().toUpperCase();
  const initials = clean.slice(0, 2);
  let bgGradient = 'from-zinc-700 to-zinc-900 text-zinc-100';
  let borderGlow = 'border-zinc-700 shadow-[0_0_8px_rgba(113,113,122,0.15)]';

  if (clean.includes('AISHA')) {
    bgGradient = 'from-fuchsia-500/80 to-purple-600/95 text-white';
    borderGlow = 'border-purple-400/40 shadow-[0_0_12px_rgba(168,85,247,0.25)]';
  } else if (clean.includes('ROHAN')) {
    bgGradient = 'from-blue-500/80 to-indigo-600/95 text-white';
    borderGlow = 'border-blue-400/40 shadow-[0_0_12px_rgba(59,130,246,0.25)]';
  } else if (clean.includes('PRIYA')) {
    bgGradient = 'from-emerald-400/80 to-teal-600/95 text-white';
    borderGlow = 'border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]';
  } else if (clean.includes('MEERA')) {
    bgGradient = 'from-amber-400/80 to-orange-500/95 text-white';
    borderGlow = 'border-orange-400/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]';
  } else if (clean.includes('SAM')) {
    bgGradient = 'from-rose-500/80 to-red-650/95 text-white';
    borderGlow = 'border-red-400/40 shadow-[0_0_12px_rgba(239,68,68,0.25)]';
  } else if (clean.includes('DEV')) {
    bgGradient = 'from-violet-500/80 to-fuchsia-600/95 text-white';
    borderGlow = 'border-violet-400/40 shadow-[0_0_12px_rgba(139,92,246,0.25)]';
  } else if (clean.includes('KABIR')) {
    bgGradient = 'from-cyan-400/80 to-sky-600/95 text-white';
    borderGlow = 'border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]';
  }
  return { initials, bgGradient, borderGlow };
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'staged' | 'ledger' | 'settlements' | 'memberships'>('overview');
  const [stagedExpenses, setStagedExpenses] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [selectedUserAudit, setSelectedUserAudit] = useState<string | null>(null);
  
  // Chart states
  const [chartType, setChartType] = useState<'area' | 'line' | 'candlestick'>('area');
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

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

  // Fetch all data from localStorage
  const loadData = () => {
    try {
      const state = getClientState();
      setStagedExpenses(state.stagedExpenses);
      setExpenses(state.expenses);
      setMemberships(state.memberships);
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
      resetDatabase();
      loadData();
      setImportReport(null);
      setSelectedUserAudit(null);
    });
  };

  const handleLoadOriginalCSV = () => {
    setLoadingMsg('Reading expenses_export.csv...');
    startTransition(async () => {
      const content = readOriginalCSVFile();
      if (content) {
        setCsvInput(content);
        setLoadingMsg('Importing and scanning CSV...');
        const state = importCSVData(content);
        
        // Count statuses of the newly imported CSV lines
        // For simplicity, count status from state.stagedExpenses which has the imported rows at the beginning
        const count = content.split(/\r?\n/).filter(line => line.trim().length > 0).length - 1; // subtract header
        const newlyImported = state.stagedExpenses.slice(0, count > 0 ? count : 0);
        const approved = newlyImported.filter(r => r.status === 'APPROVED').length;
        const pending = newlyImported.filter(r => r.status === 'PENDING').length;
        
        setImportReport({
          success: true,
          count: count,
          approvedCount: approved,
          pendingCount: pending
        });
        loadData();
      } else {
        setImportReport({ success: false, error: 'Could not read CSV content' });
      }
    });
  };

  const handleManualImport = () => {
    if (!csvInput.trim()) return;
    setLoadingMsg('Importing and scanning CSV...');
    startTransition(async () => {
      const state = importCSVData(csvInput);
      const count = csvInput.split(/\r?\n/).filter(line => line.trim().length > 0).length - 1;
      const newlyImported = state.stagedExpenses.slice(0, count > 0 ? count : 0);
      const approved = newlyImported.filter(r => r.status === 'APPROVED').length;
      const pending = newlyImported.filter(r => r.status === 'PENDING').length;
      
      setImportReport({
        success: true,
        count: count,
        approvedCount: approved,
        pendingCount: pending
      });
      loadData();
    });
  };

  const handleDeleteExpense = (id: string) => {
    setLoadingMsg('Deleting expense...');
    startTransition(async () => {
      deleteExpense(id);
      loadData();
    });
  };

  const handleClearStaging = () => {
    if (!confirm('Are you sure you want to clear all pending staged expenses?')) return;
    setLoadingMsg('Purging staging queue...');
    startTransition(async () => {
      clearStaging();
      loadData();
    });
  };

  const handleExecuteSettlement = (from: string, to: string, amount: number, currency: string) => {
    setLoadingMsg(`Recording settlement: ${from} paid ${to}...`);
    startTransition(async () => {
      try {
        executeSettlement(from, to, amount, currency);
        loadData();
      } catch (err: any) {
        alert('Failed to execute settlement: ' + err.message);
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
      try {
        resolveStagedExpense(editingStaged.id, 'APPROVE', {
          ...editForm,
          split_type: editForm.split_type.toUpperCase()
        });
        setEditingStaged(null);
        setEditForm(null);
        loadData();
      } catch (err: any) {
        alert('Failed to approve: ' + err.message);
      }
    });
  };

  const handleRejectStaged = (id: string) => {
    setLoadingMsg('Rejecting staging record...');
    startTransition(async () => {
      resolveStagedExpense(id, 'REJECT');
      loadData();
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
      try {
        updateMembershipDates(
          editingMembership.id,
          membershipForm.joinedAt,
          membershipForm.leftAt || null
        );
        setEditingMembership(null);
        loadData();
      } catch (err: any) {
        alert('Failed to update: ' + err.message);
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
        <div className="h-64 border border-border-color bg-card-bg flex flex-col items-center justify-center text-zinc-500 font-mono text-xs select-none rounded shadow-inner">
          <svg className="w-8 h-8 text-zinc-600 mb-2 animate-pulse" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"/></svg>
          NO TRANSACTION DATA AVAILABLE FOR GRAPHING
        </div>
      );
    }

    // Calculate running total
    let total = 0;
    const points = sorted.map((e, idx) => {
      const prevTotal = total;
      total += Number(e.amount) * Number(e.exchangeRate);
      return {
        id: e.id,
        index: idx,
        time: new Date(e.dateIncurred).getTime(),
        displayDate: new Date(e.dateIncurred).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        value: total,
        prevValue: prevTotal,
        desc: e.description,
        amount: Number(e.amount) * Number(e.exchangeRate),
        payer: e.paidBy.name
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
      const prevY = paddingTop + chartHeight - (p.prevValue / maxVal) * chartHeight;
      return { x, y, prevY, ...p };
    });

    // Build the path string for Area/Line chart
    let pathD = `M ${svgPoints[0].x} ${svgPoints[0].y}`;
    for (let i = 1; i < svgPoints.length; i++) {
      pathD += ` L ${svgPoints[i].x} ${svgPoints[i].y}`;
    }

    // Build the filled area path string
    const fillD = `${pathD} L ${svgPoints[svgPoints.length - 1].x} ${paddingTop + chartHeight} L ${svgPoints[0].x} ${paddingTop + chartHeight} Z`;

    // Generate grid lines
    const gridDivisions = 6;
    const xGrids = Array.from({ length: gridDivisions }).map((_, idx) => {
      return paddingLeft + (idx / (gridDivisions - 1)) * chartWidth;
    });

    const yGrids = Array.from({ length: 4 }).map((_, idx) => {
      return paddingTop + (idx / 3) * chartHeight;
    });

    return (
      <div className="bg-card-bg border border-border-color p-5 rounded font-mono shadow-md relative">
        <div className="flex justify-between items-start mb-4 select-none">
          <div>
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">CUMULATIVE EXPENSE LEDGER VALUE</span>
            <div className="text-2xl font-black text-white mt-1 flex items-baseline gap-2 font-mono">
              {formatAmount(total)}
              <span className="text-[10px] text-primary font-bold bg-primary/10 border border-primary/20 rounded px-1.5 py-0.25">
                ACTIVE
              </span>
            </div>
          </div>
          
          {/* Tooltip Overlay */}
          <div className="h-10 flex flex-col justify-end text-right">
            {hoveredPoint ? (
              <div className="text-[10px] text-zinc-300">
                <span className="text-primary font-bold uppercase mr-1.5">{hoveredPoint.payer}</span>
                <span className="text-zinc-550 font-bold mr-1.5">{hoveredPoint.desc}</span>
                <span className="text-white font-black">{formatAmount(hoveredPoint.amount)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-zinc-900/40 border border-border-color px-2.5 py-1 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                <span className="text-[8.5px] text-zinc-400 font-bold uppercase tracking-wider">LIVE TICKER ACTIVE</span>
              </div>
            )}
          </div>
        </div>

        {/* SVG Canvas */}
        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto select-none overflow-visible"
            onMouseLeave={() => setHoveredPoint(null)}
          >
            {/* Gradients */}
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00d09c" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#00d09c" stopOpacity="0.0" />
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
                stroke="#1f222e"
                strokeWidth="1"
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
                stroke="#1f222e"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            ))}

            {/* Y-Axis Labels */}
            {yGrids.map((y, idx) => {
              const val = maxVal - (idx / 3) * maxVal;
              return (
                <text
                  key={`y-label-${idx}`}
                  x={paddingLeft - 10}
                  y={y + 3}
                  textAnchor="end"
                  fill="#787b86"
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
                fill="#787b86"
                fontSize="8.5"
                fontWeight="bold"
              >
                {p.displayDate}
              </text>
            ))}

            {/* Render Area/Line view */}
            {chartType === 'area' && (
              <>
                <path d={fillD} fill="url(#chartGradient)" />
                <path d={pathD} fill="none" stroke="#00d09c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}

            {chartType === 'line' && (
              <path d={pathD} fill="none" stroke="#00d09c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Render Candlestick view */}
            {chartType === 'candlestick' && (
              svgPoints.map((p, idx) => {
                const isGreen = p.amount >= 0;
                const bodyTop = Math.min(p.y, p.prevY);
                const bodyBottom = Math.max(p.y, p.prevY);
                const bodyHeight = Math.max(2, bodyBottom - bodyTop);
                const wickTop = bodyTop - bodyHeight * 0.3;
                const wickBottom = bodyBottom + bodyHeight * 0.15;
                const wickX = p.x;

                return (
                  <g key={`candle-${idx}`} className="cursor-pointer">
                    {/* Wick */}
                    <line
                      x1={wickX}
                      y1={wickTop}
                      x2={wickX}
                      y2={wickBottom}
                      stroke={isGreen ? '#26a69a' : '#ef5350'}
                      strokeWidth="1.5"
                    />
                    {/* Body */}
                    <rect
                      x={wickX - 3}
                      y={bodyTop}
                      width="6"
                      height={bodyHeight}
                      fill={isGreen ? '#26a69a' : '#ef5350'}
                      stroke={isGreen ? '#26a69a' : '#ef5350'}
                      strokeWidth="1"
                    />
                  </g>
                );
              })
            )}

            {/* Interactive Crosshairs & Highlight */}
            {hoveredPoint && (
              <g>
                {/* Vertical Crosshair */}
                <line
                  x1={hoveredPoint.x}
                  y1={paddingTop}
                  x2={hoveredPoint.x}
                  y2={paddingTop + chartHeight}
                  stroke="#787b86"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.6"
                />
                {/* Horizontal Crosshair */}
                <line
                  x1={paddingLeft}
                  y1={hoveredPoint.y}
                  x2={paddingLeft + chartWidth}
                  y2={hoveredPoint.y}
                  stroke="#787b86"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.6"
                />
                {/* Axis Value Indicators */}
                <rect
                  x={paddingLeft - 50}
                  y={hoveredPoint.y - 8}
                  width="45"
                  height="16"
                  fill="#1e222d"
                  stroke="#787b86"
                  strokeWidth="0.5"
                  rx="2"
                />
                <text
                  x={paddingLeft - 8}
                  y={hoveredPoint.y + 3}
                  textAnchor="end"
                  fill="#ffffff"
                  fontSize="8"
                  fontWeight="bold"
                >
                  {useUSD ? `$${(hoveredPoint.value / EXCHANGE_RATE).toFixed(0)}` : `₹${hoveredPoint.value.toFixed(0)}`}
                </text>
              </g>
            )}

            {/* Hover Circles triggers */}
            {svgPoints.map((p, idx) => (
              <circle
                key={`trigger-${idx}`}
                cx={p.x}
                cy={p.y}
                r="7"
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(p)}
              />
            ))}

            {/* Visible Data Dots */}
            {chartType !== 'candlestick' && svgPoints.map((p, idx) => {
              const isHovered = hoveredPoint && hoveredPoint.id === p.id;
              return (
                <circle
                  key={`dot-${idx}`}
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? "4" : "2"}
                  fill={isHovered ? "#ffffff" : "#00d09c"}
                  stroke={isHovered ? "#00d09c" : "transparent"}
                  strokeWidth={isHovered ? "2.5" : "0"}
                  className="transition-all pointer-events-none"
                  opacity={isHovered ? "1" : "0.75"}
                />
              );
            })}
          </svg>
        </div>

        {/* Interval and controls */}
        <div className="flex justify-between items-center border-t border-border-color mt-4 pt-3 text-[9px] select-none">
          <div className="flex gap-1.5">
            {['1D', '1M', '3M', '1Y', '5Y', 'ALL'].map(range => (
              <button
                key={range}
                className={`px-2 py-0.5 font-bold border rounded transition-colors cursor-pointer text-[9.5px] ${
                  range === 'ALL'
                    ? 'bg-primary/15 text-primary border-primary/30 shadow-[0_0_8px_rgba(0,208,156,0.1)]'
                    : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-300'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Chart Type Toggles */}
          <div className="flex items-center gap-1.5 bg-background px-2 py-1 border border-border-color rounded">
            <button
              onClick={() => setChartType('area')}
              className={`px-2 py-0.5 text-[8.5px] font-bold uppercase rounded transition-all cursor-pointer ${
                chartType === 'area' ? 'bg-zinc-800 text-primary shadow-sm' : 'text-zinc-550 hover:text-zinc-350'
              }`}
            >
              Area
            </button>
            <span className="text-zinc-800 text-[8px]">|</span>
            <button
              onClick={() => setChartType('line')}
              className={`px-2 py-0.5 text-[8.5px] font-bold uppercase rounded transition-all cursor-pointer ${
                chartType === 'line' ? 'bg-zinc-800 text-primary shadow-sm' : 'text-zinc-550 hover:text-zinc-350'
              }`}
            >
              Line
            </button>
            <span className="text-zinc-800 text-[8px]">|</span>
            <button
              onClick={() => setChartType('candlestick')}
              className={`px-2 py-0.5 text-[8.5px] font-bold uppercase rounded transition-all cursor-pointer ${
                chartType === 'candlestick' ? 'bg-zinc-800 text-primary shadow-sm' : 'text-zinc-550 hover:text-zinc-350'
              }`}
            >
              Candles
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-background text-foreground h-screen flex flex-col font-sans selection:bg-primary selection:text-black overflow-hidden">
      {/* Top Header */}
      <header className="h-14 border-b border-border-color px-6 flex items-center justify-between bg-card-bg shrink-0 select-none shadow-md">
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary border border-primary/30 text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded shadow-[0_0_12px_rgba(0,208,156,0.15)]">
            SPREETAIL
          </span>
          <h1 className="text-xs font-black tracking-widest uppercase text-white font-mono flex items-center gap-2">
            Shared Expenses Terminal <span className="text-[10px] text-primary/80 font-bold px-1.5 py-0.25 bg-primary/10 border border-primary/20 rounded">v1.1</span>
          </h1>
          <span className="text-border-color text-[10px] hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5 text-zinc-450 text-[9px] font-mono uppercase hidden sm:inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            <span>Ledger: Active Stream</span>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-3">
          {/* Currency Toggle */}
          <div className="border border-border-color px-2.5 py-1 bg-background/50 rounded flex items-center gap-2">
            <span className={`text-[9px] font-bold font-mono ${!useUSD ? 'text-primary' : 'text-zinc-500'}`}>INR</span>
            <button
              onClick={() => setUseUSD(!useUSD)}
              className="w-8 h-4 bg-zinc-800 border border-border-color rounded-full p-0.5 relative focus:outline-none cursor-pointer transition-colors hover:border-zinc-700"
            >
              <div
                className={`w-3 h-3 rounded-full bg-primary transition-transform shadow-[0_0_8px_rgba(0,208,156,0.4)] ${
                  useUSD ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-[9px] font-bold font-mono ${useUSD ? 'text-primary' : 'text-zinc-500'}`}>USD</span>
          </div>

          <button
            onClick={handleReset}
            disabled={isPending}
            className="border border-danger/30 hover:border-danger hover:bg-danger/10 text-danger text-[9px] font-bold px-3 py-1.5 rounded bg-transparent transition-all disabled:opacity-50 cursor-pointer uppercase tracking-wider"
          >
            RESET
          </button>
          
          <button
            onClick={handleLoadOriginalCSV}
            disabled={isPending}
            className="bg-primary hover:bg-primary-hover border border-transparent text-black text-[9px] font-black px-3.5 py-1.5 rounded transition-all disabled:opacity-50 cursor-pointer uppercase tracking-wider shadow-[0_0_12px_rgba(0,208,156,0.2)]"
          >
            IMPORT CSV
          </button>
        </div>
      </header>

      {/* Global Loading overlay */}
      {isPending && (
        <div className="fixed inset-0 bg-background/85 backdrop-blur-md flex flex-col items-center justify-center z-50">
          <div className="animate-spin h-10 w-10 border-2 border-primary/20 border-t-primary rounded-full mb-3 shadow-[0_0_15px_rgba(0,208,156,0.25)]"></div>
          <p className="text-primary font-black text-[10px] font-mono uppercase tracking-widest animate-pulse">{loadingMsg}</p>
        </div>
      )}

      {/* Main split dashboard pane */}
      <div className="flex-1 flex overflow-hidden bg-background">
        {/* Left Side: Workspace */}
        <main className="flex-1 flex flex-col overflow-y-auto px-6 py-5 bg-background">
          {/* Navigation tabs styled as TradingView pills */}
          <div className="mb-5 flex overflow-x-auto gap-2 shrink-0 scrollbar-none select-none">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-1.5 font-bold text-[10px] tracking-wider uppercase rounded border transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-primary/15 text-primary border-primary font-black shadow-[0_0_10px_rgba(0,208,156,0.15)]'
                  : 'bg-[#1e222d]/40 text-zinc-400 border-border-color hover:border-zinc-700 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('staged')}
              className={`px-4 py-1.5 font-bold text-[10px] tracking-wider uppercase rounded border transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'staged'
                  ? 'bg-primary/15 text-primary border-primary font-black shadow-[0_0_10px_rgba(0,208,156,0.15)]'
                  : 'bg-[#1e222d]/40 text-zinc-400 border-border-color hover:border-zinc-700 hover:text-white'
              }`}
            >
              Staged Buffer
              {stagedExpenses.filter(s => s.status === 'PENDING').length > 0 && (
                <span className={`text-[8.5px] px-1.5 py-0.25 font-bold rounded border ${
                  activeTab === 'staged' ? 'bg-primary text-black border-transparent shadow-[0_0_6px_rgba(0,208,156,0.3)]' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}>
                  {stagedExpenses.filter(s => s.status === 'PENDING').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-4 py-1.5 font-bold text-[10px] tracking-wider uppercase rounded border transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'ledger'
                  ? 'bg-primary/15 text-primary border-primary font-black shadow-[0_0_10px_rgba(0,208,156,0.15)]'
                  : 'bg-[#1e222d]/40 text-zinc-400 border-border-color hover:border-zinc-700 hover:text-white'
              }`}
            >
              Ledger Audit
              <span className={`text-[8.5px] px-1.5 py-0.25 font-bold rounded border ${
                activeTab === 'ledger' ? 'bg-primary text-black border-transparent shadow-[0_0_6px_rgba(0,208,156,0.3)]' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}>
                {expenses.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('settlements')}
              className={`px-4 py-1.5 font-bold text-[10px] tracking-wider uppercase rounded border transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'settlements'
                  ? 'bg-primary/15 text-primary border-primary font-black shadow-[0_0_10px_rgba(0,208,156,0.15)]'
                  : 'bg-[#1e222d]/40 text-zinc-400 border-border-color hover:border-zinc-700 hover:text-white'
              }`}
            >
              Cash Settlements
              {settlements.length > 0 && (
                <span className={`text-[8.5px] px-1.5 py-0.25 font-bold rounded border ${
                  activeTab === 'settlements' ? 'bg-primary text-black border-transparent shadow-[0_0_6px_rgba(0,208,156,0.3)]' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}>
                  {settlements.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('memberships')}
              className={`px-4 py-1.5 font-bold text-[10px] tracking-wider uppercase rounded border transition-all cursor-pointer ${
                activeTab === 'memberships'
                  ? 'bg-primary/15 text-primary border-primary font-black shadow-[0_0_10px_rgba(0,208,156,0.15)]'
                  : 'bg-[#1e222d]/40 text-zinc-400 border-border-color hover:border-zinc-700 hover:text-white'
              }`}
            >
              Timeline
            </button>
          </div>

          {/* Import report */}
          {importReport && (
            <div className={`mb-5 p-4 border rounded bg-card-bg shadow-sm ${
              importReport.success ? 'border-primary/20 text-primary bg-primary/5' : 'border-danger/20 text-danger bg-danger/5'
            }`}>
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                {importReport.success ? '✓ PARSE SUCCESSFUL' : '⚠ SCAN FAILURE'}
              </h3>
              {importReport.success ? (
                <p className="text-[11px] mt-1 text-zinc-350 leading-normal font-mono">
                  Parsed <strong className="text-white font-black">{importReport.count}</strong> rows. Committed: {importReport.approvedCount} | Staged: {importReport.pendingCount}
                </p>
              ) : (
                <p className="text-[11px] mt-1 text-danger/80">{importReport.error}</p>
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
                        className="p-3.5 border rounded cursor-pointer hover:border-primary/30 hover:shadow-[0_0_15px_rgba(0,208,156,0.08)] transition-all bg-card-bg border-border-color flex flex-col gap-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 bg-gradient-to-br ${bgGradient} border ${borderGlow} flex items-center justify-center text-[9px] font-bold uppercase rounded-sm`}>
                            {initials}
                          </div>
                          <span className="text-[10px] font-black text-zinc-400 tracking-wider uppercase truncate">{b.name}</span>
                        </div>

                        <div className="mt-1">
                          <div className="text-xs font-mono font-black text-white truncate">
                            {formatAmount(Math.abs(b.netBalance))}
                          </div>
                          <div className={`text-[8.5px] font-mono font-bold mt-0.5 ${
                            isPositive ? 'text-primary' : isNegative ? 'text-danger' : 'text-zinc-500'
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
                <div className="bg-card-bg border border-border-color p-5 rounded">
                  <div className="flex justify-between items-center mb-4 select-none">
                    <h2 className="text-xs font-black uppercase tracking-wider text-white font-mono">Recent Transactions Feed</h2>
                    <button
                      onClick={() => setActiveTab('ledger')}
                      className="text-[9px] text-zinc-350 hover:text-white border border-border-color hover:border-zinc-550 px-3 py-1.5 font-bold cursor-pointer bg-background rounded transition-all"
                    >
                      VIEW FULL LEDGER
                    </button>
                  </div>

                  {expenses.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-border-color rounded">
                      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider font-mono">No transaction history found.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border-color">
                      {expenses.slice(0, 5).map(exp => {
                        const paidInBase = Number(exp.amount) * Number(exp.exchangeRate);
                        return (
                          <div key={exp.id} className="py-3 flex items-center justify-between text-xs font-mono hover:bg-white/2 px-2 rounded transition-colors">
                            <div className="flex items-center">
                              <span className="text-zinc-500 mr-3">{new Date(exp.dateIncurred).toISOString().slice(5, 10)}</span>
                              <span className="font-bold text-white uppercase">{exp.description}</span>
                              <span className="text-zinc-400 ml-2">by {exp.paidBy.name}</span>
                            </div>
                            <div className="text-right font-black text-white font-mono">
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
                <div className="bg-card-bg border border-border-color p-5 rounded shadow-md">
                  <div className="flex justify-between items-center mb-2.5">
                    <h2 className="text-xs font-black uppercase tracking-wider text-white">Paste raw CSV data</h2>
                    <span className="text-[9px] text-zinc-550 font-mono">HEADER IDENTIFIER RUNNING</span>
                  </div>
                  <textarea
                    value={csvInput}
                    onChange={e => setCsvInput(e.target.value)}
                    placeholder="date,description,paid_by,amount,currency,split_type,split_with,split_details,notes"
                    rows={4}
                    className="w-full bg-background border border-border-color rounded p-3 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-primary transition-all resize-none"
                  />
                  <div className="mt-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <span className="text-[9.5px] text-zinc-500 font-mono">
                      Format: date | description | paid_by | amount | currency | split_type | split_with
                    </span>
                    <button
                      onClick={handleManualImport}
                      disabled={isPending || !csvInput.trim()}
                      className="bg-primary hover:bg-primary-hover border border-transparent text-black font-black text-xs px-4.5 py-2.5 rounded transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_12px_rgba(0,208,156,0.15)]"
                    >
                      SCAN & STREAM
                    </button>
                  </div>
                </div>

                {/* Staging Quarantine list */}
                <div className="bg-card-bg border border-border-color p-5 rounded shadow-md">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
                    <div>
                      <h2 className="text-xs font-black uppercase tracking-wider text-white">Quarantined Records Queue</h2>
                      <p className="text-zinc-400 text-[10px] mt-0.5 font-mono">
                        Items requiring manual review due to formatting anomalies or membership date bounds.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto select-none">
                      {stagedExpenses.filter(s => s.status === 'PENDING').length > 0 && (
                        <button
                          onClick={handleClearStaging}
                          className="bg-transparent hover:bg-danger/10 border border-danger/30 hover:border-danger text-danger font-bold text-[10px] px-3.5 py-1.5 rounded transition-all focus:outline-none cursor-pointer"
                        >
                          Clear All
                        </button>
                      )}
                      <div className="text-[10px] bg-zinc-900 border border-border-color px-3 py-1.5 text-zinc-400 font-bold rounded">
                        Pending: {stagedExpenses.filter(s => s.status === 'PENDING').length}
                      </div>
                    </div>
                  </div>

                  {stagedExpenses.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border-color rounded">
                      <p className="text-zinc-550 text-[10px] font-bold uppercase tracking-wider font-mono">No staged items in quarantine buffer.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-border-color text-zinc-400 font-bold uppercase tracking-wider">
                            <th className="pb-2.5 pr-2 font-mono">Date</th>
                            <th className="pb-2.5 px-3">Description</th>
                            <th className="pb-2.5 px-3">Payer</th>
                            <th className="pb-2.5 px-3">Amount</th>
                            <th className="pb-2.5 px-3">Anomaly Diagnostics</th>
                            <th className="pb-2.5 px-3">Status</th>
                            <th className="pb-2.5 pl-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-color/20">
                          {stagedExpenses.map(staged => {
                            const hasAnomalies = staged.anomalies.length > 0;
                            return (
                              <tr key={staged.id} className="hover:bg-white/2 transition-colors border-b border-border-color/10">
                                <td className="py-3 pr-2 font-mono text-zinc-550">{staged.dateRaw}</td>
                                <td className="py-3 px-3">
                                  <div className="font-bold text-white text-xs uppercase">{staged.description}</div>
                                  {staged.notesRaw && (
                                    <div className="text-[9.5px] text-zinc-500 italic mt-0.5 max-w-xs truncate" title={staged.notesRaw}>
                                      {staged.notesRaw}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-zinc-300">
                                  {staged.paidByRaw ? (
                                    <span className="font-bold uppercase">{staged.paidByRaw}</span>
                                  ) : (
                                    <span className="text-danger font-bold italic bg-danger/10 border border-danger/20 px-2 py-0.5 rounded text-[10px]">missing</span>
                                  )}
                                </td>
                                <td className="py-3 px-3 font-bold font-mono text-zinc-350">
                                  {staged.amountRaw} {staged.currencyRaw || 'INR'}
                                </td>
                                <td className="py-3 px-3 max-w-xs">
                                  <div className="flex flex-wrap gap-1">
                                    {staged.anomalies.map((a: string, idx: number) => (
                                      <span
                                        key={`${a}-${idx}`}
                                        title={JSON.stringify(staged.anomalyDetails)}
                                        className="bg-danger/10 text-danger border border-danger/30 text-[8.5px] font-bold px-2 py-0.5 rounded uppercase tracking-wide font-mono"
                                      >
                                        {a.replace(/_/g, ' ')}
                                      </span>
                                    ))}
                                    {!hasAnomalies && (
                                      <span className="bg-primary/10 text-primary border border-primary/20 text-[8.5px] px-2 py-0.5 rounded font-bold uppercase font-mono">
                                        CLEAN
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <span className={`text-[9px] font-bold uppercase tracking-wider ${
                                    staged.status === 'PENDING'
                                      ? 'text-primary underline decoration-dotted'
                                      : 'text-zinc-500'
                                  }`}>
                                    {staged.status}
                                  </span>
                                </td>
                                <td className="py-3 pl-3 text-right">
                                  {staged.status === 'PENDING' ? (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => startReview(staged)}
                                        className="bg-primary hover:bg-primary-hover text-black font-black text-[9.5px] px-3 py-1.5 rounded transition-all focus:outline-none cursor-pointer"
                                      >
                                        Review
                                      </button>
                                      <button
                                        onClick={() => handleRejectStaged(staged.id)}
                                        className="bg-transparent hover:bg-danger/10 text-danger border border-danger/20 hover:border-danger font-extrabold text-[9.5px] px-2.5 py-1.5 rounded transition-all focus:outline-none cursor-pointer"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[9px] text-zinc-500 font-mono uppercase">PROCESSED</span>
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
                  <div className="bg-card-bg border border-primary/20 p-4 rounded flex items-center justify-between gap-4 shadow-[0_0_12px_rgba(0,208,156,0.05)]">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2 font-mono">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_#00d09c]"></span>
                        Audit trail active: {selectedUserAudit}
                      </h3>
                      <p className="text-zinc-400 text-[10px] mt-0.5 font-mono">
                        Filtering records where {selectedUserAudit} is the payer or debtor.
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedUserAudit(null)}
                      className="bg-primary hover:bg-primary-hover text-black text-[10px] font-bold px-3.5 py-1.5 rounded transition-all cursor-pointer font-mono"
                    >
                      Clear Audit Filter
                    </button>
                  </div>
                )}

                <div className="bg-card-bg border border-border-color p-5 rounded shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h2 className="text-xs font-black uppercase tracking-wider text-white">
                      {selectedUserAudit ? `${selectedUserAudit}'s Transaction Audit` : 'Active Expense Ledger'}
                    </h2>
                    <div className="w-full sm:max-w-xs relative select-none">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Filter description, payer..."
                        className="w-full bg-background border border-border-color rounded px-3 py-1.5 text-xs text-white placeholder-zinc-550 focus:outline-none focus:border-primary transition-all font-mono"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1.5 text-zinc-500 hover:text-white focus:outline-none text-xs cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {filteredLedger.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border-color rounded">
                      <p className="text-zinc-550 text-[10px] font-bold uppercase tracking-wider font-mono">No ledger entries matching query.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-border-color text-zinc-450 font-bold uppercase tracking-wider">
                            <th className="pb-2.5 pr-2 font-mono">Date</th>
                            <th className="pb-2.5 px-3">Description</th>
                            <th className="pb-2.5 px-3">Paid By</th>
                            <th className="pb-2.5 px-3">Total Amount</th>
                            <th className="pb-2.5 px-3 font-mono">Type</th>
                            <th className="pb-2.5 px-3">Splits Breakdown</th>
                            {selectedUserAudit && <th className="pb-2.5 px-3">User Share</th>}
                            <th className="pb-2.5 pl-3 text-right">Delete</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-color/10">
                          {filteredLedger.map(exp => {
                            const paidInBase = Number(exp.amount) * Number(exp.exchangeRate);
                            const isSettlement = exp.isSettlement;
                            const auditUserSplit = exp.splits.find((s: any) => s.user.name === selectedUserAudit);
                            const auditUserShareInBase = auditUserSplit ? Number(auditUserSplit.amount) * Number(exp.exchangeRate) : 0;
                            const wasAuditUserPayer = exp.paidBy.name === selectedUserAudit;

                            return (
                              <tr key={exp.id} className="hover:bg-white/2 transition-colors border-b border-border-color/5">
                                <td className="py-3 pr-2 font-mono text-zinc-500">
                                  {new Date(exp.dateIncurred).toISOString().slice(0, 10)}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white text-xs uppercase">{exp.description}</span>
                                    {isSettlement && (
                                      <span className="bg-primary/10 text-primary border border-primary/25 text-[8.5px] px-2 py-0.5 rounded font-bold uppercase font-mono">
                                        SETTLEMENT
                                      </span>
                                    )}
                                    {exp.amount < 0 && (
                                      <span className="bg-danger/10 text-danger border border-danger/25 text-[8.5px] px-2 py-0.5 rounded font-bold uppercase font-mono">
                                        REFUND
                                      </span>
                                    )}
                                  </div>
                                  {exp.notes && <div className="text-[9.5px] text-zinc-500 italic mt-0.5">{exp.notes}</div>}
                                </td>
                                <td className="py-3 px-3 text-zinc-300 font-bold uppercase">{exp.paidBy.name}</td>
                                <td className="py-3 px-3 font-bold font-mono text-white text-xs">
                                  <div>{formatAmount(paidInBase)}</div>
                                  {exp.currency.toUpperCase() !== 'INR' && (
                                    <div className="text-[9px] text-zinc-500 font-normal mt-0.5 font-mono">
                                      {exp.amount} {exp.currency} @ {exp.exchangeRate}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 capitalize text-zinc-400 font-mono">{exp.splitType.toLowerCase()}</td>
                                <td className="py-3 px-3">
                                  <div className="max-w-xs flex flex-wrap gap-1">
                                    {exp.splits.map((s: any) => {
                                      const splitAmtInBase = Number(s.amount) * Number(exp.exchangeRate);
                                      return (
                                        <span
                                          key={s.id}
                                          className={`text-[9px] font-bold px-1.5 py-0.25 rounded border font-mono ${
                                            selectedUserAudit === s.user.name
                                              ? 'bg-primary/15 text-primary border-primary/45 shadow-[0_0_8px_rgba(0,208,156,0.15)] font-black'
                                              : 'bg-zinc-900 border-border-color text-zinc-400'
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
                                        <span className="text-primary font-bold">
                                          PAID: +{formatAmount(paidInBase)}
                                        </span>
                                      )}
                                      {auditUserSplit && (
                                        <span className="text-danger font-bold">
                                          OWED: -{formatAmount(auditUserShareInBase)}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}
                                <td className="py-3 pl-3 text-right">
                                  <button
                                    onClick={() => handleDeleteExpense(exp.id)}
                                    className="text-zinc-500 hover:text-danger transition-colors focus:outline-none p-1 cursor-pointer"
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
                <div className="bg-card-bg border border-border-color p-5 rounded shadow-md">
                  <h2 className="text-xs font-black uppercase tracking-wider mb-1 text-white">Debt settlements minimization</h2>
                  <p className="text-zinc-400 text-[10px] mb-4 font-mono">
                    Optimized cash flow instructions calculated to balance roommates net credit using the fewest transactions.
                  </p>

                  {settlements.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border-color rounded">
                      <p className="text-zinc-550 text-[10px] font-bold uppercase tracking-wider font-mono">ledger is fully balanced. no payments required.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {settlements.map((tx, idx) => (
                        <div
                          key={idx}
                          className="border border-border-color p-4 rounded flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-background hover:border-zinc-700 transition-colors shadow-sm"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-extrabold text-white bg-zinc-900 border border-border-color px-2.5 py-1 text-xs rounded uppercase">
                              {tx.from}
                            </span>
                            <span className="text-primary font-black text-[9px] uppercase tracking-wider font-mono">pays</span>
                            <span className="font-extrabold text-white bg-zinc-900 border border-border-color px-2.5 py-1 text-xs rounded uppercase">
                              {tx.to}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between sm:justify-end gap-3.5 font-mono">
                            <div className="text-sm font-black text-white">
                              {formatAmount(tx.amount)}
                            </div>
                            <button
                              onClick={() => handleExecuteSettlement(tx.from, tx.to, tx.amount, tx.currency)}
                              className="bg-primary hover:bg-primary-hover text-black font-black text-[9.5px] px-3.5 py-2 rounded transition-all focus:outline-none cursor-pointer shadow-[0_0_10px_rgba(0,208,156,0.15)]"
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
              <div className="bg-card-bg border border-border-color p-5 rounded font-mono shadow-md">
                <h2 className="text-xs font-black uppercase tracking-wider mb-1 text-white">Group timeline occupancy</h2>
                <p className="text-zinc-400 text-[10px] mb-5">
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
                      <div key={m.id} className="grid grid-cols-12 items-center gap-3 border-b border-border-color/20 pb-4 last:border-0 last:pb-0">
                        <div className="col-span-3 flex items-center gap-2.5">
                          <div className={`w-7 h-7 bg-gradient-to-br ${bgGradient} border ${borderGlow} flex items-center justify-center text-[9px] font-bold text-white uppercase rounded shrink-0`}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-white text-xs truncate block uppercase">{m.user.name}</span>
                            <span className={`inline-block text-[7px] font-black uppercase tracking-wider mt-0.5 px-1.5 py-0.25 border rounded ${
                              isActiveNow
                                ? 'bg-primary/15 text-primary border-primary/20 shadow-[0_0_8px_rgba(0,208,156,0.1)]'
                                : 'bg-zinc-900 text-zinc-550 border-border-color'
                            }`}>
                              {isActiveNow ? 'Active' : m.user.name === 'Dev' || m.user.name === 'Kabir' ? 'Visitor' : 'Former'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="col-span-7 bg-background h-3 rounded relative overflow-hidden border border-border-color">
                          <div
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            className={`absolute top-0 bottom-0 transition-all duration-350 rounded-sm ${
                              isActiveNow
                                ? 'bg-primary/25 border-l border-r border-primary/50 shadow-[0_0_8px_rgba(0,208,156,0.15)]'
                                : 'bg-zinc-800 border-l border-r border-border-color'
                            }`}
                          ></div>
                        </div>
                        
                        <div className="col-span-2 text-right">
                          <button
                            onClick={() => startEditMembership(m)}
                            className="bg-transparent hover:bg-primary/10 border border-primary/20 hover:border-primary text-primary text-[9px] font-bold px-2.5 py-1.5 rounded transition-all cursor-pointer font-mono"
                          >
                            EDIT DATES
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-3 border-t border-border-color/30 grid grid-cols-12 text-[8px] text-zinc-550 font-bold font-mono uppercase pl-[25%] pr-[16.6%] select-none">
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
        <aside className="w-80 border-l border-border-color bg-card-bg flex flex-col overflow-y-auto px-5 py-5 shrink-0 select-none shadow-lg">
          <div className="flex items-center justify-between pb-3.5 border-b border-border-color mb-4">
            <span className="text-xs font-black uppercase tracking-widest text-white font-mono">
              Roommate Registry
            </span>
            <span className="text-[9px] text-zinc-550 font-mono uppercase font-bold">
              {balances.length} Flatmates
            </span>
          </div>

          {selectedUserAudit && (
            <div className="mb-4 bg-background border border-primary/20 p-3 rounded font-mono shadow-[0_0_12px_rgba(0,208,156,0.05)]">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold uppercase text-primary">LEDGER FILTER RUNNING</span>
                <button
                  onClick={() => setSelectedUserAudit(null)}
                  className="text-primary hover:text-white text-[9px] font-bold focus:outline-none cursor-pointer transition-colors"
                >
                  CLEAR
                </button>
              </div>
              <div className="text-xs font-black text-white mt-1 uppercase tracking-wider">
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
                  className={`p-3 border rounded transition-all duration-150 cursor-pointer flex flex-col gap-2 ${
                    isFiltered
                      ? 'bg-background border-primary shadow-[0_0_12px_rgba(0,208,156,0.1)]'
                      : 'bg-background border-border-color hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 bg-gradient-to-br ${bgGradient} border ${borderGlow} flex items-center justify-center text-[9px] font-bold text-white uppercase rounded shrink-0`}>
                        {initials}
                      </div>
                      <span className="text-xs font-black text-white uppercase tracking-wider">{b.name}</span>
                    </div>

                    <div className="text-right">
                      <div className={`text-xs font-mono font-black ${
                        isPositive ? 'text-primary' : isNegative ? 'text-danger' : 'text-zinc-500'
                      }`}>
                        {isPositive ? '↑ ' : isNegative ? '↓ ' : ''}
                        {formatAmount(Math.abs(b.netBalance))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 text-[9px] text-zinc-500 border-t border-border-color pt-2 font-mono">
                    <div>PAID: {useUSD ? `$${(b.totalPaid/EXCHANGE_RATE).toFixed(0)}` : `₹${b.totalPaid.toFixed(0)}`}</div>
                    <div className="text-right">OWED: {useUSD ? `$${(b.totalOwed/EXCHANGE_RATE).toFixed(0)}` : `₹${b.totalOwed.toFixed(0)}`}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick diagnostics statistics */}
          <div className="mt-auto pt-6 border-t border-border-color">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-primary mb-3 font-mono">
              SYSTEM STATISTICS
            </h4>
            <div className="space-y-2 text-[9px] font-mono text-zinc-500">
              <div className="flex justify-between">
                <span>TOTAL EXPORTED:</span>
                <span className="text-white font-bold">{expenses.length + stagedExpenses.length} ROWS</span>
              </div>
              <div className="flex justify-between">
                <span>ACTIVE LEDGER:</span>
                <span className="text-white font-bold">{expenses.length} ROWS</span>
              </div>
              <div className="flex justify-between">
                <span>STAGED AUDITS:</span>
                <span className="text-white font-bold">{stagedExpenses.filter(s => s.status === 'PENDING').length} ROWS</span>
              </div>
              <div className="flex justify-between">
                <span>SETTLEMENTS DUE:</span>
                <span className="text-white font-bold">{settlements.length} CHECKS</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* MODAL 1: Resolve staged expense */}
      {editingStaged && editForm && (
        <div className="fixed inset-0 bg-[#0b0e14]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto font-mono">
          <div className="bg-card-bg border border-border-color rounded w-full max-w-lg p-6 shadow-2xl relative my-8 text-foreground">
            <h3 className="text-xs font-black uppercase tracking-widest text-white mb-2">RECONCILE & COMMIT STAGED TRANSACTION</h3>
            <p className="text-zinc-400 text-[10px] mb-4">
              Correct data anomalies and memberships mismatch before saving into ledger.
            </p>

            {/* List of anomalies in modal */}
            <div className="mb-5 bg-background border border-border-color p-3.5 rounded">
              <div className="text-[8.5px] font-black uppercase text-zinc-500 tracking-widest">ANOMALIES DIAGNOSED:</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {editingStaged.anomalies.map((a: string, idx: number) => (
                  <span key={`${a}-${idx}`} className="bg-danger/10 text-danger border border-danger/30 text-[8.5px] font-bold px-2 py-0.5 rounded uppercase font-mono">
                    {a.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
              <div className="text-[10px] text-zinc-400 mt-2.5 leading-relaxed">
                {Object.keys(editingStaged.anomalyDetails).map(k => (
                  <div key={k}>• {editingStaged.anomalyDetails[k]}</div>
                ))}
              </div>
            </div>

            {/* Edit Fields Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9.5px] uppercase font-black text-zinc-500 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full bg-background border border-border-color rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] uppercase font-black text-zinc-500 mb-1.5">Description</label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full bg-background border border-border-color rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[9.5px] uppercase font-black text-zinc-500 mb-1.5">Payer</label>
                  <select
                    value={editForm.paid_by}
                    onChange={e => setEditForm({ ...editForm, paid_by: e.target.value })}
                    className="w-full bg-background border border-border-color rounded px-2 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    <option value="">Select Payer</option>
                    {memberships.map(m => (
                      <option key={m.user.id} value={m.user.name}>{m.user.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9.5px] uppercase font-black text-zinc-500 mb-1.5">Amount</label>
                  <input
                    type="number"
                    value={editForm.amount}
                    onChange={e => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-background border border-border-color rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] uppercase font-black text-zinc-500 mb-1.5">Currency</label>
                  <select
                    value={editForm.currency}
                    onChange={e => setEditForm({ ...editForm, currency: e.target.value })}
                    className="w-full bg-background border border-border-color rounded px-2 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9.5px] uppercase font-black text-zinc-500 mb-1.5">Split Type</label>
                <select
                  value={editForm.split_type}
                  onChange={e => setEditForm({ ...editForm, split_type: e.target.value })}
                  className="w-full bg-background border border-border-color rounded px-2 py-2 text-xs text-white focus:outline-none focus:border-primary"
                >
                  <option value="equal">Equal</option>
                  <option value="percentage">Percentage</option>
                  <option value="share">Share</option>
                  <option value="unequal">Unequal</option>
                </select>
              </div>

              <div>
                <label className="block text-[9.5px] uppercase font-black text-zinc-500 mb-1.5">Split With Members</label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {memberships.map(m => {
                    const isChecked = editForm.split_with.includes(m.user.name);
                    return (
                      <label key={m.user.id} className="flex items-center gap-2 bg-background border border-border-color p-2 rounded cursor-pointer hover:bg-white/2 transition-colors">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const updated = isChecked
                              ? editForm.split_with.filter(name => name !== m.user.name)
                              : [...editForm.split_with, m.user.name];
                            setEditForm({ ...editForm, split_with: updated });
                          }}
                          className="rounded text-primary focus:ring-primary bg-background border-border-color"
                        />
                        <span className="text-[10px] font-semibold text-white uppercase">{m.user.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {editForm.split_type !== 'equal' && (
                <div>
                  <label className="block text-[9.5px] uppercase font-black text-zinc-500 mb-1.5">Split Details / Shares / Percentages</label>
                  <input
                    type="text"
                    value={editForm.split_details}
                    onChange={e => setEditForm({ ...editForm, split_details: e.target.value })}
                    placeholder="e.g. Aisha 30%; Rohan 30%; Priya 40%"
                    className="w-full bg-background border border-border-color rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-mono"
                  />
                  <span className="text-[9px] text-zinc-500 mt-1 block font-mono">
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
                className="bg-transparent hover:bg-white/5 border border-border-color text-zinc-450 hover:text-white font-bold text-xs px-4.5 py-2.5 rounded transition-all focus:outline-none cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={handleApproveEdit}
                className="bg-primary hover:bg-primary-hover border border-transparent text-black font-black text-xs px-4.5 py-2.5 rounded transition-all focus:outline-none cursor-pointer shadow-[0_0_12px_rgba(0,208,156,0.15)]"
              >
                APPROVE & COMMIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Modify Membership dates */}
      {editingMembership && (
        <div className="fixed inset-0 bg-[#0b0e14]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 font-mono">
          <div className="bg-card-bg border border-border-color rounded w-full max-w-md p-6 shadow-2xl text-foreground">
            <h3 className="text-xs font-black uppercase tracking-widest text-white mb-1">ADJUST MEMB TIMELINE</h3>
            <p className="text-zinc-400 text-[10px] mb-4">
              Modify occupancy duration for roommate <strong className="text-primary uppercase">{editingMembership.user.name}</strong>.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[9.5px] uppercase font-black text-zinc-500 mb-1.5">Joined Group At</label>
                <input
                  type="date"
                  value={membershipForm.joinedAt}
                  onChange={e => setMembershipForm({ ...membershipForm, joinedAt: e.target.value })}
                  className="w-full bg-background border border-border-color rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-mono"
                />
              </div>
              <div>
                <label className="block text-[9.5px] uppercase font-black text-zinc-500 mb-1.5">Left Group At (Blank if active)</label>
                <input
                  type="date"
                  value={membershipForm.leftAt}
                  onChange={e => setMembershipForm({ ...membershipForm, leftAt: e.target.value })}
                  className="w-full bg-background border border-border-color rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setEditingMembership(null)}
                className="bg-transparent hover:bg-white/5 border border-border-color text-zinc-450 hover:text-white font-bold text-xs px-4.5 py-2.5 rounded transition-all focus:outline-none cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveMembership}
                className="bg-primary hover:bg-primary-hover border border-transparent text-black font-black text-xs px-4.5 py-2.5 rounded transition-all focus:outline-none cursor-pointer shadow-[0_0_12px_rgba(0,208,156,0.15)]"
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
