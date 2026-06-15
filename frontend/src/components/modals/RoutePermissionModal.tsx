'use client';

import React, { useState, useEffect } from 'react';
import { X, Route, Shield, Globe, Cpu, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RoutePermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
  allPermissions: any[];
}

const routeTypeOptions = [
  { value: 'page', label: 'Trang (Frontend)', icon: Globe, color: 'text-[#1A73E8] bg-blue-500/10 border-blue-500/20' },
  { value: 'api', label: 'API (Backend)', icon: Cpu, color: 'text-purple-700 bg-purple-500/10 border-purple-500/20' },
];

const checkTypeOptions = [
  { value: 'all', label: 'Yêu cầu TẤT CẢ quyền', desc: 'User phải có đầy đủ mọi quyền được gán' },
  { value: 'any', label: 'Yêu cầu ÍT NHẤT MỘT', desc: 'User chỉ cần có 1 trong các quyền được gán' },
];

export default function RoutePermissionModal({ isOpen, onClose, onSave, initialData, allPermissions }: RoutePermissionModalProps) {
  const [routePath, setRoutePath] = useState('');
  const [routeName, setRouteName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [checkType, setCheckType] = useState('all');
  const [type, setType] = useState('page');
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [permSearch, setPermSearch] = useState('');

  useEffect(() => {
    if (initialData) {
      setRoutePath(initialData.route_path || '');
      setRouteName(initialData.route_name || '');
      setDescription(initialData.description || '');
      setSelectedPermissions(
        (initialData.permissions || []).map((p: any) => p._id || p)
      );
      setCheckType(initialData.check_type || 'all');
      setType(initialData.type || 'page');
      setIsActive(initialData.is_active !== false);
    } else {
      setRoutePath('');
      setRouteName('');
      setDescription('');
      setSelectedPermissions([]);
      setCheckType('all');
      setType('page');
      setIsActive(true);
    }
    setPermSearch('');
  }, [initialData, isOpen]);

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    );
  };

  const handleSubmit = async () => {
    if (!routePath.trim() || !routeName.trim()) return;
    setIsSaving(true);
    try {
      await onSave({
        route_path: routePath.trim(),
        route_name: routeName.trim(),
        description: description.trim(),
        permissions: selectedPermissions,
        check_type: checkType,
        type,
        is_active: isActive,
      });
      onClose();
    } catch (err) {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  const filteredPerms = allPermissions.filter(p =>
    p.code?.toLowerCase().includes(permSearch.toLowerCase()) ||
    p.name?.toLowerCase().includes(permSearch.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="bg-white/80 backdrop-blur-lg border border-white/80 rounded-2xl shadow-xl shadow-slate-300/30 w-full max-w-[640px] max-h-[90vh] flex flex-col overflow-hidden font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/50 bg-white/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1A73E8]/10 border border-[#1A73E8]/20 rounded-xl flex items-center justify-center text-[#1A73E8]">
                  <Route size={18} className="text-[#1A73E8]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1E293B] tracking-tight">
                    {initialData ? 'Chỉnh sửa cấu hình' : 'Thêm cấu hình mới'}
                  </h2>
                  <p className="text-[11px] font-medium text-[#64748B] mt-0.5">Gán quyền cho trang hoặc chức năng</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-[#64748B] bg-white/50 hover:bg-white/80 rounded-xl border border-white/80 hover:scale-[1.05] active:scale-[0.95] transition-all duration-150 ease-out">
                <X size={16} />
              </button>
            </div>

            {/* Body - Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5 bg-transparent space-y-5">
              {/* Route Path & Name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#1E293B]">Route Path <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={routePath}
                    onChange={(e) => setRoutePath(e.target.value)}
                    placeholder="/students"
                    className="w-full px-3 py-2 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 transition-all duration-150 ease-out placeholder:text-[#64748B]/70 shadow-sm font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#1E293B]">Tên hiển thị <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    placeholder="Quản lý sinh viên"
                    className="w-full px-3 py-2 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 transition-all duration-150 ease-out placeholder:text-[#64748B]/70 shadow-sm"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#1E293B]">Mô tả</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả chức năng của trang/route..."
                  className="w-full px-3 py-2 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 transition-all duration-150 ease-out placeholder:text-[#64748B]/70 shadow-sm"
                />
              </div>

              {/* Type Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#1E293B]">Loại</label>
                <div className="grid grid-cols-3 gap-3">
                  {routeTypeOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setType(opt.value)}
                      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] text-xs font-bold shadow-sm ${type === opt.value ? 'border-[#1A73E8] bg-blue-500/10 text-[#1A73E8]' : 'border-white/80 bg-white/50 text-[#64748B] hover:bg-white/80'}`}
                    >
                      <opt.icon size={16} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Check Type */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#1E293B]">Kiểu kiểm tra</label>
                <div className="grid grid-cols-2 gap-3">
                  {checkTypeOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setCheckType(opt.value)}
                      className={`flex flex-col gap-1 px-4 py-2.5 rounded-xl border transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] text-left ${checkType === opt.value ? 'border-[#1A73E8] bg-blue-500/10 shadow-sm' : 'border-white/80 bg-white/50 hover:bg-white/80'}`}
                    >
                      <span className={`text-xs font-bold ${checkType === opt.value ? 'text-[#1A73E8]' : 'text-[#1E293B]'}`}>
                        {opt.label}
                      </span>
                      <span className="text-[10.5px] font-bold text-[#64748B]/70">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Permissions Selection */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1E293B] flex items-center gap-2">
                    <Shield size={16} className="text-blue-500" />
                    Quyền được gán ({selectedPermissions.length})
                  </label>
                </div>
                <input
                  type="text"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  placeholder="Tìm kiếm quyền..."
                  className="w-full px-3 py-1.5 bg-white/50 border border-white/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 transition-all duration-150 ease-out placeholder:text-[#64748B]/70 shadow-sm"
                />
                <div className="bg-white/60 border border-white/80 shadow-sm rounded-xl max-h-[200px] overflow-y-auto divide-y divide-white/40 p-1">
                  {filteredPerms.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">
                      Không tìm thấy quyền nào
                    </div>
                  ) : (
                    filteredPerms.map(perm => (
                      <label
                        key={perm._id}
                        className={`flex items-center gap-3 px-3.5 py-2 cursor-pointer hover:bg-white/45 transition-colors rounded-lg ${selectedPermissions.includes(perm._id) ? 'bg-blue-500/10' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(perm._id)}
                          onChange={() => togglePermission(perm._id)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-[#1A73E8] focus:ring-[#1A73E8]/30 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[9.5px] font-mono font-bold text-[#1A73E8] bg-blue-500/10 px-2 py-0.5 rounded-xl border border-blue-500/20">{perm.code}</span>
                            <span className="text-xs font-semibold text-[#1E293B] truncate">{perm.name}</span>
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between px-4 py-3 bg-white/40 border border-white/70 shadow-sm rounded-xl">
                <div>
                  <p className="text-xs font-bold text-[#1E293B]">Trạng thái</p>
                  <p className="text-[10.5px] font-bold text-[#64748B] mt-0.5">{isActive ? 'Đang kích hoạt — quyền sẽ được kiểm tra' : 'Đã tắt — route không bị hạn chế'}</p>
                </div>
                <button
                  onClick={() => setIsActive(!isActive)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${isActive ? 'bg-[#1A73E8]' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${isActive ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/50 bg-white/20 shrink-0">
              <button
                onClick={onClose}
                className="px-5 h-9 text-xs font-bold text-[#64748B] bg-white/50 border border-white/80 hover:bg-white/80 hover:text-[#1E293B] rounded-xl transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98] shadow-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving || !routePath.trim() || !routeName.trim()}
                className="px-6 h-9 text-xs font-bold text-white bg-[#1A73E8] hover:bg-[#155cb4] rounded-xl shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 ease-out disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-indigo-100"
              >
                {isSaving ? 'Đang lưu...' : initialData ? 'Cập nhật' : 'Tạo mới'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
