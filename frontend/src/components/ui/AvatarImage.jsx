import React, { useState } from 'react';
import { cn } from '../../utils/cn';

export const AvatarImage = ({
  src,
  alt = 'Avatar',
  name = '',
  className,
  size = 'md',
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const getInitials = (str) => {
    if (!str) return 'U';
    const parts = str.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl shrink-0 flex items-center justify-center font-bold select-none',
        'bg-gradient-to-br from-blue-600 to-blue-800 text-white',
        sizeClasses[size] || sizeClasses.md,
        className
      )}
    >
      {/* Fallback initials */}
      <span>{getInitials(name)}</span>

      {/* Image overlay */}
      {src && !error && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-200',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}
    </div>
  );
};
