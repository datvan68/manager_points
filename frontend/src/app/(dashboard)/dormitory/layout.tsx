'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import TabNavigation from '@/components/ui/TabNavigation';

const dormitoryTabs = [
  { id: 'registrations', href: '/dormitory/registrations', label: 'Đăng ký' },
  { id: 'overview', href: '/dormitory/overview', label: 'Tổng quan' },
  { id: 'buildings', href: '/dormitory/buildings', label: 'Khu vực & Phòng' },
  { id: 'contracts', href: '/dormitory/contracts', label: 'Hợp đồng' },
  { id: 'invoices', href: '/dormitory/invoices', label: 'Hóa đơn' },
  { id: 'violations', href: '/dormitory/violations', label: 'Vi phạm' },
  { id: 'maintenance', href: '/dormitory/maintenance', label: 'Bảo trì' },
  { id: 'reports', href: '/dormitory/reports', label: 'Báo cáo' },
];

export default function DormitoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = dormitoryTabs.find((tab) => pathname?.startsWith(tab.href))?.id || 'registrations';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TabNavigation
        tabs={dormitoryTabs}
        activeTab={activeTab}
        onTabChange={(id) => {
          const tab = dormitoryTabs.find((item) => item.id === id);
          if (tab) router.push(tab.href);
        }}
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
    </div>
  );
}
