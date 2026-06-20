'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, TrendingUp, Shapes, ListOrdered } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';


interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing?: boolean;
  initialData?: any;
  onSave?: (data: any) => void;
}

export default function CategoryModal({
  isOpen,
  onClose,
  isEditing = false,
  initialData = null,
  onSave
}: CategoryModalProps) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    maxPoints: 10,
    sort_order: 10,
    status: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        setFormData({
          id: initialData.id || '',
          name: initialData.name || '',
          description: initialData.description || '',
          maxPoints: initialData.maxPoints || 10,
          sort_order: initialData.sort_order !== undefined ? initialData.sort_order : (initialData.sortOrder || 10),
          status: initialData.status !== undefined ? initialData.status : true
        });
      } else {
        setFormData({
          id: '',
          name: '',
          description: '',
          maxPoints: 10,
          sort_order: 10,
          status: true
        });
      }
      setErrors({});
    }
  }, [isOpen, isEditing, initialData]);

  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.id.trim()) newErrors.id = 'Vui lòng nhập mã danh mục';
    if (!formData.name.trim()) newErrors.name = 'Vui lòng nhập tên danh mục';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    if (onSave) {
      // Tự động đồng bộ mô tả bằng tên để giữ khả năng tương thích cao nhất
      const dataToSave = {
        ...formData,
        sortOrder: formData.sort_order, // Tương thích ngược
        description: formData.description || formData.name
      };
      onSave(dataToSave);
    }
    toast.success(isEditing ? 'Cập nhật danh mục thành công' : 'Thêm danh mục mới thành công');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop mờ và mượt */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900 backdrop-blur-[2px] z-[100]"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 380 }}
              className="w-full max-w-[480px] bg-[linear-gradient(135deg,#EBF2FA_0%,#DCE6F1_100%)] border border-white/80 rounded-2xl shadow-xl shadow-slate-300/40 pointer-events-auto flex flex-col overflow-hidden max-h-[95vh] font-sans"
            >
              {/* Header theo thiết kế Figma */}
              <div className="flex items-center justify-between px-[20px] py-[16px] shrink-0 border-b border-white/50 relative bg-white/40">
                <div className="flex gap-[12px] items-center">
                  <div className="bg-[rgba(19,127,236,0.1)] flex items-center justify-center rounded-[10px] shrink-0 w-[36px] h-[36px] text-[#135bec]">
                    <Shapes size={18} strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col gap-[2px] items-start">
                    <h2 className="font-semibold text-[#0f172a] text-[18px] leading-[24px]">
                      {isEditing ? 'Cập nhật danh mục' : 'Thêm danh mục mới'}
                    </h2>
                    <p className="font-normal text-[#64748b] text-[13px] leading-[18px]">
                      Thiết lập các nhóm điểm đánh giá hệ thống.
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="flex items-center justify-center p-[8px] rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-all duration-200"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>

              {/* Body theo thiết kế Figma */}
              <div className="flex-1 overflow-y-auto px-[20px] py-[20px] space-y-[16px]">
                {/* Mã danh mục */}
                <Input
                  label="Mã danh mục"
                  required
                  error={errors.id}
                  placeholder="Nhập ký tự la mã"
                  className="h-[36px] text-[13px]"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                />

                {/* Tên danh mục */}
                <Input
                  label="Tên danh mục"
                  required
                  error={errors.name}
                  placeholder="Nhập tên chi tiết cho danh mục này..."
                  multiline
                  rows={3}
                  className="text-[13px] min-h-[60px]"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />

                {/* Grid 2 cột: Điểm tối đa & Thứ tự sắp xếp */}
                <div className="grid grid-cols-2 gap-[16px] w-full">
                  {/* Điểm tối đa */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <div className="pl-[4px]">
                      <label className="font-semibold text-[#334155] text-[13px] leading-[20px]">
                        Điểm tối đa
                      </label>
                    </div>
                    <div className="relative w-full">
                      <div className="absolute left-[10px] top-1/2 -translate-y-1/2 text-[#94a3b8]">
                        <TrendingUp size={14} strokeWidth={2.5} />
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        value={formData.maxPoints}
                        onChange={(e) => setFormData({ ...formData, maxPoints: Number(e.target.value) })}
                        className="w-full pl-[32px] pr-3 py-1.5 h-[36px] bg-white/50 backdrop-blur-sm border border-white/70 rounded-xl text-[13px] font-medium text-[#1E293B] transition-all outline-none focus:bg-white/80 focus:ring-2 focus:ring-[#1A73E8]/30"
                      />
                    </div>
                  </div>

                  {/* Thứ tự sắp xếp */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <div className="pl-[4px]">
                      <label className="font-semibold text-[#334155] text-[13px] leading-[20px]">
                        Thứ tự sắp xếp
                      </label>
                    </div>
                    <div className="relative w-full">
                      <div className="absolute left-[10px] top-1/2 -translate-y-1/2 text-[#94a3b8]">
                        <ListOrdered size={14} strokeWidth={2.5} />
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={formData.sort_order}
                        onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
                        className="w-full pl-[32px] pr-3 py-1.5 h-[36px] bg-white/50 backdrop-blur-sm border border-white/70 rounded-xl text-[13px] font-medium text-[#1E293B] transition-all outline-none focus:bg-white/80 focus:ring-2 focus:ring-[#1A73E8]/30"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer theo thiết kế Figma */}
              <div className="flex gap-[10px] items-center justify-end px-[20px] py-[16px] shrink-0 border-t border-white/50 bg-white/30">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-[#475569] hover:text-slate-900 font-semibold text-[13px] rounded-xl hover:bg-white/60 transition-colors duration-200"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleSave}
                  className="bg-[#1A73E8] hover:bg-[#155FC0] text-white px-3 py-1.5 rounded-xl flex items-center justify-center gap-2 font-semibold text-[13px] transition-all shadow-sm active:scale-95 duration-150"
                >
                  <Save size={16} strokeWidth={2.5} />
                  Lưu danh mục
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
