'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Search, LayoutGrid, User, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import SubsystemPopup from '@/components/popups/SubsystemPopup';
import NotificationPopup from '@/components/popups/NotificationPopup';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { notificationApi, NotificationItem } from '@/api/notification-api';
import { studentApi } from '@/api/student-api';
import { isAuthError } from '@/api/http-client';
import { toast } from 'sonner';
import StudentCongratsModalGate from './StudentCongratsModalGate';

interface HeaderProps {
    customMappings?: Record<string, string>;
}

const Header = ({ customMappings = {} }: HeaderProps) => {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isSubsystemOpen, setIsSubsystemOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isResolvingProfile, setIsResolvingProfile] = useState(false);
    
    const profileRef = useRef<HTMLDivElement>(null);
    const notificationRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

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
      <header className="h-16 bg-white/45 backdrop-blur-md border-b border-white/70 flex items-center justify-between px-4 relative z-50 shadow-sm shadow-slate-200/20">
        {/* Left: Breadcrumbs/Title */}
        <div className="flex items-center gap-2">
           <Breadcrumb customMappings={customMappings} />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-xl flex items-center justify-center text-[#64748B] border border-transparent hover:border-white/60 hover:bg-white/70 hover:text-[#1E293B] hover:scale-[1.01] transition-all duration-150 ease-out cursor-pointer">
            <Search size={18} />
          </button>
          
          {/* Notification Bell with Dropdown */}
          <div className="relative" ref={notificationRef}>
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

          <button 
            onClick={() => setIsSubsystemOpen(true)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#64748B] border border-transparent hover:border-white/60 hover:bg-white/70 hover:text-[#1E293B] hover:scale-[1.01] transition-all duration-150 ease-out cursor-pointer"
          >
            <LayoutGrid size={18} />
          </button>
          
            {/* User Profile */}
          <div className="relative pl-3 border-l border-white/60 ml-1.5" ref={profileRef}>
             <button 
               onClick={() => setIsProfileOpen(!isProfileOpen)}
               className="relative w-8 h-8 rounded-full bg-[#1A73E8]/10 flex items-center justify-center text-[#1A73E8] font-bold text-xs ring-2 ring-white/80 shadow-sm hover:ring-[#1A73E8]/30 transition-all focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/20"
               data-id="btn/Profile"
             >
               {user ? getInitials(user.display_name || user.user_name || user.username || '') : '??'}
               <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
             </button>
   
             {/* Profile Popup */}
             {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-md shadow-slate-300/40 border border-slate-100 py-2 z-[100] animate-in fade-in zoom-in-95 duration-200" data-id="popup/Profile">
                  <div className="px-4 py-3 border-b border-white/50 flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-full bg-[#1A73E8]/10 flex items-center justify-center text-[#1A73E8] font-bold text-sm">
                          {user ? getInitials(user.display_name || user.user_name || user.username || '') : '??'}
                          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      </div>
                      <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1E293B] truncate">{user?.display_name || user?.user_name || user?.username || 'Guest'}</p>
                          <p className="text-xs text-[#64748B] truncate">ID: {user?.id?.substring(0, 8)}...</p>
                      </div>
                  </div>

                  <div className="px-4 py-2 flex items-center justify-between border-b border-white/50">
                      <div className="flex flex-col">
                          <span className="text-sm font-medium text-[#1E293B]">Trạng thái</span>
                          <span className="text-xs text-[#64748B]">{isOnline ? 'Đang hoạt động' : 'Vắng mặt'}</span>
                      </div>
                      <button 
                          onClick={() => setIsOnline(!isOnline)}
                          className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors duration-200 cursor-pointer ${isOnline ? 'bg-[#1A73E8]' : 'bg-gray-200/80'}`}
                      >
                          <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isOnline ? 'translate-x-5' : 'translate-x-0'}`} />
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
                      <button className="w-full text-left px-3 py-1.5 text-sm text-[#1E293B] hover:bg-white/60 rounded-lg flex items-center gap-2 cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01]">
                          <SettingsIcon size={16} className="text-[#64748B]" />
                          Cài đặt
                      </button>
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
