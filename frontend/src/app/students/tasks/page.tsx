'use client';

import React, { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import TabNavigation from '@/components/ui/TabNavigation';
import { RouteGuard } from '@/components/guards/RouteGuard';
import StudentTasksTab from '@/components/students/tasks/StudentTasksTab';

function StudentTasksPageContent() {
  const router = useRouter();

  return (
    <div className="flex bg-gray-50 h-screen overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header customMappings={{ tasks: 'Quản lý nhiệm vụ HSSV' }} />
        
        <TabNavigation
          tabs={[
            { id: 'Danh sách', label: 'Danh sách' },
            { id: 'Ghi nhận', label: 'Ghi nhận' },
            { id: 'Nhiệm vụ', label: 'Nhiệm vụ' },
          ]}
          activeTab="Nhiệm vụ"
          onTabChange={(id) => {
            if (id === 'Danh sách') {
              router.push('/students');
            } else if (id === 'Ghi nhận') {
              router.push('/students/record');
            }
          }}
        />
        
        <main className="flex-1 p-3 md:p-4 overflow-hidden flex flex-col bg-gray-50 relative">
          <StudentTasksTab />
        </main>
      </div>
    </div>
  );
}

export default function StudentTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-400">
          Đang tải trang quản lý nhiệm vụ...
        </div>
      }
    >
      <RouteGuard requiredPermission="STUDENT_PAGE">
        <StudentTasksPageContent />
      </RouteGuard>
    </Suspense>
  );
}
