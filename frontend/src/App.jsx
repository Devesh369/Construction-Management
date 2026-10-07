import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { api } from './api/client';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { ProjectsView } from './views/ProjectsView';
import { WorkforceView } from './views/WorkforceView';
import { AttendanceView } from './views/AttendanceView';
import { ProgressView } from './views/ProgressView';
import { ExpensesView } from './views/ExpensesView';
import { PayrollView } from './views/PayrollView';
import { LedgerView } from './views/LedgerView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch project list for Topbar
  const fetchProjects = async () => {
    try {
      const res = await api.projects.list();
      setProjects(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.warn('Could not load projects for topbar', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
    }
  }, [isAuthenticated, refreshKey]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-app)',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#60a5fa', marginBottom: '8px' }}>
            BuildPulse CMP
          </div>
          <div style={{ fontSize: '0.86rem' }}>Initializing secure enterprise session...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="main-content">
        <Topbar
          projects={projects}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
        <main className="content-body" key={refreshKey}>
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
            />
          )}
          {activeTab === 'workforce' && <WorkforceView />}
          {activeTab === 'attendance' && (
            <AttendanceView selectedProjectId={selectedProjectId} />
          )}
          {activeTab === 'progress' && (
            <ProgressView selectedProjectId={selectedProjectId} />
          )}
          {activeTab === 'expenses' && (
            <ExpensesView selectedProjectId={selectedProjectId} />
          )}
          {activeTab === 'payroll' && (
            <PayrollView selectedProjectId={selectedProjectId} />
          )}
          {activeTab === 'ledger' && <LedgerView />}
          {activeTab === 'reports' && (
            <ReportsView selectedProjectId={selectedProjectId} />
          )}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>
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
