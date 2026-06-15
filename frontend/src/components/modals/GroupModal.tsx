import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing?: boolean;
  initialData?: any;
  onSave?: (data: any) => Promise<void>;
}

export default function GroupModal({ isOpen, onClose, isEditing = false, initialData = null, onSave }: GroupModalProps) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData && isEditing) {
        setFormData({
          code: initialData.code || initialData.tag || '', // Fallback to tag if it exists in mock data
          name: initialData.name || '',
          description: initialData.description || initialData.desc || '', // Fallback to desc if it exists in mock data
        });
      } else {
        setFormData({
          code: '',
          name: '',
          description: '',
        });
      }
      setErrors({});
    }
  }, [isOpen, initialData, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Convert code to uppercase without accents
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Basic conversion: normalize to NFD, remove combining diacritical marks, remove spaces, uppercase
    const cleanValue = rawValue
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .toUpperCase();

    setFormData((prev) => ({ ...prev, code: cleanValue }));
    if (errors.code) {
      setErrors((prev) => ({ ...prev, code: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.code.trim()) {
      newErrors.code = 'Vui lòng nhập Mã nhóm';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'Vui lòng nhập Tên nhóm';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setIsSubmitting(true);
      try {
        if (onSave) {
          await onSave(formData);
        } else {
          // Simulation fallback
          await new Promise(resolve => setTimeout(resolve, 500));
          toast.success(isEditing ? 'Cập nhật nhóm quyền thành công!' : 'Thêm nhóm quyền thành công!');
        }
        onClose();
      } catch (error: any) {
        toast.error('Lỗi: ' + error.message);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      toast.error('Vui lòng kiểm tra lại thông tin nhóm quyền.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white/80 backdrop-blur-lg border border-white/80 rounded-2xl shadow-xl shadow-slate-300/30 w-full max-w-[480px] flex flex-col pointer-events-auto overflow-hidden font-sans"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/50 bg-white/30 shrink-0">
                <h2 className="text-base font-bold text-[#1E293B] tracking-tight">
                  {isEditing ? 'Sửa Nhóm quyền' : 'Thêm Nhóm quyền'}
                </h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center text-[#64748B] bg-white/50 hover:bg-white/80 rounded-xl border border-white/80 hover:scale-[1.05] active:scale-[0.95] transition-all duration-150 ease-out"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <div className="px-6 py-6 bg-transparent max-h-[70vh] overflow-y-auto">
                <form id="group-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                  {/* Mã nhóm */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-[#1E293B]">
                      Mã nhóm <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleCodeChange}
                      placeholder="VD: G_FINANCE"
                      className={`w-full px-3 py-2 bg-white/50 backdrop-blur-sm border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 transition-all duration-150 ease-out placeholder:text-[#64748B]/70 ${errors.code ? 'border-rose-500/50 focus:border-rose-500 bg-rose-50/5' : 'border-white/80 focus:border-[#1A73E8]/50 shadow-sm'}`}
                    />
                    {errors.code ? (
                      <span className="text-xs font-medium text-rose-500">{errors.code}</span>
                    ) : (
                      <span className="text-[10.5px] font-bold text-[#64748B]/80 mt-1">Mã định danh duy nhất, viết hoa không dấu.</span>
                    )}
                  </div>

                  {/* Tên nhóm */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-[#1E293B]">
                      Tên nhóm <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="VD: Tài chính & Kế toán"
                      className={`w-full px-3 py-2 bg-white/50 backdrop-blur-sm border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 transition-all duration-150 ease-out placeholder:text-[#64748B]/70 ${errors.name ? 'border-rose-500/50 focus:border-rose-500 bg-rose-50/5' : 'border-white/80 focus:border-[#1A73E8]/50 shadow-sm'}`}
                    />
                    {errors.name && <span className="text-xs font-medium text-rose-500">{errors.name}</span>}
                  </div>

                  {/* Mô tả */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-[#1E293B]">Mô tả</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Nhập mô tả ngắn gọn về nhóm quyền này..."
                      rows={3}
                      className="w-full px-3 py-2 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 transition-all duration-150 ease-out placeholder:text-[#64748B]/70 resize-none shadow-sm"
                    />
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/50 bg-white/20 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 h-9 text-xs font-bold text-[#64748B] bg-white/50 border border-white/80 hover:bg-white/80 hover:text-[#1E293B] rounded-xl transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  form="group-form"
                  disabled={isSubmitting}
                  className="px-6 h-9 text-xs font-bold text-white bg-[#1A73E8] hover:bg-[#155cb4] rounded-xl shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 ease-out disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-indigo-100"
                >
                  {isSubmitting ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    />
                  ) : null}
                  Lưu Nhóm
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
