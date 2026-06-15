'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import TabNavigation from '@/components/ui/TabNavigation';
import { RouteGuard, usePermission } from '@/components/guards/RouteGuard';
import { useAuth } from '@/providers/auth-provider';
import StudentTasksTab from '@/components/students/tasks/StudentTasksTab';
import StudentTaskProgressTab from '@/components/students/tasks/StudentTaskProgressTab';

function StudentTasksPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [internalTab, setInternalTab] = useState<'tasks' | 'progress'>('tasks');
  const [hasOpenedProgressTab, setHasOpenedProgressTab] = useState(false);

  useEffect(() => {
    if (internalTab === 'progress') {
      setHasOpenedProgressTab(true);
    }
  }, [internalTab]);

  const taskAccess = usePermission({
    viewTask: "READ_STUDENT_TASK",
  });

  const userRole = String(user?.role || '').toLowerCase();
  const isStudent = userRole.includes('student') || userRole.includes('học sinh') || userRole.includes('sinh viên');
  const canViewProgress = !isStudent && taskAccess.viewTask;

  return (
    <div className="flex bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] h-screen overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header customMappings={{ tasks: 'Quản lý nhiệm vụ HSSV' }} />
        
        <TabNavigation
          tabs={
            isStudent
              ? [
                  { id: 'Ghi nhận', label: 'Ghi nhận' },
                  { id: 'Nhiệm vụ', label: 'Nhiệm vụ' },
                ]
              : [
                  { id: 'Danh sách', label: 'Danh sách' },
                  { id: 'Ghi nhận', label: 'Ghi nhận' },
                  { id: 'Nhiệm vụ', label: 'Nhiệm vụ' },
                ]
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
          {/* Sub-tabs for Navigation inside Tasks */}
          {canViewProgress && (
            <div className="flex items-center gap-2 mb-3 bg-white/40 p-1 rounded-xl w-fit border border-white/70 backdrop-blur-md shrink-0 shadow-sm shadow-slate-300/40">
              <button
                onClick={() => setInternalTab('tasks')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] ${
                  internalTab === 'tasks' 
                    ? 'bg-white text-[#1A73E8] shadow-sm' 
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                Danh sách nhiệm vụ
              </button>
              <button
                onClick={() => setInternalTab('progress')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-xl transition-all duration-150 ease-out hover:scale-[1.01] ${
                  internalTab === 'progress' 
                    ? 'bg-white text-[#1A73E8] shadow-sm' 
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                Theo dõi thực hiện
              </button>
            </div>
          )}

          <div className={internalTab === 'tasks' ? 'contents' : 'hidden'}>
            <StudentTasksTab />
          </div>
          {canViewProgress && hasOpenedProgressTab && (
            <div className={internalTab === 'progress' ? 'contents' : 'hidden'}>
              <StudentTaskProgressTab />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function StudentTasksPage() {
  const { user } = useAuth();
  const userRole = String(user?.role || '').toLowerCase();
  const isStudent = userRole.includes('student') || userRole.includes('học sinh') || userRole.includes('sinh viên');
  const bypassGuard = isStudent;

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] text-[#64748B]">
          Đang tải trang quản lý nhiệm vụ...
        </div>
      }
    >
      {bypassGuard ? (
        <StudentTasksPageContent />
      ) : (
        <RouteGuard anyPermission={["STUDENT_PAGE", "READ_STUDENT_TASK"]}>
          <StudentTasksPageContent />
        </RouteGuard>
      )}
    </Suspense>
  );
}
