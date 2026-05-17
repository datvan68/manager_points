'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '../../../components/layout/Sidebar';
import Header from '../../../components/layout/Header';
import TabNavigation from '@/components/ui/TabNavigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
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
  LayoutGrid
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
                  {user?.username?.substring(0, 2).toUpperCase() || 'NQ'}
                </div>
                
                {/* User Info */}
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-slate-900">{user?.username || 'Nguyễn Quang Huy'}</h1>
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
                    <button className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">Chỉnh sửa</button>
                  </div>
                  <div className="p-6 space-y-5">
                    <Input label="HỌ VÀ TÊN" defaultValue={user?.username || 'Nguyễn Quang Huy'} readOnly />
                    <Input label="EMAIL TỔ CHỨC" defaultValue={user?.email || 'huy.nq@edu.vn'} readOnly />
                    <Input label="SỐ ĐIỆN THOẠI" defaultValue="0912 345 678" readOnly />
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="MÃ NHÂN SỰ" defaultValue="GV-2023-089" readOnly />
                      <Input label="NGÀY SINH" defaultValue="15/08/1985" readOnly />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">KHOA / PHÒNG BAN</label>
                      <div className="flex items-center justify-between h-10 px-3 bg-[#f8fafc] border border-slate-200/60 rounded-lg text-sm text-slate-900">
                        <span>Khoa Công nghệ thông tin</span>
                        <LayoutGrid className="w-4 h-4 text-slate-400" />
                      </div>
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
