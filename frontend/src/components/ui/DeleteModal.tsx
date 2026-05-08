'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export default function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Xác nhận xóa",
  message = "Bạn có chắc chắn muốn xóa danh mục này? Hành động này không thể hoàn tác.",
  confirmLabel = "Xác nhận xóa",
  cancelLabel = "Hủy bỏ"
}: DeleteModalProps) {
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
                  {/* Warning Icon */}
                  <div className="shrink-0 w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-[#D92D20]">
                    <AlertTriangle size={24} strokeWidth={2.5} />
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

                  {/* Close button - Optional in design but good for UX */}
                  <button 
                    onClick={onClose}
                    className="shrink-0 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={20} strokeWidth={2} />
                  </button>
                </div>

                {/* Actions */}
                <div className="mt-8 flex items-center justify-end gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 md:flex-none px-6 py-2.5 bg-white border border-[#D0D5DD] rounded-xl text-[14px] font-bold text-[#344054] hover:bg-slate-50 transition-colors"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    onClick={() => {
                      onConfirm();
                      onClose();
                    }}
                    className="flex-1 md:flex-none px-6 py-2.5 bg-[#D92D20] border border-[#D92D20] rounded-xl text-[14px] font-bold text-white hover:bg-[#B42318] transition-all shadow-sm"
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
