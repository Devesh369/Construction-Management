import React from 'react';
import { cn } from '../../utils/cn';

export const Input = React.forwardRef(
  (
    {
      label,
      error,
      icon: Icon,
      rightElement,
      className,
      id,
      type = 'text',
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
              {typeof Icon === 'function' || typeof Icon === 'object' ? (
                <Icon className="w-4 h-4" />
              ) : (
                Icon
              )}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cn(
              'w-full rounded-xl border bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-150 outline-none',
              'border-gray-300 dark:border-slate-700',
              'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20',
              Icon && 'pl-10 pr-3',
              error &&
                'border-red-300 dark:border-red-500/50 focus:ring-red-500/20 focus:border-red-500 text-red-900 dark:text-red-300',
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs font-medium text-[var(--error)] mt-1 animate-fade-in">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
