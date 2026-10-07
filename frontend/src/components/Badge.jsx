import React from 'react';

export const Badge = ({ status, variant, children }) => {
  let styleClass = 'badge-gray';

  const val = (status || children || '').toString().toUpperCase();

  if (variant) {
    styleClass = `badge-${variant}`;
  } else if (['PRESENT', 'APPROVED', 'VERIFIED', 'PAID', 'ACTIVE'].includes(val)) {
    styleClass = 'badge-green';
  } else if (['PENDING_APPROVAL', 'SUBMITTED', 'DRAFT', 'HALF_DAY', 'OPEN'].includes(val)) {
    styleClass = 'badge-amber';
  } else if (['REJECTED', 'CANCELLED', 'ABSENT', 'OVERDUE', 'FLAGGED'].includes(val)) {
    styleClass = 'badge-red';
  } else if (['ORG_ADMIN', 'PROJECT_MANAGER', 'MATERIAL'].includes(val)) {
    styleClass = 'badge-blue';
  } else if (['SUPERVISOR', 'SITE_ENGINEER', 'FUEL'].includes(val)) {
    styleClass = 'badge-purple';
  } else if (['ACCOUNTANT', 'AUDITOR', 'BANK_TRANSFER'].includes(val)) {
    styleClass = 'badge-cyan';
  }

  return <span className={`badge ${styleClass}`}>{children || status}</span>;
};
