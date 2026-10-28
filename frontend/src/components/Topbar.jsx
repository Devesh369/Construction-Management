import React from 'react';
import {
  Menu,
  Search,
  Sun,
  Moon,
  RefreshCw,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUIStore } from '../store/uiStore';
import { cn } from '../utils/cn';
import { AvatarImage } from './ui/AvatarImage';
import buildsphereLogo from '../assets/buildsphere_logo.png';

export const Topbar = ({
  projects = [],
  selectedProjectId,
  setSelectedProjectId,
  onRefresh,
  isRefreshing,
}) => {
  const { user, role } = useAuth();
  const {
    theme,
    toggleTheme,
    compactMode,
    toggleCompactMode,
    toggleMobileMenu,
  } = useUIStore();

  const formatRole = (r) => {
    if (!r) return 'User';
    const map = {
      ORG_ADMIN: 'Admin',
      PROJECT_MANAGER: 'Project Manager',
      SITE_ENGINEER: 'Site Engineer',
      SUPERVISOR: 'Supervisor',
      ACCOUNTANT: 'Accountant',
    };
    return map[r] || r.replace('_', ' ');
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-white/90 dark:bg-[var(--bg-primary)]/90 backdrop-blur-lg border-b border-[var(--border-default)]/80 safe-top flex items-center justify-between px-4 lg:px-6 transition-colors duration-300 gap-4">
      {/* Left section: Hamburger for mobile + Brand on smaller screens */}
      <div className="flex items-center gap-3 lg:gap-4 shrink-0">
        <button
          onClick={toggleMobileMenu}
          className="lg:hidden p-2 rounded-xl text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Toggle Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand in Topbar on smaller screens */}
        <div className="flex items-center gap-2 lg:hidden">
          <img
            src={buildsphereLogo}
            alt="BuildSphere"
            className="w-7 h-7 object-contain rounded-md"
          />
          <span className="text-sm font-black tracking-tight text-[var(--text-primary)]">
            BuildSphere
          </span>
        </div>
      </div>

      {/* Center section: Global Search Bar */}
      <div className="hidden sm:flex items-center justify-center flex-1 max-w-lg mx-auto">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search projects, workers, DPR..."
            className="w-full bg-slate-100 dark:bg-[var(--bg-secondary)] border border-transparent focus:border-blue-500/50 dark:focus:border-blue-400/50 rounded-xl pl-10 pr-12 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-all outline-none focus:shadow-sm"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
            <span className="text-[10px] font-semibold bg-white dark:bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded px-1.5 py-0.5 text-[var(--text-muted)] shadow-xs">
              ⌘K
            </span>
          </div>
        </div>
      </div>

      {/* Right section: Username Profile + Refresh + Mode toggles */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* User Profile / Username Display */}
        <div className="flex items-center gap-2.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-[var(--bg-secondary)] border border-[var(--border-default)] shadow-2xs">
          <AvatarImage
            name={user?.name || 'Aarav Mehta'}
            className="w-7 h-7 text-xs rounded-lg border border-white/50 shadow-2xs shrink-0"
          />
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-[var(--text-primary)] leading-tight truncate max-w-[100px] sm:max-w-[140px]">
              {user?.name || 'Aarav Mehta'}
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 leading-tight">
              {formatRole(user?.role || role)}
            </span>
          </div>
        </div>

        {/* Refresh Trigger */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-[var(--border-default)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--text-secondary)] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Refresh KPIs & Telemetry"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin text-blue-500')} />
          </button>
        )}

        {/* Compact Mode Toggle */}
        <button
          onClick={toggleCompactMode}
          className={cn(
            'p-2 rounded-xl border transition-colors cursor-pointer hidden md:flex items-center justify-center',
            compactMode
              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
              : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
          title={compactMode ? 'Disable Compact Spacing' : 'Enable Compact Spacing'}
        >
          {compactMode ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
        </button>

        {/* Theme Toggle (Light / Dark) */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-blue-600" />
          )}
        </button>
      </div>
    </header>
  );
};
