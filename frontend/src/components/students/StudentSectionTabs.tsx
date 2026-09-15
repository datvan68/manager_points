'use client';

import { useRouter } from 'next/navigation';
import TabNavigation from '@/components/ui/TabNavigation';
import { useAuth } from '@/providers/auth-provider';

export type StudentSectionTab = 'Ghi nhận' | 'Danh sách' | 'Nhiệm vụ' | 'Thời khóa biểu';

interface StudentSectionTabsProps {
  activeTab: StudentSectionTab;
}

export default function StudentSectionTabs({ activeTab }: StudentSectionTabsProps) {
  const router = useRouter();
  const { user, hasPermission = () => false } = useAuth();
  const userRole = String(user?.role || '').toLowerCase();
  const isStudent = userRole.includes('student') || userRole.includes('học sinh') || userRole.includes('sinh viên');

  const studentTabs = isStudent
    ? [
        { id: 'Ghi nhận', label: 'Ghi nhận' },
        { id: 'Nhiệm vụ', label: 'Nhiệm vụ' },
      ]
    : [
        { id: 'Ghi nhận', label: 'Ghi nhận' },
        { id: 'Danh sách', label: 'Danh sách' },
        { id: 'Nhiệm vụ', label: 'Nhiệm vụ' },
      ].filter((tab) =>
        tab.id === activeTab || (tab.id === 'Ghi nhận'
          ? hasPermission('READ_STUDENT_RECORD')
          : tab.id === 'Danh sách'
            ? hasPermission('STUDENT_PAGE')
            : hasPermission('READ_STUDENT_TASK')),
      );
  const tabs = [...studentTabs, { id: 'Thời khóa biểu', label: 'Thời khóa biểu' }]
    .filter((tab) => tab.id === activeTab || tab.id !== 'Thời khóa biểu' || hasPermission('TIMETABLE_PAGE'));

  return (
    <TabNavigation
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => {
        if (id === 'Ghi nhận') router.push('/students/record');
        if (id === 'Danh sách') router.push('/students');
        if (id === 'Nhiệm vụ') router.push('/students/tasks');
        if (id === 'Thời khóa biểu') router.push('/timetable');
      }}
    />
  );
}
