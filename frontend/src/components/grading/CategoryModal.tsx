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
              className="w-full max-w-[546px] bg-white rounded-[24px] shadow-[0px_25px_60px_-15px_rgba(0,0,0,0.15)] pointer-events-auto flex flex-col overflow-hidden max-h-[95vh] font-sans"
            >
              {/* Header theo thiết kế Figma */}
              <div className="flex h-[80px] items-center justify-between px-[32px] py-[16px] shrink-0 border-b border-slate-100 relative">
                <div className="flex gap-[12px] items-center">
                  <div className="bg-[rgba(19,127,236,0.1)] flex items-center justify-center rounded-[12px] shrink-0 w-[40px] h-[40px] text-[#135bec]">
                    <Shapes size={20} strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col gap-[4px] items-start">
                    <h2 className="font-semibold text-[#0f172a] text-[24px] tracking-[-0.6px] leading-[32px]">
                      {isEditing ? 'Cập nhật danh mục' : 'Thêm danh mục mới'}
                    </h2>
                    <p className="font-normal text-[#64748b] text-[14px] leading-[20px]">
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
              <div className="flex-1 overflow-y-auto px-[32px] py-[24px] space-y-[24px]">
                {/* Mã danh mục */}
                <Input
                  label="Mã danh mục"
                  required
                  error={errors.id}
                  placeholder="Nhập ký tự la mã"
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
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />

                {/* Grid 2 cột: Điểm tối đa & Thứ tự sắp xếp */}
                <div className="grid grid-cols-2 gap-[24px] w-full">
                  {/* Điểm tối đa */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <div className="pl-[4px]">
                      <label className="font-semibold text-[#334155] text-[14px] leading-[20px]">
                        Điểm tối đa
                      </label>
                    </div>
                    <div className="relative w-full">
                      <div className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[#94a3b8]">
                        <TrendingUp size={16} strokeWidth={2.5} />
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        value={formData.maxPoints}
                        onChange={(e) => setFormData({ ...formData, maxPoints: Number(e.target.value) })}
                        className="w-full pl-[40px] pr-[16px] py-[12px] bg-[#f8fafc] border border-[rgba(0,0,0,0.05)] rounded-[12px] text-[14px] font-medium text-[#0f172a] transition-all outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                      />
                    </div>
                  </div>

                  {/* Thứ tự sắp xếp */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <div className="pl-[4px]">
                      <label className="font-semibold text-[#334155] text-[14px] leading-[20px]">
                        Thứ tự sắp xếp
                      </label>
                    </div>
                    <div className="relative w-full">
                      <div className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[#94a3b8]">
                        <ListOrdered size={16} strokeWidth={2.5} />
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={formData.sort_order}
                        onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
                        className="w-full pl-[40px] pr-[16px] py-[12px] bg-[#f8fafc] border border-[rgba(0,0,0,0.05)] rounded-[12px] text-[14px] font-medium text-[#0f172a] transition-all outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer theo thiết kế Figma */}
              <div className="flex gap-[12.01px] items-center justify-end p-[32px] shrink-0 border-t border-slate-50">
                <button
                  onClick={onClose}
                  className="px-[24px] py-[12px] text-[#475569] hover:text-slate-900 font-semibold text-[16px] rounded-[16px] hover:bg-slate-50 transition-colors duration-200"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleSave}
                  className="bg-[#135bec] hover:bg-blue-700 text-white px-[20px] py-[10px] rounded-[8px] flex items-center justify-center gap-2 font-semibold text-[14px] transition-all shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.3),0px_4px_6px_-4px_rgba(19,91,236,0.3)] hover:shadow-[0px_12px_20px_-3px_rgba(19,91,236,0.4)] active:scale-95 duration-200"
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
