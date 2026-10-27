import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  FileDown,
  Trash2,
  Calendar,
  User,
  Building2,
  FileText,
  CreditCard,
  ArrowLeft,
  Filter,
  Check,
  X,
  AlertCircle,
  Eye,
  Layers,
  SlidersHorizontal,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

export const PaymentCentralView = () => {
  const { user, role, organization } = useAuth();

  // Current date for disabling future dates
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Super Admin & Admin permission check
  const canChangeStatus =
    role === 'ORG_ADMIN' ||
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN' ||
    role === 'PROJECT_MANAGER' ||
    user?.is_superuser;

  // View mode: 'list' (Screenshot 1) | 'record' (Screenshot 2)
  const [viewMode, setViewMode] = useState('list');

  // Master data
  const [transactions, setTransactions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search (Matches Screenshot 1)
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('2026-06-01');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterAdmin, setFilterAdmin] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [displayLayout, setDisplayLayout] = useState('table'); // 'table' | 'cards'

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Record Transaction Form State (Matches Screenshot 2)
  const [submitting, setSubmitting] = useState(false);
  const [recordForm, setRecordForm] = useState({
    type: 'outgoing', // 'incoming' | 'outgoing'
    category: 'other', // 'salary' | 'vendor' | 'client' | 'site_cost' | 'expense_reimbursement' | 'other'
    date: new Date().toISOString().split('T')[0],
    party_name: '',
    description: '',
    amount: '',
    method: 'cash', // 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other'
    status: 'completed', // 'completed' | 'pending' | 'failed'
  });

  // Load transactions and master entities
  const loadData = async () => {
    setLoading(true);
    try {
      const [txnRes, empRes, projRes, venRes] = await Promise.all([
        api.transactions.list(),
        api.workforce.listEmployees({ page_size: 1000 }).catch(() => []),
        api.projects.list().catch(() => []),
        api.expenses.listVendors().catch(() => []),
      ]);

      const txns = Array.isArray(txnRes) ? txnRes : txnRes?.results || [];
      setTransactions(txns);
      setEmployees(Array.isArray(empRes) ? empRes : empRes?.results || []);
      setProjects(Array.isArray(projRes) ? projRes : projRes?.results || []);
      setVendors(Array.isArray(venRes) ? venRes : venRes?.results || []);
    } catch (err) {
      console.error('Failed to load transaction ledger', err);
      toast.error('Failed to load transaction ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Date range
      if (fromDate && t.date && t.date < fromDate) return false;
      if (toDate && t.date && t.date > toDate) return false;

      // Type filter
      if (filterType !== 'all' && t.type?.toLowerCase() !== filterType.toLowerCase()) {
        return false;
      }

      // Status filter
      if (filterStatus !== 'all' && t.status?.toLowerCase() !== filterStatus.toLowerCase()) {
        return false;
      }

      // Employee / Payee filter
      if (filterEmployee !== 'all' && t.payee_name !== filterEmployee) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          t.transaction_id?.toLowerCase().includes(q) ||
          t.payee_name?.toLowerCase().includes(q) ||
          t.payer_name?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [transactions, fromDate, toDate, filterType, filterStatus, filterEmployee, searchQuery]);

  // Aggregate Metrics (Matches Screenshot 1 KPI Cards)
  const totalOutgoing = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type?.toLowerCase() === 'outgoing' && t.status?.toLowerCase() === 'completed')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [filteredTransactions]);

  const totalIncoming = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type?.toLowerCase() === 'incoming' && t.status?.toLowerCase() === 'completed')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [filteredTransactions]);

  const totalPending = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.status?.toLowerCase() === 'pending')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [filteredTransactions]);

  const totalCount = filteredTransactions.length;

  // Pagination slice
  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Currency Formatter with Indian separators
  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })}`;
  };

  // Date Formatter: DD/MM/YYYY
  const formatDateDMY = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  // Handle Recording New Transaction (Screenshot 2 Submission)
  const handleRecordSubmit = async (e) => {
    if (e) e.preventDefault();

    const amt = Number(recordForm.amount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!recordForm.party_name.trim()) {
      toast.error('Please specify the person or party name');
      return;
    }

    setSubmitting(true);
    try {
      const isOutgoing = recordForm.type === 'outgoing';
      await api.transactions.create({
        type: recordForm.type,
        category: recordForm.category,
        date: recordForm.date,
        payer_name: isOutgoing ? (organization?.name || 'Company Account') : recordForm.party_name.trim(),
        payee_name: isOutgoing ? recordForm.party_name.trim() : (organization?.name || 'Company Account'),
        amount: amt.toFixed(2),
        method: recordForm.method,
        status: recordForm.status,
        description: recordForm.description.trim(),
      });

      toast.success('Transaction confirmed and recorded in central ledger!');
      setRecordForm({
        type: 'outgoing',
        category: 'other',
        date: new Date().toISOString().split('T')[0],
        party_name: '',
        description: '',
        amount: '',
        method: 'cash',
        status: 'completed',
      });
      await loadData();
      setViewMode('list');
    } catch (err) {
      toast.error(err.message || 'Failed to record transaction');
    } finally {
      setSubmitting(false);
    }
  };

  // Super Admin & Admin can change transaction status directly (updates cards in real time)
  const handleUpdateTransactionStatus = async (transactionId, newStatus) => {
    try {
      await api.transactions.update(transactionId, { status: newStatus });
      toast.success(`Transaction marked as ${newStatus.toUpperCase()}! Metrics updated.`);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update transaction status');
    }
  };

  // Handle Deleting Transaction (Full Reversal)
  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction? Any linked payment or attendance settlement will be reversed.')) {
      return;
    }
    try {
      await api.transactions.delete(id);
      toast.success('Transaction deleted and ledger reversed');
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete transaction');
    }
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }
    const headers = ['SR_NO,TRANSACTION_ID,DATE,PAYEE,TYPE,CATEGORY,PAID_BY,DESCRIPTION,AMOUNT,STATUS'];
    const rows = filteredTransactions.map((t, idx) => {
      const amtStr = t.type === 'outgoing' ? `-${t.amount}` : `${t.amount}`;
      return `${idx + 1},"${t.transaction_id}","${t.date}","${t.payee_name}","${t.type}","${t.category}","${t.recorded_by_name || 'NARESH'}","${t.description || ''}",${amtStr},"${t.status}"`;
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `payment_central_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* ========================================================================= */}
      {/* 1. MAIN PAYMENT CENTRAL VIEW (Matches Screenshot 1)                       */}
      {/* ========================================================================= */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          {/* Header Row: Title, Subtitle & Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                <Wallet size={24} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  Payment Central
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 font-medium">
                  View and manage all transactions and financial entries
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExportExcel}
                className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
              >
                <FileDown size={15} />
                <span>Download Excel</span>
              </button>

              <button
                onClick={() => setViewMode('record')}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/20"
              >
                <Plus size={16} strokeWidth={3} />
                <span>Record Transaction</span>
              </button>
            </div>
          </div>

          {/* Filters & Search Card (Matches Screenshot 1) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
              <Filter size={14} className="text-blue-500" />
              <span>Filters & Search</span>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Reference number, project name, or purpose..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 pt-1 items-end">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  From
                </label>
                <input
                  type="date"
                  max={todayStr}
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  To
                </label>
                <input
                  type="date"
                  max={todayStr}
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  Filter by Admin & Super Admin
                </label>
                <select
                  value={filterAdmin}
                  onChange={(e) => setFilterAdmin(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Admins & Super Ad...</option>
                  <option value="naresh">Naresh</option>
                  <option value="priya">Priya</option>
                  <option value="rohan">Rohan</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  Filter by Employee
                </label>
                <select
                  value={filterEmployee}
                  onChange={(e) => {
                    setFilterEmployee(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Employees</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.full_name}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="outgoing">Outgoing</option>
                  <option value="incoming">Incoming</option>
                </select>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <SlidersHorizontal size={13} />
                  <span>Advanced</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4 KPI Metric Cards (Matches Screenshot 1) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: TOTAL OUTGOING */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden bg-gradient-to-br from-white via-white to-rose-50/50 dark:from-slate-900 dark:to-rose-950/20">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3">
                <ArrowUpRight size={20} strokeWidth={2.5} />
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-rose-500">
                Total Outgoing
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {formatCurrency(totalOutgoing)}
              </div>
            </div>

            {/* Card 2: TOTAL INCOMING */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden bg-gradient-to-br from-white via-white to-emerald-50/50 dark:from-slate-900 dark:to-emerald-950/20">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                <ArrowDownLeft size={20} strokeWidth={2.5} />
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                Total Incoming
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(totalIncoming)}
              </div>
            </div>

            {/* Card 3: PENDING PAYMENTS */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden bg-gradient-to-br from-white via-white to-amber-50/50 dark:from-slate-900 dark:to-amber-950/20">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
                <Clock size={20} strokeWidth={2.5} />
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                Pending Payments
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {formatCurrency(totalPending)}
              </div>
            </div>

            {/* Card 4: TOTAL TRANSACTIONS (Highlighted Border) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-indigo-400/90 dark:border-indigo-500/80 shadow-sm relative overflow-hidden bg-gradient-to-br from-white via-white to-indigo-50/40 dark:from-slate-900 dark:to-indigo-950/20">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3">
                <CheckCircle2 size={20} strokeWidth={2.5} />
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                Total Transactions
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {totalCount}
              </div>
            </div>
          </div>

          {/* PAYMENT TRANSACTIONS Table Card (Matches Screenshot 1) */}
          <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            {/* Header above table */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Payment Transactions
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">
                  {filteredTransactions.length} records
                </p>
              </div>

              {/* Layout Toggle: Cards | Table */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase">
                <button
                  onClick={() => setDisplayLayout('cards')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5',
                    displayLayout === 'cards'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  <LayoutGrid size={13} />
                  <span>Cards</span>
                </button>
                <button
                  onClick={() => setDisplayLayout('table')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5',
                    displayLayout === 'table'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  <TableIcon size={13} />
                  <span>Table</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400 font-semibold">
                Loading transactions...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 font-semibold">
                No payment transactions found matching the filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 dark:border-slate-800 bg-[#f5efe6] dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-200">
                      <th className="py-3 px-4 w-14 text-center">SR.NO</th>
                      <th className="py-3 px-4 w-28">DATE</th>
                      <th className="py-3 px-5">EMPLOYEE / PAID TO</th>
                      <th className="py-3 px-4 text-center w-28">TYPE</th>
                      <th className="py-3 px-5 text-center">CATEGORY</th>
                      <th className="py-3 px-4 text-center">PAID BY</th>
                      <th className="py-3 px-5">DESCRIPTION</th>
                      <th className="py-3 px-5 text-right w-32">AMOUNT</th>
                      <th className="py-3 px-4 text-center w-28">STATUS</th>
                      <th className="py-3 px-4 text-center w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {paginatedTransactions.map((t, idx) => {
                      const isOutgoing = t.type?.toLowerCase() === 'outgoing';
                      const isSalary = t.category?.toLowerCase() === 'salary';
                      const isCash = t.method?.toLowerCase() === 'cash';

                      return (
                        <tr
                          key={t.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4 text-center font-bold text-slate-600 dark:text-slate-400">
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {formatDateDMY(t.date)}
                          </td>
                          <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white">
                            {t.payee_name || 'Recipient'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={cn(
                                'px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider',
                                isOutgoing
                                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40'
                                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40'
                              )}
                            >
                              {t.type}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <div className="inline-block">
                              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                                {isSalary ? 'STAFF SALARY' : (t.category || 'GENERAL').toUpperCase()}
                              </span>
                              <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                                {isCash ? 'CASH' : 'UPI / ONLINE'}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center font-black text-slate-900 dark:text-white text-xs uppercase">
                            {t.recorded_by_name?.toUpperCase() || 'NARESH'}
                          </td>
                          <td className="py-3.5 px-5 font-medium text-slate-700 dark:text-slate-300 max-w-xs truncate">
                            {t.description || '—'}
                          </td>
                          <td className="py-3.5 px-5 text-right font-black text-xs whitespace-nowrap">
                            <span
                              className={
                                isOutgoing
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }
                            >
                              {isOutgoing ? `- ₹${Number(t.amount || 0).toLocaleString('en-IN')}` : `+ ₹${Number(t.amount || 0).toLocaleString('en-IN')}`}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {canChangeStatus ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <select
                                  value={t.status || 'completed'}
                                  onChange={(e) => handleUpdateTransactionStatus(t.id, e.target.value)}
                                  className={cn(
                                    'px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border cursor-pointer focus:outline-none transition-all',
                                    t.status === 'completed'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40'
                                      : t.status === 'pending'
                                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/40'
                                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/40'
                                  )}
                                >
                                  <option value="completed">Completed</option>
                                  <option value="pending">Pending</option>
                                  <option value="failed">Failed</option>
                                </select>
                                {t.status === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateTransactionStatus(t.id, 'completed')}
                                    className="px-2 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase shadow-sm cursor-pointer transition-all shrink-0"
                                    title="Confirm transaction immediately"
                                  >
                                    ✓ Confirm
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span
                                className={cn(
                                  'px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border',
                                  t.status === 'completed'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40'
                                    : t.status === 'pending'
                                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40'
                                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40'
                                )}
                              >
                                {t.status}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  alert(`Transaction: ${t.transaction_id}\nDate: ${t.date}\nAmount: ₹${t.amount}\nPayee: ${t.payee_name}\nRecorded by: ${t.recorded_by_name || 'Naresh'}`);
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="View Receipt"
                              >
                                <FileText size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(t.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                title="Delete Transaction"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {filteredTransactions.length > pageSize && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] font-bold uppercase text-slate-400">
                  Showing {(currentPage - 1) * pageSize + 1} to{' '}
                  {Math.min(currentPage * pageSize, filteredTransactions.length)} of{' '}
                  {filteredTransactions.length}
                </span>

                <div className="flex gap-2">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 uppercase font-black text-[10px] disabled:opacity-40 cursor-pointer shadow-sm"
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 uppercase font-black text-[10px] disabled:opacity-40 cursor-pointer shadow-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. RECORD TRANSACTION VIEW (Matches Screenshot 2)                          */}
      {/* ========================================================================= */}
      {viewMode === 'record' && (
        <div className="space-y-6">
          {/* Header Row: Back Arrow, Title, Subtitle */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode('list')}
              className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm"
              title="Back to Payment Central"
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Record Transaction
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                Add a new financial entry to the central ledger
              </p>
            </div>
          </div>

          <form onSubmit={handleRecordSubmit}>
            {/* Main 2-Column Layout (Matches Screenshot 2) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left Column: TRANSACTION DETAILS (Card 1) */}
              <div className="lg:col-span-2 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                {/* Card Title */}
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  <div className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-xs font-bold">
                    i
                  </div>
                  <span>Transaction Details</span>
                </div>

                {/* Row 1: Transaction Type & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Transaction Type (Toggle buttons) */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Transaction Type
                    </label>
                    <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setRecordForm({ ...recordForm, type: 'incoming' })}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer',
                          recordForm.type === 'incoming'
                            ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        )}
                      >
                        Incoming
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecordForm({ ...recordForm, type: 'outgoing' })}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer',
                          recordForm.type === 'outgoing'
                            ? 'bg-white dark:bg-slate-900 text-rose-500 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        )}
                      >
                        Outgoing
                      </button>
                    </div>
                  </div>

                  {/* Category Dropdown */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Category
                    </label>
                    <select
                      value={recordForm.category}
                      onChange={(e) => setRecordForm({ ...recordForm, category: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="other">General / Other</option>
                      <option value="salary">Staff Salary</option>
                      <option value="vendor">Vendor Payment</option>
                      <option value="client">Client Receipt</option>
                      <option value="site_cost">Site Cost</option>
                      <option value="expense_reimbursement">Expense Reimbursement</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Transaction Date */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    required
                    max={todayStr}
                    value={recordForm.date}
                    onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
                    Select today or a past date (future dates are disabled)
                  </p>
                </div>

                {/* Row 3: Person / Party Name */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    Person / Party Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Select Employee / Recipient..."
                    value={recordForm.party_name}
                    onChange={(e) => setRecordForm({ ...recordForm, party_name: e.target.value })}
                    list="recipients-list"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold placeholder-slate-400 focus:outline-none"
                  />
                  <datalist id="recipients-list">
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.full_name}>
                        {emp.role ? `Worker (${emp.role})` : 'Employee'}
                      </option>
                    ))}
                    {vendors.map((ven) => (
                      <option key={ven.id} value={ven.name}>
                        Vendor
                      </option>
                    ))}
                  </datalist>
                </div>

                {/* Row 4: Description / Notes */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    Description / Notes
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Reference number, project name, or purpose..."
                    value={recordForm.description}
                    onChange={(e) => setRecordForm({ ...recordForm, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium placeholder-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Right Column: AMOUNT & STATUS (Card 2) */}
              <div className="space-y-6">
                <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                  {/* Card Title */}
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs">
                      <Wallet size={12} />
                    </div>
                    <span>Amount & Status</span>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={recordForm.amount}
                      onChange={(e) => setRecordForm({ ...recordForm, amount: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-black focus:outline-none"
                    />
                  </div>

                  {/* Payment Method Dropdown */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Payment Method
                    </label>
                    <select
                      value={recordForm.method}
                      onChange={(e) => setRecordForm({ ...recordForm, method: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI / Online</option>
                      <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                      <option value="cheque">Cheque</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Current Status Dropdown */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Current Status
                    </label>
                    <select
                      value={recordForm.status}
                      onChange={(e) => setRecordForm({ ...recordForm, status: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="completed">Completed</option>
                      <option value="pending">Pending</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                </div>

                {/* Primary Action Button: CONFIRM & RECORD */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-500/25 disabled:opacity-50"
                >
                  <CreditCard size={16} />
                  <span>{submitting ? 'Recording...' : 'Confirm & Record'}</span>
                </button>

                {/* Secondary Action: DISCARD ENTRY */}
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="w-full py-2.5 rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-black text-[11px] uppercase tracking-wider transition-colors cursor-pointer text-center"
                >
                  Discard Entry
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
