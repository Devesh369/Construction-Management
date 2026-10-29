import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export const Select = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  label,
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
    <div className={cn('relative w-full', className)} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-4 py-2 min-h-[42px]',
          'bg-[var(--bg-secondary)] dark:bg-[var(--bg-tertiary)]',
          'border border-[var(--border-default)] dark:border-[var(--border-strong)]',
          'rounded-2xl text-[13px] font-bold text-[var(--text-primary)] cursor-pointer select-none',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
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
            'absolute left-0 right-0 mt-2 z-50 max-h-60 overflow-y-auto',
            'bg-white dark:bg-[var(--bg-tertiary)]',
            'border border-gray-200 dark:border-[var(--border-strong)]',
            'rounded-2xl shadow-xl py-1 animate-fade-in'
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
                  'flex items-center justify-between px-4 py-3 text-[13px] font-bold cursor-pointer transition-colors duration-150',
                  isSelected
                    ? 'bg-blue-50/50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-[var(--text-primary)] hover:bg-blue-50 dark:hover:bg-[var(--bg-secondary)]'
                )}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
