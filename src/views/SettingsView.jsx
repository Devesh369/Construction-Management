import React, { useState, useEffect } from 'react';
import {
  Settings,
  Mail,
  UserPlus,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Send,
  Building,
  Users,
  KeyRound,
  CheckCircle2,
  Trash2,
  Edit2,
  Phone,
  Briefcase,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

const ROLE_OPTIONS = [
  { value: 'ORG_ADMIN', label: 'Org Admin (Super Admin - Full Access)', color: 'border-purple-500/30 text-purple-400 bg-purple-500/10' },
  { value: 'PROJECT_MANAGER', label: 'Project Manager (Budgets, Projects & Vendors)', color: 'border-blue-500/30 text-blue-400 bg-blue-500/10' },
  { value: 'SITE_MANAGER', label: 'Site Manager (Site Operations, Workforce & Progress)', color: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10' },
  { value: 'SITE_ENGINEER', label: 'Site Engineer (DPR, Work Progress & Quantities)', color: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10' },
  { value: 'SUPERVISOR', label: 'Site Supervisor (Daily Attendance & Workers)', color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' },
  { value: 'ACCOUNTANT', label: 'Accountant (Ledger, Upad, Payment & Payroll)', color: 'border-amber-500/30 text-amber-400 bg-amber-500/10' },
  { value: 'employee/labour', label: 'Employee / Labour (Attendance, Payroll & Upad)', color: 'border-orange-500/30 text-orange-400 bg-orange-500/10' },
];

export const SettingsView = () => {
  const { user: currentUser, role } = useAuth();
  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'org' | 'invitations'
  const [org, setOrg] = useState(null);
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // New User form (direct registration)
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    role: 'PROJECT_MANAGER',
    password: '',
    phone: '',
    notification_email: '',
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
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    role: 'PROJECT_MANAGER',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgRes, usersRes, invRes] = await Promise.all([
        api.org.getCurrent().catch(() => ({})),
        api.users.list().catch(() => []),
        api.org.listInvitations().catch(() => []),
      ]);

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
      setInvitations(Array.isArray(invRes) ? invRes : invRes?.results || []);
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

  // Direct User Creation
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    const cleanPhone = userForm.phone?.replace(/\D/g, '') || undefined;
    try {
      await api.users.create({
        name: userForm.name.trim(),
        email: userForm.email.toLowerCase().trim(),
        role: userForm.role,
        password: userForm.password,
        phone: cleanPhone,
        notification_email: userForm.notification_email?.trim() || undefined,
      });
      const targetEmail = userForm.notification_email?.trim() || userForm.email;
      toast.success(
        `User '${userForm.email}' created! Login credentials dispatched to ${targetEmail} via email.`
      );
      setIsAddUserModalOpen(false);
      setUserForm({
        name: '',
        email: '',
        role: 'PROJECT_MANAGER',
        password: '',
        phone: '',
        notification_email: '',
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

  // Send Invitation Link
  const handleSendInvite = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.org.createInvitation(inviteForm);
      setIsInviteModalOpen(false);
      setInviteForm({ email: '', name: '', role: 'PROJECT_MANAGER' });
      toast.success('Team invitation link dispatched!');
      await fetchData();
    } catch (err) {
      toast.error(`Error sending invitation: ${err.message}`);
    } finally {
      setSaving(false);
    }
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
            onClick={() => setIsAddUserModalOpen(true)}
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

        <button
          onClick={() => setActiveTab('invitations')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2',
            activeTab === 'invitations'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          <Mail size={14} />
          <span>Invitations ({invitations.length})</span>
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
              onClick={() => setIsAddUserModalOpen(true)}
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
                    const roleInfo = ROLE_OPTIONS.find((r) => r.value === u.role);
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
                            value={u.role}
                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                            className={cn(
                              'px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer',
                              roleInfo?.color || 'bg-slate-100 text-slate-700 border-slate-200',
                              isSelf && 'opacity-80 cursor-not-allowed'
                            )}
                          >
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium">
                                {opt.value}
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
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
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

      {/* TAB 3: INVITATIONS */}
      {activeTab === 'invitations' && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Mail className="text-amber-500" size={20} />
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Pending Team Invitations
              </h2>
            </div>
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Send size={13} />
              <span>Send Invite</span>
            </button>
          </div>

          {invitations.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 font-semibold">
              No pending invitations. All members are registered.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400">
                    <th className="py-3 px-4">Invitee Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {inv.name || 'Member'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {inv.email}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase">
                          {inv.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase">
                          {inv.used_at ? 'Accepted' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Send Credentials To Email</span>
              <span className="text-[10px] text-blue-500 font-semibold normal-case">Delivered via Resend</span>
            </label>
            <input
              type="email"
              placeholder="Defaults to Work Email (leave blank or specify alternate)"
              value={userForm.notification_email}
              onChange={(e) =>
                setUserForm({ ...userForm, notification_email: e.target.value })
              }
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
              <Mail size={12} className="text-blue-500 shrink-0" />
              <span>Login credentials (username, password & role details) will be emailed upon creation.</span>
            </p>
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

      {/* MODAL 2: INVITE TEAM MEMBER */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Send Team Invitation Link"
      >
        <form onSubmit={handleSendInvite} className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Member Name
            </label>
            <input
              type="text"
              placeholder="e.g. Rahul Verma"
              value={inviteForm.name}
              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Work Email Address *
            </label>
            <input
              type="email"
              placeholder="rahul@company.com"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Assigned Role *
            </label>
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-50"
            >
              {saving ? 'Sending...' : 'Send Invitation Link'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
