import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Plus,
  CheckCircle,
  FileText,
  IndianRupee,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Download,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export const PayrollView = ({ selectedProjectId }) => {
  const { role } = useAuth();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [activeTab, setActiveTab] = useState('runs'); // 'runs' | 'advances'
  const [runs, setRuns] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRunId, setExpandedRunId] = useState(null);

  // Modals
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = selectedProjectId ? { project: selectedProjectId } : {};
      const [runRes, advRes, projRes, empRes] = await Promise.all([
        api.payroll.listRuns(params),
        api.payroll.listAdvances(params),
        api.projects.list({ page_size: 1000 }),
        api.workforce.listEmployees({ page_size: 1000 }),
      ]);
      setRuns(Array.isArray(runRes) ? runRes : runRes.results || []);
      setAdvances(Array.isArray(advRes) ? advRes : advRes.results || []);
      setProjects(Array.isArray(projRes) ? projRes : projRes.results || []);
      setEmployees(Array.isArray(empRes) ? empRes : empRes.results || []);
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

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const canApprove = role === 'ORG_ADMIN' || role === 'PROJECT_MANAGER';

  if (!['ORG_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT'].includes(role)) {
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
          {['ORG_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT', 'SUPERVISOR'].includes(role) && (
            <button onClick={() => setIsAdvanceModalOpen(true)} className="btn btn-secondary">
              <IndianRupee size={16} />
              <span>Record Advance</span>
            </button>
          )}
          {['ORG_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT'].includes(role) && (
            <button onClick={() => setIsRunModalOpen(true)} className="btn btn-primary">
              <Plus size={16} />
              <span>Calculate Weekly Payroll</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
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

      {activeTab === 'runs' ? (
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

                      {['ORG_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT'].includes(role) && (
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
                                      ['ORG_ADMIN', 'ACCOUNTANT'].includes(role) ? (
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
      ) : (
        /* Advances Tab */
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
                      {adv.status === 'OPEN' && ['ORG_ADMIN', 'ACCOUNTANT'].includes(role) && (
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
              required
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
                required
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
                required
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
              required
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
              required
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
                required
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
                required
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
              required
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
    </div>
  );
};
