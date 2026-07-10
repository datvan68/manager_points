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
    <div className="p-6 space-y-6">


      <ActivityScheduleWorkspace
        initialActivityId={activityId}
        openCreateOnLoad={searchParams.get('openCreate') === '1'}
        isAdminOrAdvisor={isAdminOrAdvisor}
      />
    </div>
  );
}
