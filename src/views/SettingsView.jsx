import React, { useState, useEffect } from 'react';
import {
  Settings,
  UserPlus,
  ShieldAlert,
  Send,
  Building,
  Users,
  Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

const ROLE_OPTIONS = [
  { value: 'ORG_ADMIN', label: 'Org Admin (Super Admin - Full Access)', color: 'border-purple-500/30 text-purple-400 bg-purple-500/10' },
  { value: 'SITE_MANAGER', label: 'Site Manager / Project Manager (Site Operations, Workforce & Progress)', color: 'border-blue-500/30 text-blue-400 bg-blue-500/10' },
  { value: 'employee/labour', label: 'Labour / Employee (Attendance, Payroll & Upad)', color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' },
];

export const SettingsView = () => {
  const { user: currentUser, role } = useAuth();
  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'org' | 'invitations' | 'emails'
  const [org, setOrg] = useState(null);
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Resend API configuration state

  // Credentials receipt modal
  const [credentialsModalData, setCredentialsModalData] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Modals
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // New User form (direct registration)
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    role: 'SITE_MANAGER',
    password: '',
    phone: '',
      });

  // Org settings form
  const [orgForm, setOrgForm] = useState({
    name: '',
    contact_email: '',
    workday_hours: '8.00',
    half_day_hours: '4.00',
    overtime_after_hours: '8.00',
    expense_approval_limit: '15000.00',
  });

  // Invitation form

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgRes, usersRes, empRes] = await Promise.all([
        api.org.getCurrent().catch(() => ({})),
        api.users.list().catch(() => []),
        api.workforce.listEmployees({ page_size: 1000 }).catch(() => []),
      ]);

      const loadedEmployees = Array.isArray(empRes) ? empRes : empRes?.results || [];
      setEmployees(loadedEmployees);

      setOrg(orgRes);
      setOrgForm({
        name: orgRes?.name || '',
        contact_email: orgRes?.contact_email || '',
        workday_hours: orgRes?.workday_hours || '8.00',
        half_day_hours: orgRes?.half_day_hours || '4.00',
        overtime_after_hours: orgRes?.overtime_after_hours || '8.00',
        expense_approval_limit: orgRes?.expense_approval_limit || '15000.00',
      });

      setUsers(Array.isArray(usersRes) ? usersRes : usersRes?.results || []);
    } catch (err) {
      console.error('Failed to load settings:', err);
      toast.error('Failed to load organization settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Save Org Settings
  const handleSaveOrg = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.org.updateCurrent(orgForm);
      toast.success('Organization configuration updated successfully!');
      await fetchData();
    } catch (err) {
      toast.error(`Error updating settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddUserModal = () => {
    setSelectedEmployeeId('');
    setUserForm({
      name: '',
      email: '',
      role: 'employee/labour',
      password: '',
      phone: '',
            employee_id: null,
    });
    setIsAddUserModalOpen(true);
  };

  // Direct User Creation with Guaranteed Credentials Delivery
  const handleCreateUser = async (e) => {
    if (!userForm.name.trim()) {
      toast.error('Please select an employee or enter a full name.');
      return;
    }
    e.preventDefault();
    if (!userForm.email.trim()) {
      toast.error('Work email address is required.');
      return;
    }

    setSaving(true);
    const cleanPhone = userForm.phone?.replace(/\D/g, '') || undefined;
    const finalPassword = userForm.password?.trim() || 'BuildSphere@2026';

    try {
      await api.users.create({
        name: userForm.name.trim(),
        email: userForm.email.toLowerCase().trim(),
        role: userForm.role,
        password: finalPassword,
        phone: cleanPhone,
        employee_id: userForm.employee_id || undefined,
      });

      setIsAddUserModalOpen(false);
      setSelectedEmployeeId('');
      setUserForm({
        name: '',
        email: '',
        role: 'employee/labour',
        password: '',
        phone: '',
                employee_id: null,
      });

      toast.success(`User account for '${userForm.email}' created successfully!`);

      // Open Credentials Info Modal
      setCredentialsModalData({
        name: userForm.name.trim() || 'Team Member',
        email: userForm.email.toLowerCase().trim(),
        role: userForm.role,
        password: finalPassword,
      });

      await fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  // Change Role or Status of existing user
  const handleUpdateRole = async (userId, newRole) => {
    try {
      await api.users.update(userId, { role: newRole });
      toast.success('Role updated successfully!');
      await fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to update role');
    }
  };

  const handleToggleActive = async (targetUser) => {
    if (targetUser.id === currentUser?.id) {
      toast.error('You cannot deactivate your own account.');
      return;
    }
    try {
      await api.users.update(targetUser.id, { is_active: !targetUser.is_active });
      toast.success(`User ${targetUser.is_active ? 'deactivated' : 'activated'}!`);
      await fetchData();
    } catch (err) {
      toast.error(err.message || 'Action failed');
    }
  };

  // Copy helper
  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Copied ${fieldName} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2500);
  };

  if (role !== 'ORG_ADMIN') {
    return (
      <div className="card max-w-xl mx-auto my-12 p-10 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">
          Access Restricted
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Only Organization Administrators have permission to manage organization settings and team roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
            <Settings size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Settings & Team Roles
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              Manage organization profile, user accounts, role permissions, and company policies
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAddUserModal}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <UserPlus size={15} />
            <span>+ Add Team Member</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('members')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2',
            activeTab === 'members'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          <Users size={14} />
          <span>Team Members ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('org')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2',
            activeTab === 'org'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          <Building size={14} />
          <span>Company & Policies</span>
        </button>


      </div>

      {/* TAB 1: TEAM MEMBERS */}
      {activeTab === 'members' && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Active Organization Accounts
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every member has specific role-based permissions across project operations, ledger, and approvals
              </p>
            </div>
            <button
              onClick={handleOpenAddUserModal}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus size={14} />
              <span>Create Account</span>
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 font-semibold">
              Loading team members...
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 font-semibold">
              No team members found. Click "+ Add Team Member" to create your first user.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-5">Member Name</th>
                    <th className="py-3 px-5">Work Email</th>
                    <th className="py-3 px-5">Assigned Role</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    const roleInfo =
                      ROLE_OPTIONS.find((r) => r.value === u.role) ||
                      (['PROJECT_MANAGER', 'SUPERVISOR', 'SITE_ENGINEER', 'ACCOUNTANT'].includes(u.role)
                        ? ROLE_OPTIONS[1]
                        : ROLE_OPTIONS[2]);
                    const currentVal = ['PROJECT_MANAGER', 'SITE_MANAGER'].includes(u.role)
                      ? 'SITE_MANAGER'
                      : (u.role === 'ORG_ADMIN' ? 'ORG_ADMIN' : 'employee/labour');
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-5">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{u.name || 'Team Member'}</span>
                            {isSelf && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[9px] font-black uppercase">
                                You
                              </span>
                            )}
                          </div>
                          {u.phone && (
                            <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                              {u.phone}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-5 font-medium text-slate-600 dark:text-slate-300">
                          {u.email}
                        </td>
                        <td className="py-4 px-5">
                          <select
                            disabled={isSelf}
                            value={currentVal}
                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                            className={cn(
                              'px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer',
                              roleInfo?.color || 'bg-slate-100 text-slate-700 border-slate-200',
                              isSelf && 'opacity-80 cursor-not-allowed'
                            )}
                          >
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium">
                                {opt.label.split(' (')[0]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span
                            className={cn(
                              'px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider',
                              u.is_active
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200'
                            )}
                          >
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">

                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleToggleActive(u)}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                              >
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
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
        </div>
      )}

      {/* TAB 2: COMPANY & POLICIES */}
      {activeTab === 'org' && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm max-w-3xl">
          <div className="flex items-center gap-2 mb-6">
            <Building className="text-blue-500" size={20} />
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              Company Parameters & Work Rules
            </h2>
          </div>

          <form onSubmit={handleSaveOrg} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={orgForm.contact_email}
                  onChange={(e) => setOrgForm({ ...orgForm, contact_email: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                  Standard Workday (Hrs)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={orgForm.workday_hours}
                  onChange={(e) => setOrgForm({ ...orgForm, workday_hours: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                  Half-Day Limit (Hrs)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={orgForm.half_day_hours}
                  onChange={(e) => setOrgForm({ ...orgForm, half_day_hours: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                  Overtime After (Hrs)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={orgForm.overtime_after_hours}
                  onChange={(e) => setOrgForm({ ...orgForm, overtime_after_hours: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                Expense Approval Limit (₹)
              </label>
              <input
                type="number"
                step="100.00"
                value={orgForm.expense_approval_limit}
                onChange={(e) => setOrgForm({ ...orgForm, expense_approval_limit: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                Single expenses exceeding this threshold require explicit ORG_ADMIN or Project Manager approval.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 1: ADD TEAM MEMBER DIRECTLY */}
      <Modal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        title="Add New Team Member"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <p className="text-xs text-slate-500 mb-2">
            Create an active login account directly for an administrator, manager, engineer, supervisor, or accountant.
          </p>

          {/* Employee Dropdown Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400">
                Select Employee from Database *
              </label>
              {employees.length > 0 && (
                <span className="text-[10px] text-blue-500 font-bold">
                  {employees.length} Employee{employees.length > 1 ? 's' : ''} available
                </span>
              )}
            </div>
            <select
              value={selectedEmployeeId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedEmployeeId(val);
                if (!val) {
                  setUserForm((prev) => ({
                    ...prev,
                    name: '',
                    email: '',
                    phone: '',
                    employee_id: null,
                  }));
                  return;
                }
                if (val === 'CUSTOM') {
                  setUserForm((prev) => ({
                    ...prev,
                    name: '',
                    employee_id: null,
                  }));
                  return;
                }
                const emp = employees.find((item) => String(item.id) === String(val));
                if (emp) {
                  setUserForm((prev) => ({
                    ...prev,
                    name: emp.full_name || '',
                    email: emp.email || prev.email || '',
                    phone: emp.phone ? emp.phone.replace(/\D/g, '').slice(0, 10) : prev.phone,
                    employee_id: emp.id,
                    role: 'employee/labour',
                  }));
                }
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="">-- Select an employee to configure credentials --</option>
              {employees.map((emp) => {
                const hasAccount = users.some(
                  (u) =>
                    (emp.id && Number(u.employee_id) === Number(emp.id)) ||
                    (emp.email && u.email?.toLowerCase() === emp.email?.toLowerCase())
                );
                return (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code || `EMP-${emp.id}`}) — {emp.trade || emp.role || 'Worker'} {hasAccount ? '(Account Already Exists)' : ''}
                  </option>
                );
              })}
              <option value="CUSTOM">+ Enter Other / Custom Name Manually</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Select an employee already in our database to automatically link and configure their portal login credentials.
            </p>
          </div>

          {/* If Custom Name selected */}
          {selectedEmployeeId === 'CUSTOM' && (
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Ramesh Patel"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
              />
            </div>
          )}

          {/* Selected Employee Info Pill if an employee is chosen */}
          {selectedEmployeeId && selectedEmployeeId !== 'CUSTOM' && (
            <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between text-xs">
              <div>
                <span className="font-black text-blue-900 dark:text-blue-200">
                  {userForm.name}
                </span>
                <span className="ml-2 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                  {employees.find((e) => String(e.id) === String(selectedEmployeeId))?.employee_code || `ID: ${selectedEmployeeId}`}
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md">
                Database Employee
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Work Email Address *
            </label>
            <input
              type="email"
              placeholder="ramesh@construction.com"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Role & Permissions *
            </label>
            <select
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Initial Password * (minimum 6 characters)
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Mobile Number (10 digits, Optional)
            </label>
            <input
              type="tel"
              maxLength={10}
              placeholder="9876543210"
              value={userForm.phone}
              onChange={(e) =>
                setUserForm({ ...userForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
              }
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
            />
          </div>



          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsAddUserModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: CREDENTIALS RECEIPT */}
      {credentialsModalData && (
        <Modal
          isOpen={true}
          onClose={() => setCredentialsModalData(null)}
          title="Credential info."
        >
          <div className="space-y-4">
            

            <div className="space-y-2.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Portal URL:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {window.location.origin}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Member Name:</span>
                <span className="font-bold text-slate-900 dark:text-white">{credentialsModalData.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Assigned Role:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-500/10 text-blue-500">
                  {credentialsModalData.role}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Login Username:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{credentialsModalData.email}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(credentialsModalData.email, 'Username')}
                    className="p-1 rounded text-slate-400 hover:text-blue-500 cursor-pointer"
                    title="Copy Username"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Password:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700">
                    {credentialsModalData.password}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(credentialsModalData.password, 'Password')}
                    className="p-1 rounded text-slate-400 hover:text-blue-500 cursor-pointer"
                    title="Copy Password"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  const fullText = `BuildSphere Login Credentials:\nURL: ${window.location.origin}\nUser: ${credentialsModalData.email}\nPassword: ${credentialsModalData.password}\nRole: ${credentialsModalData.role}`;
                  copyToClipboard(fullText, 'All Credentials');
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
              >
                <Copy size={13} />
                <span>Copy All</span>
              </button>
              <button
                type="button"
                onClick={() => setCredentialsModalData(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-md shadow-blue-500/20"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
