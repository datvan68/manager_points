'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  showCancel?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Xác nhận hành động",
  message = "Bạn có chắc chắn muốn thực hiện hành động này?",
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy bỏ",
  variant = "info",
  showCancel = true
}: ConfirmModalProps) {
  
  // Icon and style matching based on variant
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertTriangle size={24} strokeWidth={2.5} />,
          iconBg: 'bg-red-50 text-[#D92D20]',
          confirmBtn: 'bg-[#D92D20] border-[#D92D20] hover:bg-[#B42318] text-white shadow-sm'
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={24} strokeWidth={2.5} />,
          iconBg: 'bg-amber-50 text-amber-600',
          confirmBtn: 'bg-amber-600 border-amber-600 hover:bg-amber-700 text-white shadow-sm'
        };
      case 'success':
        return {
          icon: <CheckCircle2 size={24} strokeWidth={2.5} />,
          iconBg: 'bg-emerald-50 text-emerald-600',
          confirmBtn: 'bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
        };
      case 'info':
      default:
        return {
          icon: <Info size={24} strokeWidth={2.5} />,
          iconBg: 'bg-blue-50 text-blue-600',
          confirmBtn: 'bg-blue-600 border-blue-600 hover:bg-blue-700 text-white shadow-sm'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-[200]"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-[448px] bg-white rounded-[20px] shadow-2xl pointer-events-auto overflow-hidden font-sans"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className={cn("shrink-0 w-12 h-12 rounded-full flex items-center justify-center", styles.iconBg)}>
                    {styles.icon}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 pt-1">
                    <h3 className="text-[18px] font-bold text-[#101828] mb-1">
                      {title}
                    </h3>
                    <p className="text-[14px] leading-relaxed text-[#475467]">
                      {message}
                    </p>
                  </div>

                  {/* Close button */}
                  <button 
                    onClick={onClose}
                    className="shrink-0 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={20} strokeWidth={2} />
                  </button>
                </div>

                {/* Actions */}
                <div className="mt-8 flex items-center justify-end gap-3">
                  {showCancel && (
                    <button
                      onClick={onClose}
                      className="flex-1 md:flex-none px-6 py-2.5 bg-white border border-[#D0D5DD] rounded-xl text-[14px] font-bold text-[#344054] hover:bg-slate-50 transition-colors"
                    >
                      {cancelLabel}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onConfirm();
                      onClose();
                    }}
                    className={cn("flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[14px] font-bold transition-all", styles.confirmBtn)}
                  >
                    {confirmLabel}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
