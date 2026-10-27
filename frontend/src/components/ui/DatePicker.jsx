import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

export const DatePicker = ({
  value,
  onChange,
  label,
  placeholder = 'Select date',
  className,
  disableFuture = false,
  maxDate = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse current selected date
  const selectedDate = value ? new Date(value) : null;
  const [viewDate, setViewDate] = useState(selectedDate || new Date());

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(year, month + 1, 1));
  };

  const isDayDisabled = (day) => {
    const target = new Date(year, month, day, 23, 59, 59, 999);
    if (disableFuture) {
      const now = new Date();
      if (target > now) return true;
    }
    if (maxDate) {
      const max = new Date(maxDate);
      max.setHours(23, 59, 59, 999);
      if (target > max) return true;
    }
    return false;
  };

  const handleSelectDay = (day) => {
    if (isDayDisabled(day)) return;
    const d = new Date(year, month, day);
    const dateStr = d.toISOString().split('T')[0];
    onChange(dateStr);
    setIsOpen(false);
  };

  const isSelected = (day) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day
    );
  };

  const isToday = (day) => {
    const now = new Date();
    return (
      now.getFullYear() === year &&
      now.getMonth() === month &&
      now.getDate() === day
    );
  };

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-4 py-2 min-h-[42px]',
          'bg-[var(--bg-secondary)] dark:bg-[var(--bg-tertiary)]',
          'border border-[var(--border-default)] dark:border-[var(--border-strong)]',
          'rounded-2xl text-[11px] sm:text-[13px] font-bold text-[var(--text-primary)] cursor-pointer select-none',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon className="w-4 h-4 text-blue-500 shrink-0" />
          <span>{value || placeholder}</span>
        </div>
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute left-0 mt-2 z-50 p-4 w-[280px]',
            'bg-white dark:bg-[var(--bg-tertiary)]',
            'border border-gray-200 dark:border-[var(--border-strong)]',
            'rounded-2xl shadow-xl animate-fade-in'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">
              {monthNames[month]} {year}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((dn) => (
              <span key={dn} className="text-[10px] font-bold uppercase text-gray-400">
                {dn}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const selected = isSelected(day);
              const today = isToday(day);
              const disabled = isDayDisabled(day);

              return (
                <button
                  type="button"
                  key={day}
                  disabled={disabled}
                  onClick={() => handleSelectDay(day)}
                  className={cn(
                    'h-8 rounded-xl text-xs font-bold flex items-center justify-center transition-all',
                    disabled
                      ? 'opacity-25 cursor-not-allowed text-gray-400 dark:text-gray-600'
                      : 'cursor-pointer',
                    selected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : today
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-black'
                      : !disabled && 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
