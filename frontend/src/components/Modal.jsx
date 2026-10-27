import React from 'react';
import { Modal as UIModal } from './ui/Modal';

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  return (
    <UIModal isOpen={isOpen} onClose={onClose} title={title} size={size}>
      {children}
    </UIModal>
  );
};
