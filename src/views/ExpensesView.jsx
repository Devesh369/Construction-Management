import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Receipt,
  Plus,
  CheckCircle2,
  XCircle,
  FileText,
  CreditCard,
  Building2,
  AlertTriangle,
  Upload,
  Search,
  Trash2,
  AlertCircle,
  Eye,
  Phone,
  Mail,
  MapPin,
  IndianRupee,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  RefreshCw,
  Download,
  Calendar,
  User,
  Tag,
  ChevronDown,
  Check,
  X,
  ShieldCheck,
  Banknote,
  Sparkles,
  Layers,
  ChevronRight,
  Coins,
  Truck,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

export const ExpensesView = ({ selectedProjectId }) => {
  const { user, role } = useAuth();

  // Active sub-tab: 'expenses' | 'vendors' | 'running_costs'
  const [activeTab, setActiveTab] = useState('expenses');

  // Master Data
  const [expenses, setExpenses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [runningCosts, setRunningCosts] = useState([]);
  const [runningCostsSummary, setRunningCostsSummary] = useState({ total_amount: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isRunningCostModalOpen, setIsRunningCostModalOpen] = useState(false);
  const [isVendorStatementOpen, setIsVendorStatementOpen] = useState(false);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedExpenseDetail, setSelectedExpenseDetail] = useState(null);
  const [vendorLedgerData, setVendorLedgerData] = useState(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters & Search for Tab 1 (Expenses)
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [expensePaymentModeFilter, setExpensePaymentModeFilter] = useState('all');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('all');
  const [expenseProjectFilter, setExpenseProjectFilter] = useState(selectedProjectId || 'all');
  const [expensePerPage, setExpensePerPage] = useState('10');
  const [expensePage, setExpensePage] = useState(1);

  // Filters & Search for Tab 2 (Vendors)
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorBalanceFilter, setVendorBalanceFilter] = useState('all'); // 'all' | 'due' | 'settled'
  const [vendorSortBy, setVendorSortBy] = useState('balance_desc'); // 'balance_desc' | 'name_asc' | 'recent'
  const [vendorPerPage, setVendorPerPage] = useState('10');
  const [vendorPage, setVendorPage] = useState(1);

  // Filters & Search for Tab 3 (Running Costs)
  const [rcSearch, setRcSearch] = useState('');
  const [rcPaymentFilter, setRcPaymentFilter] = useState('all');
  const [rcProjectFilter, setRcProjectFilter] = useState(selectedProjectId || 'all');
  const [rcPerPage, setRcPerPage] = useState('10');
  const [rcPage, setRcPage] = useState(1);

  // Forms
  const [vendorForm, setVendorForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    tax_id: '',
    address: '',
  });

  const [runningCostForm, setRunningCostForm] = useState({
    project: selectedProjectId || '',
    amount: '',
    description: '',
    payment_method: 'cash',
    date: new Date().toISOString().split('T')[0],
  });

  const [expenseForm, setExpenseForm] = useState({
    project: selectedProjectId || '',
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

  // Fetch all data
  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = selectedProjectId ? { project: selectedProjectId } : {};
      const [expRes, venRes, projRes, rcRes, rcSum] = await Promise.all([
        api.expenses.list(params).catch(() => []),
        api.expenses.listVendors().catch(() => []),
        api.projects.list().catch(() => []),
        api.runningCosts.list(params).catch(() => ({ results: [] })),
        api.runningCosts.summary(params).catch(() => ({ total_amount: 0, count: 0 })),
      ]);

      const expList = Array.isArray(expRes) ? expRes : expRes.results || [];
      const venList = Array.isArray(venRes) ? venRes : venRes.results || [];
      const projList = Array.isArray(projRes) ? projRes : projRes.results || [];
      const rcList = Array.isArray(rcRes) ? rcRes : rcRes.results || [];

      setExpenses(expList);
      setVendors(venList);
      setProjects(projList);
      setRunningCosts(rcList);
      setRunningCostsSummary(rcSum || { total_amount: 0, count: 0 });

      if (isManualRefresh) {
        toast.success('Records refreshed successfully!');
      }
    } catch (err) {
      console.error('Failed to load expenses/vendors:', err);
      toast.error('Failed to load latest records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProjectId]);

  // Synchronize project filter when selectedProjectId changes
  useEffect(() => {
    if (selectedProjectId) {
      setExpenseProjectFilter(selectedProjectId);
      setRcProjectFilter(selectedProjectId);
      setExpenseForm((prev) => ({ ...prev, project: selectedProjectId }));
      setRunningCostForm((prev) => ({ ...prev, project: selectedProjectId }));
    }
  }, [selectedProjectId]);

  // Currency formatter
  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Date formatter
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Vendor Monogram
  const getMonogram = (name) => {
    if (!name) return 'V';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  // Category Configuration
  const getCategoryConfig = (cat) => {
    switch (cat) {
      case 'MATERIAL':
        return { label: 'Material', icon: '🧱', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800/40' };
      case 'EQUIPMENT_RENTAL':
        return { label: 'Equipment Rental', icon: '🚜', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800/40' };
      case 'FUEL':
        return { label: 'Fuel / Diesel', icon: '⛽', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/40' };
      case 'TRANSPORT':
        return { label: 'Transport / Logistics', icon: '🚚', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40' };
      case 'UTILITY':
        return { label: 'Site Utility', icon: '💡', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/40' };
      case 'PETTY_CASH':
        return { label: 'Petty Cash', icon: '💵', badge: 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border-teal-200 dark:border-teal-800/40' };
      default:
        return { label: cat || 'Other', icon: '🏷️', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
    }
  };

  // Permission check for approval
  const canApprove =
    role === 'ORG_ADMIN' ||
    role === 'SUPER_ADMIN' ||
    role === 'PROJECT_MANAGER' ||
    role === 'SITE_MANAGER';

  // KPI Calculations
  const metrics = useMemo(() => {
    // Total recorded expenses
    const totalExpensesAmount = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const approvedExpensesAmount = expenses
      .filter((e) => e.status === 'APPROVED')
      .reduce((acc, e) => acc + Number(e.amount || 0), 0);

    // Pending expenses
    const pendingExpenses = expenses.filter((e) => e.status === 'PENDING' || e.status === 'PENDING_APPROVAL');
    const pendingAmount = pendingExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

    // Total running costs
    const totalRunningCosts = Number(runningCostsSummary.total_amount || 0);

    // Overall Total Spend
    const overallTotalSpend = totalExpensesAmount + totalRunningCosts;

    // Vendor Liabilities
    let totalVendorLiability = 0;
    let vendorsWithDue = 0;

    vendors.forEach((v) => {
      // Calculate dynamic balance if not set
      let bal = Number(v.outstanding_balance || 0);
      if (bal === 0) {
        const vCreditExpenses = expenses.filter(
          (e) => Number(e.vendor) === Number(v.id) && e.payment_mode === 'CREDIT'
        );
        const creditSum = vCreditExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        bal = creditSum;
      }
      if (bal > 0) {
        totalVendorLiability += bal;
        vendorsWithDue++;
      }
    });

    return {
      overallTotalSpend,
      approvedExpensesAmount,
      totalExpensesAmount,
      pendingCount: pendingExpenses.length,
      pendingAmount,
      totalVendorLiability,
      vendorsWithDue,
      totalRunningCosts,
    };
  }, [expenses, vendors, runningCostsSummary]);

  // Tab 1: Filtered & Paginated Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // Search
      if (expenseSearch.trim()) {
        const q = expenseSearch.toLowerCase();
        const matchDesc = exp.description?.toLowerCase().includes(q);
        const matchVendor = exp.vendor_name?.toLowerCase().includes(q);
        const matchProject = exp.project_name?.toLowerCase().includes(q);
        const matchAmt = String(exp.amount || '').includes(q);
        if (!matchDesc && !matchVendor && !matchProject && !matchAmt) return false;
      }
      // Project
      if (expenseProjectFilter !== 'all' && String(exp.project) !== String(expenseProjectFilter)) {
        return false;
      }
      // Category
      if (expenseCategoryFilter !== 'all' && exp.category !== expenseCategoryFilter) {
        return false;
      }
      // Payment Mode
      if (expensePaymentModeFilter !== 'all' && exp.payment_mode !== expensePaymentModeFilter) {
        return false;
      }
      // Status
      if (expenseStatusFilter !== 'all') {
        if (expenseStatusFilter === 'PENDING' && exp.status !== 'PENDING' && exp.status !== 'PENDING_APPROVAL') {
          return false;
        }
        if (expenseStatusFilter !== 'PENDING' && exp.status !== expenseStatusFilter) {
          return false;
        }
      }
      return true;
    });
  }, [expenses, expenseSearch, expenseProjectFilter, expenseCategoryFilter, expensePaymentModeFilter, expenseStatusFilter]);

  const paginatedExpenses = useMemo(() => {
    if (expensePerPage === 'All') return filteredExpenses;
    const limit = Number(expensePerPage);
    const start = (expensePage - 1) * limit;
    return filteredExpenses.slice(start, start + limit);
  }, [filteredExpenses, expensePerPage, expensePage]);

  // Tab 2: Filtered & Sorted Vendors
  const processedVendors = useMemo(() => {
    // Augment vendor data with live stats from expenses
    const enriched = vendors.map((ven) => {
      const venExpenses = expenses.filter((e) => Number(e.vendor) === Number(ven.id));
      const totalBilled = venExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
      const creditBilled = venExpenses
        .filter((e) => e.payment_mode === 'CREDIT')
        .reduce((s, e) => s + Number(e.amount || 0), 0);

      // Use backend provided balance or calculate credit - payments
      const balance =
        ven.outstanding_balance !== undefined
          ? Number(ven.outstanding_balance)
          : creditBilled;

      return {
        ...ven,
        total_billed: totalBilled,
        calculated_balance: balance,
        bill_count: venExpenses.length,
      };
    });

    // Apply Filter
    const filtered = enriched.filter((ven) => {
      if (vendorSearch.trim()) {
        const q = vendorSearch.toLowerCase();
        const matchName = ven.name?.toLowerCase().includes(q);
        const matchContact = ven.contact_person?.toLowerCase().includes(q);
        const matchPhone = ven.phone?.toLowerCase().includes(q);
        const matchTax = (ven.tax_id || ven.gstin)?.toLowerCase().includes(q);
        const matchAddress = ven.address?.toLowerCase().includes(q);
        if (!matchName && !matchContact && !matchPhone && !matchTax && !matchAddress) {
          return false;
        }
      }

      if (vendorBalanceFilter === 'due' && ven.calculated_balance <= 0) return false;
      if (vendorBalanceFilter === 'settled' && ven.calculated_balance > 0) return false;

      return true;
    });

    // Apply Sorting
    return filtered.sort((a, b) => {
      if (vendorSortBy === 'balance_desc') return b.calculated_balance - a.calculated_balance;
      if (vendorSortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (vendorSortBy === 'recent') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      return 0;
    });
  }, [vendors, expenses, vendorSearch, vendorBalanceFilter, vendorSortBy]);

  const paginatedVendors = useMemo(() => {
    if (vendorPerPage === 'All') return processedVendors;
    const limit = Number(vendorPerPage);
    const start = (vendorPage - 1) * limit;
    return processedVendors.slice(start, start + limit);
  }, [processedVendors, vendorPerPage, vendorPage]);

  // Tab 3: Filtered Running Costs
  const filteredRunningCosts = useMemo(() => {
    return runningCosts.filter((rc) => {
      if (rcSearch.trim()) {
        const q = rcSearch.toLowerCase();
        const matchDesc = rc.description?.toLowerCase().includes(q);
        const matchUser = rc.user_name?.toLowerCase().includes(q);
        const matchProject = rc.project_name?.toLowerCase().includes(q);
        if (!matchDesc && !matchUser && !matchProject) return false;
      }
      if (rcProjectFilter !== 'all' && String(rc.project) !== String(rcProjectFilter)) {
        return false;
      }
      if (rcPaymentFilter !== 'all' && rc.payment_method !== rcPaymentFilter) {
        return false;
      }
      return true;
    });
  }, [runningCosts, rcSearch, rcProjectFilter, rcPaymentFilter]);

  const paginatedRunningCosts = useMemo(() => {
    if (rcPerPage === 'All') return filteredRunningCosts;
    const limit = Number(rcPerPage);
    const start = (rcPage - 1) * limit;
    return filteredRunningCosts.slice(start, start + limit);
  }, [filteredRunningCosts, rcPerPage, rcPage]);

  // Handle Approve Expense
  const handleApprove = async (expenseId) => {
    try {
      await api.expenses.approve(expenseId);
      toast.success('Expense approved & posted to Project Ledger!');
      await fetchData();
    } catch (err) {
      toast.error(`Approval error: ${err.message}`);
    }
  };

  // Handle Reject Expense
  const handleReject = async (expenseId) => {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;
    try {
      await api.expenses.reject(expenseId, reason);
      toast.success('Expense rejected.');
      await fetchData();
    } catch (err) {
      toast.error(`Rejection error: ${err.message}`);
    }
  };

  // Handle Create Expense
  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.project) {
      toast.error('Please select a project site.');
      return;
    }
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }
    if (expenseForm.payment_mode === 'CREDIT' && !expenseForm.vendor) {
      toast.error('A registered Vendor is required for Credit purchases.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('project', expenseForm.project);
      formData.append('category', expenseForm.category);
      formData.append('description', expenseForm.description || `${expenseForm.category} Purchase`);
      formData.append('amount', expenseForm.amount);
      formData.append('expense_date', expenseForm.expense_date);
      formData.append('payment_mode', expenseForm.payment_mode);
      if (expenseForm.vendor) formData.append('vendor', expenseForm.vendor);
      if (expenseForm.due_date) formData.append('due_date', expenseForm.due_date);
      if (expenseForm.receipt) formData.append('receipt', expenseForm.receipt);

      const details = {};
      if (expenseForm.category === 'TRANSPORT') {
        details.vehicle_number = expenseForm.vehicle_number?.trim() || 'SITE-TRUCK';
        details.distance_km = expenseForm.distance_km !== '' ? Number(expenseForm.distance_km) : 0;
      } else if (expenseForm.category === 'UTILITY') {
        details.utility_type = expenseForm.utility_type || 'ELECTRICITY';
        details.billing_month = expenseForm.billing_month || new Date().toISOString().slice(0, 7);
      }
      if (Object.keys(details).length > 0) {
        formData.append('details', JSON.stringify(details));
      }

      await api.expenses.create(formData);
      toast.success('Site purchase recorded successfully!');
      setIsExpenseModalOpen(false);
      setExpenseForm({
        project: selectedProjectId || '',
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
      await fetchData();
    } catch (err) {
      toast.error(`Failed to record expense: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Create Vendor
  const handleCreateVendor = async (e) => {
    e.preventDefault();
    if (!vendorForm.name.trim()) {
      toast.error('Please enter the vendor / company name.');
      return;
    }

    setSubmitting(true);
    try {
      const newVendor = await api.expenses.createVendor({
        name: vendorForm.name.trim(),
        contact_person: vendorForm.contact_person.trim(),
        phone: vendorForm.phone.trim(),
        email: vendorForm.email.trim(),
        tax_id: vendorForm.tax_id.trim(),
        gstin: vendorForm.tax_id.trim(),
        address: vendorForm.address.trim(),
      });

      toast.success(`Vendor "${newVendor.name}" registered successfully!`);
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
      await fetchData();
    } catch (err) {
      toast.error(`Vendor registration failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Record Vendor Payment (Repayment)
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedVendor) return;
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      toast.error('Please enter a valid repayment amount.');
      return;
    }

    setSubmitting(true);
    try {
      await api.expenses.recordVendorPayment(selectedVendor.id, {
        ...paymentForm,
        project: paymentForm.project ? Number(paymentForm.project) : undefined,
      });
      toast.success(`Repayment of ${formatCurrency(paymentForm.amount)} posted to ${selectedVendor.name}!`);
      setIsPaymentModalOpen(false);
      setPaymentForm({
        project: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: 'BANK_TRANSFER',
        reference: '',
        notes: '',
      });
      await fetchData();
    } catch (err) {
      toast.error(`Repayment failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Create Running Cost
  const handleCreateRunningCost = async (e) => {
    e.preventDefault();
    if (!runningCostForm.project) {
      toast.error('Please select a project.');
      return;
    }
    if (!runningCostForm.amount || Number(runningCostForm.amount) <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }

    setSubmitting(true);
    try {
      await api.runningCosts.create({
        ...runningCostForm,
        project: Number(runningCostForm.project),
        amount: Number(runningCostForm.amount),
      });
      toast.success('Site running cost recorded! (Petty cash debited via FIFO)');
      setIsRunningCostModalOpen(false);
      setRunningCostForm({
        project: selectedProjectId || '',
        amount: '',
        description: '',
        payment_method: 'cash',
        date: new Date().toISOString().split('T')[0],
      });
      await fetchData();
    } catch (err) {
      toast.error(`Failed to record running cost: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Running Cost
  const handleDeleteRunningCost = async (id) => {
    if (!window.confirm('Are you sure you want to delete this running cost record?')) return;
    try {
      await api.runningCosts.delete(id);
      toast.success('Running cost entry deleted.');
      await fetchData();
    } catch (err) {
      toast.error(`Deletion failed: ${err.message}`);
    }
  };

  // Open Vendor Statement Modal
  const openVendorStatement = async (vendor) => {
    setSelectedVendor(vendor);
    setIsVendorStatementOpen(true);
    setLoadingLedger(true);
    try {
      const ledger = await api.expenses.getVendorLedger(vendor.id);
      setVendorLedgerData(ledger);
    } catch {
      // Fallback: extract from local expenses
      const venExp = expenses.filter((e) => Number(e.vendor) === Number(vendor.id));
      setVendorLedgerData({
        vendor_id: vendor.id,
        total_billed: vendor.total_billed || 0,
        outstanding: vendor.calculated_balance || 0,
        entries: venExp,
      });
    } finally {
      setLoadingLedger(false);
    }
  };

  // Open Payment Modal for a Vendor
  const openPaymentModal = (vendor) => {
    setSelectedVendor(vendor);
    setPaymentForm({
      project: selectedProjectId || projects[0]?.id || '',
      amount: String(vendor.calculated_balance || vendor.outstanding_balance || ''),
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: 'BANK_TRANSFER',
      reference: `UTR-${Date.now().toString().slice(-6)}`,
      notes: `Settlement for ${vendor.name}`,
    });
    setIsPaymentModalOpen(true);
  };

  // Export current table records to CSV
  const handleExportCSV = () => {
    let rows = [];
    let filename = 'spend_records.csv';

    if (activeTab === 'expenses') {
      filename = `expenses_ledger_${new Date().toISOString().split('T')[0]}.csv`;
      rows = [
        ['ID', 'Date', 'Project', 'Category', 'Description', 'Vendor', 'Amount', 'Payment Mode', 'Due Date', 'Status'],
        ...filteredExpenses.map((e) => [
          e.id,
          e.expense_date,
          e.project_name || e.project,
          e.category,
          `"${(e.description || '').replace(/"/g, '""')}"`,
          `"${(e.vendor_name || '').replace(/"/g, '""')}"`,
          e.amount,
          e.payment_mode,
          e.due_date || '',
          e.status,
        ]),
      ];
    } else if (activeTab === 'vendors') {
      filename = `vendors_directory_${new Date().toISOString().split('T')[0]}.csv`;
      rows = [
        ['ID', 'Vendor Name', 'Contact Person', 'Phone', 'Email', 'GSTIN/Tax ID', 'Address', 'Total Procurement', 'Outstanding Balance', 'Status'],
        ...processedVendors.map((v) => [
          v.id,
          `"${(v.name || '').replace(/"/g, '""')}"`,
          `"${(v.contact_person || '').replace(/"/g, '""')}"`,
          v.phone || '',
          v.email || '',
          v.tax_id || v.gstin || '',
          `"${(v.address || '').replace(/"/g, '""')}"`,
          v.total_billed,
          v.calculated_balance,
          v.calculated_balance > 0 ? 'PAYMENT DUE' : 'SETTLED',
        ]),
      ];
    } else {
      filename = `running_costs_${new Date().toISOString().split('T')[0]}.csv`;
      rows = [
        ['ID', 'Date', 'Project', 'Description', 'Recorded By', 'Payment Method', 'Amount'],
        ...filteredRunningCosts.map((rc) => [
          rc.id,
          rc.date,
          rc.project_name || rc.project,
          `"${(rc.description || '').replace(/"/g, '""')}"`,
          rc.user_name || 'Admin',
          rc.payment_method,
          rc.amount,
        ]),
      ];
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${rows.length - 1} records to CSV!`);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & QUICK ACTION HUB                                          */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-default)] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/40">
              Accounts Payable & Site Procurement
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
                Spend & Vendors
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">
                Material procurement, vendor payables, operational running costs, and Accounts Payable ledger.
              </p>
            </div>
          </div>
        </div>

        {/* Action Hub Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchData(true)}
            isLoading={refreshing}
            leftIcon={<RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />}
            className="text-[var(--text-secondary)]"
            title="Refresh Data"
          >
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-4 h-4" />}
            className="text-xs font-semibold"
          >
            Export CSV
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsVendorModalOpen(true)}
            leftIcon={<Building2 className="w-4 h-4 text-emerald-600" />}
            className="text-xs font-bold"
          >
            + Register Vendor
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsRunningCostModalOpen(true)}
            leftIcon={<Coins className="w-4 h-4 text-amber-500" />}
            className="text-xs font-bold"
          >
            + Log Running Cost
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsExpenseModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="text-xs font-bold shadow-md shadow-blue-500/20"
          >
            + Log Site Expense
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FINANCIAL KPI STATS BANNER                                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Spend Recorded */}
        <div className="p-4 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] shadow-sm hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              Total Recorded Spend
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
            {formatCurrency(metrics.overallTotalSpend)}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[var(--text-secondary)]">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(metrics.approvedExpensesAmount)}
            </span>
            <span>approved across {expenses.length} invoices</span>
          </div>
        </div>

        {/* KPI 2: Vendor Credit / AP Liability */}
        <div className="p-4 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/50 via-white to-white dark:from-amber-950/20 dark:via-[var(--bg-primary)] dark:to-[var(--bg-primary)] shadow-sm hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Vendor Liabilities (AP)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-400 tracking-tight">
            {formatCurrency(metrics.totalVendorLiability)}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
            <span>{metrics.vendorsWithDue} suppliers with outstanding credit</span>
          </div>
        </div>

        {/* KPI 3: Pending Approvals */}
        <div className="p-4 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] shadow-sm hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              Pending Verification
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
            {formatCurrency(metrics.pendingAmount)}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[var(--text-secondary)]">
            <span className="font-semibold text-purple-600 dark:text-purple-400">
              {metrics.pendingCount} bills
            </span>
            <span>awaiting PM / Admin signoff</span>
          </div>
        </div>

        {/* KPI 4: Petty Cash / Running Costs */}
        <div className="p-4 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] shadow-sm hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              Field Running Costs
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center shrink-0">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
            {formatCurrency(metrics.totalRunningCosts)}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>FIFO petty cash pool gated</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SEGMENTED TABS WITH COUNTS                                             */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-[var(--border-default)] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('expenses')}
          className={cn(
            'flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all cursor-pointer select-none shrink-0',
            activeTab === 'expenses'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
          )}
        >
          <Receipt className="w-4 h-4" />
          <span>Expenses Ledger</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-black',
              activeTab === 'expenses'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-[var(--text-muted)]'
            )}
          >
            {expenses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('vendors')}
          className={cn(
            'flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all cursor-pointer select-none shrink-0',
            activeTab === 'vendors'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
          )}
        >
          <Building2 className="w-4 h-4" />
          <span>Vendors Directory & Payables</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1',
              activeTab === 'vendors'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-[var(--text-muted)]'
            )}
          >
            {vendors.length}
            {metrics.vendorsWithDue > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
            )}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('running_costs')}
          className={cn(
            'flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all cursor-pointer select-none shrink-0',
            activeTab === 'running_costs'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
          )}
        >
          <Coins className="w-4 h-4" />
          <span>Site Running Costs (FIFO)</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-black',
              activeTab === 'running_costs'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-[var(--text-muted)]'
            )}
          >
            {runningCosts.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SITE EXPENSES LEDGER (TABULAR FORM)                                */}
      {/* ========================================================================= */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="p-3.5 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search description, vendor name, invoice ref..."
                value={expenseSearch}
                onChange={(e) => {
                  setExpenseSearch(e.target.value);
                  setExpensePage(1);
                }}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 text-xs font-semibold text-[var(--text-primary)] placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center flex-wrap gap-2 text-xs">
              {/* Project Filter */}
              <select
                value={expenseProjectFilter}
                onChange={(e) => {
                  setExpenseProjectFilter(e.target.value);
                  setExpensePage(1);
                }}
                className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Sites & Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                value={expenseCategoryFilter}
                onChange={(e) => {
                  setExpenseCategoryFilter(e.target.value);
                  setExpensePage(1);
                }}
                className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Categories</option>
                <option value="MATERIAL">🧱 Material</option>
                <option value="EQUIPMENT_RENTAL">🚜 Equipment Rental</option>
                <option value="FUEL">⛽ Fuel</option>
                <option value="TRANSPORT">🚚 Transport</option>
                <option value="UTILITY">💡 Utility</option>
                <option value="PETTY_CASH">💵 Petty Cash</option>
                <option value="OTHER">🏷️ Other</option>
              </select>

              {/* Payment Mode Filter */}
              <select
                value={expensePaymentModeFilter}
                onChange={(e) => {
                  setExpensePaymentModeFilter(e.target.value);
                  setExpensePage(1);
                }}
                className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Modes</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CREDIT">Vendor Credit</option>
              </select>

              {/* Status Filter */}
              <select
                value={expenseStatusFilter}
                onChange={(e) => {
                  setExpenseStatusFilter(e.target.value);
                  setExpensePage(1);
                }}
                className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Status</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING">Pending Approval</option>
                <option value="REJECTED">Rejected</option>
              </select>

              {/* Per Page */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--border-default)]">
                <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">ROWS</span>
                <select
                  value={expensePerPage}
                  onChange={(e) => {
                    setExpensePerPage(e.target.value);
                    setExpensePage(1);
                  }}
                  className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="All">All</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabular Expenses Table Card */}
          <div className="rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] overflow-hidden shadow-sm">
            {loading ? (
              <div className="py-16 text-center text-sm font-semibold text-[var(--text-muted)] animate-pulse">
                Loading expenses ledger records...
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                  <Receipt className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">No Expenses Found</h3>
                <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                  {expenseSearch || expenseCategoryFilter !== 'all' || expenseStatusFilter !== 'all'
                    ? 'No expenses match your active filter criteria.'
                    : 'Click "Log Site Expense" to record material purchases and vendor orders.'}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsExpenseModalOpen(true)}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Log First Site Purchase
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#EFE8DC] dark:bg-[#1C2537] text-[#2C2721] dark:text-[#E2E8F0] border-b border-[#DCD3C4] dark:border-[var(--border-default)] text-xs font-black uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12 text-center">#</th>
                      <th className="py-3.5 px-4">DATE & SITE</th>
                      <th className="py-3.5 px-4">CATEGORY</th>
                      <th className="py-3.5 px-4">DESCRIPTION & VENDOR</th>
                      <th className="py-3.5 px-4 text-right">AMOUNT</th>
                      <th className="py-3.5 px-4 text-center">MODE</th>
                      <th className="py-3.5 px-4 text-center">RECEIPT</th>
                      <th className="py-3.5 px-4 text-center">STATUS</th>
                      <th className="py-3.5 px-4 text-center">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[var(--border-subtle)] text-xs font-medium">
                    {paginatedExpenses.map((exp, idx) => {
                      const rowNum =
                        expensePerPage === 'All'
                          ? idx + 1
                          : (expensePage - 1) * Number(expensePerPage) + idx + 1;
                      const catConfig = getCategoryConfig(exp.category);

                      return (
                        <tr
                          key={exp.id}
                          className="group hover:bg-slate-50/80 dark:hover:bg-[var(--bg-secondary)] transition-colors"
                        >
                          {/* Col 0: Index */}
                          <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                            {rowNum}
                          </td>

                          {/* Col 1: Date & Site */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-sm text-[var(--text-primary)]">
                              {formatDate(exp.expense_date)}
                            </div>
                            <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 truncate max-w-[150px]">
                              {exp.project_name || `Site #${exp.project}`}
                            </div>
                          </td>

                          {/* Col 2: Category */}
                          <td className="py-3.5 px-4">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border shadow-2xs',
                                catConfig.badge
                              )}
                            >
                              <span>{catConfig.icon}</span>
                              <span>{catConfig.label}</span>
                            </span>
                          </td>

                          {/* Col 3: Description & Vendor */}
                          <td className="py-3.5 px-4 max-w-[280px]">
                            <div className="font-bold text-sm text-[var(--text-primary)] leading-snug">
                              {exp.description}
                            </div>
                            {exp.vendor_name ? (
                              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] mt-1">
                                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="font-semibold text-[var(--text-primary)]">
                                  {exp.vendor_name}
                                </span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                                Site Direct Purchase
                              </div>
                            )}

                            {/* Additional category tags */}
                            {exp.details?.vehicle_number && (
                              <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                                <Truck className="w-3 h-3" />
                                <span>{exp.details.vehicle_number}</span>
                                {exp.details.distance_km > 0 && <span>({exp.details.distance_km} km)</span>}
                              </div>
                            )}
                            {exp.details?.utility_type && (
                              <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                                <Zap className="w-3 h-3" />
                                <span>{exp.details.utility_type} • {exp.details.billing_month}</span>
                              </div>
                            )}
                          </td>

                          {/* Col 4: Amount */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-black text-sm text-[var(--text-primary)] font-mono">
                              {formatCurrency(exp.amount)}
                            </span>
                          </td>

                          {/* Col 5: Payment Mode */}
                          <td className="py-3.5 px-4 text-center">
                            {exp.payment_mode === 'CREDIT' ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300/40">
                                  Vendor Credit
                                </span>
                                {exp.due_date && (
                                  <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                                    Due: {formatDate(exp.due_date)}
                                  </span>
                                )}
                              </div>
                            ) : exp.payment_mode === 'BANK_TRANSFER' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-300/40">
                                Bank Transfer
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40">
                                Cash
                              </span>
                            )}
                          </td>

                          {/* Col 6: Receipt Document */}
                          <td className="py-3.5 px-4 text-center">
                            {exp.receipt ? (
                              <button
                                type="button"
                                onClick={() => setSelectedReceiptUrl(exp.receipt)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/40 text-[11px] font-bold text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                                title="Click to view attached bill"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Bill</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-[var(--text-muted)]">—</span>
                            )}
                          </td>

                          {/* Col 7: Status */}
                          <td className="py-3.5 px-4 text-center">
                            {exp.status === 'APPROVED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300/40">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Approved</span>
                              </span>
                            ) : exp.status === 'REJECTED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300/40">
                                <XCircle className="w-3 h-3" />
                                <span>Rejected</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300/40">
                                <Clock className="w-3 h-3 animate-pulse" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>

                          {/* Col 8: Actions */}
                          <td className="py-3.5 px-4 text-center">
                            {(exp.status === 'PENDING' || exp.status === 'PENDING_APPROVAL') && canApprove ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleApprove(exp.id)}
                                  className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                                  title="Approve & Post to Project Spend"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReject(exp.id)}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                                  title="Reject Expense"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedExpenseDetail(exp)}
                                className="text-[11px] font-bold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                              >
                                View
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Table Summary Footer */}
                  <tfoot>
                    <tr className="bg-slate-50/80 dark:bg-slate-900/80 border-t border-[var(--border-default)] font-bold text-xs text-[var(--text-primary)]">
                      <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider text-[11px] text-[var(--text-muted)]">
                        Filtered Subtotal ({filteredExpenses.length} records):
                      </td>
                      <td className="py-3 px-4 text-right font-black text-sm font-mono text-blue-600 dark:text-blue-400">
                        {formatCurrency(filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0))}
                      </td>
                      <td colSpan={4} className="py-3 px-4 text-xs text-[var(--text-muted)]">
                        All invoices validated via role-based financial ledger
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {filteredExpenses.length > 0 && expensePerPage !== 'All' && (
              <div className="p-3 border-t border-[var(--border-default)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <div>
                  Showing{' '}
                  <strong className="text-[var(--text-primary)]">
                    {(expensePage - 1) * Number(expensePerPage) + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-[var(--text-primary)]">
                    {Math.min(expensePage * Number(expensePerPage), filteredExpenses.length)}
                  </strong>{' '}
                  of <strong className="text-[var(--text-primary)]">{filteredExpenses.length}</strong>{' '}
                  records
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={expensePage === 1}
                    onClick={() => setExpensePage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="px-2 font-bold text-[var(--text-primary)]">
                    Page {expensePage} of {Math.ceil(filteredExpenses.length / Number(expensePerPage)) || 1}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={expensePage >= Math.ceil(filteredExpenses.length / Number(expensePerPage))}
                    onClick={() => setExpensePage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: VENDORS DIRECTORY & PAYABLES (TABULAR FORM)                        */}
      {/* ========================================================================= */}
      {activeTab === 'vendors' && (
        <div className="space-y-4">
          {/* Vendor Filters & Search Bar */}
          <div className="p-3.5 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search vendor name, contact person, phone, GSTIN, address..."
                value={vendorSearch}
                onChange={(e) => {
                  setVendorSearch(e.target.value);
                  setVendorPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 text-xs font-semibold text-[var(--text-primary)] placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center flex-wrap gap-2 text-xs">
              {/* Credit / Balance Filter */}
              <select
                value={vendorBalanceFilter}
                onChange={(e) => {
                  setVendorBalanceFilter(e.target.value);
                  setVendorPage(1);
                }}
                className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Vendors</option>
                <option value="due">⚠️ Has Balance Due (Credit)</option>
                <option value="settled">✅ All Settled (Zero Balance)</option>
              </select>

              {/* Sort By */}
              <select
                value={vendorSortBy}
                onChange={(e) => {
                  setVendorSortBy(e.target.value);
                  setVendorPage(1);
                }}
                className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="balance_desc">Highest Balance First</option>
                <option value="name_asc">Company Name (A-Z)</option>
                <option value="recent">Recently Added</option>
              </select>

              {/* Per Page */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--border-default)]">
                <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">ROWS</span>
                <select
                  value={vendorPerPage}
                  onChange={(e) => {
                    setVendorPerPage(e.target.value);
                    setVendorPage(1);
                  }}
                  className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="All">All</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabular Vendors Table Card */}
          <div className="rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] overflow-hidden shadow-sm">
            {loading ? (
              <div className="py-16 text-center text-sm font-semibold text-[var(--text-muted)] animate-pulse">
                Loading vendor directory & credit balances...
              </div>
            ) : processedVendors.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">No Vendors Found</h3>
                <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                  {vendorSearch || vendorBalanceFilter !== 'all'
                    ? 'No vendors match your search criteria.'
                    : 'Register your material suppliers and subcontractors to manage Accounts Payable.'}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsVendorModalOpen(true)}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Register First Vendor
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#EFE8DC] dark:bg-[#1C2537] text-[#2C2721] dark:text-[#E2E8F0] border-b border-[#DCD3C4] dark:border-[var(--border-default)] text-xs font-black uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12 text-center">#</th>
                      <th className="py-3.5 px-4">VENDOR & GSTIN</th>
                      <th className="py-3.5 px-4">CONTACT PERSON</th>
                      <th className="py-3.5 px-4">PHONE & EMAIL</th>
                      <th className="py-3.5 px-4">OFFICE ADDRESS</th>
                      <th className="py-3.5 px-4 text-right">TOTAL BILLED</th>
                      <th className="py-3.5 px-4 text-right">BALANCE DUE (AP)</th>
                      <th className="py-3.5 px-4 text-center">STATUS</th>
                      <th className="py-3.5 px-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[var(--border-subtle)] text-xs font-medium">
                    {paginatedVendors.map((ven, idx) => {
                      const rowNum =
                        vendorPerPage === 'All'
                          ? idx + 1
                          : (vendorPage - 1) * Number(vendorPerPage) + idx + 1;
                      const hasBalance = ven.calculated_balance > 0;

                      return (
                        <tr
                          key={ven.id}
                          className="group hover:bg-slate-50/80 dark:hover:bg-[var(--bg-secondary)] transition-colors"
                        >
                          {/* Col 0: Index */}
                          <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                            {rowNum}
                          </td>

                          {/* Col 1: Vendor Name & GSTIN */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                                {getMonogram(ven.name)}
                              </div>
                              <div>
                                <div className="font-bold text-sm text-[var(--text-primary)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {ven.name}
                                </div>
                                <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                                  {ven.tax_id || ven.gstin ? (
                                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                      GSTIN: {ven.tax_id || ven.gstin}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">GST: Unregistered</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Col 2: Contact Person */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{ven.contact_person || 'Direct Rep'}</span>
                            </div>
                          </td>

                          {/* Col 3: Phone & Email */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              {ven.phone ? (
                                <a
                                  href={`tel:${ven.phone}`}
                                  className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-bold"
                                >
                                  <Phone className="w-3 h-3 shrink-0" />
                                  <span>{ven.phone}</span>
                                </a>
                              ) : (
                                <span className="text-[11px] text-[var(--text-muted)]">No phone</span>
                              )}
                              {ven.email && (
                                <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                                  <Mail className="w-3 h-3 shrink-0" />
                                  <span className="truncate max-w-[140px]">{ven.email}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Col 4: Address */}
                          <td className="py-3.5 px-4 max-w-[200px]">
                            {ven.address ? (
                              <div className="flex items-start gap-1 text-[11px] text-[var(--text-secondary)] line-clamp-2">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                <span>{ven.address}</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-[var(--text-muted)]">—</span>
                            )}
                          </td>

                          {/* Col 5: Total Billed */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="font-bold text-xs text-[var(--text-primary)] font-mono">
                              {formatCurrency(ven.total_billed)}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              {ven.bill_count || 0} orders
                            </div>
                          </td>

                          {/* Col 6: Outstanding Balance Due */}
                          <td className="py-3.5 px-4 text-right">
                            <div
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black font-mono border',
                                hasBalance
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300/60 shadow-2xs'
                                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300/60'
                              )}
                            >
                              {hasBalance ? (
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                              )}
                              <span>{formatCurrency(ven.calculated_balance)}</span>
                            </div>
                          </td>

                          {/* Col 7: Status */}
                          <td className="py-3.5 px-4 text-center">
                            {hasBalance ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300/40">
                                Payment Due
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40">
                                Settled
                              </span>
                            )}
                          </td>

                          {/* Col 8: Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {canApprove && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  disabled={!hasBalance}
                                  onClick={() => openPaymentModal(ven)}
                                  leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                                  className={cn(
                                    'py-1 px-2.5 text-[11px] font-bold',
                                    hasBalance
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                                      : 'opacity-40'
                                  )}
                                  title={hasBalance ? 'Record Repayment' : 'No balance due'}
                                >
                                  Settle Bill
                                </Button>
                              )}

                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openVendorStatement(ven)}
                                leftIcon={<FileText className="w-3.5 h-3.5 text-blue-500" />}
                                className="py-1 px-2.5 text-[11px] font-bold"
                                title="View Complete Ledger Statement"
                              >
                                Statement
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Table Summary Footer */}
                  <tfoot>
                    <tr className="bg-slate-50/80 dark:bg-slate-900/80 border-t border-[var(--border-default)] font-bold text-xs text-[var(--text-primary)]">
                      <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wider text-[11px] text-[var(--text-muted)]">
                        Total Vendor Liability Across {processedVendors.length} Suppliers:
                      </td>
                      <td className="py-3 px-4 text-right font-black text-sm font-mono text-slate-700 dark:text-slate-300">
                        {formatCurrency(processedVendors.reduce((s, v) => s + Number(v.total_billed || 0), 0))}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-sm font-mono text-amber-600 dark:text-amber-400">
                        {formatCurrency(processedVendors.reduce((s, v) => s + Number(v.calculated_balance || 0), 0))}
                      </td>
                      <td colSpan={2} className="py-3 px-4 text-xs text-[var(--text-muted)] text-center">
                        Accounts Payable CR 2001
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {processedVendors.length > 0 && vendorPerPage !== 'All' && (
              <div className="p-3 border-t border-[var(--border-default)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <div>
                  Showing{' '}
                  <strong className="text-[var(--text-primary)]">
                    {(vendorPage - 1) * Number(vendorPerPage) + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-[var(--text-primary)]">
                    {Math.min(vendorPage * Number(vendorPerPage), processedVendors.length)}
                  </strong>{' '}
                  of <strong className="text-[var(--text-primary)]">{processedVendors.length}</strong>{' '}
                  vendors
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={vendorPage === 1}
                    onClick={() => setVendorPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="px-2 font-bold text-[var(--text-primary)]">
                    Page {vendorPage} of {Math.ceil(processedVendors.length / Number(vendorPerPage)) || 1}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={vendorPage >= Math.ceil(processedVendors.length / Number(vendorPerPage))}
                    onClick={() => setVendorPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SITE RUNNING COSTS & PETTY CASH (TABULAR FORM)                      */}
      {/* ========================================================================= */}
      {activeTab === 'running_costs' && (
        <div className="space-y-4">
          {/* Running Costs Banner */}
          <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-300">
                  FIFO Petty Cash Protection Active
                </h4>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                  Cash expenses automatically debit the oldest active Admin credit pool to prevent unbacked field spend.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsRunningCostModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 self-start sm:self-auto"
            >
              Log Running Cost
            </Button>
          </div>

          {/* Filter & Search Bar */}
          <div className="p-3.5 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search descriptions, admin recorder names..."
                value={rcSearch}
                onChange={(e) => {
                  setRcSearch(e.target.value);
                  setRcPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 text-xs font-semibold text-[var(--text-primary)] placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center flex-wrap gap-2 text-xs">
              {/* Project Filter */}
              <select
                value={rcProjectFilter}
                onChange={(e) => {
                  setRcProjectFilter(e.target.value);
                  setRcPage(1);
                }}
                className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Sites & Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>

              {/* Payment Mode */}
              <select
                value={rcPaymentFilter}
                onChange={(e) => {
                  setRcPaymentFilter(e.target.value);
                  setRcPage(1);
                }}
                className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Payment Methods</option>
                <option value="cash">💵 Cash (FIFO Gated)</option>
                <option value="bank_transfer">🏦 Bank Transfer</option>
                <option value="upi">📱 UPI</option>
                <option value="cheque">📝 Cheque</option>
                <option value="other">Other</option>
              </select>

              {/* Rows */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--border-default)]">
                <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">ROWS</span>
                <select
                  value={rcPerPage}
                  onChange={(e) => {
                    setRcPerPage(e.target.value);
                    setRcPage(1);
                  }}
                  className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="All">All</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabular Running Costs Table Card */}
          <div className="rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] overflow-hidden shadow-sm">
            {loading ? (
              <div className="py-16 text-center text-sm font-semibold text-[var(--text-muted)] animate-pulse">
                Loading site running costs...
              </div>
            ) : filteredRunningCosts.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 flex items-center justify-center">
                  <Coins className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">No Running Costs Found</h3>
                <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                  Record daily operational field expenses like fuel, minor hardware, labor tea/snacks, and petty cash.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsRunningCostModalOpen(true)}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Log First Running Cost
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#EFE8DC] dark:bg-[#1C2537] text-[#2C2721] dark:text-[#E2E8F0] border-b border-[#DCD3C4] dark:border-[var(--border-default)] text-xs font-black uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12 text-center">#</th>
                      <th className="py-3.5 px-4">DATE & SITE</th>
                      <th className="py-3.5 px-4">EXPENSE DESCRIPTION</th>
                      <th className="py-3.5 px-4">RECORDED BY</th>
                      <th className="py-3.5 px-4 text-center">PAYMENT METHOD</th>
                      <th className="py-3.5 px-4 text-right">AMOUNT</th>
                      <th className="py-3.5 px-4 text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[var(--border-subtle)] text-xs font-medium">
                    {paginatedRunningCosts.map((rc, idx) => {
                      const rowNum =
                        rcPerPage === 'All'
                          ? idx + 1
                          : (rcPage - 1) * Number(rcPerPage) + idx + 1;

                      return (
                        <tr
                          key={rc.id}
                          className="group hover:bg-slate-50/80 dark:hover:bg-[var(--bg-secondary)] transition-colors"
                        >
                          {/* Col 0: Index */}
                          <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                            {rowNum}
                          </td>

                          {/* Col 1: Date & Site */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-sm text-[var(--text-primary)]">
                              {formatDate(rc.date)}
                            </div>
                            <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 truncate max-w-[150px]">
                              {rc.project_name || `Site #${rc.project}`}
                            </div>
                          </td>

                          {/* Col 2: Expense Description */}
                          <td className="py-3.5 px-4 max-w-[320px]">
                            <div className="font-bold text-sm text-[var(--text-primary)]">
                              {rc.description}
                            </div>
                          </td>

                          {/* Col 3: Recorded By */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-[var(--text-secondary)] flex items-center justify-center font-bold text-[10px] shrink-0">
                                {getMonogram(rc.user_name || 'Admin')}
                              </div>
                              <div>
                                <div className="font-bold text-xs text-[var(--text-primary)]">
                                  {rc.user_name || 'Admin'}
                                </div>
                                <span className="inline-block text-[9px] font-black uppercase text-slate-500">
                                  {rc.user_role || 'ADMIN'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Col 4: Payment Method */}
                          <td className="py-3.5 px-4 text-center">
                            {rc.payment_method === 'cash' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40">
                                💵 Cash (FIFO)
                              </span>
                            ) : rc.payment_method === 'upi' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-300/40">
                                📱 UPI
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-300/40">
                                🏦 {rc.payment_method?.toUpperCase()}
                              </span>
                            )}
                          </td>

                          {/* Col 5: Amount */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-black text-sm text-[var(--text-primary)] font-mono">
                              {formatCurrency(rc.amount)}
                            </span>
                          </td>

                          {/* Col 6: Action */}
                          <td className="py-3.5 px-4 text-center">
                            {(role === 'ORG_ADMIN' || user?.id === rc.entered_by) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteRunningCost(rc.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Delete & Reverse credit allocation"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Table Summary Footer */}
                  <tfoot>
                    <tr className="bg-slate-50/80 dark:bg-slate-900/80 border-t border-[var(--border-default)] font-bold text-xs text-[var(--text-primary)]">
                      <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wider text-[11px] text-[var(--text-muted)]">
                        Total Running Costs ({filteredRunningCosts.length} items):
                      </td>
                      <td className="py-3 px-4 text-right font-black text-sm font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(filteredRunningCosts.reduce((s, r) => s + Number(r.amount || 0), 0))}
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-[var(--text-muted)]">
                        Direct Site Spend
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {filteredRunningCosts.length > 0 && rcPerPage !== 'All' && (
              <div className="p-3 border-t border-[var(--border-default)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <div>
                  Showing{' '}
                  <strong className="text-[var(--text-primary)]">
                    {(rcPage - 1) * Number(rcPerPage) + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-[var(--text-primary)]">
                    {Math.min(rcPage * Number(rcPerPage), filteredRunningCosts.length)}
                  </strong>{' '}
                  of <strong className="text-[var(--text-primary)]">{filteredRunningCosts.length}</strong>{' '}
                  entries
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={rcPage === 1}
                    onClick={() => setRcPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="px-2 font-bold text-[var(--text-primary)]">
                    Page {rcPage} of {Math.ceil(filteredRunningCosts.length / Number(rcPerPage)) || 1}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={rcPage >= Math.ceil(filteredRunningCosts.length / Number(rcPerPage))}
                    onClick={() => setRcPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD SITE PURCHASE / EXPENSE                                   */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="Record Site Purchase / Spend"
        size="lg"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Site Project *
            </label>
            <select
              required
              value={expenseForm.project}
              onChange={(e) => setExpenseForm({ ...expenseForm, project: e.target.value })}
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">Select Project Site</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Category *
              </label>
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="MATERIAL">🧱 Material</option>
                <option value="EQUIPMENT_RENTAL">🚜 Equipment Rental</option>
                <option value="FUEL">⛽ Fuel</option>
                <option value="TRANSPORT">🚚 Transport / Logistics</option>
                <option value="UTILITY">💡 Utility (Power/Water)</option>
                <option value="PETTY_CASH">💵 Petty Cash</option>
                <option value="OTHER">🏷️ Other / Labor Direct</option>
              </select>
            </div>

            <Input
              label="Amount (₹) *"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="e.g. 45000.00"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            />
          </div>

          {/* Conditional Transport Details */}
          {expenseForm.category === 'TRANSPORT' && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-[var(--border-default)] grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Vehicle Number"
                placeholder="e.g. GJ-01-AB-1234 or SITE-TRUCK"
                value={expenseForm.vehicle_number}
                onChange={(e) => setExpenseForm({ ...expenseForm, vehicle_number: e.target.value })}
              />
              <Input
                label="Distance (KM)"
                type="number"
                step="0.1"
                placeholder="0"
                value={expenseForm.distance_km}
                onChange={(e) => setExpenseForm({ ...expenseForm, distance_km: e.target.value })}
              />
            </div>
          )}

          {/* Conditional Utility Details */}
          {expenseForm.category === 'UTILITY' && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-[var(--border-default)] grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Utility Type
                </label>
                <select
                  value={expenseForm.utility_type}
                  onChange={(e) => setExpenseForm({ ...expenseForm, utility_type: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none"
                >
                  <option value="ELECTRICITY">⚡ Electricity</option>
                  <option value="WATER">💧 Water Tanker</option>
                  <option value="SECURITY">🛡️ Security Guard</option>
                  <option value="DUMPSTER">🗑️ Dumpster / Waste</option>
                  <option value="OTHER">Other Utility</option>
                </select>
              </div>

              <Input
                label="Billing Month"
                type="month"
                value={expenseForm.billing_month}
                onChange={(e) => setExpenseForm({ ...expenseForm, billing_month: e.target.value })}
              />
            </div>
          )}

          <Input
            label="Description *"
            required
            placeholder="e.g. 500 bags OPC 53 Grade Cement or Excavator rental 8 hrs"
            value={expenseForm.description}
            onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Payment Mode *
              </label>
              <select
                value={expenseForm.payment_mode}
                onChange={(e) => setExpenseForm({ ...expenseForm, payment_mode: e.target.value })}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="CASH">💵 Cash</option>
                <option value="BANK_TRANSFER">🏦 Bank Transfer (RTGS / NEFT)</option>
                <option value="CREDIT">⚠️ Vendor Credit (Accounts Payable)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {expenseForm.payment_mode === 'CREDIT' ? 'Supplier / Vendor *' : 'Vendor (Optional)'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsVendorModalOpen(true)}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  + Add Vendor
                </button>
              </div>
              <select
                required={expenseForm.payment_mode === 'CREDIT'}
                value={expenseForm.vendor}
                onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">{expenseForm.payment_mode === 'CREDIT' ? 'Select Registered Vendor *' : 'Direct / Non-vendor'}</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conditional Credit Due Date */}
          {expenseForm.payment_mode === 'CREDIT' && (
            <Input
              label="Credit Repayment Due Date"
              type="date"
              value={expenseForm.due_date}
              onChange={(e) => setExpenseForm({ ...expenseForm, due_date: e.target.value })}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Expense Date *"
              type="date"
              max={new Date().toISOString().split('T')[0]}
              required
              value={expenseForm.expense_date}
              onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Bill / Scanned Receipt File
              </label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setExpenseForm({ ...expenseForm, receipt: e.target.files[0] })}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border-default)]">
            <Button variant="secondary" onClick={() => setIsExpenseModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Log Site Purchase
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: REGISTER NEW VENDOR                                              */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        title="Register New Material Supplier / Vendor"
        size="md"
      >
        <form onSubmit={handleCreateVendor} className="space-y-4">
          <Input
            label="Vendor / Company Name *"
            required
            placeholder="e.g. Mahaveer Cement & Steels"
            value={vendorForm.name}
            onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contact Person"
              placeholder="e.g. Ramesh Patel"
              value={vendorForm.contact_person}
              onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
            />
            <Input
              label="Mobile Number (10 digits)"
              type="tel"
              maxLength={10}
              placeholder="e.g. 9825123456"
              value={vendorForm.phone}
              onChange={(e) =>
                setVendorForm({ ...vendorForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="billing@supplier.com"
              value={vendorForm.email}
              onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
            />
            <Input
              label="GSTIN / Tax ID"
              placeholder="e.g. 24AAACH7409R1ZZ"
              value={vendorForm.tax_id}
              onChange={(e) => setVendorForm({ ...vendorForm, tax_id: e.target.value.toUpperCase() })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Office / Billing Address
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Plot 12, GIDC Phase 2, Vatva, Ahmedabad"
              value={vendorForm.address}
              onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border-default)]">
            <Button variant="secondary" onClick={() => setIsVendorModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Save & Register Vendor
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: SETTLE VENDOR BILL (REPAYMENT)                                    */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Settle Bill: ${selectedVendor?.name}`}
        size="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
            <div className="text-xs text-amber-800 dark:text-amber-300 font-bold uppercase tracking-wider">
              Outstanding Liability Balance
            </div>
            <div className="text-2xl font-black text-amber-700 dark:text-amber-400 font-mono mt-0.5">
              {formatCurrency(selectedVendor?.calculated_balance || selectedVendor?.outstanding_balance)}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Project Allocation
            </label>
            <select
              value={paymentForm.project}
              onChange={(e) => setPaymentForm({ ...paymentForm, project: e.target.value })}
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Select Project Site</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Repayment Amount (₹) *"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={paymentForm.amount}
            onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Payment Mode *
              </label>
              <select
                value={paymentForm.payment_mode}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="BANK_TRANSFER">🏦 Bank Transfer (RTGS/NEFT)</option>
                <option value="CASH">💵 Cash</option>
              </select>
            </div>

            <Input
              label="UTR / Bank Ref Number *"
              required
              placeholder="e.g. AXIS-RTGS-99120"
              value={paymentForm.reference}
              onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
            />
          </div>

          <Input
            label="Payment Date *"
            type="date"
            max={new Date().toISOString().split('T')[0]}
            required
            value={paymentForm.payment_date}
            onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
          />

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border-default)]">
            <Button variant="secondary" onClick={() => setIsPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Post Settlement to Ledger
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: LOG SITE RUNNING COST (PETTY CASH FIFO)                          */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isRunningCostModalOpen}
        onClose={() => setIsRunningCostModalOpen(false)}
        title="Log Field Running Cost (Petty Cash)"
        size="md"
      >
        <form onSubmit={handleCreateRunningCost} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Site Project *
            </label>
            <select
              required
              value={runningCostForm.project}
              onChange={(e) => setRunningCostForm({ ...runningCostForm, project: e.target.value })}
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Select Project Site</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Date *"
              type="date"
              max={new Date().toISOString().split('T')[0]}
              required
              value={runningCostForm.date}
              onChange={(e) => setRunningCostForm({ ...runningCostForm, date: e.target.value })}
            />

            <Input
              label="Amount (₹) *"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="e.g. 2500.00"
              value={runningCostForm.amount}
              onChange={(e) => setRunningCostForm({ ...runningCostForm, amount: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Payment Method *
            </label>
            <select
              value={runningCostForm.payment_method}
              onChange={(e) => setRunningCostForm({ ...runningCostForm, payment_method: e.target.value })}
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="cash">💵 Cash (FIFO Admin Credit Gated)</option>
              <option value="bank_transfer">🏦 Bank Transfer</option>
              <option value="upi">📱 UPI</option>
              <option value="cheque">📝 Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>

          <Input
            label="Expense Description *"
            required
            placeholder="e.g. 5 bags cement, mixer fuel, tea & snacks for labor"
            value={runningCostForm.description}
            onChange={(e) => setRunningCostForm({ ...runningCostForm, description: e.target.value })}
          />

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border-default)]">
            <Button variant="secondary" onClick={() => setIsRunningCostModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Record Running Cost
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: VENDOR STATEMENT / COMPREHENSIVE LEDGER HISTORY                   */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isVendorStatementOpen}
        onClose={() => setIsVendorStatementOpen(false)}
        title={`Vendor Statement: ${selectedVendor?.name}`}
        size="lg"
      >
        <div className="space-y-5">
          {/* Vendor Details Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-[var(--border-default)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-[var(--text-primary)]">
                  {selectedVendor?.name}
                </h3>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Contact: <span className="font-semibold">{selectedVendor?.contact_person || 'N/A'}</span> • Phone:{' '}
                  <span className="font-semibold">{selectedVendor?.phone || 'N/A'}</span>
                </div>
                {selectedVendor?.tax_id && (
                  <div className="text-[11px] font-mono text-[var(--text-muted)] mt-1">
                    GSTIN: {selectedVendor.tax_id}
                  </div>
                )}
              </div>

              {canApprove && (selectedVendor?.calculated_balance || 0) > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setIsVendorStatementOpen(false);
                    openPaymentModal(selectedVendor);
                  }}
                  leftIcon={<CreditCard className="w-4 h-4" />}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                >
                  Settle Balance
                </Button>
              )}
            </div>

            {/* 3 Summary Stat Boxes */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[var(--border-default)]">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] block">
                  TOTAL BILLED
                </span>
                <span className="text-sm font-black text-[var(--text-primary)] font-mono">
                  {formatCurrency(selectedVendor?.total_billed || vendorLedgerData?.total_billed)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] block">
                  TOTAL PAID
                </span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatCurrency(
                    Number(selectedVendor?.total_billed || 0) -
                      Number(selectedVendor?.calculated_balance || 0)
                  )}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40">
                <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 block">
                  BALANCE DUE
                </span>
                <span className="text-sm font-black text-amber-700 dark:text-amber-400 font-mono">
                  {formatCurrency(selectedVendor?.calculated_balance || selectedVendor?.outstanding_balance)}
                </span>
              </div>
            </div>
          </div>

          {/* Statement Transaction History Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
              Procurement & Bill History
            </h4>

            {loadingLedger ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)] animate-pulse">
                Loading ledger entries...
              </div>
            ) : !vendorLedgerData?.entries || vendorLedgerData.entries.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-default)] rounded-xl">
                No past procurement bills recorded under this vendor.
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border-default)] overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)] font-black text-[10px] uppercase">
                      <th className="py-2.5 px-3">DATE</th>
                      <th className="py-2.5 px-3">DESCRIPTION</th>
                      <th className="py-2.5 px-3">MODE</th>
                      <th className="py-2.5 px-3 text-right">AMOUNT</th>
                      <th className="py-2.5 px-3 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] font-medium">
                    {vendorLedgerData.entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2 px-3 font-semibold">{formatDate(entry.expense_date)}</td>
                        <td className="py-2 px-3">{entry.description}</td>
                        <td className="py-2 px-3">{entry.payment_mode}</td>
                        <td className="py-2 px-3 text-right font-black font-mono">
                          {formatCurrency(entry.amount)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[9px] font-black uppercase',
                              entry.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            )}
                          >
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-[var(--border-default)]">
            <Button variant="secondary" onClick={() => setIsVendorStatementOpen(false)}>
              Close Statement
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 6: BILL / RECEIPT PHOTO PREVIEW                                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={Boolean(selectedReceiptUrl)}
        onClose={() => setSelectedReceiptUrl(null)}
        title="Scanned Invoice / Receipt Document"
        size="lg"
      >
        <div className="space-y-4 text-center">
          <div className="max-h-[70vh] overflow-auto rounded-2xl border border-[var(--border-default)] bg-slate-950/20 p-2 flex items-center justify-center">
            {selectedReceiptUrl?.endsWith('.pdf') ? (
              <iframe
                src={selectedReceiptUrl}
                title="Receipt PDF"
                className="w-full h-96 rounded-xl border-0"
              />
            ) : (
              <img
                src={selectedReceiptUrl}
                alt="Bill Document"
                className="max-h-[65vh] w-auto max-w-full rounded-xl object-contain shadow-md"
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <a
              href={selectedReceiptUrl}
              download="receipt_document"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download File</span>
            </a>

            <Button variant="secondary" onClick={() => setSelectedReceiptUrl(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
