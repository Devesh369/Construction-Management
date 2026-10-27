import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export const FormSelect = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  label,
  error,
  className,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={cn('relative w-full space-y-1.5', className)} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm text-[var(--text-primary)] cursor-pointer select-none transition-all',
          'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700',
          isOpen && 'border-blue-500 ring-2 ring-blue-500/25 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]',
          error && 'border-red-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-blue-500 transition-transform duration-200 shrink-0',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute left-0 right-0 mt-1 z-50 max-h-60 overflow-y-auto',
            'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700',
            'rounded-xl shadow-lg shadow-slate-900/10 dark:shadow-slate-900/40 p-1 animate-fade-in'
          )}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 font-medium'
                    : 'text-[var(--text-primary)] hover:bg-[#1d63d2] hover:text-white'
                )}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="text-xs font-medium text-[var(--error)]">{error}</p>}
    </div>
  );
};
