import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarCheck,
  Camera,
  Receipt,
  Wallet,
  BookOpen,
  FileText,
  Settings,
  LogOut,
  HardHat,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Badge } from './Badge';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const { user, role, organization, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT', 'AUDITOR'] },
    { id: 'projects', label: 'Projects & Sites', icon: Building2, roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER', 'SUPERVISOR', 'ACCOUNTANT', 'AUDITOR'] },
    { id: 'workforce', label: 'Workforce & Gangs', icon: Users, roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SUPERVISOR', 'ACCOUNTANT'] },
    { id: 'attendance', label: 'Site Attendance', icon: CalendarCheck, roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SUPERVISOR', 'ACCOUNTANT'] },
    { id: 'progress', label: 'DPR & Progress', icon: Camera, roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER', 'SUPERVISOR'] },
    { id: 'expenses', label: 'Spend & Vendors', icon: Receipt, roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER', 'SUPERVISOR', 'ACCOUNTANT'] },
    { id: 'payroll', label: 'Payroll & Wages', icon: Wallet, roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT'] },
    { id: 'ledger', label: 'Financial Ledger', icon: BookOpen, roles: ['ORG_ADMIN', 'ACCOUNTANT', 'AUDITOR'] },
    { id: 'reports', label: 'Reports & Exports', icon: FileText, roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT'] },
    { id: 'settings', label: 'Org Settings', icon: Settings, roles: ['ORG_ADMIN'] },
  ];

  const allowedNav = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="brand-logo">
          <HardHat size={22} color="#ffffff" />
        </div>
        <div className="brand-text">
          <h1>BuildPulse</h1>
          <span>{organization?.name || 'Enterprise CMP'}</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav">
        <div className="nav-section-title">Navigation Menu</div>
        {allowedNav.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
              {user?.email}
            </div>
          </div>
          <Badge status={role} />
        </div>

        <button
          onClick={logout}
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', marginTop: '6px' }}
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
