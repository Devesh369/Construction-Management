import React, { useState, useEffect } from 'react';
import {
  Calendar,
  FolderKanban,
  Users,
  Check,
  ChevronRight,
  ArrowLeft,
  Search,
  Filter,
  FileDown,
  Edit2,
  Trash2,
  X,
  FileText,
  ClipboardList,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

export const ProgressView = ({ selectedProjectId, navState, onClearNavState }) => {
  const { user, role } = useAuth();

  // Navigation mode: 'create' (New Work Entry form) | 'entries' (Work Entries table) | 'department' (Department Entries)
  const [currentView, setCurrentView] = useState('create');

  // Master lists
  const [projects, setProjects] = useState([]);
  const [workEntries, setWorkEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPresent, setLoadingPresent] = useState(false);

  // New Work Entry form state (matches Screenshot 1)
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryProject, setEntryProject] = useState(selectedProjectId || '');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryDepartment, setEntryDepartment] = useState('');
  const [presentEmployees, setPresentEmployees] = useState([]);
  const [presentByRole, setPresentByRole] = useState({});
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Filters for View Work Entries (matches Screenshot 3)
  const [filterFromDate, setFilterFromDate] = useState('2026-08-01');
  const [filterToDate, setFilterToDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterProject, setFilterProject] = useState('all');
  const [assignedOnlyFilter, setAssignedOnlyFilter] = useState(
    role === 'employee/labour' || role === 'LABOUR' || role === 'EMPLOYEE'
  );

  // Helper to check if a work entry is assigned to the current logged in user or their role
  const isAssignedToCurrentUser = (entry) => {
    if (!user) return false;

    // 1. Direct Employee ID match
    if (user.employee_id) {
      const empIds = Array.isArray(entry.employees)
        ? entry.employees
        : entry.employee
        ? [entry.employee]
        : [];
      if (empIds.map(Number).includes(Number(user.employee_id))) {
        return true;
      }
    }

    // 2. Email or name match in employee details
    if (Array.isArray(entry.employee_details)) {
      if (
        entry.employee_details.some(
          (e) =>
            (user.email && e.email && e.email.toLowerCase() === user.email.toLowerCase()) ||
            (user.name && e.full_name && e.full_name.toLowerCase().includes(user.name.toLowerCase()))
        )
      ) {
        return true;
      }
    }

    // 3. Role or department match
    const currentRole = (user.role || '').toLowerCase();
    if (entry.department && entry.department.toLowerCase().includes(currentRole)) {
      return true;
    }

    if (entry.role_counts) {
      const roleKeys = Object.keys(entry.role_counts).map((r) => r.toLowerCase());
      if (
        roleKeys.some(
          (r) =>
            currentRole.includes(r) ||
            r.includes(currentRole) ||
            (currentRole.includes('labour') && (r.includes('karigar') || r.includes('labour') || r.includes('helper'))) ||
            (currentRole.includes('engineer') && r.includes('eng')) ||
            (currentRole.includes('supervisor') && r.includes('sup'))
        )
      ) {
        return true;
      }
    }

    return false;
  };

  const assignedEntries = workEntries.filter(isAssignedToCurrentUser);
  const assignedEntriesCount = assignedEntries.length;
  const displayedWorkEntries = assignedOnlyFilter ? assignedEntries : workEntries;

  // Edit Entry Modal state (matches Screenshot 4)
  const [editingEntry, setEditingEntry] = useState(null);
  const [editDescription, setEditDescription] = useState('');
  const [editSelectedEmployeeIds, setEditSelectedEmployeeIds] = useState([]);
  const [editAllAvailableEmployees, setEditAllAvailableEmployees] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await api.projects.list();
        const list = Array.isArray(res) ? res : res.results || [];
        setProjects(list);
        if (!entryProject && list.length > 0) {
          setEntryProject(selectedProjectId || list[0].id);
        }
      } catch (err) {
        console.warn('Could not load projects', err);
      }
    };
    loadProjects();
  }, [selectedProjectId]);

  // Sync selectedProjectId if changed from topbar
  useEffect(() => {
    if (selectedProjectId) {
      setEntryProject(selectedProjectId);
      setFilterProject(String(selectedProjectId));
    }
  }, [selectedProjectId]);

  // Handle direct navigation state (e.g. from Project Details -> Daily Reports (DPR))
  useEffect(() => {
    if (navState) {
      const targetView = navState.view || 'entries';
      const targetProjectId = navState.projectId ? String(navState.projectId) : 'all';
      const targetFromDate = navState.fromDate || '2020-01-01';
      const targetToDate = navState.toDate || new Date().toISOString().split('T')[0];

      setCurrentView(targetView);
      if (targetProjectId !== 'all') {
        setEntryProject(Number(targetProjectId) || targetProjectId);
      }
      setFilterProject(targetProjectId);
      setFilterFromDate(targetFromDate);
      setFilterToDate(targetToDate);

      fetchWorkEntries({
        fromDate: targetFromDate,
        toDate: targetToDate,
        project: targetProjectId,
      });

      if (onClearNavState) {
        onClearNavState();
      }
    }
  }, [navState]);

  // Load present employees whenever date or project changes in New Entry form
  useEffect(() => {
    const fetchPresentEmployees = async () => {
      if (!entryDate) return;
      setLoadingPresent(true);
      try {
        const res = await api.workEntries.getPresentEmployees({
          date: entryDate,
          project: entryProject || '',
        });
        const emps = Array.isArray(res) ? res : res?.employees || [];
        setPresentEmployees(emps);

        // Ensure by_role is always grouped even if backend returned a flat list
        let byRole = res?.by_role;
        if (!byRole || Object.keys(byRole).length === 0) {
          byRole = {};
          emps.forEach((emp) => {
            const rName = emp.role || emp.trade || 'Worker';
            if (!byRole[rName]) byRole[rName] = [];
            byRole[rName].push(emp);
          });
        }
        setPresentByRole(byRole);

        // By default, select all present employees
        setSelectedEmployeeIds(emps.map((e) => e.id));
      } catch (err) {
        console.warn('Could not fetch present employees', err);
        setPresentEmployees([]);
        setPresentByRole({});
        setSelectedEmployeeIds([]);
      } finally {
        setLoadingPresent(false);
      }
    };

    fetchPresentEmployees();
  }, [entryDate, entryProject]);

  // Fallback to load all active workers if attendance has not been registered yet
  const handleLoadAllActiveEmployees = async () => {
    setLoadingPresent(true);
    try {
      const res = await api.workforce.listEmployees({ is_active: true, page_size: 200 });
      const rawList = Array.isArray(res) ? res : res?.results || [];
      const emps = rawList.map((emp) => {
        const roleName = emp.role || emp.trade || 'Worker';
        return {
          id: emp.id,
          full_name: emp.full_name,
          employee_code: emp.employee_code,
          role: roleName,
          trade: emp.trade,
          attendance_status: 'AVAILABLE',
          project_id: emp.primary_project || null,
          project_name: emp.primary_project_name || '',
        };
      });
      setPresentEmployees(emps);
      const byRole = {};
      emps.forEach((emp) => {
        const rName = emp.role;
        if (!byRole[rName]) byRole[rName] = [];
        byRole[rName].push(emp);
      });
      setPresentByRole(byRole);
      setSelectedEmployeeIds(emps.map((e) => e.id));
      toast.success(`Loaded ${emps.length} active workers.`);
    } catch (err) {
      console.warn('Failed loading active employees', err);
      toast.error('Failed to load active workers.');
    } finally {
      setLoadingPresent(false);
    }
  };

  // Load work entries list
  const fetchWorkEntries = async (overrideParams = null) => {
    setLoading(true);
    try {
      const fDate = overrideParams?.fromDate !== undefined ? overrideParams.fromDate : filterFromDate;
      const tDate = overrideParams?.toDate !== undefined ? overrideParams.toDate : filterToDate;
      const pFilter = overrideParams?.project !== undefined ? overrideParams.project : filterProject;

      const params = {};
      if (fDate) params.from_date = fDate;
      if (tDate) params.to_date = tDate;
      if (pFilter && pFilter !== 'all') params.project = pFilter;

      const res = await api.workEntries.list(params);
      const list = Array.isArray(res) ? res : res.results || [];
      setWorkEntries(list);
    } catch (err) {
      console.error('Failed to load work entries', err);
      toast.error('Failed to load work entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkEntries();
  }, [filterFromDate, filterToDate, filterProject]);

  // Handle toggling employee checkbox in New Entry
  const toggleEmployeeSelection = (id) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Toggle all employees in New Entry
  const toggleAllEmployees = () => {
    if (selectedEmployeeIds.length === presentEmployees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(presentEmployees.map((e) => e.id));
    }
  };

  // Submit New Work Entry (Pressing OK button - matches Screenshot 1)
  const handleCreateWorkEntry = async (e) => {
    if (e) e.preventDefault();

    setSubmitting(true);
    try {
      await api.workEntries.create({
        project: Number(entryProject),
        date: entryDate,
        description: entryDescription.trim(),
        department: entryDepartment.trim(),
        employees: selectedEmployeeIds,
      });

      toast.success('Work entry created successfully!');
      setEntryDescription('');
      await fetchWorkEntries();
      // Automatically switch to Work Entries table view to show the new entry!
      setCurrentView('entries');
    } catch (err) {
      toast.error(err.message || 'Failed to create work entry');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Work Entry
  const handleDeleteEntry = async (id) => {
    if (!window.confirm('Are you sure you want to delete this work entry?')) return;
    try {
      await api.workEntries.delete(id);
      toast.success('Work entry deleted');
      await fetchWorkEntries();
    } catch (err) {
      toast.error(err.message || 'Failed to delete work entry');
    }
  };

  // Open Edit Entry Modal (matches Screenshot 4)
  const openEditModal = async (entry) => {
    setEditingEntry(entry);
    setEditDescription(entry.description || '');
    const currentAssignedIds = (entry.employees || []).map((e) =>
      typeof e === 'object' ? e.id : e
    );
    setEditSelectedEmployeeIds(currentAssignedIds);

    // Fetch present employees on that entry's date & project, plus already assigned employees
    try {
      const res = await api.workEntries.getPresentEmployees({
        date: entry.date,
        project: entry.project,
      });
      const presentList = Array.isArray(res) ? res : res?.employees || [];

      // Combine with entry.employee_details in case some were assigned
      const combined = [...presentList];
      if (entry.employee_details) {
        entry.employee_details.forEach((emp) => {
          if (!combined.some((c) => c.id === emp.id)) {
            combined.push(emp);
          }
        });
      }
      setEditAllAvailableEmployees(combined);
    } catch {
      setEditAllAvailableEmployees(entry.employee_details || []);
    }
  };

  // Save Edit Entry
  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    setSavingEdit(true);
    try {
      await api.workEntries.update(editingEntry.id, {
        description: editDescription.trim(),
        employees: editSelectedEmployeeIds,
      });
      toast.success('Work entry updated!');
      setEditingEntry(null);
      await fetchWorkEntries();
    } catch (err) {
      toast.error(err.message || 'Failed to update work entry');
    } finally {
      setSavingEdit(false);
    }
  };

  // Dynamic role columns from current work entries list
  const standardRoles = ['Karigar', 'Labour', 'Crp. Karigar'];
  const allRolesSet = new Set(standardRoles);
  workEntries.forEach((entry) => {
    if (entry.role_counts) {
      Object.keys(entry.role_counts).forEach((r) => allRolesSet.add(r));
    }
  });
  const roleColumns = Array.from(allRolesSet);

  // Calculate totals per role column
  const roleTotals = {};
  roleColumns.forEach((r) => {
    roleTotals[r] = 0;
  });
  workEntries.forEach((entry) => {
    if (entry.role_counts) {
      Object.entries(entry.role_counts).forEach(([r, count]) => {
        roleTotals[r] = (roleTotals[r] || 0) + Number(count || 0);
      });
    }
  });

  // Grouped employees in edit modal
  const editGroupedByRole = {};
  editAllAvailableEmployees.forEach((emp) => {
    const r = emp.role || emp.trade || 'Labour';
    if (!editGroupedByRole[r]) editGroupedByRole[r] = [];
    editGroupedByRole[r].push(emp);
  });

  // PDF Export
  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER HERO BANNER (Matches Screenshot 1 & 3)                      */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-white/10 p-6 sm:p-7 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {currentView !== 'create' && (
              <button
                onClick={() => setCurrentView('create')}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center text-white border border-white/10 cursor-pointer shadow-sm"
                title="Back to New Work Entry"
              >
                <ArrowLeft size={18} />
              </button>
            )}

            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-black uppercase tracking-[0.2em] mb-1">
                <span className="w-4 h-0.5 bg-emerald-400 rounded-full" />
                Work Management Module
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
                {currentView === 'entries'
                  ? 'Work Entries'
                  : currentView === 'department'
                  ? 'Department Work Breakdown'
                  : 'Work Management'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
                {currentView === 'entries'
                  ? 'Filter, view, edit and export work entries'
                  : 'Daily work entries by project and employee'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentView === 'entries' ? (
              <div className="px-4 py-2 rounded-xl bg-slate-800/80 border border-white/15 text-white flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                  Entries
                </span>
                <span className="text-lg font-black text-emerald-400">{workEntries.length}</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentView('entries')}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/10 flex items-center gap-2 cursor-pointer"
                >
                  <ClipboardList size={14} className="text-emerald-400" />
                  <span>View All Entries ({workEntries.length})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-NAVIGATION TABS                                                       */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setCurrentView('create')}
          className={cn(
            "px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer",
            currentView === 'create'
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-emerald-500/30"
          )}
        >
          <Sparkles size={14} />
          <span>New Work Entry</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentView('entries')}
          className={cn(
            "px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer",
            currentView === 'entries'
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-emerald-500/30"
          )}
        >
          <ClipboardList size={14} />
          <span>View Work Entries</span>
          <span
            className={cn(
              "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black",
              currentView === 'entries'
                ? "bg-white/20 text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-muted)]"
            )}
          >
            {workEntries.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentView('department')}
          className={cn(
            "px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer",
            currentView === 'department'
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-emerald-500/30"
          )}
        >
          <FileText size={14} />
          <span>Department Breakdown</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2. NEW WORK ENTRY VIEW (Matches Screenshot 1 & 2)                         */}
      {/* ========================================================================= */}
      {currentView === 'create' && (
        <div className="space-y-6">
          {/* Main New Entry Card */}
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-6 sm:p-8 shadow-sm">
            {/* Card Header */}
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ClipboardList size={22} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-[var(--text-primary)] uppercase">
                  New Work Entry
                </h2>
                <p className="text-xs text-[var(--text-muted)] font-medium">
                  Select date, project and employees, then describe the work
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateWorkEntry} className="space-y-6">
              {/* Row 1: Date & Project Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                    <Calendar size={13} className="text-blue-500" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                    <FolderKanban size={13} className="text-blue-500" />
                    Project
                  </label>
                  <select
                    value={entryProject}
                    onChange={(e) => setEntryProject(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all cursor-pointer"
                  >
                    <option value="">Select project...</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.code ? `(${p.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Present Employees (Fetched from Attendance!) */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                    <Users size={13} className="text-emerald-500" />
                    Present Employees
                    {presentEmployees.length > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full ml-1.5">
                        {selectedEmployeeIds.length} of {presentEmployees.length} selected
                      </span>
                    )}
                  </label>

                  {presentEmployees.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleAllEmployees}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {selectedEmployeeIds.length === presentEmployees.length
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                  )}
                </div>

                {loadingPresent ? (
                  <div className="p-8 rounded-xl bg-[var(--bg-secondary)]/50 border border-dashed border-[var(--border-default)] text-center text-xs text-[var(--text-muted)]">
                    Fetching attendance records for {entryDate}...
                  </div>
                ) : presentEmployees.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-default)] text-center space-y-2">
                    <p className="text-xs font-semibold text-[var(--text-muted)]">
                      No employees marked present on {entryDate}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] opacity-75">
                      Mark worker attendance in the Attendance module, or click below to select from all active workers.
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleLoadAllActiveEmployees}
                        className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-bold transition-all cursor-pointer border border-blue-200 dark:border-blue-800 shadow-2xs"
                      >
                        Show All Active Workers
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5 p-4 rounded-xl bg-[var(--bg-secondary)]/60 border border-[var(--border-default)]">
                    {Object.entries(presentByRole).map(([roleName, emps]) => (
                      <div key={roleName} className="space-y-2">
                        <div className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {roleName} ({emps.length})
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {emps.map((emp) => {
                            const isSelected = selectedEmployeeIds.includes(emp.id);
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => toggleEmployeeSelection(emp.id)}
                                className={cn(
                                  'flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer select-none',
                                  isSelected
                                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200 shadow-xs ring-1 ring-blue-500'
                                    : 'bg-[var(--bg-primary)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-slate-400'
                                )}
                              >
                                <div
                                  className={cn(
                                    'w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all',
                                    isSelected
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'border-slate-400 bg-white dark:bg-slate-800'
                                  )}
                                >
                                  {isSelected && <Check size={11} strokeWidth={3} />}
                                </div>
                                <div className="truncate min-w-0">
                                  <div className="truncate text-xs font-black leading-tight text-slate-900 dark:text-white">
                                    {emp.full_name}
                                  </div>
                                  <div className="text-[10px] text-[var(--text-muted)] truncate flex items-center gap-1 mt-0.5">
                                    <span>{emp.role || emp.trade || 'Worker'}</span>
                                    {emp.project_name && <span className="opacity-75">• {emp.project_name}</span>}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Row 3: Description */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                  <FileText size={13} className="text-blue-500" />
                  Description
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe today's work..."
                  value={entryDescription}
                  onChange={(e) => setEntryDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] text-sm font-medium placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
                />
              </div>

              {/* Row 4: Buttons (Department on left, OK on right - matches Screenshot 1) */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const dept = prompt('Enter Department or Role Category for this work:');
                    if (dept) setEntryDepartment(dept);
                  }}
                  className="px-5 py-3 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <Users size={16} />
                  <span>
                    {entryDepartment ? `Department: ${entryDepartment}` : 'Department'}
                  </span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-sm tracking-wide flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  <Check size={18} strokeWidth={3} />
                  <span>{submitting ? 'Saving...' : 'OK'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Hub Navigation Cards (Matches Screenshot 2) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Department Entries */}
            <div
              onClick={() => setCurrentView('department')}
              className="group p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] hover:border-indigo-500/40 hover:shadow-md transition-all flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                    Department Entries
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5">
                    Grouped by description, role counts and PDF report
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-wider group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <span>Open</span>
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Card 2: View Work Entries */}
            <div
              onClick={() => setCurrentView('entries')}
              className="group p-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] hover:border-emerald-500/40 hover:shadow-md transition-all flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                    View Work Entries
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5">
                    Filter by date & project, view table and export PDF report
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-wider group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <span>Open</span>
                <ChevronRight size={14} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. WORK ENTRIES TABLE VIEW (Matches Screenshot 3)                         */}
      {/* ========================================================================= */}
      {currentView === 'entries' && (
        <div className="space-y-6">
          {/* Filters Card */}
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-3">
              <Filter size={13} className="text-blue-500" />
              Filters
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  From Date
                </label>
                <input
                  type="date"
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] text-xs font-semibold focus:outline-none cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  To Date
                </label>
                <input
                  type="date"
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] text-xs font-semibold focus:outline-none cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Project
                </label>
                <select
                  value={String(filterProject)}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} {p.code ? `(${p.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleExportPDF}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <FileDown size={14} className="text-emerald-400" />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>

            {/* Quick Assigned Work Toggle Bar */}
            <div className="mt-4 pt-3 border-t border-[var(--border-default)] flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAssignedOnlyFilter(false)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                    !assignedOnlyFilter
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  )}
                >
                  All Site Work ({workEntries.length})
                </button>

                <button
                  type="button"
                  onClick={() => setAssignedOnlyFilter(true)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                    assignedOnlyFilter
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <CheckCircle2 size={13} />
                  <span>Assigned to My Role / Me ({assignedEntriesCount})</span>
                </button>
              </div>

              {assignedEntriesCount > 0 && (
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Sparkles size={12} />
                  <span>{assignedEntriesCount} task(s) explicitly assigned to your role ({user?.role || 'Member'})</span>
                </span>
              )}
            </div>
          </div>

          {/* Work Entries Table Card */}
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[var(--border-default)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                    Work Entries
                  </h2>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {displayedWorkEntries.length} entries showing {assignedOnlyFilter ? '(Filtered for Your Role)' : ''}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCurrentView('create')}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <span>+ New Entry</span>
              </button>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-[var(--text-muted)]">
                Loading work entries...
              </div>
            ) : displayedWorkEntries.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--text-muted)]">
                {assignedOnlyFilter
                  ? `No work entries found assigned to your role (${user?.role || 'User'}). Click "All Site Work" above to view all tasks.`
                  : 'No work entries found for the selected dates and project.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/50 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                      <th className="py-3 px-4 w-12 text-center">No.</th>
                      <th className="py-3 px-4 w-28">Date</th>
                      <th className="py-3 px-6">Description</th>
                      {roleColumns.map((roleName) => (
                        <th key={roleName} className="py-3 px-4 text-center uppercase">
                          {roleName}
                        </th>
                      ))}
                      <th className="py-3 px-4 w-24 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-default)]">
                    {displayedWorkEntries.map((entry, idx) => (
                      <tr
                        key={entry.id}
                        className="hover:bg-[var(--bg-secondary)]/40 transition-colors"
                      >
                        <td className="py-3.5 px-4 text-center text-[var(--text-muted)] font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-[var(--text-secondary)] whitespace-nowrap">
                          {entry.date}
                        </td>
                        <td className="py-3.5 px-6">
                          <div className="font-bold text-[var(--text-primary)] leading-snug flex items-center gap-2 flex-wrap">
                            <span>{entry.description}</span>
                            {isAssignedToCurrentUser(entry) && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[10px] font-black uppercase flex items-center gap-1 shadow-sm">
                                <CheckCircle2 size={11} /> Assigned to You ({user?.role || 'Your Role'})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{entry.project_name || `Project #${entry.project}`}</span>
                            {entry.department && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                                Dept: {entry.department}
                              </span>
                            )}
                          </div>
                        </td>
                        {roleColumns.map((roleName) => {
                          const count = entry.role_counts?.[roleName] || 0;
                          return (
                            <td key={roleName} className="py-3.5 px-4 text-center">
                              {count > 0 ? (
                                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-black text-xs">
                                  {count}
                                </span>
                              ) : (
                                <span className="text-[var(--text-muted)] opacity-40 font-bold">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditModal(entry)}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-500/10 transition-colors cursor-pointer"
                              title="Edit Entry"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Delete Entry"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* Total Footer Row (Matches Screenshot 3) */}
                  <tfoot>
                    <tr className="border-t-2 border-[var(--border-default)] bg-[var(--bg-secondary)]/70 font-black text-xs text-[var(--text-primary)]">
                      <td colSpan={3} className="py-4 px-6 uppercase tracking-wider text-right font-black">
                        Total
                      </td>
                      {roleColumns.map((roleName) => (
                        <td key={roleName} className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center min-w-[26px] h-6 px-2.5 rounded-full bg-emerald-600 text-white font-black text-xs shadow-sm">
                            {roleTotals[roleName] || 0}
                          </span>
                        </td>
                      ))}
                      <td className="py-4 px-4 text-center" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DEPARTMENT ENTRIES VIEW (Matches Screenshot 2 details)                 */}
      {/* ========================================================================= */}
      {currentView === 'department' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-black uppercase tracking-tight text-[var(--text-primary)]">
                  Department Work Aggregations
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Consolidated labor metrics categorized by work description and department
                </p>
              </div>
              <button
                onClick={() => setCurrentView('create')}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold"
              >
                Back
              </button>
            </div>

            <div className="space-y-4">
              {workEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-xs font-black text-[var(--text-primary)]">
                      {entry.description}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {entry.project_name} • {entry.date}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {Object.entries(entry.role_counts || {}).map(([r, cnt]) => (
                      <span
                        key={r}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-[var(--border-default)] text-[11px] font-bold text-[var(--text-secondary)]"
                      >
                        {r}: <strong className="text-emerald-500 font-black">{cnt}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. EDIT ENTRY MODAL (Matches Screenshot 4)                                 */}
      {/* ========================================================================= */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-2xl overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-6 border-b border-[var(--border-default)] flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-[var(--text-primary)]">
                    Edit Entry
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] font-medium">
                    {editingEntry.date}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditingEntry(null)}
                className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Description Input */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                />
              </div>

              {/* Project & Date Badges (Matches Screenshot 4) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-[var(--bg-secondary)]/70 border border-[var(--border-default)]">
                  <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                    Project
                  </div>
                  <div className="text-sm font-black text-[var(--text-primary)] mt-0.5 truncate">
                    {editingEntry.project_name || `Project #${editingEntry.project}`}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[var(--bg-secondary)]/70 border border-[var(--border-default)]">
                  <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                    Date
                  </div>
                  <div className="text-sm font-black text-[var(--text-primary)] mt-0.5">
                    {editingEntry.date}
                  </div>
                </div>
              </div>

              {/* Employees Grouped by Role (Matches Screenshot 4) */}
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2.5 flex items-center gap-1.5">
                  <Users size={13} className="text-blue-500" />
                  Employees ({editSelectedEmployeeIds.length} Selected)
                </div>

                <div className="space-y-4">
                  {Object.entries(editGroupedByRole).map(([roleName, emps]) => (
                    <div key={roleName} className="space-y-1.5">
                      <div className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                        {roleName} ({emps.length})
                      </div>
                      <div className="space-y-1.5">
                        {emps.map((emp) => {
                          const isChecked = editSelectedEmployeeIds.includes(emp.id);
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() =>
                                setEditSelectedEmployeeIds((prev) =>
                                  prev.includes(emp.id)
                                    ? prev.filter((i) => i !== emp.id)
                                    : [...prev, emp.id]
                                )
                              }
                              className={cn(
                                'w-full flex items-center gap-3 p-3 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer',
                                isChecked
                                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300'
                                  : 'bg-[var(--bg-secondary)]/40 border-[var(--border-default)] text-[var(--text-muted)] hover:border-slate-400'
                              )}
                            >
                              <div
                                className={cn(
                                  'w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all',
                                  isChecked
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'border-slate-400'
                                )}
                              >
                                {isChecked && <Check size={11} strokeWidth={3} />}
                              </div>
                              <span className="font-bold text-xs">{emp.full_name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer (Cancel / Save Changes) */}
            <div className="p-6 border-t border-[var(--border-default)] flex items-center justify-end gap-3 bg-[var(--bg-secondary)]/30">
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="px-5 py-2.5 rounded-xl border border-[var(--border-default)] hover:bg-[var(--bg-secondary)] text-xs font-bold text-[var(--text-secondary)] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={handleSaveEdit}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-50"
              >
                <Check size={14} strokeWidth={3} />
                <span>{savingEdit ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
