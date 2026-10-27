import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

export const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  className,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 sm:bg-slate-950/80 backdrop-blur-[2px] sm:backdrop-blur-md transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-h-[92dvh] overflow-hidden flex flex-col',
          'bg-[var(--bg-primary)] dark:bg-[var(--bg-tertiary)]',
          'rounded-t-2xl sm:rounded-[2rem]',
          'shadow-[0_0_60px_rgba(0,0,0,0.35)] sm:shadow-[0_0_100px_rgba(0,0,0,0.5)]',
          'border border-[var(--border-default)] dark:border-[var(--border-strong)]',
          'animate-slide-up sm:animate-count',
          sizeClasses[size],
          className
        )}
      >
        {/* Header */}
        {title ? (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)]/50 shrink-0">
            <div>
              <h3 className="text-base sm:text-lg md:text-xl font-black tracking-tight text-[var(--text-primary)]">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] dark:hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/10 hover:bg-black/20 backdrop-blur-md text-[var(--text-primary)] hover:rotate-90 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(92dvh-80px)]">{children}</div>
      </div>
    </div>
  );
};
