import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Image as ImageIcon,
  Settings,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  onSave,
}: UserModalProps) {
  const [isActive, setIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    role: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData({
        username: initialData?.user_name || initialData?.username || "",
        email: initialData?.email || "",
        role: initialData?.role?._id || initialData?.role || "",
        password: "",
      });
      setErrors({});
      setIsActive(initialData?.status === "inactive" ? false : true);
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
    if (!formData.username.trim())
      newErrors.username = "Vui lòng nhập tên người dùng";
    if (!formData.email.trim()) {
      newErrors.email = "Vui lòng nhập email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email không hợp lệ";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc!");
      return;
    }

    setErrors({});
    if (onSave) {
      setIsLoading(true);
      try {
        await onSave({ ...formData, status: isActive ? "active" : "inactive" });
        toast.success(
          isEditing
            ? "Cập nhật người dùng thành công!"
            : "Thêm người dùng mới thành công!",
        );
        onClose();
      } catch (error: any) {
        toast.error("Lỗi khi lưu: " + error.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      toast.success(
        isEditing
          ? "Cập nhật người dùng thành công!"
          : "Thêm người dùng mới thành công!",
      );
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
            animate={{ opacity: 0.2 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4 font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-[760px] bg-gradient-to-br from-[#EBF2FA]/92 to-[#DCE6F1]/92 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-900/5 border border-white/80 pointer-events-auto flex flex-col overflow-hidden max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/60 bg-white/10 shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-[#1E293B]">
                    {isEditing ? "Sửa thông tin người dùng" : "Thêm người dùng"}
                  </h2>
                  <p className="text-[12.5px] font-medium text-[#64748B] mt-0.5">
                    Cập nhật thông tin chi tiết và quyền hạn.
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#64748B]">
                      Trạng thái
                    </span>
                    <button
                      onClick={() => setIsActive(!isActive)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isActive ? "bg-[#1A73E8]" : "bg-white/50 border border-white/80"
                      }`}
                    >
                      <span
                        className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white transition-transform shadow-xs ${
                          isActive ? "translate-x-5.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-xs font-bold text-[#1E293B] w-12 ml-0.5">
                      {isActive ? "Hoạt động" : "Tạm khóa"}
                    </span>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1.5 text-[#64748B] hover:text-[#1E293B] hover:bg-white/60 rounded-xl border border-transparent hover:border-white/50 hover:scale-[1.05] active:scale-[0.95] transition-all duration-150 ease-out"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 p-6 bg-transparent overflow-y-auto">
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Left Column: Avatar */}
                  <div className="flex flex-col items-center gap-3 w-full md:w-[200px] shrink-0">
                    {isLoading ? (
                      <Skeleton className="w-[160px] h-[160px] rounded-full" />
                    ) : (
                      <div className="w-[160px] h-[160px] rounded-full bg-white/60 border-2 border-white/90 shadow-sm flex items-center justify-center cursor-pointer hover:bg-white/80 transition-colors group relative overflow-hidden">
                        <User
                          className="w-14 h-14 text-slate-400 group-hover:text-slate-500 transition-colors"
                          strokeWidth={1.5}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    )}

                    <div className="text-center">
                      {isLoading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Skeleton className="w-20 h-4" />
                          <Skeleton className="w-28 h-8" />
                        </div>
                      ) : (
                        <>
                          <button className="text-[13.5px] font-bold text-[#1A73E8] hover:text-[#1A73E8]/80 transition-colors mb-0.5">
                            Tải ảnh lên
                          </button>
                          <p className="text-[11px] font-medium text-[#64748B] leading-relaxed max-w-[160px] mx-auto">
                            Định dạng JPG, PNG, GIF. Tối đa 2MB.
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Form */}
                  <div className="flex-1 flex flex-col gap-6">
                    {/* Basic Info */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 mb-0.5">
                        <User className="w-4.5 h-4.5 text-[#1A73E8]" />
                        <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">
                          Thông tin cơ bản
                        </h3>
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
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[12.5px] font-semibold text-[#64748B]">
                                Tên người dùng{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={formData.username}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    username: e.target.value,
                                  })
                                }
                                placeholder="Nhập tên người dùng"
                                className={`px-3 py-2 bg-white/50 backdrop-blur-sm border ${
                                  errors.username 
                                    ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-500" 
                                    : "border-white/80 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50"
                                } rounded-xl text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2 transition-all duration-150 ease-out placeholder:text-[#64748B]/60`}
                              />
                              {errors.username && (
                                <span className="text-[11px] text-rose-600 font-medium ml-1">
                                  {errors.username}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[12.5px] font-semibold text-[#64748B]">
                                Email <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="email"
                                value={formData.email}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    email: e.target.value,
                                  })
                                }
                                placeholder="ví dụ: vana@email.com"
                                className={`px-3 py-2 bg-white/50 backdrop-blur-sm border ${
                                  errors.email 
                                    ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-500" 
                                    : "border-white/80 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50"
                                } rounded-xl text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2 transition-all duration-150 ease-out placeholder:text-[#64748B]/60`}
                              />
                              {errors.email && (
                                <span className="text-[11px] text-rose-600 font-medium ml-1">
                                  {errors.email}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[12.5px] font-semibold text-[#64748B]">
                                Trạng thái tài khoản
                              </label>
                              <div className="flex items-center gap-3 px-3 py-2 bg-white/50 border border-white/80 rounded-xl select-none">
                                <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                                <span
                                  className={`text-xs font-bold ${isActive ? "text-emerald-700" : "text-slate-500"}`}
                                >
                                  {isActive ? "Hoạt động" : "Tạm khóa"}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5 relative">
                              <label className="text-[12.5px] font-semibold text-[#64748B]">
                                Mật khẩu
                              </label>
                              <div className="relative">
                                <input
                                  type={showPassword ? "text" : "password"}
                                  value={formData.password}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      password: e.target.value,
                                    })
                                  }
                                  placeholder={
                                    isEditing
                                      ? "Để trống nếu không đổi"
                                      : "Nhập mật khẩu"
                                  }
                                  className="w-full pl-3 pr-9 py-2 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 transition-all duration-150 ease-out placeholder:text-[#64748B]/60"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                  {showPassword ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="h-px bg-white/40" />

                    {/* Roles Configuration */}
                    <div className="flex flex-col gap-3.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Settings className="w-4.5 h-4.5 text-[#1A73E8]" />
                        <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">
                          Cấu hình
                        </h3>
                      </div>

                      {isLoading ? (
                        <div className="flex flex-col gap-1.5">
                          <Skeleton className="h-4.5 w-14" />
                          <Skeleton className="h-9 w-full rounded-xl" />
                          <Skeleton className="h-3 w-56 mt-1" />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[12.5px] font-semibold text-[#64748B]">
                            Vai trò
                          </label>
                          <Select
                            value={formData.role}
                            onValueChange={(value: string) =>
                              setFormData({ ...formData, role: value })
                            }
                          >
                            <SelectTrigger className="w-full h-9 px-3 py-1.5 bg-white/50 border border-white/80 rounded-xl text-xs font-semibold text-[#1E293B] transition-all focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50">
                              <SelectValue placeholder="Chọn vai trò..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white/95 backdrop-blur-md border border-white/70 rounded-xl shadow-md shadow-slate-300/30 z-[60]">
                              {roles.map((role) => (
                                <SelectItem
                                  key={role._id}
                                  value={role._id}
                                  className="text-xs font-semibold text-[#1E293B] hover:bg-white/60 rounded-lg cursor-pointer"
                                >
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] font-medium text-[#64748B] mt-1">
                            Gán một vai trò chính cho người dùng này để phân
                            quyền truy cập.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5 px-6 py-4.5 border-t border-white/40 bg-white/10 shrink-0">
                <button
                  onClick={onClose}
                  className="px-5 py-2 text-xs font-bold text-[#64748B] bg-white/50 border border-white/70 hover:bg-white/70 hover:text-[#1E293B] rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 ease-out shadow-xs"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#1A73E8] hover:bg-[#1A73E8]/90 rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 ease-out shadow-md shadow-[#1A73E8]/10"
                >
                  <Save className="w-4.5 h-4.5" strokeWidth={2.5} />
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
