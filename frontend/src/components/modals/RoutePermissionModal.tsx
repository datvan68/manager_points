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
  { value: 'page', label: 'Trang (Frontend)', icon: Globe, color: 'text-blue-600 bg-blue-50' },
  { value: 'api', label: 'API (Backend)', icon: Cpu, color: 'text-purple-600 bg-purple-50' },
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                  <Route className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {initialData ? 'Chỉnh sửa cấu hình' : 'Thêm cấu hình mới'}
                  </h2>
                  <p className="text-xs text-gray-500">Gán quyền cho trang hoặc chức năng</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {/* Body - Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Route Path & Name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Route Path <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={routePath}
                    onChange={(e) => setRoutePath(e.target.value)}
                    placeholder="/students"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Tên hiển thị <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    placeholder="Quản lý sinh viên"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">Mô tả</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả chức năng của trang/route..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                />
              </div>

              {/* Type Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">Loại</label>
                <div className="grid grid-cols-3 gap-3">
                  {routeTypeOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setType(opt.value)}
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                        type === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <opt.icon size={18} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Check Type */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">Kiểu kiểm tra</label>
                <div className="grid grid-cols-2 gap-3">
                  {checkTypeOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setCheckType(opt.value)}
                      className={`flex flex-col gap-1 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                        checkType === opt.value
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <span className={`text-sm font-bold ${checkType === opt.value ? 'text-blue-700' : 'text-gray-700'}`}>
                        {opt.label}
                      </span>
                      <span className="text-[11px] text-gray-500">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Permissions Selection */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Shield size={16} className="text-blue-500" />
                    Quyền được gán ({selectedPermissions.length})
                  </label>
                </div>
                <input
                  type="text"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  placeholder="Tìm kiếm quyền..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                />
                <div className="border border-gray-200 rounded-xl max-h-[200px] overflow-y-auto divide-y divide-gray-100">
                  {filteredPerms.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">
                      Không tìm thấy quyền nào
                    </div>
                  ) : (
                    filteredPerms.map(perm => (
                      <label
                        key={perm._id}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${
                          selectedPermissions.includes(perm._id) ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(perm._id)}
                          onChange={() => togglePermission(perm._id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{perm.code}</span>
                            <span className="text-sm text-gray-700 truncate">{perm.name}</span>
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Trạng thái</p>
                  <p className="text-xs text-gray-500">{isActive ? 'Đang kích hoạt — quyền sẽ được kiểm tra' : 'Đã tắt — route không bị hạn chế'}</p>
                </div>
                <button
                  onClick={() => setIsActive(!isActive)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${isActive ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${isActive ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving || !routePath.trim() || !routeName.trim()}
                className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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
