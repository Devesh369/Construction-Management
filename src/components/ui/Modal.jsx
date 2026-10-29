import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          onClose?.();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/75 dark:bg-slate-950/85 backdrop-blur-sm transition-opacity animate-fade-in cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-h-[90vh] sm:max-h-[88vh] overflow-hidden flex flex-col',
          'bg-[var(--bg-primary)] dark:bg-[var(--bg-tertiary)]',
          'rounded-2xl sm:rounded-3xl',
          'shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8)]',
          'border border-[var(--border-default)] dark:border-[var(--border-strong)]',
          'animate-slide-up',
          sizeClasses[size] || sizeClasses.md,
          className
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        {title ? (
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)]/60 shrink-0">
            <div className="min-w-0 pr-4">
              <h3 className="text-base sm:text-lg md:text-xl font-black tracking-tight text-[var(--text-primary)] truncate">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 truncate font-medium">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-default)] dark:hover:bg-[var(--border-strong)] transition-colors cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/10 hover:bg-black/20 backdrop-blur-md text-[var(--text-primary)] hover:rotate-90 transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
