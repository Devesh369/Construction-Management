import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Calendar,
  CheckCircle2,
  Wallet,
  FileDown,
  Printer,
  Trash2,
  X,
  IndianRupee,
  AlertCircle,
  Building2,
  User,
  CreditCard,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';
import { Modal } from '../components/ui/Modal';

export const UpadView = ({ selectedProjectId }) => {
  const { user, role } = useAuth();
  const isEmployeeLabour = role === 'employee/labour' || role === 'EMPLOYEE' || role === 'LABOUR';
  const currentEmpId = user?.employee_id || 100;
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const canChangeStatus = !isEmployeeLabour && (role === 'ORG_ADMIN' || role === 'PROJECT_MANAGER' || role === 'SITE_MANAGER' || user?.is_staff || role === 'ACCOUNTANT');

  // Active top tab: 'logs' | 'report' (matches Screenshot 1 & 2)
  const [activeTab, setActiveTab] = useState('logs');

  // Master data
  const [payments, setPayments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters (Matches Screenshot 1 & 2)
  const [fromDate, setFromDate] = useState('2026-06-01');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState(selectedProjectId || 'all');

  // Pagination for Report & Logs
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Process Upad Modal state
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processForm, setProcessForm] = useState({
    employee_id: '',
    project_id: selectedProjectId || '',
    amount: '',
    method: 'upi', // 'upi' | 'cash' | 'bank_transfer' | 'cheque'
    type: 'advance',
    status: 'paid', // 'paid' | 'pending'
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const selectedEmp = useMemo(() => {
    return employees.find((e) => String(e.id) === String(processForm.employee_id));
  }, [employees, processForm.employee_id]);

  const hasAttendance = Boolean(
    selectedEmp?.financials?.has_attendance ||
    (selectedEmp?.financials?.total_pagar && Number(selectedEmp.financials.total_pagar) > 0)
  );
  const empDailyWage = Number(selectedEmp?.daily_rate || selectedEmp?.wage_rate || 0);
  const empCurrentBalance = hasAttendance
    ? Number(selectedEmp?.financials?.balance ?? (empDailyWage || 0))
    : 0;
  const enteredUpad = Number(processForm.amount || 0);
  const projectedBalance = Math.max(0, empCurrentBalance - enteredUpad);

  // Sync selectedProjectId if changed from topbar
  useEffect(() => {
    if (selectedProjectId) {
      setProjectFilter(selectedProjectId);
      setProcessForm((prev) => ({ ...prev, project_id: selectedProjectId }));
    }
  }, [selectedProjectId]);

  // Load all Upad payments, employees, and projects
  const loadData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, empRes, projRes] = await Promise.all([
        api.payments.list(),
        api.workforce.listEmployees({ page_size: 1000 }),
        api.projects.list(),
      ]);

      let payList = Array.isArray(paymentsRes) ? paymentsRes : paymentsRes?.results || [];
      let empList = Array.isArray(empRes) ? empRes : empRes?.results || [];
      const projList = Array.isArray(projRes) ? projRes : projRes?.results || [];

      if (isEmployeeLabour) {
        payList = payList.filter(
          (p) =>
            p.employee === currentEmpId ||
            p.employee_id === currentEmpId ||
            String(p.employee) === String(currentEmpId)
        );
        empList = empList.filter(
          (e) => e.id === currentEmpId || String(e.id) === String(currentEmpId)
        );
      }

      setPayments(payList);
      setEmployees(empList);
      setProjects(projList);

      if (!processForm.project_id && projList.length > 0) {
        setProcessForm((prev) => ({ ...prev, project_id: projList[0].id }));
      }
      if (!processForm.employee_id && empList.length > 0) {
        setProcessForm((prev) => ({ ...prev, employee_id: empList[0].id }));
      }
    } catch (err) {
      console.error('Failed to load Upad data:', err);
      toast.error('Failed to load Upad data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered payments based on date range, employee, and project
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // Date filter
      const pDate = p.date_from || p.date_to || (p.created_at ? p.created_at.split('T')[0] : '');
      if (fromDate && pDate && pDate < fromDate) return false;
      if (toDate && pDate && pDate > toDate) return false;

      // Employee filter
      if (isEmployeeLabour) {
        if (
          p.employee !== currentEmpId &&
          p.employee_id !== currentEmpId &&
          String(p.employee) !== String(currentEmpId)
        ) {
          return false;
        }
      } else if (employeeFilter !== 'all' && String(p.employee) !== String(employeeFilter)) {
        return false;
      }

      // Project filter
      if (projectFilter !== 'all' && String(p.project) !== String(projectFilter)) {
        return false;
      }

      return true;
    });
  }, [payments, fromDate, toDate, employeeFilter, projectFilter, isEmployeeLabour, currentEmpId]);

  // Summary Metrics (Matches Screenshot 1 & 2) - Dynamically recalculates when status changes
  const paidTotal = useMemo(() => {
    return filteredPayments
      .filter((p) => {
        const st = (p.status || '').toLowerCase();
        return st === 'paid' || st === 'confirmed' || st === 'approved';
      })
      .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  }, [filteredPayments]);

  const pendingTotal = useMemo(() => {
    return filteredPayments
      .filter((p) => (p.status || '').toLowerCase() === 'pending')
      .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  }, [filteredPayments]);

  const totalTransactions = filteredPayments.length;

  // Pagination slice
  const totalPages = Math.ceil(filteredPayments.length / pageSize) || 1;
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, currentPage, pageSize]);

  // Format currency with Indian Comma separators: ₹68,150
  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })}`;
  };

  // Format date: DD/MM/YYYY
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

  // Handle Process Upad Submission
  const handleProcessUpad = async (e) => {
    e.preventDefault();
    if (!processForm.employee_id) {
      toast.error('Please select an employee');
      return;
    }
    if (processForm.type === 'salary' && !hasAttendance) {
      toast.error('Cannot pay wages to an employee without marked attendance. Attendance must be marked first.');
      return;
    }
    if (!processForm.amount || Number(processForm.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      await api.payments.create({
        employee: Number(processForm.employee_id),
        project: processForm.project_id ? Number(processForm.project_id) : null,
        amount: Number(processForm.amount),
        method: processForm.method,
        type: processForm.type || 'advance',
        status: processForm.status || 'paid',
        date_from: processForm.date,
        date_to: processForm.date,
        description: processForm.description.trim() || 'Upad advance payment',
      });

      toast.success('Upad payment recorded successfully!');
      setIsProcessModalOpen(false);
      setProcessForm({
        employee_id: employees[0]?.id || '',
        project_id: selectedProjectId || projects[0]?.id || '',
        amount: '',
        method: 'upi',
        type: 'advance',
        status: 'paid',
        date: new Date().toISOString().split('T')[0],
        description: '',
      });
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to process Upad payment');
    } finally {
      setSubmitting(false);
    }
  };

  // Super Admin & Admin can change payment status directly
  const handleUpdatePaymentStatus = async (paymentId, newStatus) => {
    try {
      await api.payments.update(paymentId, { status: newStatus });
      toast.success(`Payment status updated to ${newStatus.toUpperCase()}! Cards updated.`);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update payment status');
    }
  };

  // Delete payment (with full cascading reversal)
  const handleDeletePayment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this Upad payment? Any attendance settlement will be reversed.')) {
      return;
    }
    try {
      await api.payments.delete(id);
      toast.success('Upad payment deleted and reversed');
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete payment');
    }
  };

  // Export Excel / CSV
  const handleExportExcel = () => {
    if (filteredPayments.length === 0) {
      toast.error('No payments to export');
      return;
    }
    const headers = ['NO,DATE,EMPLOYEE,PROJECT,AMOUNT,PAID_BY,PAYMENT_METHOD,STATUS,DESCRIPTION'];
    const rows = filteredPayments.map((p, idx) => {
      const pDate = p.date_from || p.date_to || '';
      return `${idx + 1},"${pDate}","${p.employee_name || ''}","${p.project_name || ''}",${p.amount},"${p.approved_by_admin_name || user?.name || 'NARESH'}","${p.method}","${p.status}","${p.description || ''}"`;
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `upad_report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report
  const handlePrintReport = () => {
    window.print();
  };

  // Selected project label
  const selectedProjectObj = projects.find((p) => String(p.id) === String(projectFilter));
  const projectLabel = projectFilter === 'all' ? 'ALL PROJECTS' : (selectedProjectObj?.name || 'PROJECT').toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* ========================================================================= */}
      {/* 1. TOP TABS: UPAD LOGS | UPAD REPORT (Matches Screenshot 1 & 2)          */}
      {/* ========================================================================= */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-8 px-1">
        <button
          onClick={() => {
            setActiveTab('logs');
            setCurrentPage(1);
          }}
          className={cn(
            'pb-3 font-black text-sm uppercase tracking-wider transition-all cursor-pointer relative select-none',
            activeTab === 'logs'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          )}
        >
          Upad Logs
        </button>

        <button
          onClick={() => {
            setActiveTab('report');
            setCurrentPage(1);
          }}
          className={cn(
            'pb-3 font-black text-sm uppercase tracking-wider transition-all cursor-pointer relative select-none',
            activeTab === 'report'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          )}
        >
          Upad Report
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2. TAB 1: UPAD LOGS (Matches Screenshot 1)                                */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Top Title & Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Upad
            </h1>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExportExcel}
                className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
              >
                <FileDown size={15} />
                <span>Export Excel</span>
              </button>

              {!isEmployeeLabour && (
                <button
                  onClick={() => setIsProcessModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs tracking-wide flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/20"
                >
                  <Plus size={16} strokeWidth={3} />
                  <span>Process Upad</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Card (Matches Screenshot 1) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  From
                </label>
                <div className="relative">
                  <input
                    type="date"
                    max={todayStr}
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  To
                </label>
                <div className="relative">
                  <input
                    type="date"
                    max={todayStr}
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  Employee
                </label>
                <select
                  value={employeeFilter}
                  onChange={(e) => {
                    setEmployeeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Employees</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  Project
                </label>
                <select
                  value={projectFilter}
                  onChange={(e) => {
                    setProjectFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Projects</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Metric Cards Row: PAID TOTAL, PENDING & TRANSACTIONS (Matches Screenshot 1) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: PAID / CONFIRMED TOTAL */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Confirmed / Paid Total
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                  {formatCurrency(paidTotal)}
                </div>
              </div>
            </div>

            {/* Card 2: PENDING APPROVALS */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <AlertCircle size={24} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Pending Approvals
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                  {formatCurrency(pendingTotal)}
                </div>
              </div>
            </div>

            {/* Card 3: TRANSACTIONS */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                <Wallet size={24} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Total Transactions
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                  {totalTransactions}
                </div>
              </div>
            </div>
          </div>

          {/* Upad Details Table (Matches Screenshot 1) */}
          <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            {/* Beige / Light Tan Header Banner */}
            <div className="py-2.5 px-6 bg-[#f5efe6] dark:bg-slate-800/80 border-b border-slate-300 dark:border-slate-700 text-center">
              <span className="font-black text-xs uppercase tracking-[0.25em] text-slate-800 dark:text-slate-200">
                Upad Details
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400 font-semibold">
                Loading Upad details...
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 font-semibold">
                No Upad payments found for the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      <th className="py-3 px-5 font-black">Employee Name</th>
                      <th className="py-3 px-5 font-black">Project Name</th>
                      <th className="py-3 px-5 font-black">Date</th>
                      <th className="py-3 px-5 font-black">Amount</th>
                      <th className="py-3 px-5 text-center font-black">Paid By</th>
                      <th className="py-3 px-5 text-center font-black">Payment Method</th>
                      <th className="py-3 px-5 text-center font-black">Status</th>
                      <th className="py-3 px-5 text-center font-black">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {paginatedPayments.map((p) => {
                      const pDate = p.date_from || p.date_to || '';
                      const isCash = p.method?.toLowerCase() === 'cash';
                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-5">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {p.employee_name || 'Worker'}
                            </div>
                            {(() => {
                              const empObj = employees.find((e) => String(e.id) === String(p.employee));
                              if (!empObj) return null;
                              const wage = Number(empObj.daily_rate || empObj.wage_rate || 0);
                              const bal = Number(empObj.balance ?? (empObj.financials?.balance ?? wage));
                              return (
                                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                                  <span>₹{wage}/d</span>
                                  <span>•</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Remain: ₹{bal}</span>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3.5 px-5 font-semibold text-slate-700 dark:text-slate-300">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              {p.project_name || 'General Site'}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {formatDateDMY(pDate)}
                          </td>
                          <td className="py-3.5 px-5 font-black text-slate-900 dark:text-white">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">
                              {p.approved_by_admin_name || user?.name || 'NARESH'}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <span
                              className={cn(
                                'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider',
                                isCash
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'
                              )}
                            >
                              {isCash ? 'CASH' : 'UPI / ONLINE'}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            {canChangeStatus ? (
                              <select
                                value={p.status || 'paid'}
                                onChange={(e) => handleUpdatePaymentStatus(p.id, e.target.value)}
                                className={cn(
                                  'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer border outline-none transition-all shadow-sm',
                                  (p.status?.toLowerCase() === 'paid' || p.status?.toLowerCase() === 'confirmed')
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                    : p.status?.toLowerCase() === 'pending'
                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                                    : p.status?.toLowerCase() === 'approved'
                                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400'
                                    : 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400'
                                )}
                              >
                                <option value="pending">Pending</option>
                                <option value="paid">Confirm (Paid)</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            ) : (
                              <span
                                className={cn(
                                  'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider',
                                  (p.status?.toLowerCase() === 'paid' || p.status?.toLowerCase() === 'confirmed')
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                )}
                              >
                                {p.status?.toUpperCase() || 'PAID'}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {p.status?.toLowerCase() === 'pending' && canChangeStatus && (
                                <button
                                  onClick={() => handleUpdatePaymentStatus(p.id, 'paid')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                                  title="Confirm payment"
                                >
                                  <CheckCircle2 size={12} strokeWidth={2.5} />
                                  <span>Confirm</span>
                                </button>
                              )}
                              {!isEmployeeLabour ? (
                                <button
                                  onClick={() => handleDeletePayment(p.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                                  title="Delete Upad payment"
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-semibold">View</span>
                              )}
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
            {filteredPayments.length > pageSize && (
              <div className="p-4 bg-[#fbf9f6] dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] font-bold uppercase text-slate-400">
                  Showing {(currentPage - 1) * pageSize + 1} to{' '}
                  {Math.min(currentPage * pageSize, filteredPayments.length)} of{' '}
                  {filteredPayments.length}
                </span>

                <div className="flex gap-2">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 text-xs font-bold cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 text-xs font-bold cursor-pointer"
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
      {/* 3. TAB 2: UPAD REPORT (Matches Screenshot 2)                              */}
      {/* ========================================================================= */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {/* Top Title & Print Button */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Upad Report
            </h1>

            <button
              onClick={handlePrintReport}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
            >
              <Printer size={15} />
              <span>Print Report</span>
            </button>
          </div>

          {/* MY UPAD DAILY OVERVIEW Card (Matches Screenshot 2) */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              My Upad Daily Overview
            </div>

            <div className="flex flex-wrap items-center justify-between gap-6 pt-1">
              <div className="flex items-baseline gap-3">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                  Transactions
                </span>
                <span className="text-3xl font-black text-blue-600 dark:text-blue-400">
                  {totalTransactions}
                </span>
              </div>

              <div className="flex items-baseline gap-4">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Paid Total
                </span>
                <span className="text-3xl sm:text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                  {formatCurrency(paidTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Document Table (Matches Screenshot 2) */}
          <div className="rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-[#fbf9f6] dark:bg-slate-900 overflow-hidden shadow-sm">
            {/* Report Header Bar */}
            <div className="py-3 px-6 bg-[#dce8f8] dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700 text-center">
              <h2 className="text-sm sm:text-base font-black uppercase tracking-[0.15em] text-slate-900 dark:text-white">
                Construction Project - Upad Report
              </h2>
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mt-1">
                Project: <span className="font-extrabold">{projectLabel}</span> &nbsp;|&nbsp; Date
                Range: <span className="font-extrabold">{formatDateDMY(fromDate)}</span> To{' '}
                <span className="font-extrabold">{formatDateDMY(toDate)}</span>
              </div>
            </div>

            {filteredPayments.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 font-semibold">
                No Upad report records for the chosen date range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/40 text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      <th className="py-3 px-5 w-28">Date</th>
                      <th className="py-3 px-6">Employee / Paid To</th>
                      <th className="py-3 px-6">Description</th>
                      <th className="py-3 px-6 text-right w-36">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {paginatedPayments.map((p) => {
                      const pDate = p.date_from || p.date_to || '';
                      const isCash = p.method?.toLowerCase() === 'cash';
                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {formatDateDMY(pDate)}
                          </td>
                          <td className="py-3.5 px-6">
                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                              {p.employee_name || 'Worker'}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">
                                {isCash ? 'CASH' : 'UPI'}
                              </span>
                              {(() => {
                                const empObj = employees.find((e) => String(e.id) === String(p.employee));
                                if (!empObj) return null;
                                const wage = Number(empObj.daily_rate || empObj.wage_rate || 0);
                                const bal = Number(empObj.balance ?? (empObj.financials?.balance ?? wage));
                                return (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    • Rem: ₹{bal}
                                  </span>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="py-3.5 px-6 font-medium text-slate-700 dark:text-slate-300">
                            {p.description || '—'}
                          </td>
                          <td className="py-3.5 px-6 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                            {formatCurrency(p.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Table Footer: Total Upad (Matches Screenshot 2) */}
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80 font-black text-xs text-slate-900 dark:text-white">
                      <td colSpan={3} className="py-3.5 px-6 text-right uppercase tracking-wider">
                        Total Upad
                      </td>
                      <td className="py-3.5 px-6 text-right font-black text-base text-slate-900 dark:text-white">
                        {formatCurrency(paidTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Pagination Row (Matches Screenshot 2) */}
            <div className="p-4 bg-[#f5efe6] dark:bg-slate-800/60 border-t border-slate-300 dark:border-slate-700 flex items-center justify-between text-xs">
              <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, filteredPayments.length)} of{' '}
                {filteredPayments.length}
              </span>

              <div className="flex gap-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 uppercase font-black text-[10px] disabled:opacity-40 cursor-pointer shadow-sm"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 uppercase font-black text-[10px] disabled:opacity-40 cursor-pointer shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: + PROCESS UPAD                                                  */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isProcessModalOpen}
        onClose={() => setIsProcessModalOpen(false)}
        title="Process Upad Advance"
        subtitle="Disburse worker advance and update financial ledgers"
        size="lg"
      >
        <form onSubmit={handleProcessUpad} className="space-y-4">
          {/* Row 1: Employee & Project Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Employee *
              </label>
              <select
                required
                value={processForm.employee_id}
                onChange={(e) =>
                  setProcessForm({ ...processForm, employee_id: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select Employee...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.role || 'Worker'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Project *
              </label>
              <select
                required
                value={processForm.project_id}
                onChange={(e) =>
                  setProcessForm({ ...processForm, project_id: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select Project...</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name} {proj.code ? `(${proj.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Salary & Upad Calculation Preview */}
          {selectedEmp && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-slate-800/80 dark:to-slate-800/40 border border-blue-200/60 dark:border-blue-900/40 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  Salary & Upad Calculator
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-extrabold">{selectedEmp.full_name}</span>
              </div>

              {!hasAttendance && (
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] font-semibold flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0 text-amber-600" />
                  <span>Worker has no recorded attendance yet. Attendance must be marked to accrue payable wages.</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Daily Salary</div>
                  <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5">₹{empDailyWage}</div>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Current Balance</div>
                  <div className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-0.5">₹{empCurrentBalance}</div>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Remain Salary</div>
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5">₹{projectedBalance}</div>
                </div>
              </div>

              {enteredUpad > 0 && (
                <div className="text-[11px] text-center font-semibold text-slate-600 dark:text-slate-300 pt-1 border-t border-blue-100 dark:border-slate-700/60">
                  Taking <span className="font-bold text-blue-600 dark:text-blue-400">₹{enteredUpad}</span> Upad from daily wage ₹{empDailyWage || empCurrentBalance} leaves <span className="font-black text-emerald-600 dark:text-emerald-400">₹{projectedBalance}</span> remaining salary.
                </div>
              )}
            </div>
          )}

          {/* Row 2: Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Amount (₹) *
              </label>
              <input
                type="number"
                required
                min="1"
                step="1"
                placeholder="e.g. 2000"
                value={processForm.amount}
                onChange={(e) =>
                  setProcessForm({ ...processForm, amount: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Date *
              </label>
              <input
                type="date"
                required
                max={todayStr}
                value={processForm.date}
                onChange={(e) =>
                  setProcessForm({ ...processForm, date: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Row 3: Payment Method & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Payment Method *
              </label>
              <select
                value={processForm.method}
                onChange={(e) =>
                  setProcessForm({ ...processForm, method: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="upi">UPI / Online</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            {canChangeStatus ? (
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Status *
                </label>
                <select
                  value={processForm.status || 'paid'}
                  onChange={(e) =>
                    setProcessForm({ ...processForm, status: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="paid">Confirmed / Paid</option>
                  <option value="pending">Pending Approval</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Status
                </label>
                <input
                  type="text"
                  disabled
                  value="Pending Approval"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-500 text-xs font-semibold"
                />
              </div>
            )}
          </div>

          {/* Row 4: Description */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Description / Purpose
            </label>
            <input
              type="text"
              placeholder="e.g. GPY કર્યા દવા માટે, કાળું એ લીધા"
              value={processForm.description}
              onChange={(e) =>
                setProcessForm({ ...processForm, description: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsProcessModalOpen(false)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              <Plus size={14} strokeWidth={3} />
              <span>{submitting ? 'Processing...' : 'Disburse Upad'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
