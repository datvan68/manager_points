'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  ChevronLeft, 
  ChevronRight,
  MoreVertical,
  Settings,
  ListFilter,
  Pencil,
  Trash2,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { mockStudents, classes } from '../../lib/mock-data/students';
import { Skeleton } from '@/components/ui/skeleton';
import TabNavigation from '@/components/ui/TabNavigation';
import { CustomPagination } from '@/components/ui/pagination';
import CategoryModal from '../../components/grading/CategoryModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { toast } from 'sonner';

const mockConfigCategories = [
  { id: 'DM001', name: 'Chuyên cần', description: 'Đánh giá việc tham gia các buổi học và hoạt động', maxPoints: 10, criteriaCount: 3, status: true },
  { id: 'DM002', name: 'Thái độ học tập', description: 'Đánh giá sự tương tác và đóng góp trong lớp', maxPoints: 20, criteriaCount: 5, status: true },
  { id: 'DM003', name: 'Hoạt động ngoại khóa', description: 'Tham gia các CLB, đội nhóm và sự kiện trường', maxPoints: 15, criteriaCount: 4, status: false },
  { id: 'DM004', name: 'Nghiên cứu khoa học', description: 'Các đề tài nghiên cứu và giải thưởng cấp trường/tỉnh', maxPoints: 20, criteriaCount: 2, status: true },
  { id: 'DM005', name: 'Khen thưởng/Kỷ luật', description: 'Cộng/trừ điểm dựa trên thành tích hoặc vi phạm', maxPoints: 35, criteriaCount: 6, status: true }
];

export default function GradingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [configCurrentPage, setConfigCurrentPage] = useState(1);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);
  const pageSize = 10;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const filteredStudents = mockStudents.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.id.includes(searchTerm)
  );

  const getRank = (score: number) => {
    if (score >= 90) return { label: 'Xuất sắc', color: 'bg-purple-100 text-purple-700' };
    if (score >= 80) return { label: 'Tốt', color: 'bg-green-100 text-green-700' };
    if (score >= 65) return { label: 'Khá', color: 'bg-blue-100 text-blue-700' };
    if (score >= 50) return { label: 'Trung bình', color: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Yếu', color: 'bg-red-100 text-red-700' };
  };

  return (
    <div className="flex h-screen bg-[#f6f7f8] font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header />
        
        <TabNavigation 
          tabs={[
            { id: 'list', label: 'Danh sách' },
            { id: 'reports', type: 'select-option' , label: 'Cấu hình', 
              options: [
                { id: 'category', label: 'Cấu hình danh mục' },
                { id: 'criteria', label: 'Cấu hình tiêu chí' },
              ]
             }
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id)}
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
                placeholder={activeTab === 'list' ? "Tìm kiếm tên sinh viên hoặc MSSV..." : activeTab === 'category' ? "Tìm kiếm tên danh mục..." : "Tìm kiếm tiêu chí..."}
                className="w-full bg-[#F3F4F6] border-none rounded-xl pl-10 pr-4 py-2.5 text-[14px] font-medium placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <button className="h-[40px] w-[40px] flex items-center justify-center bg-[#F3F4F6] text-[#64748b] hover:bg-[#E5E7EB] hover:text-slate-900 rounded-xl transition-all shadow-sm active:scale-95 group shrink-0">
              <Settings size={18} className="group-hover:rotate-45 transition-transform duration-300" />
            </button>

            <button className="bg-[#137fec] hover:bg-blue-700 text-white px-5 h-[40px] rounded-xl flex items-center gap-2 font-bold text-[13px] transition-all shadow-sm active:scale-95 shrink-0">
              <Filter size={16} strokeWidth={2.5} />
              Lọc dữ liệu
            </button>

            {(activeTab === 'reports' || activeTab === 'category' || activeTab === 'criteria') && (
              <button 
                onClick={() => {
                  setIsEditing(false);
                  setSelectedCategory(null);
                  setIsModalOpen(true);
                }}
                className="bg-[#1D4ED8] hover:bg-blue-800 text-white px-5 h-[40px] rounded-xl flex items-center gap-2 font-bold text-[13px] transition-all shadow-sm active:scale-95 shrink-0"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>Thêm</span>
              </button>
            )}
          </motion.div>

          {activeTab === 'list' ? (
            /* Tab Danh sách */
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
                    {isInitialLoading ? (
                      Array.from({ length: 8 }).map((_, idx) => (
                        <tr key={`skeleton-${idx}`}>
                          <td className="px-6 py-4"><div className="h-4 w-4 bg-slate-100 animate-pulse rounded" /></td>
                          <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 animate-pulse rounded" /></td>
                          <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-100 animate-pulse rounded" /></td>
                          <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-100 animate-pulse rounded" /></td>
                          <td className="px-6 py-4 text-center"><div className="h-4 w-12 bg-slate-100 animate-pulse rounded mx-auto" /></td>
                          <td className="px-6 py-4 text-center"><div className="h-6 w-16 bg-slate-100 animate-pulse rounded-full mx-auto" /></td>
                          <td className="px-6 py-4 text-right"><div className="h-4 w-8 bg-slate-100 animate-pulse rounded ml-auto" /></td>
                        </tr>
                      ))
                    ) : (
                      <>
                        {filteredStudents
                          .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                          .map((student) => {
                            const rank = getRank(student.score);
                            const className = classes.find(c => c.id === student.classId)?.name || student.classId;
                            
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
                                <td className="px-6 py-4 text-center text-md font-bold text-[#137fec]">{student.score}</td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-tight ${rank.color}`}>
                                    {rank.label}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-400 hover:text-gray-600">
                                    <MoreHorizontal size={18} />
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
          ) : (activeTab === 'category' || activeTab === 'reports') ? (
            /* Tab Cấu hình danh mục */
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
                      <th className="px-6 py-4 text-left text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Mã danh mục</th>
                      <th className="px-6 py-4 text-left text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Tên danh mục</th>
                      <th className="px-6 py-4 text-left text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Mô tả</th>
                      <th className="px-6 py-4 text-center text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Điểm tối đa</th>
                      <th className="px-6 py-4 text-center text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Tiêu chí</th>
                      <th className="px-6 py-4 text-center text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Trạng thái</th>
                      <th className="px-6 py-4 text-right text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {mockConfigCategories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-slate-50 transition-colors group cursor-pointer h-[72px]">
                        <td className="px-6 py-4">
                          <input type="checkbox" className="rounded border-[#cbd5e1] text-[#137fec] focus:ring-[#137fec]" />
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-[#137fec] hover:underline cursor-pointer">{cat.id}</span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-[#0f172a]">{cat.name}</td>
                        <td className="px-6 py-4 text-sm text-[#64748b] max-w-[280px] truncate">{cat.description}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-blue-50 text-[#137fec] text-[12px] font-bold px-3 py-1 rounded-full border border-blue-100/50">
                            {cat.maxPoints} điểm
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-slate-50 text-slate-600 text-[12px] font-bold px-3 py-1 rounded-full border border-slate-200/50">
                            {cat.criteriaCount} tiêu chí
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer mx-auto ${cat.status ? 'bg-[#137fec]' : 'bg-slate-200'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${cat.status ? 'right-0.5' : 'left-0.5'}`} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => {
                                setIsEditing(true);
                                setSelectedCategory(cat);
                                setIsModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Pencil size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                setCategoryToDelete(cat);
                                setIsDeleteModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <CustomPagination 
                currentPage={configCurrentPage}
                pageSize={5}
                totalItems={mockConfigCategories.length}
                onPageChange={(page) => {
                  setIsFetching(true);
                  setTimeout(() => {
                    setConfigCurrentPage(page);
                    setIsFetching(false);
                  }, 400);
                }}
                label="danh mục"
                isLoading={isFetching}
              />
            </motion.div>
          ) : (
            /* Tab Cấu hình tiêu chí - Placeholder */
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white border border-[#f1f5f9] rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-[400px] items-center justify-center text-slate-400 space-y-4"
            >
              <div className="p-4 bg-slate-50 rounded-full">
                <Settings size={48} strokeWidth={1.5} className="animate-spin-slow" />
              </div>
              <p className="font-medium">Chức năng cấu hình tiêu chí đang được phát triển</p>
            </motion.div>
          )}
        </main>
      </div>

      <CategoryModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isEditing={isEditing}
        initialData={selectedCategory}
        onSave={(data) => {
          console.log('Saving category:', data);
          // In a real app, this would refresh the data
        }}
      />

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          console.log('Deleting category:', categoryToDelete);
          toast.success(`Đã xóa danh mục ${categoryToDelete?.id}`);
          // In a real app, this would trigger the deletion API
        }}
        title="Xác nhận xóa danh mục"
        message={`Bạn có chắc chắn muốn xóa danh mục "${categoryToDelete?.name}"? Hành động này không thể hoàn tác.`}
        variant="danger"
        confirmLabel="Xác nhận xóa"
      />
    </div>
  );
}
