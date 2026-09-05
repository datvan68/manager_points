import React, { useState, useEffect, useMemo } from 'react';
import { X, Shield, Search, Check, ChevronRight, Info, AlertCircle, Save, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing?: boolean;
  initialData?: any;
  allPermissions: any[];
  groups: any[];
  permissionPolicies?: any[];
  onSave: (data: any) => Promise<void>;
}

export default function RoleModal({
  isOpen,
  onClose,
  isEditing = false,
  initialData = null,
  allPermissions = [],
  groups = [],
  permissionPolicies = [],
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

  const handleRoleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, role_code: value }));
    if (errors.role_code) {
      setErrors((prev) => ({ ...prev, role_code: '' }));
    }
  };

  const permissionById = useMemo(() => new Map(allPermissions.map((permission: any) => [permission._id || permission.id, permission])), [allPermissions]);
  const permissionByCode = useMemo(() => new Map(allPermissions.map((permission: any) => [permission.code, permission])), [allPermissions]);
  const policyByCode = useMemo(() => new Map(permissionPolicies.map((policy: any) => [policy.code, policy])), [permissionPolicies]);
  const requiresFor = (code: string): string[] => {
    const policy = policyByCode.get(code);
    if (policy?.requires) return policy.requires;
    if (code.startsWith('CREATE_') || code.startsWith('UPDATE_') || code.startsWith('DELETE_')) {
      return code.includes('CLASS') ? ['READ_CLASS_RECORD'] : code.includes('STUDENT_RECORD') ? ['READ_STUDENT_RECORD'] : [];
    }
    return [];
  };
  const descendantsOf = (code: string): string[] => permissionPolicies
    .filter((policy: any) => (policy.requires || []).includes(code))
    .flatMap((policy: any) => [policy.code, ...descendantsOf(policy.code)]);
  const depthOf = (code: string, seen = new Set<string>()): number => {
    if (seen.has(code)) return 0;
    seen.add(code);
    const requires = requiresFor(code);
    return requires.length ? 1 + Math.max(...requires.map((item) => depthOf(item, new Set(seen)))) : 0;
  };

  const togglePermission = (id: string) => {
    const permission = permissionById.get(id);
    const code = permission?.code || id;
    setFormData(prev => {
      if (prev.permissions.includes(id)) {
        const removedCodes = new Set([code, ...descendantsOf(code)]);
        const removedIds = new Set([...permissionByCode.values()]
          .filter((item: any) => removedCodes.has(item.code))
          .map((item: any) => item._id || item.id));
        return { ...prev, permissions: prev.permissions.filter((item) => !removedIds.has(item)) };
      }
      if (!prev.permissions.some((item) => permissionById.get(item)?.code === 'ADMIN_FULL')) {
        const selectedCodes = new Set(prev.permissions.map((item) => permissionById.get(item)?.code).filter(Boolean));
        const missing = requiresFor(code).filter((dependency) => !selectedCodes.has(dependency));
        if (missing.length) {
          toast.error(`Hãy chọn quyền phụ thuộc trước: ${missing.join(', ')}`);
          return prev;
        }
      }
      return { ...prev, permissions: [...prev.permissions, id] };
    });
  };

  const toggleGroupPermissions = (groupPerms: any[], isAll: boolean) => {
    const permIds = groupPerms.map(p => p._id || p.id);
    if (isAll) {
      // Uncheck all
      const removedCodes = new Set(groupPerms.flatMap((permission: any) => [permission.code, ...descendantsOf(permission.code)]));
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(id => !removedCodes.has(permissionById.get(id)?.code))
      }));
    } else {
      setFormData(prev => {
        const next = new Set(prev.permissions);
        const selectedCodes = new Set([...next].map((id) => permissionById.get(id)?.code).filter(Boolean));
        [...groupPerms].sort((a, b) => depthOf(a.code) - depthOf(b.code)).forEach((permission: any) => {
          const dependencies = requiresFor(permission.code);
          if (selectedCodes.has('ADMIN_FULL') || dependencies.every((dependency) => selectedCodes.has(dependency))) {
            next.add(permission._id || permission.id);
            selectedCodes.add(permission.code);
          }
        });
        return { ...prev, permissions: [...next] };
      });
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
    const query = searchQuery.toLowerCase();
    const all = groups.flatMap((group: any) => group.permissions || []);
    const matches = new Set(all.filter((permission: any) => permission.name.toLowerCase().includes(query) || permission.code.toLowerCase().includes(query)).map((permission: any) => permission.code));
    const visibleCodes = new Set(matches);
    for (const code of matches) requiresFor(code).forEach((dependency) => visibleCodes.add(dependency));
    return groups.map(group => {
      const perms = (group.permissions || [])
        .filter((p: any) => !query || visibleCodes.has(p.code))
        .sort((a: any, b: any) => depthOf(a.code) - depthOf(b.code) || a.code.localeCompare(b.code));
      return { ...group, filteredPermissions: perms };
    }).filter(group => group.filteredPermissions.length > 0);
  }, [groups, searchQuery, permissionPolicies, allPermissions]);

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
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="bg-white/85 backdrop-blur-xl border border-white/80 rounded-2xl shadow-xl shadow-slate-300/30 w-full max-w-[1000px] flex flex-col pointer-events-auto overflow-hidden font-sans max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/60 bg-white/40 shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 bg-[#1A73E8]/10 border border-[#1A73E8]/20 rounded-xl flex items-center justify-center text-[#1A73E8] shadow-xs">
                    <Shield className="w-5 h-5" />
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
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center text-[#64748B] hover:text-[#1E293B] bg-white/50 hover:bg-white/80 rounded-xl border border-white/80 hover:scale-[1.05] active:scale-[0.95] transition-all duration-150 ease-out shadow-xs"
                  aria-label="Đóng modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Main Content: Split Layout */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
                {/* Left Panel: Basic Info */}
                <div className="w-full md:w-[330px] p-6 border-b md:border-b-0 md:border-r border-white/60 bg-white/30 backdrop-blur-sm overflow-y-auto scrollbar-hover flex flex-col gap-6 shrink-0">
                  <form id="role-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <div className="flex flex-col gap-5">
                      <div className="flex items-center gap-1.5 text-[#1A73E8] font-bold text-[11px] uppercase tracking-wider">
                        <Info className="w-3.5 h-3.5" />
                        <span>Thông tin cơ bản</span>
                      </div>

                      {/* Role Name */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[#1E293B]">
                          Tên vai trò <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="VD: Quản lý Đào tạo"
                          className={`w-full px-3 py-2 bg-white/50 backdrop-blur-sm border rounded-xl text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 transition-all duration-150 ease-out placeholder:text-[#64748B]/60 shadow-sm ${
                            errors.name ? 'border-rose-500/50 bg-rose-50/10 focus:border-rose-500 focus:ring-rose-500/20' : 'border-white/80 focus:border-[#1A73E8]/50'
                          }`}
                        />
                        {errors.name && <span className="text-[11px] font-semibold text-rose-500 mt-0.5">{errors.name}</span>}
                      </div>

                      {/* Role Code */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[#1E293B]">
                          Mã vai trò <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="role_code"
                          value={formData.role_code}
                          onChange={handleRoleCodeChange}
                          placeholder="VD: QUAN_LY_DAO_TAO"
                          className={`w-full px-3 py-2 bg-white/50 backdrop-blur-sm border rounded-xl text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 transition-all duration-150 ease-out placeholder:text-[#64748B]/60 shadow-sm ${
                            errors.role_code ? 'border-rose-500/50 bg-rose-50/10 focus:border-rose-500 focus:ring-rose-500/20' : 'border-white/80 focus:border-[#1A73E8]/50'
                          }`}
                        />
                        {errors.role_code && <span className="text-[11px] font-semibold text-rose-500 mt-0.5">{errors.role_code}</span>}
                      </div>

                      {/* Description */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[#1E293B]">Mô tả chi tiết</label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleChange}
                          placeholder="Mô tả trách nhiệm của vai trò này trong hệ thống..."
                          rows={4}
                          className="w-full px-3 py-2 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 transition-all duration-150 ease-out placeholder:text-[#64748B]/60 resize-none shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Quick Info / Tips */}
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 shadow-xs">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-bold text-amber-800">Lưu ý bảo mật</span>
                        <p className="text-[11px] font-medium text-amber-800/90 leading-relaxed">
                          Việc gán quá nhiều quyền cho một vai trò có thể gây rủi ro bảo mật. Hãy tuân thủ nguyên tắc "Quyền hạn tối thiểu".
                        </p>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Right Panel: Permissions Selection */}
                <div className="flex-1 flex flex-col bg-transparent overflow-hidden min-w-0">
                  {/* Sub-header with Search & Count */}
                  <div className="px-6 py-3 border-b border-white/60 bg-white/25 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
                        Cấp quyền truy cập
                      </h3>
                      <div className="inline-flex items-center gap-1 bg-blue-500/10 text-[#1A73E8] border border-blue-500/20 rounded-xl px-2.5 py-0.5 text-[11px] font-bold shadow-xs">
                        <span>Đã chọn:</span>
                        <span className="font-extrabold">{formData.permissions.length}</span>
                      </div>
                    </div>

                    <div className="relative w-full max-w-[220px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]/70" />
                      <input
                        type="text"
                        placeholder="Tìm quyền..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-7 py-1.5 bg-white/50 border border-white/80 rounded-xl text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 transition-all duration-150 ease-out placeholder:text-[#64748B]/70 shadow-sm"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1E293B]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Scrollable Permissions List */}
                  <div className="flex-1 overflow-y-auto p-6 scrollbar-hover space-y-6">
                    {filteredGroups.length > 0 ? (
                      filteredGroups.map((group) => {
                        const groupIds = group.filteredPermissions.map((p: any) => p._id || p.id);
                        const selectedInGroup = formData.permissions.filter(id => groupIds.includes(id));
                        const isAllSelected = selectedInGroup.length === groupIds.length && groupIds.length > 0;
                        const isSomeSelected = selectedInGroup.length > 0 && !isAllSelected;

                        return (
                          <div key={group.id} className="flex flex-col gap-3">
                            {/* Group Header */}
                            <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm p-3 rounded-xl border border-white/80 shadow-sm">
                              <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 bg-white/70 border border-white/80 rounded-xl flex items-center justify-center text-blue-600 shadow-xs">
                                  <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-150 ${isAllSelected || isSomeSelected ? 'rotate-90' : ''}`} />
                                </div>
                                <span className="text-xs font-bold text-[#1E293B]">{group.name}</span>
                                <span className="text-[11px] font-semibold text-[#64748B]">
                                  ({selectedInGroup.length}/{group.filteredPermissions.length})
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleGroupPermissions(group.filteredPermissions, isAllSelected)}
                                className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all duration-150 ease-out hover:scale-[1.01] active:scale-[0.98] shadow-sm ${
                                  isAllSelected
                                    ? 'bg-[#1A73E8] border-[#1A73E8] text-white shadow-blue-500/10'
                                    : 'bg-white/50 text-[#1A73E8] border-white/80 hover:bg-white/80'
                                }`}
                              >
                                {isAllSelected ? 'Bỏ chọn nhóm' : 'Chọn tất cả nhóm'}
                              </button>
                            </div>

                            {/* Permissions Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {group.filteredPermissions.map((perm: any) => {
                                const isSensitive = ['ADMIN_FULL', 'DATABASE_BACKUP_DOWNLOAD', 'DATABASE_BACKUP_DELETE'].includes(perm.code);
                                const isChecked = formData.permissions.includes(perm._id || perm.id);
                                const selectedCodes = new Set(formData.permissions.map((id) => permissionById.get(id)?.code).filter(Boolean));
                                const missingDependencies = selectedCodes.has('ADMIN_FULL') ? [] : requiresFor(perm.code).filter((code) => !selectedCodes.has(code));
                                const dependencyBlocked = missingDependencies.length > 0 && !isChecked;

                                return (
                                  <motion.div
                                    key={perm._id || perm.id}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => !dependencyBlocked && togglePermission(perm._id || perm.id)}
                                    aria-disabled={dependencyBlocked}
                                    title={dependencyBlocked ? `Cần chọn trước: ${missingDependencies.join(', ')}` : undefined}
                                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-150 ease-out ${dependencyBlocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${
                                      isChecked
                                        ? isSensitive
                                          ? 'bg-rose-500/10 border-rose-500/30 ring-1 ring-rose-500/20 shadow-sm'
                                          : 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20 shadow-sm'
                                        : isSensitive
                                        ? 'bg-rose-500/5 border-rose-500/15 hover:border-rose-300/60 hover:bg-rose-500/10 shadow-xs'
                                        : 'bg-white/40 border-white/70 hover:border-blue-400/40 hover:bg-white/65 shadow-xs'
                                    }`}
                                  >
                                    <div
                                      className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded-xl border flex items-center justify-center transition-all duration-150 ${
                                        isChecked
                                          ? isSensitive
                                            ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                                            : 'bg-[#1A73E8] border-[#1A73E8] text-white shadow-xs'
                                          : isSensitive
                                          ? 'bg-white/50 border-rose-300'
                                          : 'bg-white/50 border-white/80'
                                      }`}
                                    >
                                      {isChecked && <Check className="w-3 h-3" strokeWidth={3.5} />}
                                    </div>
                                    <div className="flex flex-col gap-0.5 w-full min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-bold text-[#1E293B] leading-tight">{perm.name}</span>
                                        {isSensitive && (
                                          <span className="inline-flex items-center bg-rose-500/10 text-rose-700 border border-rose-500/20 text-[9px] px-1.5 py-0.5 rounded-xl font-bold uppercase tracking-wider shrink-0 shadow-xs">
                                            Nhạy cảm
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-tight">{perm.code}</span>
                                      {perm.description && (
                                        <span className={`text-[11px] leading-relaxed mt-0.5 ${isSensitive ? 'text-rose-700/90 font-medium' : 'text-[#64748B]'}`}>
                                          {perm.description}
                                        </span>
                                      )}
                                      {dependencyBlocked && (
                                        <span className="text-[10px] font-semibold text-amber-700 mt-0.5">Cần chọn trước: {missingDependencies.join(', ')}</span>
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
                      <div className="h-full flex flex-col items-center justify-center text-[#64748B] gap-3 py-16">
                        <div className="w-12 h-12 rounded-xl bg-white/40 border border-white/80 flex items-center justify-center text-[#64748B]/50 shadow-xs">
                          <Search className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-semibold">Không tìm thấy quyền nào phù hợp với từ khóa.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/60 bg-white/30 shrink-0">
                <div className="hidden md:flex items-center gap-2 text-[11px] font-bold text-[#64748B]">
                  <Sparkles className="w-3.5 h-3.5 text-[#1A73E8]" />
                  <span>Sẵn sàng lưu thông tin phân quyền</span>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-[#64748B] bg-white/50 border border-white/80 hover:bg-white/80 hover:text-[#1E293B] rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] active:scale-[0.98] shadow-sm"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    form="role-form"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-xs font-semibold text-white bg-[#1A73E8] hover:bg-blue-600 border border-[#1A73E8]/20 rounded-xl shadow-sm shadow-blue-500/10 hover:scale-[1.01] active:scale-[0.98] transition-all duration-150 ease-out disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{isEditing ? 'Cập nhật ngay' : 'Xác nhận tạo'}</span>
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
