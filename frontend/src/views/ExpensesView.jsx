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
  Search,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export const ExpensesView = ({ selectedProjectId }) => {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses' | 'vendors' | 'running_costs'
  const [expenses, setExpenses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [runningCosts, setRunningCosts] = useState([]);
  const [runningCostsSummary, setRunningCostsSummary] = useState({ total_amount: 0, count: 0 });
  const [loading, setLoading] = useState(true);

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isRunningCostModalOpen, setIsRunningCostModalOpen] = useState(false);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Vendor form
  const [vendorForm, setVendorForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    tax_id: '',
    address: '',
  });

  // Running cost form
  const [runningCostForm, setRunningCostForm] = useState({
    project: selectedProjectId || '',
    amount: '',
    description: '',
    payment_method: 'cash',
    date: new Date().toISOString().split('T')[0],
  });

  // Running costs filter
  const [rcFilter, setRcFilter] = useState({
    search: '',
    payment_method: '',
  });

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
    vehicle_number: '',
    distance_km: '',
    utility_type: 'ELECTRICITY',
    billing_month: new Date().toISOString().slice(0, 7),
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
      const [expRes, venRes, projRes, rcRes, rcSum] = await Promise.all([
        api.expenses.list(params),
        api.expenses.listVendors(),
        api.projects.list(),
        api.runningCosts.list(params).catch(() => ({ results: [] })),
        api.runningCosts.summary(params).catch(() => ({ total_amount: 0, count: 0 })),
      ]);
      setExpenses(Array.isArray(expRes) ? expRes : expRes.results || []);
      setVendors(Array.isArray(venRes) ? venRes : venRes.results || []);
      setProjects(Array.isArray(projRes) ? projRes : projRes.results || []);
      setRunningCosts(Array.isArray(rcRes) ? rcRes : rcRes.results || []);
      setRunningCostsSummary(rcSum);
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

    // Credit mode validation checks
    if (expenseForm.payment_mode === 'CREDIT') {
      if (!expenseForm.vendor) {
        alert('Please select an assigned vendor for Vendor Credit (Pay Later) purchase. If the vendor is not in the list, click "+ Add Vendor" to register them.');
        return;
      }
      if (!expenseForm.due_date) {
        alert('Please specify a credit due date for Vendor Credit purchases.');
        return;
      }
    }

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

      // Attach category-specific details
      const details = {};
      if (expenseForm.category === 'TRANSPORT') {
        details.vehicle_number = expenseForm.vehicle_number?.trim() || 'SITE-LOGISTICS';
        details.distance_km = expenseForm.distance_km !== '' ? Number(expenseForm.distance_km) : 0;
      } else if (expenseForm.category === 'UTILITY') {
        details.utility_type = expenseForm.utility_type || 'ELECTRICITY';
        details.billing_month = expenseForm.billing_month || new Date().toISOString().slice(0, 7);
      }
      if (Object.keys(details).length > 0) {
        formData.append('details', JSON.stringify(details));
      }

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
        vehicle_number: '',
        distance_km: '',
        utility_type: 'ELECTRICITY',
        billing_month: new Date().toISOString().slice(0, 7),
      });
      alert('Site expense logged successfully!');
      await fetchData();
    } catch (err) {
      alert(`Error logging expense: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateVendor = async (e) => {
    e.preventDefault();
    if (!vendorForm.name.trim()) {
      alert('Please enter a Vendor / Company Name.');
      return;
    }
    setSubmitting(true);
    try {
      const newVendor = await api.expenses.createVendor(vendorForm);
      setVendors((prev) => [...prev, newVendor]);
      // If opened while creating an expense, automatically select the new vendor
      if (isExpenseModalOpen) {
        setExpenseForm((prev) => ({ ...prev, vendor: newVendor.id }));
      }
      setIsVendorModalOpen(false);
      setVendorForm({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        tax_id: '',
        address: '',
      });
      alert(`Vendor "${newVendor.name}" registered successfully!`);
      await fetchData();
    } catch (err) {
      alert(`Error registering vendor: ${err.message}`);
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

  const handleCreateRunningCost = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.runningCosts.create({
        ...runningCostForm,
        project: Number(runningCostForm.project),
        amount: Number(runningCostForm.amount),
      });
      setIsRunningCostModalOpen(false);
      setRunningCostForm({
        project: selectedProjectId || '',
        amount: '',
        description: '',
        payment_method: 'cash',
        date: new Date().toISOString().split('T')[0],
      });
      alert('Running cost recorded successfully! (Cash deductions processed via FIFO)');
      await fetchData();
    } catch (err) {
      alert(`Error logging running cost: ${err.message || 'Operation failed'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRunningCost = async (id) => {
    if (!window.confirm('Are you sure you want to delete this running cost entry?')) {
      return;
    }
    try {
      await api.runningCosts.delete(id);
      alert('Running cost deleted.');
      await fetchData();
    } catch (err) {
      alert(`Deletion error: ${err.message}`);
    }
  };

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const canApprove = role === 'ORG_ADMIN' || role === 'PROJECT_MANAGER';

  const filteredRunningCosts = runningCosts.filter((rc) => {
    if (rcFilter.search && !rc.description?.toLowerCase().includes(rcFilter.search.toLowerCase()) && !rc.user_name?.toLowerCase().includes(rcFilter.search.toLowerCase())) {
      return false;
    }
    if (rcFilter.payment_method && rc.payment_method !== rcFilter.payment_method) {
      return false;
    }
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px' }}>
            Site Spend & Vendor Credit Control
          </h2>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.88rem' }}>
            Material receipts, credit purchases, operational site running costs, and Accounts Payable ledger.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'running_costs' ? (
            <button onClick={() => setIsRunningCostModalOpen(true)} className="btn btn-primary">
              <Plus size={16} />
              <span>Log Running Cost</span>
            </button>
          ) : activeTab === 'vendors' ? (
            <button onClick={() => setIsVendorModalOpen(true)} className="btn btn-primary">
              <Plus size={16} />
              <span>Add New Vendor</span>
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setIsVendorModalOpen(true)} className="btn btn-secondary">
                <Plus size={16} />
                <span>Add Vendor</span>
              </button>
              <button onClick={() => setIsExpenseModalOpen(true)} className="btn btn-primary">
                <Plus size={16} />
                <span>Log Site Expense</span>
              </button>
            </div>
          )}
        </div>
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
        <button
          onClick={() => setActiveTab('running_costs')}
          className={`btn btn-sm ${activeTab === 'running_costs' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Running Costs (Site Expenses) ({runningCosts.length})
        </button>
      </div>

      {activeTab === 'expenses' ? (
        <div className="card card-table">
          {loading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading expenses ledger...
            </div>
          ) : expenses.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-subtle)' }}>
              No expenses recorded yet. Click "Log Site Expense" to add your first record.
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}>Date & Ref</th>
                    <th style={{ width: '120px' }}>Category</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right', width: '130px' }}>Amount</th>
                    <th style={{ textAlign: 'center', width: '140px' }}>Payment Mode</th>
                    <th style={{ textAlign: 'center', width: '110px' }}>Receipt</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>Status</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>Actions</th>
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
                      <td style={{ maxWidth: '280px', color: 'var(--text-main)', fontSize: '0.86rem' }}>
                        <div style={{ fontWeight: 500 }}>{exp.description}</div>
                        {exp.vendor_name && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                            Vendor: <span style={{ fontWeight: 600 }}>{exp.vendor_name}</span>
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                        {formatCurrency(exp.amount)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Badge status={exp.payment_mode}>{exp.payment_mode}</Badge>
                      </td>
                      <td style={{ textAlign: 'center' }}>
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
                      <td style={{ textAlign: 'center' }}>
                        <Badge status={exp.status}>{exp.status}</Badge>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {exp.status === 'PENDING_APPROVAL' && canApprove && exp.logged_by !== user?.id ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
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
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.78rem' }}>
                      Total Recorded Expenses:
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--accent)', fontSize: '1rem' }}>
                      {formatCurrency(expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0))}
                    </td>
                    <td colSpan={4} style={{ textAlign: 'left', fontSize: '0.76rem', color: 'var(--text-subtle)' }}>
                      {expenses.length} transactions in ledger
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Vendors Credit Tab */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {vendors.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-subtle)', gridColumn: '1 / -1' }}>
              <Building size={48} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                No Vendors Registered Yet
              </h3>
              <p style={{ fontSize: '0.86rem', maxWidth: '420px', margin: '0 auto 18px', lineHeight: 1.5 }}>
                Register your suppliers, material providers, and transport contractors to track accounts payable and credit purchases.
              </p>
              <button onClick={() => setIsVendorModalOpen(true)} className="btn btn-primary" style={{ margin: '0 auto' }}>
                <Plus size={16} />
                <span>Add First Vendor</span>
              </button>
            </div>
          ) : (
            vendors.map((ven) => {
              const balance = Number(ven.outstanding_balance || 0);
              return (
                <div key={ven.id} className="card">
                  <div className="card-header">
                    <div>
                      <h3 className="card-title" style={{ fontSize: '1.15rem' }}>{ven.name}</h3>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                        {ven.contact_person ? `Contact: ${ven.contact_person} • ` : ''}
                        Phone: {ven.phone || 'N/A'} • Tax ID: {ven.tax_id || 'Unregistered'}
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

                  {['ORG_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT'].includes(role) && (
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
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'running_costs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Site Running Costs
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {formatCurrency(runningCostsSummary.total_amount || 0)}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: '4px' }}>
                Operational site spend across {runningCostsSummary.count || 0} entries
              </div>
            </div>

            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>
                FIFO Cash Protection
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981', marginTop: '6px' }}>
                Active Petty Cash Pool Gated
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: '4px' }}>
                Cash expenses automatically debit the oldest available admin credit log via FIFO.
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card" style={{ padding: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
              <input
                type="text"
                placeholder="Search descriptions, admin names..."
                value={rcFilter.search}
                onChange={(e) => setRcFilter({ ...rcFilter, search: e.target.value })}
                className="form-control"
                style={{ paddingLeft: '36px' }}
              />
            </div>

            <select
              className="form-control"
              style={{ width: '180px' }}
              value={rcFilter.payment_method}
              onChange={(e) => setRcFilter({ ...rcFilter, payment_method: e.target.value })}
            >
              <option value="">All Payment Modes</option>
              <option value="cash">Cash (Credit Gated)</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Running Costs Table */}
          <div className="card card-table">
            {loading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading running costs...
              </div>
            ) : filteredRunningCosts.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-subtle)' }}>
                No site running costs found. Click "Log Running Cost" to record field consumables, fuel, or minor repairs.
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Date & Site</th>
                      <th>Expense Description</th>
                      <th style={{ textAlign: 'center', width: '160px' }}>Recorded By</th>
                      <th style={{ textAlign: 'center', width: '140px' }}>Payment Mode</th>
                      <th style={{ textAlign: 'right', width: '140px' }}>Amount</th>
                      <th style={{ textAlign: 'center', width: '100px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRunningCosts.map((rc) => (
                      <tr key={rc.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{rc.date}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>
                            {rc.project_name || `Site #${rc.project}`}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                            {rc.description}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>{rc.user_name || 'Admin'}</div>
                          <Badge status={rc.user_role || 'ADMIN'}>{rc.user_role || 'ADMIN'}</Badge>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <Badge status={rc.payment_method?.toUpperCase()}>
                            {rc.payment_method === 'cash' ? '💵 Cash (FIFO)' : rc.payment_method?.toUpperCase()}
                          </Badge>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-main)', fontSize: '0.98rem' }}>
                          {formatCurrency(rc.amount)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {(role === 'ORG_ADMIN' || user?.id === rc.entered_by) && (
                            <button
                              onClick={() => handleDeleteRunningCost(rc.id)}
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                              title="Delete and reverse credit deduction"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
                <option value="EQUIPMENT_RENTAL">Equipment Rental</option>
                <option value="FUEL">Fuel</option>
                <option value="TRANSPORT">Transport</option>
                <option value="UTILITY">Utility</option>
                <option value="PETTY_CASH">Petty Cash</option>
                <option value="OTHER">Other / Labor</option>
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

          {/* Conditional Transport Details */}
          {expenseForm.category === 'TRANSPORT' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)', marginBottom: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Vehicle Number</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. GJ-01-AB-1234 or SITE-TRUCK"
                  value={expenseForm.vehicle_number}
                  onChange={(e) => setExpenseForm({ ...expenseForm, vehicle_number: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Distance (KM)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="form-control"
                  placeholder="0"
                  value={expenseForm.distance_km}
                  onChange={(e) => setExpenseForm({ ...expenseForm, distance_km: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Conditional Utility Details */}
          {expenseForm.category === 'UTILITY' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)', marginBottom: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Utility Type</label>
                <select
                  className="form-control"
                  value={expenseForm.utility_type}
                  onChange={(e) => setExpenseForm({ ...expenseForm, utility_type: e.target.value })}
                >
                  <option value="ELECTRICITY">Electricity</option>
                  <option value="WATER">Water</option>
                  <option value="SECURITY">Security</option>
                  <option value="DUMPSTER">Dumpster</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Billing Month</label>
                <input
                  type="month"
                  className="form-control"
                  value={expenseForm.billing_month}
                  onChange={(e) => setExpenseForm({ ...expenseForm, billing_month: e.target.value })}
                />
              </div>
            </div>
          )}

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  {expenseForm.payment_mode === 'CREDIT' ? 'Vendor (Required for Credit) *' : 'Vendor (Optional)'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsVendorModalOpen(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                >
                  + Add Vendor
                </button>
              </div>
              <select
                required={expenseForm.payment_mode === 'CREDIT'}
                className="form-control"
                value={expenseForm.vendor}
                onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
              >
                <option value="">{expenseForm.payment_mode === 'CREDIT' ? 'Select an Assigned Vendor *' : 'None / Site Direct'}</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              {expenseForm.payment_mode === 'CREDIT' && vendors.length === 0 && (
                <div style={{ fontSize: '0.74rem', color: '#f59e0b', marginTop: '4px' }}>
                  ⚠️ No vendors found. Click "+ Add Vendor" above to register a supplier for this credit purchase.
                </div>
              )}
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
      {/* Running Cost Creation Modal */}
      <Modal isOpen={isRunningCostModalOpen} onClose={() => setIsRunningCostModalOpen(false)} title="Log Site Running Cost">
        <form onSubmit={handleCreateRunningCost}>
          <div className="form-group">
            <label className="form-label">Project *</label>
            <select
              required
              className="form-control"
              value={runningCostForm.project}
              onChange={(e) => setRunningCostForm({ ...runningCostForm, project: e.target.value })}
            >
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input
                type="date"
                required
                max={new Date().toISOString().split('T')[0]}
                className="form-control"
                value={runningCostForm.date}
                onChange={(e) => setRunningCostForm({ ...runningCostForm, date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                className="form-control"
                placeholder="2500.00"
                value={runningCostForm.amount}
                onChange={(e) => setRunningCostForm({ ...runningCostForm, amount: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Method *</label>
            <select
              className="form-control"
              value={runningCostForm.payment_method}
              onChange={(e) => setRunningCostForm({ ...runningCostForm, payment_method: e.target.value })}
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Expense Description *</label>
            <input
              type="text"
              required
              className="form-control"
              placeholder="e.g. 5 bags cement, fuel for mixer, snacks for labor"
              value={runningCostForm.description}
              onChange={(e) => setRunningCostForm({ ...runningCostForm, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsRunningCostModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Recording...' : 'Record Running Cost'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Vendor Creation Modal */}
      <Modal isOpen={isVendorModalOpen} onClose={() => setIsVendorModalOpen(false)} title="Register New Supplier / Vendor">
        <form onSubmit={handleCreateVendor}>
          <div className="form-group">
            <label className="form-label">Vendor / Company Name *</label>
            <input
              type="text"
              required
              className="form-control"
              placeholder="e.g. Mahalaxmi Cement & Steels"
              value={vendorForm.name}
              onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Ramesh Patel"
                value={vendorForm.contact_person}
                onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input
                type="tel"
                className="form-control"
                placeholder="e.g. 9825123456 (10 digits)"
                value={vendorForm.phone}
                onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="vendor@company.com"
                value={vendorForm.email}
                onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">GSTIN / Tax ID</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 24AAACH7409R1ZZ"
                value={vendorForm.tax_id}
                onChange={(e) => setVendorForm({ ...vendorForm, tax_id: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Office / Billing Address</label>
            <textarea
              rows={2}
              className="form-control"
              placeholder="e.g. Plot 12, GIDC Phase 2, Ahmedabad"
              value={vendorForm.address}
              onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsVendorModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Registering...' : 'Save & Register Vendor'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
