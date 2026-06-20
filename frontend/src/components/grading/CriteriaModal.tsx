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
    is_score_counted: true,
    scoring_mode: 'count' as 'count' | 'single_option',
    options: [] as { id: string; label: string; score: number }[]
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
          is_score_counted: initialData.is_score_counted !== false,
          scoring_mode: initialData.scoring_mode || 'count',
          options: initialData.options || []
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
          is_score_counted: true,
          scoring_mode: 'count',
          options: []
        });
      }
      setErrors({});
    }
  }, [isOpen, isEditing, initialData, defaultCategoryId, categories]);

  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Vui lòng nhập tên tiêu chí';
    if (!formData.categoryId) newErrors.categoryId = 'Vui lòng chọn danh mục';

    if (formData.scoring_mode === 'single_option') {
      if (formData.options.length === 0) {
        newErrors.options = 'Vui lòng thêm ít nhất 1 lựa chọn';
      } else {
        for (let i = 0; i < formData.options.length; i++) {
          if (!formData.options[i].label.trim()) {
            newErrors.options = 'Nhãn lựa chọn không được để trống';
            break;
          }
        }
      }
    } else {
      if (formData.minPoints > formData.maxPoints) {
        newErrors.minPoints = 'Điểm tối thiểu không được lớn hơn điểm tối đa';
      }
      if (formData.points > formData.maxPoints) {
        newErrors.points = 'Bước nhảy điểm không được lớn hơn điểm tối đa';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.options) toast.error(newErrors.options);
      else if (newErrors.minPoints) toast.error(newErrors.minPoints);
      else if (newErrors.maxPoints) toast.error(newErrors.maxPoints);
      else if (newErrors.points) toast.error(newErrors.points);
      else toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
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
              className={`w-full transition-all duration-300 ${formData.scoring_mode === 'single_option' ? 'max-w-[800px]' : 'max-w-[480px]'} bg-[linear-gradient(135deg,#EBF2FA_0%,#DCE6F1_100%)] border border-white/80 rounded-2xl shadow-xl shadow-slate-300/40 pointer-events-auto flex flex-col overflow-hidden max-h-[95vh] font-sans`}
            >
              {/* Header theo thiết kế Figma */}
              <div className="border-b border-white/50 bg-white/40 flex items-center justify-between px-[20px] py-[16px] shrink-0 relative">
                <div className="flex gap-[12px] items-center">
                  <div className="bg-[#eff6ff] flex items-center justify-center rounded-[10px] shrink-0 w-[36px] h-[36px] text-[#135bec]">
                    <BarChart3 size={18} strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col gap-[2px] items-start">
                    <h2 className="font-semibold text-[#0f172a] text-[18px] leading-[24px]">
                      {isEditing ? 'Cập nhật tiêu chí' : 'Thêm tiêu chí mới'}
                    </h2>
                    <p className="font-normal text-[#64748b] text-[13px] leading-[18px]">
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
              <div className={`flex-1 overflow-y-auto px-[20px] py-[20px] ${formData.scoring_mode === 'single_option' ? 'grid grid-cols-2 gap-[24px] items-start' : 'flex flex-col'}`}>
                {/* Cột trái: Thông tin cơ bản */}
                <div className="flex flex-col space-y-[16px] w-full">
                  {/* Phân loại danh mục */}
                <div className="flex flex-col gap-[8px] items-start w-full">
                  <div className="pl-[4px]">
                    <label className="font-semibold text-[#334155] text-[13px] leading-[20px]">
                      Phân loại danh mục <span className="text-[#ef4444]">*</span>
                    </label>
                  </div>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(val: string) => setFormData({ ...formData, categoryId: val })}
                    error={errors.categoryId}
                  >
                    <SelectTrigger className={`w-full px-3 py-1.5 h-[36px] bg-white/50 backdrop-blur-sm border border-white/70 rounded-xl text-[13px] font-medium text-[#1E293B] focus-within:ring-2 focus-within:ring-[#1A73E8]/30 ${errors.categoryId ? 'border-rose-400 ring-2 ring-rose-100' : ''
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
                  className="text-[13px] min-h-[60px]"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />

                {/* Loại điểm */}
                <div className="flex flex-col gap-[8px] items-start w-full">
                  <div className="pl-[4px]">
                    <label className="font-semibold text-[#334155] text-[13px] leading-[20px]">
                      Loại điểm <span className="text-[#ef4444]">*</span>
                    </label>
                  </div>
                  <Select
                    value={formData.type}
                    onValueChange={(val: string) => setFormData({ ...formData, type: val as any })}
                  >
                    <SelectTrigger className="w-full px-3 py-1.5 h-[36px] bg-white/50 backdrop-blur-sm border border-white/70 rounded-xl text-[13px] font-medium text-[#1E293B] focus-within:ring-2 focus-within:ring-[#1A73E8]/30">
                      <SelectValue placeholder="Chọn loại điểm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="khen_thuong">Khen thưởng</SelectItem>
                      <SelectItem value="cong_diem">Cộng điểm</SelectItem>
                      <SelectItem value="ky_luat">Kỷ luật</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Hình thức chấm điểm */}
                <div className="flex flex-col gap-[8px] items-start w-full">
                  <div className="pl-[4px]">
                    <label className="font-semibold text-[#334155] text-[13px] leading-[20px]">
                      Hình thức chấm điểm <span className="text-[#ef4444]">*</span>
                    </label>
                  </div>
                  <Select
                    value={formData.scoring_mode}
                    onValueChange={(val: 'count' | 'single_option') => setFormData({ ...formData, scoring_mode: val })}
                  >
                    <SelectTrigger className="w-full px-3 py-1.5 h-[36px] bg-white/50 backdrop-blur-sm border border-white/70 rounded-xl text-[13px] font-medium text-[#1E293B] focus-within:ring-2 focus-within:ring-[#1A73E8]/30">
                      <SelectValue placeholder="Chọn hình thức" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="count">Đếm số lần (Cộng dồn)</SelectItem>
                      <SelectItem value="single_option">Chọn 1 tùy chọn (Option)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Grid 2 cột: Khoảng điểm & Bước nhảy điểm */}
                <div className="grid grid-cols-2 gap-[16px] w-full items-start">
                  {/* Khoảng điểm */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <div className="pl-[4px]">
                      <label className="font-semibold text-[#334155] text-[13px] leading-[20px]">
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
                        className={`w-full h-[36px] text-center bg-white/50 backdrop-blur-sm border rounded-xl text-[13px] font-medium text-[#1E293B] placeholder:text-slate-400 transition-all outline-none focus:bg-white/80 focus:ring-2 focus:ring-[#1A73E8]/30 ${errors.minPoints ? 'border-rose-400 ring-2 ring-rose-100' : 'border-white/70'
                          }`}
                      />
                      <span className="text-[#94a3b8] text-[14px] font-normal select-none">−</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="Max"
                        value={formData.maxPoints}
                        onChange={(e) => setFormData({ ...formData, maxPoints: Number(e.target.value) })}
                        className={`w-full h-[36px] text-center bg-white/50 backdrop-blur-sm border rounded-xl text-[13px] font-medium text-[#1E293B] placeholder:text-slate-400 transition-all outline-none focus:bg-white/80 focus:ring-2 focus:ring-[#1A73E8]/30 ${errors.minPoints || errors.maxPoints ? 'border-rose-400 ring-2 ring-rose-100' : 'border-white/70'
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
                          className="w-[16px] h-[16px] rounded-[4px] border-[#cbd5e1] text-[#135bec] focus:ring-[#135bec] cursor-pointer transition-colors"
                        />
                        <span className="font-semibold text-[#475569] group-hover:text-slate-900 text-[14px] leading-[20px] transition-colors">
                          <span className="text-[13px]">Khóa tiêu chí</span>
                        </span>
                      </label>
                      {formData.type === 'ky_luat' && (
                        <label className="flex items-center gap-[8px] cursor-pointer select-none group">
                          <input
                            type="checkbox"
                            checked={formData.is_score_counted}
                            onChange={(e) => setFormData({ ...formData, is_score_counted: e.target.checked })}
                            className="w-[16px] h-[16px] rounded-[4px] border-[#cbd5e1] text-[#135bec] focus:ring-[#135bec] cursor-pointer transition-colors"
                          />
                          <span className="font-semibold text-[#475569] group-hover:text-slate-900 text-[14px] leading-[20px] transition-colors">
                            <span className="text-[13px]">Cộng điểm kỷ luật vào tổng điểm</span>
                          </span>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Bước nhảy điểm */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <div className="pl-[4px]">
                      <label className="font-semibold text-[#334155] text-[13px] leading-[20px]">
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
                      disabled={formData.scoring_mode === 'single_option'}
                      className={`w-full px-3 py-1.5 h-[36px] bg-white/50 backdrop-blur-sm border rounded-xl text-[13px] font-medium text-[#1E293B] placeholder:text-slate-400 transition-all outline-none focus:bg-white/80 focus:ring-2 focus:ring-[#1A73E8]/30 ${errors.points ? 'border-rose-400 ring-2 ring-rose-100' : 'border-white/70'} ${formData.scoring_mode === 'single_option' ? 'opacity-50' : ''}`}
                    />
                    {errors.points && (
                      <p className="text-[12px] font-medium text-red-500 mt-1 pl-[4px]">
                        {errors.points}
                      </p>
                    )}
                  </div>
                </div>
                </div>

                {/* Quản lý danh sách tùy chọn (chỉ hiện khi scoring_mode === 'single_option') */}
                {formData.scoring_mode === 'single_option' && (
                  <div className="flex flex-col gap-3 w-full p-4 bg-white/40 border border-white/70 rounded-xl shadow-sm h-full">
                    <div className="flex justify-between items-center pb-2 border-b border-white/50">
                      <label className="font-semibold text-[#334155] text-[14px] leading-[20px]">
                        Danh sách tùy chọn
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          options: [...prev.options, { id: 'opt_' + Date.now() + Math.random().toString(36).substr(2, 5), label: '', score: formData.maxPoints }]
                        }))}
                        className="text-[12px] font-bold text-white bg-[#1A73E8] hover:bg-[#155FC0] px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                      >
                        + Thêm tùy chọn
                      </button>
                    </div>
                    {errors.options && <p className="text-[13px] text-red-500 font-medium bg-red-50 p-2 rounded-lg">{errors.options}</p>}
                    <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar flex-1 max-h-[400px] pr-1">
                      {formData.options.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                          <p className="text-[13px] italic mb-2">Chưa có tùy chọn nào</p>
                          <p className="text-[11px]">Bấm "+ Thêm tùy chọn" để bắt đầu</p>
                        </div>
                      )}
                      {formData.options.map((opt, idx) => (
                        <div key={opt.id} className="flex items-center gap-2 bg-white/50 p-2 rounded-xl border border-white/60">
                          <input
                            type="text"
                            placeholder="Nhãn (VD: Cán bộ lớp)"
                            value={opt.label}
                            onChange={(e) => {
                              const newOpts = [...formData.options];
                              newOpts[idx].label = e.target.value;
                              setFormData({ ...formData, options: newOpts });
                            }}
                            className="flex-1 h-[36px] px-3 bg-white/80 border border-slate-200 rounded-lg text-[13px] focus:ring-2 focus:ring-[#1A73E8]/30 outline-none transition-all"
                          />
                          <input
                            type="number"
                            placeholder="Điểm"
                            value={opt.score}
                            onChange={(e) => {
                              const newOpts = [...formData.options];
                              newOpts[idx].score = Number(e.target.value);
                              setFormData({ ...formData, options: newOpts });
                            }}
                            className="w-[80px] h-[36px] px-2 text-center bg-white/80 border border-slate-200 rounded-lg text-[13px] focus:ring-2 focus:ring-[#1A73E8]/30 outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newOpts = [...formData.options];
                              newOpts.splice(idx, 1);
                              setFormData({ ...formData, options: newOpts });
                            }}
                            className="w-[36px] h-[36px] flex items-center justify-center text-rose-500 hover:bg-rose-100 hover:text-rose-600 rounded-lg transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
