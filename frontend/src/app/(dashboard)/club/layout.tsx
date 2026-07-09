'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Calendar, Settings, Home, LayoutGrid
} from 'lucide-react';

const clubNavItems = [
  { label: 'Tổng quan', href: '/club', icon: Home },
  { label: 'Danh sách CLB', href: '/club/clubs', icon: LayoutGrid },
  { label: 'Lịch sinh hoạt', href: '/club/schedules', icon: Calendar },
  { label: 'Cấu hình điểm', href: '/club/config', icon: Settings },
];

export default function ClubLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Header Navigation */}
      <header className="shrink-0 bg-white/40 backdrop-blur-md border-b border-white/50 py-3 px-6 shadow-sm shadow-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-slate-800">Câu lạc bộ</span>
        </div>

        {/* Scrollable Horizontal Menu */}
        <nav className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 -my-1 -mx-4 px-4 md:mx-0 md:px-0">
          {clubNavItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/club' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                  transition-all duration-150 ease-out cursor-pointer whitespace-nowrap group shrink-0
                  ${isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
                  }
                `}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-500'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
