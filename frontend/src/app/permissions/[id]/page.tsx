"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "../../../components/layout/Sidebar";
import Header from "../../../components/layout/Header";
import TabNavigation from "@/components/ui/TabNavigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { CustomCalendar } from "@/components/calendar/CustomCalendar";
import {
  Mail,
  Phone,
  ShieldCheck,
  Lock,
  RefreshCcw,
  Ban,
  CheckCircle2,
  X,
  GraduationCap,
  LayoutGrid,
  Calendar as CalendarIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { authApi, tokenStorage } from "../../../api/auth-api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import ConfirmModal from "@/components/modals/ConfirmModal";

const getUserDisplayName = (user: any) =>
  user?.student_profile?.full_name || user?.display_name || user?.user_name || user?.username || 'Unknown user';

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState("Người dùng");
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // States phục vụ quản lý vai trò và quyền hạn động (Role & Permissions Management)
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [allPermissionsList, setAllPermissionsList] = useState<any[]>([]);
  const [selectedNewRole, setSelectedNewRole] = useState<string>("");
  const [isRoleConfirmOpen, setIsRoleConfirmOpen] = useState(false);
  const [isAssigningRole, setIsAssigningRole] = useState(false);

  const [editValues, setEditValues] = useState({
    username: "",
    email: "",
    phone: "0912 345 678",
    staffId: "GV-2023-089",
    dob: "15/08/1985",
    department: "Khoa Công nghệ thông tin",
  });

  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return date;
    }
    const standardDate = new Date(dateStr);
    if (!isNaN(standardDate.getTime())) return standardDate;
    return null;
  };

  const formatDateStr = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const fetchUsers = async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      // Tải song song thông tin người dùng, toàn bộ danh sách vai trò khả dụng và toàn bộ quyền hạn của hệ thống
      const [users, rolesData, permissionsData] = await Promise.all([
        authApi.getUsers(token),
        authApi.getRoles(token).catch(() => []),
        authApi.getPermissions(token).catch(() => [])
      ]);

      setRolesList(rolesData);
      setAllPermissionsList(permissionsData);

      const foundUser = users.find((u) => u._id === id || u.id === id);

      if (foundUser) {
        setUser(foundUser);
        setEditValues({
          username: foundUser.student_profile?.full_name || foundUser.user_name || foundUser.username || "",
          email: foundUser.email || "",
          phone: foundUser.phone_number || foundUser.phone || "0912 345 678",
          staffId: foundUser.staffId || "GV-2023-089",
          dob: foundUser.date_birth ? formatDateStr(new Date(foundUser.date_birth)) : (foundUser.dob || "15/08/1985"),
          department: foundUser.department || "Khoa Công nghệ thông tin",
        });
      } else {
        toast.error("Không tìm thấy người dùng");
        router.push("/permissions");
      }
    } catch (error: any) {
      toast.error("Lỗi khi tải dữ liệu: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = (roleId: string) => {
    setSelectedNewRole(roleId);
    setIsRoleConfirmOpen(true);
  };

  const handleConfirmRoleChange = async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      toast.error("Hết phiên làm việc");
      return;
    }

    setIsAssigningRole(true);
    try {
      await authApi.assignRole(id, selectedNewRole, token);
      toast.success("Thay đổi vai trò thành công!");
      await fetchUsers(); // Làm mới dữ liệu người dùng và các quyền truy cập đi kèm
    } catch (error: any) {
      toast.error("Lỗi khi thay đổi vai trò: " + error.message);
    } finally {
      setIsAssigningRole(false);
      setIsRoleConfirmOpen(false);
    }
  };

  const getPermissionDetails = (permIdentifier: any) => {
    if (typeof permIdentifier === "object" && permIdentifier !== null) {
      return permIdentifier;
    }
    const found = allPermissionsList.find(
      (p) => p._id === permIdentifier || p.code === permIdentifier
    );
    return found || { name: permIdentifier, code: permIdentifier };
  };

  useEffect(() => {
    fetchUsers();
  }, [id, router]);

  if (isLoading) {
    return (
      <div className="flex bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] h-screen overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full bg-transparent">
          <Header />
          <TabNavigation
            tabs={[
              { id: "Người dùng", label: "Người dùng" },
              { id: "Vai trò", label: "Vai trò" },
              { id: "Quyền hạn", label: "Quyền hạn" },
              { id: "Cấu hình", label: "Cấu hình" },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id)}
          />
          <main className="flex-1 p-6 overflow-y-auto bg-transparent">
            <div className="max-w-6xl mx-auto space-y-6">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <Skeleton className="col-span-1 lg:col-span-4 h-[500px] rounded-2xl" />
                <div className="col-span-1 lg:col-span-8 space-y-6">
                  <Skeleton className="h-40 w-full rounded-2xl" />
                  <Skeleton className="h-64 w-full rounded-2xl" />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] h-screen overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full bg-transparent">
        <Header />
        <main className="flex-1 p-6 overflow-y-auto bg-transparent scrollbar-hide">
          <div className="max-w-[1280px] mx-auto space-y-6">
            {/* Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/45 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm shadow-slate-300/40 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-6">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-full bg-[#1A73E8]/10 ring-4 ring-white/60 shadow-sm flex items-center justify-center text-2xl font-bold text-[#1A73E8] shrink-0">
                  {getUserDisplayName(user)
                    .substring(0, 2)
                    .toUpperCase()}
                </div>

                {/* User Info */}
                <div className="space-y-1.5">
                  <div className="flex items-center flex-wrap gap-2">
                    <h1 className="text-xl font-bold text-[#1E293B]">
                      {getUserDisplayName(user)}
                    </h1>
                    {user?.student_profile && (
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 rounded-xl text-[10.5px] font-bold shadow-xs">
                        Mã SV: {user.student_profile.student_code}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 md:gap-4">
                    <div className="flex items-center gap-1.5 text-[#64748B]">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">
                        {user?.email || "huy.nq@edu.vn"}
                      </span>
                    </div>
                    {!user?.student_profile && (
                      <div className="bg-white/50 border border-white/80 px-2 py-0.5 rounded-xl text-[10.5px] font-mono font-bold text-[#64748B] shadow-sm">
                        Username: {user?.user_name}
                      </div>
                    )}
                    <div className="bg-white/50 border border-white/80 px-2 py-0.5 rounded-xl text-[10.5px] font-mono font-bold text-[#64748B] shadow-sm">
                      UUID:{" "}
                      {user?._id?.substring(0, 8).toUpperCase() || "8A7F-2B1C"}
                    </div>
                    {user?.status === "locked" ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded-xl shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span className="text-[11px] font-bold text-rose-700">
                          Đã bị khóa
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[11px] font-bold text-emerald-700">
                          Đang hoạt động
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  disabled={isResettingPassword || isTogglingStatus || isSaving}
                  onClick={async () => {
                    const confirmReset = window.confirm("Bạn có chắc chắn muốn đặt lại mật khẩu cho người dùng này không?");
                    if (!confirmReset) return;

                    const generatedPassword = "MP-" + Math.floor(100000 + Math.random() * 900000);
                    const newPassword = window.prompt(
                      "Nhập mật khẩu mới cho người dùng (Để trống để sử dụng mật khẩu ngẫu nhiên tự sinh):",
                      generatedPassword
                    );

                    if (newPassword === null) return; // Hủy nhập
                    const finalPassword = newPassword.trim() === "" ? generatedPassword : newPassword.trim();
                    if (finalPassword.length < 8) {
                      toast.error("Mật khẩu mới phải có ít nhất 8 ký tự.");
                      return;
                    }

                    const token = tokenStorage.getAccessToken();
                    if (!token) {
                      toast.error("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");
                      return;
                    }

                    try {
                      setIsResettingPassword(true);
                      await authApi.updateUser(id, { password: finalPassword }, token);
                      await fetchUsers();

                      window.alert(`Đặt lại mật khẩu thành công!\nMật khẩu mới của người dùng là: ${finalPassword}\nHãy sao chép và gửi mật khẩu này cho người dùng.`);
                      toast.success("Đặt lại mật khẩu thành công!");
                    } catch (error: any) {
                      toast.error("Lỗi đặt lại mật khẩu: " + error.message);
                    } finally {
                      setIsResettingPassword(false);
                    }
                  }}
                  className="flex items-center gap-1.5 bg-white/50 hover:bg-white/80 border border-white/80 rounded-xl text-[#64748B] hover:text-[#1E293B] font-bold hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 ease-out disabled:opacity-50 shadow-sm text-xs py-1.5 h-9"
                >
                  {isResettingPassword ? (
                    <svg className="animate-spin h-3.5 w-3.5 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <RefreshCcw className="w-3.5 h-3.5" />
                  )}
                  {isResettingPassword ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
                </Button>
                <Button
                  variant="outline"
                  disabled={isResettingPassword || isTogglingStatus || isSaving}
                  onClick={async () => {
                    const isLocked = user?.status === "locked";
                    const actionText = isLocked ? "mở khóa" : "tạm khóa";
                    const confirmAction = window.confirm(`Bạn có chắc chắn muốn ${actionText} người dùng này không?`);
                    if (!confirmAction) return;

                    const token = tokenStorage.getAccessToken();
                    if (!token) {
                      toast.error("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");
                      return;
                    }

                    try {
                      setIsTogglingStatus(true);
                      await authApi.updateUser(
                        id,
                        { status: isLocked ? "active" : "locked" },
                        token
                      );
                      await fetchUsers();
                      toast.success(`${isLocked ? "Mở khóa" : "Tạm khóa"} tài khoản thành công!`);
                    } catch (error: any) {
                      toast.error(`Lỗi khi ${actionText} tài khoản: ` + error.message);
                    } finally {
                      setIsTogglingStatus(false);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1.5 font-bold hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 ease-out disabled:opacity-50 shadow-sm text-xs py-1.5 h-9 rounded-xl border",
                    user?.status === "locked"
                      ? "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-700"
                      : "bg-white/50 hover:bg-rose-500/10 border-white/80 hover:border-rose-500/20 text-slate-700 hover:text-rose-700"
                  )}
                >
                  {isTogglingStatus ? (
                    <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : user?.status === "locked" ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Ban className="w-3.5 h-3.5" />
                  )}
                  {isTogglingStatus
                    ? (user?.status === "locked" ? "Đang mở khoá..." : "Đang tạm khoá...")
                    : (user?.status === "locked" ? "Mở khoá" : "Tạm khoá")}
                </Button>
              </div>
            </motion.div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Personal Info */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="col-span-1 lg:col-span-4"
              >
                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl overflow-hidden h-full">
                  <div className="px-5 py-4 border-b border-white/50 bg-white/10 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[#1E293B] uppercase tracking-wider">
                      Thông tin cá nhân
                    </h2>
                    {isEditing ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setIsEditing(false);
                            // Restore original values
                            setEditValues({
                              username: user?.student_profile?.full_name || user?.user_name || user?.username || "",
                              email: user?.email || "",
                              phone: user?.phone_number || user?.phone || "0912 345 678",
                              staffId: user?.staffId || "GV-2023-089",
                              dob: user?.date_birth ? formatDateStr(new Date(user.date_birth)) : (user?.dob || "15/08/1985"),
                              department: user?.department || "Khoa Công nghệ thông tin",
                            });
                          }}
                          disabled={isSaving}
                          className="text-xs font-bold text-[#64748B] hover:text-[#1E293B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 ease-out"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={async () => {
                            const token = tokenStorage.getAccessToken();
                            if (!token) {
                              toast.error("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");
                              return;
                            }

                            try {
                              setIsSaving(true);
                              const response = await authApi.updateUser(
                                id,
                                {
                                  user_name: user?.student_profile ? user.user_name : editValues.username,
                                  email: editValues.email,
                                  phone_number: editValues.phone,
                                  department: editValues.department,
                                  date_birth: parseDate(editValues.dob) || undefined,
                                },
                                token
                              );

                              await fetchUsers();
                              setIsEditing(false);
                              toast.success("Lưu thông tin cá nhân thành công!");
                            } catch (error: any) {
                              toast.error("Lỗi khi cập nhật thông tin: " + error.message);
                            } finally {
                              setIsSaving(false);
                            }
                          }}
                          disabled={isSaving}
                          className="text-xs font-bold text-[#1A73E8] hover:text-[#155cb4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 ease-out"
                        >
                          {isSaving && (
                            <svg className="animate-spin h-3.5 w-3.5 text-[#1A73E8]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          )}
                          {isSaving ? "Đang lưu..." : "Lưu"}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-xs font-bold text-[#1A73E8] hover:text-[#155cb4] transition-colors hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 ease-out"
                      >
                        Chỉnh sửa
                      </button>
                    )}
                  </div>
                  <div className="p-5 space-y-4">
                    <Input
                      label="Họ và tên"
                      value={editValues.username}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          username: e.target.value,
                        })
                      }
                      readOnly={user?.student_profile ? true : (!isEditing || isSaving)}
                      className="h-9 text-xs py-1.5 placeholder:text-slate-400/70 shadow-sm disabled:opacity-85 disabled:bg-slate-50/30"
                    />
                    {user?.student_profile && (
                      <Input
                        label="Tên đăng nhập (Mã sinh viên)"
                        value={user?.user_name || ""}
                        readOnly={true}
                        className="h-9 text-xs py-1.5 placeholder:text-slate-400/70 shadow-sm disabled:opacity-85 bg-slate-50/50"
                      />
                    )}
                    <Input
                      label="Email"
                      value={editValues.email}
                      onChange={(e) =>
                        setEditValues({ ...editValues, email: e.target.value })
                      }
                      readOnly={!isEditing || isSaving}
                      className="h-9 text-xs py-1.5 placeholder:text-slate-400/70 shadow-sm"
                    />
                    <Input
                      label="Số điện thoại"
                      value={editValues.phone}
                      onChange={(e) =>
                        setEditValues({ ...editValues, phone: e.target.value })
                      }
                      readOnly={!isEditing || isSaving}
                      className="h-9 text-xs py-1.5 placeholder:text-slate-400/70 shadow-sm"
                    />
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#64748B] tracking-wider px-1">
                          Ngày sinh
                        </label>
                        <Popover
                          open={isCalendarOpen && !isSaving}
                          onOpenChange={(open) => !isSaving && setIsCalendarOpen(open)}
                        >
                          <PopoverTrigger asChild>
                            <button
                              disabled={isSaving}
                              className="flex items-center justify-between w-full h-9 px-3 bg-white/50 border border-white/80 rounded-xl text-xs text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 transition-all duration-150 ease-out text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                              <span>{editValues.dob || "Chọn ngày sinh"}</span>
                              <CalendarIcon className="w-3.5 h-3.5 text-[#64748B]" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto p-0 z-100 bg-transparent border-none shadow-none overflow-hidden"
                            align="start"
                            side="bottom"
                            sideOffset={6}
                          >
                            <CustomCalendar
                              startDate={parseDate(editValues.dob)}
                              endDate={parseDate(editValues.dob)}
                              onRangeSelect={(start: Date) => {
                                setEditValues({
                                  ...editValues,
                                  dob: formatDateStr(start),
                                });
                              }}
                              onCancel={() => setIsCalendarOpen(false)}
                              onConfirm={() => setIsCalendarOpen(false)}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    ) : (
                      <Input
                        label="Ngày sinh"
                        value={editValues.dob}
                        readOnly={true}
                        className="h-9 text-xs py-1.5 placeholder:text-slate-400/70 shadow-sm"
                      />
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#64748B] tracking-wider px-1">
                        Khoa / Phòng ban
                      </label>
                      {isEditing ? (
                        <Select
                          value={editValues.department}
                          onValueChange={(val: string) =>
                            setEditValues({ ...editValues, department: val })
                          }
                          disabled={isSaving}
                        >
                          <SelectTrigger className="h-9 bg-white/50 border border-white/80 rounded-xl text-xs text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all duration-150 ease-out">
                            <SelectValue placeholder="Chọn khoa / phòng ban" />
                          </SelectTrigger>
                          <SelectContent className="bg-white/95 backdrop-blur-md border border-white/70 rounded-xl shadow-md">
                            <SelectItem value="Khoa Công nghệ thông tin" className="font-medium text-xs text-slate-700 focus:bg-slate-50 rounded-lg">
                              Khoa Công nghệ thông tin
                            </SelectItem>
                            <SelectItem value="Khoa Điện - Điện tử" className="font-medium text-xs text-slate-700 focus:bg-slate-50 rounded-lg">
                              Khoa Điện - Điện tử
                            </SelectItem>
                            <SelectItem value="Khoa Kinh tế quốc tế" className="font-medium text-xs text-slate-700 focus:bg-slate-50 rounded-lg">
                              Khoa Kinh tế quốc tế
                            </SelectItem>
                            <SelectItem value="Khoa Cơ khí chế tạo" className="font-medium text-xs text-slate-700 focus:bg-slate-50 rounded-lg">
                              Khoa Cơ khí chế tạo
                            </SelectItem>
                            <SelectItem value="Khoa Ngoại ngữ" className="font-medium text-xs text-slate-700 focus:bg-slate-50 rounded-lg">
                              Khoa Ngoại ngữ
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center justify-between h-9 px-3 bg-white/30 border border-white/60 rounded-xl text-xs text-[#1E293B] shadow-sm">
                          <span>{editValues.department}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Right Column: Roles & Permissions */}
              <div className="col-span-1 lg:col-span-8 space-y-6">
                {/* Roles Card */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white/45 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-white/50 bg-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-[#1A73E8]" />
                      <h2 className="text-sm font-bold text-[#1E293B] uppercase tracking-wider">
                        Vai trò hiện tại
                      </h2>
                    </div>
                    <div className="bg-[#1A73E8]/10 text-[#1A73E8] border border-[#1A73E8]/20 px-2.5 py-0.5 rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-sm">
                      {user?.role ? "Đã gán vai trò" : "Chưa gán vai trò"}
                    </div>
                  </div>
                  <div className="p-5 space-y-5">
                    <div className="flex flex-wrap gap-3 items-center">
                      {user?.role ? (
                        <div
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-sm transition-all hover:scale-[1.01] duration-150 ease-out font-sans",
                            user.role.name === "Admin"
                              ? "bg-purple-500/10 border-purple-500/20 text-purple-700"
                              : "bg-blue-500/10 border-blue-500/20 text-[#1A73E8]"
                          )}
                        >
                          <span className="text-xs font-bold">{user.role.name}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-[#64748B] font-medium italic font-sans">
                          Tài khoản này chưa được gán vai trò nào.
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Permissions Summary Card */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white/45 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-white/50 bg-white/10">
                    <div className="flex items-center gap-2">
                      <Lock className="w-5 h-5 text-[#1A73E8]" />
                      <h2 className="text-sm font-bold text-[#1E293B] uppercase tracking-wider">
                        Quyền hạn truy cập tổng hợp
                      </h2>
                    </div>
                  </div>
                  <div className="p-5">
                    {user?.role?.permissions && user.role.permissions.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Cột 1: Nửa đầu danh sách quyền hạn thực tế */}
                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 space-y-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center">
                              <GraduationCap className="w-4 h-4 text-blue-600" />
                            </div>
                            <h3 className="font-bold text-[#1E293B] text-xs uppercase tracking-wide">
                              Quyền tác vụ phân bổ (Phần 1)
                            </h3>
                          </div>
                          <ul className="space-y-2.5">
                            {user.role.permissions.slice(0, Math.ceil(user.role.permissions.length / 2)).map((perm: any, i: number) => {
                              const details = getPermissionDetails(perm);
                              return (
                                <li
                                  key={i}
                                  className="flex items-start gap-2 text-xs text-[#64748B] font-sans"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                  <div className="flex flex-col">
                                    <span className="font-bold text-[#1E293B] leading-snug">{details.name}</span>
                                    <span className="text-[9.5px] text-[#64748B] font-mono mt-0.5">{details.code}</span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        {/* Cột 2: Nửa sau danh sách quyền hạn thực tế */}
                        <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 space-y-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-amber-500/10 rounded-xl flex items-center justify-center">
                              <LayoutGrid className="w-4 h-4 text-amber-600" />
                            </div>
                            <h3 className="font-bold text-[#1E293B] text-xs uppercase tracking-wide">
                              Thông tin & Hệ thống (Phần 2)
                            </h3>
                          </div>
                          <ul className="space-y-2.5">
                            {user.role.permissions.slice(Math.ceil(user.role.permissions.length / 2)).map((perm: any, i: number) => {
                              const details = getPermissionDetails(perm);
                              return (
                                <li
                                  key={i}
                                  className="flex items-start gap-2 text-xs text-[#64748B] font-sans"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                  <div className="flex flex-col">
                                    <span className="font-bold text-[#1E293B] leading-snug">{details.name}</span>
                                    <span className="text-[9.5px] text-[#64748B] font-mono mt-0.5">{details.code}</span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="py-10 text-center text-[#64748B] font-medium text-xs border border-dashed border-white/60 rounded-xl bg-white/20 font-sans">
                        {user?.role ? "Vai trò hiện tại không được gán quyền hạn cụ thể nào." : "Tài khoản chưa có vai trò nên chưa được cấp quyền truy cập nào."}
                      </div>
                    )}

                    <div className="mt-6 flex justify-end">
                      <Button
                        onClick={() => router.push("/permissions")}
                        className="bg-[#1A73E8] hover:bg-[#155cb4] text-white px-8 rounded-xl font-bold hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 ease-out shadow-sm h-9 text-xs"
                      >
                        Đóng
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <ConfirmModal
        isOpen={isRoleConfirmOpen}
        onClose={() => setIsRoleConfirmOpen(false)}
        onConfirm={handleConfirmRoleChange}
        title="Xác nhận thay đổi vai trò"
        message={`Bạn có chắc chắn muốn thay đổi vai trò của người dùng này sang "${rolesList.find(r => (r._id || r.id) === selectedNewRole)?.name || ""}"? Quyền hạn truy cập của họ sẽ được thiết lập lại tương ứng.`}
        confirmLabel="Xác nhận thay đổi"
        cancelLabel="Hủy"
        variant="warning"
      />
    </div>
  );
}
