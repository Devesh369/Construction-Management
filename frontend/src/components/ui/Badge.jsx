import React from 'react';
import { cn } from '../../utils/cn';

export function getStatusColor(status) {
  const s = String(status || '').toLowerCase().trim();
  switch (s) {
    case 'active':
    case 'present':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
    case 'inactive':
      return 'bg-gray-100 dark:bg-[var(--bg-secondary)] text-gray-600 dark:text-gray-400';
    case 'terminated':
    case 'absent':
      return 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300';
    case 'planning':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300';
    case 'in_progress':
      return 'bg-emerald-600 text-white shadow-sm';
    case 'on_hold':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300';
    case 'completed':
    case 'paid':
    case 'disbursed':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
    case 'cancelled':
    case 'rejected':
      return 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300';
    case 'pending':
    case 'submitted':
    case 'draft':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300';
    case 'approved':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300';
    default:
      return 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] dark:border-[var(--border-default)]';
  }
}

export const Badge = ({ children, status, variant, className, dot = false }) => {
  const variantClasses = {
    default: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] dark:border-[var(--border-default)]',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    amber: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    gray: 'bg-gray-100 dark:bg-[var(--bg-secondary)] text-gray-600 dark:text-gray-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
  };

  const statusClass = status ? getStatusColor(status) : variant ? variantClasses[variant] : variantClasses.default;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border border-transparent select-none whitespace-nowrap',
        statusClass,
        className
      )}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      )}
      {children}
    </span>
  );
};
