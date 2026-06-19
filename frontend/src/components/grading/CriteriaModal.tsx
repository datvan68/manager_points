'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, BarChart3, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Input } from '../ui/Input';


interface CriteriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing?: boolean;
  initialData?: any;
  categories: any[];
  criteria?: any[];
  onSave?: (data: any) => void;
  defaultCategoryId?: string;
}

export default function CriteriaModal({
  isOpen,
  onClose,
  isEditing = false,
  initialData = null,
  categories = [],
  criteria = [],
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
    categoryId: '',
    is_locked: false,
    is_score_counted: true
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
          categoryId: initialData.categoryId || defaultCategoryId || (categories[0]?.id || ''),
          is_locked: !!initialData.is_locked,
          is_score_counted: initialData.is_score_counted !== false
        });
      } else {
        setFormData({
          id: '',
          name: '',
          type: 'cong_diem',
          points: 1,
          minPoints: 0,
          maxPoints: 10,
          categoryId: defaultCategoryId || (categories[0]?.id || ''),
          is_locked: false,
          is_score_counted: true
        });
      }
      setErrors({});
    }
  }, [isOpen, isEditing, initialData, defaultCategoryId, categories]);

  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Vui lòng nhập tên tiêu chí';
    if (!formData.categoryId) newErrors.categoryId = 'Vui lòng chọn danh mục';

    if (formData.minPoints > formData.maxPoints) {
      newErrors.minPoints = 'Điểm tối thiểu không được lớn hơn điểm tối đa';
    }

    if (formData.points > formData.maxPoints) {
      newErrors.points = 'Bước nhảy điểm không được lớn hơn điểm tối đa';
    }

    // Kiểm tra tổng max điểm của các tiêu chí trong danh mục không vượt quá điểm tối đa của danh mục đó
    const parentCat = categories.find(cat => cat.id === formData.categoryId);
    if (parentCat) {
      const siblingCriteria = criteria.filter(c => c.categoryId === formData.categoryId && c.id !== formData.id);
      
      // Tách nhóm cộng (khen thưởng & cộng điểm) và nhóm trừ (kỷ luật)
      const siblingPlusCriteria = siblingCriteria.filter(c => c.type !== 'ky_luat');
      const siblingMinusCriteria = siblingCriteria.filter(c => c.type === 'ky_luat');

      const siblingPlusMaxTotal = siblingPlusCriteria.reduce((sum, c) => sum + (c.maxPoints || 0), 0);
      const siblingMinusMaxTotal = siblingMinusCriteria.reduce((sum, c) => sum + (c.maxPoints || 0), 0);

      if (formData.type !== 'ky_luat') {
        const totalPlusMax = siblingPlusMaxTotal + formData.maxPoints;
        if (totalPlusMax > parentCat.maxPoints) {
          newErrors.maxPoints = `Tổng điểm tối đa các tiêu chí cộng (${totalPlusMax}đ) vượt quá điểm tối đa danh mục "${parentCat.name}" (${parentCat.maxPoints}đ)`;
        }
      } else {
        const totalMinusMax = siblingMinusMaxTotal + formData.maxPoints;
        if (totalMinusMax > parentCat.maxPoints) {
          newErrors.maxPoints = `Tổng điểm trừ tối đa các tiêu chí trừ (${totalMinusMax}đ) vượt quá điểm tối đa danh mục "${parentCat.name}" (${parentCat.maxPoints}đ)`;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.minPoints) {
        toast.error(newErrors.minPoints);
      } else if (newErrors.maxPoints) {
        toast.error(newErrors.maxPoints);
      } else if (newErrors.points) {
        toast.error(newErrors.points);
      } else {
        toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      }
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
          {/* Backdrop mờ và mượt */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900 backdrop-blur-[2px] z-[100]"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 380 }}
              className="w-full max-w-[546px] bg-white rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] pointer-events-auto flex flex-col overflow-hidden max-h-[95vh]"
            >
              {/* Header theo thiết kế Figma */}
              <div className="border-b border-slate-100 flex items-start justify-between px-[24px] pb-[25px] pt-[24px] shrink-0 relative">
                <div className="flex gap-[16px] items-start">
                  <div className="bg-[#eff6ff] flex items-center justify-center rounded-[12px] shrink-0 w-[48px] h-[48px] text-[#135bec]">
                    <BarChart3 size={24} strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col gap-[4px] items-start w-[371px]">
                    <h2 className="font-bold text-[#0f172a] text-[20px] leading-[28px]">
                      {isEditing ? 'Cập nhật tiêu chí' : 'Thêm tiêu chí mới'}
                    </h2>
                    <p className="font-normal text-[#64748b] text-[14px] leading-[20px]">
                      Vui lòng điền thông tin chi tiết cho tiêu chí đánh giá mới.
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="flex items-center justify-center p-[8px] rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-all duration-200"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>

              {/* Body Form theo thiết kế Figma */}
              <div className="flex-1 overflow-y-auto p-[32px] space-y-[20px]">
                {/* Phân loại danh mục */}
                <div className="flex flex-col gap-[8px] items-start w-full">
                  <div className="pl-[4px]">
                    <label className="font-semibold text-[#334155] text-[14px] leading-[20px]">
                      Phân loại danh mục <span className="text-[#ef4444]">*</span>
                    </label>
                  </div>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(val: string) => setFormData({ ...formData, categoryId: val })}
                    error={errors.categoryId}
                  >
                    <SelectTrigger className={`w-full px-[16px] py-[12px] h-[48px] bg-[#f8fafc] border border-[rgba(0,0,0,0.05)] rounded-[12px] text-[16px] font-normal text-[#0f172a] focus-within:ring-4 focus-within:ring-blue-100/50 ${errors.categoryId ? 'border-rose-300 ring-2 ring-rose-100 bg-white' : ''
                      }`}>
                      <SelectValue placeholder="Chọn danh mục" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tên tiêu chí */}
                <Input
                  label="Tên tiêu chí"
                  required
                  error={errors.name}
                  placeholder="Nhập tên chi tiết cho tiêu chí này..."
                  multiline
                  rows={3}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />

                {/* Loại điểm */}
                <div className="flex flex-col gap-[8px] items-start w-full">
                  <div className="pl-[4px]">
                    <label className="font-semibold text-[#334155] text-[14px] leading-[20px]">
                      Loại điểm <span className="text-[#ef4444]">*</span>
                    </label>
                  </div>
                  <Select
                    value={formData.type}
                    onValueChange={(val: string) => setFormData({ ...formData, type: val as any })}
                  >
                    <SelectTrigger className="w-full px-[16px] py-[12px] h-[48px] bg-[#f8fafc] border border-[rgba(0,0,0,0.05)] rounded-[12px] text-[16px] font-normal text-[#0f172a] focus-within:ring-4 focus-within:ring-blue-100/50">
                      <SelectValue placeholder="Chọn loại điểm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="khen_thuong">Khen thưởng</SelectItem>
                      <SelectItem value="cong_diem">Cộng điểm</SelectItem>
                      <SelectItem value="ky_luat">Kỷ luật</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Grid 2 cột: Khoảng điểm & Bước nhảy điểm */}
                <div className="grid grid-cols-2 gap-[24px] w-full items-start">
                  {/* Khoảng điểm */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <div className="pl-[4px]">
                      <label className="font-semibold text-[#334155] text-[14px] leading-[20px]">
                        Khoảng điểm
                      </label>
                    </div>
                    <div className="flex gap-[8px] items-center w-full">
                      <input
                        type="number"
                        min={0}
                        placeholder="Min"
                        value={formData.minPoints}
                        onChange={(e) => setFormData({ ...formData, minPoints: Number(e.target.value) })}
                        className={`w-full h-[48px] text-center bg-[#f8fafc] border rounded-[12px] text-[16px] font-normal text-[#0f172a] placeholder:text-[#94a3b8] transition-all outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/50 ${errors.minPoints ? 'border-rose-300 ring-2 ring-rose-100 bg-white' : 'border-[rgba(0,0,0,0.05)]'
                          }`}
                      />
                      <span className="text-[#94a3b8] text-[16px] font-normal select-none">−</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="Max"
                        value={formData.maxPoints}
                        onChange={(e) => setFormData({ ...formData, maxPoints: Number(e.target.value) })}
                        className={`w-full h-[48px] text-center bg-[#f8fafc] border rounded-[12px] text-[16px] font-normal text-[#0f172a] placeholder:text-[#94a3b8] transition-all outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/50 ${errors.minPoints || errors.maxPoints ? 'border-rose-300 ring-2 ring-rose-100 bg-white' : 'border-[rgba(0,0,0,0.05)]'
                          }`}
                      />
                    </div>

                    {/* Tùy chọn nâng cao nằm dưới khoảng điểm */}
                    <div className="flex flex-col gap-[12px] mt-[4px] pl-[4px]">
                      <label className="flex items-center gap-[8px] cursor-pointer select-none group">
                        <input
                          type="checkbox"
                          checked={formData.is_locked}
                          onChange={(e) => setFormData({ ...formData, is_locked: e.target.checked })}
                          className="w-[18px] h-[18px] rounded-[6px] border-[#cbd5e1] text-[#135bec] focus:ring-[#135bec] cursor-pointer transition-colors"
                        />
                        <span className="font-semibold text-[#475569] group-hover:text-slate-900 text-[14px] leading-[20px] transition-colors">
                          Khóa tiêu chí
                        </span>
                      </label>
                      {formData.type === 'ky_luat' && (
                        <label className="flex items-center gap-[8px] cursor-pointer select-none group">
                          <input
                            type="checkbox"
                            checked={formData.is_score_counted}
                            onChange={(e) => setFormData({ ...formData, is_score_counted: e.target.checked })}
                            className="w-[18px] h-[18px] rounded-[6px] border-[#cbd5e1] text-[#135bec] focus:ring-[#135bec] cursor-pointer transition-colors"
                          />
                          <span className="font-semibold text-[#475569] group-hover:text-slate-900 text-[14px] leading-[20px] transition-colors">
                            Cộng điểm kỷ luật vào tổng điểm
                          </span>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Bước nhảy điểm */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <div className="pl-[4px]">
                      <label className="font-semibold text-[#334155] text-[14px] leading-[20px]">
                        Bước nhảy điểm
                      </label>
                    </div>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      placeholder="Ví dụ: 0.5 hoặc 1"
                      value={formData.points}
                      onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })}
                      className={`w-full px-[16px] py-[12px] h-[48px] bg-[#f8fafc] border rounded-[12px] text-[16px] font-normal text-[#0f172a] placeholder:text-[#94a3b8] transition-all outline-none focus:bg-white focus:ring-4 focus:ring-blue-100/50 ${errors.points ? 'border-rose-300 ring-2 ring-rose-100 bg-white' : 'border-[rgba(0,0,0,0.05)]'
                        }`}
                    />
                    {errors.points && (
                      <p className="text-[12px] font-medium text-red-500 mt-1 pl-[4px]">
                        {errors.points}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer theo thiết kế Figma */}
              <div className="flex gap-[16px] items-center justify-end pb-[24px] pt-[8px] px-[24px] shrink-0 border-t border-slate-50">
                <button
                  onClick={onClose}
                  className="px-[32px] py-[12px] text-[#475569] hover:text-slate-900 font-semibold text-[14px] rounded-[16px] hover:bg-slate-50 transition-colors duration-200"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleSave}
                  className="bg-[#135bec] hover:bg-blue-700 text-white px-[20px] py-[10px] rounded-[8px] flex items-center justify-center gap-2 font-semibold text-[14px] transition-all shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.3),0px_4px_6px_-4px_rgba(19,91,236,0.3)] hover:shadow-[0px_12px_20px_-3px_rgba(19,91,236,0.4)] active:scale-95 duration-200"
                >
                  <Save size={16} strokeWidth={2.5} />
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
