import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Plus,
  CheckCircle,
  CheckCircle2,
  FileText,
  IndianRupee,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Download,
  ShieldAlert,
  Trash2,
  Banknote,
  User,
  Users,
  Search,
  Filter,
  FileDown,
  RefreshCw,
  Building2,
  Clock,
  ChevronLeft,
  X,
  CreditCard,
  Briefcase,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

export const PayrollView = ({ selectedProjectId }) => {
  const { user, role } = useAuth();
  const isEmployeeLabour = role === 'employee/labour' || role === 'EMPLOYEE' || role === 'LABOUR';
  const isOrgAdmin = role === 'ORG_ADMIN' || user?.is_superuser;
  const isSiteManager = role === 'SITE_MANAGER' || role === 'PROJECT_MANAGER';
  const canManagePayroll = isOrgAdmin || isSiteManager;

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Tabs: 'salaries' | 'runs' | 'advances'
  const [activeTab, setActiveTab] = useState('salaries');

  // Master Data
  const [runs, setRuns] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [salaryDisbursements, setSalaryDisbursements] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Expanded Run Rows
  const [expandedRunId, setExpandedRunId] = useState(null);

  // Current Employee ID matching (for employee/labour self-service)
  const currentEmpId = useMemo(() => {
    if (user?.employee_id) return Number(user.employee_id);
    const matched = employees.find(
      (e) =>
        (user?.email && e.email && e.email.toLowerCase() === user.email.toLowerCase()) ||
        (user?.phone && e.phone && e.phone === user.phone) ||
        (user?.name && e.full_name && e.full_name.toLowerCase() === user.name.toLowerCase())
    );
    return matched ? matched.id : null;
  }, [user, employees]);

  // Tab 1 (Salaries) Filters & Pagination
  const [salarySearch, setSalarySearch] = useState('');
  const [salaryProjectFilter, setSalaryProjectFilter] = useState(selectedProjectId || 'all');
  const [salaryStatusFilter, setSalaryStatusFilter] = useState('all'); // 'all' | 'due' | 'settled'
  const [salaryPage, setSalaryPage] = useState(1);
  const salaryPageSize = 10;

  // Tab 3 (Advances) Filters & Pagination
  const [advanceSearch, setAdvanceSearch] = useState('');
  const [advanceProjectFilter, setAdvanceProjectFilter] = useState(selectedProjectId || 'all');
  const [advanceStatusFilter, setAdvanceStatusFilter] = useState('all'); // 'all' | 'OPEN' | 'DEDUCTED'
  const [advancePage, setAdvancePage] = useState(1);
  const advancePageSize = 10;

  // Modals
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modal Forms
  const [runForm, setRunForm] = useState({
    project_id: selectedProjectId || '',
    period_start: '',
    period_end: '',
  });

  const [advanceForm, setAdvanceForm] = useState({
    project: selectedProjectId || '',
    employee: '',
    amount: '',
    advance_date: new Date().toISOString().split('T')[0],
    reason: '',
    payment_mode: 'CASH',
  });

  const [salaryForm, setSalaryForm] = useState({
    employee_id: '',
    project_id: selectedProjectId || '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    payment_mode: 'CASH',
    notes: '',
    status: isOrgAdmin ? 'paid' : 'pending',
  });

  // Sync selectedProjectId prop
  useEffect(() => {
    if (selectedProjectId) {
      setSalaryProjectFilter(selectedProjectId);
      setAdvanceProjectFilter(selectedProjectId);
      setRunForm((prev) => ({ ...prev, project_id: selectedProjectId }));
      setAdvanceForm((prev) => ({ ...prev, project: selectedProjectId }));
      setSalaryForm((prev) => ({ ...prev, project_id: selectedProjectId }));
    }
  }, [selectedProjectId]);

  // Fetch all payroll data
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = selectedProjectId ? { project: selectedProjectId } : {};
      const [runRes, advRes, projRes, empRes, payRes] = await Promise.all([
        api.payroll.listRuns(params).catch(() => []),
        api.payroll.listAdvances(params).catch(() => []),
        api.projects.list({ page_size: 1000 }).catch(() => []),
        api.workforce.listEmployees({ page_size: 1000 }).catch(() => []),
        api.payments.list(params).catch(() => []),
      ]);

      let runList = Array.isArray(runRes) ? runRes : runRes.results || [];
      let advList = Array.isArray(advRes) ? advRes : advRes.results || [];
      let empList = Array.isArray(empRes) ? empRes : empRes.results || [];
      let payList = Array.isArray(payRes) ? payRes : payRes?.results || [];

      let salList = payList.filter((p) => {
        const t = (p.type || p.payment_type || '').toLowerCase();
        return t === 'salary' || t === 'wage';
      });

      if (isEmployeeLabour) {
        if (currentEmpId) {
          advList = advList.filter(
            (a) => a.employee === currentEmpId || String(a.employee) === String(currentEmpId)
          );
          salList = salList.filter(
            (p) =>
              p.employee === currentEmpId ||
              p.employee_id === currentEmpId ||
              String(p.employee) === String(currentEmpId)
          );
          runList = runList
            .map((run) => {
              const myVouchers = (run.vouchers || []).filter(
                (v) =>
                  v.employee === currentEmpId ||
                  String(v.employee) === String(currentEmpId) ||
                  (user?.employee_code && v.employee_code === user.employee_code)
              );
              return {
                ...run,
                vouchers: myVouchers,
              };
            })
            .filter((run) => run.vouchers && run.vouchers.length > 0);

          empList = empList.filter(
            (e) => e.id === currentEmpId || String(e.id) === String(currentEmpId)
          );
        }
        if (empList.length === 0 && user) {
          empList = [
            {
              id: user.employee_id || 12,
              full_name: user.name || 'Harshil',
              employee_code: user.employee_code || 'EMP-0011',
              role: 'LABOUR',
              trade: 'HELPER',
              daily_rate: 500,
            },
          ];
        }
      }

      setRuns(runList);
      setAdvances(advList);
      setSalaryDisbursements(salList);
      setProjects(Array.isArray(projRes) ? projRes : projRes.results || []);
      setEmployees(empList);
    } catch (err) {
      console.error('Failed to load payroll data:', err);
      toast.error('Failed to load payroll records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProjectId, currentEmpId]);

  // Format currency: ₹XX,XXX
  const formatCurrency = (val) => {
    const num = Number(val || 0);
    if (num < 0) {
      return `-₹${Math.abs(num).toLocaleString('en-IN', {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      })}`;
    }
    return `₹${num.toLocaleString('en-IN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })}`;
  };

  // Format date: DD/MM/YYYY
  const formatDateDMY = (dateVal) => {
    if (!dateVal) return '—';
    try {
      const str = String(dateVal).trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
      const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (ymdMatch) {
        const [, year, month, day] = ymdMatch;
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      }
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      }
      return str;
    } catch {
      return dateVal;
    }
  };

  // Filtered Employees for Salary Tab
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (salaryProjectFilter !== 'all') {
        const pId = emp.primary_project || '';
        if (String(pId) !== String(salaryProjectFilter)) return false;
      }
      if (salarySearch) {
        const q = salarySearch.toLowerCase();
        const name = (emp.full_name || '').toLowerCase();
        const code = (emp.employee_code || '').toLowerCase();
        const trade = (emp.trade || emp.role || '').toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !trade.includes(q)) return false;
      }
      if (salaryStatusFilter === 'due') {
        const fin = emp.financials || {};
        const dailyWage = Number(emp.daily_rate || emp.wage_rate || 0);
        const pagar = Number(fin.total_pagar || (fin.has_attendance ? dailyWage : 0));
        const upad = Number(fin.total_upad || 0);
        const paid = Number(fin.total_paid || 0);
        const balance = fin.balance !== undefined && fin.balance !== null
          ? Number(fin.balance)
          : Math.max(0, pagar - upad - paid);
        if (balance <= 0) return false;
      } else if (salaryStatusFilter === 'settled') {
        const fin = emp.financials || {};
        const dailyWage = Number(emp.daily_rate || emp.wage_rate || 0);
        const pagar = Number(fin.total_pagar || (fin.has_attendance ? dailyWage : 0));
        const upad = Number(fin.total_upad || 0);
        const paid = Number(fin.total_paid || 0);
        const balance = fin.balance !== undefined && fin.balance !== null
          ? Number(fin.balance)
          : Math.max(0, pagar - upad - paid);
        if (balance > 0) return false;
      }
      return true;
    });
  }, [employees, salaryProjectFilter, salarySearch, salaryStatusFilter]);

  // Paginated Employees
  const totalSalaryPages = Math.ceil(filteredEmployees.length / salaryPageSize) || 1;
  const paginatedEmployees = useMemo(() => {
    const start = (salaryPage - 1) * salaryPageSize;
    return filteredEmployees.slice(start, start + salaryPageSize);
  }, [filteredEmployees, salaryPage, salaryPageSize]);

  // Filtered Advances for Tab 3
  const filteredAdvances = useMemo(() => {
    return advances.filter((adv) => {
      if (advanceProjectFilter !== 'all') {
        const pId = adv.project || '';
        if (String(pId) !== String(advanceProjectFilter)) return false;
      }
      if (advanceSearch) {
        const q = advanceSearch.toLowerCase();
        const name = (adv.employee_name || '').toLowerCase();
        const code = (adv.employee_code || '').toLowerCase();
        const reason = (adv.reason || '').toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !reason.includes(q)) return false;
      }
      if (advanceStatusFilter !== 'all') {
        if ((adv.status || '').toUpperCase() !== advanceStatusFilter.toUpperCase()) return false;
      }
      return true;
    });
  }, [advances, advanceProjectFilter, advanceSearch, advanceStatusFilter]);

  const totalAdvancePages = Math.ceil(filteredAdvances.length / advancePageSize) || 1;
  const paginatedAdvances = useMemo(() => {
    const start = (advancePage - 1) * advancePageSize;
    return filteredAdvances.slice(start, start + advancePageSize);
  }, [filteredAdvances, advancePage, advancePageSize]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalPagar = 0;
    let totalUpad = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    filteredEmployees.forEach((emp) => {
      const fin = emp.financials || {};
      const dailyWage = Number(emp.daily_rate || emp.wage_rate || 0);
      const hasAtt = Boolean(fin.has_attendance || (fin.total_pagar && Number(fin.total_pagar) > 0));
      const pagar = Number(fin.total_pagar || (hasAtt ? dailyWage : 0));
      const upad = Number(fin.total_upad || 0);
      const paid = Number(fin.total_paid || 0);
      const bal = fin.balance !== undefined && fin.balance !== null
        ? Number(fin.balance)
        : Math.max(0, pagar - upad - paid);

      totalPagar += pagar;
      totalUpad += upad;
      totalPaid += paid;
      totalBalance += bal;
    });

    return {
      activeWorkers: filteredEmployees.length,
      totalPagar,
      totalUpad,
      totalPaid,
      totalBalance,
    };
  }, [filteredEmployees]);

  // Selected Worker in Salary Modal
  const selectedSalaryWorker = useMemo(() => {
    return employees.find((emp) => String(emp.id) === String(salaryForm.employee_id));
  }, [employees, salaryForm.employee_id]);

  // Modal Open Handlers
  const openSalaryModal = (worker = null) => {
    const target = worker || filteredEmployees[0] || employees[0];
    const fin = target?.financials || {};
    const dailyWage = Number(target?.daily_rate || target?.wage_rate || 0);
    const balance = fin.balance !== undefined && fin.balance !== null
      ? Number(fin.balance)
      : dailyWage;
    const amountVal = balance > 0 ? String(balance) : (dailyWage > 0 ? String(dailyWage) : '');

    setSalaryForm({
      employee_id: target ? String(target.id) : '',
      project_id: target?.primary_project || selectedProjectId || (projects[0]?.id ? String(projects[0].id) : ''),
      amount: amountVal,
      date: new Date().toISOString().split('T')[0],
      payment_mode: 'CASH',
      notes: target ? `Full salary payout for ${target.full_name}` : 'Full salary payout',
      status: isOrgAdmin ? 'paid' : 'pending',
    });
    setIsSalaryModalOpen(true);
  };

  // Salary Payout Submit Handler
  const handleDisburseSalary = async (e) => {
    e.preventDefault();
    if (!salaryForm.employee_id) {
      toast.error('Please select a worker');
      return;
    }
    const worker = employees.find((emp) => String(emp.id) === String(salaryForm.employee_id));
    const fin = worker?.financials || {};
    const hasAttendance = Boolean(
      fin.has_attendance || (fin.total_pagar && Number(fin.total_pagar) > 0)
    );
    if (!hasAttendance) {
      toast.error('Cannot pay wages to an employee without marked attendance. Attendance must be recorded first.');
      return;
    }
    if (!salaryForm.amount || Number(salaryForm.amount) <= 0) {
      toast.error('Please enter a valid salary amount');
      return;
    }

    setSubmitting(true);
    try {
      await api.payments.create({
        employee: Number(salaryForm.employee_id),
        employee_id: Number(salaryForm.employee_id),
        project: salaryForm.project_id ? Number(salaryForm.project_id) : (worker?.primary_project || null),
        project_id: salaryForm.project_id ? Number(salaryForm.project_id) : (worker?.primary_project || null),
        amount: Number(salaryForm.amount),
        method: salaryForm.payment_mode.toLowerCase(),
        payment_mode: salaryForm.payment_mode.toUpperCase(),
        type: 'salary',
        payment_type: 'SALARY',
        status: isOrgAdmin ? (salaryForm.status || 'paid') : 'pending',
        date_from: salaryForm.date,
        date_to: salaryForm.date,
        date: salaryForm.date,
        description: salaryForm.notes.trim() || `Full salary payment for ${worker?.full_name || 'worker'}`,
      });

      setIsSalaryModalOpen(false);
      toast.success(
        isOrgAdmin
          ? 'Salary payout recorded successfully! Reflected in ledger, payroll, and worker balance.'
          : 'Salary payout submitted as pending! Org Admin approval required.'
      );
      await fetchData();
    } catch (err) {
      toast.error(`Error disbursing salary: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Create Payroll Run
  const handleCreateRun = async (e) => {
    e.preventDefault();
    if (!runForm.project_id) {
      toast.error('Please select a project site');
      return;
    }
    if (!runForm.period_start || !runForm.period_end) {
      toast.error('Please specify start and end dates');
      return;
    }

    setSubmitting(true);
    try {
      await api.payroll.createRun({
        project_id: Number(runForm.project_id),
        period_start: runForm.period_start,
        period_end: runForm.period_end,
      });
      setIsRunModalOpen(false);
      toast.success('Payroll run generated! Vouchers calculated from locked attendance and active Upad advances.');
      await fetchData();
    } catch (err) {
      toast.error(`Error generating payroll: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Approve Payroll Run
  const handleApproveRun = async (runId) => {
    if (!window.confirm('Approve payroll run? This will post gross wages to the General Ledger and lock adjustments.')) {
      return;
    }
    try {
      await api.payroll.approveRun(runId);
      toast.success('Payroll run approved and posted to General Ledger!');
      await fetchData();
    } catch (err) {
      toast.error(`Approval error: ${err.message}`);
    }
  };

  // Recalculate Payroll Run
  const handleRecalculateRun = async (runId) => {
    try {
      await api.payroll.recalculateRun(runId);
      toast.success('Payroll run recalculated successfully!');
      await fetchData();
    } catch (err) {
      toast.error(`Recalculation error: ${err.message}`);
    }
  };

  // Delete Payroll Run
  const handleDeleteRun = async (runId) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this payroll run? This will remove the run, delete its itemized vouchers, and reverse any posted ledger entries.'
      )
    ) {
      return;
    }
    try {
      await api.payroll.deleteRun(runId);
      toast.success('Payroll run deleted successfully.');
      await fetchData();
    } catch (err) {
      toast.error(`Delete error: ${err.message}`);
    }
  };

  // Mark Voucher Paid
  const handleMarkPaid = async (voucherId) => {
    const ref = prompt('Enter payment transaction reference (e.g. UPI-TXN-101):', `TXN-${Date.now()}`);
    if (!ref) return;
    try {
      await api.payroll.markVoucherPaid(voucherId, ref);
      toast.success('Voucher marked as paid.');
      await fetchData();
    } catch (err) {
      toast.error(`Payment error: ${err.message}`);
    }
  };

  // Create Cash Advance
  const handleCreateAdvance = async (e) => {
    e.preventDefault();
    if (!advanceForm.employee) {
      toast.error('Please select an employee');
      return;
    }
    if (!advanceForm.amount || Number(advanceForm.amount) <= 0) {
      toast.error('Please enter a valid advance amount');
      return;
    }

    setSubmitting(true);
    try {
      await api.payroll.createAdvance({
        ...advanceForm,
        project: advanceForm.project ? Number(advanceForm.project) : null,
        employee: Number(advanceForm.employee),
      });
      setIsAdvanceModalOpen(false);
      setAdvanceForm({
        project: selectedProjectId || '',
        employee: '',
        amount: '',
        advance_date: new Date().toISOString().split('T')[0],
        reason: '',
        payment_mode: 'CASH',
      });
      toast.success('Worker advance recorded and posted to Asset account 1100.');
      await fetchData();
    } catch (err) {
      toast.error(`Error recording advance: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Cash Advance
  const handleDeleteAdvance = async (advanceId) => {
    if (!window.confirm('Are you sure you want to delete this advance? Any linked Upad payment will also be deleted.')) {
      return;
    }
    try {
      await api.payroll.deleteAdvance(advanceId);
      toast.success('Advance deleted successfully');
      await fetchData();
    } catch (err) {
      toast.error(`Could not delete advance: ${err.message}`);
    }
  };

  // Download PDF Payslip
  const handleDownloadPayslip = async (voucherId, voucherNum) => {
    try {
      const blob = await api.payroll.downloadVoucherPdf(voucherId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payslip_${voucherNum || voucherId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Payslip downloaded successfully');
    } catch (err) {
      toast.error(`Could not download payslip: ${err.message}`);
    }
  };

  // Export Salary Records to CSV
  const handleExportSalariesCSV = () => {
    if (filteredEmployees.length === 0) {
      toast.error('No salary records to export');
      return;
    }
    const headers = [
      'SR_NO,EMPLOYEE_NAME,EMPLOYEE_CODE,TRADE_OR_ROLE,PROJECT,ATTENDANCE_STATUS,DAILY_RATE,TOTAL_PAGAR_EARNED,UPAD_ADVANCE_DEDUCTED,TOTAL_PAID,NET_SALARY_DUE',
    ];
    const rows = filteredEmployees.map((emp, idx) => {
      const fin = emp.financials || {};
      const dailyWage = Number(emp.daily_rate || emp.wage_rate || 0);
      const pagar = Number(fin.total_pagar || (fin.has_attendance ? dailyWage : 0));
      const upad = Number(fin.total_upad || 0);
      const paid = Number(fin.total_paid || 0);
      const balance = fin.balance !== undefined && fin.balance !== null
        ? Number(fin.balance)
        : Math.max(0, pagar - upad - paid);
      const projName = emp.primary_project_name || (projects.find((p) => p.id === emp.primary_project)?.name) || 'All Sites';
      const attText = fin.has_attendance ? `${fin.attendance_days || 'Marked'} Days` : 'No Attendance';

      return [
        idx + 1,
        `"${(emp.full_name || '').replace(/"/g, '""')}"`,
        `"${emp.employee_code || ''}"`,
        `"${emp.trade || emp.role || 'Worker'}"`,
        `"${projName.replace(/"/g, '""')}"`,
        `"${attText}"`,
        dailyWage,
        pagar,
        upad,
        paid,
        balance,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Salary_Ledger_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Salary records exported to CSV!');
  };

  // Export Advances to CSV
  const handleExportAdvancesCSV = () => {
    if (filteredAdvances.length === 0) {
      toast.error('No advance records to export');
      return;
    }
    const headers = ['SR_NO,DATE,EMPLOYEE,PROJECT,AMOUNT,PAYMENT_MODE,REASON,STATUS'];
    const rows = filteredAdvances.map((adv, idx) => {
      return [
        idx + 1,
        adv.advance_date,
        `"${(adv.employee_name || `Worker #${adv.employee}`).replace(/"/g, '""')}"`,
        `"${(adv.project_name || 'General Site').replace(/"/g, '""')}"`,
        adv.amount,
        adv.payment_mode,
        `"${(adv.reason || 'Cash Advance').replace(/"/g, '""')}"`,
        adv.status,
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Worker_Advances_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Advance records exported to CSV!');
  };

  // Access restriction guard
  if (!['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'employee/labour', 'EMPLOYEE', 'LABOUR'].includes(role)) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <ShieldAlert className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Payroll Access Restricted</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Payroll generation and salary voucher management are restricted to Organization Admins, Site Managers, Project Managers, and registered Employees.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & QUICK ACTION BAR                                          */}
      {/* ========================================================================= */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white truncate">
              {isEmployeeLabour ? 'My Salary & Payslips' : 'Payroll & Wage Management'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
              {isEmployeeLabour ? 'Employee Portal' : role === 'ORG_ADMIN' ? 'Org Admin' : 'Site Manager'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isEmployeeLabour
              ? 'Review your accrued daily wages, cash advances (Upad), disbursements, and official payslips.'
              : 'Biometric wage calculation, cash advance (Upad) deductions, and official payslip disbursements.'}
          </p>
        </div>

        {/* Action Buttons - Always in ONE Single Line */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-nowrap overflow-x-auto pb-1 xl:pb-0">
          {/* CSV Export Button */}
          <button
            onClick={activeTab === 'advances' ? handleExportAdvancesCSV : handleExportSalariesCSV}
            className="px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
            title="Export Records to CSV"
          >
            <FileDown size={15} className="shrink-0" />
            <span>Export CSV</span>
          </button>

          {/* Manager Actions */}
          {canManagePayroll && !isEmployeeLabour && (
            <>
              <button
                onClick={() => setIsAdvanceModalOpen(true)}
                className="px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
              >
                <IndianRupee size={15} className="text-amber-500 shrink-0" />
                <span>Record Advance</span>
              </button>

              <button
                onClick={() => setIsRunModalOpen(true)}
                className="px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
              >
                <Plus size={15} className="shrink-0" />
                <span>Calculate Weekly Run</span>
              </button>

              <button
                onClick={() => openSalaryModal()}
                className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95 shrink-0 whitespace-nowrap"
              >
                <Wallet size={15} className="shrink-0" />
                <span>Pay Full Salary</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE METRIC SUMMARY CARDS                                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Workers / Payees */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Users size={22} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {isEmployeeLabour ? 'Assigned Trade' : 'Active Workers'}
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              {isEmployeeLabour
                ? employees[0]?.trade || employees[0]?.role || 'Worker'
                : metrics.activeWorkers}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {isEmployeeLabour ? `Code: ${employees[0]?.employee_code || 'EMP-1'}` : 'Across project sites'}
            </div>
          </div>
        </div>

        {/* Card 2: Total Earned / Accrued Pagar */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Banknote size={22} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {isEmployeeLabour ? 'Total Earned (Pagar)' : 'Total Accrued Pagar'}
            </div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
              {formatCurrency(metrics.totalPagar)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Computed from attendance
            </div>
          </div>
        </div>

        {/* Card 3: Cash Advances Deducted (Upad) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <IndianRupee size={22} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Advances Deducted (Upad)
            </div>
            <div className="text-2xl font-black text-rose-500 mt-0.5">
              -{formatCurrency(metrics.totalUpad)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Upad cash disbursed
            </div>
          </div>
        </div>

        {/* Card 4: Net Outstanding Salary */}
        <div className="p-5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/30 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Wallet size={22} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              {isEmployeeLabour ? 'Net Balance Due' : 'Net Salary Payable'}
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatCurrency(metrics.totalBalance)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Direct settlement balance
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. NAVIGATION TABS                                                        */}
      {/* ========================================================================= */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('salaries')}
          className={cn(
            'pb-3 text-xs sm:text-sm font-black transition-all flex items-center gap-2 relative cursor-pointer',
            activeTab === 'salaries'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          )}
        >
          <Wallet size={16} />
          <span>{isEmployeeLabour ? 'My Salary & Ledger' : 'Worker Salaries & Payouts'}</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-bold',
              activeTab === 'salaries'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            )}
          >
            {filteredEmployees.length}
          </span>
          {activeTab === 'salaries' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('runs')}
          className={cn(
            'pb-3 text-xs sm:text-sm font-black transition-all flex items-center gap-2 relative cursor-pointer',
            activeTab === 'runs'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          )}
        >
          <Layers size={16} />
          <span>Payroll Runs & Cycles</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-bold',
              activeTab === 'runs'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            )}
          >
            {runs.length}
          </span>
          {activeTab === 'runs' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('advances')}
          className={cn(
            'pb-3 text-xs sm:text-sm font-black transition-all flex items-center gap-2 relative cursor-pointer',
            activeTab === 'advances'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          )}
        >
          <IndianRupee size={16} />
          <span>Cash Advances (Upad)</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-bold',
              activeTab === 'advances'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            )}
          >
            {advances.length}
          </span>
          {activeTab === 'advances' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. TAB 1: WORKER SALARIES & FULL PAYMENTS                                 */}
      {/* ========================================================================= */}
      {activeTab === 'salaries' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Search */}
              <div className="relative min-w-[240px] sm:min-w-[280px]">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search worker by name, trade, code..."
                  value={salarySearch}
                  onChange={(e) => {
                    setSalarySearch(e.target.value);
                    setSalaryPage(1);
                  }}
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
                {salarySearch && (
                  <button
                    onClick={() => setSalarySearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Project Filter */}
              <select
                value={salaryProjectFilter}
                onChange={(e) => {
                  setSalaryProjectFilter(e.target.value);
                  setSalaryPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
              >
                <option value="all">All Project Sites</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={salaryStatusFilter}
                onChange={(e) => {
                  setSalaryStatusFilter(e.target.value);
                  setSalaryPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
              >
                <option value="all">All Balances</option>
                <option value="due">Salary Due Only</option>
                <option value="settled">Fully Settled</option>
              </select>
            </div>

            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Showing <span className="text-slate-900 dark:text-white">{filteredEmployees.length}</span> workers
            </div>
          </div>

          {/* Master Table: Worker Salary Ledger */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            {/* Top Table Header Banner */}
            <div className="py-3 px-6 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-blue-600 dark:text-blue-400" />
                <span className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Worker Salary Ledger & Settlements
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Sorted by outstanding salary
              </span>
            </div>

            {loading ? (
              <div className="p-16 text-center text-xs text-slate-400 font-semibold flex flex-col items-center gap-2">
                <RefreshCw size={24} className="animate-spin text-blue-500" />
                <span>Loading payroll & wage ledger...</span>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-16 text-center text-xs text-slate-400 font-semibold">
                No worker salary records found matching current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/40 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      <th className="py-3.5 px-5 font-black">Worker Details</th>
                      <th className="py-3.5 px-5 font-black">Project Site</th>
                      <th className="py-3.5 px-5 text-center font-black">Attendance Log</th>
                      <th className="py-3.5 px-5 text-right font-black">Daily Wage</th>
                      <th className="py-3.5 px-5 text-right font-black">Total Earned</th>
                      <th className="py-3.5 px-5 text-right font-black">Upad Advance</th>
                      <th className="py-3.5 px-5 text-right font-black">Total Paid</th>
                      <th className="py-3.5 px-5 text-right font-black">Net Salary Due</th>
                      <th className="py-3.5 px-5 text-center font-black">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedEmployees.map((emp) => {
                      const fin = emp.financials || {};
                      const dailyWage = Number(emp.daily_rate || emp.wage_rate || 0);
                      const hasAttendance = Boolean(
                        fin.has_attendance || (fin.total_pagar && Number(fin.total_pagar) > 0)
                      );
                      const pagar = Number(fin.total_pagar || (hasAttendance ? dailyWage : 0));
                      const upad = Number(fin.total_upad || 0);
                      const paid = Number(fin.total_paid || 0);
                      const balance = fin.balance !== undefined && fin.balance !== null
                        ? Number(fin.balance)
                        : Math.max(0, pagar - upad - paid);

                      const projName = emp.primary_project_name || (projects.find((p) => p.id === emp.primary_project)?.name) || 'All Sites';
                      const initial = (emp.full_name || 'W').charAt(0).toUpperCase();

                      return (
                        <tr
                          key={emp.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          {/* Worker Details */}
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs shrink-0">
                                {initial}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>{emp.full_name}</span>
                                  {emp.employee_code && (
                                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                      {emp.employee_code}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                  <span>{emp.trade || emp.role || 'Worker'}</span>
                                  {emp.phone && (
                                    <>
                                      <span>•</span>
                                      <span>{emp.phone}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Project Site */}
                          <td className="py-3.5 px-5 font-semibold text-slate-700 dark:text-slate-300">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              {projName}
                            </span>
                          </td>

                          {/* Attendance Units */}
                          <td className="py-3.5 px-5 text-center">
                            {hasAttendance ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                {fin.attendance_days ? `${fin.attendance_days} Days Marked` : 'Marked Present'}
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                No Attendance
                              </span>
                            )}
                          </td>

                          {/* Daily Rate */}
                          <td className="py-3.5 px-5 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                            ₹{dailyWage.toFixed(0)}/d
                          </td>

                          {/* Total Earned (Pagar) */}
                          <td className="py-3.5 px-5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(pagar)}
                          </td>

                          {/* Upad Advance Taken */}
                          <td className="py-3.5 px-5 text-right font-mono font-bold">
                            {upad > 0 ? (
                              <span className="text-rose-500">-{formatCurrency(upad)}</span>
                            ) : (
                              <span className="text-slate-400 font-normal">₹0</span>
                            )}
                          </td>

                          {/* Total Paid */}
                          <td className="py-3.5 px-5 text-right font-mono font-semibold text-slate-500 dark:text-slate-400">
                            {formatCurrency(paid)}
                          </td>

                          {/* Net Balance Due */}
                          <td className="py-3.5 px-5 text-right font-mono font-black">
                            {balance > 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400 text-sm">
                                {formatCurrency(balance)}
                              </span>
                            ) : balance < 0 ? (
                              <span className="text-rose-600 dark:text-rose-400 text-sm">
                                {formatCurrency(balance)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-semibold">₹0</span>
                            )}
                          </td>

                          {/* Action Button */}
                          <td className="py-3.5 px-5 text-center">
                            {!isEmployeeLabour ? (
                              balance > 0 ? (
                                <button
                                  onClick={() => openSalaryModal(emp)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] inline-flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                                  title="Disburse full/partial salary to worker"
                                >
                                  <Wallet size={12} />
                                  <span>Pay Salary</span>
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 size={13} />
                                  <span>Fully Settled</span>
                                </span>
                              )
                            ) : (
                              <span
                                className={cn(
                                  'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider',
                                  balance > 0
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                )}
                              >
                                {balance > 0 ? 'Salary Due' : 'Paid'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Summary Totals Footer */}
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 font-black text-slate-900 dark:text-white">
                      <td colSpan={4} className="py-3 px-5 text-right uppercase tracking-wider text-[10px] text-slate-500">
                        Page & Filter Totals:
                      </td>
                      <td className="py-3 px-5 text-right font-mono text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(metrics.totalPagar)}
                      </td>
                      <td className="py-3 px-5 text-right font-mono text-rose-500">
                        -{formatCurrency(metrics.totalUpad)}
                      </td>
                      <td className="py-3 px-5 text-right font-mono text-slate-500 dark:text-slate-400">
                        {formatCurrency(metrics.totalPaid)}
                      </td>
                      <td className="py-3 px-5 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatCurrency(metrics.totalBalance)}
                      </td>
                      <td className="py-3 px-5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalSalaryPages > 1 && (
              <div className="py-3 px-6 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  Page {salaryPage} of {totalSalaryPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={salaryPage <= 1}
                    onClick={() => setSalaryPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={salaryPage >= totalSalaryPages}
                    onClick={() => setSalaryPage((p) => Math.min(totalSalaryPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Direct Salary Disbursements History Table */}
          {salaryDisbursements.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="py-3 px-6 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote size={16} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Recent Direct Salary Disbursements ({salaryDisbursements.length})
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Recorded salary payment transactions
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/40 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      <th className="py-3.5 px-5 font-black">Date</th>
                      <th className="py-3.5 px-5 font-black">Worker</th>
                      <th className="py-3.5 px-5 font-black">Project</th>
                      <th className="py-3.5 px-5 text-right font-black">Amount</th>
                      <th className="py-3.5 px-5 text-center font-black">Mode</th>
                      <th className="py-3.5 px-5 text-center font-black">Status</th>
                      <th className="py-3.5 px-5 font-black">Reference / Notes</th>
                      <th className="py-3.5 px-5 text-center font-black">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {salaryDisbursements.slice(0, 10).map((sal) => {
                      const rawDate = sal.date_from || sal.date || (sal.created_at ? sal.created_at.split('T')[0] : '');
                      const formattedDate = formatDateDMY(rawDate);

                      return (
                        <tr key={sal.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-5 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {formattedDate}
                          </td>
                          <td className="py-3 px-5">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {sal.employee_name || `Worker #${sal.employee}`}
                            </span>
                            {sal.employee_trade && (
                              <div className="text-[10px] text-slate-400">{sal.employee_trade}</div>
                            )}
                          </td>
                          <td className="py-3 px-5 font-semibold text-slate-700 dark:text-slate-300">
                            {sal.project_name || 'All Sites'}
                          </td>
                          <td className="py-3 px-5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(sal.amount)}
                          </td>
                          <td className="py-3 px-5 text-center">
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {(sal.method || 'CASH').toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-center">
                            <Badge status={sal.status}>{sal.status?.toUpperCase() || 'PAID'}</Badge>
                          </td>
                          <td className="py-3 px-5 text-slate-500 dark:text-slate-400 text-[11px] max-w-xs truncate">
                            {sal.description || 'Full salary payment'}
                          </td>
                          <td className="py-3 px-5 text-center">
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                              <CheckCircle2 size={13} />
                              <span>Disbursed</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB 2: PAYROLL RUNS & ITEMIZED VOUCHERS                                 */}
      {/* ========================================================================= */}
      {activeTab === 'runs' && (
        <div className="space-y-6">
          {loading ? (
            <div className="p-16 text-center text-xs text-slate-400 font-semibold flex flex-col items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <RefreshCw size={24} className="animate-spin text-blue-500" />
              <span>Loading payroll calculation cycles...</span>
            </div>
          ) : runs.length === 0 ? (
            <div className="p-16 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-14 h-14 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <Layers size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">No Payroll Runs Generated Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                {isEmployeeLabour
                  ? 'No weekly payroll vouchers found for your account yet.'
                  : 'Click "Calculate Weekly Run" above to compute attendance wages and advance deductions for a site project.'}
              </p>
              {canManagePayroll && !isEmployeeLabour && (
                <button
                  onClick={() => setIsRunModalOpen(true)}
                  className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs inline-flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                >
                  <Plus size={15} />
                  <span>Calculate Weekly Run</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {runs.map((r) => {
                const isExpanded = expandedRunId === r.id;
                const vouchers = r.vouchers || [];
                const grossTotal = Number(r.total_gross) > 0 ? Number(r.total_gross) : vouchers.reduce((acc, v) => acc + Number(v.gross_pay || 0), 0);
                const advanceTotal = Number(r.total_advances ?? r.total_advances_deducted) > 0
                  ? Number(r.total_advances ?? r.total_advances_deducted)
                  : vouchers.reduce((acc, v) => acc + Number(v.advances_deducted || 0), 0);
                const netTotal = Number(r.total_net) > 0 ? Number(r.total_net) : vouchers.reduce((acc, v) => acc + Number(v.net_pay || 0), 0);

                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all"
                  >
                    {/* Header Summary Row */}
                    <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                      {/* Left: Expand Chevron & Run Details */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setExpandedRunId(isExpanded ? null : r.id)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                          title={isExpanded ? 'Collapse vouchers' : 'Expand vouchers'}
                        >
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-1.5">
                              <Calendar size={15} className="text-blue-500" />
                              <span>{formatDateDMY(r.period_start)} → {formatDateDMY(r.period_end)}</span>
                            </span>
                            <Badge status={r.status}>{r.status}</Badge>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                            <span>Project: <strong className="text-slate-700 dark:text-slate-300">{r.project_name || `Site #${r.project}`}</strong></span>
                            <span>•</span>
                            <span>Vouchers: <strong className="text-slate-700 dark:text-slate-300">{vouchers.length}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Metrics & Actions */}
                      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                        {/* Gross */}
                        <div className="text-right">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Gross</div>
                          <div className="font-mono font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                            {formatCurrency(grossTotal)}
                          </div>
                        </div>

                        {/* Advances Deducted */}
                        <div className="text-right">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Advances</div>
                          <div className="font-mono font-bold text-rose-500 text-sm sm:text-base">
                            -{formatCurrency(advanceTotal)}
                          </div>
                        </div>

                        {/* Net Disbursed */}
                        <div className="text-right">
                          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Net Payable</div>
                          <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm sm:text-base">
                            {formatCurrency(netTotal)}
                          </div>
                        </div>

                        {/* Recalculate Button (for Draft Runs) */}
                        {r.status === 'DRAFT' && canManagePayroll && !isEmployeeLabour && (
                          <button
                            onClick={() => handleRecalculateRun(r.id)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                            title="Recalculate vouchers from attendance"
                          >
                            <RefreshCw size={15} />
                          </button>
                        )}

                        {/* Approve Button */}
                        {r.status === 'DRAFT' && canManagePayroll && !isEmployeeLabour && (
                          <button
                            onClick={() => handleApproveRun(r.id)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                          >
                            <CheckCircle size={14} />
                            <span>Approve & Post</span>
                          </button>
                        )}

                        {/* Delete Button */}
                        {canManagePayroll && !isEmployeeLabour && (
                          <button
                            onClick={() => handleDeleteRun(r.id)}
                            className="p-2 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                            title="Delete this payroll run"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Itemized Vouchers Table */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                            Itemized Worker Payslips & Deductions ({vouchers.length})
                          </h4>
                          <span className="text-[11px] text-slate-400">
                            Computed from biometric attendance & active FIFO cash advances
                          </span>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/40 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                  <th className="py-3 px-4 font-black">Worker</th>
                                  <th className="py-3 px-4 font-black">Attendance Units</th>
                                  <th className="py-3 px-4 text-right font-black">Daily Rate</th>
                                  <th className="py-3 px-4 text-right font-black">Gross Pay</th>
                                  <th className="py-3 px-4 text-right font-black">Advance Deduction</th>
                                  <th className="py-3 px-4 text-right font-black">Net Pay</th>
                                  <th className="py-3 px-4 text-center font-black">Status</th>
                                  <th className="py-3 px-4 text-center font-black">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {vouchers.map((v) => (
                                  <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                                    <td className="py-3 px-4">
                                      <div className="font-bold text-slate-900 dark:text-white">
                                        {v.employee_name || `Worker #${v.employee}`}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        {v.trade || v.employee_trade || 'Trade Worker'}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                      <span className="font-semibold">
                                        {v.days_present} Present + {v.half_days} Half ({Number(v.ot_hours || 0)}h OT)
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                                      ₹{Number(v.daily_rate_used ?? v.daily_rate ?? 0).toFixed(0)}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                      {formatCurrency(v.gross_pay)}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-bold">
                                      {Number(v.advances_deducted) > 0 ? (
                                        <span className="text-rose-500">-{formatCurrency(v.advances_deducted)}</span>
                                      ) : (
                                        <span className="text-slate-400 font-normal">₹0</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                                      {formatCurrency(v.net_pay)}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <Badge status={v.status}>{v.status}</Badge>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          onClick={() => handleDownloadPayslip(v.id, v.voucher_number)}
                                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-all"
                                          title="Download Official Payslip PDF"
                                        >
                                          <Download size={12} />
                                          <span>Payslip</span>
                                        </button>

                                        {(v.status === 'DRAFT' || v.status === 'APPROVED') && canManagePayroll && !isEmployeeLabour ? (
                                          <button
                                            onClick={() => handleMarkPaid(v.id)}
                                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all cursor-pointer"
                                          >
                                            Mark Paid
                                          </button>
                                        ) : v.status === 'PAID' ? (
                                          <span className="text-[10px] text-emerald-600 font-bold">Paid</span>
                                        ) : null}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>

                              {/* Vouchers Total Footer */}
                              <tfoot>
                                <tr className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-black text-slate-900 dark:text-white">
                                  <td colSpan={3} className="py-2.5 px-4 text-right uppercase tracking-wider text-[10px] text-slate-500">
                                    Vouchers Total:
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400">
                                    {formatCurrency(vouchers.reduce((acc, v) => acc + Number(v.gross_pay || 0), 0))}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono text-rose-500">
                                    -{formatCurrency(vouchers.reduce((acc, v) => acc + Number(v.advances_deducted || 0), 0))}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(vouchers.reduce((acc, v) => acc + Number(v.net_pay || 0), 0))}
                                  </td>
                                  <td colSpan={2}></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB 3: CASH ADVANCES (UPAD)                                            */}
      {/* ========================================================================= */}
      {activeTab === 'advances' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative min-w-[240px] sm:min-w-[280px]">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search advances by worker, reason..."
                  value={advanceSearch}
                  onChange={(e) => {
                    setAdvanceSearch(e.target.value);
                    setAdvancePage(1);
                  }}
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
                {advanceSearch && (
                  <button
                    onClick={() => setAdvanceSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <select
                value={advanceProjectFilter}
                onChange={(e) => {
                  setAdvanceProjectFilter(e.target.value);
                  setAdvancePage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
              >
                <option value="all">All Project Sites</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={advanceStatusFilter}
                onChange={(e) => {
                  setAdvanceStatusFilter(e.target.value);
                  setAdvancePage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="OPEN">Open / Active</option>
                <option value="DEDUCTED">Deducted / Cleared</option>
              </select>
            </div>

            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Showing <span className="text-slate-900 dark:text-white">{filteredAdvances.length}</span> advances
            </div>
          </div>

          {/* Advances Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="py-3 px-6 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IndianRupee size={16} className="text-amber-500" />
                <span className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Worker Cash Advances (Upad) Records
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Short-term cash loans settled via weekly wages
              </span>
            </div>

            {loading ? (
              <div className="p-16 text-center text-xs text-slate-400 font-semibold flex flex-col items-center gap-2">
                <RefreshCw size={24} className="animate-spin text-blue-500" />
                <span>Loading worker advance records...</span>
              </div>
            ) : filteredAdvances.length === 0 ? (
              <div className="p-16 text-center text-xs text-slate-400 font-semibold">
                No advance records found matching filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/40 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      <th className="py-3.5 px-5 font-black">Date</th>
                      <th className="py-3.5 px-5 font-black">Worker Details</th>
                      <th className="py-3.5 px-5 font-black">Project Site</th>
                      <th className="py-3.5 px-5 text-right font-black">Amount Disbursed</th>
                      <th className="py-3.5 px-5 text-center font-black">Payment Mode</th>
                      <th className="py-3.5 px-5 font-black">Reason / Emergency Note</th>
                      <th className="py-3.5 px-5 text-center font-black">Status</th>
                      <th className="py-3.5 px-5 text-center font-black">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedAdvances.map((adv) => {
                      const formattedDate = formatDateDMY(adv.advance_date);

                      return (
                        <tr key={adv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-5 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {formattedDate}
                          </td>
                          <td className="py-3 px-5">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {adv.employee_name || `Worker #${adv.employee}`}
                            </div>
                            {adv.employee_code && (
                              <div className="text-[10px] text-slate-400 font-mono">Code: {adv.employee_code}</div>
                            )}
                          </td>
                          <td className="py-3 px-5 font-semibold text-slate-700 dark:text-slate-300">
                            {adv.project_name || `Site #${adv.project}`}
                          </td>
                          <td className="py-3 px-5 text-right font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                            {formatCurrency(adv.amount)}
                          </td>
                          <td className="py-3 px-5 text-center">
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {adv.payment_mode}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-slate-600 dark:text-slate-400 text-[11px] max-w-xs truncate">
                            {adv.reason || 'Personal / emergency advance'}
                          </td>
                          <td className="py-3 px-5 text-center">
                            <Badge status={adv.status}>{adv.status}</Badge>
                          </td>
                          <td className="py-3 px-5 text-center">
                            {adv.status === 'OPEN' && canManagePayroll && !isEmployeeLabour ? (
                              <button
                                onClick={() => handleDeleteAdvance(adv.id)}
                                className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                                title="Delete Advance"
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot>
                    <tr className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-black text-slate-900 dark:text-white">
                      <td colSpan={3} className="py-3 px-5 text-right uppercase tracking-wider text-[10px] text-slate-500">
                        Total Advances:
                      </td>
                      <td className="py-3 px-5 text-right font-mono text-amber-600 dark:text-amber-400 text-sm">
                        {formatCurrency(filteredAdvances.reduce((acc, a) => acc + Number(a.amount || 0), 0))}
                      </td>
                      <td colSpan={4} className="py-3 px-5 text-[11px] text-slate-400">
                        {filteredAdvances.length} advance transactions recorded
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalAdvancePages > 1 && (
              <div className="py-3 px-6 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  Page {advancePage} of {totalAdvancePages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={advancePage <= 1}
                    onClick={() => setAdvancePage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={advancePage >= totalAdvancePages}
                    onClick={() => setAdvancePage((p) => Math.min(totalAdvancePages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODALS (Calculate Run, Record Advance, Pay Full Salary)                */}
      {/* ========================================================================= */}

      {/* Calculate Run Modal */}
      <Modal isOpen={isRunModalOpen} onClose={() => setIsRunModalOpen(false)} title="Calculate Weekly Payroll Run">
        <form onSubmit={handleCreateRun} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Site Project *
            </label>
            <select
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
              value={runForm.project_id}
              onChange={(e) => setRunForm({ ...runForm, project_id: e.target.value })}
            >
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Period Start *
              </label>
              <input
                type="date"
                required
                max={todayStr}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                value={runForm.period_start}
                onChange={(e) => setRunForm({ ...runForm, period_start: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Period End *
              </label>
              <input
                type="date"
                required
                max={todayStr}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                value={runForm.period_end}
                onChange={(e) => setRunForm({ ...runForm, period_end: e.target.value })}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[11px] leading-relaxed">
            Automatic calculation reads locked biometric attendance and automatically recovers outstanding FIFO cash advances (Upad) from weekly wages.
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsRunModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Computing...' : 'Calculate Vouchers'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Advance Modal */}
      <Modal isOpen={isAdvanceModalOpen} onClose={() => setIsAdvanceModalOpen(false)} title="Record Cash Advance to Worker">
        <form onSubmit={handleCreateAdvance} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Site Project *
            </label>
            <select
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
              value={advanceForm.project}
              onChange={(e) => setAdvanceForm({ ...advanceForm, project: e.target.value })}
            >
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Worker *
            </label>
            <select
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
              value={advanceForm.employee}
              onChange={(e) => setAdvanceForm({ ...advanceForm, employee: e.target.value })}
            >
              <option value="">Select Worker</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name} ({e.trade || 'Worker'}) • {e.employee_code || `EMP-${e.id}`}
                </option>
              ))}
            </select>
          </div>

          {/* Live Salary & Advance Breakdown */}
          {advanceForm.employee && (() => {
            const worker = employees.find((e) => String(e.id) === String(advanceForm.employee));
            if (!worker) return null;
            const dailyWage = Number(worker.daily_rate || worker.wage_rate || 0);
            const curBal = Number(worker.financials?.balance ?? (dailyWage || 0));
            const entered = Number(advanceForm.amount || 0);
            const remaining = Math.max(0, curBal - entered);
            return (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 mb-2">
                  <span>Upad & Salary Breakdown</span>
                  <span className="text-blue-600 dark:text-blue-400">{worker.full_name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-[9px] font-black uppercase text-slate-400">Daily Wage</div>
                    <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5">₹{dailyWage}</div>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-[9px] font-black uppercase text-slate-400">Current Bal</div>
                    <div className="text-xs font-black text-blue-600 dark:text-blue-400 mt-0.5">₹{curBal}</div>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-[9px] font-black uppercase text-slate-400">Remaining</div>
                    <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5">₹{remaining}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                placeholder="1500"
                value={advanceForm.amount}
                onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Advance Date *
              </label>
              <input
                type="date"
                required
                max={todayStr}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                value={advanceForm.advance_date}
                onChange={(e) => setAdvanceForm({ ...advanceForm, advance_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mode *
              </label>
              <select
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                value={advanceForm.payment_mode}
                onChange={(e) => setAdvanceForm({ ...advanceForm, payment_mode: e.target.value })}
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Reason / Emergency Note *
            </label>
            <input
              type="text"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
              placeholder="e.g. Medical assistance / family emergency"
              value={advanceForm.reason}
              onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsAdvanceModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Disburse Advance'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Pay Full Salary Modal */}
      <Modal
        isOpen={isSalaryModalOpen}
        onClose={() => setIsSalaryModalOpen(false)}
        title="Disburse Full Salary / Wages"
        subtitle="Disburse employee salary and immediately reflect in ledgers, attendance, and worker balance"
      >
        <form onSubmit={handleDisburseSalary} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Worker *
            </label>
            <select
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
              value={salaryForm.employee_id}
              onChange={(e) => {
                const empId = e.target.value;
                const worker = employees.find((w) => String(w.id) === String(empId));
                const fin = worker?.financials || {};
                const dailyWage = Number(worker?.daily_rate || worker?.wage_rate || 0);
                const curBal = Number(fin.balance ?? (dailyWage || 0));
                setSalaryForm({
                  ...salaryForm,
                  employee_id: empId,
                  project_id: worker?.primary_project ? String(worker.primary_project) : salaryForm.project_id,
                  amount: curBal > 0 ? String(curBal) : (dailyWage > 0 ? String(dailyWage) : ''),
                  notes: worker ? `Full salary payout for ${worker.full_name}` : '',
                });
              }}
            >
              <option value="">Select Worker</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name} ({e.trade || e.role || 'Worker'}) • {e.employee_code || `EMP-${e.id}`}
                </option>
              ))}
            </select>
          </div>

          {/* Live Salary Breakdown & Upad Status Card */}
          {selectedSalaryWorker && (() => {
            const fin = selectedSalaryWorker.financials || {};
            const dailyWage = Number(selectedSalaryWorker.daily_rate || selectedSalaryWorker.wage_rate || 0);
            const pagar = Number(fin.total_pagar || (dailyWage || 0));
            const upad = Number(fin.total_upad || 0);
            const paid = Number(fin.total_paid || 0);
            const balance = fin.balance !== undefined && fin.balance !== null
              ? Number(fin.balance)
              : Math.max(0, pagar - upad - paid);
            const hasAttendance = Boolean(
              fin.has_attendance || (fin.total_pagar && Number(fin.total_pagar) > 0)
            );

            return (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                  <span>Salary & Wage Computation</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">{selectedSalaryWorker.full_name}</span>
                </div>

                {!hasAttendance && (
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>Worker has no marked attendance yet. Please record attendance first.</span>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-[9px] font-black uppercase text-slate-400">Daily Rate</div>
                    <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5">₹{dailyWage}</div>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-[9px] font-black uppercase text-slate-400">Total Pagar</div>
                    <div className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-0.5">₹{pagar}</div>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-[9px] font-black uppercase text-slate-400">Upad Deducted</div>
                    <div className="text-xs font-black text-rose-500 mt-0.5">
                      {upad > 0 ? `-₹${upad}` : '₹0'}
                    </div>
                  </div>
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">Salary Due</div>
                    <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5">₹{balance}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">
                    {upad === 0
                      ? 'No previous Upad taken. 100% full salary due.'
                      : `₹${upad} Upad advance already taken. Remaining balance: ₹${balance}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSalaryForm((prev) => ({ ...prev, amount: String(balance > 0 ? balance : dailyWage) }))}
                    className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-[10px] font-black cursor-pointer"
                  >
                    Auto-Fill
                  </button>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Site Project *
              </label>
              <select
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                value={salaryForm.project_id}
                onChange={(e) => setSalaryForm({ ...salaryForm, project_id: e.target.value })}
              >
                <option value="">Select Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                placeholder="950.00"
                value={salaryForm.amount}
                onChange={(e) => setSalaryForm({ ...salaryForm, amount: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                required
                max={todayStr}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                value={salaryForm.date}
                onChange={(e) => setSalaryForm({ ...salaryForm, date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Payment Mode *
              </label>
              <select
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                value={salaryForm.payment_mode}
                onChange={(e) => setSalaryForm({ ...salaryForm, payment_mode: e.target.value })}
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI / Online</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Payment Reference / Remarks
            </label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
              placeholder="e.g. Full salary payment for October"
              value={salaryForm.notes}
              onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })}
            />
          </div>

          {isOrgAdmin ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Payment Status *
              </label>
              <select
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                value={salaryForm.status}
                onChange={(e) => setSalaryForm({ ...salaryForm, status: e.target.value })}
              >
                <option value="paid">Confirmed & Paid (Immediate Disbursement)</option>
                <option value="pending">Pending Approval</option>
              </select>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold">
              Status: <strong>Pending Approval</strong> (Payments created by Site Managers require Org Admin approval).
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsSalaryModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Disbursing...' : `Disburse Salary (₹${salaryForm.amount || '0'})`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};