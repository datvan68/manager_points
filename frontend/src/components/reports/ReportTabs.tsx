'use client';

import React from 'react';
import { 
  LayoutDashboard, Users, Award, FileText, Calendar, CheckSquare, Settings 
} from 'lucide-react';

export type ReportTabType = 'overview' | 'student' | 'score' | 'record' | 'attendance' | 'task' | 'system';

interface ReportTabsProps {
  activeTab: ReportTabType;
  onChange: (tab: ReportTabType) => void;
  counts?: Record<string, number>;
  showSystemTab?: boolean;
}

interface TabItem {
  id: ReportTabType;
  label: string;
  icon: React.ComponentType<any>;
}

export default function ReportTabs({
  activeTab,
  onChange,
  counts = {},
  showSystemTab = true
}: ReportTabsProps) {
  const tabs: TabItem[] = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'student', label: 'Sinh viên', icon: Users },
    { id: 'score', label: 'Điểm rèn luyện', icon: Award },
    { id: 'record', label: 'Ghi nhận rèn luyện', icon: FileText },
    { id: 'attendance', label: 'Chuyên cần', icon: Calendar },
    { id: 'task', label: 'Nhiệm vụ', icon: CheckSquare }
  ];

  if (showSystemTab) {
    tabs.push({ id: 'system', label: 'Hệ thống & Logs', icon: Settings });
  }

  return (
    <div className="mx-6 mt-6 border-b border-slate-200">
      <div className="flex flex-wrap -mb-px gap-1 overflow-x-auto custom-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = counts[tab.id];

          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-[13px] font-bold border-b-2 transition-all duration-200 cursor-pointer whitespace-nowrap outline-none ${
                isActive
                  ? 'border-blue-600 text-blue-600 scale-[1.01]'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {count !== undefined && count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-all duration-200 ${
                  isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
