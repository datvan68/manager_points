'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  DoorOpen,
  FileText,
  ClipboardList,
  Receipt,
  AlertTriangle,
  Wrench,
  BarChart3,
  LayoutDashboard,
} from 'lucide-react';

const dormitoryTabs = [
  { href: '/dormitory/registrations', label: 'Đăng ký', icon: ClipboardList },
  { href: '/dormitory/overview', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/dormitory/buildings', label: 'Khu vực & Phòng', icon: Building2 },
  { href: '/dormitory/contracts', label: 'Hợp đồng', icon: FileText },
  { href: '/dormitory/invoices', label: 'Hóa đơn', icon: Receipt },
  { href: '/dormitory/violations', label: 'Vi phạm', icon: AlertTriangle },
  { href: '/dormitory/maintenance', label: 'Bảo trì', icon: Wrench },
  { href: '/dormitory/reports', label: 'Báo cáo', icon: BarChart3 },
];

export default function DormitoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab Navigation */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-gray-200/50 px-4 flex-shrink-0">
        <nav className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
          {dormitoryTabs.map((tab) => {
            const isActive =
              pathname?.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                  ${isActive
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <Icon size={16} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {children}
      </div>
    </div>
  );
}
