'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';

interface BreadcrumbProps {
  customMappings?: Record<string, string>;
}

export default function Breadcrumb({ customMappings = {} }: BreadcrumbProps) {
  const { user } = useAuth();
  const role = (user?.role || user?.roleName || '').toLowerCase();
  const isStudent = role.includes('student') || role.includes('sinh vien') || role.includes('hoc sinh') || role.includes('học sinh') || role.includes('sinh viên');
  const pathname = usePathname();

  const pathSegments = React.useMemo(() => pathname.split('/').filter(segment => segment !== ''), [pathname]);

  const items = React.useMemo(() => {
    if (pathname.startsWith('/dormitory/pdf-template')) {
      const isEdit = pathname.endsWith('/edit');
      const isNew = pathname.includes('/pdf-template/new');
      if (isEdit) {
        return [
          { label: 'Quản lý KTX', href: '/dormitory', isLast: false },
          { label: 'PDF', href: '/dormitory/pdf-template', isLast: false },
          { label: 'Sửa mẫu', href: pathname, isLast: true },
        ];
      }
      if (isNew) {
        return [
          { label: 'Quản lý KTX', href: '/dormitory', isLast: false },
          { label: 'PDF', href: '/dormitory/pdf-template', isLast: false },
          { label: 'Thêm mẫu', href: '/dormitory/pdf-template/new', isLast: true },
        ];
      }
      if (pathname === '/dormitory/pdf-template') {
        return [
          { label: 'Quản lý KTX', href: '/dormitory', isLast: false },
          { label: 'PDF', href: '/dormitory/pdf-template', isLast: true },
        ];
      }
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
      'pdf-template': 'PDF',
    };

    const getLabel = (segment: string) => {
      if (customMappings[segment]) return customMappings[segment];
      return staticLabels[segment] || segment;
    };

    return pathSegments.map((segment, index) => {
      const originalHref = `/${pathSegments.slice(0, index + 1).join('/')}`;
      let targetHref = originalHref;
      if (originalHref === '/students' && isStudent) {
        targetHref = '/students/tasks';
      }
      const isLast = index === pathSegments.length - 1;
      const label = getLabel(segment);
      return {
        label,
        href: targetHref,
        isLast,
      };
    });
  }, [pathname, customMappings, isStudent, pathSegments]);

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

        {items.map((item, index) => {
          const itemKey = `${index}-${item.href}-${item.label}`;

          return (
            <li key={itemKey} className="flex items-center space-x-2">
              <ChevronRight size={14} className="text-gray-300 shrink-0" />
              {item.isLast ? (
                <span className="text-gray-900 font-bold truncate max-w-[150px] sm:max-w-[200px] lg:max-w-none lg:overflow-visible lg:whitespace-nowrap">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-gray-500 hover:text-[#135bec] transition-colors truncate max-w-[120px] sm:max-w-[150px] lg:max-w-none lg:overflow-visible lg:whitespace-nowrap"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
