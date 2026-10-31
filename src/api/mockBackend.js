import { INITIAL_DB } from './initialData.js';

const STORAGE_KEY = 'buildsphere_mock_db';
const DB_VERSION_KEY = 'buildsphere_db_version';
const CURRENT_DB_VERSION = 'v_factory_reset_clean_20261031';

// Helper to deep clone
const clone = (obj) => JSON.parse(JSON.stringify(obj));

// Load DB from localStorage or seed with clean INITIAL_DB
function loadDB() {
  let target = null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedVersion = window.localStorage.getItem(DB_VERSION_KEY);
      if (storedVersion !== CURRENT_DB_VERSION) {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem('cmp_access_token');
        window.localStorage.removeItem('cmp_refresh_token');
        window.localStorage.removeItem('cmp_user');
        window.localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
      } else {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            target = parsed;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Failed reading localStorage DB:', e);
  }

  if (!target) {
    target = clone(INITIAL_DB);
  }

  // Ensure default structure arrays exist
  const collections = [
    'organizations', 'users', 'projects', 'project_memberships', 'budget_categories',
    'employees', 'attendances', 'holidays', 'work_entries', 'expenses', 'vendors',
    'advances', 'payroll_runs', 'payroll_vouchers', 'payments', 'accounts',
    'journal_entries', 'journal_lines', 'transactions', 'audit_logs', 'labor_groups',
    'dprs', 'night_shifts', 'credit_logs', 'running_costs', 'invitations',
    'cost_estimates', 'dispatched_emails'
  ];
  collections.forEach((col) => {
    if (!Array.isArray(target[col])) target[col] = [];
  });

  return target;
}

function saveDB(db) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('Failed saving DB to localStorage:', e);
  }
}

let db = loadDB();

// Reset DB helper
export function resetDB() {
  db = clone(INITIAL_DB);
  const collections = [
    'organizations', 'users', 'projects', 'project_memberships', 'budget_categories',
    'employees', 'attendances', 'holidays', 'work_entries', 'expenses', 'vendors',
    'advances', 'payroll_runs', 'payroll_vouchers', 'payments', 'accounts',
    'journal_entries', 'journal_lines', 'transactions', 'audit_logs', 'labor_groups',
    'dprs', 'night_shifts', 'credit_logs', 'running_costs', 'invitations',
    'cost_estimates', 'dispatched_emails'
  ];
  collections.forEach((col) => {
    if (!Array.isArray(db[col])) db[col] = [];
  });
  saveDB(db);
  return db;
}

// Generate simple sequential id
function nextId(collection) {
  if (!collection || collection.length === 0) return 1;
  const max = collection.reduce((m, item) => Math.max(m, Number(item.id || item.pk || 0)), 0);
  return max + 1;
}

// Helper to identify active user session for audit trail and multi-tenant isolation
export function getActorFromSession(overrideUser = null) {
  if (overrideUser && (overrideUser.email || overrideUser.role)) {
    const rawOrg = overrideUser.organization;
    const orgId = typeof rawOrg === 'object' && rawOrg !== null ? rawOrg.id : rawOrg;
    return {
      id: overrideUser.id || 1,
      email: overrideUser.email || 'user@buildsphere.com',
      name: overrideUser.name || overrideUser.email || 'User',
      role: overrideUser.role || 'UNKNOWN',
      organization: Number(orgId || 10),
    };
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem('cmp_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u && (u.email || u.role)) {
          const rawOrg = u.organization;
          const orgId = typeof rawOrg === 'object' && rawOrg !== null ? rawOrg.id : rawOrg;
          return {
            id: u.id || 1,
            email: u.email || 'user@buildsphere.com',
            name: u.name || u.email || 'User',
            role: u.role || 'UNKNOWN',
            organization: Number(orgId || 10),
          };
        }
      }
    } catch {}
  }
  return {
    id: 1,
    email: 'admin@buildsphere.com',
    name: 'Admin User',
    role: 'ORG_ADMIN',
    organization: 10,
  };
}

export function getCurrentOrgId(overrideUser = null) {
  const actor = getActorFromSession(overrideUser);
  return Number(actor.organization || 10);
}

export function getOrgById(targetDb, orgId) {
  const targetId = Number(orgId || 10);
  const found = (targetDb.organizations || []).find((o) => Number(o.id) === targetId);
  if (found) return found;
  return {
    id: targetId,
    name: targetId === 10 ? 'BuildSphere org.' : 'My Organization',
    currency: 'INR',
    workday_hours: '8.00',
    half_day_hours: '4.00',
    overtime_after_hours: '8.00',
    expense_approval_limit: '1000.00',
    is_active: true,
  };
}

export function getOrgProjectIds(targetDb, orgId) {
  const targetId = Number(orgId || 10);
  return new Set(
    (targetDb.projects || [])
      .filter((p) => !p.deleted_at && Number(p.organization || 10) === targetId)
      .map((p) => p.id)
  );
}

export function createDefaultAccountsForOrg(targetDb, orgId) {
  if (!targetDb.accounts) targetDb.accounts = [];
  const targetId = Number(orgId);
  const existing = targetDb.accounts.filter((a) => Number(a.organization || 10) === targetId);
  if (existing.length > 0) return;

  const defaultTemplates = [
    { code: '1001', name: 'Cash in Hand', type: 'ASSET' },
    { code: '1002', name: 'Bank Account', type: 'ASSET' },
    { code: '1100', name: 'Worker Advances', type: 'ASSET' },
    { code: '1200', name: 'Client Receivable', type: 'ASSET' },
    { code: '2001', name: 'Accounts Payable', type: 'LIABILITY' },
    { code: '2002', name: 'Outstanding Wages', type: 'LIABILITY' },
    { code: '3001', name: 'Owner Equity', type: 'EQUITY' },
    { code: '4001', name: 'Project Revenue / Invoicing', type: 'REVENUE' },
    { code: '5001', name: 'Raw Material Expenses', type: 'EXPENSE' },
    { code: '5002', name: 'Labor & Wages Expenses', type: 'EXPENSE' },
    { code: '5003', name: 'Site Machinery & Equipment', type: 'EXPENSE' },
    { code: '5004', name: 'Site Overhead & Utilities', type: 'EXPENSE' },
    { code: '5005', name: 'Subcontractor Costs', type: 'EXPENSE' },
  ];

  defaultTemplates.forEach((t) => {
    targetDb.accounts.push({
      id: nextId(targetDb.accounts),
      organization: targetId,
      code: t.code,
      name: t.name,
      type: t.type,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
  });
}

// Universal Audit Log Recorder to guarantee persistence for each and every action performed by any role
export function recordAuditLog(targetDb, { action, resource_type, resource_id, changes = {}, metadata = {}, actor = null }) {
  if (!targetDb) return null;
  const currentActor = getActorFromSession(actor);
  if (!targetDb.audit_logs) targetDb.audit_logs = [];

  const logEntry = {
    id: nextId(targetDb.audit_logs),
    organization: currentActor.organization || 10,
    created_at: new Date().toISOString(),
    actor: [currentActor.email || 'user@buildsphere.com'],
    action: action || 'ACTION_PERFORMED',
    resource_type: resource_type || 'System',
    resource_id: String(resource_id != null ? resource_id : ''),
    changes: changes || {},
    metadata: {
      actor_name: currentActor.name || currentActor.email || 'User',
      actor_role: currentActor.role || 'UNKNOWN',
      timestamp: new Date().toISOString(),
      ...metadata,
    },
    ip_address: '127.0.0.1',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'BuildSphere-Client',
  };

  // Prepend so latest appears first
  targetDb.audit_logs.unshift(logEntry);

  // Keep reasonably bounded
  if (targetDb.audit_logs.length > 600) {
    targetDb.audit_logs = targetDb.audit_logs.slice(0, 600);
  }

  saveDB(targetDb);
  return logEntry;
}

// Helper to create mock blob for PDF/Excel download
function createMockBlob(filename, type = 'text/csv') {
  const content = `Mock Report: ${filename}\nGenerated on: ${new Date().toISOString()}\nOrganization: BuildSphere Construction\nCurrency: INR\nStatus: Verified\n`;
  return new Blob([content], { type });
}

/**
 * Handle incoming API requests matching Django REST Framework routes
 */
// -------------------------------------------------------------
// EMPLOYEE FINANCIALS & ATTENDANCE STATS COMPUTATION
// -------------------------------------------------------------
export function computeEmployeeFinancials(emp, currentOrgId, targetDb = null) {
  if (!emp) return { total_pagar: 0, total_upad: 0, total_paid: 0, balance: 0, has_attendance: false, full_days: 0, half_days: 0, absent_days: 0, total_present: 0, total_earnings: 0 };
  const d = targetDb || loadDB();
  const eId = Number(emp.id);
  const rate = Number(emp.daily_rate || 800);

  // Attendances for this employee in current organization
  const empAtts = (d.attendances || []).filter(
    (a) => !a.deleted_at && Number(a.employee) === eId && Number(a.organization || 10) === currentOrgId
  );

  const fullDays = empAtts.filter((a) => a.status === 'PRESENT').length;
  const halfDays = empAtts.filter((a) => a.status === 'HALF_DAY').length;
  const absentDays = empAtts.filter((a) => a.status === 'ABSENT').length;
  const totalOT = empAtts.reduce((sum, a) => sum + Number(a.overtime_hours || 0), 0);

  // Total Pagar (gross earned from attendance & overtime)
  const totalPagar = (fullDays * rate) + (halfDays * (rate / 2)) + (totalOT * (rate / 8));

  // Advances (Upad)
  const empUpads = (d.payments || []).filter(
    (p) => !p.deleted_at && Number(p.employee) === eId && p.payment_type === 'ADVANCE' && Number(p.organization || 10) === currentOrgId
  );
  const totalUpad = empUpads.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Wages Paid (excluding advances)
  const empWages = (d.payments || []).filter(
    (p) => !p.deleted_at && Number(p.employee) === eId && (p.payment_type === 'WAGE' || p.payment_type === 'SALARY' || (!p.payment_type && p.status === 'PAID')) && p.payment_type !== 'ADVANCE' && Number(p.organization || 10) === currentOrgId
  );
  const totalPaid = empWages.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Remaining balance (can be negative if Upad advances exceed earned salary)
  const balance = totalPagar - totalUpad - totalPaid;
  const hasAttendance = (fullDays + halfDays) > 0;

  return {
    total_pagar: totalPagar,
    total_earned: totalPagar,
    total_earnings: totalPagar,
    total_upad: totalUpad,
    advance_balance: totalUpad,
    total_paid: totalPaid,
    balance: balance,
    net_payable: balance,
    has_attendance: hasAttendance,
    full_days: fullDays,
    half_days: halfDays,
    absent_days: absentDays,
    total_present: fullDays + halfDays,
    total_attendance: fullDays + halfDays,
  };
}

export function formatEmployeeRecord(emp, currentOrgId, targetDb = null) {
  if (!emp) return emp;
  const d = targetDb || loadDB();
  const fin = computeEmployeeFinancials(emp, currentOrgId, d);

  // Collect all assigned project IDs
  const projIds = new Set();
  if (emp.primary_project) {
    projIds.add(Number(emp.primary_project));
  }
  if (Array.isArray(emp.assigned_projects)) {
    emp.assigned_projects.forEach((pid) => {
      const id = typeof pid === 'object' && pid !== null ? pid.id : pid;
      if (id) projIds.add(Number(id));
    });
  }

  const assignedProjectsArray = Array.from(projIds);
  const assignedProjectsDetails = assignedProjectsArray
    .map((pid) => (d.projects || []).find((p) => !p.deleted_at && p.id === pid))
    .filter(Boolean);

  const primaryProjObj = (d.projects || []).find((p) => !p.deleted_at && p.id === Number(emp.primary_project));

  return {
    ...emp,
    primary_project: emp.primary_project ? Number(emp.primary_project) : (assignedProjectsArray[0] || null),
    primary_project_name: primaryProjObj?.name || '',
    assigned_projects: assignedProjectsArray,
    assigned_projects_details: assignedProjectsDetails,
    financials: fin,
    balance: String(fin.balance.toFixed(2)),
    total_pagar: fin.total_pagar,
    total_upad: fin.total_upad,
    total_paid: fin.total_paid,
  };
}

export function formatPaymentRecord(p, currentOrgId, targetDb = null) {
  if (!p) return p;
  const d = targetDb || loadDB();
  const empId = Number(p.employee || p.employee_id || 0);
  const emp = (d.employees || []).find((e) => Number(e.id) === empId);

  const projId = Number(p.project || p.project_id || emp?.primary_project || d.projects?.[0]?.id || 29);
  const proj = (d.projects || []).find((pr) => Number(pr.id) === projId);

  const rawDate = p.payment_date || p.date_from || p.date_to || p.advance_date || p.date || (p.created_at ? p.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);
  const normDate = String(rawDate).split('T')[0];

  const employeeName = p.employee_name || emp?.full_name || emp?.name || 'Worker';
  const projectName = p.project_name || proj?.name || proj?.title || 'General Site';
  const method = p.method || (p.payment_mode ? p.payment_mode.toLowerCase() : 'upi');
  const paymentMode = p.payment_mode || (p.method ? p.method.toUpperCase() : 'UPI');
  const status = (p.status || 'paid').toLowerCase();
  const paymentType = (p.payment_type || p.type || 'ADVANCE').toUpperCase();
  const type = (p.type || p.payment_type || 'advance').toLowerCase();

  return {
    ...p,
    employee: empId || p.employee,
    employee_id: empId || p.employee_id,
    employee_name: employeeName,
    employee_code: p.employee_code || emp?.employee_code || '',
    project: projId,
    project_id: projId,
    project_name: projectName,
    date: normDate,
    payment_date: normDate,
    date_from: p.date_from ? String(p.date_from).split('T')[0] : normDate,
    date_to: p.date_to ? String(p.date_to).split('T')[0] : normDate,
    advance_date: normDate,
    method,
    payment_mode: paymentMode,
    status,
    payment_type: paymentType,
    type,
    amount: String(Number(p.amount || 0).toFixed(2)),
    description: p.description || p.notes || 'Upad advance payment',
    notes: p.notes || p.description || 'Upad advance payment',
  };
}

export async function handleMockRequest(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const urlObj = new URL(endpoint, 'http://localhost');
  const pathname = urlObj.pathname.replace(/^\/api\/v1/, '');
  const params = Object.fromEntries(urlObj.searchParams.entries());

  let body = {};
  if (options.body) {
    if (typeof options.body === 'string') {
      try {
        body = JSON.parse(options.body);
      } catch {
        body = {};
      }
    } else if (options.body instanceof FormData) {
      body = {};
      for (const [key, value] of options.body.entries()) {
        body[key] = value;
      }
    } else {
      body = options.body;
    }
  }

  // Artificial slight micro-delay for realistic feel without lag
  await new Promise((r) => setTimeout(r, 40));

  // Reload latest state from storage to sync across tabs/updates
  db = loadDB();

  // Multi-tenant session context
  const currentActor = getActorFromSession();
  const currentOrgId = getCurrentOrgId();
  const currentOrg = getOrgById(db, currentOrgId);
  const orgProjectIds = getOrgProjectIds(db, currentOrgId);

  // -------------------------------------------------------------
  // AUTH & USERS
  // -------------------------------------------------------------
  if (pathname === '/auth/system-status') {
    return { initialized: db.users && db.users.length > 0 };
  }

  if (pathname === '/auth/setup-admin' && method === 'POST') {
    const existingOrgIds = (db.organizations || []).map((o) => Number(o.id || 0));
    const orgId = Math.max(10, ...existingOrgIds) + 1;
    const newOrg = {
      id: orgId,
      name: (body.org_name || 'My Organization').trim(),
      currency: 'INR',
      workday_hours: '8.00',
      half_day_hours: '4.00',
      overtime_after_hours: '8.00',
      expense_approval_limit: '1000.00',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!db.organizations) db.organizations = [];
    db.organizations.push(newOrg);

    const newUser = {
      id: nextId(db.users),
      name: (body.name || 'Admin User').trim(),
      email: body.email.toLowerCase().trim(),
      role: 'ORG_ADMIN',
      phone: '',
      is_active: true,
      organization: orgId,
      created_at: new Date().toISOString(),
    };
    db.users.push(newUser);

    createDefaultAccountsForOrg(db, orgId);

    recordAuditLog(db, {
      action: 'ADMIN_SETUP',
      resource_type: 'User',
      resource_id: newUser.id,
      actor: newUser,
      changes: { email: newUser.email, name: newUser.name, role: newUser.role, org_id: orgId },
    });
    saveDB(db);

    return {
      access: 'mock-jwt-token-access',
      refresh: 'mock-jwt-token-refresh',
      user: { ...newUser, organization: newOrg },
    };
  }

  if (pathname === '/auth/login' && method === 'POST') {
    const email = (body.email || '').toLowerCase().trim();
    let user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      throw new Error('Invalid email or password.');
    }
    // CRITICAL SECURITY: Block deactivated users from logging in
    if (user.is_active === false) {
      throw new Error(
        'This account has been deactivated by the organization admin. Please contact your administrator.'
      );
    }
    // Check if linked workforce employee is marked inactive
    const linkedEmp = (db.employees || []).find(
      (e) => (user.employee_id && e.id === user.employee_id) ||
             (e.email && e.email.toLowerCase() === email) ||
             (user.phone && e.phone && e.phone === user.phone)
    );
    if (linkedEmp && (linkedEmp.is_active === false || linkedEmp.status === 'INACTIVE')) {
      user.is_active = false;
      saveDB(db);
      throw new Error(
        'This account has been deactivated by the organization admin. Please contact your administrator.'
      );
    }
    if (user.role === 'employee/labour' && !user.employee_id) {
      user.employee_id = 100;
    }
    recordAuditLog(db, {
      action: 'LOGIN_SUCCESS',
      resource_type: 'User',
      resource_id: user.id,
      actor: user,
      metadata: { role: user.role, email: user.email },
    });
    const userOrgId = Number(user.organization?.id || user.organization || 10);
    const userOrg = getOrgById(db, userOrgId);
    return {
      access: 'mock-jwt-token-access',
      refresh: 'mock-jwt-token-refresh',
      user: { ...user, organization: userOrg },
    };
  }

  if (pathname === '/auth/refresh' && method === 'POST') {
    return { access: 'mock-refreshed-jwt-token', refresh: 'mock-refreshed-jwt-refresh' };
  }

  if (pathname === '/auth/logout' && method === 'POST') {
    recordAuditLog(db, {
      action: 'LOGOUT',
      resource_type: 'User',
      resource_id: '',
      metadata: { action: 'Session terminated' },
    });
    return { detail: 'Successfully logged out.' };
  }

  if (pathname === '/auth/accept-invite' && method === 'POST') {
    const invite = (db.invitations || []).find(
      (inv) => String(inv.id) === String(body.token) || inv.email === body.email
    );
    const targetOrgId = Number(invite?.organization || currentOrgId || 10);
    const role = invite ? invite.role : 'SITE_ENGINEER';
    const email = (invite ? invite.email : body.email || `user_${Date.now()}@buildsphere.com`).toLowerCase();

    let empId = null;
    if (role === 'employee/labour' || role === 'LABOUR' || role === 'EMPLOYEE') {
      const nextEmpId = nextId(db.employees);
      const orgProjs = (db.projects || []).filter((p) => !p.deleted_at && Number(p.organization || 10) === targetOrgId);
      const newEmp = {
        id: nextEmpId,
        employee_code: `EMP-${String(nextEmpId).padStart(4, '0')}`,
        full_name: body.name || 'Invited Member',
        phone: body.phone || '',
        email,
        role: 'Labour',
        trade: 'HELPER',
        skill_level: 'SKILLED',
        employment_type: 'DAILY_WAGE',
        daily_rate: '800.00',
        ot_hourly_rate: '150.00',
        monthly_salary: '0.00',
        is_active: true,
        deleted_at: null,
        organization: targetOrgId,
        primary_project: null,
        assigned_projects: [],
        joining_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.employees.push(newEmp);
      empId = newEmp.id;
    }

    const newUser = {
      id: nextId(db.users),
      name: body.name || 'Invited Member',
      email,
      role,
      phone: body.phone || '',
      employee_id: empId,
      is_active: true,
      organization: targetOrgId,
      created_at: new Date().toISOString(),
    };
    db.users.push(newUser);
    if (invite) {
      invite.status = 'ACCEPTED';
    }
    recordAuditLog(db, {
      action: 'INVITE_ACCEPTED',
      resource_type: 'User',
      resource_id: newUser.id,
      actor: newUser,
      changes: { email: newUser.email, role: newUser.role, organization: targetOrgId },
    });
    saveDB(db);

    return {
      access: 'mock-jwt-token-access',
      refresh: 'mock-jwt-token-refresh',
      user: { ...newUser, organization: getOrgById(db, targetOrgId) },
    };
  }

  if (pathname === '/users/me') {
    const rawUser = localStorage.getItem('cmp_user');
    const user = rawUser ? JSON.parse(rawUser) : (db.users && db.users.length > 0 ? db.users[0] : null);
    if (!user) {
      throw new Error('Not authenticated.');
    }
    if (method === 'PATCH') {
      const idx = db.users.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        db.users[idx] = { ...db.users[idx], ...body };
        recordAuditLog(db, {
          action: 'PROFILE_UPDATED',
          resource_type: 'User',
          resource_id: user.id,
          changes: body,
        });
        saveDB(db);
        return db.users[idx];
      }
    }
    const userOrgId = Number(user.organization?.id || user.organization || 10);
    return { ...user, organization: getOrgById(db, userOrgId) };
  }

  if (pathname === '/users') {
    if (method === 'GET') {
      return (db.users || []).filter(
        (u) => Number(u.organization?.id || u.organization || 10) === currentOrgId
      );
    }
    if (method === 'POST') {
      let empId = body.employee_id;
      const allProjIds = (db.projects || []).map((p) => p.id);

      // If user is employee/labour or labour role, automatically create corresponding Employee record in db.employees!
      if (body.role === 'employee/labour' || body.role === 'LABOUR' || body.role === 'EMPLOYEE') {
        let existingEmp = (db.employees || []).find(
          (e) => (empId && e.id === empId) || (body.email && e.email === body.email)
        );
        if (existingEmp && existingEmp.id === 100 && body.name && body.name.toLowerCase() !== 'darshil') {
          existingEmp = null;
        }

        if (!existingEmp) {
          const nextEmpId = nextId(db.employees);
          const empCode = `EMP-${String(nextEmpId).padStart(4, '0')}`;
          const newEmp = {
            id: nextEmpId,
            employee_code: empCode,
            full_name: body.name || 'New Employee',
            phone: body.phone || '',
            email: body.email || '',
            role: 'Labour',
            trade: 'HELPER',
            skill_level: 'SKILLED',
            employment_type: 'DAILY_WAGE',
            daily_rate: '800.00',
            ot_hourly_rate: '150.00',
            monthly_salary: '0.00',
            is_active: true,
            deleted_at: null,
            primary_project: null,
            assigned_projects: [],
            joining_date: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          db.employees.push(newEmp);
          empId = newEmp.id;
        } else {
          empId = existingEmp.id;
          if (body.email && !existingEmp.email) {
            existingEmp.email = body.email;
          }
          if (body.phone && !existingEmp.phone) {
            existingEmp.phone = body.phone;
          }
        }
      }

      const tempPassword = body.password || 'BuildSphere@2026';
      const targetNotificationEmail = (body.notification_email || body.email || '').trim();

      const newUser = {
        id: nextId(db.users),
        ...body,
        password: tempPassword,
        employee_id: empId,
        organization: currentOrgId,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      db.users.push(newUser);

      // Automated credentials email delivery dispatch
      db.dispatched_emails = db.dispatched_emails || [];
      const emailRecord = {
        id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        created_at: new Date().toISOString(),
        recipient: targetNotificationEmail,
        member_name: body.name || 'Team Member',
        member_email: body.email,
        role: body.role || 'SITE_ENGINEER',
        password: tempPassword,
        subject: `Welcome to BuildSphere — Your Login Credentials (${body.name || body.email})`,
        status: 'DELIVERED',
        delivery_provider: localStorage.getItem('cmp_resend_api_key') ? 'Resend' : 'BuildSphere Outbox',
        login_url: typeof window !== 'undefined' ? window.location.origin : 'https://buildsphere.com',
      };
      db.dispatched_emails.unshift(emailRecord);

      recordAuditLog(db, {
        action: 'USER_CREATED',
        resource_type: 'User',
        resource_id: newUser.id,
        changes: { name: newUser.name, email: newUser.email, role: newUser.role },
      });
      saveDB(db);
      return { ...newUser, dispatched_email: emailRecord };
    }
  }

  const userMatch = pathname.match(/^\/users\/(\w+)/);
  if (userMatch) {
    const uId = userMatch[1];
    const idx = db.users.findIndex((u) => String(u.id) === String(uId));
    if (method === 'PATCH' && idx !== -1) {
      db.users[idx] = { ...db.users[idx], ...body };
      // Sync is_active with linked employee record
      if (body.is_active !== undefined) {
        const empIdx = (db.employees || []).findIndex(
          (e) => (db.users[idx].employee_id && e.id === db.users[idx].employee_id) ||
                 (db.users[idx].email && e.email && e.email.toLowerCase() === db.users[idx].email.toLowerCase()) ||
                 (db.users[idx].name && e.full_name && e.full_name.toLowerCase() === db.users[idx].name.toLowerCase())
        );
        if (empIdx !== -1) {
          db.employees[empIdx].is_active = body.is_active;
          db.employees[empIdx].status = body.is_active ? 'ACTIVE' : 'INACTIVE';
        }
      }
      if (
        (body.role === 'employee/labour' || body.role === 'LABOUR') &&
        (!db.users[idx].employee_id || !(db.employees || []).some((e) => e.id === db.users[idx].employee_id))
      ) {
        const nextEmpId = nextId(db.employees);
        const empCode = `EMP-${String(nextEmpId).padStart(4, '0')}`;
        const newEmp = {
          id: nextEmpId,
          employee_code: empCode,
          full_name: db.users[idx].name || 'New Employee',
          phone: db.users[idx].phone || '',
          email: db.users[idx].email || '',
          role: 'Labour',
          trade: 'HELPER',
          skill_level: 'SKILLED',
          employment_type: 'DAILY_WAGE',
          daily_rate: '800.00',
          ot_hourly_rate: '150.00',
          monthly_salary: '0.00',
          is_active: true,
          deleted_at: null,
          primary_project: null,
          assigned_projects: [],
          joining_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        db.employees.push(newEmp);
        db.users[idx].employee_id = newEmp.id;
      }
      recordAuditLog(db, {
        action: 'USER_UPDATED',
        resource_type: 'User',
        resource_id: uId,
        changes: body,
      });
      saveDB(db);
      return db.users[idx];
    }
    if (method === 'DELETE' && idx !== -1) {
      const removedUser = db.users[idx];
      db.users.splice(idx, 1);
      recordAuditLog(db, {
        action: 'USER_DELETED',
        resource_type: 'User',
        resource_id: uId,
        changes: { name: removedUser?.name, email: removedUser?.email, role: removedUser?.role },
      });
      saveDB(db);
      return { success: true };
    }
  }

  // -------------------------------------------------------------
  // DASHBOARD
  // -------------------------------------------------------------
  if (pathname === '/dashboard/overview') {
    const projectId = params.project ? Number(params.project) : null;
    let filteredProjects = (db.projects || []).filter(
      (p) => !p.deleted_at && Number(p.organization || 10) === currentOrgId
    );
    if (projectId) {
      filteredProjects = filteredProjects.filter((p) => p.id === projectId);
    }
    const activeProjects = filteredProjects.filter((p) => p.status === 'ACTIVE');
    const activeWorkers = (db.employees || []).filter(
      (e) => e.is_active !== false && !e.deleted_at && Number(e.organization || 10) === currentOrgId
    );

    // Workers on site today (strictly for today's date)
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const todayRecords = (db.attendances || []).filter(
      (a) =>
        Number(a.organization || 10) === currentOrgId &&
        (!projectId || a.project === projectId) &&
        (a.date === todayStr || a.date === localDateStr || (a.created_at && (a.created_at.startsWith(todayStr) || a.created_at.startsWith(localDateStr))))
    );

    const todayPresentAtt = todayRecords.filter(
      (a) => a.status === 'PRESENT' || a.status === 'HALF_DAY'
    );
    const uniquePresentIds = new Set(todayPresentAtt.map((a) => a.employee));
    const workersOnSiteToday = uniquePresentIds.size;

    const todayAbsentAtt = todayRecords.filter((a) => a.status === 'ABSENT');
    const uniqueAbsentIds = new Set(todayAbsentAtt.map((a) => a.employee));
    const workersAbsentToday = uniqueAbsentIds.size;

    const totalBudget = activeProjects.reduce((sum, p) => sum + Number(p.estimated_budget || 0), 0);

    // Calculate total payments made to employees strictly as wages and UPAD advances
    const employeePaymentsSum = (db.payments || [])
      .filter((p) => {
        if (projectId && p.project !== projectId) return false;
        const status = (p.status || '').toUpperCase();
        return status === 'PAID' || status === 'PROCESSED' || status === 'APPROVED';
      })
      .reduce((sum, p) => sum + Number(p.amount || p.base_salary || 0), 0);

    const payrollVouchersSum = (db.payroll_vouchers || [])
      .filter((v) => (v.status || '').toUpperCase() === 'PAID')
      .reduce((sum, v) => sum + Number(v.net_pay || v.gross_pay || 0), 0);

    const advancesSum = (db.advances || [])
      .filter((a) => (!projectId || a.project === projectId))
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);

    // Calculate total net salary payable balance (matching Payroll section Net Salary Payable)
    const netSalaryPayableBalance = (db.employees || [])
      .filter((e) => !e.deleted_at && Number(e.organization || 10) === currentOrgId && (!projectId || e.primary_project === projectId || (e.assigned_projects || []).includes(projectId)))
      .reduce((sum, e) => {
        const fin = computeEmployeeFinancials(e, currentOrgId, db);
        return sum + Number(fin.balance || 0);
      }, 0);

    // Calculate total paid UPAD advances (matching Upad section Paid Total)
    const totalPaidUpad = (db.payments || [])
      .filter((p) => {
        if (Number(p.organization || 10) !== currentOrgId) return false;
        const pType = (p.payment_type || p.type || '').toLowerCase();
        if (pType === 'salary' || pType === 'wage') return false;
        const desc = (p.description || p.notes || '').toLowerCase();
        if (desc.includes('salary payment') || desc.includes('wage settlement') || desc.includes('[full salary]')) return false;
        if (projectId && Number(p.project || p.project_id) !== Number(projectId)) {
          const emp = (db.employees || []).find((e) => Number(e.id) === Number(p.employee || p.employee_id));
          if (Number(emp?.primary_project) !== Number(projectId)) return false;
        }
        const status = (p.status || '').toLowerCase();
        return status === 'paid' || status === 'confirmed' || status === 'approved';
      })
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // Sum of all wages and UPAD advances paid to employees
    const totalEmployeeAmount = netSalaryPayableBalance;

    // Calculate total payments made across the entire platform (Employee Wages & UPAD + Approved Vendor Expenses + Running Costs)
    const approvedExpensesSum = (db.expenses || [])
      .filter((e) => {
        if (projectId && e.project !== projectId) return false;
        const status = (e.status || '').toUpperCase();
        return status === 'APPROVED' || status === 'PAID' || status === 'APPROVED_BY_MANAGER';
      })
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const runningCostsSum = (db.running_costs || [])
      .filter((rc) => (!projectId || rc.project === projectId))
      .reduce((sum, rc) => sum + Number(rc.amount || 0), 0);

    // Grand Total Payments Made
    const totalPaymentsMade = totalEmployeeAmount + approvedExpensesSum + runningCostsSum;
    const budgetPct = totalBudget > 0 ? Math.round((totalPaymentsMade / totalBudget) * 100) : 0;

    const pendingExpensesCount = (db.expenses || []).filter(
      (e) => Number(e.organization || 10) === currentOrgId && (!projectId || e.project === projectId) && e.status === 'PENDING'
    ).length;

    const pendingAdvancesCount = (db.payments || []).filter(
      (p) => Number(p.organization || 10) === currentOrgId && (!projectId || p.project === projectId) && p.status === 'PENDING'
    ).length;

    // 7-day dynamic attendance trend ending today
    const attendanceTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];

      const dayAtt = (db.attendances || []).filter(
        (a) => (!projectId || a.project === projectId) && a.date === dStr && !a.deleted_at
      );

      if (dayAtt.length > 0) {
        const pCount = dayAtt.filter((a) => a.status === 'PRESENT' || a.status === 'HALF_DAY').length;
        const aCount = dayAtt.filter((a) => a.status === 'ABSENT' || a.status === 'LEAVE').length;
        const unlogged = Math.max(0, activeWorkers.length - dayAtt.length);
        attendanceTrend.push({
          date: dStr,
          present: pCount,
          absent: aCount + unlogged,
          half_day: dayAtt.filter((a) => a.status === 'HALF_DAY').length,
          total: activeWorkers.length,
        });
      } else if (i === 0) {
        attendanceTrend.push({
          date: dStr,
          present: workersOnSiteToday,
          absent: workersAbsentToday,
          half_day: 0,
          total: activeWorkers.length,
        });
      } else {
        const baseP = Math.min(
          activeWorkers.length,
          Math.max(0, Math.round(activeWorkers.length * (0.6 + (i % 3) * 0.15)))
        );
        attendanceTrend.push({
          date: dStr,
          present: baseP,
          absent: Math.max(0, activeWorkers.length - baseP),
          half_day: 1,
          total: activeWorkers.length,
        });
      }
    }

    // Project cards enhanced for dashboard drill-down
    const enhancedProjects = filteredProjects.map((p) => {
      const budget = Number(p.estimated_budget || 0);
      const spend = Number(p.actual_spend || 0);
      const util = budget > 0 ? Math.min(100, Math.round((spend / budget) * 100)) : 0;
      return {
        ...p,
        budget_utilization_pct: util,
        progress_percentage: util > 0 ? util : 0,
        workforce_count: (db.employees || []).filter(
          (e) => Number(e.organization || 10) === currentOrgId && (e.primary_project === p.id || (e.assigned_projects || []).includes(p.id))
        ).length,
        health_status: util > 90 ? 'CRITICAL' : util > 75 ? 'WARNING' : 'HEALTHY',
      };
    });

    return {
      active_projects: activeProjects.length,
      active_workers: activeWorkers.length,
      workers_on_site_today: workersOnSiteToday,
      workers_absent_today: workersAbsentToday,
      attendance_today_absent: workersAbsentToday,
      total_budget: totalBudget,
      actual_spend: totalPaymentsMade,
      total_spend: totalPaymentsMade,
      total_payments: totalPaymentsMade,
      total_upad: totalPaidUpad,
      paid_upad: totalPaidUpad,
      month_expenditure: totalEmployeeAmount,
      employee_amount: totalEmployeeAmount,
      net_salary_payable: totalEmployeeAmount,
      budget_utilization_pct: budgetPct,
      budget_utilization_percent: budgetPct,
      monthly_burn: approvedExpensesSum,
      monthly_payroll: totalEmployeeAmount,
      pending_expenses: pendingExpensesCount,
      pending_advances: pendingAdvancesCount,
      attendance_trend: attendanceTrend,
      projects: enhancedProjects,
    };
  }

  // -------------------------------------------------------------
  // PROJECTS
  // -------------------------------------------------------------
  if (pathname === '/projects') {
    if (method === 'GET') {
      const list = (db.projects || []).filter((p) => !p.deleted_at && Number(p.organization || 10) === currentOrgId);
      return list;
    }
    if (method === 'POST') {
      const newProj = {
        id: nextId(db.projects),
        name: body.name || 'New Project',
        description: body.description || '',
        client_name: body.client_name || '',
        client_phone: body.client_phone || '',
        location: body.location || '',
        status: body.status || 'ACTIVE',
        start_date: body.start_date || new Date().toISOString().split('T')[0],
        end_date: body.end_date || null,
        estimated_budget: String(Number(body.estimated_budget || 0).toFixed(2)),
        actual_spend: '0.00',
        organization: currentOrgId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.projects.push(newProj);
      recordAuditLog(db, {
        action: 'PROJECT_CREATED',
        resource_type: 'Project',
        resource_id: newProj.id,
        changes: { name: newProj.name, budget: newProj.estimated_budget, location: newProj.location },
      });
      saveDB(db);
      return newProj;
    }
  }

  const projMatch = pathname.match(/^\/projects\/(\d+)(\/.*)?$/);
  if (projMatch) {
    const pId = Number(projMatch[1]);
    const subRoute = projMatch[2] || '';
    const projIdx = (db.projects || []).findIndex((p) => p.id === pId);
    const proj = db.projects[projIdx];

    if (!proj) throw new Error('Project not found');

    if (subRoute.startsWith('/members')) {
      const memberSubMatch = subRoute.match(/^\/members(\/(\d+))?$/);
      const mId = memberSubMatch && memberSubMatch[2] ? Number(memberSubMatch[2]) : null;
      if (method === 'DELETE' && mId) {
        const mIdx = (db.project_memberships || []).findIndex((m) => m.id === mId || m.user === mId);
        if (mIdx !== -1) {
          const removedM = db.project_memberships.splice(mIdx, 1)[0];
          recordAuditLog(db, {
            action: 'PROJECT_MEMBER_REMOVED',
            resource_type: 'ProjectMembership',
            resource_id: mId,
            changes: { project: pId, user: removedM?.user, role: removedM?.role },
          });
          saveDB(db);
        }
        return { success: true };
      }
      if (method === 'GET') {
        const memberships = (db.project_memberships || []).filter((m) => m.project === pId);
        return memberships.map((m) => ({
          ...m,
          user: db.users.find((u) => u.id === m.user) || { name: 'Team Member', email: 'member@buildsphere.com', role: m.role },
        }));
      }
      if (method === 'POST') {
        const newM = {
          id: nextId(db.project_memberships),
          project: pId,
          user: body.user_id || body.user,
          role: body.role || 'SITE_ENGINEER',
          created_at: new Date().toISOString(),
        };
        db.project_memberships.push(newM);
        recordAuditLog(db, {
          action: 'PROJECT_MEMBER_ASSIGNED',
          resource_type: 'ProjectMembership',
          resource_id: newM.id,
          changes: { project: pId, user: newM.user, role: newM.role },
        });
        saveDB(db);
        return newM;
      }
    }

    if (method === 'GET') return proj;
    if (method === 'PATCH') {
      db.projects[projIdx] = { ...proj, ...body, updated_at: new Date().toISOString() };
      recordAuditLog(db, {
        action: 'PROJECT_UPDATED',
        resource_type: 'Project',
        resource_id: pId,
        changes: body,
      });
      saveDB(db);
      return db.projects[projIdx];
    }
    if (method === 'DELETE') {
      db.projects[projIdx].deleted_at = new Date().toISOString();
      recordAuditLog(db, {
        action: 'PROJECT_DELETED',
        resource_type: 'Project',
        resource_id: pId,
        changes: { name: proj.name },
      });
      saveDB(db);
      return { success: true };
    }
  }




  // -------------------------------------------------------------
  // WORKFORCE & EMPLOYEES
  // -------------------------------------------------------------
  if (pathname === '/employees') {
    if (method === 'GET') {
      let list = (db.employees || []).filter((e) => !e.deleted_at && Number(e.organization || 10) === currentOrgId);
      if (params.search) {
        const s = params.search.toLowerCase();
        list = list.filter(
          (e) =>
            (e.full_name && e.full_name.toLowerCase().includes(s)) ||
            (e.employee_code && e.employee_code.toLowerCase().includes(s)) ||
            (e.trade && e.trade.toLowerCase().includes(s)) ||
            (e.role && e.role.toLowerCase().includes(s))
        );
      }
      if (params.project && params.project !== 'ALL' && params.project !== 'all') {
        const pId = Number(params.project);
        if (!isNaN(pId)) {
          list = list.filter(
            (e) => e.primary_project === pId || (e.assigned_projects && e.assigned_projects.includes(pId))
          );
        }
      }
      if (params.trade) {
        list = list.filter((e) => e.trade === params.trade);
      }
      return list.map((emp) => formatEmployeeRecord(emp, currentOrgId, db));
    }
    if (method === 'POST') {
      const allProjIds = (db.projects || []).map((p) => p.id);
      const nextEmpId = nextId(db.employees);
      const code = `EMP-${String(nextEmpId).padStart(4, '0')}`;
      const newEmp = {
        id: nextEmpId,
        employee_code: code,
        full_name: body.full_name || 'Worker Name',
        phone: body.phone || '',
        email: body.email || '',
        joining_date: body.joining_date || new Date().toISOString().split('T')[0],
        is_active: body.is_active !== false,
        deleted_at: null,
        role: body.role || 'Karigar',
        trade: body.trade || (body.role ? body.role.toUpperCase() : 'HELPER'),
        skill_level: body.skill_level || 'UNSKILLED',
        employment_type: body.employment_type || 'DAILY_WAGE',
        daily_rate: String(Number(body.daily_rate || 800).toFixed(2)),
        ot_hourly_rate: String(Number(body.ot_hourly_rate || 0).toFixed(2)),
        monthly_salary: String(Number(body.monthly_salary || 0).toFixed(2)),
        primary_project: body.primary_project ? Number(body.primary_project) : null,
        assigned_projects: Array.isArray(body.assigned_projects) ? body.assigned_projects.map(Number) : [],
        address: body.address || '',
        bank_name: body.bank_name || '',
        bank_account_number: body.bank_account_number || '',
        bank_ifsc: body.bank_ifsc || '',
        upi_id: body.upi_id || '',
        emergency_contact: body.emergency_contact || '',
        organization: currentOrgId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.employees.push(newEmp);

      // If they provided an email, ensure a user login exists for employee/labour
      if (body.email) {
        const existingUser = (db.users || []).find((u) => u.email === body.email);
        if (!existingUser) {
          db.users.push({
            id: nextId(db.users),
            name: newEmp.full_name,
            email: body.email,
            role: 'employee/labour',
            phone: newEmp.phone,
            employee_id: newEmp.id,
            is_active: true,
            created_at: new Date().toISOString(),
          });
        } else {
          existingUser.employee_id = newEmp.id;
        }
      }

      recordAuditLog(db, {
        action: 'EMPLOYEE_CREATED',
        resource_type: 'Employee',
        resource_id: newEmp.id,
        changes: { name: newEmp.full_name, trade: newEmp.trade, daily_rate: newEmp.daily_rate, project: newEmp.primary_project },
      });
      saveDB(db);
      return formatEmployeeRecord(newEmp, currentOrgId, db);
    }
  }

  const empMatch = pathname.match(/^\/employees\/(\d+)(\/.*)?$/);
  if (empMatch) {
    const eId = Number(empMatch[1]);
    const subRoute = empMatch[2] || '';
    const empIdx = (db.employees || []).findIndex((e) => e.id === eId);
    const emp = db.employees[empIdx];

    if (!emp) throw new Error('Employee not found');

    if (subRoute === '/assign-project' && method === 'POST') {
      const pId = Number(body.project_id);
      if (!emp.assigned_projects) emp.assigned_projects = [];
      if (!emp.assigned_projects.includes(pId)) emp.assigned_projects.push(pId);
      if (!emp.primary_project) emp.primary_project = pId;
      recordAuditLog(db, {
        action: 'EMPLOYEE_PROJECT_ASSIGNED',
        resource_type: 'Employee',
        resource_id: eId,
        changes: { project_id: pId, employee_name: emp.full_name },
      });
      saveDB(db);
      return formatEmployeeRecord(emp, currentOrgId, db);
    }

    if (subRoute === '/unassign-project' && method === 'POST') {
      const pId = Number(body.project_id);
      emp.assigned_projects = (emp.assigned_projects || []).filter((id) => Number(id) !== pId);
      if (Number(emp.primary_project) === pId) {
        emp.primary_project = emp.assigned_projects.length > 0 ? emp.assigned_projects[0] : null;
      }
      recordAuditLog(db, {
        action: 'EMPLOYEE_PROJECT_UNASSIGNED',
        resource_type: 'Employee',
        resource_id: eId,
        changes: { project_id: pId, employee_name: emp.full_name },
      });
      saveDB(db);
      return formatEmployeeRecord(emp, currentOrgId, db);
    }

    if (subRoute === '/pay' && method === 'POST') {
      const projId = Number(body.project || body.project_id || emp.primary_project || db.projects?.[0]?.id || 29);
      const proj = (db.projects || []).find((pr) => Number(pr.id) === projId);
      const rawDate = body.payment_date || body.date || new Date().toISOString().split('T')[0];
      const normDate = String(rawDate).split('T')[0];

      const payment = {
        id: nextId(db.payments),
        employee: eId,
        employee_id: eId,
        employee_name: emp.full_name || 'Worker',
        employee_code: emp.employee_code || '',
        project: projId,
        project_id: projId,
        project_name: proj?.name || 'General Site',
        amount: String(Number(body.amount || 0).toFixed(2)),
        payment_type: body.payment_type || 'SALARY',
        type: 'salary',
        payment_mode: body.payment_mode || 'CASH',
        method: (body.payment_mode || 'cash').toLowerCase(),
        payment_date: normDate,
        date_from: normDate,
        date_to: normDate,
        date: normDate,
        status: 'paid',
        notes: body.notes || 'Wage Settlement',
        description: body.notes || 'Wage Settlement',
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      };
      db.payments.push(payment);

      // Route wage payment directly into Payment Central (Transactions)
      if (!db.transactions) db.transactions = [];
      const txId = nextId(db.transactions);
      db.transactions.push({
        id: txId,
        transaction_id: `TXN-SAL-${payment.id}`,
        type: 'outgoing',
        category: 'salary',
        payer_name: 'Pragati Construction',
        payee_name: emp.full_name || 'Worker',
        amount: payment.amount,
        method: payment.method,
        status: 'completed',
        date: normDate,
        description: `[PAYROLL] Wage settlement for ${emp.full_name || 'Worker'}`,
        recorded_by: currentUser?.id || 1,
        recorded_by_name: currentUser?.name || 'Naresh Prajapati',
        metadata: {
          source: 'payroll',
          employee_id: eId,
          paymentType: 'salary',
          payment_id: payment.id,
        },
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      });

      // Route wage payment directly into Payroll (Paid Voucher)
      if (!db.payroll_vouchers) db.payroll_vouchers = [];
      const vId = nextId(db.payroll_vouchers);
      const voucher = {
        id: vId,
        voucher_number: `VOU-${String(vId).padStart(4, '0')}`,
        employee: eId,
        employee_name: emp.full_name,
        employee_code: emp.employee_code,
        daily_rate: emp.daily_rate,
        gross_amount: payment.amount,
        gross_pay: payment.amount,
        basic_pay: payment.amount,
        advance_deductions: '0.00',
        net_payable: payment.amount,
        net_pay: payment.amount,
        payment_mode: payment.payment_mode,
        status: 'PAID',
        paid_at: new Date().toISOString(),
        date: normDate,
        payment_reference: payment.notes,
        organization: currentOrgId,
        project: projId,
        created_at: new Date().toISOString(),
      };
      db.payroll_vouchers.push(voucher);

      recordAuditLog(db, {
        action: 'EMPLOYEE_PAYMENT_DISBURSED',
        resource_type: 'Payment',
        resource_id: payment.id,
        changes: { employee_id: eId, amount: payment.amount, mode: payment.payment_mode },
      });
      saveDB(db);
      return formatPaymentRecord(payment, currentOrgId, db);
    }

    if (subRoute === '/upad' && method === 'POST') {
      const projId = Number(body.project || body.project_id || emp.primary_project || db.projects?.[0]?.id || 29);
      const proj = (db.projects || []).find((pr) => Number(pr.id) === projId);
      const rawDate = body.advance_date || body.date || body.payment_date || new Date().toISOString().split('T')[0];
      const normDate = String(rawDate).split('T')[0];

      const payment = {
        id: nextId(db.payments),
        employee: eId,
        employee_id: eId,
        employee_name: emp.full_name || 'Worker',
        employee_code: emp.employee_code || '',
        project: projId,
        project_id: projId,
        project_name: proj?.name || 'General Site',
        amount: String(Number(body.amount || 0).toFixed(2)),
        payment_type: 'ADVANCE',
        type: 'advance',
        payment_mode: body.payment_mode || 'CASH',
        method: (body.payment_mode || 'cash').toLowerCase(),
        payment_date: normDate,
        date_from: normDate,
        date_to: normDate,
        date: normDate,
        advance_date: normDate,
        status: 'paid',
        notes: body.reason || body.notes || 'UPAD Advance',
        description: body.reason || body.notes || 'UPAD Advance',
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      };
      db.payments.push(payment);
      recordAuditLog(db, {
        action: 'EMPLOYEE_UPAD_REQUESTED',
        resource_type: 'Payment',
        resource_id: payment.id,
        changes: { employee_id: eId, amount: payment.amount, notes: payment.notes },
      });
      saveDB(db);
      return formatPaymentRecord(payment, currentOrgId, db);
    }

    if (subRoute === '/payment-history') {
      const payments = (db.payments || []).filter((p) => !p.deleted_at && Number(p.employee || p.employee_id) === eId);
      return payments.map((p) => {
        const fmt = formatPaymentRecord(p, currentOrgId, db);
        const isUpad = fmt.payment_type === 'ADVANCE';
        return {
          ...fmt,
          title: isUpad ? `Upad Advance: ${fmt.employee_name}` : `Wage Payment: ${fmt.employee_name}`,
          type: isUpad ? 'UPAD' : 'PAYMENT',
          mode: fmt.payment_mode,
        };
      });
    }

    if (subRoute === '/financials') {
      return computeEmployeeFinancials(emp, currentOrgId, db);
    }

    if (method === 'GET') {
      return formatEmployeeRecord(emp, currentOrgId, db);
    }
    if (method === 'PATCH') {
      db.employees[empIdx] = { ...emp, ...body, updated_at: new Date().toISOString() };
      recordAuditLog(db, {
        action: 'EMPLOYEE_UPDATED',
        resource_type: 'Employee',
        resource_id: eId,
        changes: body,
      });
      saveDB(db);
      return formatEmployeeRecord(db.employees[empIdx], currentOrgId, db);
    }
    if (method === 'DELETE') {
      db.employees[empIdx].deleted_at = new Date().toISOString();
      recordAuditLog(db, {
        action: 'EMPLOYEE_DELETED',
        resource_type: 'Employee',
        resource_id: eId,
        changes: { name: emp.full_name },
      });
      saveDB(db);
      return { success: true };
    }
  }

  // -------------------------------------------------------------
  // LABOR GROUPS / GANGS
  // -------------------------------------------------------------
  if (pathname === '/labor-groups') {
    if (method === 'GET') return (db.labor_groups || []).filter((g) => Number(g.organization || 10) === currentOrgId);
    if (method === 'POST') {
      const newGroup = {
        id: nextId(db.labor_groups),
        name: body.name || 'Mason Gang',
        leader_name: body.leader_name || '',
        leader_phone: body.leader_phone || '',
        trade: body.trade || 'MASON',
        members: body.employee_ids || [],
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      };
      db.labor_groups.push(newGroup);
      saveDB(db);
      return newGroup;
    }
  }

  const groupMatch = pathname.match(/^\/labor-groups\/(\d+)(\/.*)?$/);
  if (groupMatch) {
    const gId = Number(groupMatch[1]);
    const subRoute = groupMatch[2] || '';
    const gIdx = (db.labor_groups || []).findIndex((g) => g.id === gId);
    if (gIdx === -1) throw new Error('Labor group not found');

    if (subRoute === '/members' && method === 'POST') {
      const eIds = body.employee_ids || [];
      const current = new Set(db.labor_groups[gIdx].members || []);
      eIds.forEach((id) => current.add(id));
      db.labor_groups[gIdx].members = Array.from(current);
      saveDB(db);
      return db.labor_groups[gIdx];
    }

    if (method === 'DELETE') {
      db.labor_groups.splice(gIdx, 1);
      saveDB(db);
      return { success: true };
    }
  }

  // -------------------------------------------------------------
  // ATTENDANCE
  // -------------------------------------------------------------
  if (pathname === '/attendance/check-in' && method === 'POST') {
    const newAtt = {
      id: nextId(db.attendances),
      employee: Number(body.employee_id || body.employee),
      project: Number(body.project_id || body.project),
      date: body.date || new Date().toISOString().split('T')[0],
      status: body.status || 'PRESENT',
      hours_worked: String(Number(body.hours_worked || 8).toFixed(2)),
      overtime_hours: String(Number(body.overtime_hours || 0).toFixed(2)),
      notes: body.notes || '',
      organization: currentOrgId,
      created_at: new Date().toISOString(),
    };
    db.attendances.push(newAtt);
    recordAuditLog(db, {
      action: 'ATTENDANCE_CHECKIN',
      resource_type: 'Attendance',
      resource_id: newAtt.id,
      changes: { employee: newAtt.employee, status: newAtt.status, hours: newAtt.hours_worked, project: newAtt.project },
    });
    saveDB(db);
    return newAtt;
  }

  if (pathname === '/attendance/batch' && method === 'POST') {
    const records = body.records || [];
    const date = body.date || new Date().toISOString().split('T')[0];
    const projectId = Number(body.project_id || 29);

    for (const rec of records) {
      const eId = Number(rec.employee_id || rec.employee);
      // Remove existing for this employee and date
      const existingIdx = (db.attendances || []).findIndex(
        (a) => a.employee === eId && a.date === date
      );
      const allocatedProj = Number(rec.project_id || rec.project || (body.project_id ? Number(body.project_id) : null) || (existingIdx !== -1 ? db.attendances[existingIdx].project : null) || (db.employees.find(e => e.id === eId)?.primary_project) || projectId);
      const newAtt = {
        id: existingIdx !== -1 ? db.attendances[existingIdx].id : nextId(db.attendances),
        employee: eId,
        project: allocatedProj,
        date: date,
        status: rec.status || 'PRESENT',
        hours_worked: String(Number(rec.hours_worked || (rec.status === 'HALF_DAY' ? 4 : rec.status === 'PRESENT' ? 8 : 0)).toFixed(2)),
        overtime_hours: String(Number(rec.overtime_hours || 0).toFixed(2)),
        notes: rec.notes || '',
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      };
      if (existingIdx !== -1) {
        db.attendances[existingIdx] = newAtt;
      } else {
        db.attendances.push(newAtt);
      }
    }
    recordAuditLog(db, {
      action: 'ATTENDANCE_BATCH_MARKED',
      resource_type: 'Attendance',
      resource_id: `${projectId}_${date}`,
      changes: { count: records.length, project: projectId, date },
    });
    saveDB(db);
    return { success: true, count: records.length };
  }

  if (pathname === '/attendance') {
    if (method === 'GET') {
      let list = (db.attendances || []).filter((a) => !a.deleted_at && Number(a.organization || 10) === currentOrgId);
      if (params.date) list = list.filter((a) => a.date === params.date);
      if (params.date_from) list = list.filter((a) => a.date >= params.date_from);
      if (params.date_to) list = list.filter((a) => a.date <= params.date_to);
      if (params.project && params.project !== 'ALL' && params.project !== 'all') {
        const projId = Number(params.project);
        list = list.filter((a) => Number(a.project?.id || a.project_id || a.project) === projId);
      }
      if (params.employee && params.employee !== 'ALL' && params.employee !== 'all') {
        const empId = Number(params.employee);
        list = list.filter((a) => Number(a.employee?.id || a.employee_id || a.employee) === empId);
      }

      // Attach employee details, project_name, and earning
      return list.map((a) => {
        const emp = (db.employees || []).find((e) => e.id === a.employee);
        const proj = (db.projects || []).find((p) => p.id === a.project);
        const rate = Number(emp?.daily_rate || 800);
        let earning = 0;
        if (a.status === 'PRESENT') {
          earning = rate;
        } else if (a.status === 'HALF_DAY') {
          earning = rate / 2;
        } else if (a.status === 'ABSENT') {
          earning = 0;
        }
        if (a.overtime_hours && Number(a.overtime_hours) > 0) {
          earning += Number(a.overtime_hours) * (rate / 8);
        }

        return {
          ...a,
          employee_name: emp?.full_name || 'Worker',
          employee_code: emp?.employee_code || '',
          trade: emp?.trade || emp?.role || '',
          project_name: proj?.name || `Project #${a.project || ''}`,
          earning: earning,
          daily_wage: rate,
        };
      });
    }
  }

  const attMatch = pathname.match(/^\/attendance\/(\d+)/);
  if (attMatch) {
    const id = Number(attMatch[1]);
    const idx = (db.attendances || []).findIndex((a) => a.id === id);
    if (idx !== -1) {
      if (method === 'PATCH') {
        db.attendances[idx] = { ...db.attendances[idx], ...body, updated_at: new Date().toISOString() };
        recordAuditLog(db, {
          action: 'ATTENDANCE_UPDATED',
          resource_type: 'Attendance',
          resource_id: id,
          changes: body,
        });
        saveDB(db);
        return db.attendances[idx];
      }
      if (method === 'DELETE') {
        db.attendances.splice(idx, 1);
        recordAuditLog(db, {
          action: 'ATTENDANCE_DELETED',
          resource_type: 'Attendance',
          resource_id: id,
        });
        saveDB(db);
        return { success: true };
      }
      if (method === 'GET') {
        return db.attendances[idx];
      }
    }
    return { success: true };
  }

  if (pathname === '/attendance/summary') {
    let list = (db.attendances || []).filter((a) => !a.deleted_at && Number(a.organization || 10) === currentOrgId);
    if (params.date) list = list.filter((a) => a.date === params.date);
    if (params.date_from) list = list.filter((a) => a.date >= params.date_from);
    if (params.date_to) list = list.filter((a) => a.date <= params.date_to);
    if (params.project && params.project !== 'ALL' && params.project !== 'all') {
      const projId = Number(params.project);
      list = list.filter((a) => Number(a.project?.id || a.project_id || a.project) === projId);
    }
    if (params.employee && params.employee !== 'ALL' && params.employee !== 'all') {
      const empId = Number(params.employee);
      list = list.filter((a) => Number(a.employee?.id || a.employee_id || a.employee) === empId);
    }

    const fullDays = list.filter((a) => a.status === 'PRESENT').length;
    const halfDays = list.filter((a) => a.status === 'HALF_DAY').length;
    const absent = list.filter((a) => a.status === 'ABSENT').length;
    const totalPresent = fullDays + halfDays;
    const totalOT = list.reduce((sum, a) => sum + Number(a.overtime_hours || 0), 0);

    const totalEarnings = list.reduce((sum, a) => {
      const emp = (db.employees || []).find((e) => e.id === a.employee);
      const rate = Number(emp?.daily_rate || 800);
      let earn = 0;
      if (a.status === 'PRESENT') earn = rate;
      else if (a.status === 'HALF_DAY') earn = rate / 2;
      if (a.overtime_hours && Number(a.overtime_hours) > 0) {
        earn += Number(a.overtime_hours) * (rate / 8);
      }
      return sum + earn;
    }, 0);

    return {
      total_present: totalPresent,
      present: fullDays,
      full_days: fullDays,
      half_days: halfDays,
      half_day: halfDays,
      total_absent: absent,
      absent: absent,
      total: list.length,
      overtime_hours: totalOT,
      total_earnings: totalEarnings,
    };
  }

  if (pathname === '/attendance/report') {
    let orgEmployees = (db.employees || []).filter(
      (e) => !e.deleted_at && Number(e.organization || 10) === currentOrgId
    );
    if (params.employee && params.employee !== 'ALL' && params.employee !== 'all') {
      const empId = Number(params.employee);
      orgEmployees = orgEmployees.filter((e) => Number(e.id) === empId);
    }
    if (params.project && params.project !== 'ALL' && params.project !== 'all') {
      const pId = Number(params.project);
      orgEmployees = orgEmployees.filter(
        (e) => e.primary_project === pId || (e.assigned_projects && e.assigned_projects.includes(pId))
      );
    }

    let allAtts = (db.attendances || []).filter(
      (a) => !a.deleted_at && Number(a.organization || 10) === currentOrgId
    );
    if (params.date_from) allAtts = allAtts.filter((a) => a.date >= params.date_from);
    if (params.date_to) allAtts = allAtts.filter((a) => a.date <= params.date_to);
    if (params.project && params.project !== 'ALL' && params.project !== 'all') {
      allAtts = allAtts.filter((a) => a.project === Number(params.project));
    }

    const rows = orgEmployees.map((emp) => {
      const empAtts = allAtts.filter((a) => a.employee === emp.id);
      const fullDays = empAtts.filter((a) => a.status === 'PRESENT').length;
      const halfDays = empAtts.filter((a) => a.status === 'HALF_DAY').length;
      const absentDays = empAtts.filter((a) => a.status === 'ABSENT').length;
      const rate = Number(emp.daily_rate || 800);
      const totalOT = empAtts.reduce((sum, a) => sum + Number(a.overtime_hours || 0), 0);
      const totalEarnings = (fullDays * rate) + (halfDays * (rate / 2)) + (totalOT * (rate / 8));
      const effectiveAttendance = fullDays + (halfDays * 0.5);

      return {
        employee_id: emp.id,
        id: emp.id,
        employee_name: emp.full_name || 'Worker',
        employee_code: emp.employee_code || '',
        trade: emp.trade || emp.role || '',
        daily_wage: rate,
        daily_rate: rate,
        full_days: fullDays,
        half_days: halfDays,
        total_present: effectiveAttendance,
        total_attendance: effectiveAttendance,
        total_absent: absentDays,
        total_earnings: totalEarnings,
        attendance_count: empAtts.length,
      };
    });

    return {
      rows: rows,
      records: allAtts,
      total_working_days: 26,
      holidays_count: (db.holidays || []).length,
    };
  }

  if (pathname === '/attendance/approve' && method === 'POST') {
    const { project_id, date } = body;
    (db.attendances || []).forEach((a) => {
      if ((!project_id || a.project === Number(project_id)) && a.date === date) {
        a.is_approved = true;
      }
    });
    recordAuditLog(db, {
      action: 'ATTENDANCE_APPROVED',
      resource_type: 'Attendance',
      resource_id: `${project_id || 'all'}_${date}`,
      changes: { project_id, date },
    });
    saveDB(db);
    return { success: true, message: 'Attendance approved for date' };
  }

  if (pathname === '/night-shifts') {
    if (method === 'GET') return (db.night_shifts || []).filter((s) => Number(s.organization || 10) === currentOrgId);
    if (method === 'POST') {
      const shift = {
        id: nextId(db.night_shifts),
        ...body,
        organization: currentOrgId,
        status: 'ACTIVE',
        start_time: new Date().toISOString(),
      };
      db.night_shifts.push(shift);
      saveDB(db);
      return shift;
    }
  }

  const nightMatch = pathname.match(/^\/night-shifts\/(\d+)(\/.*)?$/);
  if (nightMatch) {
    const id = Number(nightMatch[1]);
    const subRoute = nightMatch[2] || '';
    const idx = (db.night_shifts || []).findIndex((s) => s.id === id);
    if (idx !== -1) {
      if (subRoute === '/complete' && (method === 'PATCH' || method === 'POST')) {
        db.night_shifts[idx].status = 'COMPLETED';
        db.night_shifts[idx].end_time = new Date().toISOString();
        saveDB(db);
        return db.night_shifts[idx];
      }
      if (method === 'PATCH') {
        db.night_shifts[idx] = { ...db.night_shifts[idx], ...body, updated_at: new Date().toISOString() };
        saveDB(db);
        return db.night_shifts[idx];
      }
      if (method === 'DELETE') {
        db.night_shifts.splice(idx, 1);
        saveDB(db);
        return { success: true };
      }
      if (method === 'GET') return db.night_shifts[idx];
    }
  }

  if (pathname === '/holidays') {
    if (method === 'GET') return (db.holidays || []).filter((h) => Number(h.organization || 10) === currentOrgId);
    if (method === 'POST') {
      const holiday = {
        id: nextId(db.holidays),
        name: body.name || 'Holiday',
        date: body.date,
        organization: currentOrgId,
        is_paid: body.is_paid !== undefined ? body.is_paid : true,
      };
      db.holidays.push(holiday);
      saveDB(db);
      return holiday;
    }
  }

  const holMatch = pathname.match(/^\/holidays\/(\d+)/);
  if (holMatch) {
    const id = Number(holMatch[1]);
    const idx = (db.holidays || []).findIndex((h) => h.id === id);
    if (idx !== -1) {
      if (method === 'PATCH') {
        db.holidays[idx] = { ...db.holidays[idx], ...body };
        saveDB(db);
        return db.holidays[idx];
      }
      if (method === 'DELETE') {
        db.holidays.splice(idx, 1);
        saveDB(db);
        return { success: true };
      }
      if (method === 'GET') return db.holidays[idx];
    }
    return { success: true };
  }

  // -------------------------------------------------------------
  // DAILY PROGRESS REPORTS (DPR)
  // -------------------------------------------------------------
  if (pathname === '/dpr') {
    if (method === 'GET') {
      let list = (db.dprs || []).filter((d) => Number(d.organization || 10) === currentOrgId || orgProjectIds.has(Number(d.project)));
      if (params.project) list = list.filter((d) => d.project === Number(params.project));
      return list;
    }
    if (method === 'POST') {
      const newDpr = {
        id: nextId(db.dprs),
        project: Number(body.project_id || body.project),
        report_date: body.report_date || new Date().toISOString().split('T')[0],
        work_summary: body.work_summary || '',
        challenges: body.challenges || '',
        weather: body.weather || 'Sunny',
        status: 'SUBMITTED',
        work_entries: body.work_entries || [],
        photos: body.photos || [],
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      };
      db.dprs.push(newDpr);
      recordAuditLog(db, {
        action: 'DPR_SUBMITTED',
        resource_type: 'DPR',
        resource_id: newDpr.id,
        changes: { project: newDpr.project, date: newDpr.report_date, summary: newDpr.work_summary, weather: newDpr.weather },
      });
      saveDB(db);
      return newDpr;
    }
  }

  const dprMatch = pathname.match(/^\/dpr\/(\d+)(\/.*)?$/);
  if (dprMatch) {
    const dId = Number(dprMatch[1]);
    const subRoute = dprMatch[2] || '';
    const dIdx = (db.dprs || []).findIndex((d) => d.id === dId);
    const dpr = db.dprs[dIdx];

    if (dpr) {
      if (subRoute === '/verify' && method === 'POST') {
        dpr.status = 'VERIFIED';
        recordAuditLog(db, {
          action: 'DPR_VERIFIED',
          resource_type: 'DPR',
          resource_id: dId,
          changes: { status: 'VERIFIED' },
        });
        saveDB(db);
        return dpr;
      }
      if (subRoute === '/reject' && method === 'POST') {
        dpr.status = 'REJECTED';
        dpr.rejection_reason = body.reason || '';
        recordAuditLog(db, {
          action: 'DPR_REJECTED',
          resource_type: 'DPR',
          resource_id: dId,
          changes: { status: 'REJECTED', reason: body.reason },
        });
        saveDB(db);
        return dpr;
      }
      if (method === 'PATCH') {
        db.dprs[dIdx] = { ...dpr, ...body, updated_at: new Date().toISOString() };
        recordAuditLog(db, {
          action: 'DPR_UPDATED',
          resource_type: 'DPR',
          resource_id: dId,
          changes: body,
        });
        saveDB(db);
        return db.dprs[dIdx];
      }
      if (method === 'DELETE') {
        db.dprs.splice(dIdx, 1);
        recordAuditLog(db, {
          action: 'DPR_DELETED',
          resource_type: 'DPR',
          resource_id: dId,
        });
        saveDB(db);
        return { success: true };
      }
      if (method === 'GET') return dpr;
    }
    return { success: true };
  }

  // -------------------------------------------------------------
  // WORK ENTRIES
  // -------------------------------------------------------------
  if (pathname === '/work-entries/present-employees') {
    const pId = params.project && params.project !== 'ALL' && params.project !== 'all' && params.project !== '' ? Number(params.project) : null;
    const date = params.date || new Date().toISOString().split('T')[0];

    // Find all attendance records marked on this specific date that are PRESENT or HALF_DAY
    let dateAttendances = (db.attendances || []).filter(
      (a) =>
        !a.deleted_at &&
        (a.date === date || (a.created_at && a.created_at.startsWith(date))) &&
        (a.status === 'PRESENT' || a.status === 'HALF_DAY')
    );

    if (pId && dateAttendances.length > 0) {
      const projSpecificAtt = dateAttendances.filter((a) => {
        if (Number(a.project) === pId) return true;
        const emp = (db.employees || []).find((e) => e.id === Number(a.employee));
        if (Number(emp?.primary_project) === pId) return true;
        if (Array.isArray(emp?.assigned_projects) && emp.assigned_projects.some((pr) => Number(pr) === pId)) return true;
        return false;
      });
      if (projSpecificAtt.length > 0) {
        dateAttendances = projSpecificAtt;
      }
    }

    const presentEmpIds = new Set(dateAttendances.map((a) => Number(a.employee)));
    const emps = (db.employees || [])
      .filter((e) => !e.deleted_at && presentEmpIds.has(Number(e.id)))
      .map((e) => {
        const att = dateAttendances.find((a) => Number(a.employee) === Number(e.id));
        const proj = (db.projects || []).find((p) => p.id === (att?.project || e.primary_project));
        return {
          ...formatEmployeeRecord(e, currentOrgId, db),
          attendance_status: att?.status || 'PRESENT',
          hours_worked: att?.hours_worked || 8,
          overtime_hours: att?.overtime_hours || 0,
          project_id: proj?.id || null,
          project_name: proj?.name || '',
        };
      });

    // Group employees by role
    const byRole = {};
    emps.forEach((emp) => {
      const roleName = emp.role || emp.trade || 'Labour';
      if (!byRole[roleName]) byRole[roleName] = [];
      byRole[roleName].push(emp);
    });

    return {
      employees: emps,
      by_role: byRole,
      count: emps.length,
      total_present: emps.length,
      date: date,
      project: pId,
    };
  }

  if (pathname === '/work-entries') {
    if (method === 'GET') {
      let list = (db.work_entries || []).filter(
        (w) =>
          !w.deleted_at &&
          (Number(w.organization || 10) === currentOrgId || orgProjectIds.has(Number(w.project)))
      );
      if (params.project && params.project !== 'all') {
        list = list.filter((w) => String(w.project) === String(params.project));
      }
      if (params.date) list = list.filter((w) => w.date === params.date);
      if (params.from_date) list = list.filter((w) => w.date >= params.from_date);
      if (params.to_date) list = list.filter((w) => w.date <= params.to_date);

      if (params.employee) {
        const eId = Number(params.employee);
        list = list.filter((w) =>
          (Array.isArray(w.employees) && w.employees.map(Number).includes(eId)) ||
          Number(w.employee) === eId
        );
      }

      if (params.role) {
        const rLower = params.role.toLowerCase();
        list = list.filter((w) => {
          const empIds = Array.isArray(w.employees) ? w.employees : (w.employee ? [w.employee] : []);
          const empObjs = (db.employees || []).filter((e) => empIds.includes(e.id));
          return (
            empObjs.some((e) => (e.role || e.trade || '').toLowerCase().includes(rLower)) ||
            (w.department && w.department.toLowerCase().includes(rLower))
          );
        });
      }

      // Hydrate project_name, employee_details, and role_counts
      return list.map((w) => {
        const empIds = Array.isArray(w.employees) ? w.employees : (w.employee ? [w.employee] : []);
        const empObjs = (db.employees || []).filter((e) => empIds.includes(e.id));
        const roleCounts = {};
        empObjs.forEach((e) => {
          const r = e.role || e.trade || 'Labour';
          roleCounts[r] = (roleCounts[r] || 0) + 1;
        });
        const proj = (db.projects || []).find((p) => p.id === Number(w.project));
        return {
          ...w,
          project_name: w.project_name || (proj ? proj.name : `Project #${w.project}`),
          employee_details: empObjs,
          role_counts: w.role_counts && Object.keys(w.role_counts).length > 0 ? w.role_counts : roleCounts,
        };
      });
    }

    if (method === 'POST') {
      const projId = Number(body.project_id || body.project);
      const proj = (db.projects || []).find((p) => p.id === projId);
      const empIds = Array.isArray(body.employees)
        ? body.employees.map(Number)
        : body.employee
        ? [Number(body.employee)]
        : [];

      const empObjs = (db.employees || []).filter((e) => empIds.includes(e.id));
      const roleCounts = {};
      empObjs.forEach((e) => {
        const r = e.role || e.trade || 'Labour';
        roleCounts[r] = (roleCounts[r] || 0) + 1;
      });

      const entry = {
        id: nextId(db.work_entries),
        organization: currentOrgId,
        project: projId,
        project_name: proj ? proj.name : `Project #${projId}`,
        date: body.date || new Date().toISOString().split('T')[0],
        description: body.description || body.task_description || '',
        task_description: body.description || body.task_description || '',
        department: body.department || '',
        quantity_completed: body.quantity_completed || '1.0',
        unit: body.unit || 'sqft',
        hours_spent: String(Number(body.hours_spent || 8).toFixed(2)),
        employees: empIds,
        employee: empIds[0] || null,
        employee_details: empObjs,
        role_counts: roleCounts,
        created_by: getActorFromSession().email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      db.work_entries.push(entry);
      recordAuditLog(db, {
        action: 'WORK_ENTRY_CREATED',
        resource_type: 'WorkEntry',
        resource_id: entry.id,
        changes: {
          project: entry.project,
          date: entry.date,
          description: entry.description,
          assigned_count: empIds.length,
          roles: Object.keys(roleCounts),
          employees: entry.employees,
        },
      });
      saveDB(db);
      return entry;
    }
  }

  const workEntryMatch = pathname.match(/^\/work-entries\/(\d+)/);
  if (workEntryMatch) {
    const weId = Number(workEntryMatch[1]);
    const weIdx = (db.work_entries || []).findIndex((w) => w.id === weId);
    if (weIdx !== -1) {
      if (method === 'PATCH') {
        db.work_entries[weIdx] = { ...db.work_entries[weIdx], ...body, updated_at: new Date().toISOString() };
        recordAuditLog(db, {
          action: 'WORK_ENTRY_UPDATED',
          resource_type: 'WorkEntry',
          resource_id: weId,
          changes: body,
        });
        saveDB(db);
        return db.work_entries[weIdx];
      }
      if (method === 'DELETE') {
        db.work_entries.splice(weIdx, 1);
        recordAuditLog(db, {
          action: 'WORK_ENTRY_DELETED',
          resource_type: 'WorkEntry',
          resource_id: weId,
        });
        saveDB(db);
        return { success: true };
      }
      if (method === 'GET') {
        return db.work_entries[weIdx];
      }
    }
    return { success: true };
  }

  // -------------------------------------------------------------
  // EXPENSES & VENDORS
  // -------------------------------------------------------------
  if (pathname === '/expenses') {
    if (method === 'GET') {
      let list = (db.expenses || []).filter((e) => !e.deleted_at && Number(e.organization || 10) === currentOrgId);
      if (params.project) list = list.filter((e) => e.project === Number(params.project));
      if (params.status) list = list.filter((e) => e.status === params.status);
      if (params.category) list = list.filter((e) => e.category === params.category);
      return list;
    }
    if (method === 'POST') {
      const newExp = {
        id: nextId(db.expenses),
        project: Number(body.project_id || body.project),
        category: body.category || 'MATERIAL',
        description: body.description || '',
        amount: String(Number(body.amount || 0).toFixed(2)),
        expense_date: body.expense_date || new Date().toISOString().split('T')[0],
        payment_mode: body.payment_mode || 'CASH',
        vendor: body.vendor ? Number(body.vendor) : null,
        status: 'PENDING',
        receipt_photo: body.receipt_photo || null,
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      };
      db.expenses.push(newExp);
      recordAuditLog(db, {
        action: 'EXPENSE_SUBMITTED',
        resource_type: 'Expense',
        resource_id: newExp.id,
        changes: { amount: newExp.amount, category: newExp.category, project: newExp.project, description: newExp.description },
      });
      saveDB(db);
      return newExp;
    }
  }

  const expMatch = pathname.match(/^\/expenses\/(\d+)(\/.*)?$/);
  if (expMatch) {
    const expId = Number(expMatch[1]);
    const subRoute = expMatch[2] || '';
    const expIdx = (db.expenses || []).findIndex((e) => e.id === expId);
    const exp = db.expenses[expIdx];

    if (!exp) throw new Error('Expense not found');

    if (subRoute === '/approve' && method === 'POST') {
      exp.status = 'APPROVED';
      // Increase project actual spend
      const pIdx = (db.projects || []).findIndex((p) => p.id === exp.project);
      if (pIdx !== -1) {
        const curSpend = Number(db.projects[pIdx].actual_spend || 0);
        db.projects[pIdx].actual_spend = String((curSpend + Number(exp.amount)).toFixed(2));
      }
      if (exp.vendor && exp.payment_mode === 'CREDIT') {
        const vIdx = (db.vendors || []).findIndex((v) => v.id === exp.vendor);
        if (vIdx !== -1) {
          const curBal = Number(db.vendors[vIdx].outstanding_balance || 0);
          db.vendors[vIdx].outstanding_balance = String((curBal + Number(exp.amount)).toFixed(2));
        }
      }
      recordAuditLog(db, {
        action: 'EXPENSE_APPROVED',
        resource_type: 'Expense',
        resource_id: expId,
        changes: { amount: exp.amount, project: exp.project, status: 'APPROVED' },
      });
      saveDB(db);
      return exp;
    }

    if (subRoute === '/reject' && method === 'POST') {
      exp.status = 'REJECTED';
      exp.rejection_reason = body.reason || '';
      recordAuditLog(db, {
        action: 'EXPENSE_REJECTED',
        resource_type: 'Expense',
        resource_id: expId,
        changes: { reason: body.reason, status: 'REJECTED' },
      });
      saveDB(db);
      return exp;
    }

    if (method === 'PATCH') {
      db.expenses[expIdx] = { ...exp, ...body, updated_at: new Date().toISOString() };
      recordAuditLog(db, {
        action: 'EXPENSE_UPDATED',
        resource_type: 'Expense',
        resource_id: expId,
        changes: body,
      });
      saveDB(db);
      return db.expenses[expIdx];
    }

    if (method === 'DELETE') {
      db.expenses.splice(expIdx, 1);
      recordAuditLog(db, {
        action: 'EXPENSE_DELETED',
        resource_type: 'Expense',
        resource_id: expId,
      });
      saveDB(db);
      return { success: true };
    }

    if (method === 'GET') {
      return exp;
    }
  }

  if (pathname === '/vendors') {
    if (method === 'GET') {
      const orgVendors = (db.vendors || []).filter((v) => Number(v.organization || 10) === currentOrgId);
      return orgVendors.map((v) => {
        const vExpenses = (db.expenses || []).filter((e) => Number(e.vendor) === Number(v.id));
        const vPayments = (db.payments || []).filter((p) => Number(p.vendor) === Number(v.id));
        const totalBilled = vExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const creditBilled = vExpenses.filter((e) => e.payment_mode === 'CREDIT').reduce((s, e) => s + Number(e.amount || 0), 0);
        const totalPaid = vPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
        const calculatedBalance = Math.max(0, creditBilled - totalPaid);
        const outstanding = v.outstanding_balance !== undefined ? v.outstanding_balance : String(calculatedBalance.toFixed(2));
        return {
          ...v,
          total_billed: totalBilled,
          total_paid: totalPaid,
          outstanding_balance: outstanding,
          bill_count: vExpenses.length,
        };
      });
    }
    if (method === 'POST') {
      const newV = {
        id: nextId(db.vendors),
        name: body.name || 'Vendor',
        contact_person: body.contact_person || '',
        phone: body.phone || '',
        email: body.email || '',
        address: body.address || '',
        gstin: body.gstin || '',
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      };
      db.vendors.push(newV);
      recordAuditLog(db, {
        action: 'VENDOR_CREATED',
        resource_type: 'Vendor',
        resource_id: newV.id,
        changes: { name: newV.name, phone: newV.phone },
      });
      saveDB(db);
      return newV;
    }
  }

  const vendorMatch = pathname.match(/^\/vendors\/(\d+)(\/.*)?$/);
  if (vendorMatch) {
    const vId = Number(vendorMatch[1]);
    const subRoute = vendorMatch[2] || '';
    const vIdx = (db.vendors || []).findIndex((v) => v.id === vId);

    if (subRoute === '/ledger') {
      const expenses = (db.expenses || []).filter((e) => e.vendor === vId);
      const vendorPayments = (db.payments || []).filter((p) => p.vendor === vId);
      const totalBilled = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
      const totalPaid = vendorPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
      return {
        vendor_id: vId,
        total_billed: totalBilled,
        total_paid: totalPaid,
        outstanding: Math.max(0, totalBilled - totalPaid),
        entries: expenses,
      };
    }

    if (subRoute === '/payments' && method === 'POST') {
      const pmt = {
        id: nextId(db.payments),
        vendor: vId,
        amount: String(Number(body.amount || 0).toFixed(2)),
        payment_date: body.payment_date || new Date().toISOString().split('T')[0],
        mode: body.payment_mode || 'BANK_TRANSFER',
        payment_mode: body.payment_mode || 'BANK_TRANSFER',
        payment_type: 'VENDOR',
        status: 'PAID',
        reference: body.reference || '',
        created_at: new Date().toISOString(),
      };
      db.payments.push(pmt);

      if (vIdx !== -1) {
        const curBal = Number(db.vendors[vIdx].outstanding_balance || 0);
        db.vendors[vIdx].outstanding_balance = String(Math.max(0, curBal - Number(body.amount || 0)).toFixed(2));
      }

      // Also record in central transactions ledger
      if (!db.transactions) db.transactions = [];
      db.transactions.push({
        id: nextId(db.transactions),
        type: 'OUTFLOW',
        category: 'VENDOR_PAYMENT',
        amount: pmt.amount,
        reference: pmt.reference || `VEN-PMT-${vId}`,
        vendor_id: vId,
        payment_mode: pmt.payment_mode,
        date: pmt.payment_date,
        description: `Payment to vendor #${vId}`,
        status: 'COMPLETED',
        created_at: new Date().toISOString(),
      });

      recordAuditLog(db, {
        action: 'VENDOR_PAYMENT_RECORDED',
        resource_type: 'Payment',
        resource_id: pmt.id,
        changes: { vendor_id: vId, amount: pmt.amount, mode: pmt.payment_mode },
      });

      saveDB(db);
      return pmt;
    }

    if (vIdx !== -1) {
      if (method === 'PATCH') {
        db.vendors[vIdx] = { ...db.vendors[vIdx], ...body, updated_at: new Date().toISOString() };
        recordAuditLog(db, {
          action: 'VENDOR_UPDATED',
          resource_type: 'Vendor',
          resource_id: vId,
          changes: body,
        });
        saveDB(db);
        return db.vendors[vIdx];
      }
      if (method === 'DELETE') {
        db.vendors.splice(vIdx, 1);
        recordAuditLog(db, {
          action: 'VENDOR_DELETED',
          resource_type: 'Vendor',
          resource_id: vId,
        });
        saveDB(db);
        return { success: true };
      }
      if (method === 'GET') {
        return db.vendors[vIdx];
      }
    }
  }

  // -------------------------------------------------------------
  // PAYROLL
  // -------------------------------------------------------------
  if (pathname === '/payroll/runs') {
    if (method === 'GET') return (db.payroll_runs || []).filter((r) => Number(r.organization || 10) === currentOrgId);
    if (method === 'POST') {
      const activeEmps = (db.employees || []).filter((e) => !e.deleted_at && e.is_active !== false && Number(e.organization || 10) === currentOrgId);
      const vouchers = (activeEmps.length > 0 ? activeEmps : (db.employees || []).slice(0, 5)).map((e, idx) => {
        const rate = Number(e.daily_rate || 800);
        const gross = rate * 6 + 400;
        const advDeductions = (db.payments || [])
          .filter((p) => p.employee === e.id && p.payment_type === 'ADVANCE')
          .reduce((s, p) => s + Number(p.amount || 0), 0);
        const net = Math.max(0, gross - Math.min(advDeductions, gross * 0.5));
        return {
          id: nextId(db.payroll_vouchers || []) + idx,
          employee: e.id,
          employee_name: e.full_name,
          employee_code: e.employee_code,
          daily_rate: e.daily_rate,
          days_worked: '6.0',
          overtime_hours: '2.0',
          gross_amount: String(gross.toFixed(2)),
          advance_deductions: String(Math.min(advDeductions, gross * 0.5).toFixed(2)),
          net_payable: String(net.toFixed(2)),
          status: 'UNPAID',
        };
      });

      const grossTotal = vouchers.reduce((s, v) => s + Number(v.gross_amount || 0), 0);
      const deductionsTotal = vouchers.reduce((s, v) => s + Number(v.advance_deductions || 0), 0);
      const netTotal = vouchers.reduce((s, v) => s + Number(v.net_payable || 0), 0);

      const newRun = {
        id: nextId(db.payroll_runs),
        project: Number(body.project_id || body.project || (db.projects || []).find((p) => !p.deleted_at && Number(p.organization || 10) === currentOrgId)?.id || 0),
        organization: currentOrgId,
        start_date: body.start_date || new Date().toISOString().split('T')[0],
        end_date: body.end_date || new Date().toISOString().split('T')[0],
        status: 'DRAFT',
        gross_total: String(grossTotal.toFixed(2)),
        deductions_total: String(deductionsTotal.toFixed(2)),
        net_total: String(netTotal.toFixed(2)),
        vouchers,
        created_at: new Date().toISOString(),
      };
      db.payroll_runs.push(newRun);
      recordAuditLog(db, {
        action: 'PAYROLL_RUN_GENERATED',
        resource_type: 'PayrollRun',
        resource_id: newRun.id,
        changes: { total_gross: grossTotal, total_net: netTotal, vouchers_count: vouchers.length },
      });
      saveDB(db);
      return newRun;
    }
  }

  const runMatch = pathname.match(/^\/payroll\/runs\/(\d+)(\/.*)?$/);
  if (runMatch) {
    const rId = Number(runMatch[1]);
    const subRoute = runMatch[2] || '';
    const rIdx = (db.payroll_runs || []).findIndex((r) => r.id === rId);
    const run = db.payroll_runs[rIdx];

    if (run) {
      if (subRoute === '/recalculate' && method === 'POST') {
        const grossTotal = (run.vouchers || []).reduce((s, v) => s + Number(v.gross_amount || 0), 0);
        const deductionsTotal = (run.vouchers || []).reduce((s, v) => s + Number(v.advance_deductions || 0), 0);
        run.gross_total = String(grossTotal.toFixed(2));
        run.deductions_total = String(deductionsTotal.toFixed(2));
        run.net_total = String((grossTotal - deductionsTotal).toFixed(2));
        recordAuditLog(db, {
          action: 'PAYROLL_RUN_RECALCULATED',
          resource_type: 'PayrollRun',
          resource_id: rId,
        });
        saveDB(db);
        return run;
      }
      if (subRoute === '/approve' && method === 'POST') {
        run.status = 'APPROVED';
        recordAuditLog(db, {
          action: 'PAYROLL_RUN_APPROVED',
          resource_type: 'PayrollRun',
          resource_id: rId,
        });
        saveDB(db);
        return run;
      }
      if (method === 'PATCH') {
        db.payroll_runs[rIdx] = { ...run, ...body, updated_at: new Date().toISOString() };
        recordAuditLog(db, {
          action: 'PAYROLL_RUN_UPDATED',
          resource_type: 'PayrollRun',
          resource_id: rId,
          changes: body,
        });
        saveDB(db);
        return db.payroll_runs[rIdx];
      }
      if (method === 'DELETE') {
        db.payroll_runs.splice(rIdx, 1);
        recordAuditLog(db, {
          action: 'PAYROLL_RUN_DELETED',
          resource_type: 'PayrollRun',
          resource_id: rId,
        });
        saveDB(db);
        return { success: true };
      }
      if (method === 'GET') {
        return run;
      }
    }
    return { success: true };
  }

  const voucherMatch = pathname.match(/^\/payroll\/vouchers\/(\d+)(\/.*)?$/);
  if (voucherMatch) {
    const vId = Number(voucherMatch[1]);
    const subRoute = voucherMatch[2] || '';

    if (subRoute === '/mark-paid' && method === 'POST') {
      let updatedVoucher = null;

      // Check in separate vouchers table if present
      const v = (db.payroll_vouchers || []).find((x) => x.id === vId);
      if (v) {
        v.status = 'PAID';
        v.payment_reference = body.payment_reference || 'REF-' + Date.now();
        updatedVoucher = v;
      }

      // Also check embedded vouchers in payroll_runs
      (db.payroll_runs || []).forEach((r) => {
        (r.vouchers || []).forEach((vx) => {
          if (vx.id === vId) {
            vx.status = 'PAID';
            vx.payment_reference = body.payment_reference || 'REF-' + Date.now();
            updatedVoucher = vx;
          }
        });
      });

      // Record in payments table as SALARY
      if (updatedVoucher) {
        db.payments.push({
          id: nextId(db.payments),
          employee: updatedVoucher.employee,
          amount: updatedVoucher.net_payable,
          payment_type: 'SALARY',
          payment_mode: 'BANK_TRANSFER',
          payment_date: new Date().toISOString().split('T')[0],
          status: 'PAID',
          reference: updatedVoucher.payment_reference,
          notes: `Payroll Voucher #${vId} Settled`,
          created_at: new Date().toISOString(),
        });
      }

      recordAuditLog(db, {
        action: 'PAYROLL_VOUCHER_PAID',
        resource_type: 'PayrollVoucher',
        resource_id: vId,
        changes: { amount: updatedVoucher?.net_payable, employee: updatedVoucher?.employee },
      });

      saveDB(db);
      return updatedVoucher || { id: vId, status: 'PAID' };
    }

    if (subRoute === '/pdf') {
      return createMockBlob(`voucher_${vId}.pdf`, 'application/pdf');
    }
  }

  if (pathname === '/payroll/advances') {
    if (method === 'GET') return (db.advances || []).filter((a) => Number(a.organization || 10) === currentOrgId);
    if (method === 'POST') {
      const adv = {
        id: nextId(db.advances),
        employee: Number(body.employee_id || body.employee),
        amount: String(Number(body.amount || 0).toFixed(2)),
        date: body.date || new Date().toISOString().split('T')[0],
        notes: body.notes || 'Payroll advance request',
        status: 'PAID',
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      };
      db.advances.push(adv);

      // Keep in sync with payments table for UPAD view
      const empAdv = (db.employees || []).find((e) => Number(e.id) === Number(adv.employee));
      const projAdvId = Number(body.project_id || body.project || empAdv?.primary_project || db.projects?.[0]?.id || 29);
      const projAdv = (db.projects || []).find((pr) => Number(pr.id) === projAdvId);

      db.payments.push({
        id: nextId(db.payments),
        employee: adv.employee,
        employee_id: adv.employee,
        employee_name: empAdv?.full_name || 'Worker',
        employee_code: empAdv?.employee_code || '',
        project: projAdvId,
        project_id: projAdvId,
        project_name: projAdv?.name || 'General Site',
        amount: adv.amount,
        payment_type: 'ADVANCE',
        type: 'advance',
        payment_mode: 'CASH',
        method: 'cash',
        payment_date: adv.date,
        date_from: adv.date,
        date_to: adv.date,
        date: adv.date,
        advance_date: adv.date,
        status: 'paid',
        notes: adv.notes,
        description: adv.notes,
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      });

      recordAuditLog(db, {
        action: 'UPAD_ADVANCE_REQUESTED',
        resource_type: 'Advance',
        resource_id: adv.id,
        changes: { employee: adv.employee, amount: adv.amount, notes: adv.notes },
      });

      saveDB(db);
      return adv;
    }
  }

  const advMatch = pathname.match(/^\/payroll\/advances\/(\d+)/);
  if (advMatch) {
    const aId = Number(advMatch[1]);
    const idx = (db.advances || []).findIndex((a) => a.id === aId);
    if (idx !== -1) {
      if (method === 'DELETE') {
        db.advances.splice(idx, 1);
        recordAuditLog(db, {
          action: 'UPAD_ADVANCE_DELETED',
          resource_type: 'Advance',
          resource_id: aId,
        });
        saveDB(db);
        return { success: true };
      }
      if (method === 'PATCH') {
        db.advances[idx] = { ...db.advances[idx], ...body };
        recordAuditLog(db, {
          action: 'UPAD_ADVANCE_UPDATED',
          resource_type: 'Advance',
          resource_id: aId,
          changes: body,
        });
        saveDB(db);
        return db.advances[idx];
      }
      if (method === 'GET') return db.advances[idx];
    }
    return { success: true };
  }

  // -------------------------------------------------------------
  // UPAD & SALARY PAYMENTS
  // -------------------------------------------------------------
  if (pathname === '/payments') {
    if (method === 'GET') {
      let list = (db.payments || []).filter((p) => Number(p.organization || 10) === currentOrgId && !p.deleted_at);
      if (params.type && params.type !== 'all') {
        list = list.filter((p) => (p.type || p.payment_type || '').toLowerCase() === params.type.toLowerCase());
      }
      if (params.project && params.project !== 'all') {
        list = list.filter((p) => Number(p.project || p.project_id) === Number(params.project));
      }
      if (params.employee && params.employee !== 'all') {
        list = list.filter((p) => Number(p.employee || p.employee_id) === Number(params.employee));
      }
      return list.map((p) => formatPaymentRecord(p, currentOrgId, db));
    }
    if (method === 'POST') {
      const empId = Number(body.employee_id || body.employee);
      const emp = (db.employees || []).find((e) => Number(e.id) === empId);
      const projId = Number(body.project_id || body.project || emp?.primary_project || db.projects?.[0]?.id || 29);
      const proj = (db.projects || []).find((pr) => Number(pr.id) === projId);

      const rawDate = body.payment_date || body.date_from || body.date_to || body.date || body.advance_date || new Date().toISOString().split('T')[0];
      const normDate = String(rawDate).split('T')[0];

      const p = {
        id: nextId(db.payments),
        employee: empId,
        employee_id: empId,
        employee_name: body.employee_name || emp?.full_name || 'Worker',
        employee_code: emp?.employee_code || '',
        project: projId,
        project_id: projId,
        project_name: body.project_name || proj?.name || 'General Site',
        amount: String(Number(body.amount || 0).toFixed(2)),
        payment_type: (body.payment_type || body.type || 'ADVANCE').toUpperCase(),
        type: (body.type || body.payment_type || 'advance').toLowerCase(),
        payment_mode: (body.payment_mode || body.method || 'UPI').toUpperCase(),
        method: (body.method || body.payment_mode || 'upi').toLowerCase(),
        payment_date: normDate,
        date_from: normDate,
        date_to: normDate,
        date: normDate,
        advance_date: normDate,
        status: (body.status || 'paid').toLowerCase(),
        notes: body.notes || body.description || 'Upad advance payment',
        description: body.description || body.notes || 'Upad advance payment',
        organization: currentOrgId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.payments.push(p);

      // If advance, also push to advances table
      if (p.payment_type === 'ADVANCE') {
        if (!db.advances) db.advances = [];
        db.advances.push({
          id: nextId(db.advances),
          employee: p.employee,
          amount: p.amount,
          date: normDate,
          notes: p.notes,
          status: 'PAID',
          organization: currentOrgId,
          created_at: new Date().toISOString(),
        });
      }

      // If salary / wage, route directly to Payment Central (Transactions) and Payroll (Vouchers)
      if (p.payment_type === 'SALARY' || p.type === 'salary' || p.payment_type === 'WAGE') {
        if (!db.transactions) db.transactions = [];
        const txId = nextId(db.transactions);
        db.transactions.push({
          id: txId,
          transaction_id: `TXN-SAL-${p.id}`,
          type: 'outgoing',
          category: 'salary',
          payer_name: 'Pragati Construction',
          payee_name: p.employee_name,
          amount: p.amount,
          method: p.method,
          status: 'completed',
          date: normDate,
          description: `[PAYROLL] Salary disbursement for ${p.employee_name}`,
          recorded_by: currentUser?.id || 1,
          recorded_by_name: currentUser?.name || 'Naresh Prajapati',
          metadata: {
            source: 'payroll',
            employee_id: empId,
            paymentType: 'salary',
            payment_id: p.id,
          },
          organization: currentOrgId,
          created_at: new Date().toISOString(),
        });

        if (!db.payroll_vouchers) db.payroll_vouchers = [];
        const vId = nextId(db.payroll_vouchers);
        db.payroll_vouchers.push({
          id: vId,
          voucher_number: `VOU-${String(vId).padStart(4, '0')}`,
          employee: empId,
          employee_name: p.employee_name,
          employee_code: p.employee_code,
          daily_rate: emp?.daily_rate,
          gross_amount: p.amount,
          gross_pay: p.amount,
          basic_pay: p.amount,
          advance_deductions: '0.00',
          net_payable: p.amount,
          net_pay: p.amount,
          payment_mode: p.payment_mode,
          status: 'PAID',
          paid_at: new Date().toISOString(),
          date: normDate,
          payment_reference: p.notes,
          organization: currentOrgId,
          project: projId,
          created_at: new Date().toISOString(),
        });
      }

      saveDB(db);
      return formatPaymentRecord(p, currentOrgId, db);
    }
  }

  if (pathname === '/payments/batch' && method === 'POST') {
    const list = body.payments || [];
    for (const item of list) {
      db.payments.push({
        id: nextId(db.payments),
        ...item,
        status: 'PAID',
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      });
    }
    saveDB(db);
    return { success: true, count: list.length };
  }

  if (pathname === '/payments/summary') {
    const list = (db.payments || []).filter((p) => Number(p.organization || 10) === currentOrgId);
    const advances = list.filter((p) => p.payment_type === 'ADVANCE');
    const totalAdvances = advances.reduce((s, p) => s + Number(p.amount || 0), 0);
    const settled = list.filter((p) => p.status === 'PAID');
    const totalSettled = settled.reduce((s, p) => s + Number(p.amount || 0), 0);
    return {
      total_advances: totalAdvances,
      total_settled: totalSettled,
      pending_count: list.filter((p) => p.status === 'PENDING').length,
    };
  }

  if (pathname === '/payments/calculate-salary') {
    const eId = Number(params.employee_id);
    const emp = (db.employees || []).find((e) => e.id === eId);
    const rate = Number(emp?.daily_rate || 800);
    const days = 6;
    const earned = days * rate;
    const advances = (db.payments || [])
      .filter((p) => p.employee === eId && p.payment_type === 'ADVANCE')
      .reduce((s, p) => s + Number(p.amount || 0), 0);

    return {
      daily_rate: rate,
      days_worked: days,
      gross_amount: earned,
      advance_deductions: advances,
      net_payable: Math.max(0, earned - advances),
    };
  }

  if (pathname === '/payments/remaining-salary') {
    const list = (db.payments || []).filter((p) => Number(p.organization || 10) === currentOrgId);
    const settled = list.filter((p) => p.status === 'PAID');
    return {
      remaining_amount: currentOrgId === 10 ? 15400 : 0,
      settled_count: settled.length,
    };
  }

  const pmtMatch = pathname.match(/^\/payments\/(\d+)(\/.*)?$/);
  if (pmtMatch) {
    const pId = Number(pmtMatch[1]);
    const subRoute = pmtMatch[2] || '';
    const idx = (db.payments || []).findIndex((p) => p.id === pId);
    if (idx !== -1) {
      if (subRoute === '/approve') {
        db.payments[idx].status = 'APPROVED';
        recordAuditLog(db, { action: 'PAYMENT_APPROVED', resource_type: 'Payment', resource_id: pId });
      } else if (subRoute === '/reject') {
        db.payments[idx].status = 'REJECTED';
        db.payments[idx].rejection_reason = body.reason || '';
        recordAuditLog(db, { action: 'PAYMENT_REJECTED', resource_type: 'Payment', resource_id: pId, changes: { reason: body.reason } });
      } else if (subRoute === '/process') {
        db.payments[idx].status = 'PAID';
        recordAuditLog(db, { action: 'PAYMENT_PROCESSED', resource_type: 'Payment', resource_id: pId });
      } else if (method === 'PATCH') {
        db.payments[idx] = { ...db.payments[idx], ...body, updated_at: new Date().toISOString() };
        recordAuditLog(db, { action: 'PAYMENT_UPDATED', resource_type: 'Payment', resource_id: pId, changes: body });
      } else if (method === 'DELETE') {
        db.payments.splice(idx, 1);
        recordAuditLog(db, { action: 'PAYMENT_DELETED', resource_type: 'Payment', resource_id: pId });
        saveDB(db);
        return { success: true };
      }
      saveDB(db);
      return db.payments[idx];
    }
    return { success: true };
  }

  // -------------------------------------------------------------
  // PAYMENT CENTRAL / TRANSACTIONS
  // -------------------------------------------------------------
  if (pathname === '/transactions') {
    if (method === 'GET') {
      const list = (db.transactions || []).filter((t) => Number(t.organization || 10) === currentOrgId);
      list.forEach((t) => {
        if (!t.recorded_by_name) {
          const rec = Array.isArray(t.recorded_by) ? t.recorded_by[0] : t.recorded_by;
          const u = (db.users || []).find((usr) => usr.email === rec || usr.id === rec);
          if (u) {
            t.recorded_by_name = u.name;
          } else if (currentUser?.name) {
            t.recorded_by_name = currentUser.name;
          }
        }
      });
      return list;
    }
    if (method === 'POST') {
      const tx = {
        id: nextId(db.transactions),
        ...body,
        recorded_by: body.recorded_by || currentUser?.id,
        recorded_by_name: body.recorded_by_name || currentUser?.name || currentUser?.email || 'Admin',
        amount: String(Number(body.amount || 0).toFixed(2)),
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      };
      db.transactions.push(tx);
      recordAuditLog(db, { action: 'TRANSACTION_RECORDED', resource_type: 'Transaction', resource_id: tx.id, changes: { amount: tx.amount, type: tx.type, category: tx.category } });
      saveDB(db);
      return tx;
    }
  }

  const txMatch = pathname.match(/^\/transactions\/(\d+)(\/.*)?$/);
  if (txMatch) {
    const tId = Number(txMatch[1]);
    const idx = (db.transactions || []).findIndex((t) => t.id === tId);
    if (idx !== -1) {
      if (method === 'PATCH') {
        db.transactions[idx] = { ...db.transactions[idx], ...body, updated_at: new Date().toISOString() };
        recordAuditLog(db, { action: 'TRANSACTION_UPDATED', resource_type: 'Transaction', resource_id: tId, changes: body });
        saveDB(db);
        return db.transactions[idx];
      }
      if (method === 'DELETE') {
        db.transactions.splice(idx, 1);
        recordAuditLog(db, { action: 'TRANSACTION_DELETED', resource_type: 'Transaction', resource_id: tId });
        saveDB(db);
        return { success: true };
      }
      if (method === 'GET') {
        return db.transactions[idx];
      }
    }
    return { success: true };
  }

  if (pathname === '/transactions/summary') {
    const list = (db.transactions || []).filter((t) => Number(t.organization || 10) === currentOrgId);
    const inflow = list.filter((t) => t.type === 'INFLOW').reduce((s, t) => s + Number(t.amount || 0), 0);
    const outflow = list.filter((t) => t.type === 'OUTFLOW').reduce((s, t) => s + Number(t.amount || 0), 0);
    return {
      total_inflow: inflow,
      total_outflow: outflow,
      net_balance: inflow - outflow,
    };
  }

  // -------------------------------------------------------------
  // CREDITS & RUNNING COSTS
  // -------------------------------------------------------------
  if (pathname === '/credit-logs') {
    if (method === 'GET') return (db.credit_logs || []).filter((c) => Number(c.organization || 10) === currentOrgId);
    if (method === 'POST') {
      const log = {
        id: nextId(db.credit_logs),
        ...body,
        amount: String(Number(body.amount || 0).toFixed(2)),
        remaining_balance: String(Number(body.amount || 0).toFixed(2)),
        expenses: [],
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      };
      db.credit_logs.push(log);
      recordAuditLog(db, { action: 'CREDIT_LOG_RECORDED', resource_type: 'CreditLog', resource_id: log.id, changes: { vendor: log.vendor, amount: log.amount } });
      saveDB(db);
      return log;
    }
  }

  const clMatch = pathname.match(/^\/credit-logs\/(\d+)(\/.*)?$/);
  if (clMatch) {
    const clId = Number(clMatch[1]);
    const subRoute = clMatch[2] || '';
    const idx = (db.credit_logs || []).findIndex((c) => c.id === clId);

    if (idx !== -1) {
      const log = db.credit_logs[idx];
      if (!log.expenses) log.expenses = [];

      const expSubMatch = subRoute.match(/^\/expenses(\/(\d+))?$/);
      if (expSubMatch) {
        const expSubId = expSubMatch[2] ? Number(expSubMatch[2]) : null;
        if (method === 'POST') {
          const deductionAmt = Number(body.amount || 0);
          const expEntry = {
            id: nextId(log.expenses),
            amount: String(deductionAmt.toFixed(2)),
            description: body.description || '',
            date: body.date || new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString(),
          };
          log.expenses.push(expEntry);
          const curBal = Number(log.remaining_balance !== undefined ? log.remaining_balance : log.amount);
          log.remaining_balance = String(Math.max(0, curBal - deductionAmt).toFixed(2));
          recordAuditLog(db, { action: 'CREDIT_DEDUCTION_RECORDED', resource_type: 'CreditLog', resource_id: clId, changes: { amount: deductionAmt } });
          saveDB(db);
          return expEntry;
        }
        if (method === 'DELETE' && expSubId) {
          const eIdx = log.expenses.findIndex((e) => e.id === expSubId);
          if (eIdx !== -1) {
            const restoredAmt = Number(log.expenses[eIdx].amount || 0);
            log.expenses.splice(eIdx, 1);
            const curBal = Number(log.remaining_balance !== undefined ? log.remaining_balance : 0);
            log.remaining_balance = String((curBal + restoredAmt).toFixed(2));
            recordAuditLog(db, { action: 'CREDIT_DEDUCTION_CANCELLED', resource_type: 'CreditLog', resource_id: clId, changes: { restored_amount: restoredAmt } });
            saveDB(db);
          }
          return { success: true };
        }
      }

      if (method === 'PATCH') {
        db.credit_logs[idx] = { ...log, ...body, updated_at: new Date().toISOString() };
        recordAuditLog(db, { action: 'CREDIT_LOG_UPDATED', resource_type: 'CreditLog', resource_id: clId, changes: body });
        saveDB(db);
        return db.credit_logs[idx];
      }
      if (method === 'DELETE') {
        db.credit_logs.splice(idx, 1);
        recordAuditLog(db, { action: 'CREDIT_LOG_DELETED', resource_type: 'CreditLog', resource_id: clId });
        saveDB(db);
        return { success: true };
      }
      if (method === 'GET') {
        return log;
      }
    }
    return { success: true };
  }

  if (pathname === '/credit-logs/summary') {
    const logs = (db.credit_logs || []).filter((c) => Number(c.organization || 10) === currentOrgId);
    const totalCredits = logs.reduce((s, c) => s + Number(c.amount || 0), 0);
    const remaining = logs.reduce((s, c) => s + Number(c.remaining_balance !== undefined ? c.remaining_balance : c.amount || 0), 0);
    const spent = totalCredits - remaining;
    return {
      total_credits: totalCredits,
      total_spent: spent,
      remaining: remaining,
    };
  }

  if (pathname === '/running-costs') {
    if (method === 'GET') return (db.running_costs || []).filter((r) => Number(r.organization || 10) === currentOrgId);
    if (method === 'POST') {
      const rc = {
        id: nextId(db.running_costs),
        ...body,
        amount: String(Number(body.amount || 0).toFixed(2)),
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      };
      db.running_costs.push(rc);
      recordAuditLog(db, { action: 'RUNNING_COST_RECORDED', resource_type: 'RunningCost', resource_id: rc.id, changes: { amount: rc.amount, category: rc.category } });
      saveDB(db);
      return rc;
    }
  }

  const rcMatch = pathname.match(/^\/running-costs\/(\d+)/);
  if (rcMatch) {
    const rcId = Number(rcMatch[1]);
    const idx = (db.running_costs || []).findIndex((r) => r.id === rcId);
    if (idx !== -1) {
      if (method === 'PATCH') {
        db.running_costs[idx] = { ...db.running_costs[idx], ...body, updated_at: new Date().toISOString() };
        recordAuditLog(db, { action: 'RUNNING_COST_UPDATED', resource_type: 'RunningCost', resource_id: rcId, changes: body });
        saveDB(db);
        return db.running_costs[idx];
      }
      if (method === 'DELETE') {
        db.running_costs.splice(idx, 1);
        recordAuditLog(db, { action: 'RUNNING_COST_DELETED', resource_type: 'RunningCost', resource_id: rcId });
        saveDB(db);
        return { success: true };
      }
      if (method === 'GET') {
        return db.running_costs[idx];
      }
    }
    return { success: true };
  }

  if (pathname === '/running-costs/summary') {
    const costs = (db.running_costs || []).filter((r) => Number(r.organization || 10) === currentOrgId);
    const totalAmount = costs.reduce((s, c) => s + Number(c.amount || 0), 0);
    return {
      total_amount: totalAmount,
      count: costs.length,
      total_running_costs: totalAmount,
      monthly_average: costs.length > 0 ? Math.round(totalAmount / 3) : 0,
    };
  }

  // -------------------------------------------------------------
  // DOUBLE-ENTRY LEDGER
  // -------------------------------------------------------------
  if (pathname === '/ledger/accounts') {
    if (method === 'GET') {
      let accs = (db.accounts || []).filter((a) => Number(a.organization || 10) === currentOrgId);
      if (accs.length === 0) {
        createDefaultAccountsForOrg(db, currentOrgId);
        saveDB(db);
        accs = (db.accounts || []).filter((a) => Number(a.organization || 10) === currentOrgId);
      }
      return accs;
    }
    if (method === 'POST') {
      const acc = {
        id: nextId(db.accounts),
        ...body,
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      };
      db.accounts.push(acc);
      recordAuditLog(db, { action: 'LEDGER_ACCOUNT_CREATED', resource_type: 'Account', resource_id: acc.id, changes: { name: acc.name, code: acc.code, type: acc.type } });
      saveDB(db);
      return acc;
    }
  }

  if (pathname === '/ledger/entries') {
    if (method === 'GET') {
      return (db.journal_entries || [])
        .filter((je) => Number(je.organization || 10) === currentOrgId)
        .map((je) => ({
          ...je,
          lines: (db.journal_lines || []).filter((l) => l.entry === je.id),
        }));
    }
    if (method === 'POST') {
      const je = {
        id: nextId(db.journal_entries),
        entry_number: `JE-${Date.now()}`,
        date: body.date || new Date().toISOString().split('T')[0],
        narration: body.narration || '',
        reference_number: body.reference_number || '',
        organization: currentOrgId,
        created_at: new Date().toISOString(),
      };
      db.journal_entries.push(je);

      if (Array.isArray(body.lines)) {
        if (!db.journal_lines) db.journal_lines = [];
        body.lines.forEach((line) => {
          db.journal_lines.push({
            id: nextId(db.journal_lines),
            entry: je.id,
            account: line.account,
            debit: line.debit || '0.00',
            credit: line.credit || '0.00',
          });
        });
      }
      recordAuditLog(db, { action: 'JOURNAL_ENTRY_POSTED', resource_type: 'JournalEntry', resource_id: je.id, changes: { entry_number: je.entry_number, narration: je.narration, lines_count: (body.lines || []).length } });
      saveDB(db);
      return je;
    }
  }

  if (pathname === '/ledger/trial-balance') {
    const accounts = (db.accounts || []).filter((a) => Number(a.organization || 10) === currentOrgId);
    return {
      as_of_date: new Date().toISOString().split('T')[0],
      total_debit: 1550000,
      total_credit: 1550000,
      is_balanced: true,
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        code: a.code,
        type: a.type,
        debit: a.type === 'ASSET' || a.type === 'EXPENSE' ? 120000 : 0,
        credit: a.type === 'LIABILITY' || a.type === 'EQUITY' || a.type === 'REVENUE' ? 120000 : 0,
      })),
    };
  }

  if (pathname === '/ledger/profit-loss') {
    if (currentOrgId !== 10) {
      const orgExps = (db.expenses || []).filter((e) => Number(e.organization || 10) === currentOrgId);
      const totalExp = orgExps.reduce((s, e) => s + Number(e.amount || 0), 0);
      return {
        period_start: '2026-01-01',
        period_end: new Date().toISOString().split('T')[0],
        total_revenue: 0,
        total_expenses: totalExp,
        net_profit: -totalExp,
        revenue_breakdown: [],
        expense_breakdown: orgExps.slice(0, 5).map((e) => ({ category: e.category, amount: Number(e.amount || 0) })),
      };
    }
    return {
      period_start: '2026-01-01',
      period_end: new Date().toISOString().split('T')[0],
      total_revenue: 2500000,
      total_expenses: 850000,
      net_profit: 1650000,
      revenue_breakdown: [{ category: 'Contract Billing', amount: 2500000 }],
      expense_breakdown: [
        { category: 'Material', amount: 450000 },
        { category: 'Labor & Wages', amount: 320000 },
        { category: 'Equipment & Running', amount: 80000 },
      ],
    };
  }

  if (pathname === '/ledger/balance-sheet') {
    if (currentOrgId !== 10) {
      return {
        as_of_date: new Date().toISOString().split('T')[0],
        total_assets: 0,
        total_liabilities: 0,
        total_equity: 0,
        is_balanced: true,
        assets: [],
        liabilities: [],
        equity: [],
      };
    }
    return {
      as_of_date: new Date().toISOString().split('T')[0],
      total_assets: 3500000,
      total_liabilities: 1200000,
      total_equity: 2300000,
      is_balanced: true,
      assets: [
        { name: 'Cash in Hand', amount: 150000 },
        { name: 'Bank Accounts (HDFC / SBI)', amount: 2450000 },
        { name: 'Project WIP & Inventory', amount: 900000 },
      ],
      liabilities: [
        { name: 'Vendor Payables', amount: 800000 },
        { name: 'Wages Payable', amount: 400000 },
      ],
      equity: [
        { name: "Owner's Equity & Retained Earnings", amount: 2300000 },
      ],
    };
  }

  // -------------------------------------------------------------
  // ORGANIZATION & INVITATIONS
  // -------------------------------------------------------------
  if (pathname === '/org/current') {
    let org = (db.organizations || []).find((o) => Number(o.id) === currentOrgId);
    if (!org) {
      org = {
        id: currentOrgId,
        name: currentOrgId === 10 ? 'BuildSphere org.' : 'My Organization',
        currency: 'INR',
        workday_hours: '8.00',
        half_day_hours: '4.00',
        overtime_after_hours: '8.00',
        expense_approval_limit: '1000.00',
        is_active: true,
      };
      if (!db.organizations) db.organizations = [];
      db.organizations.push(org);
    }
    if (method === 'PATCH') {
      Object.assign(org, body);
      saveDB(db);
    }
    return org;
  }

  if (pathname === '/org/invitations') {
    if (method === 'GET') return (db.invitations || []).filter((i) => Number(i.organization || 10) === currentOrgId);
    if (method === 'POST') {
      const inv = {
        id: nextId(db.invitations),
        name: body.name || 'Team Member',
        email: body.email,
        role: body.role || 'SITE_ENGINEER',
        organization: currentOrgId,
        status: 'PENDING',
        invited_at: new Date().toISOString(),
      };
      db.invitations.push(inv);

      // Automated invitation email delivery dispatch
      db.dispatched_emails = db.dispatched_emails || [];
      const emailRecord = {
        id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        created_at: new Date().toISOString(),
        recipient: body.email,
        member_name: body.name || 'Team Member',
        member_email: body.email,
        role: body.role || 'SITE_ENGINEER',
        password: '(Set via Invitation Link)',
        subject: `BuildSphere Invitation: Join ${currentOrg?.name || 'BuildSphere'} as ${body.role || 'Site Engineer'}`,
        status: 'DELIVERED',
        delivery_provider: localStorage.getItem('cmp_resend_api_key') ? 'Resend' : 'BuildSphere Outbox',
        login_url: typeof window !== 'undefined' ? `${window.location.origin}/login?invite=${inv.id}` : 'https://buildsphere.com',
      };
      db.dispatched_emails.unshift(emailRecord);

      saveDB(db);
      return { ...inv, dispatched_email: emailRecord };
    }
  }

  if (pathname === '/org/dispatched-emails') {
    if (method === 'GET') {
      return (db.dispatched_emails || []).filter((e) => Number(e.organization || 10) === currentOrgId);
    }
    if (method === 'DELETE') {
      db.dispatched_emails = [];
      saveDB(db);
      return { success: true };
    }
  }

  if (pathname === '/org/resend-credentials' && method === 'POST') {
    const user = (db.users || []).find(
      (u) => String(u.id) === String(body.user_id) || u.email === body.email
    );
    if (!user) throw new Error('User not found');

    const tempPassword = user.password || 'BuildSphere@2026';
    const targetEmail = (body.notification_email || user.notification_email || user.email || '').trim();

    db.dispatched_emails = db.dispatched_emails || [];
    const emailRecord = {
      id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
      recipient: targetEmail,
      member_name: user.name || 'Team Member',
      member_email: user.email,
      role: user.role,
      password: tempPassword,
      subject: `[Resent] Your BuildSphere Login Credentials (${user.name || user.email})`,
      status: 'DELIVERED',
      delivery_provider: localStorage.getItem('cmp_resend_api_key') ? 'Resend' : 'BuildSphere Outbox',
      login_url: typeof window !== 'undefined' ? window.location.origin : 'https://buildsphere.com',
    };
    db.dispatched_emails.unshift(emailRecord);
    saveDB(db);
    return { success: true, dispatched_email: emailRecord };
  }

  const invMatch = pathname.match(/^\/org\/invitations\/(\d+)(\/.*)?$/);
  if (invMatch) {
    const invId = Number(invMatch[1]);
    const subRoute = invMatch[2] || '';
    const idx = (db.invitations || []).findIndex((i) => i.id === invId);
    if (idx !== -1) {
      if (subRoute === '/resend' && method === 'POST') {
        db.invitations[idx].invited_at = new Date().toISOString();
        saveDB(db);
        return { success: true, message: 'Invitation resent' };
      }
      if (method === 'DELETE') {
        db.invitations.splice(idx, 1);
        saveDB(db);
        return { success: true };
      }
      if (method === 'GET') {
        return db.invitations[idx];
      }
    }
    return { success: true };
  }

  // -------------------------------------------------------------
  // AUDIT & ACTIVITY TRAIL (GUARANTEES PERSISTENCE OF EVERY ROLE ACTION)
  // -------------------------------------------------------------
  if (pathname === '/audit/logs') {
    if (method === 'GET') {
      let list = (db.audit_logs || []).filter((l) => Number(l.organization || 10) === currentOrgId);
      const roleFilter = params.role;
      const resourceFilter = params.resource_type;
      const actionFilter = params.action;
      const search = (params.search || '').toLowerCase().trim();

      if (roleFilter && roleFilter !== 'ALL') {
        list = list.filter((l) => (l.metadata?.actor_role || '').toLowerCase() === roleFilter.toLowerCase());
      }
      if (resourceFilter && resourceFilter !== 'ALL') {
        list = list.filter((l) => (l.resource_type || '').toLowerCase() === resourceFilter.toLowerCase());
      }
      if (actionFilter && actionFilter !== 'ALL') {
        list = list.filter((l) => (l.action || '').toLowerCase().includes(actionFilter.toLowerCase()));
      }
      if (search) {
        list = list.filter((l) =>
          (l.action || '').toLowerCase().includes(search) ||
          (l.resource_type || '').toLowerCase().includes(search) ||
          (l.resource_id || '').toLowerCase().includes(search) ||
          (l.metadata?.actor_name || '').toLowerCase().includes(search) ||
          (l.metadata?.actor_role || '').toLowerCase().includes(search) ||
          (l.actor && l.actor.some((a) => a.toLowerCase().includes(search))) ||
          JSON.stringify(l.changes || {}).toLowerCase().includes(search)
        );
      }

      const total = list.length;
      const limit = params.limit ? Number(params.limit) : 100;
      const results = list.slice(0, limit);

      return {
        count: total,
        results,
      };
    }

    if (method === 'DELETE') {
      db.audit_logs = [];
      saveDB(db);
      return { success: true, message: 'Audit logs cleared' };
    }
  }

  if (pathname === '/audit/stats') {
    const list = (db.audit_logs || []).filter((l) => Number(l.organization || 10) === currentOrgId);
    const roleCounts = {};
    const resourceCounts = {};
    const actionCounts = {};

    list.forEach((l) => {
      const r = l.metadata?.actor_role || 'UNKNOWN';
      roleCounts[r] = (roleCounts[r] || 0) + 1;

      const res = l.resource_type || 'Other';
      resourceCounts[res] = (resourceCounts[res] || 0) + 1;

      const act = l.action || 'Other';
      actionCounts[act] = (actionCounts[act] || 0) + 1;
    });

    return {
      total_actions: list.length,
      by_role: roleCounts,
      by_resource: resourceCounts,
      by_action: actionCounts,
      last_activity: list[0] || null,
      is_persistent: true,
      storage_engine: 'LocalStorage + Django ORM Parity',
    };
  }

  // -------------------------------------------------------------
  // AI COST ESTIMATOR PERSISTENCE
  // -------------------------------------------------------------
  if (pathname === '/cost-estimator/estimates') {
    if (method === 'GET') {
      return (db.cost_estimates || []).filter((e) => Number(e.organization || 10) === currentOrgId);
    }
    if (method === 'POST') {
      if (!db.cost_estimates) db.cost_estimates = [];
      const newEst = {
        id: nextId(db.cost_estimates),
        ...body,
        organization: currentOrgId,
        created_at: body.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.cost_estimates.unshift(newEst);
      recordAuditLog(db, {
        action: 'COST_ESTIMATE_SAVED',
        resource_type: 'CostEstimate',
        resource_id: newEst.id,
        changes: {
          project_name: newEst.project_name,
          city: newEst.city,
          grand_total: newEst.grand_total,
          margin_percent: newEst.margin_percent,
        },
        metadata: {
          quality_level: newEst.quality_level,
          project_type: newEst.project_type,
        },
      });
      saveDB(db);
      return newEst;
    }
  }

  const estMatch = pathname.match(/^\/cost-estimator\/estimates\/(\d+)/);
  if (estMatch) {
    const estId = Number(estMatch[1]);
    const estIdx = (db.cost_estimates || []).findIndex((e) => e.id === estId);
    if (estIdx !== -1) {
      if (method === 'GET') return db.cost_estimates[estIdx];
      if (method === 'PATCH') {
        db.cost_estimates[estIdx] = {
          ...db.cost_estimates[estIdx],
          ...body,
          updated_at: new Date().toISOString(),
        };
        recordAuditLog(db, {
          action: 'COST_ESTIMATE_UPDATED',
          resource_type: 'CostEstimate',
          resource_id: estId,
          changes: body,
        });
        saveDB(db);
        return db.cost_estimates[estIdx];
      }
      if (method === 'DELETE') {
        db.cost_estimates.splice(estIdx, 1);
        recordAuditLog(db, {
          action: 'COST_ESTIMATE_DELETED',
          resource_type: 'CostEstimate',
          resource_id: estId,
        });
        saveDB(db);
        return { success: true };
      }
    }
    return { success: true };
  }

  // -------------------------------------------------------------
  // REPORTS EXPORTS (PDF & EXCEL DOWNLOADS)
  // -------------------------------------------------------------
  if (pathname.startsWith('/reports/')) {
    recordAuditLog(db, {
      action: 'REPORT_EXPORTED',
      resource_type: 'Report',
      resource_id: pathname,
      metadata: {
        endpoint: pathname,
        format: pathname.includes('pdf') ? 'PDF' : 'EXCEL',
      },
    });
    if (pathname.includes('/pdf')) {
      return createMockBlob('report.pdf', 'application/pdf');
    }
    if (pathname.includes('/excel')) {
      return createMockBlob('report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
  }

  // Default empty fallback for any unhandled GET/POST/PATCH/DELETE
  console.warn(`[MockBackend] Unhandled endpoint: ${method} ${pathname}`);
  return { success: true };
}
