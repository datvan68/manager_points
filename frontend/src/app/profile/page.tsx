"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/layout/Sidebar";
import Header from "../../components/layout/Header";
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
  CheckCircle2,
  Calendar as CalendarIcon,
  User as UserIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { authApi, tokenStorage } from "../../api/auth-api";
import { useAuth } from "../../providers/auth-provider";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const router = useRouter();
  const { checkAuth, logout } = useAuth();

  const [activeTab, setActiveTab] = useState("Thông tin cá nhân");
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editValues, setEditValues] = useState({
    username: "",
    phone: "",
    dob: "",
    department: "",
  });

  const [changePasswordValues, setChangePasswordValues] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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

  const fetchProfile = async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const data = await authApi.getMe(token);
      setProfile(data);
      setEditValues({
        username: data.user_name || "",
        phone: data.phone_number || "",
        dob: data.date_birth ? formatDateStr(new Date(data.date_birth)) : "",
        department: data.department || "Khoa Công nghệ thông tin",
      });
    } catch (error: any) {
      toast.error("Lỗi khi tải thông tin hồ sơ: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      toast.error("Hết phiên làm việc, vui lòng đăng nhập lại.");
      router.push("/login");
      return;
    }

    if (!editValues.username.trim()) {
      toast.error("Họ và tên không được để trống.");
      return;
    }

    setIsSaving(true);
    try {
      const updateData: any = {
        user_name: editValues.username.trim(),
        phone_number: editValues.phone.trim(),
        department: editValues.department,
        date_birth: parseDate(editValues.dob) || undefined,
      };

      await authApi.updateMe(updateData, token);

      // Cập nhật lại user trong localStorage
      const storedUser = tokenStorage.getUser();
      if (storedUser) {
        tokenStorage.setUser({
          ...storedUser,
          user_name: editValues.username.trim(),
          username: editValues.username.trim(),
        });
      }

      // Sync auth context để cập nhật Header
      await checkAuth();

      toast.success("Cập nhật thông tin cá nhân thành công!");
      setIsEditing(false);
      await fetchProfile();
    } catch (error: any) {
      toast.error("Lỗi khi lưu thông tin: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      toast.error("Hết phiên làm việc, vui lòng đăng nhập lại.");
      router.push("/login");
      return;
    }

    const { oldPassword, newPassword, confirmPassword } = changePasswordValues;

    if (!oldPassword) {
      toast.error("Vui lòng nhập mật khẩu cũ.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Xác nhận mật khẩu mới không khớp.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changePassword(oldPassword, newPassword, token);
      toast.success("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
      setChangePasswordValues({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => {
        logout();
      }, 1500);
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi đổi mật khẩu.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex bg-slate-50 h-screen overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <Header />
          <TabNavigation
            tabs={[
              { id: "Thông tin cá nhân", label: "Thông tin cá nhân" },
              { id: "Vai trò & Quyền hạn", label: "Vai trò & Quyền hạn" },
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
        <TabNavigation
          tabs={[
            { id: "Thông tin cá nhân", label: "Thông tin cá nhân" },
            { id: "Vai trò & Quyền hạn", label: "Vai trò & Quyền hạn" },
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id)}
        />
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
                <div className="w-24 h-24 rounded-full bg-blue-100 border-4 border-white shadow-md flex items-center justify-center text-3xl font-bold text-blue-600 uppercase">
                  {(profile?.user_name || "US").substring(0, 2)}
                </div>

                {/* User Info */}
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {profile?.user_name || "Người dùng"}
                  </h1>
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm font-medium">{profile?.email}</span>
                    </div>
                    {profile?.phone_number && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm font-medium">{profile.phone_number}</span>
                      </div>
                    )}
                    <div className="bg-slate-100 px-3 py-1 rounded-md text-[11px] font-mono font-bold text-slate-500">
                      UUID: {profile?.id?.substring(0, 8).toUpperCase()}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-emerald-700">
                        Đang hoạt động
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Content Tabs */}
            {activeTab === "Thông tin cá nhân" ? (
              <div className="grid grid-cols-12 gap-6">
                {/* Form chỉnh sửa */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="col-span-12 lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">
                      Hồ sơ cá nhân
                    </h2>
                    {isEditing ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setIsEditing(false);
                            setEditValues({
                              username: profile?.user_name || "",
                              phone: profile?.phone_number || "",
                              dob: profile?.date_birth ? formatDateStr(new Date(profile.date_birth)) : "",
                              department: profile?.department || "Khoa Công nghệ thông tin",
                            });
                          }}
                          disabled={isSaving}
                          className="text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                        label="Email (Không thể thay đổi)"
                        value={profile?.email || ""}
                        readOnly={true}
                        disabled={true}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <Input
                        label="Số điện thoại"
                        value={editValues.phone}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            phone: e.target.value,
                          })
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
                                className="flex items-center justify-between w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-left disabled:opacity-50"
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
                          value={editValues.dob || "Chưa cập nhật"}
                          readOnly={true}
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                            <SelectTrigger className="disabled:opacity-50">
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
                            <span>{editValues.department || "Chưa cập nhật"}</span>
                          </div>
                        )}
                      </div>

                      {/* Xóa trường đổi mật khẩu trực tiếp ở đây */}
                    </div>
                  </div>
                </motion.div>

                {/* Tóm tắt nhanh */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="col-span-12 lg:col-span-4 space-y-6"
                >
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <h3 className="font-bold text-slate-900">Bảo mật tài khoản</h3>
                    <p className="text-xs text-slate-500">
                      Bạn có thể chỉnh sửa thông tin cá nhân của mình bằng cách nhấn vào nút **Chỉnh sửa** trên thẻ hồ sơ. Để đổi mật khẩu, vui lòng sử dụng phần đổi mật khẩu phía dưới.
                    </p>
                    <div className="flex items-center gap-3 text-slate-600 text-sm">
                      <Lock className="w-4 h-4 text-blue-500" />
                      <span>Mật khẩu được bảo mật bằng thuật toán hash một chiều</span>
                    </div>
                  </div>

                  {/* Đổi mật khẩu */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Lock className="w-5 h-5 text-blue-600" />
                      Đổi mật khẩu
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 tracking-wider">
                          Mật khẩu cũ
                        </label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={changePasswordValues.oldPassword}
                          onChange={(e) => setChangePasswordValues({
                            ...changePasswordValues,
                            oldPassword: e.target.value
                          })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 tracking-wider">
                          Mật khẩu mới
                        </label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={changePasswordValues.newPassword}
                          onChange={(e) => setChangePasswordValues({
                            ...changePasswordValues,
                            newPassword: e.target.value
                          })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 tracking-wider">
                          Xác nhận mật khẩu mới
                        </label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={changePasswordValues.confirmPassword}
                          onChange={(e) => setChangePasswordValues({
                            ...changePasswordValues,
                            confirmPassword: e.target.value
                          })}
                        />
                      </div>
                      <Button
                        onClick={handleChangePassword}
                        disabled={isChangingPassword}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-10 font-bold flex items-center justify-center gap-1.5 transition-all"
                      >
                        {isChangingPassword ? "Đang xử lý..." : "Cập nhật mật khẩu"}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </div>
            ) : (
              // Tab Vai trò & Quyền hạn
              <div className="grid grid-cols-12 gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="col-span-12 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-blue-600" />
                      <h2 className="text-lg font-bold text-slate-900">
                        Vai trò hiện tại: <span className="text-blue-600">{profile?.roleName}</span>
                      </h2>
                    </div>
                  </div>
                  <div className="p-6">
                    {profile?.role?.permissions && profile.role.permissions.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[#f8fafc] border border-slate-100 rounded-xl p-5 space-y-4">
                          <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <UserIcon className="w-5 h-5 text-blue-500" />
                            Danh sách quyền hạn được cấp (Phần 1)
                          </h3>
                          <ul className="space-y-3">
                            {profile.role.permissions
                              .slice(0, Math.ceil(profile.role.permissions.length / 2))
                              .map((perm: any, i: number) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-800">{perm.name}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">{perm.code}</span>
                                  </div>
                                </li>
                              ))}
                          </ul>
                        </div>

                        <div className="bg-[#f8fafc] border border-slate-100 rounded-xl p-5 space-y-4">
                          <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-blue-500" />
                            Danh sách quyền hạn được cấp (Phần 2)
                          </h3>
                          <ul className="space-y-3">
                            {profile.role.permissions
                              .slice(Math.ceil(profile.role.permissions.length / 2))
                              .map((perm: any, i: number) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-800">{perm.name}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">{perm.code}</span>
                                  </div>
                                </li>
                              ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-400 font-medium text-sm border border-dashed border-slate-200 rounded-xl">
                        Tài khoản của bạn chưa được cấp quyền hạn cụ thể nào.
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
