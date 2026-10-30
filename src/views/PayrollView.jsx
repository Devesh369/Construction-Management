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
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export const PayrollView = ({ selectedProjectId }) => {
  const { user, role } = useAuth();
  const isEmployeeLabour = role === 'employee/labour' || role === 'EMPLOYEE' || role === 'LABOUR';
  const isOrgAdmin = role === 'ORG_ADMIN' || user?.is_superuser;
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [activeTab, setActiveTab] = useState('salaries'); // 'salaries' | 'runs' | 'advances'
  const [runs, setRuns] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [salaryDisbursements, setSalaryDisbursements] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
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
  const [loading, setLoading] = useState(true);
  const [expandedRunId, setExpandedRunId] = useState(null);

  // Search & Filter in Salaries Tab
  const [salarySearch, setSalarySearch] = useState('');
  const [salaryProjectFilter, setSalaryProjectFilter] = useState('all');

  // Modals
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [runForm, setRunForm] = useState({
    project_id: '',
    period_start: '',
    period_end: '',
  });

  const [advanceForm, setAdvanceForm] = useState({
    project: '',
    employee: '',
    amount: '',
    advance_date: new Date().toISOString().split('T')[0],
    reason: '',
    payment_mode: 'CASH',
  });

  const [salaryForm, setSalaryForm] = useState({
    employee_id: '',
    project_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    payment_mode: 'CASH',
    notes: '',
    status: isOrgAdmin ? 'paid' : 'pending',
  });

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

      let salList = payList.filter((p) => (p.type || '').toLowerCase() === 'salary');

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
      console.error('Failed to load payroll:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProjectId]);

  const handleCreateRun = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.payroll.createRun({
        project_id: Number(runForm.project_id),
        period_start: runForm.period_start,
        period_end: runForm.period_end,
      });
      setIsRunModalOpen(false);
      alert('Payroll run generated! Vouchers calculated from locked attendance and open advances.');
      await fetchData();
    } catch (err) {
      alert(`Error generating payroll: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveRun = async (runId) => {
    if (!window.confirm('Approve payroll run? This will post gross wages to the General Ledger and lock adjustments.')) {
      return;
    }
    try {
      await api.payroll.approveRun(runId);
      alert('Payroll run approved and posted to General Ledger!');
      await fetchData();
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    }
  };

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
      alert('Payroll run deleted successfully.');
      await fetchData();
    } catch (err) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleMarkPaid = async (voucherId) => {
    const ref = prompt('Enter payment transaction reference (e.g. UPI-TXN-101):', `TXN-${Date.now()}`);
    if (!ref) return;
    try {
      await api.payroll.markVoucherPaid(voucherId, ref);
      alert('Voucher marked as paid.');
      await fetchData();
    } catch (err) {
      alert(`Payment error: ${err.message}`);
    }
  };

  const handleDeleteAdvance = async (advanceId) => {
    if (!window.confirm('Are you sure you want to delete this advance? Any linked Upad payment will also be deleted.')) {
      return;
    }
    try {
      await api.payroll.deleteAdvance(advanceId);
      alert('Advance deleted successfully');
      await loadAdvances();
    } catch (err) {
      alert(`Could not delete advance: ${err.message}`);
    }
  };

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
    } catch (err) {
      alert(`Could not download payslip: ${err.message}`);
    }
  };

  const handleCreateAdvance = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.payroll.createAdvance({
        ...advanceForm,
        project: Number(advanceForm.project),
        employee: Number(advanceForm.employee),
      });
      setIsAdvanceModalOpen(false);
      setAdvanceForm({
        project: '',
        employee: '',
        amount: '',
        advance_date: new Date().toISOString().split('T')[0],
        reason: '',
        payment_mode: 'CASH',
      });
      alert('Worker advance recorded and posted to Asset account 1100.');
      await fetchData();
    } catch (err) {
      alert(`Error recording advance: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openSalaryModal = (worker = null) => {
    const targetWorker = worker || employees[0];
    const fin = targetWorker?.financials || {};
    const dailyWage = Number(targetWorker?.daily_rate || targetWorker?.wage_rate || 0);
    const balance = fin.balance !== undefined && fin.balance !== null
      ? Number(fin.balance)
      : dailyWage;
    const amountVal = balance > 0 ? String(balance) : (dailyWage > 0 ? String(dailyWage) : '');

    setSalaryForm({
      employee_id: targetWorker ? String(targetWorker.id) : '',
      project_id: targetWorker?.primary_project || selectedProjectId || (projects[0]?.id ? String(projects[0].id) : ''),
      amount: amountVal,
      date: new Date().toISOString().split('T')[0],
      payment_mode: 'CASH',
      notes: targetWorker ? `Full salary payout for ${targetWorker.full_name}` : 'Full salary payout',
      status: isOrgAdmin ? 'paid' : 'pending',
    });
    setIsSalaryModalOpen(true);
  };

  const handleDisburseSalary = async (e) => {
    e.preventDefault();
    if (!salaryForm.employee_id) {
      alert('Please select a worker');
      return;
    }
    const worker = employees.find((emp) => String(emp.id) === String(salaryForm.employee_id));
    const fin = worker?.financials || {};
    const hasAttendance = Boolean(
      fin.has_attendance || (fin.total_pagar && Number(fin.total_pagar) > 0)
    );
    if (!hasAttendance) {
      alert('Cannot pay wages to an employee without marked attendance. Attendance must be recorded first.');
      return;
    }
    if (!salaryForm.amount || Number(salaryForm.amount) <= 0) {
      alert('Please enter a valid salary amount');
      return;
    }

    setSubmitting(true);
    try {
      await api.payments.create({
        employee: Number(salaryForm.employee_id),
        project: salaryForm.project_id ? Number(salaryForm.project_id) : null,
        amount: Number(salaryForm.amount),
        method: salaryForm.payment_mode.toLowerCase(),
        type: 'salary',
        status: isOrgAdmin ? (salaryForm.status || 'paid') : 'pending',
        date_from: salaryForm.date,
        date_to: salaryForm.date,
        description: salaryForm.notes.trim() || `Full salary payment for ${worker?.full_name || 'worker'}`,
      });

      setIsSalaryModalOpen(false);
      alert(
        isOrgAdmin
          ? 'Salary payout recorded successfully! Reflected in ledger, payroll vouchers, attendance settlement, and worker balance.'
          : 'Salary payout submitted as pending! Org Admin approval required before release.'
      );
      await fetchData();
    } catch (err) {
      alert(`Error disbursing salary: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSalaryWorker = useMemo(() => {
    return employees.find((emp) => String(emp.id) === String(salaryForm.employee_id));
  }, [employees, salaryForm.employee_id]);

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
        const trade = (emp.trade || '').toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !trade.includes(q)) return false;
      }
      return true;
    });
  }, [employees, salaryProjectFilter, salarySearch]);

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const canApprove =
    role === 'ORG_ADMIN' ||
    role === 'PROJECT_MANAGER' ||
    role === 'SITE_MANAGER';

  if (!['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'ACCOUNTANT', 'employee/labour', 'EMPLOYEE', 'LABOUR'].includes(role)) {
    return (
      <div className="card" style={{ maxWidth: '640px', margin: '48px auto', padding: '48px 32px', textAlign: 'center' }}>
        <ShieldAlert className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>Payroll Access Restricted</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
          Payroll generation and salary voucher management are restricted to Organization Admins, Project Managers, and Financial Accountants.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px' }}>
            Payroll Engine & Worker Advances
          </h2>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.88rem' }}>
            Weekly wage calculation, FIFO advance deductions, payslips, and journal postings.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'ACCOUNTANT', 'SUPERVISOR'].includes(role) && !isEmployeeLabour && (
            <button
              onClick={() => openSalaryModal()}
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderColor: '#059669',
                color: '#ffffff',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Wallet size={16} />
              <span>Pay Full Salary</span>
            </button>
          )}
          {['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'ACCOUNTANT', 'SUPERVISOR'].includes(role) && !isEmployeeLabour && (
            <button onClick={() => setIsAdvanceModalOpen(true)} className="btn btn-secondary">
              <IndianRupee size={16} />
              <span>Record Advance</span>
            </button>
          )}
          {['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'ACCOUNTANT'].includes(role) && !isEmployeeLabour && (
            <button onClick={() => setIsRunModalOpen(true)} className="btn btn-secondary">
              <Plus size={16} />
              <span>Calculate Weekly Payroll</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('salaries')}
          className={`btn btn-sm ${activeTab === 'salaries' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Worker Salaries & Full Payments ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab('runs')}
          className={`btn btn-sm ${activeTab === 'runs' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Payroll Runs ({runs.length})
        </button>
        <button
          onClick={() => setActiveTab('advances')}
          className={`btn btn-sm ${activeTab === 'advances' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Worker Advances ({advances.length})
        </button>
      </div>

      {/* 1. Salaries Tab */}
      {activeTab === 'salaries' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div className="card" style={{ padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
                Active Workers
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
                {filteredEmployees.length}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                Across project sites
              </div>
            </div>

            <div className="card" style={{ padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
                Total Accrued Pagar
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#3b82f6', marginTop: '4px' }}>
                {formatCurrency(filteredEmployees.reduce((acc, e) => acc + Number(e.financials?.total_pagar || e.daily_rate || 0), 0))}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                From attendance & vouchers
              </div>
            </div>

            <div className="card" style={{ padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
                Advances Deducted
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f87171', marginTop: '4px' }}>
                {formatCurrency(filteredEmployees.reduce((acc, e) => acc + Number(e.financials?.total_upad || 0), 0))}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                Upad cash given
              </div>
            </div>

            <div className="card" style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#10b981' }}>
                Net Outstanding Salary
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
                {formatCurrency(filteredEmployees.reduce((acc, e) => acc + Number(e.financials?.balance || 0), 0))}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                Payable directly to workers
              </div>
            </div>
          </div>

          {/* Search & Project Filter Bar */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '280px' }}>
              <input
                type="text"
                placeholder="Search worker by name, trade, code..."
                className="form-control"
                value={salarySearch}
                onChange={(e) => setSalarySearch(e.target.value)}
                style={{ maxWidth: '360px' }}
              />
              <select
                className="form-control"
                value={salaryProjectFilter}
                onChange={(e) => setSalaryProjectFilter(e.target.value)}
                style={{ maxWidth: '240px' }}
              >
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Worker Salaries & Full Payout Table */}
          <div className="card card-table">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>Site Project</th>
                    <th style={{ textAlign: 'center' }}>Attendance Units</th>
                    <th style={{ textAlign: 'right' }}>Daily Rate</th>
                    <th style={{ textAlign: 'right' }}>Total Earned (Pagar)</th>
                    <th style={{ textAlign: 'right' }}>Advance Taken</th>
                    <th style={{ textAlign: 'right' }}>Total Paid</th>
                    <th style={{ textAlign: 'right', width: '150px' }}>Net Salary Due</th>
                    <th style={{ textAlign: 'center', width: '160px' }}>Salary Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No employees found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => {
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

                      return (
                        <tr key={emp.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
                                {(emp.full_name || 'W').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{emp.full_name}</div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>
                                  {emp.role || emp.trade || 'Worker'} • {emp.employee_code || `EMP-${emp.id}`}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: '0.84rem' }}>
                              {emp.primary_project_name || (projects.find((p) => p.id === emp.primary_project)?.name) || 'All Sites'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {hasAttendance ? (
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                {fin.attendance_days ? `${fin.attendance_days} Days` : 'Marked Present'}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No attendance</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
                            ₹{dailyWage.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#3b82f6', fontFamily: 'var(--font-heading)' }}>
                            {formatCurrency(pagar)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {upad > 0 ? (
                              <span style={{ fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-heading)' }}>
                                -{formatCurrency(upad)}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                                ₹0 (No Advance)
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-subtle)', fontFamily: 'var(--font-heading)' }}>
                            {formatCurrency(paid)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {balance > 0 ? (
                              <span style={{ fontWeight: 800, color: '#10b981', fontSize: '1.05rem', fontFamily: 'var(--font-heading)' }}>
                                {formatCurrency(balance)}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.88rem' }}>₹0.00</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {!isEmployeeLabour ? (
                              balance > 0 ? (
                                <button
                                  onClick={() => openSalaryModal(emp)}
                                  className="btn btn-sm btn-primary"
                                  style={{
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    borderColor: '#059669',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    padding: '5px 12px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                                  }}
                                >
                                  <Wallet size={13} />
                                  <span>Pay Full Salary</span>
                                </button>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.78rem', fontWeight: 700 }}>
                                  <CheckCircle2 size={14} />
                                  <span>Fully Settled</span>
                                </span>
                              )
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                                {balance > 0 ? 'Salary Due' : 'Paid'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Itemized Salary Disbursements List */}
          {salaryDisbursements.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-main)' }}>
                Recent Direct Salary Disbursements ({salaryDisbursements.length})
              </h3>
              <div className="card card-table">
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '120px' }}>Date</th>
                        <th>Worker</th>
                        <th>Site Project</th>
                        <th style={{ textAlign: 'right', width: '130px' }}>Amount Disbursed</th>
                        <th style={{ textAlign: 'center', width: '120px' }}>Method</th>
                        <th style={{ textAlign: 'center', width: '120px' }}>Status</th>
                        <th>Reference / Notes</th>
                        <th style={{ textAlign: 'center', width: '100px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryDisbursements.map((sal) => (
                        <tr key={sal.id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                              {sal.date_from || (sal.created_at ? sal.created_at.split('T')[0] : '—')}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{sal.employee_name || `Worker #${sal.employee}`}</div>
                            {sal.employee_trade && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>{sal.employee_trade}</div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontSize: '0.84rem' }}>{sal.project_name || 'All Sites'}</div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#10b981', fontSize: '0.95rem' }}>
                            {formatCurrency(sal.amount)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <Badge status={sal.method}>{sal.method?.toUpperCase() || 'CASH'}</Badge>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <Badge status={sal.status}>{sal.status?.toUpperCase() || 'PAID'}</Badge>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', maxWidth: '200px' }}>
                            {sal.description || 'Full salary payment'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>
                              ✓ Disbursed
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Payroll Runs Tab */}
      {activeTab === 'runs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading payroll engine...
            </div>
          ) : runs.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
              <Wallet size={36} color="var(--text-subtle)" style={{ margin: '0 auto 12px' }} />
              <h3>No Payroll Runs Generated Yet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
                Click "Calculate Weekly Payroll" to run attendance calculations for a project.
              </p>
            </div>
          ) : (
            runs.map((r) => {
              const isExpanded = expandedRunId === r.id;
              const vouchers = r.vouchers || [];

              return (
                <div key={r.id} className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        onClick={() => setExpandedRunId(isExpanded ? null : r.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '6px' }}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            Period: {r.period_start} → {r.period_end}
                          </h3>
                          <Badge status={r.status}>{r.status}</Badge>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                          Project: {r.project_name || `Site #${r.project}`} • Vouchers: {vouchers.length}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                          Total Gross
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                          {formatCurrency(Number(r.total_gross) > 0 ? r.total_gross : vouchers.reduce((acc, v) => acc + Number(v.gross_pay || 0), 0))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                          Advances Deducted
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f87171' }}>
                          -{formatCurrency(Number(r.total_advances ?? r.total_advances_deducted) > 0 ? (r.total_advances ?? r.total_advances_deducted) : vouchers.reduce((acc, v) => acc + Number(v.advances_deducted || 0), 0))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                          Net Payable
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#34d399' }}>
                          {formatCurrency(Number(r.total_net) > 0 ? r.total_net : vouchers.reduce((acc, v) => acc + Number(v.net_pay || 0), 0))}
                        </div>
                      </div>

                      {r.status === 'DRAFT' && canApprove && (
                        <button
                          onClick={() => handleApproveRun(r.id)}
                          className="btn btn-success btn-sm"
                        >
                          <CheckCircle size={15} />
                          <span>Approve & Post Ledger</span>
                        </button>
                      )}

                      {['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'ACCOUNTANT'].includes(role) && !isEmployeeLabour && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRun(r.id);
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{
                            color: '#ef4444',
                            borderColor: 'rgba(239, 68, 68, 0.4)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Delete this payroll run"
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Vouchers Breakdown */}
                  {isExpanded && (
                    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          Itemized Worker Payslips & Deductions ({vouchers.length})
                        </h4>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-subtle)' }}>
                          Weekly calculations computed from biometric attendance & active FIFO cash advances
                        </span>
                      </div>
                      <div className="table-container" style={{ border: '1px solid var(--border-default)' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th style={{ width: '220px' }}>Worker</th>
                              <th>Attendance Units</th>
                              <th style={{ textAlign: 'right', width: '110px' }}>Daily Rate</th>
                              <th style={{ textAlign: 'right', width: '130px' }}>Gross Pay</th>
                              <th style={{ textAlign: 'right', width: '140px' }}>Advance Deduction</th>
                              <th style={{ textAlign: 'right', width: '130px' }}>Net Pay</th>
                              <th style={{ textAlign: 'center', width: '100px' }}>Status</th>
                              <th style={{ textAlign: 'center', width: '150px' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vouchers.map((v) => (
                              <tr key={v.id}>
                                <td>
                                  <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{v.employee_name || `Worker #${v.employee}`}</div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>
                                    {v.trade || v.employee_trade || 'Trade Worker'}
                                  </div>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.84rem' }}>
                                    {v.days_present} Present + {v.half_days} Half-day ({Number(v.ot_hours || 0)}h OT)
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
                                  ₹{Number(v.daily_rate_used ?? v.daily_rate ?? 0).toFixed(2)}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
                                  {formatCurrency(v.gross_pay)}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: Number(v.advances_deducted) > 0 ? '#f87171' : 'var(--text-subtle)' }}>
                                  -{formatCurrency(v.advances_deducted)}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-heading)', color: '#34d399', fontSize: '0.95rem' }}>
                                  {formatCurrency(v.net_pay)}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <Badge status={v.status}>{v.status}</Badge>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <button
                                      onClick={() => handleDownloadPayslip(v.id, v.voucher_number)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                      title="Download Official Payslip PDF with Letterhead"
                                    >
                                      <Download size={12} />
                                      <span>Payslip</span>
                                    </button>
                                    {v.status === 'DRAFT' || v.status === 'APPROVED' ? (
                                      ['ORG_ADMIN', 'ACCOUNTANT'].includes(role) && !isEmployeeLabour ? (
                                        <button
                                          onClick={() => handleMarkPaid(v.id)}
                                          className="btn btn-primary btn-sm"
                                          style={{ fontSize: '0.72rem' }}
                                        >
                                          Mark Paid
                                        </button>
                                      ) : (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                                          Pending Payment
                                        </span>
                                      )
                                    ) : (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                                        Paid ({v.payment_reference || 'UPI'})
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.76rem' }}>
                                Run Vouchers Total:
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                                {formatCurrency(vouchers.reduce((acc, v) => acc + Number(v.gross_pay || 0), 0))}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-heading)', color: '#f87171' }}>
                                -{formatCurrency(vouchers.reduce((acc, v) => acc + Number(v.advances_deducted || 0), 0))}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#34d399', fontSize: '1rem' }}>
                                {formatCurrency(vouchers.reduce((acc, v) => acc + Number(v.net_pay || 0), 0))}
                              </td>
                              <td colSpan={2}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 3. Advances Tab */}
      {activeTab === 'advances' && (
        <div className="card card-table">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Date</th>
                  <th>Worker</th>
                  <th style={{ textAlign: 'right', width: '130px' }}>Amount</th>
                  <th style={{ textAlign: 'center', width: '140px' }}>Payment Mode</th>
                  <th>Reason</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>Status</th>
                  <th>Site Project</th>
                  <th style={{ textAlign: 'center', width: '90px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {advances.map((adv) => (
                  <tr key={adv.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{adv.advance_date}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{adv.employee_name || `Worker #${adv.employee}`}</div>
                      {adv.employee_code && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>Code: {adv.employee_code}</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-heading)', color: '#fbbf24', fontSize: '0.95rem' }}>
                      {formatCurrency(adv.amount)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Badge status={adv.payment_mode}>{adv.payment_mode}</Badge>
                    </td>
                    <td style={{ fontSize: '0.84rem', color: 'var(--text-subtle)', maxWidth: '240px' }}>
                      {adv.reason || 'Personal / emergency advance'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Badge status={adv.status}>{adv.status}</Badge>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{adv.project_name || `Site #${adv.project}`}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {adv.status === 'OPEN' && ['ORG_ADMIN', 'ACCOUNTANT'].includes(role) && !isEmployeeLabour && (
                        <button
                          onClick={() => handleDeleteAdvance(adv.id)}
                          className="btn btn-secondary btn-sm"
                          style={{
                            fontSize: '0.72rem',
                            color: '#ef4444',
                            borderColor: 'rgba(239, 68, 68, 0.3)',
                            padding: '4px 8px',
                          }}
                          title="Delete Advance"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.76rem' }}>
                    Total Cash Advances:
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#fbbf24', fontSize: '1rem' }}>
                    {formatCurrency(advances.reduce((acc, a) => acc + Number(a.amount || 0), 0))}
                  </td>
                  <td colSpan={5} style={{ fontSize: '0.76rem', color: 'var(--text-subtle)' }}>
                    {advances.length} advance transactions recorded
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Calculate Run Modal */}
      <Modal isOpen={isRunModalOpen} onClose={() => setIsRunModalOpen(false)} title="Calculate Weekly Payroll Run">
        <form onSubmit={handleCreateRun}>
          <div className="form-group">
            <label className="form-label">Site Project *</label>
            <select
              className="form-control"
              value={runForm.project_id}
              onChange={(e) => setRunForm({ ...runForm, project_id: e.target.value })}
            >
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Period Start (e.g. Monday) *</label>
              <input
                type="date"
                max={new Date().toISOString().split('T')[0]}
                className="form-control"
                value={runForm.period_start}
                onChange={(e) => setRunForm({ ...runForm, period_start: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Period End (e.g. Sunday) *</label>
              <input
                type="date"
                max={new Date().toISOString().split('T')[0]}
                className="form-control"
                value={runForm.period_end}
                onChange={(e) => setRunForm({ ...runForm, period_end: e.target.value })}
              />
            </div>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginBottom: '16px' }}>
            Note: Payroll calculations require that site attendance for the selected date range has been locked.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={() => setIsRunModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Computing...' : 'Calculate Vouchers'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Advance Modal */}
      <Modal isOpen={isAdvanceModalOpen} onClose={() => setIsAdvanceModalOpen(false)} title="Record Cash Advance to Worker">
        <form onSubmit={handleCreateAdvance}>
          <div className="form-group">
            <label className="form-label">Site Project *</label>
            <select
              className="form-control"
              value={advanceForm.project}
              onChange={(e) => setAdvanceForm({ ...advanceForm, project: e.target.value })}
            >
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Worker *</label>
            <select
              className="form-control"
              value={advanceForm.employee}
              onChange={(e) => setAdvanceForm({ ...advanceForm, employee: e.target.value })}
            >
              <option value="">Select Worker</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name} ({e.trade || 'Worker'})</option>
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
              <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#64748B', marginBottom: '8px' }}>
                  <span>Upad & Salary Breakdown</span>
                  <span style={{ color: '#2563EB' }}>{worker.full_name}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
                  <div style={{ padding: '8px', background: '#FFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>DAILY WAGE</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>₹{dailyWage}</div>
                  </div>
                  <div style={{ padding: '8px', background: '#FFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>CURRENT BAL</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#4F46E5', marginTop: '2px' }}>₹{curBal}</div>
                  </div>
                  <div style={{ padding: '8px', background: '#FFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>REMAIN SALARY</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#16A34A', marginTop: '2px' }}>₹{remaining}</div>
                  </div>
                </div>
                {entered > 0 && (
                  <div style={{ fontSize: '11px', textAlign: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #E2E8F0', color: '#475569', fontWeight: 600 }}>
                    Taking <strong style={{ color: '#2563EB' }}>₹{entered}</strong> Upad from daily wage ₹{dailyWage || curBal} leaves <strong style={{ color: '#16A34A' }}>₹{remaining}</strong> remaining salary.
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Advance Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="1500.00"
                value={advanceForm.amount}
                onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Advance Date *</label>
              <input
                type="date"
                max={todayStr}
                className="form-control"
                value={advanceForm.advance_date}
                onChange={(e) => setAdvanceForm({ ...advanceForm, advance_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Mode *</label>
              <select
                className="form-control"
                value={advanceForm.payment_mode}
                onChange={(e) => setAdvanceForm({ ...advanceForm, payment_mode: e.target.value })}
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reason *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Medical emergency assistance"
              value={advanceForm.reason}
              onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={() => setIsAdvanceModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Recording...' : 'Disburse Advance'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 3. Pay Full Salary Modal */}
      <Modal
        isOpen={isSalaryModalOpen}
        onClose={() => setIsSalaryModalOpen(false)}
        title="Disburse Full Salary / Wages"
        subtitle="Disburse employee salary and immediately reflect in ledgers, attendance, and worker balance"
      >
        <form onSubmit={handleDisburseSalary}>
          <div className="form-group">
            <label className="form-label">Worker *</label>
            <select
              required
              className="form-control"
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
              <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#64748B' }}>
                    Salary & Wage Computation
                  </div>
                  <span style={{ color: '#2563EB', fontWeight: 800, fontSize: '0.85rem' }}>
                    {selectedSalaryWorker.full_name}
                  </span>
                </div>

                {!hasAttendance && (
                  <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', fontSize: '11px', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} />
                    <span>Worker has no marked attendance yet. Please record site attendance first before disbursing salary.</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center', marginBottom: '10px' }}>
                  <div style={{ padding: '8px', background: '#FFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>DAILY RATE</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>₹{dailyWage}</div>
                  </div>
                  <div style={{ padding: '8px', background: '#FFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>TOTAL PAGAR</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#3B82F6', marginTop: '2px' }}>₹{pagar}</div>
                  </div>
                  <div style={{ padding: '8px', background: '#FFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>ADVANCE DEDUCTED</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: upad > 0 ? '#EF4444' : '#10B981', marginTop: '2px' }}>
                      {upad > 0 ? `-₹${upad}` : '₹0'}
                    </div>
                  </div>
                  <div style={{ padding: '8px', background: '#ECFDF5', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
                    <div style={{ fontSize: '9px', color: '#047857', fontWeight: 800, textTransform: 'uppercase' }}>FULL SALARY DUE</div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>₹{balance}</div>
                  </div>
                </div>

                {upad === 0 ? (
                  <div style={{ padding: '6px 10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#059669', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={13} />
                      Worker did not take money in advance. 100% full salary payable: ₹{balance > 0 ? balance : dailyWage}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSalaryForm((prev) => ({ ...prev, amount: String(balance > 0 ? balance : dailyWage) }))}
                      className="btn btn-sm"
                      style={{ fontSize: '10px', padding: '2px 8px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 800 }}
                    >
                      Fill Full
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '6px 10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#b45309', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={13} />
                      ₹{upad} advance already taken. Remaining net salary: ₹{balance}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSalaryForm((prev) => ({ ...prev, amount: String(balance > 0 ? balance : dailyWage) }))}
                      className="btn btn-sm"
                      style={{ fontSize: '10px', padding: '2px 8px', background: '#b45309', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 800 }}
                    >
                      Fill Remaining
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Site Project *</label>
              <select
                required
                className="form-control"
                value={salaryForm.project_id}
                onChange={(e) => setSalaryForm({ ...salaryForm, project_id: e.target.value })}
              >
                <option value="">Select Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Disbursement Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                className="form-control"
                placeholder="e.g. 950.00"
                value={salaryForm.amount}
                onChange={(e) => setSalaryForm({ ...salaryForm, amount: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Payment Date *</label>
              <input
                type="date"
                required
                max={todayStr}
                className="form-control"
                value={salaryForm.date}
                onChange={(e) => setSalaryForm({ ...salaryForm, date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payment Mode *</label>
              <select
                className="form-control"
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

          <div className="form-group">
            <label className="form-label">Payment Reference / Remarks</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Full salary payment for October"
              value={salaryForm.notes}
              onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })}
            />
          </div>

          {isOrgAdmin ? (
            <div className="form-group">
              <label className="form-label">Payment Status *</label>
              <select
                className="form-control"
                value={salaryForm.status}
                onChange={(e) => setSalaryForm({ ...salaryForm, status: e.target.value })}
              >
                <option value="paid">Confirmed & Paid (Immediate Disbursement)</option>
                <option value="pending">Pending Approval</option>
              </select>
            </div>
          ) : (
            <div style={{ padding: '8px 12px', background: '#F1F5F9', borderRadius: '8px', fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '14px' }}>
              Status: <strong>Pending Approval</strong> (Payments created by Site Managers require Org Admin approval).
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" onClick={() => setIsSalaryModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderColor: '#059669',
                color: '#fff',
                fontWeight: 700,
              }}
            >
              {submitting ? 'Disbursing...' : `Disburse Salary (₹${salaryForm.amount || '0'})`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
