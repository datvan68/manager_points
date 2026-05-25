'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, TrendingUp, Tags } from 'lucide-react';
import { toast } from 'sonner';

interface CriteriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing?: boolean;
  initialData?: any;
  categories: any[];
  onSave?: (data: any) => void;
  defaultCategoryId?: string;
}

export default function CriteriaModal({
  isOpen,
  onClose,
  isEditing = false,
  initialData = null,
  categories = [],
  onSave,
  defaultCategoryId = ''
}: CriteriaModalProps) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    type: 'cong_diem' as 'khen_thuong' | 'cong_diem' | 'ky_luat',
    points: 1,
    minPoints: 0,
    maxPoints: 10,
    categoryId: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        setFormData({
          id: initialData.id || '',
          name: initialData.name || '',
          type: initialData.type || 'cong_diem',
          points: Math.abs(initialData.points || 1), // Lưu dạng số dương trong form, dấu do type quyết định
          minPoints: initialData.minPoints !== undefined ? initialData.minPoints : 0,
          maxPoints: initialData.maxPoints || 10,
          categoryId: initialData.categoryId || defaultCategoryId || (categories[0]?.id || '')
        });
      } else {
        setFormData({
          id: '',
          name: '',
          type: 'cong_diem',
          points: 1,
          minPoints: 0,
          maxPoints: 10,
          categoryId: defaultCategoryId || (categories[0]?.id || '')
        });
      }
      setErrors({});
    }
  }, [isOpen, isEditing, initialData, defaultCategoryId, categories]);

  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Vui lòng nhập tên tiêu chí';
    if (!formData.categoryId) newErrors.categoryId = 'Vui lòng chọn danh mục';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    // Đảm bảo điểm số Kỷ luật lưu dạng âm, còn lại là dương
    const signedPoints = formData.type === 'ky_luat' ? -Math.abs(formData.points) : Math.abs(formData.points);

    if (onSave) {
      onSave({
        ...formData,
        points: signedPoints,
        id: formData.id || `CRI_${Date.now()}` // Tự sinh ID nếu là tạo mới
      });
    }
    toast.success(isEditing ? 'Cập nhật tiêu chí thành công' : 'Thêm tiêu chí mới thành công');
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
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-[546px] bg-white rounded-[24px] shadow-2xl pointer-events-auto flex flex-col overflow-hidden max-h-[95vh]"
            >
              {/* Header */}
              <div className="flex items-start justify-between px-8 pt-8 pb-6 shrink-0 relative">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                    <Tags size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-[22px] font-bold text-slate-900">
                      {isEditing ? 'Cập nhật tiêu chí' : 'Thêm tiêu chí mới'}
                    </h2>
                    <p className="text-[14px] font-medium text-slate-400 mt-0.5">
                      Thiết lập các tiêu chí chấm điểm đánh giá chi tiết.
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
                {/* Tên tiêu chí */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-bold text-slate-700 ml-1">
                    Tên tiêu chí <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text"
                    placeholder="Ví dụ: Đi học đúng giờ, Phát biểu xây dựng bài..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-4 py-3 bg-[#F3F4F6] border-none rounded-xl text-[14px] font-medium transition-all outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/50 ${
                      errors.name ? 'ring-2 ring-rose-200' : ''
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Phân loại tiêu chí */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-slate-700 ml-1">
                      Phân loại <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-4 py-3 bg-[#F3F4F6] border border-transparent rounded-xl text-[14px] font-medium transition-all outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/50 cursor-pointer appearance-none"
                    >
                      <option value="khen_thuong">Khen thưởng</option>
                      <option value="cong_diem">Cộng điểm</option>
                      <option value="ky_luat">Kỷ luật</option>
                    </select>
                  </div>

                  {/* Thuộc danh mục */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-slate-700 ml-1">
                      Thuộc danh mục <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className={`w-full px-4 py-3 bg-[#F3F4F6] border border-transparent rounded-xl text-[14px] font-medium transition-all outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/50 cursor-pointer appearance-none ${
                        errors.categoryId ? 'ring-2 ring-rose-200' : ''
                      }`}
                    >
                      <option value="" disabled>Chọn danh mục</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* Số điểm cộng/trừ */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-slate-700 ml-1">
                      Điểm ({formData.type === 'ky_luat' ? 'trừ' : 'cộng'})
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <TrendingUp size={18} strokeWidth={2.5} />
                      </div>
                      <input 
                        type="number"
                        min={1}
                        max={100}
                        value={formData.points}
                        onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })}
                        className="w-full pl-11 pr-4 py-3 bg-[#F3F4F6] border-none rounded-xl text-[14px] font-bold transition-all outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                      />
                    </div>
                  </div>

                  {/* Dải điểm tối thiểu */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-slate-700 ml-1">
                      Dải điểm (Min)
                    </label>
                    <input 
                      type="number"
                      min={0}
                      value={formData.minPoints}
                      onChange={(e) => setFormData({ ...formData, minPoints: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-[#F3F4F6] border-none rounded-xl text-[14px] font-bold transition-all outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                    />
                  </div>

                  {/* Dải điểm tối đa */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-bold text-slate-700 ml-1">
                      Dải điểm (Max)
                    </label>
                    <input 
                      type="number"
                      min={1}
                      value={formData.maxPoints}
                      onChange={(e) => setFormData({ ...formData, maxPoints: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-[#F3F4F6] border-none rounded-xl text-[14px] font-bold transition-all outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                    />
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
                  Lưu tiêu chí
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
