import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { api } from './api/client';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { BottomNav } from './components/BottomNav';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { ProjectsView } from './views/ProjectsView';
import { WorkforceView } from './views/WorkforceView';
import { AttendanceView } from './views/AttendanceView';
import { ProgressView } from './views/ProgressView';
import { ExpensesView } from './views/ExpensesView';
import { UpadView } from './views/UpadView';
import { PaymentCentralView } from './views/PaymentCentralView';
import { PayrollView } from './views/PayrollView';
import { ReportsView } from './views/ReportsView';
import { AICostEstimatorView } from './views/AICostEstimatorView';
import { SettingsView } from './views/SettingsView';
import { useUIStore } from './store/uiStore';
import buildsphereLogo from './assets/buildsphere_logo.png';

export const ROLE_PERMISSIONS = {
  dashboard: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
  projects: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
  workforce: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
  attendance: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'employee/labour', 'EMPLOYEE', 'LABOUR'],
  progress: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
  expenses: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
  upad: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'employee/labour', 'EMPLOYEE', 'LABOUR'],
  payment_central: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
  credits: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
  payroll: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'employee/labour', 'EMPLOYEE', 'LABOUR'],
  reports: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
  cost_estimator: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
  settings: ['ORG_ADMIN'],
};

export const DEFAULT_TAB_BY_ROLE = {
  ORG_ADMIN: 'dashboard',
  PROJECT_MANAGER: 'dashboard',
  SITE_MANAGER: 'dashboard',
  'employee/labour': 'attendance',
  EMPLOYEE: 'attendance',
  LABOUR: 'attendance',
};

const AppContent = () => {
  const { isAuthenticated, loading, role } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [attendanceNavState, setAttendanceNavState] = useState(null);
  const [progressNavState, setProgressNavState] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { theme } = useUIStore();

  // Fetch project list for Topbar
  const fetchProjects = async () => {
    try {
      const res = await api.projects.list();
      const list = Array.isArray(res) ? res : res.results || [];
      const sorted = [...list].sort((a, b) => {
        if (a.created_at && b.created_at) {
          const diff = new Date(a.created_at) - new Date(b.created_at);
          if (diff !== 0) return diff;
        }
        return (a.id || 0) - (b.id || 0);
      });
      setProjects(sorted);
    } catch (err) {
      console.warn('Could not load projects for topbar', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
    }
  }, [isAuthenticated, refreshKey]);

  const handleNavigate = (tab, navData) => {
    if (navData && navData.projectId) {
      setSelectedProjectId(navData.projectId);
    }
    if (tab === 'attendance' && navData) {
      setAttendanceNavState(navData);
    }
    if (tab === 'progress' && navData) {
      setProgressNavState(navData);
    }
    setActiveTab(tab);
  };

  // Automatically switch to role default tab if current tab is not permitted
  useEffect(() => {
    if (role && !ROLE_PERMISSIONS[activeTab]?.includes(role)) {
      const targetTab = DEFAULT_TAB_BY_ROLE[role] || 'projects';
      setActiveTab(targetTab);
    }
  }, [role, activeTab]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-secondary)] text-[var(--text-muted)] animate-fade-in">
        <div className="text-center space-y-3">
          <img
            src={buildsphereLogo}
            alt="BuildSphere"
            className="w-16 h-16 mx-auto object-contain animate-pulse drop-shadow-md"
          />
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
            BuildSphere
          </div>
          <div className="text-xs uppercase tracking-widest text-[var(--text-secondary)] font-bold">
            Construction Management Platform
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            Initializing enterprise session...
          </div>
        </div>
      </div>
    );
  }

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isExplicitAuthView =
    !isAuthenticated &&
    urlParams &&
    (urlParams.has('invite') ||
      urlParams.get('mode') === 'setup' ||
      urlParams.get('mode') === 'login' ||
      urlParams.get('register') === 'true');

  if (!isAuthenticated || isExplicitAuthView) {
    return <LoginView isAlreadyAuthenticated={isAuthenticated} />;
  }

  const isDark = theme === 'dark';
  const isTabAllowed = ROLE_PERMISSIONS[activeTab]?.includes(role);
  const fallbackTab = DEFAULT_TAB_BY_ROLE[role] || 'projects';

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-secondary)]">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          projects={projects}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24 lg:pb-6" key={refreshKey}>
          {!isTabAllowed ? (
            <div className="card" style={{ maxWidth: '640px', margin: '48px auto', padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <ShieldAlert size={32} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                Access Restricted
              </h2>
              <p style={{ color: 'var(--text-subtle)', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '24px' }}>
                Your current designation (<strong style={{ color: 'var(--accent)' }}>{role?.replace('_', ' ')}</strong>) is not authorized to access the <strong>{activeTab.toUpperCase()}</strong> module. Please contact your Organization Administrator to request elevated permissions.
              </p>
              <button
                onClick={() => setActiveTab(fallbackTab)}
                className="btn btn-primary"
                style={{ margin: '0 auto' }}
              >
                Return to {fallbackTab.toUpperCase()}
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  selectedProjectId={selectedProjectId}
                  onNavigate={(tab) => setActiveTab(tab)}
                />
              )}
              {activeTab === 'projects' && (
                <ProjectsView
                  onSelectProject={(id) => {
                    setSelectedProjectId(id);
                    setActiveTab('dashboard');
                  }}
                  onProjectsUpdated={fetchProjects}
                  onNavigate={handleNavigate}
                />
              )}
              {activeTab === 'workforce' && <WorkforceView />}
              {activeTab === 'attendance' && (
                <AttendanceView
                  selectedProjectId={selectedProjectId}
                  navState={attendanceNavState}
                  onClearNavState={() => setAttendanceNavState(null)}
                />
              )}
              {activeTab === 'progress' && (
                <ProgressView
                  selectedProjectId={selectedProjectId}
                  navState={progressNavState}
                  onClearNavState={() => setProgressNavState(null)}
                  onNavigateToAttendance={() => setActiveTab('attendance')}
                />
              )}
              {activeTab === 'expenses' && (
                <ExpensesView selectedProjectId={selectedProjectId} />
              )}
              {activeTab === 'upad' && (
                <UpadView selectedProjectId={selectedProjectId} />
              )}
              {activeTab === 'payment_central' && <PaymentCentralView />}
              {activeTab === 'payroll' && (
                <PayrollView selectedProjectId={selectedProjectId} />
              )}
              {activeTab === 'reports' && (
                <ReportsView selectedProjectId={selectedProjectId} />
              )}
              {activeTab === 'cost_estimator' && (
                <AICostEstimatorView
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  onProjectsUpdated={fetchProjects}
                />
              )}
              {activeTab === 'settings' && <SettingsView />}
            </>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Custom styled Toast container per PDF spec */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: '16px',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
          },
          success: {
            style: {
              background: isDark
                ? 'linear-gradient(135deg, #064e3b, #065f46)'
                : 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
              border: `1px solid ${isDark ? '#10b981' : '#a7f3d0'}`,
              color: isDark ? '#a7f3d0' : '#065f46',
            },
          },
          error: {
            style: {
              background: isDark
                ? 'linear-gradient(135deg, #7f1d1d, #991b1b)'
                : 'linear-gradient(135deg, #fef2f2, #fecaca)',
              border: `1px solid ${isDark ? '#ef4444' : '#fca5a5'}`,
              color: isDark ? '#fecaca' : '#991b1b',
            },
          },
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
