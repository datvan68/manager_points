"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Award,
  Diamond,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import { authApi, tokenStorage } from "@/api/auth-api";
import { summariesPointApi } from "@/api/summaries-point-api";
import { getRankStyle } from "@/lib/grading-rank";
import { isStudentRole } from "@/utils/role.util";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { normalizeProfile, NormalizedProfile } from "./_lib/normalize-profile";
import { StudentDormitorySection } from "@/components/profile/StudentDormitorySection";
import { useLocationPermission } from "@/hooks/useLocationPermission";

export function resolveLatestSummaryState(summary: any, error: string | null) {
  if (error) return "error" as const;
  if (summary && summary.status === "locked") return "locked" as const;
  return "empty" as const;
}

export default function ProfilePage() {
  const router = useRouter();
  const { checkAuth, logout } = useAuth();
  const { granted: locationEnabled } = useLocationPermission();

  const [activeTab, setActiveTab] = useState("Thông tin cá nhân");
  const [profile, setProfile] = useState<NormalizedProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [latestSummary, setLatestSummary] = useState<any>(null);
  const [latestSummaryError, setLatestSummaryError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const formatProfileDate = (dateStr: string): string => {
    if (!dateStr) return "";
    const parsed = parseDate(dateStr);
    return parsed && !isNaN(parsed.getTime()) ? formatDateStr(parsed) : "";
  };

  const fetchProfile = async () => {
    setLoadError(null);
    setIsLoading(true);
    const token = tokenStorage.getAccessToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const rawData = await authApi.getMe(token);
      const data = normalizeProfile(rawData);
      setProfile(data);
      setEditValues({
        username: data.user_name,
        phone: data.phone_number,
        dob: data.date_birth ? formatProfileDate(data.date_birth) : "",
        department: data.department || "",
      });

      const isStudent = isStudentRole(data);
      
      if (isStudent) {
        setLatestSummary(null);
        setLatestSummaryError(null);
        try {
          const summary = await summariesPointApi.getMyLatestSummary();
          setLatestSummary(summary);
        } catch (err: any) {
          setLatestSummaryError(err?.message || "Không thể tải điểm rèn luyện đã chốt.");
        }
      } else {
        setLatestSummary(null);
        setLatestSummaryError(null);
      }
    } catch (error: any) {
      setLoadError(error.message || "Lỗi khi tải thông tin hồ sơ.");
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
      <>
        <TabNavigation
          tabs={[
            { id: "Thông tin cá nhân", label: "Thông tin cá nhân" },
            { id: "Vai trò & Quyền hạn", label: "Vai trò & Quyền hạn" },
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id)}
        />
        <main className="flex-1 p-3 md:p-4 overflow-y-auto bg-transparent">
          <div className="max-w-6xl mx-auto space-y-6">
            <Skeleton className="h-32 w-full rounded-2xl animate-pulse bg-white/20" />
            <div className="grid grid-cols-12 gap-6">
              <Skeleton className="col-span-4 h-[500px] rounded-2xl animate-pulse bg-white/20" />
              <div className="col-span-8 space-y-6">
                <Skeleton className="h-40 w-full rounded-2xl animate-pulse bg-white/20" />
                <Skeleton className="h-64 w-full rounded-2xl animate-pulse bg-white/20" />
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (loadError && !isLoading) {
    return (
      <>
        <TabNavigation
          tabs={[
            { id: "Thông tin cá nhân", label: "Thông tin cá nhân" },
            { id: "Vai trò & Quyền hạn", label: "Vai trò & Quyền hạn" },
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id)}
        />
        <main className="flex-1 p-4 overflow-y-auto flex items-center justify-center bg-transparent">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full p-6 bg-white/40 backdrop-blur-md rounded-2xl border border-white/70 shadow-lg shadow-slate-300/40 text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-800">Không thể tải thông tin hồ sơ</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {loadError}
              </p>
            </div>
            <Button 
              onClick={() => fetchProfile()} 
              className="w-full bg-[#1A73E8] hover:bg-[#1A73E8]/90 text-white font-medium py-2 px-4 rounded-xl shadow-md transition-all duration-150 ease-out hover:scale-[1.01]"
            >
              Thử lại
            </Button>
          </motion.div>
        </main>
      </>
    );
  }

  return (
    <>
        <TabNavigation
          tabs={[
            { id: "Thông tin cá nhân", label: "Thông tin cá nhân" },
            { id: "Vai trò & Quyền hạn", label: "Vai trò & Quyền hạn" },
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id)}
        />
        <main className="flex-1 p-3 md:p-4 overflow-y-auto bg-transparent scrollbar-hide">
          <div className="max-w-[1280px] mx-auto space-y-6">
            {/* Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm shadow-slate-300/40 p-5 flex items-center justify-between w-full hover:scale-[1.01] transition-all duration-150 ease-out"
            >
              <div className="flex items-center gap-6 w-full">
                {/* Avatar */}
                <div className="w-20 h-20 shrink-0 rounded-full bg-[#1A73E8]/10 border-4 border-white/80 shadow-sm shadow-slate-300/40 flex items-center justify-center text-2xl font-semibold text-[#1A73E8] uppercase transition-all duration-150 ease-out hover:scale-[1.03]">
                  {(profile?.user_name || "US").substring(0, 2)}
                </div>

                {/* User Info */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-start justify-between w-full">
                    <div>
                      <h1 className="text-xl font-bold text-[#1E293B] tracking-tight">
                        {profile?.user_name || "Người dùng"}
                      </h1>
                      <div className="flex items-center gap-4 flex-wrap mt-1.5">
                        <div className="flex items-center gap-2 text-[#64748B]">
                          <Mail className="w-4 h-4 text-[#1A73E8]" />
                          <span className="text-xs font-medium">{profile?.email}</span>
                        </div>
                        {profile?.phone_number && (
                          <div className="flex items-center gap-2 text-[#64748B]">
                            <Phone className="w-4 h-4 text-[#1A73E8]" />
                            <span className="text-xs font-medium">{profile.phone_number}</span>
                          </div>
                        )}
                        <div className="bg-white/50 backdrop-blur-sm border border-white/80 px-2 py-0.5 rounded-xl text-[10px] font-mono font-bold text-[#64748B] shadow-sm">
                          UUID: {profile?.id?.substring(0, 8).toUpperCase()}
                        </div>
                        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl border ${
                          locationEnabled
                            ? 'bg-blue-500/10 text-blue-700 border-blue-500/20'
                            : 'bg-gray-500/10 text-gray-600 border-gray-500/20'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            locationEnabled
                              ? 'bg-blue-500 animate-pulse'
                              : 'bg-gray-400'
                          }`} />
                          <span className="text-[11px] font-bold">
                            {locationEnabled
                              ? 'Đang chia sẻ vị trí'
                              : 'Vị trí: Tắt'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Điểm rèn luyện / Xếp hạng */}
                    {isStudentRole(profile) && (
                      resolveLatestSummaryState(latestSummary, latestSummaryError) === "error" ? (
                        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border shadow-sm bg-red-50/70 border-red-200 text-red-700">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span className="text-[13px] font-bold">
                            Không thể tải điểm rèn luyện đã chốt
                          </span>
                        </div>
                      ) : resolveLatestSummaryState(latestSummary, latestSummaryError) === "locked" ? (() => {
                        const style = getRankStyle(latestSummary.rank_tier);
                        return (
                          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border shadow-sm ${style.glassBg || style.bg} ${style.glassBorder || style.border}`}>
                            <Diamond className={`w-4 h-4 fill-currentColor shrink-0 ${style.text}`} />
                            <span className={`text-[13px] font-bold ${style.text}`}>
                              Hạng: {latestSummary.rank_label || style.label} ({latestSummary.total_score}đ) - {latestSummary.semester}
                            </span>
                          </div>
                        );
                      })() : (
                        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border shadow-sm bg-white/30 backdrop-blur-sm border-white/40">
                          <Diamond className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-[13px] font-bold text-slate-500">
                            Chưa có điểm rèn luyện đã chốt
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Content Tabs */}
            {activeTab === "Thông tin cá nhân" ? (
              <>
              <div className="grid grid-cols-12 gap-6">
                {/* Form chỉnh sửa */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="col-span-12 lg:col-span-8 bg-white/40 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm shadow-slate-300/40 overflow-hidden hover:scale-[1.01] transition-all duration-150 ease-out"
                >
                  <div className="px-5 py-4 border-b border-white/40 flex items-center justify-between">
                    <h2 className="text-[15px] font-bold text-[#1E293B]">
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
                              dob: profile?.date_birth ? formatProfileDate(profile.date_birth) : "",
                              department: profile?.department || "",
                            });
                          }}
                          disabled={isSaving}
                          className="text-xs font-bold text-[#64748B] hover:text-[#1E293B] transition-all duration-150 ease-out hover:scale-[1.01] disabled:opacity-50"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="text-xs font-bold text-[#1A73E8] hover:opacity-80 transition-all duration-150 ease-out hover:scale-[1.01] disabled:opacity-50 flex items-center gap-1.5"
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
                        className="text-xs font-bold text-[#1A73E8] hover:opacity-80 transition-all duration-150 ease-out hover:scale-[1.01]"
                      >
                        Chỉnh sửa
                      </button>
                    )}
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          <label className="text-[13px] px-1 font-bold text-[#1E293B]">
                            Ngày sinh
                          </label>
                          <Popover
                            open={isCalendarOpen && !isSaving}
                            onOpenChange={(open) => !isSaving && setIsCalendarOpen(open)}
                          >
                            <PopoverTrigger asChild>
                              <button
                                disabled={isSaving}
                                className="flex items-center justify-between w-full h-10 px-3 bg-white/50 backdrop-blur-sm border border-white/70 rounded-xl text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8]/50 transition-all duration-150 ease-out text-left disabled:opacity-50 hover:bg-white/70 hover:scale-[1.01]"
                              >
                                <span>{editValues.dob || "Chọn ngày sinh"}</span>
                                <CalendarIcon className="w-4 h-4 text-[#64748B]" />
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
                          value={editValues.dob || "Chưa cập nhật"}
                          readOnly={true}
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[13px] px-1 font-bold text-[#1E293B]">
                          GVCN lớp
                        </label>
                        <div className="flex flex-col justify-center min-h-10 px-3 py-2 bg-white/50 backdrop-blur-sm border border-white/70 rounded-xl text-sm text-[#1E293B]">
                          {!profile?.roleName.match(/Teacher|Giảng viên|GVCN/i) ? (
                            <span className="text-slate-400 italic text-xs">Không áp dụng</span>
                          ) : profile?.advisor_classes && profile.advisor_classes.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {profile.advisor_classes.map((c: any) => (
                                <span key={c._id} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  {c.class_name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic text-xs">Không phụ trách lớp nào</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Tóm tắt nhanh */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="col-span-12 lg:col-span-4 space-y-6"
                >
                  <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm shadow-slate-300/40 p-5 space-y-3 hover:scale-[1.01] transition-all duration-150 ease-out">
                    <h3 className="text-[15px] font-bold text-[#1E293B]">Bảo mật tài khoản</h3>
                    <p className="text-xs text-[#64748B]">
                      Bạn có thể chỉnh sửa thông tin cá nhân của mình bằng cách nhấn vào nút **Chỉnh sửa** trên thẻ hồ sơ. Để đổi mật khẩu, vui lòng sử dụng phần đổi mật khẩu phía dưới.
                    </p>
                    <div className="flex items-center gap-3 text-[#64748B] text-xs">
                      <Lock className="w-4 h-4 text-[#1A73E8]" />
                      <span>Mật khẩu được bảo mật bằng thuật toán hash một chiều</span>
                    </div>
                  </div>

                  {/* Đổi mật khẩu */}
                  <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm shadow-slate-300/40 p-5 space-y-3 hover:scale-[1.01] transition-all duration-150 ease-out">
                    <h3 className="text-[15px] font-bold text-[#1E293B] flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#1A73E8]" />
                      Đổi mật khẩu
                    </h3>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[13px] px-1 font-bold text-[#1E293B]">
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
                        <label className="text-[13px] px-1 font-bold text-[#1E293B]">
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
                        <label className="text-[13px] px-1 font-bold text-[#1E293B]">
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
                        variant="default"
                        className="w-full h-10 mt-1"
                      >
                        {isChangingPassword ? "Đang xử lý..." : "Cập nhật mật khẩu"}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </div>
              {isStudentRole(profile) && <StudentDormitorySection />}
              </>
            ) : (
              // Tab Vai trò & Quyền hạn
              <div className="grid grid-cols-12 gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="col-span-12 bg-white/40 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm shadow-slate-300/40 overflow-hidden hover:scale-[1.01] transition-all duration-150 ease-out"
                >
                  <div className="px-5 py-4 border-b border-white/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-[#1A73E8]" />
                      <h2 className="text-[15px] font-bold text-[#1E293B]">
                        Vai trò hiện tại: <span className="text-[#1A73E8]">{profile?.roleName}</span>
                      </h2>
                    </div>
                  </div>
                  <div className="p-5">
                    {profile?.role?.permissions && profile.role.permissions.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/30 backdrop-blur-sm border border-white/50 rounded-xl p-4 space-y-3">
                          <h3 className="text-[13px] font-bold text-[#1E293B] flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-[#1A73E8]" />
                            Danh sách quyền hạn được cấp (Phần 1)
                          </h3>
                          <ul className="space-y-2">
                            {profile.role.permissions
                              .slice(0, Math.ceil(profile.role.permissions.length / 2))
                              .map((perm: any, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-[#64748B]">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                                  <div className="flex flex-col">
                                    <span className="font-bold text-[#1E293B]">{perm.name}</span>
                                    <span className="text-[9px] text-[#64748B]/70 font-mono">{perm.code}</span>
                                  </div>
                                </li>
                              ))}
                          </ul>
                        </div>

                        <div className="bg-white/30 backdrop-blur-sm border border-white/50 rounded-xl p-4 space-y-3">
                          <h3 className="text-[13px] font-bold text-[#1E293B] flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-[#1A73E8]" />
                            Danh sách quyền hạn được cấp (Phần 2)
                          </h3>
                          <ul className="space-y-2">
                            {profile.role.permissions
                              .slice(Math.ceil(profile.role.permissions.length / 2))
                              .map((perm: any, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-[#64748B]">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                                  <div className="flex flex-col">
                                    <span className="font-bold text-[#1E293B]">{perm.name}</span>
                                    <span className="text-[9px] text-[#64748B]/70 font-mono">{perm.code}</span>
                                  </div>
                                </li>
                              ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-[#64748B] font-medium text-xs border border-dashed border-white/50 rounded-xl bg-white/20 backdrop-blur-sm">
                        Tài khoản của bạn chưa được cấp quyền hạn cụ thể nào.
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        </main>
    </>
  );
}
