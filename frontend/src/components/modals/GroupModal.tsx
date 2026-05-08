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
            className="fixed inset-0 bg-slate-900 z-50 flex items-center justify-center p-4"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-[480px] flex flex-col pointer-events-auto overflow-hidden font-sans"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                <h2 className="text-xl font-bold text-slate-800">
                  {isEditing ? 'Sửa Nhóm quyền' : 'Thêm Nhóm quyền'}
                </h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <div className="px-6 py-6 bg-white max-h-[70vh] overflow-y-auto">
                <form id="group-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                  {/* Mã nhóm */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-slate-700">
                      Mã nhóm <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleCodeChange}
                      placeholder="VD: G_FINANCE"
                      className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400 ${
                        errors.code ? 'border-rose-300 focus:border-rose-500 bg-rose-50/50' : 'border-slate-100 focus:border-blue-500'
                      }`}
                    />
                    {errors.code ? (
                      <span className="text-xs font-medium text-rose-500">{errors.code}</span>
                    ) : (
                      <span className="text-xs font-medium text-slate-500">Mã định danh duy nhất, viết hoa không dấu.</span>
                    )}
                  </div>

                  {/* Tên nhóm */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-slate-700">
                      Tên nhóm <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="VD: Tài chính & Kế toán"
                      className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400 ${
                        errors.name ? 'border-rose-300 focus:border-rose-500 bg-rose-50/50' : 'border-slate-100 focus:border-blue-500'
                      }`}
                    />
                    {errors.name && <span className="text-xs font-medium text-rose-500">{errors.name}</span>}
                  </div>

                  {/* Mô tả */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-slate-700">Mô tả</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Nhập mô tả ngắn gọn về nhóm quyền này..."
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 resize-none"
                    />
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-white shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  form="group-form"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
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
