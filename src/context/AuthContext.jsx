import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getToken, setToken, getRefreshToken, setRefreshToken, getStoredUser, setStoredUser } from '../api/client';

const AuthContext = createContext(null);

export const DEMO_USERS = [
  { key: 'alpha_admin', label: 'Admin (Alpha)', role: 'ORG_ADMIN', email: 'admin@alpha.test', password: 'ChangeMe#12345' },
  { key: 'alpha_pm', label: 'PM Priya', role: 'PROJECT_MANAGER', email: 'pm@alpha.test', password: 'ChangeMe#12345' },
  { key: 'site_manager', label: 'Site Manager', role: 'SITE_MANAGER', email: 'sitemanager@buildsphere.com', password: 'password123' },
  { key: 'alpha_eng', label: 'Eng Rohan', role: 'SITE_ENGINEER', email: 'eng@alpha.test', password: 'ChangeMe#12345' },
  { key: 'alpha_sup', label: 'Sup Sanjay', role: 'SUPERVISOR', email: 'sup1@alpha.test', password: 'ChangeMe#12345' },
  { key: 'alpha_acc', label: 'Acc Ananya', role: 'ACCOUNTANT', email: 'acc@alpha.test', password: 'ChangeMe#12345' },
  { key: 'beta_admin', label: 'Beta Admin', role: 'ORG_ADMIN', email: 'admin@beta.test', password: 'ChangeMe#12345' },
  { key: 'employee_labour', label: 'Employee / Labour', role: 'employee/labour', email: 'labour@buildsphere.com', password: 'password123', employee_id: 100 },
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);

  // Hydrate user session on mount
  useEffect(() => {
    const hydrate = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.auth.me();
        setUser(me);
        setStoredUser(me);
      } catch (err) {
        try {
          const refreshed = await api.auth.refresh();
          if (refreshed?.access) {
            const me = await api.auth.me();
            setUser(me);
            setStoredUser(me);
            return;
          }
        } catch (refreshErr) {
          console.warn('Session refresh failed:', refreshErr);
        }
        console.warn('Session expired, clearing token', err);
        setToken(null);
        setRefreshToken(null);
        setUser(null);
        setStoredUser(null);
      } finally {
        setLoading(false);
      }
    };
    hydrate();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await api.auth.login(email, password);
      setToken(res.access);
      if (res.refresh) setRefreshToken(res.refresh);
      setUser(res.user);
      setStoredUser(res.user);
      return res.user;
    } finally {
      setLoading(false);
    }
  };

  const setupAdmin = async (data) => {
    setLoading(true);
    try {
      const res = await api.auth.setupAdmin(data);
      setToken(res.access);
      if (res.refresh) setRefreshToken(res.refresh);
      setUser(res.user);
      setStoredUser(res.user);
      return res.user;
    } finally {
      setLoading(false);
    }
  };

  const acceptInvite = async (data) => {
    setLoading(true);
    try {
      const res = await api.auth.acceptInvite(data.token, data.password, data.name, data.email);
      if (res?.access) setToken(res.access);
      if (res?.refresh) setRefreshToken(res.refresh);
      if (res?.user) {
        setUser(res.user);
        setStoredUser(res.user);
      }
      return res?.user || res;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    } finally {
      setToken(null);
      setRefreshToken(null);
      setUser(null);
      setStoredUser(null);
    }
  };

  const quickLogin = async (demoKey) => {
    const target = DEMO_USERS.find((d) => d.key === demoKey);
    if (!target) return;
    return await login(target.email, target.password);
  };

  const isAdminOrPM =
    user?.role === 'ORG_ADMIN' ||
    user?.role === 'PROJECT_MANAGER' ||
    user?.role === 'SITE_MANAGER';
  const isFinance = user?.role === 'ORG_ADMIN' || user?.role === 'ACCOUNTANT';

  const activeOrg =
    typeof user?.organization === 'object' && user?.organization !== null
      ? user.organization
      : { id: Number(user?.organization || 10), name: 'My Workspace' };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role,
        organization: activeOrg,
        isAuthenticated: Boolean(user),
        loading,
        login,
        setupAdmin,
        acceptInvite,
        logout,
        quickLogin,
        isAdminOrPM,
        isFinance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
