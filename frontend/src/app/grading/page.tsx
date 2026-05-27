'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';
import {
  Search,
  SquarePen
} from 'lucide-react';
import { motion } from 'framer-motion';
import { mockStudents, classes } from '../../lib/mock-data/students';
import { Skeleton } from '@/components/ui/skeleton';
import TabNavigation from '@/components/ui/TabNavigation';
import { CustomPagination } from '@/components/ui/pagination';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { departmentApi } from '../../api/department-api';
import { classApi } from '../../api/class-api';


export default function GradingPage() {
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [isTableLoading, setIsTableLoading] = useState<boolean>(false);

  // States cho Khoa và Lớp tải từ API
  const [apiDepartments, setApiDepartments] = useState<any[]>([]);
  const [apiClasses, setApiClasses] = useState<any[]>([]);

  // Hàm tải dữ liệu từ database thông qua API
  const fetchData = async () => {
    try {
      setIsFetching(true);
      const [backendDepts, backendClasses] = await Promise.all([
        departmentApi.getDepartments(),
        classApi.getClasses()
      ]);

      setApiDepartments(backendDepts || []);
      setApiClasses(backendClasses || []);

    } catch (error: any) {
      toast.error('Lỗi khi tải dữ liệu từ database: ' + error.message);
    } finally {
      setIsInitialLoading(false);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConfirmFilter = () => {
    setIsTableLoading(true);
    setTimeout(() => {
      setIsTableLoading(false);
      toast.success('Đã cập nhật danh sách sinh viên theo bộ lọc!');
    }, 600);
  };

  const pageSize = 10;

  const filteredStudents = mockStudents.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.id.includes(searchTerm)
  );

  const getRank = (score: number) => {
    if (score === 0) return { label: 'Chưa xếp loại', color: 'bg-slate-100 text-slate-500 border-slate-200/50' };
    if (score >= 90) return { label: 'Xuất sắc', color: 'bg-amber-50 text-amber-700 border-amber-200/60' };
    if (score >= 80) return { label: 'Tốt', color: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' };
    if (score >= 70) return { label: 'Khá', color: 'bg-blue-50 text-blue-700 border-blue-200/60' };
    if (score >= 50) return { label: 'Trung bình', color: 'bg-purple-50 text-purple-700 border-purple-200/60' };
    return { label: 'Yếu', color: 'bg-rose-50 text-rose-700 border-rose-200/60' };
  };

  return (
    <>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.25);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.4);
        }
      `}</style>
      <div className="flex h-screen bg-[#f6f7f8] font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header />

          <TabNavigation
            tabs={[
              { id: 'list', label: 'Danh sách' },
              { id: 'reports', label: 'Danh mục' }
            ]}
            activeTab={'list'}
            onTabChange={(id) => {
              if (id === 'reports') {
                router.push('/grading/categories');
              }
            }}
          />

          <main className="flex-1 p-4 flex flex-col gap-3 max-w-[1440px] mx-auto w-full overflow-hidden">
            {/* Filters Section Container */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-[#E5E7EB] rounded-2xl px-4 flex gap-3 items-center shrink-0 h-[68px] shadow-sm"
            >
              <div className="flex-1 relative">

                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Tìm kiếm tên sinh viên hoặc MSSV..."
                  className="w-full bg-[#F3F4F6] border-none rounded-xl pl-10 pr-4 py-2.5 text-[14px] font-medium placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Select Khoa */}
              <div className="shrink-0 min-w-[180px]">
                <Select
                  value={selectedDepartment}
                  onValueChange={(val: string) => { setSelectedDepartment(val); setSelectedClass(''); }}
                >
                  <SelectTrigger className="h-[42px] bg-[#F3F4F6] border-none rounded-xl text-[13px] font-medium text-slate-700 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-none">
                    <SelectValue placeholder="Tất cả khoa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tất cả khoa</SelectItem>
                    {apiDepartments.map(dept => (
                      <SelectItem key={dept._id} value={dept._id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Select Lớp */}
              <div className="shrink-0 min-w-[160px]">
                <Select
                  value={selectedClass}
                  onValueChange={(val: string) => setSelectedClass(val)}
                >
                  <SelectTrigger
                    className={`h-[42px] bg-[#F3F4F6] border-none rounded-xl text-[13px] font-medium text-slate-700 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-none ${!selectedDepartment ? "pointer-events-none opacity-50 bg-slate-100/80 text-slate-400" : ""
                      }`}
                  >
                    <SelectValue placeholder={selectedDepartment ? "Chọn lớp" : "Chọn khoa trước"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-- Không chọn --</SelectItem>
                    {(selectedDepartment
                      ? apiClasses.filter(cls => {
                        const deptId = typeof cls.dept_id === 'object' ? cls.dept_id?._id : cls.dept_id;
                        return deptId === selectedDepartment;
                      })
                      : apiClasses
                    ).map(cls => (
                      <SelectItem key={cls._id} value={cls._id}>{cls.class_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleConfirmFilter}>
                Xác nhận
              </Button>
            </motion.div>

            {/* Tab Danh sách */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white border border-[#f1f5f9] rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0"
            >
              <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-[#f8fafc] shadow-[0_1px_0_0_#f1f5f9]">
                    <tr>
                      <th className="px-6 py-4 text-left w-16">
                        <div className="flex items-center">
                          <input type="checkbox" className="rounded border-[#cbd5e1] text-[#137fec] focus:ring-[#137fec]" />
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Mã sinh viên</th>
                      <th className="px-6 py-4 text-left text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Tên</th>
                      <th className="px-6 py-4 text-left text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Lớp</th>
                      <th className="px-6 py-4 text-center text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Tổng điểm</th>
                      <th className="px-6 py-4 text-center text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Xếp loại</th>
                      <th className="px-6 py-4 text-right text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9] relative">
                    {isInitialLoading || isTableLoading ? (
                      Array.from({ length: 8 }).map((_, idx) => (
                        <tr key={`skeleton-${idx}`}>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-4 rounded" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-24 rounded" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-32 rounded" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-20 rounded" /></td>
                          <td className="px-6 py-4 text-center"><Skeleton className="h-6 w-16 rounded-full mx-auto" /></td>
                          <td className="px-6 py-4 text-center"><Skeleton className="h-6 w-16 rounded-full mx-auto" /></td>
                          <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-8 rounded-full ml-auto" /></td>
                        </tr>
                      ))
                    ) : (
                      <>
                        {filteredStudents
                          .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                          .map((student) => {
                            const rank = getRank(student.score);
                            const className = apiClasses.find(c => c._id === student.classId)?.class_name || classes.find(c => c.id === student.classId)?.name || student.classId;

                            return (
                              <motion.tr
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                key={student.id}
                                className="hover:bg-slate-50 transition-colors group cursor-pointer"
                              >
                                <td className="px-6 py-4">
                                  <input type="checkbox" className="rounded border-[#cbd5e1] text-[#137fec] focus:ring-[#137fec]" />
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-[#475569]">{student.id}</td>
                                <td className="px-6 py-4 text-sm font-bold text-[#0f172a]">{student.name}</td>
                                <td className="px-6 py-4 text-sm text-[#475569]">{className}</td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`inline-flex items-center justify-center px-3 py-1 border rounded-full text-[13px] font-semibold ${rank.color}`}>
                                    {student.score}/100
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`px-3 py-1 border rounded-full text-[11px] font-bold uppercase tracking-tight ${rank.color}`}>
                                    {rank.label}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button className="w-8 h-8 rounded-full flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 transition-all active:scale-95 ml-auto">
                                    <SquarePen size={15} />
                                  </button>
                                </td>
                              </motion.tr>
                            );
                          })
                        }
                        {isFetching && (
                          <tr className="absolute inset-0 bg-white/40 backdrop-blur-[0.5px] z-20 pointer-events-none">
                            <td colSpan={7} className="h-full w-full p-0">
                              <div className="w-full h-full animate-pulse bg-gradient-to-r from-transparent via-slate-100/50 to-transparent" />
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <CustomPagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={filteredStudents.length}
                onPageChange={(page) => {
                  setIsFetching(true);
                  setTimeout(() => {
                    setCurrentPage(page);
                    setIsFetching(false);
                  }, 400);
                }}
                label="sinh viên"
                isLoading={isFetching}
              />
            </motion.div>
          </main>
        </div>
      </div>
    </>
  );
}
