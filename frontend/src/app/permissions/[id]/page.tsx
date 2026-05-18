'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '../../../components/layout/Sidebar';
import Header from '../../../components/layout/Header';
import TabNavigation from '@/components/ui/TabNavigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { 
  User, 
  Mail, 
  Phone, 
  UserCheck, 
  ShieldCheck, 
  Lock, 
  History, 
  Pencil, 
  MoreHorizontal,
  RefreshCcw,
  Ban,
  CheckCircle2,
  X,
  GraduationCap,
  LayoutGrid,
  Calendar as CalendarIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import { authApi, tokenStorage } from '../../../lib/auth-api';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [activeTab, setActiveTab] = useState('Người dùng');
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [editValues, setEditValues] = useState({
    username: '',
    email: '',
    phone: '0912 345 678',
    staffId: 'GV-2023-089',
    dob: '15/08/1985',
    department: 'Khoa Công nghệ thông tin'
  });

  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
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
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      const token = tokenStorage.getAccessToken();
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        // Since we don't have a specific getUserById, we fetch all and find
        // In a real app, we'd add getUserById to authApi
        const users = await authApi.getUsers(token);
        const foundUser = users.find(u => u._id === id || u.id === id);
        
        if (foundUser) {
          setUser(foundUser);
          setEditValues({
            username: foundUser.user_name || foundUser.username || '',
            email: foundUser.email || '',
            phone: foundUser.phone || '0912 345 678',
            staffId: foundUser.staffId || 'GV-2023-089',
            dob: foundUser.dob || '15/08/1985',
            department: foundUser.department || 'Khoa Công nghệ thông tin'
          });
        } else {
          toast.error('Không tìm thấy người dùng');
          router.push('/permissions');
        }
      } catch (error: any) {
        toast.error('Lỗi khi tải dữ liệu: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, router]);

  if (isLoading) {
    return (
      <div className="flex bg-slate-50 h-screen overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <Header />
          <TabNavigation 
            tabs={[
              { id: 'Người dùng', label: 'Người dùng' },
              { id: 'Vai trò', label: 'Vai trò' },
              { id: 'Quyền hạn', label: 'Quyền hạn' },
              { id: 'Cấu hình', label: 'Cấu hình' }
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
                  {(user?.user_name || user?.username || 'NQ').substring(0, 2).toUpperCase()}
                </div>
                
                {/* User Info */}
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-slate-900">{user?.user_name || user?.username || 'Nguyễn Quang Huy'}</h1>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm font-medium">{user?.email || 'huy.nq@edu.vn'}</span>
                    </div>
                    <div className="bg-slate-100 px-3 py-1 rounded-md text-[11px] font-mono font-bold text-slate-500">
                      UUID: {user?._id?.substring(0, 8).toUpperCase() || '8A7F-2B1C'}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-emerald-700">Đang hoạt động</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button variant="outline" className="flex items-center gap-2 border-slate-200 text-slate-600 font-bold">
                  <RefreshCcw className="w-4 h-4" />
                  Đặt lại mật khẩu
                </Button>
                <Button variant="outline" className="flex items-center gap-2 border-slate-200 text-slate-600 font-bold">
                  <Ban className="w-4 h-4" />
                  Tạm khoá
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
                    <h2 className="text-lg font-bold text-slate-900">Thông tin cá nhân</h2>
                    {isEditing ? (
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => {
                            setIsEditing(false);
                            // Restore original values
                            setEditValues({
                              username: user?.user_name || user?.username || '',
                              email: user?.email || '',
                              phone: editValues.phone,
                              staffId: editValues.staffId,
                              dob: editValues.dob,
                              department: editValues.department
                            });
                          }} 
                          className="text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          Hủy
                        </button>
                        <button 
                          onClick={() => {
                            setIsEditing(false);
                            // Save and show toast
                            setUser({
                              ...user,
                              username: editValues.username,
                              email: editValues.email
                            });
                            toast.success('Lưu thông tin cá nhân thành công!');
                          }} 
                          className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          Lưu
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
                      label="HỌ VÀ TÊN" 
                      value={editValues.username} 
                      onChange={(e) => setEditValues({ ...editValues, username: e.target.value })}
                      readOnly={!isEditing} 
                    />
                    <Input 
                      label="EMAIL TỔ CHỨC" 
                      value={editValues.email} 
                      onChange={(e) => setEditValues({ ...editValues, email: e.target.value })}
                      readOnly={!isEditing} 
                    />
                    <Input 
                      label="SỐ ĐIỆN THOẠI" 
                      value={editValues.phone} 
                      onChange={(e) => setEditValues({ ...editValues, phone: e.target.value })}
                      readOnly={!isEditing} 
                    />
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">NGÀY SINH</label>
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                          <PopoverTrigger asChild>
                            <button className="flex items-center justify-between w-full h-10 px-3 bg-[#f8fafc] border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-left">
                              <span>{editValues.dob || "Chọn ngày sinh"}</span>
                              <CalendarIcon className="w-4 h-4 text-slate-400" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 z-[100] bg-transparent border-none shadow-none" align="start">
                            <CustomCalendar 
                              startDate={parseDate(editValues.dob)}
                              endDate={parseDate(editValues.dob)}
                              onRangeSelect={(start) => {
                                setEditValues({ ...editValues, dob: formatDateStr(start) });
                              }}
                              onCancel={() => setIsCalendarOpen(false)}
                              onConfirm={() => setIsCalendarOpen(false)}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    ) : (
                      <Input 
                        label="NGÀY SINH" 
                        value={editValues.dob} 
                        readOnly={true} 
                      />
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">KHOA / PHÒNG BAN</label>
                      {isEditing ? (
                        <Select
                          value={editValues.department}
                          onValueChange={(val) => setEditValues({ ...editValues, department: val })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn khoa / phòng ban" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Khoa Công nghệ thông tin">Khoa Công nghệ thông tin</SelectItem>
                            <SelectItem value="Khoa Điện - Điện tử">Khoa Điện - Điện tử</SelectItem>
                            <SelectItem value="Khoa Kinh tế quốc tế">Khoa Kinh tế quốc tế</SelectItem>
                            <SelectItem value="Khoa Cơ khí chế tạo">Khoa Cơ khí chế tạo</SelectItem>
                            <SelectItem value="Khoa Ngoại ngữ">Khoa Ngoại ngữ</SelectItem>
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
                      <h2 className="text-lg font-bold text-slate-900">Vai trò hiện tại</h2>
                    </div>
                    <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider">
                      3 Vai trò
                    </div>
                  </div>
                  <div className="p-6 flex gap-3 flex-wrap">
                    {[
                      { name: 'Giảng viên chính', color: 'blue' },
                      { name: 'Chủ nhiệm lớp', color: 'purple' },
                      { name: 'Thành viên Hội đồng', color: 'slate' }
                    ].map((role, i) => (
                      <div 
                        key={i}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg border shadow-sm transition-all hover:shadow-md",
                          role.color === 'blue' && "bg-blue-50 border-blue-100 text-blue-700",
                          role.color === 'purple' && "bg-purple-50 border-purple-100 text-purple-700",
                          role.color === 'slate' && "bg-slate-50 border-slate-200 text-slate-700"
                        )}
                      >
                        <span className="text-sm font-bold">{role.name}</span>
                        <button className="p-0.5 hover:bg-black/5 rounded-full">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
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
                      <h2 className="text-lg font-bold text-slate-900">Quyền hạn truy cập tổng hợp</h2>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Academic Management Group */}
                      <div className="bg-[#f8fafc] border border-slate-100 rounded-xl p-5 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <GraduationCap className="w-5 h-5 text-blue-600" />
                          </div>
                          <h3 className="font-bold text-slate-900">Quản lý Học vụ</h3>
                        </div>
                        <ul className="space-y-2.5">
                          {[
                            'Xem danh sách lớp học',
                            'Nhập điểm số & Nhận xét',
                            'Duyệt đơn nghỉ phép sinh viên'
                          ].map((item, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                              <span className="font-medium">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Resources Group */}
                      <div className="bg-[#f8fafc] border border-slate-100 rounded-xl p-5 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <LayoutGrid className="w-5 h-5 text-orange-600" />
                          </div>
                          <h3 className="font-bold text-slate-900">Tài nguyên & Hệ thống</h3>
                        </div>
                        <ul className="space-y-2.5">
                          {[
                            { text: 'Truy cập kho học liệu số', active: true },
                            { text: 'Xem báo cáo thống kê khoa', active: true },
                            { text: 'Cấu hình hệ thống (Bị hạn chế)', active: false }
                          ].map((item, i) => (
                            <li key={i} className={cn(
                              "flex items-start gap-2.5 text-sm",
                              item.active ? "text-slate-600" : "text-slate-400 opacity-60"
                            )}>
                              {item.active ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                              ) : (
                                <div className="w-4 h-[2px] bg-slate-300 mt-[11px] shrink-0" />
                              )}
                              <span className="font-medium">{item.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    <div className="mt-8 flex justify-end">
                      <Button 
                        onClick={() => router.push('/permissions')}
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
    </div>
  );
}
