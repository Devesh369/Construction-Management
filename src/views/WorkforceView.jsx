import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building2,
  CreditCard,
  TrendingUp,
  Wallet,
  Banknote,
  Eye,
  Edit3,
  Trash2,
  CheckCircle2,
  X,
  ShieldCheck,
  IndianRupee,
  AlertCircle,
  Sparkles,
  UserCheck,
  Send,
  History,
  Layers,
  ArrowUpRight,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import constructionBg from '../assets/construction-bg.png';

const ROLE_OPTIONS = [
  'Karigar',
  'Labour',
  'Supervisor',
  'Mason',
  'Helper',
  'Carpenter',
  'Electrician',
  'Plumber',
  'Painter',
  'Welder',
  'Other',
];

export const WorkforceView = () => {
  const { role: userRole } = useAuth();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [gangs, setGangs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Navigation mode: 'list' | 'add' | 'detail'
  const [currentView, setCurrentView] = useState('list');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Search and Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [perPage, setPerPage] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  // Operational Modals
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isUpadModalOpen, setIsUpadModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isGroupsModalOpen, setIsGroupsModalOpen] = useState(false);

  // Pay form state
  const [payForm, setPayForm] = useState({
    amount: '',
    payment_mode: 'CASH',
    notes: '',
  });

  // Upad (Advance) form state
  const [upadForm, setUpadForm] = useState({
    amount: '',
    advance_date: new Date().toISOString().split('T')[0],
    reason: '',
    payment_mode: 'CASH',
  });

  // Payment history state
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Assign Project state
  const [assignProjectId, setAssignProjectId] = useState('');
  const [assigningProject, setAssigningProject] = useState(false);

  // New Employee Form state (matches Screenshot 2)
  const [addForm, setAddForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    role: 'Karigar',
    daily_rate: '800',
    address: '',
    emergency_contact: '',
    joining_date: new Date().toISOString().split('T')[0],
    bank_account_number: '',
    bank_ifsc: '',
    bank_name: '',
  });

  // Edit Employee Form state
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    role: 'Karigar',
    daily_rate: '800',
    address: '',
    emergency_contact: '',
    joining_date: '',
    bank_account_number: '',
    bank_ifsc: '',
    bank_name: '',
    is_active: true,
  });

  // Create Labor Gang state
  const [gangForm, setGangForm] = useState({
    name: '',
    project: '',
    leader: '',
  });
  const [submittingGang, setSubmittingGang] = useState(false);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const [empRes, projRes, gangRes] = await Promise.all([
        api.workforce.listEmployees({ page_size: 1000 }),
        api.projects.list({ page_size: 1000 }),
        api.workforce.listLaborGroups({ page_size: 1000 }),
      ]);
      const empList = Array.isArray(empRes) ? empRes : empRes.results || [];
      setEmployees(empList);
      setProjects(Array.isArray(projRes) ? projRes : projRes.results || []);
      setGangs(Array.isArray(gangRes) ? gangRes : gangRes.results || []);

      if (selectedEmployeeId) {
        const fresh = empList.find((e) => e.id === Number(selectedEmployeeId));
        if (fresh) setSelectedEmployee(fresh);
      }
    } catch (err) {
      setError(err.message || 'Failed to load workforce directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const openEmployeeDetail = async (emp) => {
    setSelectedEmployeeId(emp.id);
    setSelectedEmployee(emp);
    setEditForm({
      full_name: emp.full_name || '',
      phone: emp.phone || '',
      email: emp.email || '',
      role: emp.role || emp.trade || 'Karigar',
      daily_rate: emp.daily_rate ? String(emp.daily_rate) : '800',
      address: emp.address || '',
      emergency_contact: emp.emergency_contact || '',
      joining_date: emp.joining_date || '',
      bank_account_number: emp.bank_account_number || '',
      bank_ifsc: emp.bank_ifsc || '',
      bank_name: emp.bank_name || '',
      is_active: emp.is_active ?? true,
    });
    setCurrentView('detail');
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    const cleanPhone = addForm.phone ? addForm.phone.replace(/\D/g, '') : '';
    const cleanEmerg = addForm.emergency_contact ? addForm.emergency_contact.replace(/\D/g, '') : '';

    try {
      const payload = {
        full_name: addForm.full_name.trim(),
        phone: cleanPhone,
        email: addForm.email.trim(),
        role: addForm.role,
        trade: addForm.role.toUpperCase(),
        daily_rate: addForm.daily_rate || '800.00',
        address: addForm.address.trim(),
        emergency_contact: cleanEmerg,
        joining_date: addForm.joining_date || null,
        bank_account_number: addForm.bank_account_number.trim(),
        bank_ifsc: addForm.bank_ifsc.trim(),
        bank_name: addForm.bank_name.trim(),
      };

      const created = await api.workforce.createEmployee(payload);
      toast.success('Worker registered successfully!');
      setAddForm({
        full_name: '',
        phone: '',
        email: '',
        role: 'Karigar',
        daily_rate: '800',
        address: '',
        emergency_contact: '',
        joining_date: new Date().toISOString().split('T')[0],
        bank_account_number: '',
        bank_ifsc: '',
        bank_name: '',
      });
      await fetchEmployees();
      openEmployeeDetail(created);
    } catch (err) {
      toast.error(`Registration failed: ${err.message}`);
    }
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    const cleanPhone = editForm.phone ? editForm.phone.replace(/\D/g, '') : '';
    const cleanEmerg = editForm.emergency_contact ? editForm.emergency_contact.replace(/\D/g, '') : '';

    try {
      const payload = {
        full_name: editForm.full_name.trim(),
        phone: cleanPhone,
        email: editForm.email.trim(),
        role: editForm.role,
        trade: editForm.role.toUpperCase(),
        daily_rate: editForm.daily_rate || '800.00',
        address: editForm.address.trim(),
        emergency_contact: cleanEmerg,
        joining_date: editForm.joining_date || null,
        bank_account_number: editForm.bank_account_number.trim(),
        bank_ifsc: editForm.bank_ifsc.trim(),
        bank_name: editForm.bank_name.trim(),
        is_active: editForm.is_active,
      };

      const updated = await api.workforce.updateEmployee(selectedEmployee.id, payload);
      toast.success('Employee details updated!');
      setSelectedEmployee(updated);
      setIsEditModalOpen(false);
      await fetchEmployees();
    } catch (err) {
      toast.error(`Update failed: ${err.message}`);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;
    if (!window.confirm(`Are you sure you want to deactivate ${selectedEmployee.full_name}?`)) return;

    try {
      await api.workforce.deleteEmployee(selectedEmployee.id);
      toast.success('Employee removed from active roster.');
      setCurrentView('list');
      setSelectedEmployee(null);
      await fetchEmployees();
    } catch (err) {
      toast.error(`Deletion failed: ${err.message}`);
    }
  };

  const handleAssignProject = async (e) => {
    e.preventDefault();
    if (!assignProjectId || !selectedEmployee) return;
    setAssigningProject(true);
    try {
      const updated = await api.workforce.assignProject(selectedEmployee.id, assignProjectId);
      toast.success('Project assigned successfully!');
      setSelectedEmployee(updated);
      setAssignProjectId('');
      await fetchEmployees();
    } catch (err) {
      toast.error(`Assignment failed: ${err.message}`);
    } finally {
      setAssigningProject(false);
    }
  };

  const handleUnassignProject = async (projId) => {
    if (!selectedEmployee) return;
    try {
      const updated = await api.workforce.unassignProject(selectedEmployee.id, projId);
      toast.success('Project unassigned.');
      setSelectedEmployee(updated);
      await fetchEmployees();
    } catch (err) {
      toast.error(`Unassign failed: ${err.message}`);
    }
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    const fin = selectedEmployee.financials || {};
    const hasAttendance = Boolean(
      fin.has_attendance || (fin.total_pagar && Number(fin.total_pagar) > 0)
    );
    if (!hasAttendance) {
      toast.error('Cannot pay wages to an employee without marked attendance. Attendance must be marked first.');
      return;
    }
    if (!payForm.amount || Number(payForm.amount) <= 0) {
      toast.error('Enter a valid payment amount.');
      return;
    }

    try {
      await api.workforce.payEmployee(selectedEmployee.id, {
        amount: payForm.amount,
        payment_mode: payForm.payment_mode,
        notes: payForm.notes,
      });
      toast.success(`Disbursed ₹${Number(payForm.amount).toLocaleString('en-IN')} successfully!`);
      setIsPayModalOpen(false);
      setPayForm({ amount: '', payment_mode: 'CASH', notes: '' });
      // Refresh details
      const fresh = await api.workforce.getEmployee(selectedEmployee.id);
      setSelectedEmployee(fresh);
      await fetchEmployees();
    } catch (err) {
      toast.error(`Payment failed: ${err.message}`);
    }
  };

  const handleUpadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    if (!upadForm.amount || Number(upadForm.amount) <= 0) {
      toast.error('Enter a valid upad (advance) amount.');
      return;
    }

    try {
      await api.workforce.recordUpad(selectedEmployee.id, {
        amount: upadForm.amount,
        advance_date: upadForm.advance_date,
        reason: upadForm.reason,
        payment_mode: upadForm.payment_mode,
      });
      toast.success(`Advance of ₹${Number(upadForm.amount).toLocaleString('en-IN')} recorded!`);
      setIsUpadModalOpen(false);
      setUpadForm({
        amount: '',
        advance_date: new Date().toISOString().split('T')[0],
        reason: '',
        payment_mode: 'CASH',
      });
      const fresh = await api.workforce.getEmployee(selectedEmployee.id);
      setSelectedEmployee(fresh);
      await fetchEmployees();
    } catch (err) {
      toast.error(`Upad recording failed: ${err.message}`);
    }
  };

  const loadHistory = async () => {
    if (!selectedEmployee) return;
    setLoadingHistory(true);
    try {
      const res = await api.workforce.getPaymentHistory(selectedEmployee.id);
      setPaymentHistory(Array.isArray(res) ? res : []);
      setIsHistoryModalOpen(true);
    } catch (err) {
      toast.error('Failed to load payment history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateGang = async (e) => {
    e.preventDefault();
    setSubmittingGang(true);
    try {
      await api.workforce.createLaborGroup({
        name: gangForm.name.trim(),
        project: gangForm.project ? Number(gangForm.project) : null,
        leader: gangForm.leader ? Number(gangForm.leader) : null,
      });
      toast.success('Labor gang created successfully!');
      setGangForm({ name: '', project: '', leader: '' });
      setIsGroupsModalOpen(false);
      await fetchEmployees();
    } catch (err) {
      toast.error(`Failed to create gang: ${err.message}`);
    } finally {
      setSubmittingGang(false);
    }
  };

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getMonogram = (name = '') => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
    }
    return (name.slice(0, 2) || 'EM').toUpperCase();
  };

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = (emp.full_name || '').toLowerCase().includes(query);
    const codeMatch = (emp.employee_code || '').toLowerCase().includes(query);
    const phoneMatch = (emp.phone || '').toLowerCase().includes(query);
    const roleMatch = (emp.role || emp.trade || '').toLowerCase().includes(query);
    return nameMatch || codeMatch || phoneMatch || roleMatch;
  });

  const displayedEmployees =
    perPage === 'All'
      ? filteredEmployees
      : filteredEmployees.slice((currentPage - 1) * Number(perPage), currentPage * Number(perPage));

  // ==========================================
  // RENDER SCREEN 2: ADD EMPLOYEE SCREEN
  // ==========================================
  if (currentView === 'add') {
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-12">
        {/* Top Header with Back Arrow */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentView('list')}
            className="w-10 h-10 rounded-full border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
              Add Employee
            </h1>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Register a new worker
            </p>
          </div>
        </div>

        {/* Add Employee Form Card */}
        <div className="rounded-3xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] p-6 sm:p-10 shadow-sm space-y-6">
          <form onSubmit={handleAddEmployee} className="space-y-5">
            {/* Full Name */}
            <div>
              <Input
                label="Full Name"
                placeholder="Full name"
                value={addForm.full_name}
                onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
              />
            </div>

            {/* Phone & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Input
                id="add-employee-phone"
                name="employee_mobile_number"
                autoComplete="off"
                label="Mobile Number (10 digits) *"
                type="tel"
                maxLength={10}
                placeholder="e.g. 9820012345"
                value={addForm.phone}
                onChange={(e) =>
                  setAddForm({ ...addForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                }
              />
              <Input
                label="Email (optional)"
                type="email"
                icon={Mail}
                placeholder="email@example.com"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              />
            </div>

            {/* Role & Daily Wage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Role
                </label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Daily Wage (₹)"
                type="number"
                step="0.01"
                placeholder="800"
                value={addForm.daily_rate}
                onChange={(e) => setAddForm({ ...addForm, daily_rate: e.target.value })}
              />
            </div>

            {/* Address */}
            <div>
              <Input
                label="Address"
                placeholder="Full address"
                value={addForm.address}
                onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
              />
            </div>

            {/* Emergency Contact & Joining Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Input
                id="add-employee-emergency-contact"
                name="employee_emergency_contact"
                autoComplete="off"
                label="Emergency Contact (10 digits)"
                type="tel"
                maxLength={10}
                placeholder="e.g. 9811122233 (optional)"
                value={addForm.emergency_contact}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    emergency_contact: e.target.value.replace(/\D/g, '').slice(0, 10),
                  })
                }
              />
              <Input
                label="Joining Date"
                type="date"
                icon={Calendar}
                placeholder="Select date"
                value={addForm.joining_date}
                onChange={(e) => setAddForm({ ...addForm, joining_date: e.target.value })}
              />
            </div>

            {/* Bank Details (Optional) Divider */}
            <div className="pt-4 border-t border-[var(--border-default)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">
                Bank Details (Optional)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Account Number"
                  placeholder="Account #"
                  value={addForm.bank_account_number}
                  onChange={(e) => setAddForm({ ...addForm, bank_account_number: e.target.value })}
                />
                <Input
                  label="IFSC Code"
                  placeholder="SBIN0001234"
                  value={addForm.bank_ifsc}
                  onChange={(e) => setAddForm({ ...addForm, bank_ifsc: e.target.value })}
                />
                <Input
                  label="Bank Name"
                  placeholder="Bank name"
                  value={addForm.bank_name}
                  onChange={(e) => setAddForm({ ...addForm, bank_name: e.target.value })}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-[var(--border-default)]">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCurrentView('list')}
                className="px-6"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="px-8 font-bold shadow-lg shadow-blue-500/25"
              >
                Add Employee
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER SCREEN 3: EMPLOYEE DETAIL SCREEN
  // ==========================================
  if (currentView === 'detail' && selectedEmployee) {
    const fin = selectedEmployee.financials || {
      total_pagar: '0',
      total_upad: '0',
      total_paid: '0',
      balance: '0',
    };

    return (
      <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-16">
        {/* Top Header Card (Dark Navy / Black theme) */}
        <div className="relative rounded-3xl bg-[#09152B] dark:bg-[#070E1E] text-white p-6 sm:p-8 overflow-hidden shadow-xl border border-blue-900/30">
          {/* Back Button */}
          <button
            onClick={() => setCurrentView('list')}
            className="absolute top-5 left-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all backdrop-blur-md"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Center Monogram, Name, Role & Wage */}
          <div className="flex flex-col items-center justify-center text-center space-y-3 pt-2">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-2xl font-black text-white shadow-xl ring-4 ring-blue-500/30">
              {getMonogram(selectedEmployee.full_name)}
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                {selectedEmployee.full_name}
              </h2>
              <p className="text-sm font-medium text-blue-200/80">
                {selectedEmployee.role || selectedEmployee.trade} • {formatCurrency(selectedEmployee.daily_rate)}/day
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                ACTIVE
              </span>
            </div>

            {/* Action Buttons: Edit & Delete */}
            <div className="flex items-center gap-2 pt-1">
              {['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'ACCOUNTANT'].includes(userRole) && (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white transition-all backdrop-blur-md"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}
              {userRole === 'ORG_ADMIN' && (
                <button
                  onClick={handleDeleteEmployee}
                  className="w-8 h-8 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 flex items-center justify-center transition-all"
                  title="Remove Employee (Org Admin Only)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 4 Financial Stat Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: TOTAL PAGAR */}
          <div className="p-5 rounded-2xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 space-y-2 relative overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                TOTAL PAGAR
              </span>
              <div className="text-2xl font-black text-[var(--text-primary)]">
                {formatCurrency(fin.total_pagar)}
              </div>
              <span className="text-[11px] text-[var(--text-muted)] font-medium block">
                Attendance Module
              </span>
            </div>
          </div>

          {/* Card 2: TOTAL UPAD */}
          <div className="p-5 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <button
                onClick={() => setIsUpadModalOpen(true)}
                className="text-[10px] font-bold text-rose-700 dark:text-rose-400 hover:underline"
              >
                + Give Upad
              </button>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                TOTAL UPAD
              </span>
              <div className="text-2xl font-black text-[var(--text-primary)]">
                {formatCurrency(fin.total_upad)}
              </div>
              <span className="text-[11px] text-[var(--text-muted)] font-medium block">
                Upad Module
              </span>
            </div>
          </div>

          {/* Card 3: PAID */}
          <div className="p-5 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 space-y-2 relative overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                PAID
              </span>
              <div className="text-2xl font-black text-[var(--text-primary)]">
                {formatCurrency(fin.total_paid)}
              </div>
              <span className="text-[11px] text-[var(--text-muted)] font-medium block">
                Payment
              </span>
            </div>
          </div>

          {/* Card 4: TOTAL EMPLOYEE AMOUNT (Remaining Balance + PAY Button) */}
          <div className="p-5 rounded-2xl border border-emerald-300 dark:border-emerald-800/50 bg-emerald-50/70 dark:bg-emerald-950/30 flex flex-col justify-between space-y-3 relative overflow-hidden">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  TOTAL EMPLOYEE AMOUNT
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300">
                {formatCurrency(fin.balance)}
              </div>
              <span className="text-[11px] text-[var(--text-muted)] font-medium block">
                Remaining Balance
              </span>
            </div>

            {['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'ACCOUNTANT'].includes(userRole) && (() => {
              const hasAttendance = Boolean(
                fin.has_attendance || (fin.total_pagar && Number(fin.total_pagar) > 0)
              );
              return hasAttendance ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setPayForm({
                      amount: fin.balance && Number(fin.balance) > 0 ? String(fin.balance) : '',
                      payment_mode: 'CASH',
                      notes: 'Direct wage settlement',
                    });
                    setIsPayModalOpen(true);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 font-black shadow-md shadow-emerald-600/30"
                >
                  PAY WAGES
                </Button>
              ) : (
                <div className="w-full">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled
                    className="w-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-80 flex items-center justify-center gap-1.5"
                    title="Attendance must be marked before paying wages"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>PAY WAGES (ATTENDANCE REQUIRED)</span>
                  </Button>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold text-center block mt-1">
                    Mark attendance first to enable wage disbursement
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* View Full Payment History Centered Link */}
        <div className="text-center pt-1 pb-2">
          <button
            onClick={loadHistory}
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Eye className="w-4 h-4 text-blue-500" />
            <span>VIEW FULL PAYMENT HISTORY</span>
          </button>
        </div>

        {/* CONTACT INFO Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">
            <Users className="w-4 h-4 text-blue-500" />
            <span>CONTACT INFO</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Box 1: Phone */}
            <div className="p-4 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] block">
                  PHONE
                </span>
                <span className="text-sm font-black text-[var(--text-primary)]">
                  {selectedEmployee.phone || 'Not provided'}
                </span>
              </div>
            </div>

            {/* Box 2: Daily Wage */}
            <div className="p-4 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center shrink-0">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] block">
                  DAILY WAGE
                </span>
                <span className="text-sm font-black text-[var(--text-primary)]">
                  {formatCurrency(selectedEmployee.daily_rate)}
                </span>
              </div>
            </div>

            {/* Box 3: Joined */}
            <div className="p-4 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] block">
                  JOINED
                </span>
                <span className="text-sm font-black text-[var(--text-primary)]">
                  {selectedEmployee.joining_date
                    ? new Date(selectedEmployee.joining_date).toLocaleDateString('en-GB')
                    : '29/06/2026'}
                </span>
              </div>
            </div>
          </div>

          {/* Secondary Details (Email, Address, Bank) */}
          {(selectedEmployee.address || selectedEmployee.email || selectedEmployee.bank_account_number) && (
            <div className="p-4 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] text-xs space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[var(--text-secondary)]">
                {selectedEmployee.email && (
                  <div>
                    <span className="text-[var(--text-muted)] block">Email:</span>
                    <span className="font-semibold text-[var(--text-primary)]">{selectedEmployee.email}</span>
                  </div>
                )}
                {selectedEmployee.address && (
                  <div>
                    <span className="text-[var(--text-muted)] block">Address:</span>
                    <span className="font-semibold text-[var(--text-primary)]">{selectedEmployee.address}</span>
                  </div>
                )}
                {selectedEmployee.bank_account_number && (
                  <div>
                    <span className="text-[var(--text-muted)] block">Bank Account:</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {selectedEmployee.bank_name ? `${selectedEmployee.bank_name} • ` : ''}
                      ••••{selectedEmployee.bank_account_number.slice(-4)} (IFSC: {selectedEmployee.bank_ifsc})
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ASSIGNED PROJECTS Section */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span>ASSIGNED PROJECTS</span>
            </div>
            <span className="text-xs font-bold text-[var(--text-muted)]">
              {selectedEmployee.assigned_projects_details?.length || 0}
            </span>
          </div>

          {/* Project Assignment Dropdown + Button */}
          {['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'SUPERVISOR'].includes(userRole) && (
            <form onSubmit={handleAssignProject} className="flex items-center gap-2 max-w-xl">
              <select
                value={assignProjectId}
                onChange={(e) => setAssignProjectId(e.target.value)}
                className="flex-1 rounded-xl border border-gray-300 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] px-4 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!assignProjectId || assigningProject}
                className="px-3 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </form>
          )}

          {/* Assigned Projects List */}
          <div className="space-y-2">
            {selectedEmployee.assigned_projects_details &&
            selectedEmployee.assigned_projects_details.length > 0 ? (
              selectedEmployee.assigned_projects_details.map((proj) => (
                <div
                  key={proj.id}
                  className="p-3.5 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] flex items-center justify-between gap-3 shadow-sm hover:border-blue-400 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">{proj.name}</h4>
                      <span className="text-[10px] font-mono font-medium text-[var(--text-muted)]">
                        {proj.code}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                      In progress
                    </span>
                    {['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'SUPERVISOR'].includes(userRole) && (
                      <button
                        onClick={() => handleUnassignProject(proj.id)}
                        className="w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition-colors"
                        title="Unassign project"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 rounded-2xl border border-dashed border-[var(--border-default)] text-center text-xs text-[var(--text-muted)]">
                No active construction projects assigned yet. Select a project above to assign worker.
              </div>
            )}
          </div>
        </div>

        {/* ======================================= */}
        {/* MODAL 1: PAY EMPLOYEE MODAL */}
        {/* ======================================= */}
        <Modal
          isOpen={isPayModalOpen}
          onClose={() => setIsPayModalOpen(false)}
          title={`Pay: ${selectedEmployee.full_name}`}
          subtitle="Disburse salary and reduce pending employee balance."
          size="md"
        >
          {(() => {
            const fin = selectedEmployee.financials || {};
            const hasAttendance = Boolean(
              fin.has_attendance || (fin.total_pagar && Number(fin.total_pagar) > 0)
            );
            return (
              <form onSubmit={handlePaySubmit} className="space-y-4">
                {!hasAttendance && (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <span className="font-bold block">Attendance Required Before Wage Payment</span>
                      This employee has no recorded attendance yet. Attendance must be marked first before disbursing wages.
                    </div>
                  </div>
                )}

                <Input
                  label="Amount to Pay (₹) *"
                  type="number"
                  step="0.01"
                  disabled={!hasAttendance}
                  placeholder="e.g. 3000"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                />

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Payment Mode
                  </label>
                  <select
                    value={payForm.payment_mode}
                    disabled={!hasAttendance}
                    onChange={(e) => setPayForm({ ...payForm, payment_mode: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] px-4 py-2.5 text-sm text-[var(--text-primary)] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>

                <Input
                  label="Payment Notes / Reference"
                  placeholder="e.g. Weekly settlement or Txn #12345"
                  disabled={!hasAttendance}
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                />

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-default)]">
                  <Button type="button" variant="secondary" onClick={() => setIsPayModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!hasAttendance}
                    className="bg-emerald-600 hover:bg-emerald-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirm Payment
                  </Button>
                </div>
              </form>
            );
          })()}
        </Modal>

        {/* ======================================= */}
        {/* MODAL 2: RECORD UPAD (ADVANCE) MODAL */}
        {/* ======================================= */}
        <Modal
          isOpen={isUpadModalOpen}
          onClose={() => setIsUpadModalOpen(false)}
          title={`Give Upad: ${selectedEmployee.full_name}`}
          subtitle="Record worker cash advance to deduct against future earnings."
          size="md"
        >
          <form onSubmit={handleUpadSubmit} className="space-y-4">
            {selectedEmployee && (() => {
              const dailyWage = Number(selectedEmployee.daily_rate || 0);
              const curBal = Number(selectedEmployee.financials?.balance ?? (dailyWage || 0));
              const entered = Number(upadForm.amount || 0);
              const remaining = Math.max(0, curBal - entered);
              return (
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-50 to-orange-50 dark:from-slate-800/80 dark:to-slate-800/40 border border-rose-200/60 dark:border-rose-900/40 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <span>Upad & Salary Breakdown</span>
                    <span className="text-rose-600 dark:text-rose-400 font-extrabold">{selectedEmployee.full_name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Daily Salary</div>
                      <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5">₹{dailyWage}</div>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Current Balance</div>
                      <div className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-0.5">₹{curBal}</div>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Remain Salary</div>
                      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5">₹{remaining}</div>
                    </div>
                  </div>
                  {entered > 0 && (
                    <div className="text-[11px] text-center font-semibold text-slate-600 dark:text-slate-300 pt-1 border-t border-rose-100 dark:border-slate-700/60">
                      Taking <span className="font-bold text-rose-600 dark:text-rose-400">₹{entered}</span> Upad from daily wage ₹{dailyWage || curBal} leaves <span className="font-black text-emerald-600 dark:text-emerald-400">₹{remaining}</span> remaining salary.
                    </div>
                  )}
                </div>
              );
            })()}

            <Input
              label="Upad Amount (₹) *"
              type="number"
              step="0.01"
              placeholder="e.g. 1500"
              value={upadForm.amount}
              onChange={(e) => setUpadForm({ ...upadForm, amount: e.target.value })}
            />

            <Input
              label="Advance Date"
              type="date"
              max={todayStr}
              value={upadForm.advance_date}
              onChange={(e) => setUpadForm({ ...upadForm, advance_date: e.target.value })}
            />

            <Input
              label="Reason for Advance"
              placeholder="e.g. Medical emergency, festival travel"
              value={upadForm.reason}
              onChange={(e) => setUpadForm({ ...upadForm, reason: e.target.value })}
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Payment Mode
              </label>
              <select
                value={upadForm.payment_mode}
                onChange={(e) => setUpadForm({ ...upadForm, payment_mode: e.target.value })}
                className="w-full rounded-xl border border-gray-300 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] px-4 py-2.5 text-sm text-[var(--text-primary)]"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-default)]">
              <Button type="button" variant="secondary" onClick={() => setIsUpadModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="bg-rose-600 hover:bg-rose-700 font-bold">
                Record Upad
              </Button>
            </div>
          </form>
        </Modal>

        {/* ======================================= */}
        {/* MODAL 3: PAYMENT HISTORY MODAL */}
        {/* ======================================= */}
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title={`Financial History: ${selectedEmployee.full_name}`}
          subtitle="Chronological ledger of payments disbursed and advances given."
          size="lg"
        >
          <div className="space-y-4">
            {loadingHistory ? (
              <div className="py-8 text-center text-sm text-[var(--text-muted)] animate-pulse">
                Loading transaction history...
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                No past payment or advance records found.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-default)] max-h-96 overflow-y-auto">
                {paymentHistory.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          item.type === 'UPAD'
                            ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40'
                            : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40'
                        }`}
                      >
                        {item.type === 'UPAD' ? (
                          <Wallet className="w-4 h-4" />
                        ) : (
                          <Banknote className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-[var(--text-primary)]">{item.title}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {item.date} • Mode: {item.mode} • {item.notes}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-black text-sm ${
                          item.type === 'UPAD'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {item.type === 'UPAD' ? '-' : '+'}
                        {formatCurrency(item.amount)}
                      </div>
                      <span className="text-[10px] font-bold text-[var(--text-muted)]">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-3 border-t border-[var(--border-default)]">
              <Button variant="secondary" onClick={() => setIsHistoryModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>

        {/* ======================================= */}
        {/* MODAL 4: EDIT EMPLOYEE MODAL */}
        {/* ======================================= */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Edit Worker: ${selectedEmployee.full_name}`}
          size="lg"
        >
          <form onSubmit={handleUpdateEmployee} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name *"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
              <Input
                id="edit-employee-phone"
                name="edit_employee_phone"
                autoComplete="off"
                label="Mobile Number (10 digits) *"
                type="tel"
                maxLength={10}
                placeholder="e.g. 9820012345"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Role
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] px-4 py-2.5 text-sm text-[var(--text-primary)]"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label={userRole === 'SUPERVISOR' ? 'Daily Wage (₹) (Read-only for Supervisors)' : 'Daily Wage (₹) *'}
                type="number"
                step="0.01"
                disabled={userRole === 'SUPERVISOR'}
                value={editForm.daily_rate}
                onChange={(e) => setEditForm({ ...editForm, daily_rate: e.target.value })}
              />
            </div>

            <Input
              label="Address"
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
              <Input
                id="edit-employee-emergency-contact"
                name="edit_employee_emergency"
                autoComplete="off"
                label="Emergency Contact (10 digits)"
                type="tel"
                maxLength={10}
                placeholder="e.g. 9811122233 (optional)"
                value={editForm.emergency_contact}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    emergency_contact: e.target.value.replace(/\D/g, '').slice(0, 10),
                  })
                }
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[var(--bg-secondary)] border border-[var(--border-default)] space-y-3">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase block">
                Bank Details
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Account Number"
                  value={editForm.bank_account_number}
                  onChange={(e) =>
                    setEditForm({ ...editForm, bank_account_number: e.target.value })
                  }
                />
                <Input
                  label="IFSC Code"
                  value={editForm.bank_ifsc}
                  onChange={(e) => setEditForm({ ...editForm, bank_ifsc: e.target.value })}
                />
                <Input
                  label="Bank Name"
                  value={editForm.bank_name}
                  onChange={(e) => setEditForm({ ...editForm, bank_name: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
              <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="font-bold">
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ==========================================
  // RENDER SCREEN 1: EMPLOYEES LIST VIEW (DEFAULT)
  // ==========================================
  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner (Matches Screenshot 1) */}
      <div
        className="relative rounded-3xl overflow-hidden p-6 sm:p-10 shadow-lg border border-[var(--border-default)] bg-cover bg-center"
        style={{ backgroundImage: `url(${constructionBg})` }}
      >
        {/* Dark Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#070D18]/95 via-[#0A1322]/90 to-[#0A1322]/75" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-widest text-blue-400">
              OPERATIONS WORKFORCE
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              EMPLOYEES
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              Manage your workforce
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="secondary"
              onClick={() => setIsGroupsModalOpen(true)}
              leftIcon={<Users className="w-4 h-4 text-white" />}
              className="bg-blue-600 hover:bg-blue-700 text-white border-none font-bold shadow-md shadow-blue-500/20"
            >
              Manage Groups
            </Button>
            <Button
              variant="primary"
              onClick={() => setCurrentView('add')}
              leftIcon={<Plus className="w-4 h-4 text-white" />}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/30"
            >
              + Add Employee
            </Button>
          </div>
        </div>
      </div>

      {/* Search Bar & PER PAGE Selector (Matches Screenshot 1) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-2xl">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-gray-200 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
          <span className="uppercase tracking-wider text-[var(--text-muted)] text-[11px]">PER PAGE</span>
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-xl border border-gray-200 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All</option>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>

      {/* Table (Matches Screenshot 1 with Cream/Warm beige header) */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm font-semibold text-[var(--text-muted)] animate-pulse">
            Loading employees directory...
          </div>
        ) : displayedEmployees.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">No Employees Found</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              {searchQuery
                ? 'No workers match your search query.'
                : 'Get started by registering workers to track attendance and wage balances.'}
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCurrentView('add')}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add First Employee
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              {/* Header row with warm beige/cream background matching screenshot */}
              <thead>
                <tr className="bg-[#EFE8DC] dark:bg-[#1C2537] text-[#2C2721] dark:text-[#E2E8F0] border-b border-[#DCD3C4] dark:border-[var(--border-default)] text-xs font-black uppercase tracking-wider">
                  <th className="py-3.5 px-4">EMPLOYEE</th>
                  <th className="py-3.5 px-4 text-center sm:text-left">BALANCE</th>
                  <th className="py-3.5 px-4">PHONE</th>
                  <th className="py-3.5 px-4">ROLE</th>
                  <th className="py-3.5 px-4 text-center">STATUS</th>
                  <th className="py-3.5 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[var(--border-subtle)] text-xs font-medium">
                {displayedEmployees.map((emp, index) => {
                  const balanceVal = emp.financials?.balance || emp.balance || '0';
                  const rowNumber = perPage === 'All' ? index + 1 : (currentPage - 1) * Number(perPage) + index + 1;

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => openEmployeeDetail(emp)}
                      className="group hover:bg-slate-50/80 dark:hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors"
                    >
                      {/* Column 1: Number, Avatar, Name & ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-400 w-5 shrink-0 text-right">
                            {rowNumber}.
                          </span>
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                            {getMonogram(emp.full_name)}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-[var(--text-primary)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {emp.full_name}
                            </div>
                            <div className="text-[10px] font-mono text-[var(--text-muted)]">
                              ID: {emp.employee_code || emp.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: BALANCE Badge */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200/60 dark:border-emerald-800/40">
                          <Wallet className="w-3.5 h-3.5 shrink-0" />
                          <span>{formatCurrency(balanceVal)}</span>
                        </div>
                      </td>

                      {/* Column 3: PHONE */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{emp.phone || '9898082719'}</span>
                        </div>
                      </td>

                      {/* Column 4: ROLE */}
                      <td className="py-3 px-4">
                        <span className="font-black uppercase tracking-wider text-[var(--text-primary)]">
                          {emp.role || emp.trade || 'KARIGAR'}
                        </span>
                      </td>

                      {/* Column 5: STATUS */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300/40">
                          ACTIVE
                        </span>
                      </td>

                      {/* Column 6: ACTIONS */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEmployeeDetail(emp);
                          }}
                          className="font-bold text-xs text-blue-600 hover:text-blue-700"
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manage Groups Modal */}
      <Modal
        isOpen={isGroupsModalOpen}
        onClose={() => setIsGroupsModalOpen(false)}
        title="Manage Labor Groups & Gangs"
        subtitle="Organize site workers into coordinated teams led by foremen."
        size="lg"
      >
        <div className="space-y-6">
          <form onSubmit={handleCreateGang} className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-[var(--bg-secondary)] border border-[var(--border-default)]">
            <span className="text-xs font-bold uppercase text-[var(--text-secondary)] block">
              Create New Gang
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                placeholder="Gang Name (e.g. Masonry Team 1)"
                value={gangForm.name}
                onChange={(e) => setGangForm({ ...gangForm, name: e.target.value })}
              />
              <select
                value={gangForm.project}
                onChange={(e) => setGangForm({ ...gangForm, project: e.target.value })}
                className="w-full rounded-xl border border-gray-300 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-primary)]"
              >
                <option value="">Select Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={gangForm.leader}
                onChange={(e) => setGangForm({ ...gangForm, leader: e.target.value })}
                className="w-full rounded-xl border border-gray-300 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-primary)]"
              >
                <option value="">Foreman / Leader (Optional)</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} ({e.role || e.trade})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" size="sm" isLoading={submittingGang}>
                Add Gang
              </Button>
            </div>
          </form>

          {/* List of Gangs */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase text-[var(--text-muted)] block">
              Active Gangs ({gangs.length})
            </span>
            {gangs.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No labor gangs formed yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {gangs.map((g) => (
                  <div key={g.id} className="p-3.5 rounded-xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[var(--text-primary)]">{g.name}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        Foreman: {g.leader_name || 'No foreman'} • {g.member_count || 0} Workers
                      </div>
                    </div>
                    <Badge variant="cyan">{g.member_count || 0} members</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-[var(--border-default)]">
            <Button variant="secondary" onClick={() => setIsGroupsModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
