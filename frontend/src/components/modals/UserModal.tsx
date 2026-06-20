import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Image as ImageIcon,
  Settings,
  Save,
  Eye,
  EyeOff,
  Users,
  Plus,
  Trash2,
  ChevronDown,
  Check,
  Search
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MultiClassSelect = ({ selectedIds, onChange, classes, disabled, placeholder = "Không gán", className }: { selectedIds: string[], onChange: (ids: string[]) => void, classes: any[], disabled?: boolean, placeholder?: string, className?: string }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClasses = classes?.filter(cls => {
    const name = cls.class_name || cls.name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  }) || [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} className={`relative flex items-center justify-between transition-all text-left ${className || 'h-10 w-full rounded-xl border border-white/80 bg-white/50 backdrop-blur-sm px-3 py-2 text-xs'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/60 focus:ring-2 focus:ring-[#1A73E8]/30'}`}>
          <span className="truncate text-slate-700 font-medium">
            {selectedIds.length > 0
              ? `${selectedIds.length} lớp đã chọn`
              : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-1 text-slate-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-1.5 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 z-[9999]" align="start">
        <div className="px-1.5 pb-1.5 pt-0.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm lớp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-md border border-slate-200 bg-white/50 pl-7 pr-2 text-xs focus:border-[#1A73E8] focus:outline-none focus:ring-1 focus:ring-[#1A73E8]"
            />
          </div>
        </div>
        <div className="max-h-[180px] overflow-y-auto space-y-0.5 scrollbar-hover">
          {filteredClasses.length === 0 ? (
            <div className="py-2 text-center text-[11px] text-slate-400">Không có lớp nào</div>
          ) : (
            filteredClasses.map(cls => (
              <label key={cls._id || cls.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={selectedIds.includes(cls._id || cls.id)} 
                  onChange={(e) => {
                    const id = cls._id || cls.id;
                    if (e.target.checked) onChange([...selectedIds, id]);
                    else onChange(selectedIds.filter(i => i !== id));
                  }}
                  className="w-3.5 h-3.5 text-[#1A73E8] rounded border-slate-300"
                />
                <span className="text-xs text-slate-700 font-medium">{cls.class_name || cls.name}</span>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing?: boolean;
  initialData?: any;
  roles?: any[];
  classes?: any[];
  onSave?: (data: any) => Promise<void>;
  onBulkSave?: (data: any) => Promise<any>;
}

export default function UserModal({
  isOpen,
  onClose,
  isEditing = false,
  initialData = null,
  roles = [],
  classes = [],
  onSave,
  onBulkSave,
}: UserModalProps) {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [isActive, setIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Single mode state
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    role: "",
    password: "",
    advisorClassIds: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Bulk mode state
  const [bulkUsers, setBulkUsers] = useState<any[]>([]);
  const [useCommonPassword, setUseCommonPassword] = useState(false);
  const [commonPassword, setCommonPassword] = useState("");
  const [bulkResult, setBulkResult] = useState<any>(null);
  
  const prevIsOpen = useRef(false);

  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      setMode("single");
      let userClassIds: string[] = [];
      if (initialData) {
        const userId = initialData._id || initialData.id;
        if (userId && classes) {
          userClassIds = classes
            .filter((c: any) => {
              if (!c.advisor_id) return false;
              const advId = typeof c.advisor_id === 'object' ? (c.advisor_id._id || c.advisor_id.id) : c.advisor_id;
              return advId === userId;
            })
            .map((c: any) => c._id || c.id);
        }
      }

      setFormData({
        username: initialData?.user_name || initialData?.username || "",
        email: initialData?.email || "",
        role: initialData?.role?._id || initialData?.role || "",
        password: "",
        advisorClassIds: userClassIds,
      });
      setErrors({});
      setIsActive(initialData?.status === "inactive" ? false : true);

      // Reset bulk
      setBulkUsers([
        { id: Date.now().toString(), username: "", email: "", role: roles?.[0]?._id || "", status: "active", password: "", advisorClassIds: [] }
      ]);
      setUseCommonPassword(false);
      setCommonPassword("");
      setBulkResult(null);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, initialData, roles]);

  useEffect(() => {
    if (isOpen && isEditing) {
      setIsLoading(true);
      const t = setTimeout(() => {
        setIsLoading(false);
      }, 500);
      return () => clearTimeout(t);
    } else {
      setIsLoading(false);
    }
  }, [isOpen, isEditing]);

  const handleSaveSingle = async () => {
    const newErrors: Record<string, string> = {};
    if (!formData.username.trim())
      newErrors.username = "Vui lòng nhập tên người dùng";
    if (!formData.email.trim()) {
      newErrors.email = "Vui lòng nhập email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email không hợp lệ";
    }
    if (!isEditing && !formData.password.trim()) {
      newErrors.password = "Vui lòng nhập mật khẩu";
    }
    if (!formData.role) {
      newErrors.role = "Vui lòng chọn vai trò";
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
        await onSave({ ...formData, advisor_class_ids: formData.advisorClassIds, status: isActive ? "active" : "inactive" });
        toast.success(
          isEditing
            ? "Cập nhật người dùng thành công!"
            : "Thêm người dùng mới thành công!"
        );
        onClose();
      } catch (error: any) {
        toast.error("Lỗi khi lưu: " + error.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      onClose();
    }
  };

  const addBulkRow = () => {
    setBulkUsers([
      ...bulkUsers,
      { id: Date.now().toString(), username: "", email: "", role: roles?.[0]?._id || "", status: "active", password: "", advisorClassIds: [] }
    ]);
  };

  const removeBulkRow = (id: string) => {
    if (bulkUsers.length > 1) {
      setBulkUsers(bulkUsers.filter((u) => u.id !== id));
    }
  };

  const updateBulkRow = (id: string, field: string, value: any) => {
    setBulkUsers(bulkUsers.map(u => u.id === id ? { ...u, [field]: value } : u));
  };

  const handleSaveBulk = async () => {
    // Validate
    let hasError = false;
    const validatedUsers = bulkUsers.map((u, idx) => {
      let rowError = "";
      if (!u.username.trim()) rowError = "Thiếu username";
      else if (!u.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email)) rowError = "Email không hợp lệ";
      else if (!u.role) rowError = "Thiếu vai trò";
      else if (!useCommonPassword && !u.password.trim()) rowError = "Thiếu mật khẩu";

      if (rowError) hasError = true;
      return { ...u, error: rowError };
    });

    if (useCommonPassword && !commonPassword.trim()) {
      toast.error("Vui lòng nhập mật khẩu chung!");
      return;
    }

    setBulkUsers(validatedUsers);

    if (hasError) {
      toast.error("Vui lòng kiểm tra lại các dòng bị lỗi!");
      return;
    }

    if (onBulkSave) {
      setIsLoading(true);
      try {
        const payload = {
          commonPassword: useCommonPassword ? commonPassword : undefined,
          users: bulkUsers.map(u => ({
            user_name: u.username,
            email: u.email,
            password: useCommonPassword ? undefined : u.password,
            role_id: u.role,
            status: u.status,
            advisor_class_ids: u.advisorClassIds || [],
          }))
        };
        const res = await onBulkSave(payload);
        setBulkResult(res);
        toast.success(`Tạo thành công ${res.successCount} người dùng`);
      } catch (error: any) {
        toast.error("Lỗi khi thêm nhiều người dùng: " + error.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleKeepErrors = () => {
    if (!bulkResult) return;
    const errorEmails = bulkResult.errors.map((e: any) => e.email?.toLowerCase());
    const remainingUsers = bulkUsers.filter(u => errorEmails.includes(u.email?.toLowerCase()));
    
    // update error messages
    const mapped = remainingUsers.map(u => {
      const err = bulkResult.errors.find((e: any) => e.email?.toLowerCase() === u.email.toLowerCase());
      return { ...u, error: err?.reason || "Lỗi" };
    });
    
    setBulkUsers(mapped.length ? mapped : [{ id: Date.now().toString(), username: "", email: "", role: roles?.[0]?._id || "", status: "active", password: "", advisorClassIds: [] }]);
    setBulkResult(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            exit={{ opacity: 0 }}
            onClick={isLoading ? undefined : onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4 font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`w-full ${mode === "bulk" ? "max-w-[1000px]" : "max-w-[760px]"} bg-gradient-to-br from-[#EBF2FA]/92 to-[#DCE6F1]/92 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-900/5 border border-white/80 pointer-events-auto flex flex-col overflow-hidden max-h-[90vh] transition-all duration-300`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/60 bg-white/10 shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-[#1E293B]">
                    {isEditing ? "Sửa thông tin người dùng" : "Thêm người dùng"}
                  </h2>
                  <p className="text-[12.5px] font-medium text-[#64748B] mt-0.5">
                    {mode === "single" ? "Cập nhật thông tin chi tiết và quyền hạn." : "Thêm hàng loạt người dùng vào hệ thống."}
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  {mode === "single" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#64748B]">Trạng thái</span>
                      <button
                        onClick={() => setIsActive(!isActive)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isActive ? "bg-[#1A73E8]" : "bg-white/50 border border-white/80"
                        }`}
                      >
                        <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white transition-transform shadow-xs ${isActive ? "translate-x-5.5" : "translate-x-0.5"}`} />
                      </button>
                      <span className="text-xs font-bold text-[#1E293B] w-12 ml-0.5">
                        {isActive ? "Hoạt động" : "Tạm khóa"}
                      </span>
                    </div>
                  )}
                  <button onClick={isLoading ? undefined : onClose} disabled={isLoading} className={`p-1.5 rounded-xl border border-transparent transition-all ${isLoading ? 'text-slate-300 cursor-not-allowed' : 'text-[#64748B] hover:text-[#1E293B] hover:bg-white/60 hover:border-white/50 hover:scale-[1.05]'}`}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mode Switcher */}
              {!isEditing && !bulkResult && (
                <div className="flex justify-center border-b border-white/60 bg-white/10 p-2">
                  <div className="flex p-1 bg-white/40 rounded-lg">
                    <button
                      onClick={() => setMode("single")}
                      className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-2 ${mode === "single" ? "bg-white text-[#1A73E8] shadow-sm" : "text-[#64748B] hover:text-[#1E293B]"}`}
                    >
                      <User className="w-4 h-4" />
                      Thêm 1 người dùng
                    </button>
                    <button
                      onClick={() => setMode("bulk")}
                      className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-2 ${mode === "bulk" ? "bg-white text-[#1A73E8] shadow-sm" : "text-[#64748B] hover:text-[#1E293B]"}`}
                    >
                      <Users className="w-4 h-4" />
                      Thêm nhiều người dùng
                    </button>
                  </div>
                </div>
              )}

              {/* Body */}
              <div className="flex-1 p-6 bg-transparent overflow-y-auto">
                {bulkResult ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center bg-blue-100 mb-2">
                      <Users className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Kết quả thêm nhiều người dùng</h3>
                    <div className="grid grid-cols-3 gap-4 w-full max-w-md my-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="text-2xl font-black text-slate-700">{bulkResult.total}</div>
                        <div className="text-xs font-bold text-slate-500 uppercase">Tổng cộng</div>
                      </div>
                      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                        <div className="text-2xl font-black text-emerald-600">{bulkResult.successCount}</div>
                        <div className="text-xs font-bold text-emerald-700 uppercase">Thành công</div>
                      </div>
                      <div className="bg-rose-50 p-4 rounded-xl border border-rose-200">
                        <div className="text-2xl font-black text-rose-600">{bulkResult.failedCount}</div>
                        <div className="text-xs font-bold text-rose-700 uppercase">Thất bại</div>
                      </div>
                    </div>
                    {bulkResult.errors && bulkResult.errors.length > 0 && (
                      <div className="w-full text-left mt-4 border border-rose-200 rounded-xl overflow-hidden bg-white">
                        <div className="bg-rose-50 px-4 py-2 font-bold text-rose-800 text-xs flex justify-between items-center">
                          Danh sách lỗi
                        </div>
                        <div className="max-h-40 overflow-y-auto p-2 space-y-2">
                          {bulkResult.errors.map((err: any, idx: number) => (
                            <div key={idx} className="text-[11px] p-2 bg-rose-50/50 rounded flex justify-between border border-rose-100">
                              <span className="font-semibold text-slate-700">{err.email || err.user_name || "Dòng " + (err.index + 1)}</span>
                              <span className="text-rose-600 font-medium">{err.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : mode === "single" ? (
                  <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex flex-col items-center gap-3 w-full md:w-[200px] shrink-0">
                      {isLoading ? (
                        <Skeleton className="w-[160px] h-[160px] rounded-full" />
                      ) : (
                        <div className="w-[160px] h-[160px] rounded-full bg-white/60 border-2 border-white/90 shadow-sm flex items-center justify-center cursor-pointer hover:bg-white/80 transition-colors group relative overflow-hidden">
                          <User className="w-14 h-14 text-slate-400 group-hover:text-slate-500 transition-colors" strokeWidth={1.5} />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      )}
                      <div className="text-center">
                        {isLoading ? (
                          <div className="flex flex-col items-center gap-2"><Skeleton className="w-20 h-4" /><Skeleton className="w-28 h-8" /></div>
                        ) : (
                          <><button className="text-[13.5px] font-bold text-[#1A73E8] hover:text-[#1A73E8]/80 transition-colors mb-0.5">Tải ảnh lên</button><p className="text-[11px] font-medium text-[#64748B] leading-relaxed max-w-[160px] mx-auto">Định dạng JPG, PNG, GIF. Tối đa 2MB.</p></>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col gap-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 mb-0.5">
                          <User className="w-4.5 h-4.5 text-[#1A73E8]" />
                          <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">Thông tin cơ bản</h3>
                        </div>
                        {isLoading ? (
                          <><div className="grid grid-cols-1 md:grid-cols-2 gap-5"><Skeleton className="h-[70px] w-full rounded-xl" /><Skeleton className="h-[70px] w-full rounded-xl" /></div></>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[12.5px] font-semibold text-[#64748B]">Tên người dùng <span className="text-red-500">*</span></label>
                                <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="Nhập tên người dùng" className={`px-3 py-2 bg-white/50 backdrop-blur-sm border ${errors.username ? "border-rose-400" : "border-white/80"} rounded-xl text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2`} />
                                {errors.username && <span className="text-[11px] text-rose-600 font-medium ml-1">{errors.username}</span>}
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[12.5px] font-semibold text-[#64748B]">Email <span className="text-red-500">*</span></label>
                                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="ví dụ: vana@email.com" className={`px-3 py-2 bg-white/50 backdrop-blur-sm border ${errors.email ? "border-rose-400" : "border-white/80"} rounded-xl text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2`} />
                                {errors.email && <span className="text-[11px] text-rose-600 font-medium ml-1">{errors.email}</span>}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5 relative">
                              <label className="text-[12.5px] font-semibold text-[#64748B]">Mật khẩu {!isEditing && <span className="text-red-500">*</span>}</label>
                              <div className="relative">
                                <input type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder={isEditing ? "Để trống nếu không đổi" : "Nhập mật khẩu"} className={`w-full pl-3 pr-9 py-2 bg-white/50 backdrop-blur-sm border ${errors.password ? "border-rose-400" : "border-white/80"} rounded-xl text-xs font-semibold text-[#1E293B] focus:outline-none focus:ring-2`} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"><Eye className="w-4 h-4" /></button>
                              </div>
                              {errors.password && <span className="text-[11px] text-rose-600 font-medium ml-1">{errors.password}</span>}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="h-px bg-white/40" />
                      <div className="flex flex-col gap-3.5">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Settings className="w-4.5 h-4.5 text-[#1A73E8]" />
                          <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">Cấu hình</h3>
                        </div>
                        {isLoading ? (
                          <div className="flex flex-col gap-1.5"><Skeleton className="h-4.5 w-14" /><Skeleton className="h-9 w-full rounded-xl" /></div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[12.5px] font-semibold text-[#64748B]">Vai trò <span className="text-red-500">*</span></label>
                              <Select value={formData.role} onValueChange={(value: string) => {
                                const isTeacher = roles.find(r => r._id === value)?.name?.match(/Teacher|Giảng viên|GVCN/i);
                                setFormData({ ...formData, role: value, advisorClassIds: isTeacher ? formData.advisorClassIds : [] });
                              }}>
                                <SelectTrigger className={`w-full h-9 px-3 py-1.5 bg-white/50 border ${errors.role ? "border-rose-400" : "border-white/80"} rounded-xl text-xs font-semibold text-[#1E293B]`}>
                                  <SelectValue placeholder="Chọn vai trò..." />
                                </SelectTrigger>
                                <SelectContent className="bg-white/95 rounded-xl shadow-md z-[60]">
                                  {roles.map((role) => (
                                    <SelectItem key={role._id} value={role._id} className="text-xs font-semibold text-[#1E293B]">{role.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {errors.role && <span className="text-[11px] text-rose-600 font-medium ml-1">{errors.role}</span>}
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[12.5px] font-semibold text-[#64748B]">GVCN lớp</label>
                              <MultiClassSelect 
                                selectedIds={formData.advisorClassIds} 
                                onChange={(ids) => setFormData({ ...formData, advisorClassIds: ids })} 
                                classes={classes} 
                                disabled={!roles.find(r => r._id === formData.role)?.name?.match(/Teacher|Giảng viên|GVCN/i)} 
                                className="w-full h-9 px-3 py-1.5 bg-white/50 border border-white/80 rounded-xl text-xs font-semibold text-[#1E293B]"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4 bg-white/40 p-4 rounded-xl border border-white/60">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="useCommonPwd" checked={useCommonPassword} onChange={(e) => setUseCommonPassword(e.target.checked)} className="rounded border-slate-300 text-blue-600" />
                        <label htmlFor="useCommonPwd" className="text-xs font-bold text-slate-700 cursor-pointer">Dùng chung mật khẩu</label>
                      </div>
                      {useCommonPassword && (
                        <input type="text" value={commonPassword} onChange={(e) => setCommonPassword(e.target.value)} placeholder="Nhập mật khẩu chung" className="px-3 py-1.5 text-xs border border-white/80 rounded-lg bg-white/50" />
                      )}
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white/50">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100/50 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2">Username</th>
                            <th className="px-3 py-2">Email</th>
                            <th className="px-3 py-2">Vai trò</th>
                            <th className="px-3 py-2 min-w-[120px]">GVCN lớp</th>
                            <th className="px-3 py-2">Trạng thái</th>
                            {!useCommonPassword && <th className="px-3 py-2">Mật khẩu</th>}
                            <th className="px-3 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {bulkUsers.map((u, i) => (
                            <tr key={u.id} className="hover:bg-white/40">
                              <td className="px-2 py-2">
                                <input type="text" value={u.username} onChange={(e) => updateBulkRow(u.id, 'username', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white/80" placeholder="Username" />
                                {u.error && u.error.includes("username") && <div className="text-[10px] text-rose-500 mt-0.5">{u.error}</div>}
                              </td>
                              <td className="px-2 py-2">
                                <input type="email" value={u.email} onChange={(e) => updateBulkRow(u.id, 'email', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white/80" placeholder="Email" />
                                {u.error && (u.error.includes("Email") || u.error.includes("email")) && <div className="text-[10px] text-rose-500 mt-0.5">{u.error}</div>}
                              </td>
                              <td className="px-2 py-2">
                                <Select value={u.role} onValueChange={(val) => {
                                  const isTeacher = roles.find(r => r._id === val)?.name?.match(/Teacher|Giảng viên|GVCN/i);
                                  updateBulkRow(u.id, 'role', val);
                                  if (!isTeacher) updateBulkRow(u.id, 'advisorClassIds', []);
                                }}>
                                  <SelectTrigger className="w-full h-7 px-2 py-1 text-[11px] border-slate-200 bg-white/80"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {roles.map(r => <SelectItem key={r._id} value={r._id} className="text-[11px]">{r.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-2 py-2">
                                <MultiClassSelect
                                  selectedIds={u.advisorClassIds || []}
                                  onChange={(ids) => updateBulkRow(u.id, 'advisorClassIds', ids)}
                                  classes={classes}
                                  disabled={!roles.find(r => r._id === u.role)?.name?.match(/Teacher|Giảng viên|GVCN/i)}
                                  className="h-7 w-full rounded border border-slate-200 bg-white/80 px-2 py-1 text-[11px]"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <Select value={u.status} onValueChange={(val) => updateBulkRow(u.id, 'status', val)}>
                                  <SelectTrigger className="w-full h-7 px-2 py-1 text-[11px] border-slate-200 bg-white/80"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="active" className="text-[11px]">Active</SelectItem>
                                    <SelectItem value="inactive" className="text-[11px]">Inactive</SelectItem>
                                    <SelectItem value="locked" className="text-[11px]">Locked</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              {!useCommonPassword && (
                                <td className="px-2 py-2">
                                  <input type="text" value={u.password} onChange={(e) => updateBulkRow(u.id, 'password', e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white/80" placeholder="Password" />
                                  {u.error && u.error.includes("mật khẩu") && <div className="text-[10px] text-rose-500 mt-0.5">{u.error}</div>}
                                </td>
                              )}
                              <td className="px-2 py-2 text-center">
                                <button onClick={() => removeBulkRow(u.id)} disabled={bulkUsers.length === 1} className="p-1 text-slate-400 hover:text-rose-500 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="p-2 border-t border-slate-200 bg-slate-50/50">
                        <button onClick={addBulkRow} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                          <Plus className="w-4 h-4" /> Thêm dòng
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5 px-6 py-4.5 border-t border-white/40 bg-white/10 shrink-0">
                {!bulkResult ? (
                  <>
                    <button onClick={isLoading ? undefined : onClose} disabled={isLoading} className="px-5 py-2 text-xs font-bold text-[#64748B] bg-white/50 border border-white/70 hover:bg-white/70 rounded-xl transition-all disabled:opacity-50">
                      Hủy bỏ
                    </button>
                    <button onClick={mode === "single" ? handleSaveSingle : handleSaveBulk} disabled={isLoading} className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#1A73E8] hover:bg-[#1A73E8]/90 rounded-xl transition-all disabled:opacity-50">
                      <Save className="w-4.5 h-4.5" strokeWidth={2.5} />
                      {isLoading ? "Đang lưu..." : mode === "single" ? "Lưu thông tin" : "Lưu hàng loạt"}
                    </button>
                  </>
                ) : (
                  <>
                    {bulkResult.errors?.length > 0 && (
                      <button onClick={handleKeepErrors} className="px-5 py-2 text-xs font-bold text-rose-600 bg-white/50 border border-rose-200 hover:bg-rose-50 rounded-xl transition-all">
                        Sửa các dòng lỗi
                      </button>
                    )}
                    <button onClick={onClose} className="px-5 py-2 text-xs font-bold text-white bg-[#1A73E8] hover:bg-[#1A73E8]/90 rounded-xl transition-all">
                      Đóng
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
