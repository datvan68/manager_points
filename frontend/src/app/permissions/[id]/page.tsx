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
          username: foundUser.user_name || foundUser.username || "",
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
      <div className="flex bg-slate-50 h-screen overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full">
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
          <main className="flex-1 p-8 overflow-y-auto bg-slate-50">
            <div className="max-w-6xl mx-auto space-y-6">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <div className="grid grid-cols-12 gap-6">
                <Skeleton className="col-span-4 h-[500px] rounded-2xl" />
                <div className="col-span-8 space-y-6">
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
    <div className="flex bg-slate-50 h-screen overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />
        <main className="flex-1 p-8 overflow-y-auto bg-slate-50 scrollbar-hide">
          <div className="max-w-[1280px] mx-auto space-y-6">
            {/* Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex items-center justify-between"
            >
              <div className="flex items-center gap-6">
                {/* Avatar */}
                <div className="w-24 h-24 rounded-full bg-blue-100 border-4 border-white shadow-md flex items-center justify-center text-3xl font-bold text-blue-600">
                  {(user?.user_name || user?.username || "NQ")
                    .substring(0, 2)
                    .toUpperCase()}
                </div>

                {/* User Info */}
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {user?.user_name || user?.username || "Nguyễn Quang Huy"}
                  </h1>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {user?.email || "huy.nq@edu.vn"}
                      </span>
                    </div>
                    <div className="bg-slate-100 px-3 py-1 rounded-md text-[11px] font-mono font-bold text-slate-500">
                      UUID:{" "}
                      {user?._id?.substring(0, 8).toUpperCase() || "8A7F-2B1C"}
                    </div>
                    {user?.status === "locked" ? (
                      <div className="flex items-center gap-2 px-3 py-1 bg-rose-50 border border-rose-100 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span className="text-xs font-bold text-rose-700">
                          Đã bị khóa
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-emerald-700">
                          Đang hoạt động
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
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
                  className="flex items-center gap-2 border-slate-200 text-slate-600 font-bold disabled:opacity-50"
                >
                  {isResettingPassword ? (
                    <svg className="animate-spin h-4 w-4 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <RefreshCcw className="w-4 h-4" />
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
                    "flex items-center gap-2 border-slate-200 font-bold disabled:opacity-50",
                    user?.status === "locked"
                      ? "border-emerald-200 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      : "border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50"
                  )}
                >
                  {isTogglingStatus ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : user?.status === "locked" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  {isTogglingStatus
                    ? (user?.status === "locked" ? "Đang mở khoá..." : "Đang tạm khoá...")
                    : (user?.status === "locked" ? "Mở khoá" : "Tạm khoá")}
                </Button>
              </div>
            </motion.div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-12 gap-6">
              {/* Left Column: Personal Info */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="col-span-4"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
                  <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">
                      Thông tin cá nhân
                    </h2>
                    {isEditing ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setIsEditing(false);
                            // Restore original values
                            setEditValues({
                              username: user?.user_name || user?.username || "",
                              email: user?.email || "",
                              phone: user?.phone_number || user?.phone || "0912 345 678",
                              staffId: user?.staffId || "GV-2023-089",
                              dob: user?.date_birth ? formatDateStr(new Date(user.date_birth)) : (user?.dob || "15/08/1985"),
                              department: user?.department || "Khoa Công nghệ thông tin",
                            });
                          }}
                          disabled={isSaving}
                          className="text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                                  user_name: editValues.username,
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
                          className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {isSaving && (
                            <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                        className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Chỉnh sửa
                      </button>
                    )}
                  </div>
                  <div className="p-6 space-y-5">
                    <Input
                      label="Họ và tên"
                      value={editValues.username}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          username: e.target.value,
                        })
                      }
                      readOnly={!isEditing || isSaving}
                    />
                    <Input
                      label="Email"
                      value={editValues.email}
                      onChange={(e) =>
                        setEditValues({ ...editValues, email: e.target.value })
                      }
                      readOnly={!isEditing || isSaving}
                    />
                    <Input
                      label="Số điện thoại"
                      value={editValues.phone}
                      onChange={(e) =>
                        setEditValues({ ...editValues, phone: e.target.value })
                      }
                      readOnly={!isEditing || isSaving}
                    />
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 tracking-wider">
                          Ngày sinh
                        </label>
                        <Popover
                          open={isCalendarOpen && !isSaving}
                          onOpenChange={(open) => !isSaving && setIsCalendarOpen(open)}
                        >
                          <PopoverTrigger asChild>
                            <button
                              disabled={isSaving}
                              className="flex items-center justify-between w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span>{editValues.dob || "Chọn ngày sinh"}</span>
                              <CalendarIcon className="w-4 h-4 text-slate-400" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto p-0 z-100 bg-transparent border-none shadow-none"
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
                      />
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 tracking-wider">
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
                          <SelectTrigger className="disabled:opacity-50 disabled:cursor-not-allowed">
                            <SelectValue placeholder="Chọn khoa / phòng ban" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Khoa Công nghệ thông tin">
                              Khoa Công nghệ thông tin
                            </SelectItem>
                            <SelectItem value="Khoa Điện - Điện tử">
                              Khoa Điện - Điện tử
                            </SelectItem>
                            <SelectItem value="Khoa Kinh tế quốc tế">
                              Khoa Kinh tế quốc tế
                            </SelectItem>
                            <SelectItem value="Khoa Cơ khí chế tạo">
                              Khoa Cơ khí chế tạo
                            </SelectItem>
                            <SelectItem value="Khoa Ngoại ngữ">
                              Khoa Ngoại ngữ
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center justify-between h-10 px-3 bg-[#f8fafc] border border-slate-200/60 rounded-lg text-sm text-slate-900">
                          <span>{editValues.department}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Right Column: Roles & Permissions */}
              <div className="col-span-8 space-y-6">
                {/* Roles Card */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-blue-600" />
                      <h2 className="text-lg font-bold text-slate-900">
                        Vai trò hiện tại
                      </h2>
                    </div>
                    <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider">
                      {user?.role ? "Đã gán vai trò" : "Chưa gán vai trò"}
                    </div>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="flex flex-wrap gap-3 items-center">
                      {user?.role ? (
                        <div
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg border shadow-sm transition-all hover:shadow-md font-sans",
                            user.role.name === "Admin"
                              ? "bg-purple-50 border-purple-100 text-purple-700"
                              : "bg-blue-50 border-blue-100 text-blue-700"
                          )}
                        >
                          <span className="text-sm font-bold">{user.role.name}</span>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400 font-medium italic font-sans">
                          Tài khoản này chưa được gán vai trò nào.
                        </div>
                      )}
                    </div>

                    {/* Giao diện thay đổi vai trò cực kỳ cao cấp */}
                    {/* <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 mb-1">Thay đổi vai trò tài khoản</h4>
                        <p className="text-xs text-slate-500">Chọn vai trò mới từ danh sách hệ thống để cập nhật lại tức thì quyền hạn truy cập của người dùng này.</p>
                      </div>
                      <div className="w-full md:w-64">
                        <Select
                          disabled={isAssigningRole}
                          value={user?.role?._id || user?.role?.id || ""}
                          onValueChange={handleRoleChange}
                        >
                          <SelectTrigger className="w-full bg-slate-50 border-slate-200 text-slate-700 font-semibold focus:ring-blue-500/20">
                            <SelectValue placeholder="Chọn vai trò..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-slate-200">
                            {rolesList.map((r) => (
                              <SelectItem
                                key={r._id || r.id}
                                value={r._id || r.id}
                                className="font-medium text-slate-700 focus:bg-slate-50"
                              >
                                {r.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div> */}
                  </div>
                </motion.div>

                {/* Permissions Summary Card */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  <div className="px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Lock className="w-5 h-5 text-blue-600" />
                      <h2 className="text-lg font-bold text-slate-900">
                        Quyền hạn truy cập tổng hợp
                      </h2>
                    </div>
                  </div>
                  <div className="p-6">
                    {user?.role?.permissions && user.role.permissions.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Cột 1: Nửa đầu danh sách quyền hạn thực tế */}
                        <div className="bg-[#f8fafc] border border-slate-100 rounded-xl p-5 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <GraduationCap className="w-5 h-5 text-blue-600" />
                            </div>
                            <h3 className="font-bold text-slate-900">
                              Quyền tác vụ phân bổ (Phần 1)
                            </h3>
                          </div>
                          <ul className="space-y-3">
                            {user.role.permissions.slice(0, Math.ceil(user.role.permissions.length / 2)).map((perm: any, i: number) => {
                              const details = getPermissionDetails(perm);
                              return (
                                <li
                                  key={i}
                                  className="flex items-start gap-2.5 text-sm text-slate-600 font-sans"
                                >
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 leading-snug">{details.name}</span>
                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">{details.code}</span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        {/* Cột 2: Nửa sau danh sách quyền hạn thực tế */}
                        <div className="bg-[#f8fafc] border border-slate-100 rounded-xl p-5 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                              <LayoutGrid className="w-5 h-5 text-orange-600" />
                            </div>
                            <h3 className="font-bold text-slate-900">
                              Thông tin & Hệ thống (Phần 2)
                            </h3>
                          </div>
                          <ul className="space-y-3">
                            {user.role.permissions.slice(Math.ceil(user.role.permissions.length / 2)).map((perm: any, i: number) => {
                              const details = getPermissionDetails(perm);
                              return (
                                <li
                                  key={i}
                                  className="flex items-start gap-2.5 text-sm text-slate-600 font-sans"
                                >
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 leading-snug">{details.name}</span>
                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">{details.code}</span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-400 font-medium text-sm border border-dashed border-slate-200 rounded-xl font-sans">
                        {user?.role ? "Vai trò hiện tại không được gán quyền hạn cụ thể nào." : "Tài khoản chưa có vai trò nên chưa được cấp quyền truy cập nào."}
                      </div>
                    )}

                    <div className="mt-8 flex justify-end">
                      <Button
                        onClick={() => router.push("/permissions")}
                        className="bg-[#135bec] hover:bg-[#1151d4] px-10 font-bold"
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
