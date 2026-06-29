import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeleteHistoryModalProps {
  isOpen: boolean;
  recordTitle: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteHistoryModal({ isOpen, recordTitle, onClose, onConfirm }: DeleteHistoryModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-[#1E293B]/40 backdrop-blur-[4px] z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white/90 backdrop-blur-md rounded-[24px] border border-white/80 shadow-2xl p-6 max-w-md w-full flex flex-col gap-4 font-sans"
          >
            <div className="flex gap-4 items-start">
              <div className="p-3 bg-rose-500/10 text-rose-600 rounded-full shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-bold text-[#1E293B] text-[17px]">
                  Xác nhận xóa lịch sử?
                </h3>
                <p className="text-[#64748B] text-[13.5px] leading-relaxed">
                  Bạn có chắc chắn muốn xóa lịch sử ghi nhận tiêu chí{" "}
                  <span className="font-semibold text-[#1E293B]">
                    "{recordTitle}"
                  </span>
                  ? Điểm số thời gian thực và tổng điểm rèn luyện của sinh
                  viên sẽ tự động được cập nhật lại tương ứng.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/60">
              <button
                onClick={onClose}
                className="px-5 py-2 border border-slate-200 text-[#64748B] hover:bg-slate-50 rounded-full font-bold text-[13px] transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={onConfirm}
                className="px-6 py-2 bg-rose-600 text-white rounded-full font-bold text-[13px] hover:bg-rose-700 transition-colors shadow-sm cursor-pointer flex items-center gap-1.5 hover:scale-[1.02]"
              >
                <Trash2 size={13} />
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
