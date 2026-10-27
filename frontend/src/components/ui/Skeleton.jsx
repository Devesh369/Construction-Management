import React from 'react';
import { cn } from '../../utils/cn';

export const Skeleton = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 skeleton-shimmer',
        className
      )}
      {...props}
    />
  );
};

export const StatCardSkeleton = () => {
  return (
    <div className="h-[220px] rounded-2xl p-5 border border-[var(--border-default)] dark:border-[var(--border-strong)] bg-[var(--bg-primary)] dark:bg-[var(--bg-tertiary)] flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-32" />
        </div>
        <Skeleton className="w-12 h-12 rounded-2xl" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-8 w-full rounded-xl" />
      </div>
    </div>
  );
};

export const DashboardSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>

      {/* 6 Stat Cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
        {Array.from({ length: 6 }).map((_, idx) => (
          <StatCardSkeleton key={idx} />
        ))}
      </div>

      {/* Night Operations skeleton */}
      <div className="rounded-2xl p-6 border border-[var(--border-default)] bg-[var(--bg-primary)] dark:bg-[var(--bg-tertiary)] space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Quick Actions skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  );
};
