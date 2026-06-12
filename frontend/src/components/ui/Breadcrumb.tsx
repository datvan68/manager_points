'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { departments, classes, mockStudents } from '@/lib/mock-data/students';
import { useAuth } from '@/providers/auth-provider';

interface BreadcrumbProps {
  customMappings?: Record<string, string>;
}

export default function Breadcrumb({ customMappings = {} }: BreadcrumbProps) {
  const { user } = useAuth();
  const role = (user?.role || user?.roleName || '').toLowerCase();
  const isStudent = role.includes('student') || role.includes('sinh vien') || role.includes('hoc sinh') || role.includes('học sinh') || role.includes('sinh viên');
  const pathname = usePathname();
  const params = useParams();

  const pathSegments = pathname.split('/').filter(segment => segment !== '');

  // Helper to get human-readable labels for IDs
  const getLabel = (segment: string) => {
    // Check custom mappings first
    if (customMappings[segment]) return customMappings[segment];

    // Check classId
    if (params && params.classId === segment) {
      const cls = classes.find(c => c.id === segment);
      return cls ? cls.name : segment;
    }

    // Check student id
    if (params && params.id === segment) {
      const student = mockStudents.find(s => s.id === segment);
      return student ? student.name : segment;
    }

    // Static mappings
    const staticLabels: Record<string, string> = {
      'students': 'Quản lý sinh viên',
      'tasks': 'Công việc',
      'grading': 'Rèn luyện',
      'dormitory': 'Quản lý KTX',
      'reports': 'Thống kê báo cáo',
      'permissions': 'Phân quyền',
      'club': 'Câu lạc bộ',
      'score': 'Chấm điểm',
      'categories': 'Danh mục',
    };

    return staticLabels[segment] || segment;
  };

  if (pathname === '/') return null;

  return (
    <nav className="flex items-center text-sm font-medium" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        <li>
          <Link
            href="/"
            className="text-gray-400 hover:text-[#135bec] transition-colors flex items-center gap-1.5"
          >
            <Home size={16} />
            <span className="hidden sm:inline">Trang chủ</span>
          </Link>
        </li>

        {pathSegments.map((segment, index) => {
          const originalHref = `/${pathSegments.slice(0, index + 1).join('/')}`;
          let targetHref = originalHref;
          if (originalHref === '/students' && isStudent) {
            targetHref = '/students/tasks';
          }
          const isLast = index === pathSegments.length - 1;
          const label = getLabel(segment);
          const itemKey = `${index}-${segment}-${originalHref}`;

          return (
            <li key={itemKey} className="flex items-center space-x-2">
              <ChevronRight size={14} className="text-gray-300 shrink-0" />
              {isLast ? (
                <span className="text-gray-900 font-bold truncate max-w-[150px] sm:max-w-[200px]">
                  {label}
                </span>
              ) : (
                <Link
                  href={targetHref}
                  className="text-gray-500 hover:text-[#135bec] transition-colors truncate max-w-[120px] sm:max-w-[150px]"
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
