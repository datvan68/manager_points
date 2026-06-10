'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Search, LayoutGrid, Users, ArrowUpRight, 
  ShieldAlert, Settings, Calendar, Play, Building2, BarChart3, Compass, Shield, Bell
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';

interface SubsystemPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SubsystemPopup({ isOpen, onClose }: SubsystemPopupProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();

  const userRole = String(user?.role || '').toLowerCase();
  const isStudent = userRole.includes('student') || userRole.includes('học sinh') || userRole.includes('sinh viên');
  const isTeacher = userRole.includes('teacher') || userRole.includes('advisor') || userRole.includes('giảng viên') || userRole.includes('giáo viên');

  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  // Preset modules mapped with system routes
  const modules = [
    {
      id: 'sv-profile',
      group: 'Học sinh',
      name: 'Hồ sơ sinh viên',
      desc: 'Quản lý thông tin cá nhân, học bạ và lịch sử đào tạo tập trung.',
      status: 'ACTIVE',
      stat: { type: 'avatar', count: 12 },
      href: '/students',
      icon: Users
    },
    {
      id: 'grading',
      group: 'Học sinh',
      name: 'Đánh giá điểm số',
      desc: 'Hệ thống tính toán điểm trung bình và xếp loại học tập tự động.',
      status: 'ACTIVE',
      stat: { type: 'growth', label: '+8% tháng này' },
      href: '/grading',
      icon: GraduationCapIcon
    },
    {
      id: 'attendance',
      group: 'Học sinh',
      name: 'Theo dõi chuyên cần',
      desc: 'Điểm danh thông minh và báo cáo tỷ lệ vắng mặt thời gian thực.',
      status: 'ACTIVE',
      stat: { type: 'time', label: 'Cập nhật: 5 phút trước' },
      href: '/students/record',
      icon: Calendar
    },
    {
      id: 'dormitory',
      group: 'KTX',
      name: 'Quản lý KTX',
      desc: 'Quản lý phòng ốc, đăng ký lưu trú và hóa đơn dịch vụ ký túc xá.',
      status: 'ACTIVE',
      stat: { type: 'time', label: 'Mới cập nhật' },
      href: '/dormitory',
      icon: Building2
    },
    {
      id: 'club',
      group: 'Club',
      name: 'Câu lạc bộ',
      desc: 'Nơi sinh hoạt ngoại khóa, đăng ký thành viên và lên kế hoạch hoạt động CLB.',
      status: 'ACTIVE',
      stat: { type: 'event', label: 'Đang mở đăng ký' },
      href: '/club',
      icon: Compass
    },
    {
      id: 'security',
      group: 'Hệ thống',
      name: 'Kiểm soát phân quyền',
      desc: 'Thiết lập vai trò, quyền truy cập tài liệu và bảo mật hệ thống.',
      status: 'RESTRICTED',
      stat: { type: 'restricted', label: 'Bị giới hạn' },
      href: '/permissions',
      icon: Shield
    },
    {
      id: 'config',
      group: 'Hệ thống',
      name: 'Cấu hình hệ thống',
      desc: 'Điều chỉnh thông số kỹ thuật, API và các kết nối cơ sở dữ liệu.',
      status: 'MAINTENANCE',
      stat: { type: 'progress', percent: 65, label: '65%' },
      href: '/settings',
      icon: Settings
    },
    {
      id: 'events',
      group: 'Học sinh',
      name: 'Nhiệm vụ',
      desc: 'Lên lịch biểu, quản lý các kỳ thi và giao nhiệm vụ học tập cho HSSV.',
      status: 'ACTIVE',
      stat: { type: 'event', label: '2 sự kiện sắp tới' },
      href: '/students/tasks',
      icon: Calendar
    },
    {
      id: 'reports',
      group: 'Hệ thống',
      name: 'Thống kê báo cáo',
      desc: 'Tổng hợp số liệu rèn luyện, chuyên cần và học tập toàn trường.',
      status: 'ACTIVE',
      stat: { type: 'growth', label: 'Xuất PDF/Excel' },
      href: '/reports',
      icon: BarChart3
    },
    {
      id: 'notifications',
      group: 'Hệ thống',
      name: 'Quản lý thông báo',
      desc: 'Cấu hình và gửi thông báo tự động, theo dõi lịch sử thông báo hệ thống.',
      status: 'ACTIVE',
      stat: { type: 'event', label: 'Hoạt động' },
      href: '/notifications',
      icon: Bell
    }
  ];

  const handleAccess = (moduleName: string, href: string) => {
    toast.info(`Đang điều hướng sang phân hệ: ${moduleName}`);
    router.push(href);
    onClose();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'RESTRICTED':
        return 'bg-amber-50 text-amber-700 border border-amber-100/50';
      case 'MAINTENANCE':
        return 'bg-red-50 text-red-700 border border-red-100/50';
      default:
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100/50';
    }
  };


  const filteredModules = modules.filter(mod => {
    const matchesSearch = mod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mod.desc.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (isStudent) {
      return mod.group === 'Học sinh';
    }
    if (isTeacher) {
      return ['sv-profile', 'grading', 'attendance', 'events', 'dormitory', 'club', 'notifications'].includes(mod.id);
    }
    return true;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-md"
          />

          {/* Modal chính */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="bg-white/90 backdrop-blur-lg border border-white/80 rounded-2xl w-full max-w-[1152px] h-[90vh] max-h-[850px] shadow-[0_20px_50px_rgba(0,0,0,0.12)] relative z-10 overflow-hidden flex flex-col font-sans animate-in fade-in duration-200"
          >
            {/* Header */}
            <div className="px-10 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-blue-50/20 via-white to-slate-50/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                  <LayoutGrid size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-[18px]">Quản lý Phân hệ Hệ thống</h3>
                  <p className="text-[12px] text-slate-400 font-semibold mt-0.5">Cấu hình các thành phần lõi của Luminous Glass System</p>
                </div>
              </div>

              {/* Action area: Search + Close */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search size={15} />
                  </div>
                  <input
                    type="text"
                    placeholder="Tìm kiếm phân hệ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white/50 backdrop-blur-sm border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl pl-9 pr-4 py-2 text-[13px] font-medium transition-all outline-none text-slate-800 w-[200px] sm:w-[240px]"
                  />
                </div>
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2.5 rounded-xl transition-all duration-150 flex items-center justify-center cursor-pointer border border-slate-200/50"
                  aria-label="Đóng popup"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-10 py-8 space-y-8 custom-scrollbar bg-slate-50/30">
              
              {/* Nhóm học sinh */}
              {filteredModules.some(m => m.group === 'Học sinh') && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Users size={16} className="text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">NHÓM HỌC SINH</span>
                    <div className="flex-1 h-[1px] bg-slate-100" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredModules.filter(m => m.group === 'Học sinh').map(mod => {
                      const IconComp = mod.icon || LayoutGrid;
                      return (
                        <div 
                          key={mod.id} 
                          onClick={() => handleAccess(mod.name, mod.href)}
                          className="bg-white/60 backdrop-blur-sm border border-white/80 hover:border-blue-400 hover:bg-white/80 rounded-xl p-4 flex flex-col justify-between h-[145px] transition-all duration-150 hover:scale-[1.01] hover:shadow-md group cursor-pointer active:scale-[0.99]"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-blue-50/80 border border-blue-100/30 flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-all shrink-0">
                                  <IconComp size={15} />
                                </div>
                                <h4 className="font-bold text-slate-800 text-[14px] truncate">{mod.name}</h4>
                              </div>
                              <span className={`${getStatusBadgeClass(mod.status)} px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider shrink-0`}>
                                {mod.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-2.5 leading-relaxed line-clamp-2">{mod.desc}</p>
                          </div>

                          <div className="border-t border-slate-100/60 pt-2 flex items-center justify-between">
                            <div>
                              {mod.stat.type === 'avatar' && (
                                <div className="flex -space-x-1.5">
                                  <div className="w-5 h-5 rounded-full bg-blue-100 ring-2 ring-white flex items-center justify-center text-[8px] font-bold text-blue-600">A</div>
                                  <div className="w-5 h-5 rounded-full bg-indigo-100 ring-2 ring-white flex items-center justify-center text-[8px] font-bold text-indigo-600">B</div>
                                  <div className="w-5 h-5 rounded-full bg-purple-100 ring-2 ring-white flex items-center justify-center text-[8px] font-bold text-purple-600">C</div>
                                  <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200/50 ring-2 ring-white flex items-center justify-center text-[7px] font-bold text-slate-500">+{mod.stat.count}</div>
                                </div>
                              )}
                              {mod.stat.type === 'growth' && (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">{mod.stat.label}</span>
                              )}
                              {mod.stat.type === 'time' && (
                                <span className="text-[10px] font-medium text-slate-400">{mod.stat.label}</span>
                              )}
                              {mod.stat.type === 'event' && (
                                <span className="text-[10px] font-semibold text-slate-500">{mod.stat.label}</span>
                              )}
                            </div>
                            <div className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0">
                              <ArrowUpRight size={14} strokeWidth={2.5} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nhóm KTX */}
              {filteredModules.some(m => m.group === 'KTX') && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Building2 size={16} className="text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">NHÓM KÝ TÚC XÁ (KTX)</span>
                    <div className="flex-1 h-[1px] bg-slate-100" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredModules.filter(m => m.group === 'KTX').map(mod => {
                      const IconComp = mod.icon || LayoutGrid;
                      return (
                        <div 
                          key={mod.id} 
                          onClick={() => handleAccess(mod.name, mod.href)}
                          className="bg-white/60 backdrop-blur-sm border border-white/80 hover:border-blue-400 hover:bg-white/80 rounded-xl p-4 flex flex-col justify-between h-[145px] transition-all duration-150 hover:scale-[1.01] hover:shadow-md group cursor-pointer active:scale-[0.99]"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-blue-50/80 border border-blue-100/30 flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-all shrink-0">
                                  <IconComp size={15} />
                                </div>
                                <h4 className="font-bold text-slate-800 text-[14px] truncate">{mod.name}</h4>
                              </div>
                              <span className={`${getStatusBadgeClass(mod.status)} px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider shrink-0`}>
                                {mod.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-2.5 leading-relaxed line-clamp-2">{mod.desc}</p>
                          </div>

                          <div className="border-t border-slate-100/60 pt-2 flex items-center justify-between">
                            <div>
                              {mod.stat.type === 'time' && (
                                <span className="text-[10px] font-medium text-slate-400">{mod.stat.label}</span>
                              )}
                            </div>
                            <div className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0">
                              <ArrowUpRight size={14} strokeWidth={2.5} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nhóm Câu lạc bộ */}
              {filteredModules.some(m => m.group === 'Club') && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Compass size={16} className="text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">NHÓM CÂU LẠC BỘ</span>
                    <div className="flex-1 h-[1px] bg-slate-100" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredModules.filter(m => m.group === 'Club').map(mod => {
                      const IconComp = mod.icon || LayoutGrid;
                      return (
                        <div 
                          key={mod.id} 
                          onClick={() => handleAccess(mod.name, mod.href)}
                          className="bg-white/60 backdrop-blur-sm border border-white/80 hover:border-blue-400 hover:bg-white/80 rounded-xl p-4 flex flex-col justify-between h-[145px] transition-all duration-150 hover:scale-[1.01] hover:shadow-md group cursor-pointer active:scale-[0.99]"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-blue-50/80 border border-blue-100/30 flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-all shrink-0">
                                  <IconComp size={15} />
                                </div>
                                <h4 className="font-bold text-slate-800 text-[14px] truncate">{mod.name}</h4>
                              </div>
                              <span className={`${getStatusBadgeClass(mod.status)} px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider shrink-0`}>
                                {mod.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-2.5 leading-relaxed line-clamp-2">{mod.desc}</p>
                          </div>

                          <div className="border-t border-slate-100/60 pt-2 flex items-center justify-between">
                            <div>
                              {mod.stat.type === 'event' && (
                                <span className="text-[10px] font-semibold text-slate-500">{mod.stat.label}</span>
                              )}
                            </div>
                            <div className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0">
                              <ArrowUpRight size={14} strokeWidth={2.5} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nhóm hệ thống */}
              {filteredModules.some(m => m.group === 'Hệ thống') && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Settings size={16} className="text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">NHÓM HỆ THỐNG</span>
                    <div className="flex-1 h-[1px] bg-slate-100" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredModules.filter(m => m.group === 'Hệ thống').map(mod => {
                      const IconComp = mod.icon || LayoutGrid;
                      return (
                        <div 
                          key={mod.id} 
                          onClick={() => handleAccess(mod.name, mod.href)}
                          className="bg-white/60 backdrop-blur-sm border border-white/80 hover:border-blue-400 hover:bg-white/80 rounded-xl p-4 flex flex-col justify-between h-[145px] transition-all duration-150 hover:scale-[1.01] hover:shadow-md group cursor-pointer active:scale-[0.99]"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-blue-50/80 border border-blue-100/30 flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-all shrink-0">
                                  <IconComp size={15} />
                                </div>
                                <h4 className="font-bold text-slate-800 text-[14px] truncate">{mod.name}</h4>
                              </div>
                              <span className={`${getStatusBadgeClass(mod.status)} px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider shrink-0`}>
                                {mod.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-2.5 leading-relaxed line-clamp-2">{mod.desc}</p>
                          </div>

                          <div className="border-t border-slate-100/60 pt-2 flex items-center justify-between">
                            <div className="flex-1 mr-4">
                              {mod.stat.type === 'restricted' && (
                                <div className="flex items-center gap-1.5 text-amber-600">
                                  <ShieldAlert size={14} />
                                  <span className="text-[10px] font-bold">{mod.stat.label}</span>
                                </div>
                              )}
                              {mod.stat.type === 'progress' && (
                                <div className="flex items-center justify-between w-full">
                                  <div className="w-full bg-slate-100 rounded-full h-1.5 mr-2">
                                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${mod.stat.percent}%` }} />
                                  </div>
                                  <span className="text-[10px] font-extrabold text-blue-600 shrink-0">{mod.stat.label}</span>
                                </div>
                              )}
                              {mod.stat.type === 'event' && (
                                <div className="flex items-center gap-1.5 text-slate-500">
                                  <Calendar size={13} />
                                  <span className="text-[10px] font-semibold">{mod.stat.label}</span>
                                </div>
                              )}
                              {mod.stat.type === 'growth' && (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">{mod.stat.label}</span>
                              )}
                            </div>
                            <div className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0">
                              <ArrowUpRight size={14} strokeWidth={2.5} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-10 py-5 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              {/* User badge */}
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold text-sm">
                  {user ? getInitials(user.user_name || user.username || '') : 'AD'}
                </div>
                <div>
                  <h5 className="font-bold text-slate-700 text-[13px] leading-tight">
                    {user?.user_name || user?.username || 'Guest'}
                  </h5>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {user?.role || 'User'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Inline fallback since GraduationCap is not imported from lucide-react directly in original file
const GraduationCapIcon = (props: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
  </svg>
);
