import React, { useState, useEffect, useMemo } from 'react';
import { X, Shield, Search, Check, ChevronRight, Info, AlertCircle, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing?: boolean;
  initialData?: any;
  allPermissions: any[];
  groups: any[];
  onSave: (data: any) => Promise<void>;
}

export default function RoleModal({
  isOpen,
  onClose,
  isEditing = false,
  initialData = null,
  allPermissions = [],
  groups = [],
  onSave,
}: RoleModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData && isEditing) {
        // Extract permission IDs if they are objects
        const permIds = (initialData.permissions || []).map((p: any) => 
          typeof p === 'string' ? p : (p._id || p.id)
        );
        
        setFormData({
          name: initialData.name || '',
          description: initialData.description || initialData.desc || '',
          permissions: permIds,
        });
      } else {
        setFormData({
          name: '',
          description: '',
          permissions: [],
        });
      }
      setErrors({});
      setSearchQuery('');
    }
  }, [isOpen, initialData, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const togglePermission = (id: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(id)
        ? prev.permissions.filter(p => p !== id)
        : [...prev.permissions, id]
    }));
  };

  const toggleGroupPermissions = (groupPerms: any[], isAll: boolean) => {
    const permIds = groupPerms.map(p => p._id || p.id);
    if (isAll) {
      // Uncheck all
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(id => !permIds.includes(id))
      }));
    } else {
      // Check all
      setFormData(prev => ({
        ...prev,
        permissions: Array.from(new Set([...prev.permissions, ...permIds]))
      }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Vui lòng nhập Tên vai trò';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setIsSubmitting(true);
      try {
        await onSave(formData);
        onClose();
      } catch (error: any) {
        toast.error('Lỗi khi lưu: ' + error.message);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      toast.error('Vui lòng kiểm tra lại thông tin.');
    }
  };

  // Group permissions for rendering
  const filteredGroups = useMemo(() => {
    return groups.map(group => {
      const perms = (group.permissions || []).filter((p: any) => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.code.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return { ...group, filteredPermissions: perms };
    }).filter(group => group.filteredPermissions.length > 0);
  }, [groups, searchQuery]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900 z-[100]"
          />
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-[24px] shadow-2xl w-full max-w-[1000px] flex flex-col pointer-events-auto overflow-hidden font-sans max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-white shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                      {isEditing ? 'Thiết lập Vai trò' : 'Tạo Vai trò mới'}
                    </h2>
                    <p className="text-sm font-medium text-slate-500">
                      {isEditing ? 'Cập nhật quyền hạn và mô tả cho vai trò hệ thống' : 'Định nghĩa vai trò và phân bổ quyền hạn truy cập'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Main Content: Split Layout */}
              <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Left Panel: Basic Info */}
                <div className="w-full md:w-[380px] p-8 border-r border-slate-100 bg-slate-50/30 overflow-y-auto scrollbar-hover">
                  <form id="role-form" onSubmit={handleSubmit} className="flex flex-col gap-8">
                    <div className="flex flex-col gap-6">
                      <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-widest">
                        <Info className="w-4 h-4" />
                        Thông tin cơ bản
                      </div>

                      {/* Role Name */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-slate-700">
                          Tên vai trò <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="VD: Quản lý Đào tạo"
                          className={`w-full px-4 py-3 bg-white border rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400 ${
                            errors.name ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-blue-500'
                          }`}
                        />
                        {errors.name && <span className="text-xs font-medium text-rose-500 mt-1">{errors.name}</span>}
                      </div>

                      {/* Description */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-slate-700">Mô tả chi tiết</label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleChange}
                          placeholder="Mô tả trách nhiệm của vai trò này trong hệ thống..."
                          rows={4}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-400 resize-none shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Quick Info / Tips */}
                    <div className="mt-4 p-5 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-amber-800">Lưu ý bảo mật</span>
                        <p className="text-[11px] font-medium text-amber-700 leading-relaxed">
                          Việc gán quá nhiều quyền cho một vai trò có thể gây rủi ro bảo mật. Hãy tuân thủ nguyên tắc "Quyền hạn tối thiểu".
                        </p>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Right Panel: Permissions Selection */}
                <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
                  {/* Sub-header with Search */}
                  <div className="px-8 py-4 border-b border-slate-50 bg-white flex items-center justify-between shrink-0">
                    <div className="flex flex-col">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        Cấp quyền truy cập
                        <span className="bg-blue-600 text-[10px] text-white px-2 py-0.5 rounded-full font-black">
                          {formData.permissions.length}
                        </span>
                      </h3>
                    </div>
                    <div className="relative w-[240px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Tìm quyền..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Scrollable Permissions List */}
                  <div className="flex-1 overflow-y-auto p-8 pt-4 scrollbar-hover space-y-8">
                    {filteredGroups.length > 0 ? (
                      filteredGroups.map((group) => {
                        const groupIds = group.filteredPermissions.map((p: any) => p._id || p.id);
                        const selectedInGroup = formData.permissions.filter(id => groupIds.includes(id));
                        const isAllSelected = selectedInGroup.length === groupIds.length && groupIds.length > 0;
                        const isSomeSelected = selectedInGroup.length > 0 && !isAllSelected;

                        return (
                          <div key={group.id} className="flex flex-col gap-4">
                            {/* Group Header */}
                            <div className="flex items-center justify-between bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                  <ChevronRight className={`w-4 h-4 text-blue-600 transition-transform ${isAllSelected || isSomeSelected ? 'rotate-90' : ''}`} />
                                </div>
                                <span className="text-sm font-black text-slate-800">{group.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleGroupPermissions(group.filteredPermissions, isAllSelected)}
                                className={`text-[11px] font-black px-3 py-1.5 rounded-lg transition-all ${
                                  isAllSelected ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-100 hover:bg-blue-50'
                                }`}
                              >
                                {isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả nhóm'}
                              </button>
                            </div>

                            {/* Permissions Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-1">
                              {group.filteredPermissions.map((perm: any) => {
                                const isSensitive = ['ADMIN_FULL', 'DATABASE_BACKUP_DOWNLOAD', 'DATABASE_BACKUP_DELETE'].includes(perm.code);
                                const isChecked = formData.permissions.includes(perm._id || perm.id);

                                return (
                                  <motion.div
                                    key={perm._id || perm.id}
                                    whileHover={{ x: 4 }}
                                    onClick={() => togglePermission(perm._id || perm.id)}
                                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                                      isChecked
                                        ? isSensitive
                                          ? 'bg-rose-50/40 border-rose-300 ring-2 ring-rose-500/5'
                                          : 'bg-blue-50/30 border-blue-200 ring-2 ring-blue-500/5'
                                        : isSensitive
                                          ? 'bg-rose-50/5 border-rose-100 hover:border-rose-300 hover:bg-rose-50/20'
                                          : 'bg-white border-slate-100 hover:border-blue-100 hover:bg-slate-50/50'
                                    }`}
                                  >
                                    <div className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-md border flex items-center justify-center transition-all ${
                                      isChecked
                                        ? isSensitive
                                          ? 'bg-rose-600 border-rose-600 text-white'
                                          : 'bg-blue-600 border-blue-600 text-white'
                                        : isSensitive
                                          ? 'bg-white border-rose-300 group-hover:border-rose-400'
                                          : 'bg-white border-slate-300 group-hover:border-blue-400'
                                    }`}>
                                      {isChecked && <Check className="w-3.5 h-3.5" strokeWidth={4} />}
                                    </div>
                                    <div className="flex flex-col gap-1 w-full min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-sm font-bold text-slate-800 leading-none">{perm.name}</span>
                                        {isSensitive && (
                                          <span className="bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0">
                                            Nhạy cảm
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tight">{perm.code}</span>
                                      {perm.description && (
                                        <span className={`text-[11px] leading-relaxed mt-1 ${
                                          isSensitive ? 'text-rose-600/90 font-semibold' : 'text-slate-500'
                                        }`}>
                                          {perm.description}
                                        </span>
                                      )}
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 py-20">
                        <Search className="w-12 h-12 opacity-20" />
                        <p className="text-sm font-medium">Không tìm thấy quyền nào phù hợp với yêu cầu.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-8 py-5 border-t border-slate-100 bg-slate-50/50 shrink-0">
                <div className="hidden md:flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <Check className="w-3.5 h-3.5 text-blue-500" />
                  Sẵn sàng lưu thay đổi
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 text-sm font-black text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 rounded-xl transition-all shadow-sm"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    form="role-form"
                    disabled={isSubmitting}
                    className="px-8 py-2.5 text-sm font-black text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isEditing ? 'Cập nhật ngay' : 'Xác nhận tạo'}
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
