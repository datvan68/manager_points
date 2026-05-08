'use client';

import React from 'react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import { 
  Users, 
  GraduationCap, 
  Building2, 
  TrendingUp, 
  ArrowUpRight, 
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { motion } from 'framer-motion';

const StatCard = ({ title, value, change, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-${color.split('-')[1]}-600`}>
        <Icon size={24} />
      </div>
      <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-xs font-bold">
        <TrendingUp size={12} />
        {change}
      </div>
    </div>
    <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
    <p className="text-2xl font-black text-gray-900">{value}</p>
  </div>
);

export default function DashboardPage() {
  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Welcome Section */}
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Tổng quan hệ thống</h1>
              <p className="text-gray-500 text-sm mt-1">Chào mừng bạn quay trở lại. Đây là những gì đang diễn ra hôm nay.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                title="Tổng sinh viên" 
                value="1,284" 
                change="+12%" 
                icon={Users} 
                color="bg-blue-500" 
              />
              <StatCard 
                title="Khóa học đang mở" 
                value="42" 
                change="+5%" 
                icon={GraduationCap} 
                color="bg-purple-500" 
              />
              <StatCard 
                title="Phòng KTX trống" 
                value="128" 
                change="-2%" 
                icon={Building2} 
                color="bg-amber-500" 
              />
              <StatCard 
                title="Tỉ lệ hoàn thành" 
                value="94.2%" 
                change="+3.4%" 
                icon={TrendingUp} 
                color="bg-emerald-500" 
              />
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content Area */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-bold text-gray-800">Biểu đồ tăng trưởng</h2>
                    <select className="bg-gray-50 border-none text-xs font-bold text-gray-500 rounded-lg px-3 py-2 outline-none">
                      <option>7 ngày qua</option>
                      <option>30 ngày qua</option>
                    </select>
                  </div>
                  <div className="h-64 flex items-end justify-between gap-2">
                    {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                        <div className="w-full bg-blue-50 rounded-lg relative overflow-hidden h-full flex items-end">
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            transition={{ delay: i * 0.1, duration: 1 }}
                            className="w-full bg-blue-600 rounded-lg group-hover:bg-blue-700 transition-colors"
                          />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400">T{i+2}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                   <h2 className="font-bold text-gray-800 mb-4">Hoạt động gần đây</h2>
                   <div className="space-y-4">
                      {[
                        { title: 'Cập nhật điểm thi học kỳ 1', time: '10 phút trước', icon: CheckCircle2, color: 'text-emerald-500' },
                        { title: 'Đăng ký phòng KTX mới: Nguyễn Văn A', time: '25 phút trước', icon: Clock, color: 'text-blue-500' },
                        { title: 'Tạo tài khoản giảng viên mới', time: '1 giờ trước', icon: Users, color: 'text-purple-500' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
                           <div className={`p-2 rounded-lg bg-gray-50 ${item.color}`}>
                              <item.icon size={18} />
                           </div>
                           <div className="flex-1">
                              <p className="text-sm font-bold text-gray-800">{item.title}</p>
                              <p className="text-xs text-gray-400">{item.time}</p>
                           </div>
                           <ArrowUpRight size={16} className="text-gray-300" />
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              {/* Sidebar Info Area */}
              <div className="space-y-6">
                 <div className="bg-primary bg-opacity-90 p-8 rounded-3xl text-white relative overflow-hidden shadow-xl shadow-blue-600/20">
                    <div className="relative z-10">
                       <h3 className="text-xl font-black mb-2">Upgrade to Pro</h3>
                       <p className="text-blue-100 text-sm mb-6 leading-relaxed">Mở khóa các tính năng quản lý cao cấp và hệ thống báo cáo nâng cao.</p>
                       <button className="bg-white text-primary px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors">
                          Nâng cấp ngay
                       </button>
                    </div>
                    {/* Decorative elements */}
                    <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white opacity-10 rounded-full blur-3xl"></div>
                    <div className="absolute -left-4 -top-4 w-24 h-24 bg-blue-400 opacity-20 rounded-full blur-2xl"></div>
                 </div>

                 <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                       <h2 className="font-bold text-gray-800">Thông báo</h2>
                       <button className="text-primary text-xs font-bold hover:underline">Xem hết</button>
                    </div>
                    <div className="space-y-4">
                       <div className="flex gap-4">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2"></div>
                          <div className="flex flex-col gap-1">
                             <p className="text-xs font-bold text-gray-800">Hệ thống bảo trì định kỳ</p>
                             <p className="text-[11px] text-gray-500">22:00 hôm nay - 02:00 ngày mai</p>
                          </div>
                       </div>
                       <div className="flex gap-4">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2"></div>
                          <div className="flex flex-col gap-1">
                             <p className="text-xs font-bold text-gray-800">Nhắc nhở nộp báo cáo quý</p>
                             <p className="text-[11px] text-gray-500">Hạn chót vào cuối tuần này</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
