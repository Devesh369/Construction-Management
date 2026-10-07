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

/**
 * Universal request wrapper
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Handle JSON vs FormData
  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle binary blob responses (PDF / Excel downloads)
  const contentType = response.headers.get('content-type') || '';
  if (
    contentType.includes('application/pdf') ||
    contentType.includes('spreadsheetml.sheet') ||
    contentType.includes('application/octet-stream')
  ) {
    if (!response.ok) {
      throw new Error(`Export download failed with status ${response.status}`);
    }
    const blob = await response.blob();
    return blob;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMsg =
      data?.error?.message ||
      data?.detail ||
      (typeof data === 'object' ? JSON.stringify(data) : 'API request failed');
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

// Domain API endpoints
export const api = {
  // Authentication & Session
  auth: {
    login: (email, password) =>
      apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password },
      }),
    me: () => apiRequest('/users/me'),
    updateMe: (data) =>
      apiRequest('/users/me', {
        method: 'PATCH',
        body: data,
      }),
    acceptInvite: (token, password, name) =>
      apiRequest('/auth/accept-invite', {
        method: 'POST',
        body: { token, password, name },
      }),
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
    createEmployee: (data) => apiRequest('/employees', { method: 'POST', body: data }),
    updateEmployee: (id, data) => apiRequest(`/employees/${id}`, { method: 'PATCH', body: data }),
    listLaborGroups: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/labor-groups${q ? `?${q}` : ''}`);
    },
    createLaborGroup: (data) => apiRequest('/labor-groups', { method: 'POST', body: data }),
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
      apiRequest(`/night-shifts/${id}/end_shift`, {
        method: 'POST',
        body: data,
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
    markVoucherPaid: (id, ref) =>
      apiRequest(`/payroll/vouchers/${id}/mark-paid`, {
        method: 'POST',
        body: { payment_reference: ref },
      }),
    listAdvances: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiRequest(`/payroll/advances${q ? `?${q}` : ''}`);
    },
    createAdvance: (data) =>
      apiRequest('/payroll/advances', {
        method: 'POST',
        body: data,
      }),
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
};
