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
    role_code: '',
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
          role_code: initialData.role_code || '',
          description: initialData.description || initialData.desc || '',
          permissions: permIds,
        });
      } else {
        setFormData({
          name: '',
          role_code: '',
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
    if (!formData.role_code.trim()) newErrors.role_code = 'Vui lòng nhập Mã vai trò';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setIsSubmitting(true);
      try {
        await onSave({
          ...formData,
          role_code: formData.role_code.trim().toUpperCase(),
        });
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
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-[100]"
          />
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white/80 backdrop-blur-lg border border-white/80 rounded-2xl shadow-xl shadow-slate-300/30 w-full max-w-[1000px] flex flex-col pointer-events-auto overflow-hidden font-sans max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/50 bg-white/30 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#1A73E8]/10 border border-[#1A73E8]/20 rounded-xl flex items-center justify-center text-[#1A73E8]">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#1E293B] tracking-tight">
                      {isEditing ? 'Thiết lập Vai trò' : 'Tạo Vai trò mới'}
                    </h2>
                    <p className="text-[11px] font-medium text-[#64748B] mt-0.5">
                      {isEditing ? 'Cập nhật quyền hạn và mô tả cho vai trò hệ thống' : 'Định nghĩa vai trò và phân bổ quyền hạn truy cập'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center text-[#64748B] bg-white/50 hover:bg-white/80 rounded-xl border border-white/80 hover:scale-[1.05] active:scale-[0.95] transition-all duration-150 ease-out"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Main Content: Split Layout */}
              <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Left Panel: Basic Info */}
                <div className="w-full md:w-[320px] p-6 border-r border-white/50 bg-white/20 overflow-y-auto scrollbar-hover flex flex-col gap-6">
                  <form id="role-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <div className="flex flex-col gap-6">
                      <div className="flex items-center gap-1.5 text-[#1A73E8] font-bold text-[10.5px] uppercase tracking-wider">
                        <Info className="w-3.5 h-3.5" />
                        Thông tin cơ bản
                      </div>

                      {/* Role Name */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-[#1E293B]">
                          Tên vai trò <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="VD: Quản lý Đào tạo"
                          className={`w-full px-3 py-2 bg-white/50 backdrop-blur-sm border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 transition-all duration-150 ease-out placeholder:text-[#64748B]/70 ${errors.name ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/80 focus:border-[#1A73E8]/50 shadow-sm'}`}
                        />
                        {errors.name && <span className="text-xs font-medium text-rose-500 mt-1">{errors.name}</span>}
                      </div>

                      {/* Role Code */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-[#1E293B]">
                          Mã vai trò <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="role_code"
                          value={formData.role_code}
                          onChange={handleChange}
                          placeholder="VD: QUAN_LY_DAO_TAO"
                          className={`w-full px-3 py-2 bg-white/50 backdrop-blur-sm border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 transition-all duration-150 ease-out placeholder:text-[#64748B]/70 ${errors.role_code ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/80 focus:border-[#1A73E8]/50 shadow-sm'}`}
                        />
                        {errors.role_code && <span className="text-xs font-medium text-rose-500 mt-1">{errors.role_code}</span>}
                      </div>

                      {/* Description */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-[#1E293B]">Mô tả chi tiết</label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleChange}
                          placeholder="Mô tả trách nhiệm của vai trò này trong hệ thống..."
                          rows={4}
                          className="w-full px-3 py-2 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 transition-all duration-150 ease-out placeholder:text-[#64748B]/70 resize-none shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Quick Info / Tips */}
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 shadow-sm">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-bold text-amber-700">Lưu ý bảo mật</span>
                        <p className="text-[10.5px] font-bold text-amber-700/90 leading-relaxed">
                          Việc gán quá nhiều quyền cho một vai trò có thể gây rủi ro bảo mật. Hãy tuân thủ nguyên tắc "Quyền hạn tối thiểu".
                        </p>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Right Panel: Permissions Selection */}
                <div className="flex-1 flex flex-col bg-transparent overflow-hidden min-w-0">
                  {/* Sub-header with Search */}
                  <div className="px-6 py-3 border-b border-white/50 bg-white/20 flex items-center justify-between shrink-0">
                    <div className="flex flex-col">
                      <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                        Cấp quyền truy cập
                        <span className="bg-[#1A73E8] text-[9.5px] text-white px-1.5 py-0.5 rounded-xl font-bold shadow-sm shadow-[#1A73E8]/20">
                          {formData.permissions.length}
                        </span>
                      </h3>
                    </div>
                    <div className="relative w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]/70" />
                      <input
                        type="text"
                        placeholder="Tìm quyền..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8.5 pr-3 py-1.5 bg-white/50 border border-white/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 transition-all duration-150 ease-out placeholder:text-[#64748B]/70 shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Scrollable Permissions List */}
                  <div className="flex-1 overflow-y-auto p-6 scrollbar-hover space-y-8">
                    {filteredGroups.length > 0 ? (
                      filteredGroups.map((group) => {
                        const groupIds = group.filteredPermissions.map((p: any) => p._id || p.id);
                        const selectedInGroup = formData.permissions.filter(id => groupIds.includes(id));
                        const isAllSelected = selectedInGroup.length === groupIds.length && groupIds.length > 0;
                        const isSomeSelected = selectedInGroup.length > 0 && !isAllSelected;

                        return (
                          <div key={group.id} className="flex flex-col gap-4">
                            {/* Group Header */}
                            <div className="flex items-center justify-between bg-white/40 p-2.5 rounded-xl border border-white/77 shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-white/70 border border-white/80 rounded-xl shadow-xs">
                                  <ChevronRight className={`w-3.5 h-3.5 text-blue-600 transition-transform ${isAllSelected || isSomeSelected ? 'rotate-90' : ''}`} />
                                </div>
                                <span className="text-xs font-bold text-[#1E293B]">{group.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleGroupPermissions(group.filteredPermissions, isAllSelected)}
                                className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98] shadow-sm ${isAllSelected ? 'bg-[#1A73E8] border-[#1A73E8] text-white' : 'bg-white/50 text-[#1A73E8] border-white/80 hover:bg-white/80'}`}
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
                                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 hover:scale-[1.01] ${isChecked ? isSensitive ? 'bg-rose-500/15 border-rose-500/35 ring-2 ring-rose-500/10 shadow-sm' : 'bg-blue-500/15 border-blue-500/35 ring-2 ring-blue-500/10 shadow-sm' : isSensitive ? 'bg-rose-500/5 border-rose-500/10 hover:border-rose-300 hover:bg-rose-500/10' : 'bg-white/30 border-white/50 hover:border-blue-300 hover:bg-white/60 shadow-sm shadow-slate-100/50'}`}
                                  >
                                    <div className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded-lg border flex items-center justify-center transition-all duration-150 ${isChecked ? isSensitive ? 'bg-rose-700 border-rose-700 text-white shadow-sm' : 'bg-[#1A73E8] border-[#1A73E8] text-white shadow-sm' : isSensitive ? 'bg-white/50 border-rose-300' : 'bg-white/50 border-white/80'}`}>
                                      {isChecked && <Check className="w-3 h-3" strokeWidth={4} />}
                                    </div>
                                    <div className="flex flex-col gap-1 w-full min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-bold text-[#1E293B] leading-none">{perm.name}</span>
                                        {isSensitive && (
                                          <span className="bg-rose-500/10 text-rose-700 border border-rose-500/20 text-[8.5px] px-1.5 py-0.5 rounded-xl font-bold uppercase tracking-wider shrink-0 shadow-sm">
                                            Nhạy cảm
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[9.5px] font-mono font-bold text-[#64748B] uppercase tracking-tight">{perm.code}</span>
                                      {perm.description && (
                                        <span className={`text-[10.5px] leading-relaxed mt-1 ${isSensitive ? 'text-rose-700 font-semibold' : 'text-[#64748B]'}`}>
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
                        <Search className="w-6 h-6 opacity-20" />
                        <p className="text-sm font-medium">Không tìm thấy quyền nào phù hợp với yêu cầu.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/50 bg-white/20 shrink-0">
                <div className="hidden md:flex items-center gap-1.5 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                  <Check className="w-3.5 h-3.5 text-blue-500" />
                  Sẵn sàng lưu thay đổi
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 h-9 text-xs font-bold text-[#64748B] bg-white/50 border border-white/80 hover:bg-white/80 hover:text-[#1E293B] rounded-xl transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    form="role-form"
                    disabled={isSubmitting}
                    className="px-6 h-9 text-xs font-bold text-white bg-[#1A73E8] hover:bg-[#155cb4] rounded-xl shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 ease-out disabled:opacity-50 flex items-center gap-1.5 shadow-indigo-100"
                  >
                    {isSubmitting ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
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
