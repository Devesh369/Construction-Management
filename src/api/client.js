/**
 * BuildPulse CMP — Unified API Client
 * Connects to Django REST Framework backend with JWT authentication and file handling.
 */

const API_BASE = '/api/v1';

// Token storage helpers
export const getToken = () => localStorage.getItem('cmp_access_token') || '';
export const setToken = (token) => {
  if (token) localStorage.setItem('cmp_access_token', token);
  else localStorage.removeItem('cmp_access_token');
};

export const getRefreshToken = () => localStorage.getItem('cmp_refresh_token') || '';
export const setRefreshToken = (token) => {
  if (token) localStorage.setItem('cmp_refresh_token', token);
  else localStorage.removeItem('cmp_refresh_token');
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('cmp_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user) => {
  if (user) localStorage.setItem('cmp_user', JSON.stringify(user));
  else localStorage.removeItem('cmp_user');
};

import { handleMockRequest } from './mockBackend';

/**
 * Universal request wrapper delegating to in-browser mock backend engine
 * with full localStorage persistence and preloaded Django data.
 */
export async function apiRequest(endpoint, options = {}) {
  try {
    return await handleMockRequest(endpoint, options);
  } catch (err) {
    console.error(`Mock API Error on ${endpoint}:`, err);
    throw err;
  }
}

// Domain API endpoints
export const api = {
  // Authentication & Session
  auth: {
    getSystemStatus: () => apiRequest('/auth/system-status'),
    setupAdmin: async (data) => {
      const res = await apiRequest('/auth/setup-admin', {
        method: 'POST',
        body: data,
      });
      if (res?.access) setToken(res.access);
      if (res?.refresh) setRefreshToken(res.refresh);
      return res;
    },
    login: async (email, password) => {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      if (res?.access) setToken(res.access);
      if (res?.refresh) setRefreshToken(res.refresh);
      return res;
    },
    refresh: async () => {
      const refreshToken = getRefreshToken();
      const res = await apiRequest('/auth/refresh', {
        method: 'POST',
        body: refreshToken ? { refresh: refreshToken } : {},
      });
      if (res?.access) setToken(res.access);
      if (res?.refresh) setRefreshToken(res.refresh);
      return res;
    },
    logout: async () => {
      try {
        const refreshToken = getRefreshToken();
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: refreshToken ? { refresh: refreshToken } : {},
        });
      } catch (err) {
        console.warn('Logout API error:', err);
      } finally {
        setToken(null);
        setRefreshToken(null);
        setStoredUser(null);
      }
    },
    me: () => apiRequest('/users/me'),
    updateMe: (data) =>
      apiRequest('/users/me', {
        method: 'PATCH',
        body: data,
      }),
    acceptInvite: (token, password, name, email) =>
      apiRequest('/auth/accept-invite', {
        method: 'POST',
        body: { token, password, name, email },
      }),
    getTeam: () => apiRequest('/users'),
  },

  // Dashboard & KPIs
  dashboard: {
    getOverview: (projectId = null, refresh = false) => {
      let q = [];
      if (projectId) q.push(`project=${projectId}`);
      if (refresh) q.push(`refresh=true`);
      const query = q.length ? `?${q.join('&')}` : '';
      return apiRequest(`/dashboard/overview${query}`);
    },
  },

  // Projects
  projects: {
    list: () => apiRequest('/projects'),
    get: (id) => apiRequest(`/projects/${id}`),
    create: (data) => apiRequest('/projects', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/projects/${id}`, { method: 'PATCH', body: data }),
    getMembers: (id) => apiRequest(`/projects/${id}/members`),
    addMember: (id, data) =>
      apiRequest(`/projects/${id}/members`, { method: 'POST', body: data }),
  },

  // Workforce
  workforce: {
    listEmployees: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/employees${q ? `?${q}` : ''}`);
    },
    getEmployee: (id) => apiRequest(`/employees/${id}`),
    createEmployee: (data) => apiRequest('/employees', { method: 'POST', body: data }),
    updateEmployee: (id, data) => apiRequest(`/employees/${id}`, { method: 'PATCH', body: data }),
    deleteEmployee: (id) => apiRequest(`/employees/${id}`, { method: 'DELETE' }),
    assignProject: (id, projectId) =>
      apiRequest(`/employees/${id}/assign-project`, {
        method: 'POST',
        body: { project_id: projectId },
      }),
    unassignProject: (id, projectId) =>
      apiRequest(`/employees/${id}/unassign-project`, {
        method: 'POST',
        body: { project_id: projectId },
      }),
    payEmployee: (id, data) =>
      apiRequest(`/employees/${id}/pay`, {
        method: 'POST',
        body: data,
      }),
    recordUpad: (id, data) =>
      apiRequest(`/employees/${id}/upad`, {
        method: 'POST',
        body: data,
      }),
    getPaymentHistory: (id) => apiRequest(`/employees/${id}/payment-history`),
    getFinancials: (id) => apiRequest(`/employees/${id}/financials`),
    listLaborGroups: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/labor-groups${q ? `?${q}` : ''}`);
    },
    createLaborGroup: (data) => apiRequest('/labor-groups', { method: 'POST', body: data }),
    deleteLaborGroup: (id) => apiRequest(`/labor-groups/${id}`, { method: 'DELETE' }),
    addGangMembers: (id, employeeIds) =>
      apiRequest(`/labor-groups/${id}/members`, {
        method: 'POST',
        body: { employee_ids: employeeIds },
      }),
  },

  // Attendance
  attendance: {
    checkIn: (data) =>
      apiRequest('/attendance/check-in', {
        method: 'POST',
        body: data,
      }),
    batchMark: (data) =>
      apiRequest('/attendance/batch', {
        method: 'POST',
        body: data,
      }),
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/attendance${q ? `?${q}` : ''}`);
    },
    delete: (id) =>
      apiRequest(`/attendance/${id}`, {
        method: 'DELETE',
      }),
    summary: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/attendance/summary${q ? `?${q}` : ''}`);
    },
    report: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/attendance/report${q ? `?${q}` : ''}`);
    },
    approveDay: (projectId, date) =>
      apiRequest('/attendance/approve', {
        method: 'POST',
        body: { project_id: projectId, date },
      }),
    listNightShifts: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/night-shifts${q ? `?${q}` : ''}`);
    },
    createNightShift: (data) =>
      apiRequest('/night-shifts', {
        method: 'POST',
        body: data,
      }),
    endNightShift: (id, data) =>
      apiRequest(`/night-shifts/${id}/complete`, {
        method: 'PATCH',
        body: data,
      }),
    listHolidays: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/holidays${q ? `?${q}` : ''}`);
    },
    createHoliday: (data) =>
      apiRequest('/holidays', {
        method: 'POST',
        body: data,
      }),
    deleteHoliday: (id) =>
      apiRequest(`/holidays/${id}`, {
        method: 'DELETE',
      }),
  },

  // Daily Progress Reports (DPR)
  progress: {
    listDPR: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/dpr${q ? `?${q}` : ''}`);
    },
    getDPR: (id) => apiRequest(`/dpr/${id}`),
    createDPR: (data) => apiRequest('/dpr', { method: 'POST', body: data }),
    verifyDPR: (id) =>
      apiRequest(`/dpr/${id}/verify`, {
        method: 'POST',
        body: {},
      }),
    rejectDPR: (id, reason) =>
      apiRequest(`/dpr/${id}/reject`, {
        method: 'POST',
        body: { reason },
      }),
  },

  // Work Management (Daily work entries by project and employee)
  workEntries: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/work-entries${q ? `?${q}` : ''}`);
    },
    get: (id) => apiRequest(`/work-entries/${id}`),
    create: (data) => apiRequest('/work-entries', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/work-entries/${id}`, { method: 'PATCH', body: data }),
    delete: (id) => apiRequest(`/work-entries/${id}`, { method: 'DELETE' }),
    getPresentEmployees: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/work-entries/present-employees${q ? `?${q}` : ''}`);
    },
  },

  // Expenses & Vendors
  expenses: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/expenses${q ? `?${q}` : ''}`);
    },
    create: (formDataOrData) =>
      apiRequest('/expenses', {
        method: 'POST',
        body: formDataOrData,
      }),
    approve: (id) =>
      apiRequest(`/expenses/${id}/approve`, {
        method: 'POST',
        body: {},
      }),
    reject: (id, reason) =>
      apiRequest(`/expenses/${id}/reject`, {
        method: 'POST',
        body: { reason },
      }),
    listVendors: () => apiRequest('/vendors'),
    createVendor: (data) => apiRequest('/vendors', { method: 'POST', body: data }),
    getVendorLedger: (id) => apiRequest(`/vendors/${id}/ledger`),
    recordVendorPayment: (id, data) =>
      apiRequest(`/vendors/${id}/payments`, {
        method: 'POST',
        body: data,
      }),
  },

  // Payroll
  payroll: {
    listRuns: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/payroll/runs${q ? `?${q}` : ''}`);
    },
    createRun: (data) =>
      apiRequest('/payroll/runs', {
        method: 'POST',
        body: data,
      }),
    recalculateRun: (id) =>
      apiRequest(`/payroll/runs/${id}/recalculate`, {
        method: 'POST',
        body: {},
      }),
    approveRun: (id) =>
      apiRequest(`/payroll/runs/${id}/approve`, {
        method: 'POST',
        body: {},
      }),
    deleteRun: (id) =>
      apiRequest(`/payroll/runs/${id}`, {
        method: 'DELETE',
      }),
    markVoucherPaid: (id, ref) =>
      apiRequest(`/payroll/vouchers/${id}/mark-paid`, {
        method: 'POST',
        body: { payment_reference: ref },
      }),
    downloadVoucherPdf: (id) => apiRequest(`/payroll/vouchers/${id}/pdf`),
    listAdvances: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/payroll/advances${q ? `?${q}` : ''}`);
    },
    createAdvance: (data) =>
      apiRequest('/payroll/advances', {
        method: 'POST',
        body: data,
      }),
    deleteAdvance: (id) => apiRequest(`/payroll/advances/${id}`, { method: 'DELETE' }),
  },

  // Double-Entry Ledger
  ledger: {
    getAccounts: () => apiRequest('/ledger/accounts'),
    getJournalEntries: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/ledger/entries${q ? `?${q}` : ''}`);
    },
    getTrialBalance: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/ledger/trial-balance${q ? `?${q}` : ''}`);
    },
    getProfitLoss: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/ledger/profit-loss${q ? `?${q}` : ''}`);
    },
    getBalanceSheet: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/ledger/balance-sheet${q ? `?${q}` : ''}`);
    },
  },

  // Organization & Invitations
  org: {
    getCurrent: () => apiRequest('/org/current'),
    updateCurrent: (data) => apiRequest('/org/current', { method: 'PATCH', body: data }),
    listInvitations: () => apiRequest('/org/invitations'),
    createInvitation: (data) => apiRequest('/org/invitations', { method: 'POST', body: data }),
    resendInvitation: (id) => apiRequest(`/org/invitations/${id}/resend`, { method: 'POST' }),
    listDispatchedEmails: () => apiRequest('/org/dispatched-emails'),
    clearDispatchedEmails: () => apiRequest('/org/dispatched-emails', { method: 'DELETE' }),
    resendCredentials: (data) => apiRequest('/org/resend-credentials', { method: 'POST', body: data }),
  },

  // Users (Team Member Management)
  users: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/users${q ? `?${q}` : ''}`);
    },
    create: (data) => apiRequest('/users', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/users/${id}`, { method: 'PATCH', body: data }),
    delete: (id) => apiRequest(`/users/${id}`, { method: 'DELETE' }),
  },

  // Reports
  reports: {
    exportPayrollPDF: (data) =>
      apiRequest('/reports/payroll/pdf', { method: 'POST', body: data }),
    exportDPRExcel: (data) =>
      apiRequest('/reports/dpr/excel', { method: 'POST', body: data }),
    exportExpensesExcel: (data) =>
      apiRequest('/reports/expenses/excel', { method: 'POST', body: data }),
    exportAttendanceExcel: (data) =>
      apiRequest('/reports/attendance/excel', { method: 'POST', body: data }),
    exportTrialBalancePDF: (data) =>
      apiRequest('/reports/trial-balance/pdf', { method: 'POST', body: data }),
    exportProfitLossPDF: (data) =>
      apiRequest('/reports/profit-loss/pdf', { method: 'POST', body: data }),
  },

  // UPAD Module (Advance & Salary Payments to Workers)
  payments: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/payments${q ? `?${q}` : ''}`);
    },
    get: (id) => apiRequest(`/payments/${id}`),
    create: (data) => apiRequest('/payments', { method: 'POST', body: data }),
    batch: (data) => apiRequest('/payments/batch', { method: 'POST', body: data }),
    approve: (id) => apiRequest(`/payments/${id}/approve`, { method: 'PATCH' }),
    reject: (id, reason = '') =>
      apiRequest(`/payments/${id}/reject`, { method: 'PATCH', body: { reason } }),
    process: (id) => apiRequest(`/payments/${id}/process`, { method: 'PATCH' }),
    update: (id, data) => apiRequest(`/payments/${id}`, { method: 'PATCH', body: data }),
    delete: (id) => apiRequest(`/payments/${id}`, { method: 'DELETE' }),
    summary: () => apiRequest('/payments/summary'),
    calculateSalary: (params) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/payments/calculate-salary?${q}`);
    },
    remainingSalary: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/payments/remaining-salary${q ? `?${q}` : ''}`);
    },
  },

  // Payment Central (Central Unified Transaction Ledger)
  transactions: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/transactions${q ? `?${q}` : ''}`);
    },
    get: (id) => apiRequest(`/transactions/${id}`),
    create: (data) => apiRequest('/transactions', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/transactions/${id}`, { method: 'PATCH', body: data }),
    delete: (id) => apiRequest(`/transactions/${id}`, { method: 'DELETE' }),
    summary: () => apiRequest('/transactions/summary'),
  },

  // Credits Module (Cash Credit Management & FIFO Deductions)
  creditLogs: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/credit-logs${q ? `?${q}` : ''}`);
    },
    get: (id) => apiRequest(`/credit-logs/${id}`),
    create: (data) => apiRequest('/credit-logs', { method: 'POST', body: data }),
    delete: (id) => apiRequest(`/credit-logs/${id}`, { method: 'DELETE' }),
    summary: () => apiRequest('/credit-logs/summary'),
    addExpense: (id, data) =>
      apiRequest(`/credit-logs/${id}/expenses`, { method: 'POST', body: data }),
    removeExpense: (id, expenseId) =>
      apiRequest(`/credit-logs/${id}/expenses/${expenseId}`, { method: 'DELETE' }),
  },

  // Running Costs Module (Site Expenses)
  runningCosts: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/running-costs${q ? `?${q}` : ''}`);
    },
    create: (data) => apiRequest('/running-costs', { method: 'POST', body: data }),
    delete: (id) => apiRequest(`/running-costs/${id}`, { method: 'DELETE' }),
    summary: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/running-costs/summary${q ? `?${q}` : ''}`);
    },
  },

  // Audit Trail & Activity Logs
  audit: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/audit/logs${q ? `?${q}` : ''}`);
    },
    getStats: () => apiRequest('/audit/stats'),
    clear: () => apiRequest('/audit/logs', { method: 'DELETE' }),
  },

  // AI Cost Estimator Persistent Storage
  costEstimator: {
    list: () => apiRequest('/cost-estimator/estimates'),
    save: (data) => apiRequest('/cost-estimator/estimates', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/cost-estimator/estimates/${id}`, { method: 'PATCH', body: data }),
    delete: (id) => apiRequest(`/cost-estimator/estimates/${id}`, { method: 'DELETE' }),
  },
};
