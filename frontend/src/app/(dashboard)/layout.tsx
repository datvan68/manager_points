'use client';

import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { HeaderProvider } from '@/providers/header-provider';
import { MaintenanceGuard } from '@/components/guards/MaintenanceGuard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HeaderProvider>
      <div className="dashboard-shell flex bg-[linear-gradient(135deg,#EBF2FA_0%,#DCE6F1_100%)] h-screen min-h-0 supports-[height:100dvh]:h-[100dvh] overflow-hidden font-sans text-[#1E293B] isolate">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden relative">
          <Header />
          <MaintenanceGuard>
            {children}
          </MaintenanceGuard>
        </div>
      </div>
    </HeaderProvider>
  );
}

