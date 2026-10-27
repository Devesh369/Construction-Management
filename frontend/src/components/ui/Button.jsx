import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export const Button = React.forwardRef(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      leftIcon,
      rightIcon,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'rounded-xl transition-all duration-200 font-medium inline-flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-1 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]';

    const variants = {
      primary: 'bg-[var(--accent)] text-white hover:opacity-90 shadow-lg shadow-accent/25',
      secondary:
        'bg-[var(--bg-primary)] dark:bg-[var(--bg-tertiary)] border border-[var(--border-default)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]',
      outline: 'border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-accent/5 bg-transparent',
      ghost: 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] bg-transparent',
      danger: 'bg-[var(--error)] text-white shadow-lg shadow-error/25 hover:opacity-90',
      success: 'bg-[var(--success)] text-white shadow-lg shadow-success/25 hover:opacity-90',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(baseClasses, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
