import React, { useState, useEffect } from 'react';
import {
  Coins,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  User,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  CreditCard,
  Building2,
  Trash2,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  IndianRupee,
  Layers,
  ArrowUpRight,
  Clock,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

export const CreditsView = () => {
  const { user, role } = useAuth();
  const [creditLogs, setCreditLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  // Expanded row tracking for expense sub-documents
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Modals
  const [isAddCreditOpen, setIsAddCreditOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [selectedLogForExpense, setSelectedLogForExpense] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [creditForm, setCreditForm] = useState({
    credited_by: '',
    amount: '',
    transaction_date: new Date().toISOString().split('T')[0],
    description: '',
    individual_name: '',
    category: 'Petty Cash Pool',
    payment_method: 'CASH',
  });

  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const loadCredits = async () => {
    setLoading(true);
    try {
      const [logsRes, summaryRes, teamRes] = await Promise.all([
        api.creditLogs.list(),
        api.creditLogs.summary(),
        api.auth.getTeam ? api.auth.getTeam() : Promise.resolve([]),
      ]);
      setCreditLogs(Array.isArray(logsRes) ? logsRes : logsRes?.results || []);
      setSummary(summaryRes);
      // Team members
      const team = Array.isArray(teamRes) ? teamRes : teamRes?.results || [];
      setAdmins(team);
    } catch (err) {
      toast.error(`Failed to load credits: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCredits();
  }, []);

  const handleCreateCredit = async (e) => {
    e.preventDefault();
    const amt = Number(creditForm.amount);
    if (!amt || amt <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    setSubmitting(true);
    try {
      await api.creditLogs.create({
        ...creditForm,
        amount: amt.toFixed(2),
        credited_by: creditForm.credited_by || user.id,
      });
      toast.success('Cash credit pool created successfully!');
      setIsAddCreditOpen(false);
      setCreditForm({
        credited_by: '',
        amount: '',
        transaction_date: new Date().toISOString().split('T')[0],
        description: '',
        individual_name: '',
        category: 'Petty Cash Pool',
        payment_method: 'CASH',
      });
      loadCredits();
    } catch (err) {
      toast.error(err.message || 'Failed to create credit pool');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!selectedLogForExpense) return;
    const amt = Number(expenseForm.amount);
    if (!amt || amt <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    if (amt > Number(selectedLogForExpense.remaining_balance)) {
      toast.error(
        `Expense amount (₹${amt}) exceeds available remaining balance (₹${selectedLogForExpense.remaining_balance})`
      );
      return;
    }

    setSubmitting(true);
    try {
      await api.creditLogs.addExpense(selectedLogForExpense.id, {
        amount: amt.toFixed(2),
        description: expenseForm.description,
        date: expenseForm.date,
      });
      toast.success('Expense recorded against credit log!');
      setIsAddExpenseOpen(false);
      setSelectedLogForExpense(null);
      setExpenseForm({
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
      });
      loadCredits();
    } catch (err) {
      toast.error(err.message || 'Failed to record expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCredit = async (id) => {
    if (!window.confirm('Are you sure you want to delete this credit log entry?')) return;
    try {
      await api.creditLogs.delete(id);
      toast.success('Credit log deleted.');
      loadCredits();
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleRemoveExpense = async (logId, expId) => {
    if (!window.confirm('Remove this expense deduction and restore credit balance?')) return;
    try {
      await api.creditLogs.removeExpense(logId, expId);
      toast.success('Expense removed and credit restored.');
      loadCredits();
    } catch (err) {
      toast.error(err.message || 'Failed to remove expense');
    }
  };

  const formatCurrency = (val) =>
    `₹${Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Coins className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
              Credits Module (Cash Pool Management)
            </h1>
          </div>
          <p className="text-xs md:text-sm text-[var(--text-muted)] mt-1">
            Petty cash and advance pool management for site admins with automated FIFO deductions for UPAD and running costs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() => setIsAddCreditOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="font-bold shadow-lg shadow-purple-500/25 bg-purple-600 hover:bg-purple-700"
          >
            Add Cash Credit Pool
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              Total Cash Credited
            </span>
            <div className="text-xl md:text-2xl font-black text-purple-600 dark:text-purple-400">
              {formatCurrency(summary.total_credited)}
            </div>
            <span className="text-xs text-[var(--text-muted)]">Across {summary.total_transactions} credit advances</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              Total Consumed (FIFO)
            </span>
            <div className="text-xl md:text-2xl font-black text-red-600 dark:text-red-400">
              {formatCurrency(summary.total_spent)}
            </div>
            <span className="text-xs text-[var(--text-muted)]">UPAD payments & running costs</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              Remaining Active Cash
            </span>
            <div className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(summary.remaining_balance)}
            </div>
            <span className="text-xs text-[var(--text-muted)]">Available for immediate disbursement</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              Active Credit Pools
            </span>
            <div className="text-xl md:text-2xl font-black text-blue-600 dark:text-blue-400">
              {summary.active_pools}
            </div>
            <span className="text-xs text-[var(--text-muted)]">Pools with remaining balance</span>
          </div>
        </div>
      )}

      {/* Credit Logs List */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">
          Cash Credit Pools & FIFO Deductions
        </h3>

        <div className="space-y-3">
          {creditLogs.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] text-[var(--text-muted)]">
              No cash credit pools found. Click <strong>+ Add Cash Credit Pool</strong> to grant funds to an admin.
            </div>
          ) : (
            creditLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const percentUsed =
                log.amount > 0 ? (Number(log.amount_spent) / Number(log.amount)) * 100 : 0;

              return (
                <div
                  key={log.id}
                  className="rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] shadow-sm overflow-hidden"
                >
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] mt-1"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[var(--text-primary)]">
                            {log.description}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              log.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                : log.status === 'fully_utilized'
                                ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                : 'bg-red-500/10 text-red-600'
                            }`}
                          >
                            {log.status}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5 flex flex-wrap items-center gap-3">
                          <span>Admin: <strong className="text-[var(--text-secondary)]">{log.credited_by_name || log.credited_by_email}</strong></span>
                          <span>Source: <strong>{log.individual_name || 'Organization Owner'}</strong></span>
                          <span>Date: <strong>{log.transaction_date}</strong></span>
                          <span>Method: <strong>{log.payment_method}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-xs text-[var(--text-muted)] font-medium">Available Balance</div>
                        <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(log.remaining_balance)}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          of {formatCurrency(log.amount)} ({percentUsed.toFixed(0)}% used)
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {log.status === 'active' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedLogForExpense(log);
                              setIsAddExpenseOpen(true);
                            }}
                            className="text-xs font-bold"
                          >
                            + Expense
                          </Button>
                        )}
                        <button
                          onClick={() => handleDeleteCredit(log.id)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 w-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 transition-all duration-300"
                      style={{ width: `${Math.min(percentUsed, 100)}%` }}
                    />
                  </div>

                  {/* Expandable Expense Sub-documents Drawer */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-50/75 dark:bg-[var(--bg-secondary)] border-t border-[var(--border-default)] space-y-2">
                      <div className="text-xs font-bold text-[var(--text-secondary)] flex items-center justify-between">
                        <span>FIFO Deductions & Expense History ({log.expenses?.length || 0})</span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          Automatically deducted when cash payments are disbursed
                        </span>
                      </div>

                      {(!log.expenses || log.expenses.length === 0) ? (
                        <div className="text-xs text-[var(--text-muted)] py-3 text-center">
                          No deductions recorded yet. Available balance is 100% untouched.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {log.expenses.map((exp) => (
                            <div
                              key={exp.id}
                              className="p-2.5 rounded-xl bg-white dark:bg-[var(--bg-primary)] border border-[var(--border-default)] flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-3">
                                <ArrowUpRight className="w-4 h-4 text-red-500 shrink-0" />
                                <div>
                                  <div className="font-bold text-[var(--text-primary)]">
                                    {exp.description}
                                  </div>
                                  <div className="text-[10px] text-[var(--text-muted)]">
                                    {exp.date} • Recorded by {exp.recorded_by_name || exp.recorded_by_email}
                                    {exp.transaction_id && ` • Txn: ${exp.transaction_id}`}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="font-black text-red-600 dark:text-red-400">
                                  -{formatCurrency(exp.amount)}
                                </span>
                                <button
                                  onClick={() => handleRemoveExpense(log.id, exp.id)}
                                  title="Remove deduction & restore credit"
                                  className="text-slate-400 hover:text-red-500"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Cash Credit Pool Modal */}
      <Modal
        isOpen={isAddCreditOpen}
        onClose={() => setIsAddCreditOpen(false)}
        title="Add Cash Credit Pool"
        subtitle="Record cash advance handed to a site admin for local disbursement."
        size="md"
      >
        <form onSubmit={handleCreateCredit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              Admin / Site Recipient *
            </label>
            <select
              value={creditForm.credited_by}
              onChange={(e) => setCreditForm({ ...creditForm, credited_by: e.target.value })}
              className="w-full rounded-xl border border-gray-300 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
            >
              <option value="">Current User ({user?.email})</option>
              {admins.map((adm) => (
                <option key={adm.id} value={adm.id}>
                  {adm.name || adm.email} ({adm.role})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Credit Amount *"
              type="number"
              step="0.01"
              icon={IndianRupee}
              placeholder="e.g. 50000.00"
              value={creditForm.amount}
              onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })}
            />
            <Input
              label="Credit Date *"
              type="date"
              value={creditForm.transaction_date}
              onChange={(e) => setCreditForm({ ...creditForm, transaction_date: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Provided By (Source Individual)"
              placeholder="e.g. Chairman / Director"
              value={creditForm.individual_name}
              onChange={(e) => setCreditForm({ ...creditForm, individual_name: e.target.value })}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                Payment Method *
              </label>
              <select
                value={creditForm.payment_method}
                onChange={(e) => setCreditForm({ ...creditForm, payment_method: e.target.value })}
                className="w-full rounded-xl border border-gray-300 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              >
                <option value="CASH">Physical Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer (Petty Account)</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              Description / Pool Purpose *
            </label>
            <input
              type="text"
              placeholder="e.g. Site Petty Cash Advance - Week 43"
              value={creditForm.description}
              onChange={(e) => setCreditForm({ ...creditForm, description: e.target.value })}
              className="w-full rounded-xl border border-gray-300 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
            <Button type="button" variant="secondary" onClick={() => setIsAddCreditOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
              className="bg-purple-600 hover:bg-purple-700 font-bold shadow-lg shadow-purple-500/25"
            >
              Add Cash Pool
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manual Expense Modal */}
      <Modal
        isOpen={isAddExpenseOpen}
        onClose={() => {
          setIsAddExpenseOpen(false);
          setSelectedLogForExpense(null);
        }}
        title="Record Expense Against Cash Pool"
        subtitle={
          selectedLogForExpense
            ? `Available Balance: ${formatCurrency(selectedLogForExpense.remaining_balance)}`
            : ''
        }
        size="md"
      >
        <form onSubmit={handleAddExpense} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Expense Amount *"
              type="number"
              step="0.01"
              icon={IndianRupee}
              max={selectedLogForExpense?.remaining_balance}
              placeholder="0.00"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            />
            <Input
              label="Date *"
              type="date"
              value={expenseForm.date}
              onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              Expense Description *
            </label>
            <input
              type="text"
              placeholder="e.g. Urgent hardware fasteners / Site lunch for emergency crew"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              className="w-full rounded-xl border border-gray-300 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsAddExpenseOpen(false);
                setSelectedLogForExpense(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
              className="bg-purple-600 hover:bg-purple-700 font-bold"
            >
              Deduct From Pool
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
