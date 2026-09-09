'use client';

import React, { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import TabNavigation from '@/components/ui/TabNavigation';
import { RouteGuard } from '@/components/guards/RouteGuard';
import { useAuth } from '@/providers/auth-provider';
import { HeaderCustomMappings } from '@/providers/header-provider';
import StudentTasksTab from '@/components/students/tasks/StudentTasksTab';
import { isTeacherRole } from '@/utils/role.util';

function StudentTasksPageContent() {
  const router = useRouter();
  const { user, hasPermission = () => false } = useAuth();
  const userRole = String(user?.role || '').toLowerCase();
  const isStudent = userRole.includes('student') || userRole.includes('học sinh') || userRole.includes('sinh viên');

  return (
    <>
      <HeaderCustomMappings mappings={{ tasks: 'Quản lý nhiệm vụ HSSV' }} />
        
        <TabNavigation
          tabs={
            isStudent
              ? [
                  { id: 'Ghi nhận', label: 'Ghi nhận' },
                  { id: 'Nhiệm vụ', label: 'Nhiệm vụ' },
                ]
              : [
                  { id: 'Ghi nhận', label: 'Ghi nhận' },
                  { id: 'Danh sách', label: 'Danh sách' },
                  { id: 'Nhiệm vụ', label: 'Nhiệm vụ' },
                ].filter((tab) => tab.id === 'Nhiệm vụ' || (tab.id === 'Ghi nhận' ? hasPermission('READ_STUDENT_RECORD') : hasPermission('STUDENT_PAGE')))
          }
          activeTab="Nhiệm vụ"
          onTabChange={(id) => {
            if (id === 'Danh sách') {
              router.push('/students');
            } else if (id === 'Ghi nhận') {
              router.push('/students/record');
            }
          }}
        />
        
        <main className="flex-1 p-3 md:p-4 overflow-hidden flex flex-col bg-transparent relative">
          <StudentTasksTab />
        </main>
    </>
  );
}

export default function StudentTasksPage() {
  const { user } = useAuth();
  const userRole = String(user?.role || '').toLowerCase();
  const isStudent = userRole.includes('student') || userRole.includes('học sinh') || userRole.includes('sinh viên');
  const bypassGuard = isStudent || isTeacherRole(user);

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] text-[#64748B]">
          Đang tải trang quản lý nhiệm vụ...
        </div>
      }
    >
      {bypassGuard ? (
        <RouteGuard>
          <StudentTasksPageContent />
        </RouteGuard>
      ) : (
        <RouteGuard anyPermission={["STUDENT_PAGE", "READ_STUDENT_TASK"]}>
          <StudentTasksPageContent />
        </RouteGuard>
      )}
    </Suspense>
  );
}
