'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TabNavigation from '@/components/ui/TabNavigation';
import { RouteGuard, usePermission } from '@/components/guards/RouteGuard';
import { useAuth } from '@/providers/auth-provider';
import { HeaderCustomMappings } from '@/providers/header-provider';
import StudentTasksTab from '@/components/students/tasks/StudentTasksTab';
import StudentTaskProgressTab from '@/components/students/tasks/StudentTaskProgressTab';
import { isTeacherRole } from '@/utils/role.util';
import { BarChart3 } from 'lucide-react';

function StudentTasksPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [internalTab, setInternalTab] = useState<'tasks' | 'progress'>('tasks');
  const [hasOpenedProgressTab, setHasOpenedProgressTab] = useState(false);
  const [showTaskStats, setShowTaskStats] = useState(false);
  const [showProgressStats, setShowProgressStats] = useState(false);

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
            <div className="flex items-center gap-2 mb-3 w-full shrink-0">
              <div className="flex items-center gap-1 p-1 bg-white/40 backdrop-blur-md border border-white/70 rounded-xl shadow-xs shrink-0 h-9 w-fit">
                <button
                  type="button"
                  onClick={() => setInternalTab('tasks')}
                  className={`flex items-center justify-center text-center px-4 h-7 text-xs rounded-lg transition-all duration-150 ease-out outline-none focus:outline-none select-none cursor-pointer whitespace-nowrap shrink-0 ${
                    internalTab === 'tasks'
                      ? 'bg-white text-slate-800 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
                  }`}
                >
                  <span className="whitespace-nowrap">Nhiệm vụ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInternalTab('progress')}
                  className={`flex items-center justify-center text-center px-4 h-7 text-xs rounded-lg transition-all duration-150 ease-out outline-none focus:outline-none select-none cursor-pointer whitespace-nowrap shrink-0 ${
                    internalTab === 'progress'
                      ? 'bg-white text-slate-800 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
                  }`}
                >
                  <span className="whitespace-nowrap">Theo dõi</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => internalTab === 'tasks' ? setShowTaskStats(v => !v) : setShowProgressStats(v => !v)}
                aria-label="Bật hoặc tắt thống kê nhanh"
                title="Thống kê nhanh"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border backdrop-blur-md transition-all duration-150 ease-out cursor-pointer shadow-xs ${
                  (internalTab === 'tasks' ? showTaskStats : showProgressStats)
                    ? 'bg-white border-[#1A73E8] text-[#1A73E8]'
                    : 'bg-white/40 border-white/70 text-[#64748B] hover:bg-white/60 hover:text-slate-900'
                }`}
              >
                <BarChart3 size={16} />
              </button>
            </div>
          )}

          <div className={internalTab === 'tasks' ? 'contents' : 'hidden'}>
            <StudentTasksTab showStats={showTaskStats} />
          </div>
          {canViewProgress && hasOpenedProgressTab && (
            <div className={internalTab === 'progress' ? 'contents' : 'hidden'}>
              <StudentTaskProgressTab showStats={showProgressStats} />
            </div>
          )}
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
