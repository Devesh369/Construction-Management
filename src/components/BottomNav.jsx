import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  CalendarCheck,
  ClipboardList,
  Wallet,
  Banknote,
  CreditCard,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuth } from '../context/AuthContext';
import { ROLE_PERMISSIONS } from '../App';

export const BottomNav = ({ activeTab, setActiveTab }) => {
  const { role } = useAuth();
  const allTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'upad', label: 'Upad', icon: Banknote },
    { id: 'payroll', label: 'Payroll', icon: CreditCard },
    { id: 'progress', label: 'Work', icon: ClipboardList },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
  ];
  const tabs = allTabs.filter((t) => !ROLE_PERMISSIONS[t.id] || ROLE_PERMISSIONS[t.id].includes(role));

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-[4.25rem] bg-white/95 dark:bg-[var(--bg-secondary)]/95 backdrop-blur-lg border-t border-[var(--border-default)] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom,0)] hide-on-keyboard">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 flex-1 py-1 px-2 rounded-xl transition-all cursor-pointer select-none',
              isActive
                ? 'text-emerald-600 dark:text-[var(--success)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            <div
              className={cn(
                'p-1.5 rounded-xl transition-all',
                isActive && 'bg-emerald-500/10 dark:bg-emerald-500/15'
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black tracking-widest uppercase">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
