'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Search, LayoutGrid, User, Download, LogOut, MapPin } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import logoNsg from '@/assets/cropped-logo-nsg.png';
import { useAuth } from '@/providers/auth-provider';
import SubsystemPopup from '@/components/popups/SubsystemPopup';
import NotificationPopup from '@/components/popups/NotificationPopup';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { notificationApi, NotificationItem } from '@/api/notification-api';
import { studentApi } from '@/api/student-api';
import { isAuthError } from '@/api/http-client';
import { toast } from 'sonner';
import StudentCongratsModalGate from './StudentCongratsModalGate';
import { useHeader } from '@/providers/header-provider';
import { useLocationPermission } from '@/hooks/useLocationPermission';
import { useNotificationRealtime } from '@/hooks/useNotificationRealtime';

interface HeaderProps {
    customMappings?: Record<string, string>;
}

const Header = ({ customMappings: propMappings = {} }: HeaderProps) => {
    const { user, logout } = useAuth();
    const router = useRouter();
    const headerContext = useHeader();
    const customMappings = headerContext ? { ...headerContext.customMappings, ...propMappings } : propMappings;
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isPwaInstalled, setIsPwaInstalled] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isSubsystemOpen, setIsSubsystemOpen] = useState(false);
    const { permission, granted: locationEnabled, requesting, requestPermission } = useLocationPermission();
    const locationStatus = requesting ? 'requesting' : permission === 'denied' ? 'denied' : permission === 'granted' ? 'granted' : 'idle';
    const setLocationStatus = (_status: typeof locationStatus) => undefined;
    const setLocationEnabled = (_enabled: boolean) => undefined;
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isResolvingProfile, setIsResolvingProfile] = useState(false);
    
    const profileRef = useRef<HTMLDivElement>(null);
    const notificationRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    useNotificationRealtime(Boolean(user));

    useEffect(() => {
        const displayModeQuery = window.matchMedia?.('(display-mode: standalone)');
        const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
        const updatePwaInstalled = () => {
            setIsPwaInstalled(
                Boolean(displayModeQuery?.matches || navigatorWithStandalone.standalone),
            );
        };

        updatePwaInstalled();
        const handleAppInstalled = () => {
            setIsPwaInstalled(true);
        };

        window.addEventListener('appinstalled', handleAppInstalled);
        displayModeQuery?.addEventListener('change', updatePwaInstalled);

        return () => {
            window.removeEventListener('appinstalled', handleAppInstalled);
            displayModeQuery?.removeEventListener('change', updatePwaInstalled);
        };
    }, []);

    // Xác định tên phân hệ hiện tại dựa trên url path
    const pathSegments = pathname.split('/').filter(segment => segment !== '');
    const firstSegment = pathSegments[0] || '';

    const getSubsystemName = (segment: string) => {
        const staticLabels: Record<string, string> = {
            'students': 'Học sinh sinh viên',
            'tasks': 'Công việc',
            'grading': 'Rèn luyện',
            'dormitory': 'Ký túc xá',
            'reports': 'Thống kê báo cáo',
            'permissions': 'Phân quyền',
            'club': 'Câu lạc bộ',
            'system': 'Hệ thống',
            'profile': 'Hồ sơ cá nhân',
            'login': 'Đăng nhập',
            'register': 'Đăng ký',
            'forgot-password': 'Quên mật khẩu',
            'reset-password': 'Đặt lại mật khẩu',
            'select-module': 'Chọn phân hệ',
        };
        return staticLabels[segment] || segment || 'Trang chủ';
    };

    const subsystemName = getSubsystemName(firstSegment);

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const [countRes, listRes] = await Promise.all([
                notificationApi.getUnreadCount(),
                notificationApi.getNotifications({ page: 1, limit: 5 })
            ]);
            setUnreadCount(countRes?.count || 0);
            setNotifications(listRes?.items || []);
        } catch (error: any) {
            if (isAuthError(error)) {
                setNotifications([]);
                setUnreadCount(0);
            } else {
                console.error('Failed to fetch notifications:', error);
            }
        }
    };

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        // Load notifications initially
        fetchNotifications();

        // Listen for updates from other components
        const handleNotificationsUpdate = () => {
            fetchNotifications();
        };

        window.addEventListener('notifications-updated', handleNotificationsUpdate);
        return () => {
            window.removeEventListener('notifications-updated', handleNotificationsUpdate);
        };
    }, [user]);

    const handleMarkAllRead = async () => {
        try {
            await notificationApi.markAllRead();
            window.dispatchEvent(new Event('notifications-updated'));
        } catch (error: any) {
            if (isAuthError(error)) {
                setNotifications([]);
                setUnreadCount(0);
            } else {
                console.error('Failed to mark all read:', error);
            }
        }
    };

    const handleMarkRead = async (id: string) => {
        try {
            await notificationApi.markRead(id);
            window.dispatchEvent(new Event('notifications-updated'));
        } catch (error: any) {
            if (isAuthError(error)) {
                setNotifications([]);
                setUnreadCount(0);
            } else {
                console.error('Failed to mark read:', error);
            }
        }
    };

    const getInitials = (name: string) => {
        if (!name || typeof name !== 'string') return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const handleProfileClick = async () => {
        if (isResolvingProfile) return;
        setIsProfileOpen(false);
        if (!user) {
            toast.error('Vui lòng đăng nhập.');
            router.push('/login');
            return;
        }

        setIsResolvingProfile(true);
        const role = (user?.role || user?.roleName || '').toLowerCase();
        const isStudent = role.includes('student') || role.includes('sinh vien') || role.includes('hoc sinh');

        if (isStudent) {
            try {
                const student = await studentApi.getMyStudent();
                const classId = typeof student.class_id === 'object' 
                    ? (student.class_id as any)?._id 
                    : student.class_id;
                const studentId = student._id;
                
                if (classId && studentId) {
                    router.push(`/students/${classId}/${studentId}`);
                } else {
                    toast.error('Hồ sơ học sinh thiếu thông tin lớp học. Fallback về trang hồ sơ cá nhân.');
                    router.push('/profile');
                }
            } catch (error: any) {
                console.error('Failed to resolve student profile:', error);
                toast.error(error.message || 'Không thể tải hồ sơ sinh viên. Fallback về trang hồ sơ cá nhân.');
                router.push('/profile');
            } finally {
                setIsResolvingProfile(false);
            }
        } else {
            setIsResolvingProfile(false);
            router.push('/profile');
        }
    };

    // Close popups when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (profileRef.current && !profileRef.current.contains(target)) {
                setIsProfileOpen(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(target)) {
                setIsNotificationOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

  return (
    <>
      <header className="h-16 shrink-0 bg-white/45 backdrop-blur-md border-b border-white/70 flex items-center justify-between px-4 relative z-50 shadow-sm shadow-slate-200/20 mt-0">
        {/* Left: Logo + System Name (mobile/tablet) OR Breadcrumbs (desktop) */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Logo & System Name (Chỉ hiển thị trên mobile/tablet: lg:hidden) */}
          <div className="flex items-center gap-2 sm:gap-3 lg:hidden min-w-0">
            {/* Logo */}
            <Link href="/" className="w-8 h-8 min-w-[32px] flex items-center justify-center rounded-xl overflow-hidden shadow-sm bg-white/80 shrink-0 hover:opacity-90 transition-opacity">
              <Image
                src={logoNsg}
                alt="NSG Logo"
                width={32}
                height={32}
                className="object-contain"
              />
            </Link>
            
            {/* Tên hệ thống */}
            <span className="text-[13px] sm:text-[14px] font-black glassmorphic-text tracking-wide whitespace-nowrap select-none">
              HOCSINHSINHVIEN
            </span>
          </div>

          {/* Breadcrumb (Chỉ hiển thị trên desktop: lg:flex) */}
          <div className="hidden lg:flex items-center gap-2">
            <Breadcrumb customMappings={customMappings} />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Nút tìm kiếm (Chỉ hiển thị trên desktop: lg:flex) */}
          <button className="hidden lg:flex w-8 h-8 rounded-xl items-center justify-center text-[#64748B] border border-transparent hover:border-white/60 hover:bg-white/70 hover:text-[#1E293B] hover:scale-[1.01] transition-all duration-150 ease-out cursor-pointer">
            <Search size={18} />
          </button>
          
          {/* Chuông thông báo (Chỉ hiển thị trên desktop: lg:block) */}
          <div className="hidden lg:block relative" ref={notificationRef}>
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[#64748B] border border-transparent hover:border-white/60 hover:bg-white/70 hover:text-[#1E293B] hover:scale-[1.01] transition-all duration-150 ease-out relative cursor-pointer"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[12px] h-[12px] bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              <NotificationPopup 
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                notifications={notifications}
                onMarkAllRead={handleMarkAllRead}
                onMarkRead={handleMarkRead}
              />
          </div>

          {/* Quản lý phân hệ (Luôn hiển thị) */}
          <button 
            onClick={() => setIsSubsystemOpen(true)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#64748B] border border-transparent hover:border-white/60 hover:bg-white/70 hover:text-[#1E293B] hover:scale-[1.01] transition-all duration-150 ease-out cursor-pointer"
            title="Quản lý phân hệ"
          >
            <LayoutGrid size={18} />
          </button>
          
          {/* User Profile (Luôn hiển thị) */}
          <div className="relative pl-3 border-l border-white/60 ml-1.5" ref={profileRef}>
             <button 
               onClick={() => setIsProfileOpen(!isProfileOpen)}
               className="relative w-8 h-8 rounded-full bg-[#1A73E8]/10 flex items-center justify-center text-[#1A73E8] font-bold text-xs ring-2 ring-white/80 shadow-sm hover:ring-[#1A73E8]/30 transition-all focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/20"
               data-id="btn/Profile"
             >
               {user ? getInitials(user.display_name || user.user_name || user.username || '') : '??'}
               <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${locationEnabled ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
             </button>
   
             {/* Profile Popup */}
             {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-md shadow-slate-300/40 border border-slate-100 py-2 z-[100] animate-in fade-in zoom-in-95 duration-200" data-id="popup/Profile">
                  <div className="px-4 py-3 border-b border-white/50 flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-full bg-[#1A73E8]/10 flex items-center justify-center text-[#1A73E8] font-bold text-sm">
                          {user ? getInitials(user.display_name || user.user_name || user.username || '') : '??'}
                          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${locationEnabled ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                      </div>
                      <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1E293B] truncate">{user?.display_name || user?.user_name || user?.username || 'Guest'}</p>
                          <p className="text-xs text-[#64748B] truncate">ID: {user?.id?.substring(0, 8)}...</p>
                      </div>
                  </div>

                  <div className="px-4 py-2 flex items-center justify-between border-b border-white/50">
                      <div className="flex flex-col">
                          <span className="text-sm font-medium text-[#1E293B] flex items-center gap-1.5">
                            <MapPin size={14} className={locationEnabled ? 'text-blue-500' : 'text-gray-400'} />
                            Vị trí
                          </span>
                          <span className="text-xs text-[#64748B]">
                            {locationStatus === 'requesting' ? 'Đang xin quyền...' :
                             locationStatus === 'denied' ? 'Quyền bị từ chối' :
                             locationEnabled ? 'Đang chia sẻ vị trí' : 'Tắt chia sẻ vị trí'}
                          </span>
                      </div>
                      <button 
                          onClick={async () => {
                            const result = locationEnabled ? 'granted' : await requestPermission();
                            if (locationEnabled) {
                              toast.info('Quyền vị trí đã được cấp. Hãy thu hồi quyền trong cài đặt trình duyệt.');
                              return;
                            }
                            if (result === 'granted') {
                              toast.success('ÄĂ£ báº­t chia sáº» vá»‹ trĂ­ cho Ä‘iá»ƒm danh.');
                              return;
                            }
                            if (result === 'denied') {
                              toast.error('Quyền vị trí bị từ chối. Vui lòng bật trong cài đặt trình duyệt.');
                              return;
                            }
                            if (!locationEnabled) {
                              // Turn ON: request GPS permission
                              setLocationStatus('requesting');
                              try {
                                const result = await navigator.permissions.query({ name: 'geolocation' });
                                if (result.state === 'denied') {
                                  setLocationStatus('denied');
                                  toast.error('Quyền vị trí bị từ chối. Vui lòng bật trong cài đặt trình duyệt.');
                                  return;
                                }
                                // Request actual position to trigger browser prompt
                                navigator.geolocation.getCurrentPosition(
                                  () => {
                                    setLocationEnabled(true);
                                    setLocationStatus('granted');
                                    toast.success('Đã bật chia sẻ vị trí cho điểm danh.');
                                  },
                                  (err) => {
                                    setLocationStatus('denied');
                                    if (err.code === err.PERMISSION_DENIED) {
                                      toast.error('Quyền vị trí bị từ chối. Vui lòng bật trong cài đặt trình duyệt.');
                                    } else {
                                      toast.error('Không thể truy cập vị trí. Vui lòng thử lại.');
                                    }
                                  },
                                  { enableHighAccuracy: true, timeout: 10000 },
                                );
                              } catch {
                                // Permissions API not supported, try direct request
                                navigator.geolocation.getCurrentPosition(
                                  () => {
                                    setLocationEnabled(true);
                                    setLocationStatus('granted');
                                    toast.success('Đã bật chia sẻ vị trí cho điểm danh.');
                                  },
                                  () => {
                                    setLocationStatus('denied');
                                    toast.error('Không thể truy cập vị trí.');
                                  },
                                  { enableHighAccuracy: true, timeout: 10000 },
                                );
                              }
                            } else {
                              // Turn OFF
                              setLocationEnabled(false);
                              setLocationStatus('idle');
                              toast.success('Đã tắt chia sẻ vị trí.');
                            }
                          }}
                          className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors duration-200 cursor-pointer ${locationEnabled ? 'bg-[#1A73E8]' : 'bg-gray-200/80'}`}
                      >
                          <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${locationEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                  </div>
                  
                  <div className="py-1 px-1">
                      <button 
                          onClick={handleProfileClick}
                          disabled={isResolvingProfile}
                          className={`w-full text-left px-3 py-1.5 text-sm rounded-lg flex items-center gap-2 cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01] ${isResolvingProfile ? 'text-gray-400 cursor-not-allowed bg-transparent' : 'text-[#1E293B] hover:bg-white/60'}`}
                      >
                          <User size={16} className={isResolvingProfile ? "text-gray-400" : "text-[#64748B]"} />
                          {isResolvingProfile ? 'Đang tải hồ sơ...' : 'Thông tin cá nhân'}
                      </button>
                      {!isPwaInstalled && <button
                          onClick={() => {
                              setIsProfileOpen(false);
                              window.dispatchEvent(new Event('hssv-pwa-install-request'));
                          }}
                          className="w-full text-left px-3 py-1.5 text-sm text-[#1E293B] hover:bg-white/60 rounded-lg flex items-center gap-2 cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01]"
                      >
                          <Download size={16} className="text-[#64748B]" />
                          Mở ứng dụng
                      </button>}
                  </div>
                  
                  <div className="border-t border-white/50 py-1 px-1">
                      <button 
                          onClick={() => {
                              setIsProfileOpen(false);
                              logout();
                          }}
                          className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-500/10 rounded-lg flex items-center gap-2 cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01]"
                      >
                          <LogOut size={16} />
                          Đăng xuất
                      </button>
                  </div>
                </div>
             )}
          </div>
        </div>
      </header>
      <SubsystemPopup isOpen={isSubsystemOpen} onClose={() => setIsSubsystemOpen(false)} />
      <StudentCongratsModalGate />
    </>
  );
};

export default Header;
