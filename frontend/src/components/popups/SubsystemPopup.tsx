'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Search, LayoutGrid, Users, ArrowUpRight, 
  ShieldAlert, Settings, Calendar, Play, Building2, BarChart3, Compass, Shield, Bell
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth, isAdminUser } from '@/providers/auth-provider';
import { authApi } from '@/api/auth-api';



interface SubsystemPopupProps {
  isOpen: boolean;
  onClose: () => void;
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

const INITIAL_MODULES = [
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
    name: 'Quản trị hệ thống',
    desc: 'Theo dõi logs, quản lý các yêu cầu vận hành và sao lưu dữ liệu hệ thống.',
    status: 'ACTIVE',
    stat: { type: 'progress', percent: 65, label: '65%' },
    href: '/system',
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

export default function SubsystemPopup({ isOpen, onClose }: SubsystemPopupProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [modulesState, setModulesState] = useState(INITIAL_MODULES);
  const { user, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  const [routeMappings, setRouteMappings] = useState<any[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Trigger reload on update event
  useEffect(() => {
    const handleUpdate = () => {
      setRefreshTrigger((prev) => prev + 1);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('route-permissions-updated', handleUpdate);
      return () => window.removeEventListener('route-permissions-updated', handleUpdate);
    }
  }, []);

  const userRole = String(user?.role || '').toLowerCase();
  const isStudent = userRole.includes('student') || userRole.includes('học sinh') || userRole.includes('sinh viên');
  const isTeacher = userRole.includes('teacher') || userRole.includes('advisor') || userRole.includes('giảng viên') || userRole.includes('giáo viên');
  const isAdmin = isAdminUser(user);

  // Tải danh sách cấu hình phân quyền động từ Database khi mở popup
  useEffect(() => {
    if (!isOpen) return;
    const fetchMappings = async () => {
      try {
        const { tokenStorage } = await import('@/api/auth-api');
        const token = tokenStorage.getAccessToken() || '';
        const data = await authApi.getRoutePermissionsPublic(token);
        setRouteMappings(data);
      } catch (err) {
        console.error('Failed to fetch route permission mappings:', err);
      }
    };
    fetchMappings();
  }, [isOpen, refreshTrigger]);

  // Đồng bộ trạng thái bảo trì từ localStorage khi mount hoặc mở popup
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('subsystems_maintenance_states');
      if (stored) {
        const states = JSON.parse(stored);
        setModulesState(prev => prev.map(mod => {
          const isMaint = states[mod.id] === true;
          return {
            ...mod,
            status: isMaint ? 'MAINTENANCE' : (mod.id === 'security' ? 'RESTRICTED' : 'ACTIVE')
          };
        }));
      }
    } catch (e) {
      console.error(e);
    }
  }, [isOpen]);

  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const toggleMaintenance = (moduleId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    try {
      const stored = localStorage.getItem('subsystems_maintenance_states');
      const states = stored ? JSON.parse(stored) : {};
      const newState = e.target.checked;
      states[moduleId] = newState;
      localStorage.setItem('subsystems_maintenance_states', JSON.stringify(states));

      // Phát sự kiện storage để đồng bộ các component khác
      window.dispatchEvent(new Event('storage'));

      // Cập nhật local state
      setModulesState(prev => prev.map(mod => {
        if (mod.id === moduleId) {
          return {
            ...mod,
            status: newState ? 'MAINTENANCE' : (mod.id === 'security' ? 'RESTRICTED' : 'ACTIVE')
          };
        }
        return mod;
      }));

      toast.success(`Đã ${newState ? 'bật' : 'tắt'} chế độ bảo trì cho phân hệ.`);
    } catch (err) {
      console.error(err);
      toast.error('Không thể cập nhật trạng thái bảo trì.');
    }
  };

  const handleAccess = (moduleName: string, href: string, status: string) => {
    if (status === 'MAINTENANCE' && !isAdmin) {
      toast.error(`Phân hệ "${moduleName}" đang được bảo trì. Bạn không thể truy cập vào lúc này.`);
      return;
    }
    
    let targetHref = href;
    if (href === '/students' && isStudent) {
      targetHref = '/students/tasks';
    }

    toast.info(`Đang điều hướng sang phân hệ: ${moduleName}`);
    router.push(targetHref);
    onClose();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'RESTRICTED':
        return 'bg-amber-500/10 text-amber-700 border border-amber-500/20';
      case 'MAINTENANCE':
        return 'bg-rose-500/10 text-rose-700 border border-rose-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20';
    }
  };


  const checkModulePermission = (mod: typeof INITIAL_MODULES[0]) => {
    // 1. Admin always has full access
    if (isAdmin) return true;

    // 2. Try dynamic database mapping
    const mapping = routeMappings.find(
      (m) => m.route_path === mod.href && m.is_active !== false
    );

    if (mapping) {
      if (!mapping.permissions || mapping.permissions.length === 0) {
        return true;
      }
      const requiredCodes = mapping.permissions.map((p: any) => p.code || p);
      if (mapping.check_type === 'any') {
        return hasAnyPermission(...requiredCodes);
      } else {
        return hasAllPermissions(...requiredCodes);
      }
    }

    // 3. Fallback to default static check
    if (mod.id === 'config') {
      return (
        isAdmin ||
        hasAnyPermission(
          'SYSTEM_ADMIN',
          'LOGIN_LOG_READ',
          'SYSTEM_REQUEST_READ',
          'SYSTEM_REQUEST_MANAGE',
          'DATABASE_BACKUP_READ',
          'DATABASE_BACKUP_CREATE',
          'DATABASE_BACKUP_DOWNLOAD',
          'DATABASE_BACKUP_DELETE'
        )
      );
    }

    if (mod.id === 'security') {
      return isAdmin || hasPermission('admin');
    }

    if (mod.id === 'sv-profile') {
      return hasPermission('STUDENT_PAGE') || isTeacher;
    }

    if (mod.id === 'grading') {
      return hasPermission('GRADING_PAGE') || isTeacher;
    }

    if (mod.id === 'attendance') {
      return isStudent || isTeacher || hasPermission('STUDENT_PAGE');
    }

    if (mod.id === 'events') {
      return isStudent || isTeacher || hasPermission('STUDENT_PAGE') || hasPermission('READ_STUDENT_TASK');
    }

    if (mod.id === 'reports') {
      return isAdmin;
    }

    // Legacy role fallback for other modules (e.g. dormitory, club, notifications)
    if (isStudent) {
      return mod.group === 'Học sinh';
    }
    if (isTeacher) {
      return ['sv-profile', 'grading', 'attendance', 'events', 'club'].includes(mod.id);
    }
    if (mod.group === 'Hệ thống') {
      return false;
    }
    return true;
  };

  const filteredModules = modulesState.filter(mod => {
    const matchesSearch = mod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mod.desc.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    return checkModulePermission(mod);
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
            className="bg-[#eef4fd]/90 backdrop-blur-lg border border-white/80 rounded-2xl w-full max-w-[1152px] h-[90vh] max-h-[850px] shadow-[0_20px_50px_rgba(0,0,0,0.12)] relative z-10 overflow-hidden flex flex-col font-sans animate-in fade-in duration-200"
          >
            {/* Header */}
            <div className="px-4 py-3.5 sm:px-10 sm:py-5 border-b border-white/70 flex items-center justify-between shrink-0 bg-gradient-to-r from-blue-50/20 via-white to-slate-50/20 gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 hidden sm:flex items-center justify-center text-blue-600 shrink-0">
                  <LayoutGrid size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 text-[15px] sm:text-[18px] leading-tight truncate">
                    <span className="hidden sm:inline">Quản lý Phân hệ Hệ thống</span>
                    <span className="sm:hidden">Quản lý phân hệ</span>
                  </h3>
                  <p className="text-[12px] text-slate-400 font-semibold mt-0.5 hidden sm:block">Cấu hình các thành phần lõi của Luminous Glass System</p>
                </div>
              </div>

              {/* Action area: Search + Close */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="relative">
                  <div className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search className="w-3.5 h-3.5 sm:w-[15px] sm:h-[15px]" />
                  </div>
                  <input
                    type="text"
                    placeholder="Tìm kiếm..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white/50 backdrop-blur-sm border border-white/70 focus:border-blue-500 focus:ring-2 focus:ring-[#1A73E8]/30 rounded-xl pl-8 sm:pl-9 pr-3 sm:pr-4 py-1.5 sm:py-2 text-[12px] sm:text-[13px] font-medium transition-all outline-none text-slate-800 w-[110px] focus:w-[140px] sm:w-[200px] sm:focus:w-[240px] md:w-[240px]"
                  />
                </div>
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 sm:p-2.5 rounded-xl transition-all duration-150 flex items-center justify-center cursor-pointer border border-slate-200/50 shrink-0"
                  aria-label="Đóng popup"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-10 sm:py-8 space-y-6 sm:space-y-8 custom-scrollbar bg-slate-50/30">
              
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
                          onClick={() => handleAccess(mod.name, mod.href, mod.status)}
                          className="bg-white/60 backdrop-blur-sm border border-white/80 hover:border-blue-400 hover:bg-white/80 rounded-xl p-4 flex flex-col justify-between min-h-[150px] transition-all duration-150 hover:scale-[1.01] hover:shadow-md group cursor-pointer active:scale-[0.99] pb-3.5"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-blue-50/80 border border-blue-100/30 flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-all shrink-0 mt-0.5">
                                <IconComp size={15} />
                              </div>
                              <h4 className="font-bold text-slate-800 text-[14px] leading-snug break-words flex-1">{mod.name}</h4>
                            </div>
                            
                            <div className="flex items-center gap-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
                              {isAdmin && (
                                <label className="relative inline-flex items-center cursor-pointer" title="Bật/Tắt chế độ bảo trì">
                                  <input 
                                    type="checkbox" 
                                    checked={mod.status === 'MAINTENANCE'} 
                                    onChange={(e) => toggleMaintenance(mod.id, e)} 
                                    className="sr-only peer" 
                                  />
                                  <div className="w-7 h-4 bg-slate-200 peer-focus:outline-none rounded-xl peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-xl after:h-3 after:w-3 after:transition-all peer-checked:bg-rose-500"></div>
                                  <span className="ml-1 text-[9px] font-bold text-slate-400 peer-checked:text-rose-500 select-none">Bảo trì</span>
                                </label>
                              )}
                              <span className={`${getStatusBadgeClass(mod.status)} px-2 py-0.5 rounded-xl text-[8px] font-bold uppercase tracking-wider`}>
                                {mod.status}
                              </span>
                            </div>
                            
                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed line-clamp-2">{mod.desc}</p>
                          </div>

                          <div className="border-t border-slate-100/60 pt-2 flex items-center justify-between">
                            <div>
                              {mod.stat.type === 'avatar' && (
                                <div className="flex -space-x-2">
                                  <div className="w-5 h-5 rounded-full bg-blue-100 ring-2 ring-white flex items-center justify-center text-[8px] font-bold text-blue-600">A</div>
                                  <div className="w-5 h-5 rounded-full bg-indigo-100 ring-2 ring-white flex items-center justify-center text-[8px] font-bold text-indigo-600">B</div>
                                  <div className="w-5 h-5 rounded-full bg-purple-100 ring-2 ring-white flex items-center justify-center text-[8px] font-bold text-purple-600">C</div>
                                  <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200/50 ring-2 ring-white flex items-center justify-center text-[7px] font-bold text-slate-500">+{mod.stat.count}</div>
                                </div>
                              )}
                              {mod.stat.type === 'growth' && (
                                <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2 py-0.5 rounded-xl">{mod.stat.label}</span>
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
                          onClick={() => handleAccess(mod.name, mod.href, mod.status)}
                          className="bg-white/60 backdrop-blur-sm border border-white/80 hover:border-blue-400 hover:bg-white/80 rounded-xl p-4 flex flex-col justify-between min-h-[150px] transition-all duration-150 hover:scale-[1.01] hover:shadow-md group cursor-pointer active:scale-[0.99] pb-3.5"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-blue-50/80 border border-blue-100/30 flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-all shrink-0 mt-0.5">
                                <IconComp size={15} />
                              </div>
                              <h4 className="font-bold text-slate-800 text-[14px] leading-snug break-words flex-1">{mod.name}</h4>
                            </div>
                            
                            <div className="flex items-center gap-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
                              {isAdmin && (
                                <label className="relative inline-flex items-center cursor-pointer" title="Bật/Tắt chế độ bảo trì">
                                  <input 
                                    type="checkbox" 
                                    checked={mod.status === 'MAINTENANCE'} 
                                    onChange={(e) => toggleMaintenance(mod.id, e)} 
                                    className="sr-only peer" 
                                  />
                                  <div className="w-7 h-4 bg-slate-200 peer-focus:outline-none rounded-xl peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-xl after:h-3 after:w-3 after:transition-all peer-checked:bg-rose-500"></div>
                                  <span className="ml-1 text-[9px] font-bold text-slate-400 peer-checked:text-rose-500 select-none">Bảo trì</span>
                                </label>
                              )}
                              <span className={`${getStatusBadgeClass(mod.status)} px-2 py-0.5 rounded-xl text-[8px] font-bold uppercase tracking-wider`}>
                                {mod.status}
                              </span>
                            </div>
                            
                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed line-clamp-2">{mod.desc}</p>
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
                          onClick={() => handleAccess(mod.name, mod.href, mod.status)}
                          className="bg-white/60 backdrop-blur-sm border border-white/80 hover:border-blue-400 hover:bg-white/80 rounded-xl p-4 flex flex-col justify-between min-h-[150px] transition-all duration-150 hover:scale-[1.01] hover:shadow-md group cursor-pointer active:scale-[0.99] pb-3.5"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-blue-50/80 border border-blue-100/30 flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-all shrink-0 mt-0.5">
                                <IconComp size={15} />
                              </div>
                              <h4 className="font-bold text-slate-800 text-[14px] leading-snug break-words flex-1">{mod.name}</h4>
                            </div>
                            
                            <div className="flex items-center gap-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
                              {isAdmin && (
                                <label className="relative inline-flex items-center cursor-pointer" title="Bật/Tắt chế độ bảo trì">
                                  <input 
                                    type="checkbox" 
                                    checked={mod.status === 'MAINTENANCE'} 
                                    onChange={(e) => toggleMaintenance(mod.id, e)} 
                                    className="sr-only peer" 
                                  />
                                  <div className="w-7 h-4 bg-slate-200 peer-focus:outline-none rounded-xl peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-xl after:h-3 after:w-3 after:transition-all peer-checked:bg-rose-500"></div>
                                  <span className="ml-1 text-[9px] font-bold text-slate-400 peer-checked:text-rose-500 select-none">Bảo trì</span>
                                </label>
                              )}
                              <span className={`${getStatusBadgeClass(mod.status)} px-2 py-0.5 rounded-xl text-[8px] font-bold uppercase tracking-wider`}>
                                {mod.status}
                              </span>
                            </div>
                            
                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed line-clamp-2">{mod.desc}</p>
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
                          onClick={() => handleAccess(mod.name, mod.href, mod.status)}
                          className="bg-white/60 backdrop-blur-sm border border-white/80 hover:border-blue-400 hover:bg-white/80 rounded-xl p-4 flex flex-col justify-between min-h-[150px] transition-all duration-150 hover:scale-[1.01] hover:shadow-md group cursor-pointer active:scale-[0.99] pb-3.5"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-blue-50/80 border border-blue-100/30 flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-all shrink-0 mt-0.5">
                                <IconComp size={15} />
                              </div>
                              <h4 className="font-bold text-slate-800 text-[14px] leading-snug break-words flex-1">{mod.name}</h4>
                            </div>
                            
                            <div className="flex items-center gap-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
                              {isAdmin && (
                                <label className="relative inline-flex items-center cursor-pointer" title="Bật/Tắt chế độ bảo trì">
                                  <input 
                                    type="checkbox" 
                                    checked={mod.status === 'MAINTENANCE'} 
                                    onChange={(e) => toggleMaintenance(mod.id, e)} 
                                    className="sr-only peer" 
                                  />
                                  <div className="w-7 h-4 bg-slate-200 peer-focus:outline-none rounded-xl peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-xl after:h-3 after:w-3 after:transition-all peer-checked:bg-rose-500"></div>
                                  <span className="ml-1 text-[9px] font-bold text-slate-400 peer-checked:text-rose-500 select-none">Bảo trì</span>
                                </label>
                              )}
                              <span className={`${getStatusBadgeClass(mod.status)} px-2 py-0.5 rounded-xl text-[8px] font-bold uppercase tracking-wider`}>
                                {mod.status}
                              </span>
                            </div>
                            
                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed line-clamp-2">{mod.desc}</p>
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
                                <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2 py-0.5 rounded-xl">{mod.stat.label}</span>
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
            <div className="px-10 py-5 border-t border-white/70 flex items-center justify-between shrink-0 bg-slate-50/50">
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


