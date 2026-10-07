import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  CheckCircle,
  XCircle,
  FileText,
  CreditCard,
  Building,
  AlertTriangle,
  Upload,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export const ExpensesView = ({ selectedProjectId }) => {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses' | 'vendors'
  const [expenses, setExpenses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    project: '',
    category: 'MATERIAL',
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_mode: 'CASH',
    vendor: '',
    due_date: '',
    receipt: null,
  });

  const [paymentForm, setPaymentForm] = useState({
    project: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'BANK_TRANSFER',
    reference: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = selectedProjectId ? { project: selectedProjectId } : {};
      const [expRes, venRes, projRes] = await Promise.all([
        api.expenses.list(params),
        api.expenses.listVendors(),
        api.projects.list(),
      ]);
      setExpenses(Array.isArray(expRes) ? expRes : expRes.results || []);
      setVendors(Array.isArray(venRes) ? venRes : venRes.results || []);
      setProjects(Array.isArray(projRes) ? projRes : projRes.results || []);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProjectId]);

  const handleApprove = async (expenseId) => {
    try {
      await api.expenses.approve(expenseId);
      alert('Expense approved! General Ledger journal posted and project spend updated.');
      await fetchData();
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    }
  };

  const handleReject = async (expenseId) => {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;
    try {
      await api.expenses.reject(expenseId, reason);
      alert('Expense rejected.');
      await fetchData();
    } catch (err) {
      alert(`Rejection error: ${err.message}`);
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('project', expenseForm.project);
      formData.append('category', expenseForm.category);
      formData.append('description', expenseForm.description);
      formData.append('amount', expenseForm.amount);
      formData.append('expense_date', expenseForm.expense_date);
      formData.append('payment_mode', expenseForm.payment_mode);
      if (expenseForm.vendor) formData.append('vendor', expenseForm.vendor);
      if (expenseForm.due_date) formData.append('due_date', expenseForm.due_date);
      if (expenseForm.receipt) formData.append('receipt', expenseForm.receipt);

      await api.expenses.create(formData);
      setIsExpenseModalOpen(false);
      setExpenseForm({
        project: '',
        category: 'MATERIAL',
        description: '',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        payment_mode: 'CASH',
        vendor: '',
        due_date: '',
        receipt: null,
      });
      await fetchData();
    } catch (err) {
      alert(`Error logging expense: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedVendor) return;
    setSubmitting(true);
    try {
      await api.expenses.recordVendorPayment(selectedVendor.id, {
        ...paymentForm,
        project: Number(paymentForm.project),
      });
      setIsPaymentModalOpen(false);
      alert('Vendor repayment recorded! AP liability settled and bank ledger credited.');
      await fetchData();
    } catch (err) {
      alert(`Payment error: ${err.message}`);
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
            Site Spend & Vendor Credit Control
          </h2>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.88rem' }}>
            Material receipts, credit purchases, approval workflows, and Accounts Payable ledger.
          </p>
        </div>

        <button onClick={() => setIsExpenseModalOpen(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Log Site Expense</span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`btn btn-sm ${activeTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Expenses Log ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          className={`btn btn-sm ${activeTab === 'vendors' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Vendor Payables & Credit ({vendors.length})
        </button>
      </div>

      {activeTab === 'expenses' ? (
        <div className="card">
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading expenses ledger...
            </div>
          ) : expenses.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-subtle)' }}>
              No expenses recorded yet.
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Ref</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Payment Mode</th>
                    <th>Receipt</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{exp.expense_date}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>
                          {exp.project_name || `Site #${exp.project}`}
                        </div>
                      </td>
                      <td>
                        <Badge status={exp.category}>{exp.category}</Badge>
                      </td>
                      <td style={{ maxWidth: '240px', color: 'var(--text-main)', fontSize: '0.86rem' }}>
                        {exp.description}
                        {exp.vendor_name && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>
                            Vendor: {exp.vendor_name}
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-main)' }}>
                        {formatCurrency(exp.amount)}
                      </td>
                      <td>
                        <Badge status={exp.payment_mode}>{exp.payment_mode}</Badge>
                      </td>
                      <td>
                        {exp.receipt ? (
                          <button
                            onClick={() => setSelectedReceiptUrl(exp.receipt)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                          >
                            <FileText size={12} />
                            <span>View Bill</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>None</span>
                        )}
                      </td>
                      <td>
                        <Badge status={exp.status}>{exp.status}</Badge>
                      </td>
                      <td>
                        {exp.status === 'PENDING_APPROVAL' && canApprove && exp.logged_by !== user?.id ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => handleApprove(exp.id)}
                              className="btn btn-success btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                              title="Approve & Post to Ledger"
                            >
                              <CheckCircle size={13} />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleReject(exp.id)}
                              className="btn btn-danger btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                              title="Reject Expense"
                            >
                              <XCircle size={13} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Vendors Credit Tab */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {vendors.map((ven) => {
            const balance = Number(ven.outstanding_balance || 0);
            return (
              <div key={ven.id} className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title" style={{ fontSize: '1.15rem' }}>{ven.name}</h3>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                      Category: {ven.category} • GSTIN: {ven.gstin || 'Unregistered'}
                    </div>
                  </div>
                  {balance > 0 ? (
                    <Badge variant="amber">Balance Due</Badge>
                  ) : (
                    <Badge variant="green">Settled</Badge>
                  )}
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    background: balance > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(0,0,0,0.2)',
                    border: balance > 0 ? '1px solid rgba(245, 158, 11, 0.25)' : 'none',
                    marginBottom: '14px',
                  }}
                >
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                    Outstanding Liability Balance (CR 2001)
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '1.6rem',
                      fontWeight: 700,
                      color: balance > 0 ? '#fbbf24' : '#34d399',
                      marginTop: '4px',
                    }}
                  >
                    {formatCurrency(balance)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                  <button
                    onClick={() => {
                      setSelectedVendor(ven);
                      setIsPaymentModalOpen(true);
                    }}
                    disabled={balance <= 0}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                  >
                    <CreditCard size={14} />
                    <span>Record Repayment</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log Expense Modal */}
      <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title="Record Site Purchase / Spend">
        <form onSubmit={handleCreateExpense}>
          <div className="form-group">
            <label className="form-label">Site Project *</label>
            <select
              required
              className="form-control"
              value={expenseForm.project}
              onChange={(e) => setExpenseForm({ ...expenseForm, project: e.target.value })}
            >
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select
                className="form-control"
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
              >
                <option value="MATERIAL">Material</option>
                <option value="LABOR">Labor</option>
                <option value="FUEL">Fuel</option>
                <option value="TRANSPORT">Transport</option>
                <option value="EQUIPMENT">Equipment</option>
                <option value="UTILITY">Utility</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                className="form-control"
                placeholder="25000.00"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description *</label>
            <input
              type="text"
              required
              className="form-control"
              placeholder="e.g. 500 bags of OPC 53 Grade Cement"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Payment Mode *</label>
              <select
                className="form-control"
                value={expenseForm.payment_mode}
                onChange={(e) => setExpenseForm({ ...expenseForm, payment_mode: e.target.value })}
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CREDIT">Vendor Credit (Pay Later)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Vendor (Optional)</label>
              <select
                className="form-control"
                value={expenseForm.vendor}
                onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
              >
                <option value="">None / Site Direct</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>

          {expenseForm.payment_mode === 'CREDIT' && (
            <div className="form-group">
              <label className="form-label">Credit Due Date *</label>
              <input
                type="date"
                required
                className="form-control"
                value={expenseForm.due_date}
                onChange={(e) => setExpenseForm({ ...expenseForm, due_date: e.target.value })}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Receipt / Bill Upload (Required if amount exceeds ₹1,000)</label>
            <input
              type="file"
              accept="image/*,.pdf"
              className="form-control"
              onChange={(e) => setExpenseForm({ ...expenseForm, receipt: e.target.files[0] })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Submitting...' : 'Log Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Repayment Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={`Settle Vendor Bill: ${selectedVendor?.name}`}>
        <form onSubmit={handleRecordPayment}>
          <div className="form-group">
            <label className="form-label">Project Allocation *</label>
            <select
              required
              className="form-control"
              value={paymentForm.project}
              onChange={(e) => setPaymentForm({ ...paymentForm, project: e.target.value })}
            >
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Repayment Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              required
              max={selectedVendor?.outstanding_balance}
              className="form-control"
              placeholder={selectedVendor?.outstanding_balance}
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Payment Mode *</label>
              <select
                className="form-control"
                value={paymentForm.payment_mode}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
              >
                <option value="BANK_TRANSFER">Bank Transfer (RTGS/NEFT)</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Bank Reference / UTR *</label>
              <input
                type="text"
                required
                className="form-control"
                placeholder="e.g. RTGS-AXIS-99210"
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Posting...' : 'Post Repayment to Ledger'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Receipt Viewer Modal */}
      <Modal isOpen={Boolean(selectedReceiptUrl)} onClose={() => setSelectedReceiptUrl(null)} title="Scanned Receipt / Bill Preview">
        <div style={{ textAlign: 'center', padding: '10px' }}>
          <img
            src={selectedReceiptUrl}
            alt="Receipt Document"
            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)' }}
          />
        </div>
      </Modal>
    </div>
  );
};
