import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  CalendarCheck,
  ClipboardList,
  Wallet,
  CreditCard,
  FileBarChart,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Receipt,
  Coins,
  Sparkles,
  Calculator,
} from 'lucide-react';
import buildsphereLogo from '../assets/buildsphere_logo.png';
import { useAuth } from '../context/AuthContext';
import { useUIStore } from '../store/uiStore';
import { cn } from '../utils/cn';
import { Badge } from './ui/Badge';
import { AvatarImage } from './ui/AvatarImage';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const { user, role, organization, logout } = useAuth();
  const {
    sidebarCollapsed,
    toggleSidebarCollapsed,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useUIStore();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: FolderKanban,
      roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
    },
    {
      id: 'workforce',
      label: 'Employees',
      icon: Users,
      roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: CalendarCheck,
      roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'employee/labour', 'EMPLOYEE', 'LABOUR'],
    },
    {
      id: 'progress',
      label: 'Work Management',
      icon: ClipboardList,
      roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
    },
    {
      id: 'expenses',
      label: 'Spend & Vendors',
      icon: Wallet,
      roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
    },
    {
      id: 'upad',
      label: 'Upad',
      icon: Banknote,
      roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'employee/labour', 'EMPLOYEE', 'LABOUR'],
    },
    {
      id: 'payment_central',
      label: 'Payment',
      icon: CreditCard,
      roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
    },
    {
      id: 'payroll',
      label: 'Payroll',
      icon: CreditCard,
      roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'employee/labour', 'EMPLOYEE', 'LABOUR'],
    },
    {
      id: 'reports',
      label: 'Reports & Exports',
      icon: BarChart3,
      roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
    },
    {
      id: 'cost_estimator',
      label: 'Cost Estimator',
      icon: Calculator,
      roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      roles: ['ORG_ADMIN'],
    },
  ];

  const allowedNav = navItems.filter((item) => !item.roles || item.roles.includes(role));

  const handleNavClick = (id) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[999] lg:hidden animate-fade-in"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed lg:static top-0 bottom-0 left-0 z-[1000] flex flex-col',
          'bg-white dark:bg-[var(--bg-secondary)] border-r border-[var(--border-default)] shadow-lg',
          'transition-all duration-300 ease-in-out select-none',
          sidebarCollapsed ? 'w-[72px]' : 'w-64',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-3 border-b border-[var(--border-default)] shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src={buildsphereLogo}
              alt="BuildSphere"
              className="w-10 h-10 object-contain shrink-0 rounded-lg p-0.5 bg-white/80 dark:bg-slate-900/80 shadow-sm"
            />
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] font-black tracking-tight text-[var(--text-primary)] truncate">
                  BuildSphere
                </span>
                <span className="text-[8px] font-semibold tracking-wider text-[var(--text-muted)] truncate uppercase">
                  {organization?.name || 'Construction Mgmt'}
                </span>
              </div>
            )}
          </div>

          {/* Collapse / Close toggle */}
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                setMobileMenuOpen(false);
              } else {
                toggleSidebarCollapsed();
              }
            }}
            className="flex p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Group */}
        <div className="flex-1 overflow-y-auto py-4 px-2.5 space-y-1">
          {!sidebarCollapsed && (
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Navigation
            </div>
          )}

          {allowedNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={cn(
                  'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer',
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold'
                    : 'text-[var(--text-secondary)] hover:bg-slate-100/70 dark:hover:bg-slate-700/30 hover:text-[var(--text-primary)]',
                  sidebarCollapsed && 'justify-center px-0'
                )}
              >
                {/* Active Indicator Left Pill */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-blue-600 dark:bg-blue-400" />
                )}
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>

        {/* User Profile & Sign Out Footer */}
        <div className="p-3 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]/50 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <AvatarImage
              name={user?.name || 'Construct User'}
              className="w-10 h-10 border-2 border-white dark:border-slate-700 shadow-sm shrink-0"
            />
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                  {user?.name || 'User'}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] truncate">
                  {user?.email}
                </div>
                <div className="mt-1">
                  <Badge status={role} className="text-[10px] px-2 py-0">
                    {role?.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={logout}
            title={sidebarCollapsed ? 'Sign Out' : undefined}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold',
              'text-[var(--text-secondary)] hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10',
              'transition-all duration-200 cursor-pointer'
            )}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
