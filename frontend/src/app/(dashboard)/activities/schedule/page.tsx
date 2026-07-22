'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import ActivityScheduleWorkspace from '@/components/activities/ActivityScheduleWorkspace';
import { useAuth, isAdminUser } from '@/providers/auth-provider';
import { isTeacherRole } from '@/utils/role.util';


export default function ActivitiesSchedulePage() {
  const searchParams = useSearchParams();
  const activityId = searchParams.get('activityId') || '';
  const { user } = useAuth();
  
  const isAdminOrAdvisor = isAdminUser(user) || isTeacherRole(user);

  return (
    <div className="p-4 sm:p-5 space-y-3 overflow-y-auto h-full custom-scrollbar">


      <ActivityScheduleWorkspace
        initialActivityId={activityId}
        openCreateOnLoad={searchParams.get('openCreate') === '1'}
        isAdminOrAdvisor={isAdminOrAdvisor}
        activityType={searchParams.get('activityType') || ''}
      />
    </div>
  );
}
