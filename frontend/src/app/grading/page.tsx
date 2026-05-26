'use client';

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';
import {
  Search,
  Filter,
  MoreHorizontal,
  Settings,
  Pencil,
  Trash2,
  Plus,
  GripVertical,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { mockStudents, classes } from '../../lib/mock-data/students';
import { Skeleton } from '@/components/ui/skeleton';
import TabNavigation from '@/components/ui/TabNavigation';
import { CustomPagination } from '@/components/ui/pagination';
import CategoryModal from '../../components/grading/CategoryModal';
import CriteriaModal from '../../components/grading/CriteriaModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { toast } from 'sonner';

const initialCategories = [
  { id: 'CAT001', name: 'Ý thức học tập', description: 'Đánh giá việc đi học đầy đủ, phát biểu bài và làm bài tập', maxPoints: 100, status: true, columnId: 'col-1' },
  { id: 'CAT002', name: 'Hoạt động Ngoại khóa', description: 'Tham gia các chiến dịch tình nguyện, hiến máu và sự kiện', maxPoints: 100, status: true, columnId: 'col-1' },
  { id: 'CAT003', name: 'Kỹ năng mềm', description: 'Đánh giá khả năng làm việc nhóm, thuyết trình và giao tiếp', maxPoints: 100, status: true, columnId: 'col-2' },
  { id: 'CAT004', name: 'Thái độ ứng xử', description: 'Đánh giá tinh thần tôn trọng bạn bè, thầy cô và kỷ luật lớp', maxPoints: 100, status: true, columnId: 'col-2' }
];

const initialCriteria = [
  { id: 'CRI001', name: 'Đi học đúng giờ', type: 'khen_thuong', points: 5, minPoints: 0, maxPoints: 10, categoryId: 'CAT001' },
  { id: 'CRI002', name: 'Phát biểu xây dựng bài', type: 'cong_diem', points: 1, minPoints: 0, maxPoints: 10, categoryId: 'CAT001' },
  { id: 'CRI003', name: 'Nghỉ học không phép', type: 'ky_luat', points: -2, minPoints: 0, maxPoints: 10, categoryId: 'CAT001' },
  
  { id: 'CRI004', name: 'Tham gia chiến dịch tình nguyện', type: 'khen_thuong', points: 10, minPoints: 0, maxPoints: 20, categoryId: 'CAT002' },
  { id: 'CRI005', name: 'Tham gia hiến máu nhân đạo', type: 'khen_thuong', points: 15, minPoints: 0, maxPoints: 20, categoryId: 'CAT002' },
  
  { id: 'CRI006', name: 'Làm việc nhóm hiệu quả', type: 'cong_diem', points: 1, minPoints: 0, maxPoints: 5, categoryId: 'CAT003' },
  { id: 'CRI007', name: 'Thuyết trình trước đám đông', type: 'cong_diem', points: 2, minPoints: 0, maxPoints: 5, categoryId: 'CAT003' },
  
  { id: 'CRI008', name: 'Ứng xử văn minh với bạn bè', type: 'cong_diem', points: 5, minPoints: 0, maxPoints: 10, categoryId: 'CAT004' },
  { id: 'CRI009', name: 'Gây mất trật tự trong lớp', type: 'ky_luat', points: -2, minPoints: 0, maxPoints: 10, categoryId: 'CAT004' }
];

export default function GradingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  
  // States cho Category và Criteria
  const [categories, setCategories] = useState<any[]>(initialCategories);
  const [criteria, setCriteria] = useState<any[]>(initialCriteria);

  // States cho Category Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // States cho Criteria Modal
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);
  const [isEditingCriteria, setIsEditingCriteria] = useState(false);
  const [selectedCriteria, setSelectedCriteria] = useState<any>(null);
  const [criteriaToDelete, setCriteriaToDelete] = useState<any>(null);
  const [isDeleteCriteriaModalOpen, setIsDeleteCriteriaModalOpen] = useState(false);
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');

  // States cho việc xóa hàng loạt tiêu chí
  const [isDeleteBulkCriteriaModalOpen, setIsDeleteBulkCriteriaModalOpen] = useState(false);
  const [bulkDeleteCatId, setBulkDeleteCatId] = useState<string>('');
  const [bulkCriteriaToDeleteCount, setBulkCriteriaToDeleteCount] = useState(0);

  // Drag and Drop States
  const [draggingCriteriaId, setDraggingCriteriaId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);

  // States cho việc thu gọn/mở rộng các danh mục
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'CAT001': false,
    'CAT002': false,
    'CAT003': false,
    'CAT004': false
  });

  // Ref để lưu trữ timeout tự động mở rộng khi kéo đè tiêu chí lên danh mục đang thu gọn
  const dragTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Drag and Drop States cho việc kéo thả Category Card
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // States cho Checkbox chọn tiêu chí
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<string[]>([]);

  const isCriteriaSelected = (id: string) => selectedCriteriaIds.includes(id);

  const toggleCriteriaSelection = (id: string) => {
    setSelectedCriteriaIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const isAllCriteriaInCatSelected = (catId: string, catCriteriaList: any[]) => {
    if (catCriteriaList.length === 0) return false;
    return catCriteriaList.every(c => selectedCriteriaIds.includes(c.id));
  };

  const isSomeCriteriaInCatSelected = (catId: string, catCriteriaList: any[]) => {
    if (catCriteriaList.length === 0) return false;
    const selectedCount = catCriteriaList.filter(c => selectedCriteriaIds.includes(c.id)).length;
    return selectedCount > 0 && selectedCount < catCriteriaList.length;
  };

  const toggleSelectAllCriteriaInCat = (catId: string, catCriteriaList: any[]) => {
    const allIds = catCriteriaList.map(c => c.id);
    const allSelected = isAllCriteriaInCatSelected(catId, catCriteriaList);

    if (allSelected) {
      setSelectedCriteriaIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedCriteriaIds(prev => {
        const uniquePrev = prev.filter(id => !allIds.includes(id));
        return [...uniquePrev, ...allIds];
      });
    }
  };

  const handleDeleteSelectedCriteria = (catId: string) => {
    const catCriteriaIds = criteria.filter(c => c.categoryId === catId).map(c => c.id);
    const toDeleteIds = selectedCriteriaIds.filter(id => catCriteriaIds.includes(id));

    if (toDeleteIds.length === 0) return;

    setBulkDeleteCatId(catId);
    setBulkCriteriaToDeleteCount(toDeleteIds.length);
    setIsDeleteBulkCriteriaModalOpen(true);
  };

  const handleConfirmDeleteBulkCriteria = () => {
    if (!bulkDeleteCatId) return;

    const catCriteriaIds = criteria.filter(c => c.categoryId === bulkDeleteCatId).map(c => c.id);
    const toDeleteIds = selectedCriteriaIds.filter(id => catCriteriaIds.includes(id));

    setCriteria(prev => prev.filter(c => !toDeleteIds.includes(c.id)));
    setSelectedCriteriaIds(prev => prev.filter(id => !toDeleteIds.includes(id)));
    
    const catName = categories.find(cat => cat.id === bulkDeleteCatId)?.name || '';
    toast.success(`Đã xóa thành công ${toDeleteIds.length} tiêu chí đã chọn trong danh mục "${catName}"!`);
    
    setIsDeleteBulkCriteriaModalOpen(false);
    setBulkDeleteCatId('');
    setBulkCriteriaToDeleteCount(0);
  };

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const pageSize = 10;

  // Drag and Drop Handlers cho Tiêu chí (Criteria Item)
  const handleDragStart = (e: React.DragEvent, criteriaId: string) => {
    e.stopPropagation(); // Ngăn sự kiện nổi bọt lên Category Card draggable!
    setDraggingCriteriaId(criteriaId);
    e.dataTransfer.setData('criteria-id', criteriaId);
    const target = e.currentTarget as HTMLElement;
    setTimeout(() => {
      target.style.opacity = '0.4';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggingCriteriaId(null);
    setDragOverCategoryId(null);
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
    
    // Clear all drag timeouts
    Object.values(dragTimeoutRef.current).forEach(clearTimeout);
    dragTimeoutRef.current = {};
  };

  const handleDragOver = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault();
    // Chỉ xử lý nếu đang kéo criteria-id (tiêu chí)
    if (e.dataTransfer.types.includes('criteria-id')) {
      if (dragOverCategoryId !== categoryId) {
        setDragOverCategoryId(categoryId);
        
        // Auto-expand danh mục nếu đang thu gọn sau 500ms hover
        if (!expandedCategories[categoryId]) {
          if (dragTimeoutRef.current[categoryId]) {
            clearTimeout(dragTimeoutRef.current[categoryId]);
          }
          dragTimeoutRef.current[categoryId] = setTimeout(() => {
            setExpandedCategories(prev => ({
              ...prev,
              [categoryId]: true
            }));
          }, 500);
        }
      }
    }
    // Nếu kéo category-id (danh mục) để điều chỉnh vị trí
    else if (e.dataTransfer.types.includes('category-id')) {
      if (dragOverCategoryId !== categoryId) {
        setDragOverCategoryId(categoryId);
      }
    }
  };

  const handleDragLeave = (categoryId: string) => {
    setDragOverCategoryId(null);
    if (dragTimeoutRef.current[categoryId]) {
      clearTimeout(dragTimeoutRef.current[categoryId]);
      delete dragTimeoutRef.current[categoryId];
    }
  };

  const handleDrop = (e: React.DragEvent, targetCatId: string) => {
    e.preventDefault();
    e.stopPropagation(); // Ngăn chặn sự kiện nổi bọt lên column drop zone!

    const criteriaId = e.dataTransfer.getData('criteria-id') || draggingCriteriaId;
    const draggedCatId = e.dataTransfer.getData('category-id') || draggingCategoryId;
    
    // Clear timeout for target
    if (dragTimeoutRef.current[targetCatId]) {
      clearTimeout(dragTimeoutRef.current[targetCatId]);
      delete dragTimeoutRef.current[targetCatId];
    }

    // Trường hợp 1: Kéo thả tiêu chí (Criteria) vào danh mục
    if (criteriaId) {
      const draggedItem = criteria.find(c => c.id === criteriaId);
      if (draggedItem) {
        if (draggedItem.categoryId === targetCatId) {
          setDragOverCategoryId(null);
          return;
        }

        const targetCat = categories.find(cat => cat.id === targetCatId);

        setCriteria(prev => 
          prev.map(item => 
            item.id === criteriaId ? { ...item, categoryId: targetCatId } : item
          )
        );

        toast.success(`Đã chuyển tiêu chí "${draggedItem.name}" sang danh mục "${targetCat?.name || ''}"!`);
      }
    }
    // Trường hợp 2: Kéo thả danh mục (Category) đè lên một danh mục khác để thay đổi vị trí
    else if (draggedCatId && draggedCatId !== targetCatId) {
      const draggedCat = categories.find(c => c.id === draggedCatId);
      const targetCat = categories.find(c => c.id === targetCatId);

      if (draggedCat && targetCat) {
        // Lọc bỏ danh mục bị kéo khỏi mảng hiện tại
        const filtered = categories.filter(c => c.id !== draggedCatId);
        // Tìm vị trí của danh mục đích (target) trong mảng đã lọc
        const targetIdx = filtered.findIndex(c => c.id === targetCatId);

        // Cập nhật lại cột của danh mục bị kéo trùng với cột của danh mục đích
        const updatedDraggedCat = { ...draggedCat, columnId: targetCat.columnId };

        // Chèn danh mục bị kéo vào vị trí ngay trước danh mục đích
        const newCategories = [...filtered];
        newCategories.splice(targetIdx, 0, updatedDraggedCat);

        setCategories(newCategories);
        toast.success(`Đã thay đổi thứ tự của danh mục "${draggedCat.name}"!`);
      }
    }
    setDragOverCategoryId(null);
  };

  // Drag and Drop Handlers cho Danh mục (Category Card)
  const handleCategoryDragStart = (e: React.DragEvent, catId: string) => {
    setDraggingCategoryId(catId);
    e.dataTransfer.setData('category-id', catId);
    const target = e.currentTarget as HTMLElement;
    setTimeout(() => {
      target.style.opacity = '0.5';
    }, 0);
  };

  const handleCategoryDragEnd = (e: React.DragEvent) => {
    setDraggingCategoryId(null);
    setDragOverColumnId(null);
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
  };

  const handleColumnDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('category-id')) {
      if (dragOverColumnId !== columnId) {
        setDragOverColumnId(columnId);
      }
    }
  };

  const handleColumnDragLeave = () => {
    setDragOverColumnId(null);
  };

  const handleColumnDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    const catId = e.dataTransfer.getData('category-id') || draggingCategoryId;
    
    if (catId) {
      const draggedCat = categories.find(c => c.id === catId);
      if (draggedCat) {
        if (draggedCat.columnId === targetColId) {
          setDragOverColumnId(null);
          return;
        }

        setCategories(prev => 
          prev.map(cat => 
            cat.id === catId ? { ...cat, columnId: targetColId } : cat
          )
        );

        const colName = targetColId === 'col-1' ? 'Cột danh mục 1' : 'Cột danh mục 2';
        toast.success(`Đã chuyển danh mục "${draggedCat.name}" sang ${colName}!`);
      }
    }
    setDragOverColumnId(null);
  };

  // Thêm/Sửa danh mục
  const handleSaveCategory = (data: any) => {
    if (isEditing && selectedCategory) {
      setCategories(prev => prev.map(c => c.id === selectedCategory.id ? { ...c, ...data } : c));
    } else {
      const newCatId = data.id || `CAT00${categories.length + 1}`;
      const newCat = {
        ...data,
        id: newCatId,
        columnId: 'col-1' // Mặc định thêm vào cột 1
      };
      setCategories(prev => [...prev, newCat]);
      // Tự động mở rộng danh mục mới thêm
      setExpandedCategories(prev => ({
        ...prev,
        [newCatId]: true
      }));
    }
  };

  // Xóa danh mục
  const handleConfirmDeleteCategory = () => {
    if (categoryToDelete) {
      setCategories(prev => prev.filter(c => c.id !== categoryToDelete.id));
      setCriteria(prev => prev.filter(c => c.categoryId !== categoryToDelete.id));
      toast.success(`Đã xóa danh mục "${categoryToDelete.name}" thành công!`);
      setIsDeleteModalOpen(false);
      setCategoryToDelete(null);
    }
  };

  // Thêm/Sửa tiêu chí
  const handleSaveCriteria = (data: any) => {
    if (isEditingCriteria && selectedCriteria) {
      setCriteria(prev => prev.map(c => c.id === selectedCriteria.id ? { ...c, ...data } : c));
    } else {
      setCriteria(prev => [...prev, data]);
    }
  };

  // Xóa tiêu chí
  const handleConfirmDeleteCriteria = () => {
    if (criteriaToDelete) {
      setCriteria(prev => prev.filter(c => c.id !== criteriaToDelete.id));
      toast.success(`Đã xóa tiêu chí "${criteriaToDelete.name}" thành công!`);
      setIsDeleteCriteriaModalOpen(false);
      setCriteriaToDelete(null);
    }
  };

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
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id)}
        />

        <main className="flex-1 p-4 flex flex-col gap-3 max-w-[1440px] mx-auto w-full overflow-hidden">
          {/* Filters Section Container */}
          {activeTab === 'list' && (
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

              <button className="h-[40px] w-[40px] flex items-center justify-center bg-[#F3F4F6] text-[#64748b] hover:bg-[#E5E7EB] hover:text-slate-900 rounded-xl transition-all shadow-sm active:scale-95 group shrink-0">
                <Settings size={18} className="group-hover:rotate-45 transition-transform duration-300" />
              </button>

              <button className="bg-[#137fec] hover:bg-blue-700 text-white px-5 h-[40px] rounded-xl flex items-center gap-2 font-bold text-[13px] transition-all shadow-sm active:scale-95 shrink-0">
                <Filter size={16} strokeWidth={2.5} />
                Lọc dữ liệu
              </button>
            </motion.div>
          )}

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
            /* Tab Cấu hình danh mục - Giao diện kéo thả Kanban cao cấp theo Figma */
            <div className="flex-1 flex flex-col gap-5 min-h-0 overflow-hidden w-full font-sans">
              {/* Header chứa các chỉ số thống kê bento và nút Thêm danh mục đặt chung một hàng flex */}
              <div className="flex items-center justify-between w-full shrink-0 px-1 pt-1 gap-[32px]">
                {/* Stats Row */}
                <div className="flex flex-1 gap-[12px] items-start min-w-px">
                  {/* Tổng số danh mục */}
                  <div className="bg-white border-[#005bbf] border-l-4 border-solid drop-shadow-[0px_2px_4px_rgba(0,0,0,0.04)] flex flex-1 flex-col items-start min-w-px pl-[4px] relative rounded-[8px] w-full" data-node-id="479:2005">
                    <div className="relative shrink-0 w-full">
                      <div className="bg-clip-padding border-0 border-transparent border-solid flex items-center justify-between px-[20px] py-[12px] w-full">
                        <div className="flex flex-col items-start relative shrink-0">
                          <span className="font-sans font-normal text-[#5f6368] text-[11px] tracking-[0.55px] uppercase whitespace-nowrap leading-[16.5px]">
                            TỔNG SỐ DANH MỤC
                          </span>
                        </div>
                        <div className="flex flex-col items-start relative shrink-0">
                          <span className="font-sans font-bold text-[#005bbf] text-[18px] leading-[27px] whitespace-nowrap">
                            {categories.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tiêu chí khen thưởng */}
                  <div className="bg-white border-[#006d2b] border-l-4 border-solid drop-shadow-[0px_2px_4px_rgba(0,0,0,0.04)] flex flex-1 flex-col items-start min-w-px pl-[4px] relative rounded-[8px] w-full" data-node-id="479:2011">
                    <div className="relative shrink-0 w-full">
                      <div className="bg-clip-padding border-0 border-transparent border-solid flex items-center justify-between px-[20px] py-[12px] w-full">
                        <div className="flex flex-col items-start relative shrink-0">
                          <span className="font-sans font-normal text-[#5f6368] text-[11px] tracking-[0.55px] uppercase whitespace-nowrap leading-[16.5px]">
                            TIÊU CHÍ KHEN THƯỞNG
                          </span>
                        </div>
                        <div className="flex flex-col items-start relative shrink-0">
                          <span className="font-sans font-bold text-[#006d2b] text-[18px] leading-[27px] whitespace-nowrap">
                            {criteria.filter(c => c.type === 'khen_thuong' || c.type === 'cong_diem').length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tiêu chí kỷ luật */}
                  <div className="bg-white border-[#ba1a1a] border-l-4 border-solid drop-shadow-[0px_2px_4px_rgba(0,0,0,0.04)] flex flex-1 flex-col items-start min-w-px pl-[4px] relative rounded-[8px] w-full" data-node-id="479:2017">
                    <div className="relative shrink-0 w-full">
                      <div className="bg-clip-padding border-0 border-transparent border-solid flex items-center justify-between px-[20px] py-[12px] w-full">
                        <div className="flex flex-col items-start relative shrink-0">
                          <span className="font-sans font-normal text-[#5f6368] text-[11px] tracking-[0.55px] uppercase whitespace-nowrap leading-[16.5px]">
                            TIÊU CHÍ KỶ LUẬT
                          </span>
                        </div>
                        <div className="flex flex-col items-start relative shrink-0">
                          <span className="font-sans font-bold text-[#ba1a1a] text-[18px] leading-[27px] whitespace-nowrap">
                            {criteria.filter(c => c.type === 'ky_luat').length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Điểm tối đa TB */}
                  <div className="bg-white border-[#f9ab00] border-l-4 border-solid drop-shadow-[0px_2px_4px_rgba(0,0,0,0.04)] flex flex-1 flex-col items-start min-w-px pl-[4px] relative rounded-[8px] w-full" data-node-id="479:2023">
                    <div className="relative shrink-0 w-full">
                      <div className="bg-clip-padding border-0 border-transparent border-solid flex items-center justify-between px-[20px] py-[12px] w-full">
                        <div className="flex flex-col items-start relative shrink-0">
                          <span className="font-sans font-normal text-[#5f6368] text-[11px] tracking-[0.55px] uppercase whitespace-nowrap leading-[16.5px]">
                            ĐIỂM TỐI ĐA TB
                          </span>
                        </div>
                        <div className="flex flex-col items-start relative shrink-0">
                          <span className="font-sans font-bold text-[#f9ab00] text-[18px] leading-[27px] whitespace-nowrap">
                            {categories.length > 0 ? Math.round(categories.reduce((sum, c) => sum + c.maxPoints, 0) / categories.length) : 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nút Thêm danh mục */}
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setSelectedCategory(null);
                    setIsModalOpen(true);
                  }}
                  className="bg-[#135bec] hover:bg-[#004dc7] text-white px-[20px] py-[10px] rounded-[8px] flex items-center justify-center gap-2 font-semibold text-[14px] transition-all shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.3),0px_4px_6px_-4px_rgba(19,91,236,0.3)] hover:shadow-[0px_12px_20px_-3px_rgba(19,91,236,0.4),0px_6px_8px_-4px_rgba(19,91,236,0.4)] active:scale-95 cursor-pointer shrink-0 h-[40px] w-[180px]"
                >
                  <Plus size={16} strokeWidth={2.5} className="shrink-0" />
                  <span>Thêm danh mục</span>
                </button>
              </div>

              {/* Category Columns - Chia 2 cột song song hỗ trợ kéo di chuyển danh mục qua lại */}
              <div className="flex-1 overflow-y-auto pb-6 pr-1">
                <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
                  <div 
                     onDragOver={(e) => handleColumnDragOver(e, 'col-1')}
                     onDragLeave={handleColumnDragLeave}
                     onDrop={(e) => handleColumnDrop(e, 'col-1')}
                     className={`flex-1 flex flex-col gap-4 p-4 rounded-2xl border-2 transition-all duration-300 min-h-[500px] w-full ${dragOverColumnId === 'col-1' ? 'border-dashed border-blue-400 bg-blue-50/20' : 'border-dashed border-slate-200/60 bg-slate-50/10'}`}
                  >
                    {categories.filter(cat => cat.columnId === 'col-1' || !cat.columnId).map((cat, idx) => {
                      const catCriteria = criteria.filter(c => c.categoryId === cat.id);
                      const isOver = dragOverCategoryId === cat.id;
                      const isExpanded = !!expandedCategories[cat.id];
                      const borderColors = ['border-[#1a73e8]', 'border-[#006d2b]', 'border-[#f9ab00]', 'border-[#7b2cbf]'];
                      const bgBadgeColors = ['bg-[#d8e2ff] text-[#005bbf]', 'bg-[#96f8a1]/30 text-[#006d2b]', 'bg-[rgba(249,171,0,0.1)] text-[#f9ab00]', 'bg-[#f3e5f5] text-[#7b2cbf]'];
                      const borderClass = borderColors[idx % borderColors.length];
                      const badgeClass = bgBadgeColors[idx % bgBadgeColors.length];
                      return (
                        <motion.div layout="position" key={cat.id} className={`w-full ${draggingCategoryId === cat.id ? 'opacity-40' : ''}`}>
                          <div draggable onDragStart={(e) => handleCategoryDragStart(e, cat.id)} onDragEnd={handleCategoryDragEnd} onDragOver={(e) => handleDragOver(e, cat.id)} onDragLeave={() => handleDragLeave(cat.id)} onDrop={(e) => handleDrop(e, cat.id)} className={`bg-white border-t-4 ${borderClass} border-solid flex flex-col items-start overflow-hidden pt-1 relative rounded-[16px] shadow-[0px_4px_12px_rgba(0,0,0,0.03)] transition-all duration-300 w-full cursor-grab active:cursor-grabbing hover:shadow-md ${isOver ? 'ring-2 ring-blue-500 scale-[1.01] bg-blue-50/10' : ''}`}>
                            <div className={`border-[#f1f5f9] ${isExpanded ? 'border-b' : ''} border-solid w-full px-5 py-4 flex flex-col gap-2 cursor-pointer select-none hover:bg-slate-50/40 transition-colors`} onClick={() => toggleCategoryExpand(cat.id)}>
                              <div className="flex items-start justify-between w-full">
                                <div className="flex flex-col gap-0.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase inline-block w-fit ${badgeClass}`}>{cat.id}</span>
                                  <h3 className="font-bold text-slate-800 text-[15px] leading-[20px] mt-1">{cat.name}</h3>
                                </div>
                                <div className="flex gap-1 items-center">
                                  <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); setSelectedCategory(cat); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Sửa danh mục"><Pencil size={14} strokeWidth={2.5} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); setCategoryToDelete(cat); setIsDeleteModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Xóa danh mục"><Trash2 size={14} strokeWidth={2.5} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); toggleCategoryExpand(cat.id); }} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer ml-0.5" title={isExpanded ? "Thu gọn" : "Mở rộng"}><motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown size={15} strokeWidth={2.5} /></motion.div></button>
                                </div>
                              </div>
                              <div className="flex gap-4 items-center text-[11px] text-slate-500 font-medium tracking-wide">
                                <div className="flex gap-1 items-center"><span>Điểm tối đa:</span><span className="font-bold text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded">{cat.maxPoints}</span></div>
                                <div className="flex gap-1 items-center"><span>Số tiêu chí:</span><span className="font-bold text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded">{String(catCriteria.length).padStart(2, '0')}</span></div>
                              </div>
                            </div>
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeInOut' }} className="w-full overflow-hidden">
                                  <div className="bg-[#faf9fd]/70 w-full p-5 flex flex-col gap-4">
                                    <div className="flex items-center justify-between w-full">
                                      <div className="flex items-center gap-2 select-none">
                                        <input
                                          type="checkbox"
                                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer hover:border-blue-400 transition-colors"
                                          checked={isAllCriteriaInCatSelected(cat.id, catCriteria)}
                                          ref={(el) => {
                                            if (el) {
                                              el.indeterminate = isSomeCriteriaInCatSelected(cat.id, catCriteria);
                                            }
                                          }}
                                          onChange={() => toggleSelectAllCriteriaInCat(cat.id, catCriteria)}
                                        />
                                        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Danh sách tiêu chí</span>
                                        {catCriteria.some(c => isCriteriaSelected(c.id)) && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteSelectedCriteria(cat.id);
                                            }}
                                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                            title="Xóa các tiêu chí đã chọn"
                                          >
                                            <Trash2 size={14} strokeWidth={2.5} />
                                          </button>
                                        )}
                                      </div>
                                      <button onClick={() => { setIsEditingCriteria(false); setSelectedCriteria(null); setTargetCategoryId(cat.id); setIsCriteriaModalOpen(true); }} className="flex gap-1 items-center text-blue-600 hover:text-blue-700 text-[11px] font-bold hover:underline cursor-pointer transition-colors"><Plus size={13} strokeWidth={3} /> Thêm tiêu chí</button>
                                    </div>
                                    <div className={`flex flex-col gap-3 w-full pr-1.5 ${catCriteria.length > 5 ? 'max-h-[380px] overflow-y-auto custom-scrollbar' : ''}`}>
                                      {catCriteria.length === 0 ? <div className="border border-dashed border-slate-200 bg-white/50 rounded-xl py-6 flex flex-col items-center justify-center text-slate-400 text-[12px] font-medium">Kéo thả tiêu chí hoặc thêm mới vào đây</div> : (
                                        <AnimatePresence>
                                          {catCriteria.map(item => {
                                            let typeLabel = 'CỘNG ĐIỂM', typeClass = 'bg-blue-50 text-blue-700 border-blue-100/50', pointClass = 'text-blue-600', formattedPoints = `+${item.points}đ/lần`;
                                            if (item.type === 'khen_thuong') { typeLabel = 'KHEN THƯỞNG'; typeClass = 'bg-[rgba(36,136,63,0.1)] text-[#006d2b] border-[#24883f]/10'; pointClass = 'text-[#006d2b]'; }
                                            else if (item.type === 'ky_luat') { typeLabel = 'KỶ LUẬT'; typeClass = 'bg-[rgba(255,218,214,0.3)] text-[#ba1a1a] border-[#ffdad6]/20'; pointClass = 'text-[#ba1a1a]'; formattedPoints = `${item.points}đ/lần`; }
                                            return (
                                              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} layout key={item.id} className="w-full">
                                                <div draggable onDragStart={(e) => handleDragStart(e, item.id)} onDragEnd={handleDragEnd} className="bg-white border border-slate-100/80 rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-200 group cursor-grab active:cursor-grabbing relative overflow-hidden w-full">
                                                  <div className="flex items-center justify-between w-full">
                                                    <div className="flex items-center gap-3">
                                                      <div className="text-slate-300 group-hover:text-slate-400 transition-colors shrink-0"><GripVertical size={16} /></div>
                                                      <div className="flex flex-col gap-1"><h4 className="font-bold text-slate-800 text-[13px]">{item.name}</h4><span className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase border tracking-wider w-fit ${typeClass}`}>{typeLabel}</span></div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <span className={`font-black text-[12px] ${pointClass} whitespace-nowrap shrink-0`}>{formattedPoints}</span>
                                                      <input
                                                        type="checkbox"
                                                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer hover:border-blue-400 transition-colors shrink-0"
                                                        checked={isCriteriaSelected(item.id)}
                                                        onChange={() => toggleCriteriaSelection(item.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onDragStart={(e) => e.stopPropagation()}
                                                      />
                                                    </div>
                                                  </div>
                                                  <div className="border-t border-slate-50 pt-2 flex items-center justify-between w-full">
                                                    <span className="text-[10px] font-semibold text-slate-500">Dải điểm: {item.minPoints} - {item.maxPoints}</span>
                                                    <div className="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"><button onClick={(e) => { e.stopPropagation(); setIsEditingCriteria(true); setSelectedCriteria(item); setTargetCategoryId(cat.id); setIsCriteriaModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Sửa tiêu chí"><Pencil size={14} strokeWidth={2.5} /></button><button onClick={(e) => { e.stopPropagation(); setCriteriaToDelete(item); setIsDeleteCriteriaModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Xóa tiêu chí"><Trash2 size={14} strokeWidth={2.5} /></button></div>
                                                  </div>
                                                </div>
                                              </motion.div>
                                            );
                                          })}
                                        </AnimatePresence>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  <div 
                    onDragOver={(e) => handleColumnDragOver(e, 'col-2')}
                    onDragLeave={handleColumnDragLeave}
                    onDrop={(e) => handleColumnDrop(e, 'col-2')}
                    className={`flex-1 flex flex-col gap-4 p-4 rounded-2xl border-2 transition-all duration-300 min-h-[500px] w-full ${dragOverColumnId === 'col-2' ? 'border-dashed border-blue-400 bg-blue-50/20' : 'border-dashed border-slate-200/60 bg-slate-50/10'}`}
                  >
                    {categories.filter(cat => cat.columnId === 'col-2').map((cat, idx) => {
                      const catCriteria = criteria.filter(c => c.categoryId === cat.id);
                      const isOver = dragOverCategoryId === cat.id;
                      const isExpanded = !!expandedCategories[cat.id];
                      const borderColors = ['border-[#1a73e8]', 'border-[#006d2b]', 'border-[#f9ab00]', 'border-[#7b2cbf]'];
                      const bgBadgeColors = ['bg-[#d8e2ff] text-[#005bbf]', 'bg-[#96f8a1]/30 text-[#006d2b]', 'bg-[rgba(249,171,0,0.1)] text-[#f9ab00]', 'bg-[#f3e5f5] text-[#7b2cbf]'];
                      const borderClass = borderColors[(idx + 2) % borderColors.length];
                      const badgeClass = bgBadgeColors[(idx + 2) % bgBadgeColors.length];
                      return (
                        <motion.div layout="position" key={cat.id} className={`w-full ${draggingCategoryId === cat.id ? 'opacity-40' : ''}`}>
                          <div draggable onDragStart={(e) => handleCategoryDragStart(e, cat.id)} onDragEnd={handleCategoryDragEnd} onDragOver={(e) => handleDragOver(e, cat.id)} onDragLeave={() => handleDragLeave(cat.id)} onDrop={(e) => handleDrop(e, cat.id)} className={`bg-white border-t-4 ${borderClass} border-solid flex flex-col items-start overflow-hidden pt-1 relative rounded-[16px] shadow-[0px_4px_12px_rgba(0,0,0,0.03)] transition-all duration-300 w-full cursor-grab active:cursor-grabbing hover:shadow-md ${isOver ? 'ring-2 ring-blue-500 scale-[1.01] bg-blue-50/10' : ''}`}>
                            <div className={`border-[#f1f5f9] ${isExpanded ? 'border-b' : ''} border-solid w-full px-5 py-4 flex flex-col gap-2 cursor-pointer select-none hover:bg-slate-50/40 transition-colors`} onClick={() => toggleCategoryExpand(cat.id)}>
                              <div className="flex items-start justify-between w-full">
                                <div className="flex flex-col gap-0.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase inline-block w-fit ${badgeClass}`}>{cat.id}</span>
                                  <h3 className="font-bold text-slate-800 text-[15px] leading-[20px] mt-1">{cat.name}</h3>
                                </div>
                                <div className="flex gap-1 items-center">
                                  <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); setSelectedCategory(cat); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Sửa danh mục"><Pencil size={14} strokeWidth={2.5} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); setCategoryToDelete(cat); setIsDeleteModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Xóa danh mục"><Trash2 size={14} strokeWidth={2.5} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); toggleCategoryExpand(cat.id); }} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer ml-0.5" title={isExpanded ? "Thu gọn" : "Mở rộng"}><motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown size={15} strokeWidth={2.5} /></motion.div></button>
                                </div>
                              </div>
                              <div className="flex gap-4 items-center text-[11px] text-slate-500 font-medium tracking-wide">
                                <div className="flex gap-1 items-center"><span>Điểm tối đa:</span><span className="font-bold text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded">{cat.maxPoints}</span></div>
                                <div className="flex gap-1 items-center"><span>Số tiêu chí:</span><span className="font-bold text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded">{String(catCriteria.length).padStart(2, '0')}</span></div>
                              </div>
                            </div>
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeInOut' }} className="w-full overflow-hidden">
                                  <div className="bg-[#faf9fd]/70 w-full p-5 flex flex-col gap-4">
                                    <div className="flex items-center justify-between w-full">
                                      <div className="flex items-center gap-2 select-none">
                                        <input
                                          type="checkbox"
                                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer hover:border-blue-400 transition-colors"
                                          checked={isAllCriteriaInCatSelected(cat.id, catCriteria)}
                                          ref={(el) => {
                                            if (el) {
                                              el.indeterminate = isSomeCriteriaInCatSelected(cat.id, catCriteria);
                                            }
                                          }}
                                          onChange={() => toggleSelectAllCriteriaInCat(cat.id, catCriteria)}
                                        />
                                        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Danh sách tiêu chí</span>
                                        {catCriteria.some(c => isCriteriaSelected(c.id)) && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteSelectedCriteria(cat.id);
                                            }}
                                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                            title="Xóa các tiêu chí đã chọn"
                                          >
                                            <Trash2 size={14} strokeWidth={2.5} />
                                          </button>
                                        )}
                                      </div>
                                      <button onClick={() => { setIsEditingCriteria(false); setSelectedCriteria(null); setTargetCategoryId(cat.id); setIsCriteriaModalOpen(true); }} className="flex gap-1 items-center text-blue-600 hover:text-blue-700 text-[11px] font-bold hover:underline cursor-pointer transition-colors"><Plus size={13} strokeWidth={3} /> Thêm tiêu chí</button>
                                    </div>
                                    <div className={`flex flex-col gap-3 w-full pr-1.5 ${catCriteria.length > 5 ? 'max-h-[380px] overflow-y-auto custom-scrollbar' : ''}`}>
                                      {catCriteria.length === 0 ? <div className="border border-dashed border-slate-200 bg-white/50 rounded-xl py-6 flex flex-col items-center justify-center text-slate-400 text-[12px] font-medium">Kéo thả tiêu chí hoặc thêm mới vào đây</div> : (
                                        <AnimatePresence>
                                          {catCriteria.map(item => {
                                            let typeLabel = 'CỘNG ĐIỂM', typeClass = 'bg-blue-50 text-blue-700 border-blue-100/50', pointClass = 'text-blue-600', formattedPoints = `+${item.points}đ/lần`;
                                            if (item.type === 'khen_thuong') { typeLabel = 'KHEN THƯỞNG'; typeClass = 'bg-[rgba(36,136,63,0.1)] text-[#006d2b] border-[#24883f]/10'; pointClass = 'text-[#006d2b]'; }
                                            else if (item.type === 'ky_luat') { typeLabel = 'KỶ LUẬT'; typeClass = 'bg-[rgba(255,218,214,0.3)] text-[#ba1a1a] border-[#ffdad6]/20'; pointClass = 'text-[#ba1a1a]'; formattedPoints = `${item.points}đ/lần`; }
                                            return (
                                              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} layout key={item.id} className="w-full">
                                                <div draggable onDragStart={(e) => handleDragStart(e, item.id)} onDragEnd={handleDragEnd} className="bg-white border border-slate-100/80 rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-200 group cursor-grab active:cursor-grabbing relative overflow-hidden w-full">
                                                  <div className="flex items-center justify-between w-full">
                                                    <div className="flex items-center gap-3">
                                                      <div className="text-slate-300 group-hover:text-slate-400 transition-colors shrink-0"><GripVertical size={16} /></div>
                                                      <div className="flex flex-col gap-1"><h4 className="font-bold text-slate-800 text-[13px]">{item.name}</h4><span className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase border tracking-wider w-fit ${typeClass}`}>{typeLabel}</span></div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <span className={`font-black text-[12px] ${pointClass} whitespace-nowrap shrink-0`}>{formattedPoints}</span>
                                                      <input
                                                        type="checkbox"
                                                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer hover:border-blue-400 transition-colors shrink-0"
                                                        checked={isCriteriaSelected(item.id)}
                                                        onChange={() => toggleCriteriaSelection(item.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onDragStart={(e) => e.stopPropagation()}
                                                      />
                                                    </div>
                                                  </div>
                                                  <div className="border-t border-slate-50 pt-2 flex items-center justify-between w-full">
                                                    <span className="text-[10px] font-semibold text-slate-500">Dải điểm: {item.minPoints} - {item.maxPoints}</span>
                                                    <div className="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"><button onClick={(e) => { e.stopPropagation(); setIsEditingCriteria(true); setSelectedCriteria(item); setTargetCategoryId(cat.id); setIsCriteriaModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Sửa tiêu chí"><Pencil size={14} strokeWidth={2.5} /></button><button onClick={(e) => { e.stopPropagation(); setCriteriaToDelete(item); setIsDeleteCriteriaModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Xóa tiêu chí"><Trash2 size={14} strokeWidth={2.5} /></button></div>
                                                  </div>
                                                </div>
                                              </motion.div>
                                            );
                                          })}
                                        </AnimatePresence>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                </div>
              </div>
            </div>
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
        onSave={handleSaveCategory}
      />

      <CriteriaModal
        isOpen={isCriteriaModalOpen}
        onClose={() => setIsCriteriaModalOpen(false)}
        isEditing={isEditingCriteria}
        initialData={selectedCriteria}
        categories={categories}
        defaultCategoryId={targetCategoryId}
        onSave={handleSaveCriteria}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteCategory}
        title="Xác nhận xóa danh mục"
        message={`Bạn có chắc chắn muốn xóa danh mục "${categoryToDelete?.name}"? Mọi tiêu chí thuộc danh mục này cũng sẽ bị xóa bỏ và hành động này không thể hoàn tác.`}
        variant="danger"
        confirmLabel="Xác nhận xóa"
      />

      <ConfirmModal
        isOpen={isDeleteCriteriaModalOpen}
        onClose={() => setIsDeleteCriteriaModalOpen(false)}
        onConfirm={handleConfirmDeleteCriteria}
        title="Xác nhận xóa tiêu chí"
        message={`Bạn có chắc chắn muốn xóa tiêu chí "${criteriaToDelete?.name}"? Hành động này không thể hoàn tác.`}
        variant="danger"
        confirmLabel="Xác nhận xóa"
      />

      <ConfirmModal
        isOpen={isDeleteBulkCriteriaModalOpen}
        onClose={() => setIsDeleteBulkCriteriaModalOpen(false)}
        onConfirm={handleConfirmDeleteBulkCriteria}
        title="Xác nhận xóa hàng loạt tiêu chí"
        message={`Bạn có chắc chắn muốn xóa ${bulkCriteriaToDeleteCount} tiêu chí đang được chọn trong danh mục này? Hành động này không thể hoàn tác.`}
        variant="danger"
        confirmLabel="Xác nhận xóa"
      />
    </div>
    </>
  );
}
