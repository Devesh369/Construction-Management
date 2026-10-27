import React from 'react';
import { Badge as UIBadge, getStatusColor } from './ui/Badge';

export { getStatusColor };

export const Badge = ({ status, variant, children, className, dot }) => {
  return (
    <UIBadge status={status} variant={variant} className={className} dot={dot}>
      {children || status}
    </UIBadge>
  );
};
