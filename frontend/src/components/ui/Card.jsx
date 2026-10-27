import React from 'react';
import { cn } from '../../utils/cn';

export const Card = ({
  children,
  className,
  padding = true,
  hoverable = false,
  ...props
}) => {
  return (
    <div
      className={cn(
        'bg-[var(--bg-primary)] dark:bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border-default)] shadow-sm transition-colors duration-300',
        padding && 'p-6',
        hoverable &&
          'hover:shadow-md dark:hover:shadow-accent/5 hover:border-[var(--border-strong)] transition-all duration-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ title, subtitle, action, className, children }) => {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div>
        {title && <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>}
        {subtitle && <p className="text-sm text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export const CardContent = ({ children, className }) => {
  return <div className={cn('space-y-4', className)}>{children}</div>;
};

export const CardFooter = ({ children, className }) => {
  return (
    <div
      className={cn(
        'pt-4 mt-4 border-t border-[var(--border-default)] flex items-center justify-between',
        className
      )}
    >
      {children}
    </div>
  );
};
