import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Image as ImageIcon, Settings, Save, Eye, EyeOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing?: boolean;
  initialData?: any;
  roles?: any[];
  onSave?: (data: any) => Promise<void>;
}

export default function UserModal({ 
  isOpen, 
  onClose, 
  isEditing = false, 
  initialData = null,
  roles = [],
  onSave
}: UserModalProps) {
  const [isActive, setIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: '',
    password: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData({
        username: initialData?.username || '',
        email: initialData?.email || '',
        role: initialData?.role?._id || initialData?.role || '',
        password: ''
      });
      setErrors({});
      setIsActive(initialData?.status === 'inactive' ? false : true);
    }
  }, [isOpen, initialData]);

  // Simulate fetching dynamic data when editing
  useEffect(() => {
    if (isOpen && isEditing) {
      setIsLoading(true);
      const t = setTimeout(() => {
        setIsLoading(false);
      }, 500); // skeleton loading time
      return () => clearTimeout(t);
    } else {
      setIsLoading(false);
    }
  }, [isOpen, isEditing]);

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!formData.username.trim()) newErrors.username = 'Vui lòng nhập tên người dùng';
    if (!formData.email.trim()) {
      newErrors.email = 'Vui lòng nhập email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc!');
      return;
    }

    setErrors({});
    if (onSave) {
      setIsLoading(true);
      try {
        await onSave({ ...formData, status: isActive ? 'active' : 'inactive' });
        toast.success(isEditing ? 'Cập nhật người dùng thành công!' : 'Thêm người dùng mới thành công!');
        onClose();
      } catch (error: any) {
        toast.error('Lỗi khi lưu: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      toast.success(isEditing ? 'Cập nhật người dùng thành công!' : 'Thêm người dùng mới thành công!');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-50"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4 font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-[800px] bg-white rounded-2xl shadow-xl pointer-events-auto flex flex-col overflow-hidden max-h-[90vh]"
            >
              
              {/* Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    {isEditing ? 'Sửa thông tin người dùng' : 'Thêm người dùng'}
                  </h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">
                    Cập nhật thông tin chi tiết và quyền hạn.
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-600">Trạng thái</span>
                    <button 
                      onClick={() => setIsActive(!isActive)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                        isActive ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        isActive ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                    <span className="text-sm font-medium text-slate-500 w-12">{isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <button 
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
                <div className="flex flex-col md:flex-row gap-10">
                  
                  {/* Left Column: Avatar */}
                  <div className="flex flex-col items-center gap-4 w-full md:w-[220px] shrink-0">
                    {isLoading ? (
                      <Skeleton className="w-[180px] h-[180px] rounded-full" />
                    ) : (
                      <div className="w-[180px] h-[180px] rounded-full bg-slate-100 border-4 border-white shadow-sm flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-colors group relative overflow-hidden">
                        <User className="w-16 h-16 text-slate-400 group-hover:text-slate-500 transition-colors" strokeWidth={1.5} />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-white" />
                        </div>
                      </div>
                    )}
                    
                    <div className="text-center">
                      {isLoading ? (
                         <div className="flex flex-col items-center gap-2">
                            <Skeleton className="w-24 h-5" />
                            <Skeleton className="w-32 h-10" />
                         </div>
                      ) : (
                        <>
                          <button className="text-[15px] font-bold text-blue-600 hover:text-blue-700 hover:underline mb-1">
                            Tải ảnh lên
                          </button>
                          <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-[180px] mx-auto">
                            Định dạng JPG, PNG, GIF. Tối đa 2MB.
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Form */}
                  <div className="flex-1 flex flex-col gap-8">
                    
                    {/* Basic Info */}
                    <div className="flex flex-col gap-5">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-5 h-5 text-blue-600" />
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Thông tin cơ bản</h3>
                      </div>
                      
                      {isLoading ? (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Skeleton className="h-[70px] w-full rounded-xl" />
                            <Skeleton className="h-[70px] w-full rounded-xl" />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Skeleton className="h-[70px] w-full rounded-xl" />
                            <Skeleton className="h-[70px] w-full rounded-xl" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-sm font-semibold text-slate-700">Tên người dùng <span className="text-red-500">*</span></label>
                              <input 
                                type="text" 
                                value={formData.username}
                                onChange={(e) => setFormData({...formData, username: e.target.value})}
                                placeholder="Nhập tên người dùng"
                                className={`px-4 py-2.5 bg-slate-50 border ${errors.username ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500' : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'} rounded-xl text-[15px] font-medium text-slate-800 focus:outline-none focus:ring-2 transition-all placeholder:text-slate-400`}
                              />
                              {errors.username && <span className="text-xs text-red-500 font-medium ml-1">{errors.username}</span>}
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-sm font-semibold text-slate-700">Email <span className="text-red-500">*</span></label>
                              <input 
                                type="email" 
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                                placeholder="ví dụ: vana@email.com"
                                className={`px-4 py-2.5 bg-slate-50 border ${errors.email ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500' : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'} rounded-xl text-[15px] font-medium text-slate-800 focus:outline-none focus:ring-2 transition-all placeholder:text-slate-400`}
                              />
                              {errors.email && <span className="text-xs text-red-500 font-medium ml-1">{errors.email}</span>}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-sm font-semibold text-slate-700">Trạng thái tài khoản</label>
                              <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                                <span className={`text-sm font-bold ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  {isActive ? 'Hoạt động' : 'Tạm khóa'}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5 relative">
                              <label className="text-sm font-semibold text-slate-700">Mật khẩu</label>
                              <div className="relative">
                                <input 
                                  type={showPassword ? 'text' : 'password'} 
                                  value={formData.password}
                                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                                  placeholder={isEditing ? 'Để trống nếu không đổi' : 'Nhập mật khẩu'}
                                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                                />
                                <button 
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="h-px bg-slate-100" />

                    {/* Roles Configuration */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-blue-600" />
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Cấu hình</h3>
                      </div>

                      {isLoading ? (
                        <div className="flex flex-col gap-2">
                           <Skeleton className="h-4 w-16" />
                           <Skeleton className="h-14 w-full rounded-xl" />
                           <Skeleton className="h-4 w-64 mt-1" />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-semibold text-slate-700">Vai trò</label>
                          <Select 
                            value={formData.role}
                            onValueChange={(value) => setFormData({...formData, role: value})}
                          >
                            <SelectTrigger className="w-full h-[52px] px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium text-slate-800 transition-all focus:ring-blue-500/20">
                              <SelectValue placeholder="Chọn vai trò..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white border border-slate-200 rounded-xl shadow-lg z-[60]">
                              {roles.map(role => (
                                <SelectItem key={role._id} value={role._id} className="cursor-pointer">
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs font-medium text-slate-500 mt-1">
                            Gán một vai trò chính cho người dùng này để phân quyền truy cập.
                          </p>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>

               {/* Footer */}
               <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-slate-100 bg-white shrink-0">
                  <button 
                    onClick={onClose}
                    className="px-6 py-2.5 text-[15px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 rounded-xl transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 px-6 py-2.5 text-[15px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 transition-colors"
                  >
                    <Save className="w-[18px] h-[18px]" strokeWidth={2.5} />
                    Lưu thông tin
                  </button>
               </div>

            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
