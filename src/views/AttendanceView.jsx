import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Check,
  X,
  Building2,
  Download,
  Printer,
  Trash2,
  Search,
  Users,
  CheckCircle2,
  Clock,
  IndianRupee,
  Filter,
  Plus,
  ChevronDown,
  AlertCircle,
  FileSpreadsheet,
  CalendarCheck,
  Layers,
  ArrowRight,
  Info,
  ExternalLink,
  UserPlus,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const AttendanceView = ({ selectedProjectId, navState, onClearNavState }) => {
  const { user, role } = useAuth();
  const isEmployeeLabour = role === 'employee/labour' || role === 'EMPLOYEE' || role === 'LABOUR';

  // Shared state
  const [employees, setEmployees] = useState([]);
  const currentEmpId = useMemo(() => {
    if (user?.employee_id) return Number(user.employee_id);
    const matched = employees.find(
      (e) =>
        (user?.email && e.email && e.email.toLowerCase() === user.email.toLowerCase()) ||
        (user?.phone && e.phone && e.phone === user.phone) ||
        (user?.name && e.full_name && e.full_name.toLowerCase() === user.name.toLowerCase())
    );
    return matched ? matched.id : null;
  }, [user, employees]);

  // Active top-level tab: 'mark' | 'night' | 'present_absent' | 'history' | 'report' | 'salary' | 'holiday'
  const [activeTab, setActiveTab] = useState(isEmployeeLabour ? 'history' : 'mark');
  const [projects, setProjects] = useState([]);
  const [gangs, setGangs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab 1: MARK ATTENDANCE state
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [markDate, setMarkDate] = useState(new Date().toISOString().split('T')[0]);
  const isFutureMarkDate = markDate > todayStr;
  const [markProjectFilter, setMarkProjectFilter] = useState(
    selectedProjectId ? String(selectedProjectId) : 'ALL'
  );
  const [markSearch, setMarkSearch] = useState('');
  const [selectedEmpIds, setSelectedEmpIds] = useState(new Set());
  // Per-worker shifts ('FULL' | 'HALF' | 'SPLIT') and allocated project id
  const [workerConfigs, setWorkerConfigs] = useState({});
  // Status of marked records for markDate: map of employeeId -> { status, earning, recordId }
  const [todayRecordsMap, setTodayRecordsMap] = useState({});
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Tab 2: PRESENT & ABSENT state
  const [paFilterType, setPaFilterType] = useState('PRESENT'); // 'PRESENT' | 'ABSENT'
  const [paDate, setPaDate] = useState(new Date().toISOString().split('T')[0]);
  const [paSearch, setPaSearch] = useState('');
  const [paProjectFilter, setPaProjectFilter] = useState(
    selectedProjectId ? String(selectedProjectId) : 'ALL'
  );
  const [paRecords, setPaRecords] = useState([]);
  const [paLoading, setPaLoading] = useState(false);

  // Tab 3: ATTENDANCE & HISTORY state
  const [histFromDate, setHistFromDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [histToDate, setHistToDate] = useState(new Date().toISOString().split('T')[0]);
  const [histEmpFilter, setHistEmpFilter] = useState('ALL');
  const [histProjectFilter, setHistProjectFilter] = useState(
    selectedProjectId ? String(selectedProjectId) : 'ALL'
  );
  const [histRecords, setHistRecords] = useState([]);
  const [histSummary, setHistSummary] = useState({
    total_present: 0,
    full_days: 0,
    half_days: 0,
    total_absent: 0,
    total_earnings: 0,
  });
  const [histLoading, setHistLoading] = useState(false);

  // Tab 4: ATTENDANCE REPORT state
  const [repFromDate, setRepFromDate] = useState('2026-03-06');
  const [repToDate, setRepToDate] = useState(new Date().toISOString().split('T')[0]);
  const [repEmpFilter, setRepEmpFilter] = useState('ALL');
  const [repProjectFilter, setRepProjectFilter] = useState(
    selectedProjectId ? String(selectedProjectId) : 'ALL'
  );
  const [reportRows, setReportRows] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  // Tab: HOLIDAY state
  const [holidays, setHolidays] = useState([]);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    date: new Date().toISOString().split('T')[0],
    name: '',
    holiday_type: 'NATIONAL',
    is_paid: true,
  });

  // Sync selectedProjectId from Topbar
  useEffect(() => {
    if (selectedProjectId) {
      setMarkProjectFilter(String(selectedProjectId));
      setPaProjectFilter(String(selectedProjectId));
      setHistProjectFilter(String(selectedProjectId));
      setRepProjectFilter(String(selectedProjectId));
    }
  }, [selectedProjectId]);

  // Handle direct navigation state (e.g. from Project Details -> Site Attendance History)
  useEffect(() => {
    if (navState) {
      const targetSubTab = navState.subTab || 'history';
      const targetProjectId = navState.projectId ? String(navState.projectId) : 'ALL';
      const targetFromDate = navState.fromDate || '2020-01-01';
      const targetToDate = navState.toDate || todayStr;

      setActiveTab(targetSubTab);
      setHistProjectFilter(targetProjectId);
      setMarkProjectFilter(targetProjectId);
      setPaProjectFilter(targetProjectId);
      setRepProjectFilter(targetProjectId);
      setHistFromDate(targetFromDate);
      setHistToDate(targetToDate);
      setHistEmpFilter('ALL');

      if (targetSubTab === 'history') {
        fetchHistory({
          fromDate: targetFromDate,
          toDate: targetToDate,
          project: targetProjectId,
          employee: 'ALL',
        });
      }

      if (onClearNavState) {
        onClearNavState();
      }
    }
  }, [navState]);

  // Initial load - Fetch ALL employees without pagination cutoff
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [empRes, projRes, gangRes] = await Promise.all([
        api.workforce.listEmployees({ page_size: 1000 }).catch(() => []),
        api.projects.list({ page_size: 1000 }).catch(() => []),
        api.workforce.listLaborGroups({ page_size: 1000 }).catch(() => []),
      ]);

      const empList = Array.isArray(empRes) ? empRes : empRes.results || [];
      const projList = Array.isArray(projRes) ? projRes : projRes.results || [];
      const gangList = Array.isArray(gangRes) ? gangRes : gangRes.results || [];

      let scopedEmpList = isEmployeeLabour && currentEmpId
        ? empList.filter((e) => e.id === currentEmpId || String(e.id) === String(currentEmpId))
        : empList;

      if (isEmployeeLabour && scopedEmpList.length === 0 && user) {
        scopedEmpList = [
          {
            id: user.employee_id || 12,
            full_name: user.name || 'Harshil',
            employee_code: user.employee_code || 'EMP-0011',
            role: 'LABOUR',
            trade: 'HELPER',
            daily_rate: 500,
          },
        ];
      }

      setEmployees(scopedEmpList);
      setProjects(projList);
      setGangs(gangList);

      // Initialize workerConfigs with worker's allocated project and FULL shift
      const initialConfigs = {};
      empList.forEach((emp) => {
        const siteIds = new Set();
        if (emp.primary_project) siteIds.add(Number(emp.primary_project));
        if (Array.isArray(emp.assigned_projects)) {
          emp.assigned_projects.forEach((p) => {
            const id = typeof p === 'object' && p !== null ? p.id : p;
            if (id) siteIds.add(Number(id));
          });
        }
        if (Array.isArray(emp.assigned_projects_details)) {
          emp.assigned_projects_details.forEach((p) => {
            if (p?.id) siteIds.add(Number(p.id));
          });
        }
        const defaultProjId =
          emp.primary_project && siteIds.has(Number(emp.primary_project))
            ? Number(emp.primary_project)
            : (siteIds.size > 0 ? Array.from(siteIds)[0] : '');

        initialConfigs[emp.id] = {
          shift: 'FULL',
          projectId: defaultProjId,
        };
      });
      setWorkerConfigs(initialConfigs);
    } catch (err) {
      console.error('Failed to load initial data:', err);
      toast.error('Failed to load employee directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Fetch marked records for Tab 1 (MARK ATTENDANCE)
  const fetchMarkDateRecords = async () => {
    try {
      const params = { date: markDate, page_size: 1000 };
      if (markProjectFilter !== 'ALL') {
        params.project = markProjectFilter;
      }
      const res = await api.attendance.list(params);
      const list = Array.isArray(res) ? res : res.results || [];
      const map = {};
      list.forEach((r) => {
        map[r.employee] = {
          status: r.status,
          earning: r.earning,
          recordId: r.id,
          project: r.project,
          projectName: r.project_name,
          is_locked: r.is_locked,
        };
      });
      setTodayRecordsMap(map);
    } catch (err) {
      console.error('Error fetching marked records:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'mark') {
      fetchMarkDateRecords();
    }
  }, [markDate, markProjectFilter, activeTab]);

  // Fetch for Tab 2 (PRESENT & ABSENT)
  const fetchPresentAbsent = async () => {
    setPaLoading(true);
    try {
      const params = { date: paDate, page_size: 1000 };
      if (paProjectFilter !== 'ALL') params.project = paProjectFilter;
      if (isEmployeeLabour && currentEmpId) params.employee = currentEmpId;
      const res = await api.attendance.list(params).catch(() => []);
      let list = Array.isArray(res) ? res : res.results || [];
      if (isEmployeeLabour && currentEmpId) {
        list = list.filter(
          (r) =>
            r.employee === currentEmpId ||
            r.employee_id === currentEmpId ||
            String(r.employee) === String(currentEmpId)
        );
      }
      setPaRecords(list);
    } catch (err) {
      console.error('Error fetching present & absent:', err);
      toast.error('Failed to load attendance list.');
    } finally {
      setPaLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'present_absent') {
      fetchPresentAbsent();
    }
  }, [paDate, paProjectFilter, activeTab, currentEmpId]);

  // Fetch for Tab 3 (ATTENDANCE & HISTORY)
  const fetchHistory = async (overrideParams = null) => {
    setHistLoading(true);
    try {
      const fDate = overrideParams?.fromDate ?? histFromDate;
      const tDate = overrideParams?.toDate ?? histToDate;
      const pFilter = overrideParams?.project ?? histProjectFilter;
      const eFilter = isEmployeeLabour
        ? (currentEmpId ? String(currentEmpId) : 'ALL')
        : (overrideParams?.employee ?? histEmpFilter);

      const params = { date_from: fDate, date_to: tDate, page_size: 1000 };
      if (pFilter !== 'ALL') params.project = pFilter;
      if (eFilter !== 'ALL') params.employee = eFilter;

      const [listRes, sumRes] = await Promise.all([
        api.attendance.list(params).catch(() => []),
        api.attendance.summary(params).catch(() => null),
      ]);

      let list = Array.isArray(listRes) ? listRes : listRes.results || [];
      if (isEmployeeLabour && currentEmpId) {
        list = list.filter(
          (r) =>
            r.employee === currentEmpId ||
            r.employee_id === currentEmpId ||
            String(r.employee) === String(currentEmpId)
        );
      }
      const sortedList = [...list].sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        return (b.id || 0) - (a.id || 0);
      });
      setHistRecords(sortedList);
      const totalFullDays = sortedList.filter((r) => r.status === 'PRESENT').length;
      const totalHalfDays = sortedList.filter((r) => r.status === 'HALF_DAY').length;
      const totalAbsentDays = sortedList.filter((r) => r.status === 'ABSENT').length;
      const totalEarnedCalc = sortedList.reduce(
        (acc, r) => acc + (parseFloat(r.earning) || 0),
        0
      );
      setHistSummary({
        total_present: sumRes?.total_present ?? (totalFullDays + totalHalfDays),
        full_days: sumRes?.full_days ?? totalFullDays,
        half_days: sumRes?.half_days ?? totalHalfDays,
        total_absent: sumRes?.total_absent ?? totalAbsentDays,
        total_earnings: sumRes?.total_earnings ?? totalEarnedCalc,
      });
    } catch (err) {
      console.error('Error fetching history:', err);
      toast.error('Failed to load attendance history.');
    } finally {
      setHistLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [histFromDate, histToDate, histProjectFilter, histEmpFilter, activeTab, currentEmpId]);

  // Fetch for Tab 4 (ATTENDANCE REPORT)
  const fetchReport = async () => {
    setReportLoading(true);
    try {
      const eFilter = isEmployeeLabour
        ? (currentEmpId ? String(currentEmpId) : 'ALL')
        : repEmpFilter;
      const params = { date_from: repFromDate, date_to: repToDate, page_size: 1000 };
      if (repProjectFilter !== 'ALL') params.project = repProjectFilter;
      if (eFilter !== 'ALL') params.employee = eFilter;

      const res = await api.attendance.report(params).catch(() => ({ rows: [] }));
      let rows = res?.rows || [];
      if (rows.length === 0 && res.records && res.records.length > 0) {
        const empMap = {};
        employees.forEach((e) => {
          empMap[e.id] = {
            employee_id: e.id,
            id: e.id,
            employee_name: e.full_name || 'Worker',
            employee_code: e.employee_code || '',
            daily_wage: Number(e.daily_rate || 800),
            full_days: 0,
            half_days: 0,
            total_present: 0,
            total_absent: 0,
            total_earnings: 0,
          };
        });
        res.records.forEach((r) => {
          const item = empMap[r.employee];
          if (item) {
            if (r.status === 'PRESENT') {
              item.full_days++;
              item.total_present = (item.total_present || 0) + 1;
              item.total_attendance = (item.total_attendance || 0) + 1;
              item.total_earnings += item.daily_wage;
            } else if (r.status === 'HALF_DAY') {
              item.half_days++;
              item.total_present = (item.total_present || 0) + 0.5;
              item.total_attendance = (item.total_attendance || 0) + 0.5;
              item.total_earnings += item.daily_wage / 2;
            } else if (r.status === 'ABSENT') {
              item.total_absent++;
            }
          }
        });
        rows = Object.values(empMap);
      }
      if (isEmployeeLabour && currentEmpId && rows.length > 0) {
        rows = rows.filter(
          (r) =>
            r.employee_id === currentEmpId ||
            String(r.employee_id) === String(currentEmpId) ||
            r.id === currentEmpId
        );
      }
      setReportRows(rows);
    } catch (err) {
      console.error('Error fetching report:', err);
      toast.error('Failed to generate attendance report.');
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'report') {
      fetchReport();
    }
  }, [repFromDate, repToDate, repProjectFilter, repEmpFilter, activeTab, currentEmpId]);



  // Fetch for Tab 6 (HOLIDAY)
  const fetchHolidays = async () => {
    try {
      const res = await api.attendance.listHolidays({ page_size: 1000 });
      setHolidays(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.error('Error loading holidays:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'holiday') {
      fetchHolidays();
    }
  }, [activeTab]);

  // Helper: map trade to Role (KARIGAR vs LABOUR)
  const getRole = (trade) => {
    const t = (trade || '').toUpperCase();
    if (['MASON', 'CARPENTER', 'ELECTRICIAN', 'PLUMBER', 'WELDER'].includes(t)) {
      return 'KARIGAR';
    }
    return 'LABOUR';
  };

  // Helper: get avatar initial
  const getAvatarChar = (name) => {
    if (!name) return 'W';
    return name.trim().charAt(0);
  };

  // Helper: avatar background color palette
  const getAvatarBg = (id) => {
    const colors = [
      'bg-blue-600',
      'bg-indigo-600',
      'bg-emerald-600',
      'bg-amber-600',
      'bg-purple-600',
      'bg-cyan-600',
      'bg-rose-600',
    ];
    return colors[(id || 0) % colors.length];
  };

  // Helper: Get all registered/assigned project sites for a worker
  const getWorkerAssignedProjects = (emp) => {
    if (!emp) return [];
    const siteIds = new Set();
    if (emp.primary_project) {
      siteIds.add(Number(emp.primary_project));
    }
    if (Array.isArray(emp.assigned_projects)) {
      emp.assigned_projects.forEach((p) => {
        const id = typeof p === 'object' && p !== null ? p.id : p;
        if (id) siteIds.add(Number(id));
      });
    }
    if (Array.isArray(emp.assigned_projects_details)) {
      emp.assigned_projects_details.forEach((p) => {
        if (p?.id) siteIds.add(Number(p.id));
      });
    }
    return projects.filter((p) => siteIds.has(Number(p.id)));
  };

  // Dynamic project lists for each tab reflecting the selected/logged-in employee
  const markAvailableProjects = useMemo(() => {
    if (isEmployeeLabour && currentEmpId) {
      const emp = employees.find((e) => e.id === currentEmpId);
      return getWorkerAssignedProjects(emp);
    }
    return projects;
  }, [isEmployeeLabour, currentEmpId, employees, projects]);

  const paAvailableProjects = useMemo(() => {
    if (isEmployeeLabour && currentEmpId) {
      const emp = employees.find((e) => e.id === currentEmpId);
      return getWorkerAssignedProjects(emp);
    }
    return projects;
  }, [isEmployeeLabour, currentEmpId, employees, projects]);

  const histAvailableProjects = useMemo(() => {
    if (isEmployeeLabour && currentEmpId) {
      const emp = employees.find((e) => e.id === currentEmpId);
      return getWorkerAssignedProjects(emp);
    }
    if (histEmpFilter && histEmpFilter !== 'ALL') {
      const emp = employees.find((e) => String(e.id) === String(histEmpFilter));
      return getWorkerAssignedProjects(emp);
    }
    return projects;
  }, [isEmployeeLabour, currentEmpId, histEmpFilter, employees, projects]);

  const repAvailableProjects = useMemo(() => {
    if (isEmployeeLabour && currentEmpId) {
      const emp = employees.find((e) => e.id === currentEmpId);
      return getWorkerAssignedProjects(emp);
    }
    if (repEmpFilter && repEmpFilter !== 'ALL') {
      const emp = employees.find((e) => String(e.id) === String(repEmpFilter));
      return getWorkerAssignedProjects(emp);
    }
    return projects;
  }, [isEmployeeLabour, currentEmpId, repEmpFilter, employees, projects]);

  // Helper: Check if worker belongs to a project site
  const belongsToProject = (emp, projId) => {
    if (!projId || projId === 'ALL') return true;
    const targetId = Number(projId);
    const assigned = getWorkerAssignedProjects(emp);
    return assigned.some((p) => Number(p.id) === targetId);
  };

  // Helper: Get allocated project id for a worker (must be one of their assigned sites)
  const getAllocatedProjectId = (emp) => {
    if (!emp) return null;
    const assigned = getWorkerAssignedProjects(emp);
    if (assigned.length === 0) return null;

    if (markProjectFilter !== 'ALL') {
      const filterId = Number(markProjectFilter);
      return assigned.some((p) => Number(p.id) === filterId) ? filterId : null;
    }

    const cfg = workerConfigs[emp.id];
    if (cfg?.projectId) {
      const selectedId = Number(cfg.projectId);
      if (assigned.some((p) => Number(p.id) === selectedId)) {
        return selectedId;
      }
    }

    if (emp.primary_project && assigned.some((p) => Number(p.id) === Number(emp.primary_project))) {
      return Number(emp.primary_project);
    }
    return Number(assigned[0].id);
  };

  // Automatically update workerConfigs when a specific project site is chosen
  useEffect(() => {
    if (markProjectFilter !== 'ALL') {
      const targetProjId = Number(markProjectFilter);
      setWorkerConfigs((prev) => {
        const next = { ...prev };
        employees.forEach((emp) => {
          if (belongsToProject(emp, targetProjId)) {
            next[emp.id] = {
              ...(next[emp.id] || { shift: 'FULL' }),
              projectId: targetProjId,
            };
          }
        });
        return next;
      });
    }
  }, [markProjectFilter]);

  // TAB 1: Filtered workers
  const filteredMarkEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // 1. Search Query
      if (markSearch && markSearch.trim()) {
        const s = markSearch.trim().toLowerCase();
        const matchesName = (emp.full_name || '').toLowerCase().includes(s);
        const matchesCode = (emp.employee_code || '').toLowerCase().includes(s);
        const matchesPhone = (emp.phone || '').includes(s);
        const matchesTrade = (emp.trade || '').toLowerCase().includes(s);
        const matchesRole = (emp.role || '').toLowerCase().includes(s);
        if (!matchesName && !matchesCode && !matchesPhone && !matchesTrade && !matchesRole) {
          return false;
        }
      }

      // 2. Project Site Filter: when ANY project site is selected, display only workers of that site!
      if (markProjectFilter !== 'ALL') {
        if (!belongsToProject(emp, markProjectFilter)) {
          return false;
        }
      }

      // 3. Department / Role filter
      if (deptFilter !== 'ALL') {
        if (getRole(emp.trade) !== deptFilter) return false;
      }

      return true;
    });
  }, [employees, markSearch, markProjectFilter, deptFilter, workerConfigs]);

  // TAB 1: Selection toggle (requires project allocation)
  const handleToggleWorker = (id) => {
    const emp = employees.find((e) => e.id === id);
    if (!getAllocatedProjectId(emp)) {
      toast.error(
        `Project allocation is required for "${emp?.full_name || 'this worker'}" before attendance can be marked.`
      );
      return;
    }
    const next = new Set(selectedEmpIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedEmpIds(next);
  };

  const handleSelectAllWorkers = () => {
    const allocatedEmployees = filteredMarkEmployees.filter((e) =>
      Boolean(getAllocatedProjectId(e))
    );
    if (selectedEmpIds.size === allocatedEmployees.length && allocatedEmployees.length > 0) {
      setSelectedEmpIds(new Set());
    } else {
      const allIds = new Set(allocatedEmployees.map((e) => e.id));
      setSelectedEmpIds(allIds);
      if (allocatedEmployees.length < filteredMarkEmployees.length) {
        const unallocatedCount = filteredMarkEmployees.length - allocatedEmployees.length;
        toast.error(
          `${unallocatedCount} unallocated worker(s) excluded. Project allocation is required to mark attendance.`
        );
      }
    }
  };

  // TAB 1: Shift change (FULL / HALF / SPLIT)
  const handleShiftChange = (empId, shift) => {
    setWorkerConfigs((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        shift,
      },
    }));
  };

  // TAB 1: Project allocation change
  const handleProjectAllocChange = (empId, projId) => {
    setWorkerConfigs((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        projectId: projId ? Number(projId) : '',
      },
    }));
  };

  // TAB 1: Batch mark action (PRESENT or ABSENT)
  const handleBatchMark = async (targetStatus) => {
    const targets =
      selectedEmpIds.size > 0
        ? filteredMarkEmployees.filter((e) => selectedEmpIds.has(e.id))
        : filteredMarkEmployees;

    if (targets.length === 0) {
      toast.error('No workers available to mark attendance.');
      return;
    }

    // STRICT VALIDATION: Upcoming days are not allowed!
    if (markDate > todayStr) {
      toast.error(
        'Cannot mark attendance for upcoming days. Attendance can only be recorded for today or past dates.'
      );
      return;
    }

    // STRICT VALIDATION: Project allocation is required!
    const unallocated = targets.filter((emp) => !getAllocatedProjectId(emp));
    if (unallocated.length > 0) {
      if (unallocated.length === 1) {
        toast.error(
          `Project allocation is required for "${unallocated[0].full_name}". Attendance cannot be marked without an allocated project site.`
        );
      } else {
        toast.error(
          `Project allocation is required! ${unallocated.length} workers have no project site allocated.`
        );
      }
      return;
    }

    const targetProjId = markProjectFilter !== 'ALL' ? Number(markProjectFilter) : null;

    // Allow updating attendance unless record is locked
    const validTargets = targets.filter((emp) => {
      const rec = todayRecordsMap[emp.id];
      return !rec?.is_locked;
    });

    if (validTargets.length === 0) {
      toast.error('Attendance for selected worker(s) on this date is locked and cannot be changed.');
      return;
    }

    const recordsPayload = validTargets.map((emp) => {
      const cfg = workerConfigs[emp.id] || {};
      const statusToApply =
        targetStatus === 'PRESENT' && cfg.shift === 'HALF' ? 'HALF_DAY' : targetStatus;
      const allocatedProj = getAllocatedProjectId(emp);

      return {
        employee_id: emp.id,
        project_id: allocatedProj,
        status: statusToApply,
        ot_hours: '0.00',
      };
    });

    try {
      await api.attendance.batchMark({
        date: markDate,
        project_id: targetProjId,
        records: recordsPayload,
      });

      const siteName =
        markProjectFilter !== 'ALL'
          ? ` for site ${projects.find((p) => String(p.id) === String(markProjectFilter))?.name || ''}`
          : '';

      toast.success(
        `Successfully updated attendance for ${validTargets.length} worker(s) as ${targetStatus}${siteName} for ${markDate}!`
      );
      setSelectedEmpIds(new Set());
      await fetchMarkDateRecords();
    } catch (err) {
      console.error('Error batch marking:', err);
      toast.error(`Failed to mark attendance: ${err.message}`);
    }
  };

  // Quick action: Assign unassigned worker to the selected site
  const handleAssignWorkerToSite = async (empId) => {
    if (markProjectFilter === 'ALL') return;
    try {
      await api.workforce.assignProject(empId, Number(markProjectFilter));
      toast.success('Worker assigned to site successfully!');
      await loadInitialData();
    } catch (err) {
      console.error('Error assigning worker:', err);
      toast.error(`Failed to assign worker: ${err.message}`);
    }
  };

  // TAB 2: Delete single attendance record
  const handleDeleteAttendance = async (recordId, empName) => {
    if (!window.confirm(`Are you sure you want to remove attendance record for ${empName}?`)) {
      return;
    }
    try {
      await api.attendance.delete(recordId);
      toast.success('Attendance record removed.');
      if (activeTab === 'present_absent') fetchPresentAbsent();
      if (activeTab === 'history') fetchHistory();
      if (activeTab === 'mark') fetchMarkDateRecords();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(`Could not delete record: ${err.message}`);
    }
  };

  // TAB 2: Present and Absent calculations
  const activeEmployeeIds = useMemo(() => new Set(employees.map((e) => e.id)), [employees]);

  const presentRecords = useMemo(() => {
    if (employees.length === 0) return [];
    return paRecords.filter(
      (r) => (r.status === 'PRESENT' || r.status === 'HALF_DAY') && activeEmployeeIds.has(r.employee)
    );
  }, [paRecords, employees, activeEmployeeIds]);

  const absentRecords = useMemo(() => {
    if (employees.length === 0) return [];
    return paRecords.filter((r) => r.status === 'ABSENT' && activeEmployeeIds.has(r.employee));
  }, [paRecords, employees, activeEmployeeIds]);

  const activePaList = useMemo(() => {
    const baseList = paFilterType === 'PRESENT' ? presentRecords : absentRecords;
    if (!paSearch) return baseList;
    const s = paSearch.toLowerCase();
    return baseList.filter(
      (r) =>
        r.employee_name?.toLowerCase().includes(s) ||
        r.employee_code?.toLowerCase().includes(s) ||
        r.project_name?.toLowerCase().includes(s)
    );
  }, [paFilterType, presentRecords, absentRecords, paSearch]);

  // TAB 3: Export Excel handler
  const handleExportExcel = async () => {
    try {
      toast.loading('Generating Excel attendance export...', { id: 'export' });
      const headers = ['No.', 'Date', 'Employee', 'Role', 'Type', 'Project', 'Earning'];
      const rows = histRecords.map((r, i) => [
        i + 1,
        r.date,
        `"${r.employee_name || ''}"`,
        `"${r.employee_role || ''}"`,
        r.status === 'HALF_DAY' ? 'HALF DAY' : r.status,
        `"${r.project_name || ''}"`,
        r.earning || 0,
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Attendance_Logs_${histFromDate}_to_${histToDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Excel export generated and downloaded successfully!', { id: 'export' });
    } catch (err) {
      toast.error(`Export failed: ${err.message}`, { id: 'export' });
    }
  };

  // TAB 4: Print report handler
  const handlePrintReport = () => {
    window.print();
  };

  const selectedProjectObj = projects.find((p) => String(p.id) === String(markProjectFilter));

  return (
    <div className="space-y-6 pb-12">
      {/* =========================================================================
          TOP NAVIGATION TABS (ConstructPM Module Navigation)
          ========================================================================= */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-x-auto">
        <div className="flex items-center min-w-max px-4">
          {(isEmployeeLabour
            ? [
                { id: 'history', label: 'ATTENDANCE & HISTORY' },
                { id: 'report', label: 'ATTENDANCE REPORT' },
                { id: 'present_absent', label: 'PRESENT & ABSENT' },
              ]
            : [
                { id: 'mark', label: 'MARK ATTENDANCE' },
                { id: 'present_absent', label: 'PRESENT & ABSENT' },
                { id: 'history', label: 'ATTENDANCE & HISTORY' },
                { id: 'report', label: 'ATTENDANCE REPORT' },
                { id: 'salary', label: 'CREDIT SALARY' },
                { id: 'holiday', label: 'HOLIDAY' },
              ]
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-5 text-xs md:text-sm font-bold tracking-wider transition-all relative whitespace-nowrap cursor-pointer ${
                  isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.75 bg-blue-600 rounded-t-md" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          TAB 1: MARK ATTENDANCE (Screenshot 4)
          ========================================================================= */}
      {activeTab === 'mark' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 md:p-5 rounded-2xl shadow-xs border border-gray-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 md:gap-4 flex-1">
              {/* Selected Date */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold tracking-wider uppercase text-gray-500">
                  SELECTED DATE
                </span>
                <div className="relative flex flex-col">
                  <input
                    type="date"
                    value={markDate}
                    max={todayStr}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val > todayStr) {
                        toast.error(
                          'Upcoming dates are not allowed. You can only mark past or present attendance.'
                        );
                        setMarkDate(todayStr);
                        return;
                      }
                      setMarkDate(val);
                    }}
                    className={`border rounded-lg px-3 py-2 text-sm font-medium shadow-2xs w-40 cursor-pointer ${
                      isFutureMarkDate
                        ? 'border-rose-400 bg-rose-50 text-rose-800'
                        : 'border-gray-200 text-gray-800 focus:outline-none focus:border-blue-500'
                    }`}
                  />
                  {isFutureMarkDate && (
                    <span className="text-[10px] text-rose-600 font-bold mt-0.5">
                      Upcoming dates not allowed
                    </span>
                  )}
                </div>
              </div>

              {/* Project Filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold tracking-wider uppercase text-gray-500">
                  PROJECT FILTER
                </span>
                <div className="relative">
                  <select
                    value={markProjectFilter}
                    onChange={(e) => setMarkProjectFilter(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-800 focus:outline-none focus:border-blue-500 shadow-2xs bg-white min-w-48 appearance-none cursor-pointer"
                  >
                    <option value="ALL">
                      {isEmployeeLabour ? 'All My Assigned Projects' : `All Projects (${employees.length} Workers)`}
                    </option>
                    {markAvailableProjects.map((p) => {
                      const count = employees.filter((e) => belongsToProject(e, p.id)).length;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} ({count} Workers)
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown
                    size={15}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Search Employee */}
              <div className="flex flex-col gap-1 flex-1 min-w-56">
                <span className="text-[11px] font-bold tracking-wider uppercase text-gray-500">
                  SEARCH EMPLOYEE
                </span>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Search by name, ID or phone..."
                    value={markSearch}
                    onChange={(e) => setMarkSearch(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                  {markSearch && (
                    <button
                      type="button"
                      onClick={() => setMarkSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Clear search"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons: Present, Absent, Department */}
            <div className="flex items-center gap-2.5 self-end lg:self-center mt-2 lg:mt-0">
              <button
                type="button"
                disabled={isFutureMarkDate}
                onClick={() => handleBatchMark('PRESENT')}
                title={
                  isFutureMarkDate
                    ? 'Cannot mark attendance for upcoming dates'
                    : 'Mark selected / all workers present'
                }
                className={`font-bold text-xs md:text-sm px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm transition ${
                  isFutureMarkDate
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white cursor-pointer'
                }`}
              >
                <Check size={16} strokeWidth={2.5} />
                <span>PRESENT</span>
              </button>

              <button
                type="button"
                disabled={isFutureMarkDate}
                onClick={() => handleBatchMark('ABSENT')}
                title={
                  isFutureMarkDate
                    ? 'Cannot mark attendance for upcoming dates'
                    : 'Mark selected / all workers absent'
                }
                className={`font-bold text-xs md:text-sm px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm transition ${
                  isFutureMarkDate
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white cursor-pointer'
                }`}
              >
                <X size={16} strokeWidth={2.5} />
                <span>ABSENT</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDeptModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs md:text-sm px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Building2 size={16} />
                <span>DEPARTMENT</span>
              </button>
            </div>
          </div>

          {/* Sub-header Filter State Indicator */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1 text-xs text-gray-600">
            <div className="flex items-center gap-2 flex-wrap">
              {markProjectFilter === 'ALL' ? (
                <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-800 px-3 py-1 rounded-lg font-semibold">
                  <Users size={14} className="text-blue-600" />
                  Showing All Workforce ({filteredMarkEmployees.length} Workers across all sites)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-900 border border-blue-200 px-3 py-1 rounded-lg font-semibold">
                  <Building2 size={14} className="text-blue-600" />
                  Site: <strong>{selectedProjectObj?.name}</strong> ({filteredMarkEmployees.length} Workers Assigned)
                </span>
              )}

              {markSearch && (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg text-xs font-medium">
                  Search: "{markSearch}"
                  <button onClick={() => setMarkSearch('')} className="ml-1 hover:text-amber-950 font-bold">
                    ✕
                  </button>
                </span>
              )}
            </div>

            {markProjectFilter !== 'ALL' && (
              <button
                onClick={() => setIsAssignModalOpen(true)}
                className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer transition text-xs"
              >
                <UserPlus size={14} />
                <span>Assign More Workers to this Site</span>
              </button>
            )}
          </div>

          {/* Table of Workers */}
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-500">Loading workforce roll call...</div>
            ) : filteredMarkEmployees.length === 0 ? (
              <div className="p-12 text-center text-gray-500 space-y-3">
                <p>No employees match the current filter.</p>
                {markProjectFilter !== 'ALL' && (
                  <button
                    onClick={() => setIsAssignModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    <Plus size={14} />
                    <span>Assign Workers to {selectedProjectObj?.name}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-400 text-xs uppercase tracking-wider font-semibold">
                      <th className="py-4 px-5 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={
                            selectedEmpIds.size > 0 &&
                            selectedEmpIds.size === filteredMarkEmployees.length
                          }
                          onChange={handleSelectAllWorkers}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                        />
                      </th>
                      <th className="py-4 px-4">EMPLOYEE</th>
                      <th className="py-4 px-4 text-center">STATUS</th>
                      <th className="py-4 px-4 text-center">SHIFT</th>
                      <th className="py-4 px-4">PROJECT ALLOCATION</th>
                      <th className="py-4 px-4 text-right">EARNING</th>
                      <th className="py-4 px-4 text-center w-20">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredMarkEmployees.map((emp) => {
                      const isSelected = selectedEmpIds.has(emp.id);
                      const markedInfo = todayRecordsMap[emp.id];
                      const cfg = workerConfigs[emp.id] || {
                        shift: 'FULL',
                        projectId: emp.primary_project,
                      };
                      const allocatedProjId = getAllocatedProjectId(emp);
                      const roleName = getRole(emp.trade);
                      const rate = Number(emp.daily_rate || 800);

                      // Calculate earning preview
                      let earningAmount = rate;
                      if (cfg.shift === 'HALF') earningAmount = rate * 0.5;
                      if (markedInfo && markedInfo.status === 'ABSENT') earningAmount = 0;

                      return (
                        <tr
                          key={emp.id}
                          className={`hover:bg-gray-50/80 transition-colors ${
                            isSelected ? 'bg-blue-50/30' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-4 px-5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!allocatedProjId || !!markedInfo}
                              onChange={() => handleToggleWorker(emp.id)}
                              className={`w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 ${
                                !allocatedProjId || markedInfo
                                  ? 'opacity-40 cursor-not-allowed'
                                  : 'cursor-pointer'
                              }`}
                              title={
                                markedInfo
                                  ? 'Attendance already marked for this date and cannot be changed'
                                  : !allocatedProjId
                                  ? 'Project allocation is required before selecting this worker'
                                  : 'Select worker'
                              }
                            />
                          </td>

                          {/* Employee */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-2xs ${getAvatarBg(
                                  emp.id
                                )}`}
                              >
                                {getAvatarChar(emp.full_name)}
                              </div>
                              <div>
                                <div className="text-gray-900 font-bold text-sm">
                                  {emp.full_name}
                                </div>
                                <div className="text-[11px] text-gray-500 font-semibold tracking-wide uppercase">
                                  {roleName} • {emp.employee_code || `ID: ${emp.id}`}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4 text-center">
                            {markedInfo ? (
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${
                                  markedInfo.status === 'PRESENT'
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                    : markedInfo.status === 'HALF_DAY'
                                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                    : 'bg-rose-50 text-rose-600 border border-rose-200'
                                }`}
                              >
                                {markedInfo.status === 'HALF_DAY' ? 'HALF DAY' : markedInfo.status}
                              </span>
                            ) : (
                              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-amber-50 text-amber-600 border border-amber-200">
                                PENDING
                              </span>
                            )}
                          </td>

                          {/* Shift (Segment Buttons) */}
                          <td className="py-4 px-4 text-center">
                            <div className="inline-flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                              {['FULL', 'HALF'].map((s) => {
                                const isCurrentShift = cfg.shift === s;
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    disabled={!!markedInfo}
                                    onClick={() => handleShiftChange(emp.id, s)}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                                      markedInfo
                                        ? 'cursor-not-allowed opacity-60'
                                        : 'cursor-pointer'
                                    } ${
                                      isCurrentShift
                                        ? 'bg-blue-600 text-white shadow-2xs'
                                        : 'text-gray-500 hover:text-gray-800'
                                    }`}
                                  >
                                    {s}
                                  </button>
                                );
                              })}
                            </div>
                          </td>

                          {/* Project Allocation */}
                          <td className="py-4 px-4">
                            {(() => {
                              const assignedSites = getWorkerAssignedProjects(emp);

                              // 1. If already marked today, show marked site badge
                              if (markedInfo) {
                                return (
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <Building2 size={13} className="text-emerald-600 shrink-0" />
                                    <span>{markedInfo.projectName || 'Marked Site'}</span>
                                  </div>
                                );
                              }

                              // 2. If filtered by a specific project site at top
                              if (markProjectFilter !== 'ALL') {
                                return (
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    <Building2 size={13} className="text-blue-600 shrink-0" />
                                    <span>
                                      {projects.find((p) => String(p.id) === String(markProjectFilter))?.name ||
                                        'Allocated Site'}
                                    </span>
                                  </div>
                                );
                              }

                              // 3. If worker has NO assigned sites registered
                              if (assignedSites.length === 0) {
                                return (
                                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    <AlertCircle size={12} className="text-amber-500 shrink-0" />
                                    <span>No Assigned Sites</span>
                                  </div>
                                );
                              }

                              // 4. If worker has ONLY 1 assigned site registered:
                              if (assignedSites.length === 1) {
                                return (
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-800 border border-gray-200">
                                    <Building2 size={13} className="text-gray-500 shrink-0" />
                                    <span className="font-bold">{assignedSites[0].name}</span>
                                  </div>
                                );
                              }

                              // 5. If worker has MULTIPLE assigned sites registered:
                              // Show ONLY the sites where this employee is registered for work!
                              return (
                                <div className="relative inline-block w-56">
                                  <select
                                    value={allocatedProjId || ''}
                                    onChange={(e) => handleProjectAllocChange(emp.id, e.target.value)}
                                    className="w-full border border-blue-200 bg-white rounded-lg px-3 py-1.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 appearance-none pr-7 shadow-2xs cursor-pointer hover:border-blue-400"
                                  >
                                    {assignedSites.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} {emp.primary_project && Number(emp.primary_project) === Number(p.id) ? ' (Primary)' : ''}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown
                                    size={14}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                  />
                                  <div className="text-[10px] text-blue-600 font-semibold mt-0.5">
                                    Choose 1 of {assignedSites.length} assigned sites
                                  </div>
                                </div>
                              );
                            })()}
                          </td>

                          {/* Earning */}
                          <td className="py-4 px-4 text-right">
                            <div className="font-extrabold text-sm text-gray-900">
                              ₹{earningAmount.toLocaleString('en-IN')}
                            </div>
                            <div
                              className={`text-[10px] font-bold tracking-wider uppercase ${
                                markedInfo && markedInfo.status !== 'ABSENT'
                                  ? 'text-emerald-600'
                                  : 'text-amber-500'
                              }`}
                            >
                              {markedInfo && markedInfo.status !== 'ABSENT'
                                ? 'CONFIRMED'
                                : 'PENDING'}
                            </div>
                          </td>

                          {/* Action Column */}
                          <td className="py-4 px-4 text-center">
                            {markedInfo ? (
                              <div className="flex items-center justify-center gap-1.5">
                                {markedInfo.is_locked ? (
                                  <span
                                    title="Attendance recorded and locked for this date"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200"
                                  >
                                    <Lock size={12} className="text-emerald-600 shrink-0" />
                                    Locked
                                  </span>
                                ) : (
                                  <>
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                        markedInfo.status === 'PRESENT'
                                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                                          : markedInfo.status === 'HALF_DAY'
                                          ? 'text-blue-700 bg-blue-50 border border-blue-200'
                                          : 'text-rose-700 bg-rose-50 border border-rose-200'
                                      }`}
                                    >
                                      {markedInfo.status === 'HALF_DAY' ? 'HALF DAY' : markedInfo.status}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAttendance(markedInfo.recordId, emp.full_name)}
                                      className="p-1 text-gray-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="Remove attendance record"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs font-semibold">—</span>
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
        </div>
      )}

      {/* =========================================================================
          TAB 2: PRESENT & ABSENT (Screenshot 1)
          ========================================================================= */}
      {activeTab === 'present_absent' && (
        <div className="space-y-4">
          {/* Top Stat Cards Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            {/* TODAY'S PRESENT Button Card */}
            <button
              onClick={() => setPaFilterType('PRESENT')}
              className={`flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm tracking-wide transition shadow-xs cursor-pointer ${
                paFilterType === 'PRESENT'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Calendar size={18} />
              <span>TODAY'S PRESENT ({presentRecords.length})</span>
            </button>

            {/* TODAY'S ABSENT Button Card */}
            <button
              onClick={() => setPaFilterType('ABSENT')}
              className={`flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm tracking-wide transition shadow-xs cursor-pointer ${
                paFilterType === 'ABSENT'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Calendar size={18} />
              <span>TODAY'S ABSENT ({absentRecords.length})</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex flex-wrap items-center gap-4">
            {/* Search Employee */}
            <div className="flex flex-col gap-1 flex-1 min-w-56">
              <span className="text-[11px] font-bold tracking-wider uppercase text-gray-500">
                SEARCH EMPLOYEE
              </span>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={paSearch}
                  onChange={(e) => setPaSearch(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Select Date */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold tracking-wider uppercase text-gray-500">
                SELECT DATE
              </span>
              <div className="relative">
                <input
                  type="date"
                  value={paDate}
                  max={todayStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val > todayStr) {
                      toast.error('Upcoming dates are not allowed.');
                      setPaDate(todayStr);
                      return;
                    }
                    setPaDate(val);
                  }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-800 focus:outline-none focus:border-blue-500 shadow-2xs w-44 cursor-pointer"
                />
              </div>
            </div>

            {/* Project */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold tracking-wider uppercase text-gray-500">
                PROJECT
              </span>
              <div className="relative">
                <select
                  value={paProjectFilter}
                  onChange={(e) => setPaProjectFilter(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-800 focus:outline-none focus:border-blue-500 shadow-2xs bg-white min-w-44 appearance-none"
                >
                  <option value="ALL">
                    {isEmployeeLabour ? 'All My Assigned Projects' : 'All Projects'}
                  </option>
                  {paAvailableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            </div>
          </div>

          {/* Table with Warm Beige/Cream Header */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
            {paLoading ? (
              <div className="p-12 text-center text-gray-500">Loading attendance...</div>
            ) : activePaList.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No {paFilterType.toLowerCase()} records found for this date and filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#EFE8DC] border-b border-[#DDD2C0] text-gray-900 text-xs font-black uppercase tracking-wider">
                      <th className="py-3.5 px-5 w-16">NO.</th>
                      <th className="py-3.5 px-5">EMPLOYEE</th>
                      <th className="py-3.5 px-5">ROLE</th>
                      <th className="py-3.5 px-5">PROJECT</th>
                      <th className="py-3.5 px-5">ATTENDANCE STATUS</th>
                      <th className="py-3.5 px-5 text-right w-24">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {activePaList.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        {/* No. */}
                        <td className="py-4 px-5 text-gray-700 font-bold text-sm">{idx + 1}.</td>

                        {/* Employee */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${getAvatarBg(
                                r.employee
                              )}`}
                            >
                              {getAvatarChar(r.employee_name)}
                            </div>
                            <div>
                              <div className="text-gray-900 font-bold text-sm">
                                {r.employee_name}
                              </div>
                              <div className="text-[11px] text-gray-500 font-medium">
                                ID: {r.employee_code || r.employee}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-4 px-5 text-xs font-bold text-gray-800 tracking-wide uppercase">
                          {r.employee_role || 'KARIGAR'}
                        </td>

                        {/* Project */}
                        <td className="py-4 px-5 text-sm font-semibold text-gray-800">
                          {r.project_name || `Project #${r.project}`}
                        </td>

                        {/* Attendance Status */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase ${
                                r.status === 'PRESENT'
                                  ? 'bg-emerald-600 text-white'
                                  : r.status === 'HALF_DAY'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-rose-600 text-white'
                              }`}
                            >
                              {r.status === 'HALF_DAY' ? 'HALF DAY' : r.status}
                            </span>
                            <span className="text-xs text-gray-600 font-semibold uppercase">
                              {r.status === 'HALF_DAY' ? 'HALF DAY' : r.status === 'ABSENT' ? 'ABSENT' : 'FULL DAY'}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right">
                          {isEmployeeLabour ? (
                            <span className="text-xs text-gray-400 font-semibold">Read-only</span>
                          ) : r.is_locked ? (
                            <span
                              className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 font-bold text-[11px] px-2.5 py-1 rounded-lg"
                              title="Attendance record is permanent and locked for this day"
                            >
                              <Lock size={12} className="text-emerald-600" />
                              <span>Locked</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteAttendance(r.id, r.employee_name)}
                              className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-bold text-xs px-2.5 py-1 rounded-lg hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                              title="Delete or clear this attendance record"
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
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

      {/* =========================================================================
          TAB 3: ATTENDANCE & HISTORY (Screenshot 2)
          ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Header row with title and Export Excel */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">Attendance Logs</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Review and manage historical attendance records
              </p>
            </div>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold px-4 py-2 rounded-lg text-sm shadow-2xs transition cursor-pointer"
            >
              <Download size={16} />
              <span>Export Excel</span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* From Date */}
            <div>
              <label className="text-[11px] font-bold tracking-wider uppercase text-gray-500 block mb-1">
                FROM DATE
              </label>
              <input
                type="date"
                max={todayStr}
                value={histFromDate}
                onChange={(e) => setHistFromDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 shadow-2xs cursor-pointer"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="text-[11px] font-bold tracking-wider uppercase text-gray-500 block mb-1">
                TO DATE
              </label>
              <input
                type="date"
                max={todayStr}
                value={histToDate}
                onChange={(e) => setHistToDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 shadow-2xs cursor-pointer"
              />
            </div>

            {/* Employee */}
            <div>
              <label className="text-[11px] font-bold tracking-wider uppercase text-gray-500 block mb-1">
                EMPLOYEE
              </label>
              <select
                value={histEmpFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setHistEmpFilter(val);
                  if (val !== 'ALL') {
                    const targetEmp = employees.find((emp) => String(emp.id) === String(val));
                    const assigned = getWorkerAssignedProjects(targetEmp);
                    if (!assigned.some((p) => String(p.id) === String(histProjectFilter))) {
                      setHistProjectFilter('ALL');
                    }
                  }
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white shadow-2xs"
              >
                <option value="ALL">All Employees</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} ({e.employee_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Project */}
            <div>
              <label className="text-[11px] font-bold tracking-wider uppercase text-gray-500 block mb-1">
                PROJECT
              </label>
              <select
                value={histProjectFilter}
                onChange={(e) => setHistProjectFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white shadow-2xs"
              >
                <option value="ALL">
                  {histEmpFilter !== 'ALL' || isEmployeeLabour ? 'All Assigned Projects' : 'All Projects'}
                </option>
                {histAvailableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 5 Summary Metric Cards in Horizontal Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* 1. TOTAL PRESENT */}
            <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 md:p-5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-blue-600 block">
                TOTAL PRESENT
              </span>
              <div className="text-2xl md:text-3xl font-black text-blue-900 mt-2">
                {histSummary?.total_present ?? ((histSummary?.full_days || 0) + (histSummary?.half_days || 0))}
              </div>
            </div>

            {/* 2. FULL DAYS */}
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 md:p-5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-600 block">
                FULL DAYS
              </span>
              <div className="text-2xl md:text-3xl font-black text-emerald-900 mt-2">
                {histSummary?.full_days ?? 0}
              </div>
            </div>

            {/* 3. HALF DAYS */}
            <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-4 md:p-5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-amber-600 block">
                HALF DAYS
              </span>
              <div className="text-2xl md:text-3xl font-black text-amber-900 mt-2">
                {histSummary?.half_days ?? 0}
              </div>
            </div>

            {/* 4. TOTAL ABSENT */}
            <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-4 md:p-5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-rose-600 block">
                TOTAL ABSENT
              </span>
              <div className="text-2xl md:text-3xl font-black text-rose-900 mt-2">
                {histSummary?.total_absent ?? 0}
              </div>
            </div>

            {/* 5. TOTAL EARNINGS */}
            <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4 md:p-5 col-span-2 md:col-span-1">
              <span className="text-[11px] font-bold tracking-wider uppercase text-purple-600 block">
                TOTAL EARNINGS
              </span>
              <div className="text-2xl md:text-3xl font-black text-purple-900 mt-2">
                ₹{Number(histSummary?.total_earnings ?? 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Table with Warm Beige/Cream Header */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
            {histLoading ? (
              <div className="p-12 text-center text-gray-500">Loading attendance history...</div>
            ) : histRecords.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No attendance logs found for this date range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#EFE8DC] border-b border-[#DDD2C0] text-gray-900 text-xs font-black uppercase tracking-wider">
                      <th className="py-3.5 px-5 w-16">NO.</th>
                      <th className="py-3.5 px-5">DATE</th>
                      <th className="py-3.5 px-5">EMPLOYEE</th>
                      <th className="py-3.5 px-5">TYPE</th>
                      <th className="py-3.5 px-5">PROJECT(S)</th>
                      <th className="py-3.5 px-5">EARNING</th>
                      <th className="py-3.5 px-5 text-right w-20">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {histRecords.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        {/* No. */}
                        <td className="py-4 px-5 text-gray-700 font-bold text-sm">{idx + 1}</td>

                        {/* Date */}
                        <td className="py-4 px-5 text-gray-700 font-bold text-sm">
                          {r.date
                            ? `${r.date.split('-')[2]}/${r.date.split('-')[1]}/${
                                r.date.split('-')[0]
                              }`
                            : r.date}
                        </td>

                        {/* Employee */}
                        <td className="py-4 px-5 text-gray-900 font-bold text-sm">
                          {r.employee_name}
                        </td>

                        {/* Type */}
                        <td className="py-4 px-5">
                          {r.status === 'HALF_DAY' ? (
                            <span className="inline-block bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs px-2.5 py-1 rounded-md uppercase tracking-wider">
                              HALF DAY
                            </span>
                          ) : r.status === 'ABSENT' ? (
                            <span className="inline-block bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs px-2.5 py-1 rounded-md uppercase tracking-wider">
                              ABSENT
                            </span>
                          ) : (
                            <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs px-2.5 py-1 rounded-md uppercase tracking-wider">
                              FULL DAY
                            </span>
                          )}
                        </td>

                        {/* Project(s) */}
                        <td className="py-4 px-5 text-sm font-semibold text-gray-800">
                          <span className="text-blue-500 mr-1.5">•</span>
                          {r.project_name || 'Project'} (1)
                        </td>

                        {/* Earning */}
                        <td className="py-4 px-5">
                          {r.status === 'ABSENT' || Number(r.earning || 0) === 0 ? (
                            <span className="inline-block bg-gray-100 text-gray-500 font-bold text-xs px-3 py-1 rounded-md">
                              ₹0 (Unpaid)
                            </span>
                          ) : (
                            <span className="inline-block bg-emerald-100/80 text-emerald-800 font-bold text-xs px-3 py-1 rounded-md">
                              ₹{Number(r.earning || 0).toLocaleString('en-IN')}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right">
                          {isEmployeeLabour ? (
                            <span className="text-xs text-gray-400 font-semibold">Read-only</span>
                          ) : r.is_locked ? (
                            <span
                              className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 font-bold text-[11px] px-2.5 py-1 rounded-lg"
                              title="Attendance is locked and approved"
                            >
                              <Lock size={12} className="text-emerald-600" />
                              <span>Locked</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteAttendance(r.id, r.employee_name)}
                              className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-bold text-xs px-2.5 py-1 rounded-lg hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                              title="Delete or clear this attendance record"
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
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

      {/* =========================================================================
          TAB 4: ATTENDANCE REPORT (Screenshot 3)
          ========================================================================= */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* From Date */}
            <div>
              <label className="text-[11px] font-bold tracking-wider uppercase text-gray-500 block mb-1">
                FROM DATE
              </label>
              <input
                type="date"
                max={todayStr}
                value={repFromDate}
                onChange={(e) => setRepFromDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 shadow-2xs cursor-pointer"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="text-[11px] font-bold tracking-wider uppercase text-gray-500 block mb-1">
                TO DATE
              </label>
              <input
                type="date"
                max={todayStr}
                value={repToDate}
                onChange={(e) => setRepToDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 shadow-2xs cursor-pointer"
              />
            </div>

            {/* Employee */}
            <div>
              <label className="text-[11px] font-bold tracking-wider uppercase text-gray-500 block mb-1">
                EMPLOYEE
              </label>
              <select
                value={repEmpFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setRepEmpFilter(val);
                  if (val !== 'ALL') {
                    const targetEmp = employees.find((emp) => String(emp.id) === String(val));
                    const assigned = getWorkerAssignedProjects(targetEmp);
                    if (!assigned.some((p) => String(p.id) === String(repProjectFilter))) {
                      setRepProjectFilter('ALL');
                    }
                  }
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white shadow-2xs"
              >
                <option value="ALL">All Employees</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} ({e.employee_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Project */}
            <div>
              <label className="text-[11px] font-bold tracking-wider uppercase text-gray-500 block mb-1">
                PROJECT
              </label>
              <select
                value={repProjectFilter}
                onChange={(e) => setRepProjectFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white shadow-2xs"
              >
                <option value="ALL">
                  {repEmpFilter !== 'ALL' || isEmployeeLabour ? 'All Assigned Projects' : 'All Projects'}
                </option>
                {repAvailableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Heading and Print Action */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
              ATTENDANCE REPORT
            </h2>
            <button
              onClick={handlePrintReport}
              className="inline-flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 font-bold px-4 py-2 rounded-lg text-sm shadow-2xs transition cursor-pointer"
            >
              <Printer size={16} />
              <span>Print Report</span>
            </button>
          </div>

          {/* Printable Formal Report Document Card */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-300 overflow-hidden">
            {/* Big Blue Header Bar */}
            <div className="bg-[#1E3A8A] text-white text-center py-4 px-6 font-black tracking-widest text-lg md:text-xl uppercase">
              ATTENDANCE REPORT
            </div>

            {/* Sub-header Banner */}
            <div className="bg-gray-100 border-b border-gray-200 py-3 px-6 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-gray-700 uppercase">
              <div>
                PROJECT:{' '}
                <span className="font-black text-gray-900">
                  {repProjectFilter === 'ALL'
                    ? 'ALL PROJECTS'
                    : projects.find((p) => String(p.id) === String(repProjectFilter))?.name ||
                      'SELECTED PROJECT'}
                </span>
              </div>
              <div>
                DATE RANGE:{' '}
                <span className="font-black text-gray-900">
                  {repFromDate} To {repToDate}
                </span>
              </div>
              <div>
                PAGE <span className="font-black text-gray-900">1 OF 1</span>
              </div>
            </div>

            {/* Report Table */}
            {reportLoading ? (
              <div className="p-12 text-center text-gray-500">Generating report...</div>
            ) : reportRows.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No attendance activity recorded for this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#EFE8DC] border-b border-[#DDD2C0] text-gray-900 text-xs font-black uppercase tracking-wider">
                      <th className="py-3.5 px-6">EMPLOYEE NAME</th>
                      <th className="py-3.5 px-6">DAILY WAGE</th>
                      <th className="py-3.5 px-6">TOTAL ATTENDANCE</th>
                      <th className="py-3.5 px-6">TOTAL EARNINGS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportRows.map((row) => {
                      const totalDays = Number(
                        row.total_attendance !== undefined
                          ? row.total_attendance
                          : (Number(row.full_days || 0) + Number(row.half_days || 0) * 0.5)
                      );
                      const formattedDays = totalDays % 1 === 0 ? totalDays : totalDays.toFixed(1);

                      return (
                        <tr key={row.employee_id || row.id} className="hover:bg-gray-50 transition-colors">
                          {/* Employee Name */}
                          <td className="py-4 px-6">
                            <div className="text-gray-900 font-bold text-sm">
                              {row.employee_name}
                            </div>
                            {row.employee_code && (
                              <div className="text-[11px] text-gray-500 font-medium mt-0.5">
                                {row.employee_code}
                              </div>
                            )}
                          </td>

                          {/* Daily Wage */}
                          <td className="py-4 px-6 font-bold text-sm text-gray-900">
                            ₹{Number(row.daily_wage || 0).toLocaleString('en-IN')}
                          </td>

                          {/* Total Attendance */}
                          <td className="py-4 px-6 font-bold text-sm text-gray-900">
                            {formattedDays}
                          </td>

                          {/* Total Earnings */}
                          <td className="py-4 px-6">
                            <span className="inline-block bg-emerald-100 text-emerald-800 font-extrabold text-sm px-4 py-1.5 rounded-md">
                              ₹{Number(row.total_earnings || 0).toLocaleString('en-IN')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Total Earnings & Attendance at the end of table */}
                  {reportRows.length > 0 && (() => {
                    const totalAttendanceSum = reportRows.reduce(
                      (sum, r) =>
                        sum +
                        Number(
                          r.total_attendance !== undefined
                            ? r.total_attendance
                            : (Number(r.full_days || 0) + Number(r.half_days || 0) * 0.5)
                        ),
                      0
                    );
                    const formattedAttendanceSum =
                      totalAttendanceSum % 1 === 0 ? totalAttendanceSum : totalAttendanceSum.toFixed(1);

                    return (
                      <tfoot className="border-t-2 border-gray-300 bg-gray-50/90">
                        <tr className="text-gray-900 font-black">
                          <td className="py-4 px-6 text-sm font-black uppercase tracking-wider text-gray-800">
                            TOTAL
                          </td>
                          <td className="py-4 px-6 text-sm font-bold text-gray-400">
                            —
                          </td>
                          <td className="py-4 px-6 text-sm font-black text-gray-900">
                            {formattedAttendanceSum}
                          </td>
                          <td className="py-4 px-6">
                            <span className="inline-block bg-emerald-600 text-white font-extrabold text-sm px-4 py-1.5 rounded-md shadow-xs">
                              ₹
                              {reportRows
                                .reduce((sum, r) => sum + Number(r.total_earnings || 0), 0)
                                .toLocaleString('en-IN')}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>
            )}
          </div>
        </div>
      )}



      {/* =========================================================================
          TAB 6: HOLIDAY
          ========================================================================= */}
      {activeTab === 'holiday' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-gray-900">Calendar Holidays</h2>
              <p className="text-sm text-gray-500">
                Official paid site closures and national festival holidays
              </p>
            </div>
            {['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'].includes(role) && (
              <button
                onClick={() => setIsHolidayModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-2 rounded-lg flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Plus size={16} />
                <span>Add Holiday</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
            {holidays.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No holidays recorded yet. Add your first holiday above.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#EFE8DC] border-b border-[#DDD2C0] text-gray-900 text-xs font-black uppercase tracking-wider">
                    <th className="py-3.5 px-6">DATE</th>
                    <th className="py-3.5 px-6">HOLIDAY NAME</th>
                    <th className="py-3.5 px-6">TYPE</th>
                    <th className="py-3.5 px-6">PAYMENT STATUS</th>
                    <th className="py-3.5 px-6 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {holidays.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6 text-gray-900 font-bold text-sm">{h.date}</td>
                      <td className="py-4 px-6 text-gray-900 font-bold text-sm">{h.name}</td>
                      <td className="py-4 px-6 text-xs font-bold text-gray-600 uppercase">
                        {h.holiday_type}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            h.is_paid
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {h.is_paid ? 'Paid Holiday' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'].includes(role) ? (
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Delete holiday ${h.name}?`)) return;
                              try {
                                await api.attendance.deleteHoliday(h.id);
                                toast.success('Holiday removed');
                                fetchHolidays();
                              } catch (err) {
                                toast.error(`Error: ${err.message}`);
                              }
                            }}
                            className="w-8 h-8 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-500 inline-flex items-center justify-center transition cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 7: CREDIT SALARY
          ========================================================================= */}
      {activeTab === 'salary' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black text-gray-900">Credit Salary & Wage Balances</h2>
            <p className="text-sm text-gray-500">
              Synchronize daily earned labor wages with the payroll disbursement ledger
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
              <span className="text-xs font-bold tracking-wider uppercase text-gray-500">
                TOTAL ATTENDANCE RECORDED
              </span>
              <div className="text-3xl font-black text-gray-900 mt-2">
                {histSummary?.total_present ?? 0} Days
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Verified attendance across all active sites
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
              <span className="text-xs font-bold tracking-wider uppercase text-emerald-600">
                TOTAL ACCRUED WAGES
              </span>
              <div className="text-3xl font-black text-emerald-700 mt-2">
                ₹{Number(histSummary?.total_earnings ?? 0).toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-gray-500 mt-1">Gross daily wages calculated</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold tracking-wider uppercase text-blue-600">
                  PAYROLL LEDGER STATUS
                </span>
                <div className="text-lg font-bold text-gray-800 mt-2">Ready to Disburse</div>
                <p className="text-xs text-gray-500 mt-1">Generate payroll voucher run</p>
              </div>
              {['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'ACCOUNTANT'].includes(role) && (
                <button
                  onClick={() => {
                    toast.success('Navigating to Payroll disbursement module...');
                  }}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <span>Run Payroll Batch</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ASSIGN WORKER TO SITE
          ========================================================================= */}
      {isAssignModalOpen && markProjectFilter !== 'ALL' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                  <UserPlus size={20} className="text-blue-600" />
                  <span>Assign Workers to {selectedProjectObj?.name}</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select available company workers to add to this site's roster
                </p>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {employees
                .filter((e) => !belongsToProject(e, markProjectFilter))
                .map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:bg-gray-50"
                  >
                    <div>
                      <div className="text-sm font-bold text-gray-900">{emp.full_name}</div>
                      <div className="text-xs text-gray-500">
                        {emp.employee_code} • {emp.trade} • Current:{' '}
                        {emp.primary_project_name || 'Unassigned'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAssignWorkerToSite(emp.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition"
                    >
                      + Assign
                    </button>
                  </div>
                ))}
              {employees.filter((e) => !belongsToProject(e, markProjectFilter)).length === 0 && (
                <div className="text-center p-6 text-sm text-gray-500">
                  All company workers are currently assigned to this project site.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: DEPARTMENT / GANG QUICK FILTER
          ========================================================================= */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <Building2 size={20} className="text-indigo-600" />
                <span>Department & Trade Filter</span>
              </h3>
              <button
                onClick={() => setIsDeptModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Filter the attendance roll call by worker role or labor gang:
            </p>

            <div className="space-y-2">
              {['ALL', 'KARIGAR', 'LABOUR'].map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDeptFilter(d);
                    setIsDeptModalOpen(false);
                    toast.success(`Filter applied: ${d}`);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-bold flex items-center justify-between transition cursor-pointer ${
                    deptFilter === d
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <span>{d === 'ALL' ? 'All Roles & Departments' : d}</span>
                  {deptFilter === d && <Check size={16} />}
                </button>
              ))}
            </div>

            {gangs.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                  Labor Groups / Gangs
                </span>
                <div className="space-y-2">
                  {gangs.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => {
                        setIsDeptModalOpen(false);
                        toast.success(`Selected Gang: ${g.name}`);
                      }}
                      className="w-full text-left px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span>{g.name}</span>
                      <span className="text-gray-400 font-normal">
                        {g.members_count || 0} members
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}



      {/* =========================================================================
          MODAL: ADD HOLIDAY
          ========================================================================= */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <CalendarCheck size={20} className="text-blue-600" />
                <span>Add Calendar Holiday</span>
              </h3>
              <button
                onClick={() => setIsHolidayModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.attendance.createHoliday(holidayForm);
                  toast.success('Holiday added successfully!');
                  setIsHolidayModalOpen(false);
                  fetchHolidays();
                } catch (err) {
                  toast.error(`Error: ${err.message}`);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={holidayForm.date}
                  onChange={(e) =>
                    setHolidayForm((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Holiday Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Diwali, Independence Day"
                  value={holidayForm.name}
                  onChange={(e) =>
                    setHolidayForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Type
                </label>
                <select
                  value={holidayForm.holiday_type}
                  onChange={(e) =>
                    setHolidayForm((prev) => ({ ...prev, holiday_type: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white"
                >
                  <option value="NATIONAL">National Holiday</option>
                  <option value="SITE_CLOSURE">Site Closure</option>
                  <option value="WEATHER">Weather Closure</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="paidCheck"
                  checked={holidayForm.is_paid}
                  onChange={(e) =>
                    setHolidayForm((prev) => ({ ...prev, is_paid: e.target.checked }))
                  }
                />
                <label htmlFor="paidCheck" className="text-sm font-semibold text-gray-800">
                  Paid Holiday (workers receive full daily wage)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsHolidayModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-xs"
                >
                  Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
