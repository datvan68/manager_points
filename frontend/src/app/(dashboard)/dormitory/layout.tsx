'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import TabNavigation from '@/components/ui/TabNavigation';
import { useAuth } from '@/providers/auth-provider';

const baseDormitoryTabs = [
  { id: 'overview', href: '/dormitory/overview', label: 'Tổng quan' },
  { id: 'registrations', href: '/dormitory/roster', label: 'Danh sách' },
  { id: 'buildings', href: '/dormitory/buildings', label: 'Phòng' },
  { id: 'invoices', href: '/dormitory/invoices', label: 'Hóa đơn' },
];

export default function DormitoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasPermission } = useAuth();

  const tabs = useMemo(() => {
    if (hasPermission('PDF_TEMPLATE_READ')) {
      return [...baseDormitoryTabs, { id: 'pdf-template', href: '/dormitory/pdf-template', label: 'PDF' }];
    }
    return baseDormitoryTabs;
  }, [hasPermission]);

  const activeTab = pathname?.startsWith('/dormitory/roster')
    ? 'registrations'
    : pathname?.startsWith('/dormitory/pdf-template')
    ? 'pdf-template'
    : tabs.find((tab) => pathname?.startsWith(tab.href))?.id || 'overview';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => {
          const tab = tabs.find((item) => item.id === id);
          if (tab) router.push(tab.href);
        }}
      />
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === 'registrations' || activeTab === 'buildings' || activeTab === 'pdf-template' || activeTab === 'invoices' ? (
          children
        ) : (
          <div className="h-full overflow-y-auto px-2.5 sm:px-4 py-3">{children}</div>
        )}
      </div>
    </div>
  );
}
