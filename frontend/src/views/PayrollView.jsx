import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Plus,
  CheckCircle,
  FileText,
  DollarSign,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Download,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export const PayrollView = ({ selectedProjectId }) => {
  const { role } = useAuth();
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
        api.projects.list(),
        api.workforce.listEmployees(),
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
          <button onClick={() => setIsAdvanceModalOpen(true)} className="btn btn-secondary">
            <DollarSign size={16} />
            <span>Record Advance</span>
          </button>
          <button onClick={() => setIsRunModalOpen(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>Calculate Weekly Payroll</span>
          </button>
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
                          {formatCurrency(r.total_gross)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                          Advances Deducted
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f87171' }}>
                          -{formatCurrency(r.total_advances_deducted)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                          Net Payable
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#34d399' }}>
                          {formatCurrency(r.total_net)}
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
                    </div>
                  </div>

                  {/* Vouchers Breakdown */}
                  {isExpanded && (
                    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>
                        Itemized Worker Payslips & Deductions
                      </h4>
                      <div className="table-container">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Worker</th>
                              <th>Attendance Units</th>
                              <th>Daily Rate</th>
                              <th>Gross Pay</th>
                              <th>Advance Deduction</th>
                              <th>Net Pay</th>
                              <th>Status</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vouchers.map((v) => (
                              <tr key={v.id}>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{v.employee_name || `Worker #${v.employee}`}</div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>
                                    {v.employee_trade || 'Trade'}
                                  </div>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.84rem' }}>
                                    {v.days_present} Present + {v.half_days} Half-day ({Number(v.ot_hours || 0)}h OT)
                                  </span>
                                </td>
                                <td>₹{Number(v.daily_rate).toFixed(2)}</td>
                                <td style={{ fontWeight: 600 }}>{formatCurrency(v.gross_pay)}</td>
                                <td style={{ color: Number(v.advances_deducted) > 0 ? '#f87171' : 'var(--text-subtle)' }}>
                                  -{formatCurrency(v.advances_deducted)}
                                </td>
                                <td style={{ fontWeight: 700, color: '#34d399' }}>{formatCurrency(v.net_pay)}</td>
                                <td>
                                  <Badge status={v.status}>{v.status}</Badge>
                                </td>
                                <td>
                                  {v.status === 'DRAFT' || v.status === 'APPROVED' ? (
                                    <button
                                      onClick={() => handleMarkPaid(v.id)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ fontSize: '0.72rem' }}
                                    >
                                      Mark Paid
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                                      Paid ({v.payment_reference || 'UPI'})
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
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
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Worker</th>
                  <th>Amount</th>
                  <th>Payment Mode</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Site Project</th>
                </tr>
              </thead>
              <tbody>
                {advances.map((adv) => (
                  <tr key={adv.id}>
                    <td>{adv.advance_date}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{adv.employee_name || `Worker #${adv.employee}`}</div>
                    </td>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-heading)', color: '#fbbf24' }}>
                      {formatCurrency(adv.amount)}
                    </td>
                    <td>
                      <Badge status={adv.payment_mode}>{adv.payment_mode}</Badge>
                    </td>
                    <td style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>{adv.reason}</td>
                    <td>
                      <Badge status={adv.status}>{adv.status}</Badge>
                    </td>
                    <td>{adv.project_name || `Site #${adv.project}`}</td>
                  </tr>
                ))}
              </tbody>
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
                <option key={e.id} value={e.id}>{e.full_name} ({e.trade})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
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
