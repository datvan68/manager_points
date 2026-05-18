'use client';
import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Search, Plus, Filter, SlidersHorizontal, LayoutGrid, User, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';

import Breadcrumb from '@/components/ui/Breadcrumb';

const Header = () => {
    const { user, logout } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const profileRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

    const getInitials = (name: string) => {
        if (!name || typeof name !== 'string') return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };

        if (isProfileOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isProfileOpen]);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 relative z-50">
      {/* Left: Breadcrumbs/Title */}
      <div className="flex items-center gap-2">
         <Breadcrumb />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <Search size={20} />
        </button>
        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <LayoutGrid size={20} />
        </button>
        
          {/* User Profile */}
        <div className="relative pl-4 border-l border-gray-200 ml-2" ref={profileRef}>
           <button 
             onClick={() => setIsProfileOpen(!isProfileOpen)}
             className="relative w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#135bec] font-bold text-xs ring-2 ring-white shadow-sm hover:ring-blue-100 transition-all focus:outline-none focus:ring-2 focus:ring-[#135bec]/20"
             data-id="btn/Profile"
           >
             {user ? getInitials(user.user_name || user.username) : '??'}
             <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
           </button>
 
           {/* Profile Popup */}
           {isProfileOpen && (
             <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-[100] animate-in fade-in zoom-in-95 duration-200" data-id="popup/Profile">
                <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-[#135bec] font-bold text-sm">
                        {user ? getInitials(user.user_name || user.username) : '??'}
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{user?.user_name || user?.username || 'Guest'}</p>
                        <p className="text-xs text-gray-500 truncate">ID: {user?.id?.substring(0, 8)}...</p>
                    </div>
                </div>

                <div className="px-4 py-2 flex items-center justify-between border-b border-gray-50">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-700">Trạng thái</span>
                        <span className="text-xs text-gray-500">{isOnline ? 'Đang hoạt động' : 'Vắng mặt'}</span>
                    </div>
                    <button 
                        onClick={() => setIsOnline(!isOnline)}
                        className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors duration-200 ${isOnline ? 'bg-green-500' : 'bg-gray-200'}`}
                    >
                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isOnline ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>
                
                <div className="py-1">
                    <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <User size={16} className="text-gray-400" />
                        Thông tin cá nhân
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <SettingsIcon size={16} className="text-gray-400" />
                        Cài đặt
                    </button>
                </div>
                
                <div className="border-t border-gray-50 py-1">
                    <button 
                        onClick={() => {
                            setIsProfileOpen(false);
                            logout();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
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
  );
};

export default Header;
