import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Users,
  CreditCard,
  CalendarCheck,
  CalendarX,
  Wallet,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Sparkline } from '../components/ui/Sparkline';
import { Badge } from '../components/ui/Badge';
import { DashboardSkeleton } from '../components/ui/Skeleton';

// Dedicated, relevant background images for each stat card
import constructionBg from '../assets/construction-bg.png';
import statEmployeesBg from '../assets/stat-employees.png';
import statFinanceBg from '../assets/stat-finance.png';
import statPresentBg from '../assets/stat-present.png';
import statAbsentBg from '../assets/stat-absent.png';
import statPaymentsBg from '../assets/stat-payments.png';

export const DashboardView = ({ selectedProjectId, onNavigate }) => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [assignedTasks, setAssignedTasks] = useState([]);

  const fetchOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const [res, workRes] = await Promise.all([
        api.dashboard.getOverview(selectedProjectId, true),
        api.workEntries.list().catch(() => []),
      ]);
      setData(res);

      if (user) {
        const myWork = (Array.isArray(workRes) ? workRes : []).filter((e) => {
          if (user.employee_id) {
            const empIds = Array.isArray(e.employees) ? e.employees : e.employee ? [e.employee] : [];
            if (empIds.map(Number).includes(Number(user.employee_id))) return true;
          }
          const uRole = (user.role || '').toLowerCase();
          if (e.department && e.department.toLowerCase().includes(uRole)) return true;
          if (e.role_counts) {
            const rKeys = Object.keys(e.role_counts).map((k) => k.toLowerCase());
            if (
              rKeys.some(
                (k) =>
                  uRole.includes(k) ||
                  k.includes(uRole) ||
                  (uRole.includes('labour') && (k.includes('karigar') || k.includes('labour') || k.includes('helper'))) ||
                  (uRole.includes('engineer') && k.includes('eng')) ||
                  (uRole.includes('supervisor') && k.includes('sup'))
              )
            ) {
              return true;
            }
          }
          return false;
        });
        setAssignedTasks(myWork);
      }
    } catch (err) {
      setError(err.message || 'Failed to load executive dashboard telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [selectedProjectId, user]);

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  const projects = data?.projects || [];
  const presentTrend = data?.attendance_trend?.map((t) => t.present) || [18, 22, 25, 24, 28, 30, data?.workers_on_site_today || 32];
  const absentTrend = data?.attendance_trend?.map((t) => t.absent) || [4, 5, 3, 6, 2, 4, 3];
  const absentToday = data?.attendance_trend?.length
    ? data.attendance_trend[data.attendance_trend.length - 1].absent
    : Math.max(0, (data?.active_workers || 0) - (data?.workers_on_site_today || 0));

  // 6 Distinct Stat Cards with individual relevant background images
  const statCards = [
    {
      id: 'projects',
      title: 'Active Projects',
      value: data?.active_projects || 0,
      subtext: 'Operational construction sites',
      gradient: 'from-blue-500 to-blue-700',
      shadow: 'hover:shadow-blue-500/20',
      sparklineColor: '#93c5fd',
      sparklineData: [2, 3, 3, 4, 4, 5, data?.active_projects || 5],
      icon: FolderKanban,
      actionText: 'View Projects',
      tab: 'projects',
      bgImage: constructionBg,
    },
    {
      id: 'workforce',
      title: 'Total Employees',
      value: data?.active_workers || 0,
      subtext: 'Active workforce roster',
      gradient: 'from-emerald-500 to-emerald-700',
      shadow: 'hover:shadow-emerald-500/20',
      sparklineColor: '#6ee7b7',
      sparklineData: [28, 32, 35, 40, 45, 48, data?.active_workers || 50],
      icon: Users,
      actionText: 'Manage Gangs',
      tab: 'workforce',
      bgImage: statEmployeesBg, // Relevant construction team photo
    },
    {
      id: 'amount',
      title: 'Employee Amount',
      value: formatCurrency(data?.month_expenditure ?? data?.employee_amount),
      subtext: 'Worker wages, UPAD advances & payouts',
      gradient: 'from-teal-500 to-cyan-600',
      shadow: 'hover:shadow-teal-500/20',
      sparklineColor: '#a5f3fc',
      sparklineData: [4500, 6000, 8500, 12000, 15000, 18500, data?.month_expenditure || 21000],
      icon: CreditCard,
      actionText: 'Wages & Payroll',
      tab: 'payroll',
      bgImage: statFinanceBg, // Relevant budget/financial blueprints photo
    },
    {
      id: 'present',
      title: "Today's Present",
      value: data?.workers_on_site_today || 0,
      subtext: 'GPS verified on-site check-ins',
      gradient: 'from-amber-500 to-orange-600',
      shadow: 'hover:shadow-amber-500/20',
      sparklineColor: '#fcd34d',
      sparklineData: presentTrend.length >= 2 ? presentTrend : [15, 18, 22, 20, 25, 24, 28],
      icon: CalendarCheck,
      actionText: 'Attendance Register',
      tab: 'attendance',
      bgImage: statPresentBg, // Relevant site gate check-in photo
    },
    {
      id: 'absent',
      title: "Today's Absent",
      value: absentToday,
      subtext: 'Unlogged or absent workers',
      gradient: 'from-rose-500 to-red-600',
      shadow: 'hover:shadow-rose-500/20',
      sparklineColor: '#fca5a5',
      sparklineData: absentTrend.length >= 2 ? absentTrend : [5, 4, 6, 3, 5, 2, 4],
      icon: CalendarX,
      actionText: 'Absence Logs',
      tab: 'attendance',
      bgImage: statAbsentBg, // Relevant quiet/empty site zone photo
    },
    {
      id: 'payments',
      title: 'Total Payments',
      value: formatCurrency(data?.total_spend ?? data?.total_payments),
      subtext: `${data?.budget_utilization_percent || 0}% allocated budget utilized`,
      gradient: 'from-violet-500 to-purple-700',
      shadow: 'hover:shadow-violet-500/20',
      sparklineColor: '#c4b5fd',
      sparklineData: [12000, 16000, 21000, 28000, 34000, 41000, data?.total_spend || 48000],
      icon: Wallet,
      actionText: 'Ledger Audit',
      tab: 'ledger',
      bgImage: statPaymentsBg, // Relevant electronic banking ledger photo
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Header Section per PDF Design Specification */}
      <div className="pb-2 border-b border-[var(--border-default)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">
            Welcome back,{' '}
            <span className="text-emerald-600 dark:text-[var(--success)]">
              {user?.name || 'Administrator'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 font-medium">
            Multi-project financial burn rate, site operations, and compliance telemetry.
          </p>
        </div>

        {assignedTasks.length > 0 && (
          <div
            onClick={() => onNavigate && onNavigate('progress')}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center gap-3 cursor-pointer shadow-lg shadow-blue-500/20 hover:scale-105 transition-all"
            title="View tasks assigned to your role"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black text-sm">
              {assignedTasks.length}
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-blue-100">
                Assigned Work ({user?.role || 'Your Role'})
              </div>
              <div className="text-xs font-bold truncate max-w-[200px]">
                {assignedTasks[0]?.description || 'Work allocated'}
              </div>
            </div>
            <ArrowRight size={16} />
          </div>
        )}
      </div>

      {/* 2. Stat Cards Grid (6 Cards with Distinct Photorealistic Backgrounds) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 animate-stagger-in">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.id}
              className={`group relative overflow-hidden rounded-2xl border border-[var(--border-default)] dark:border-[var(--border-strong)] p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${card.shadow} cursor-pointer`}
              onClick={() => onNavigate && onNavigate(card.tab)}
            >
              {/* Full-bleed relevant background image + dark gradient overlay */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url(${card.bgImage})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/55 to-black/80" />

              {/* Card Foreground Content */}
              <div className="relative z-10 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[8px] sm:text-[11px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] text-slate-300">
                      {card.title}
                    </span>
                    <div className="text-xl sm:text-3xl lg:text-4xl font-extrabold sm:font-black tracking-tighter text-white mt-1">
                      {card.value}
                    </div>
                  </div>

                  {/* Gradient Icon Badge with group-hover:rotate-12 */}
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:rotate-12 shrink-0`}
                  >
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                </div>

                <div className="text-[10px] sm:text-xs text-slate-300 truncate font-medium">
                  {card.subtext}
                </div>
              </div>

              {/* Sparkline & Glass CTA Bar */}
              <div className="relative z-10 pt-3 space-y-2.5">
                <div className="h-9 flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    7-Day Trend
                  </span>
                  <Sparkline
                    data={card.sparklineData}
                    color={card.sparklineColor}
                    width={110}
                    height={32}
                  />
                </div>

                {/* Glass CTA Bar */}
                <div className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md transition-colors text-white text-[11px] font-semibold">
                  <span>{card.actionText}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          );
        })}
      </div>



      {/* 4. Quick Actions Section (PDF Page 10) */}
      <div className="space-y-3">
        <h3 className="text-xs font-black tracking-widest uppercase text-[var(--text-secondary)]">
          Operational Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <button
            onClick={() => onNavigate && onNavigate('progress')}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 hover:border-blue-400 transition-all text-left group cursor-pointer"
          >
            <div className="p-3 rounded-xl bg-white dark:bg-[var(--bg-tertiary)] shadow-sm text-blue-600 shrink-0">
              <ClipboardList className="w-5 h-5 transition-transform group-hover:scale-110" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)] block">
                Submit DPR
              </span>
              <span className="text-[10px] text-[var(--text-secondary)]">Daily Progress Report</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate && onNavigate('attendance')}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 hover:border-emerald-400 transition-all text-left group cursor-pointer"
          >
            <div className="p-3 rounded-xl bg-white dark:bg-[var(--bg-tertiary)] shadow-sm text-emerald-600 shrink-0">
              <CalendarCheck className="w-5 h-5 transition-transform group-hover:scale-110" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)] block">
                Mark Roster
              </span>
              <span className="text-[10px] text-[var(--text-secondary)]">Gang & GPS Check-in</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate && onNavigate('expenses')}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 hover:border-amber-400 transition-all text-left group cursor-pointer"
          >
            <div className="p-3 rounded-xl bg-white dark:bg-[var(--bg-tertiary)] shadow-sm text-amber-600 shrink-0">
              <Wallet className="w-5 h-5 transition-transform group-hover:scale-110" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)] block">
                Record Spend
              </span>
              <span className="text-[10px] text-[var(--text-secondary)]">Site expense or petty cash</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate && onNavigate('payroll')}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40 hover:border-purple-400 transition-all text-left group cursor-pointer"
          >
            <div className="p-3 rounded-xl bg-white dark:bg-[var(--bg-tertiary)] shadow-sm text-purple-600 shrink-0">
              <CreditCard className="w-5 h-5 transition-transform group-hover:scale-110" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)] block">
                Run Payroll
              </span>
              <span className="text-[10px] text-[var(--text-secondary)]">Disburse wage vouchers</span>
            </div>
          </button>
        </div>
      </div>

    </div>
  );
};
