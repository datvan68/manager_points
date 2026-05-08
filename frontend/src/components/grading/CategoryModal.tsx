'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, TrendingUp, LayoutGrid, Shapes } from 'lucide-react';
import { toast } from 'sonner';

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
          status: initialData.status !== undefined ? initialData.status : true
        });
      } else {
        setFormData({
          id: '',
          name: '',
          description: '',
          maxPoints: 10,
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
      onSave(formData);
    }
    toast.success(isEditing ? 'Cập nhật danh mục thành công' : 'Thêm danh mục mới thành công');
    onClose();
  };

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
            className="fixed inset-0 bg-slate-900/40 z-[100]"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-[546px] bg-white rounded-[24px] shadow-2xl pointer-events-auto flex flex-col overflow-hidden max-h-[95vh] font-sans"
            >
              {/* Header */}
              <div className="flex items-start justify-between px-8 pt-8 pb-6 shrink-0 relative">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                    <Shapes size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-[22px] font-bold text-slate-900">
                      {isEditing ? 'Cập nhật danh mục' : 'Thêm danh mục mới'}
                    </h2>
                    <p className="text-[14px] font-medium text-slate-400 mt-0.5">
                      Thiết lập các nhóm điểm đánh giá hệ thống.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-8 py-2 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  {/* Mã danh mục */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-slate-700 ml-1">
                      Mã danh mục <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text"
                      placeholder="Nhập ký tự la mã"
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      className={`w-full px-4 py-3 bg-[#F3F4F6] border-none rounded-xl text-[14px] font-medium transition-all outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/50 ${
                        errors.id ? 'ring-2 ring-rose-200' : ''
                      }`}
                    />
                  </div>

                  {/* Tên danh mục */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-slate-700 ml-1">
                      Tên danh mục <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text"
                      placeholder="Nhập tên danh mục"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={`w-full px-4 py-3 bg-[#F3F4F6] border-none rounded-xl text-[14px] font-medium transition-all outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/50 ${
                        errors.name ? 'ring-2 ring-rose-200' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Mô tả */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-bold text-slate-700 ml-1">
                    Mô tả
                  </label>
                  <textarea 
                    placeholder="Nhập mô tả chi tiết cho danh mục này..."
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-[#F3F4F6] border-none rounded-2xl text-[14px] font-medium transition-all outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/50 resize-none min-h-[120px] placeholder:text-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 items-end pb-4">
                  {/* Điểm tối đa */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-slate-700 ml-1">
                      Điểm tối đa
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <TrendingUp size={18} strokeWidth={2.5} />
                      </div>
                      <input 
                        type="number"
                        min={0}
                        max={100}
                        value={formData.maxPoints}
                        onChange={(e) => setFormData({ ...formData, maxPoints: Number(e.target.value) })}
                        className="w-full pl-11 pr-4 py-3 bg-[#F3F4F6] border-none rounded-xl text-[14px] font-bold transition-all outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                      />
                    </div>
                  </div>

                  {/* Trạng thái hoạt động */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between px-4 h-[46px] bg-[#F3F4F6] rounded-xl">
                      <span className="text-[13px] font-bold text-slate-700">
                        Trạng thái hoạt động
                      </span>
                      <button 
                        onClick={() => setFormData({ ...formData, status: !formData.status })}
                        className={`relative w-[36px] h-5 rounded-full transition-all duration-300 ${formData.status ? 'bg-[#1D72FE]' : 'bg-slate-300'}`}
                      >
                        <motion.div 
                          animate={{ x: formData.status ? 18 : 2 }}
                          className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end px-8 py-8 shrink-0 relative mt-2 gap-6">
                <button 
                  onClick={onClose}
                  className="text-[15px] font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button 
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-3 bg-[#1D72FE] hover:bg-blue-600 text-white rounded-xl text-[14px] font-bold transition-all shadow-md active:scale-95"
                >
                  <Save size={18} strokeWidth={2.5} />
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
