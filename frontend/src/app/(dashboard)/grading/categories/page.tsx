'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Pencil,
  Trash2,
  Plus,
  GripVertical,
  ChevronDown,
  LayoutGrid,
  PanelLeftClose,
  Lock,
  ChevronLeft,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import TabNavigation from '@/components/ui/TabNavigation';
import CategoryModal from '@/components/grading/CategoryModal';
import CriteriaModal from '@/components/grading/CriteriaModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { toast } from 'sonner';
import { categoryApi } from '@/api/category-api';
import { criteriaApi } from '@/api/criteria-api';
import { tokenStorage } from '@/api/auth-api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


import { RouteGuard } from '@/components/guards/RouteGuard';

const FullContentPopover = ({ content, label = 'Nội dung đầy đủ:', threshold = 50, className = '' }: { content: string, label?: string, threshold?: number, className?: string }) => {
  if (!content || content.length <= threshold) {
    return <span className={className}>{content}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 min-w-0 max-w-full ${className}`}>
      <span className="truncate min-w-0" title={content}>{content.slice(0, threshold)}...</span>
      <Popover>
        <PopoverTrigger asChild>
          <button 
            type="button" 
            className="shrink-0 text-slate-400 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full inline-flex align-middle"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => e.stopPropagation()}
            title="Xem đầy đủ"
          >
            <Info size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          side="bottom" 
          align="start" 
          sideOffset={8} 
          collisionPadding={16} 
          className="z-[100] w-[min(20rem,calc(100vw-2rem))] p-3 rounded-xl bg-slate-900 text-white border border-slate-700 shadow-xl"
        >
          <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">{label}</span>
            <span className="text-[13px] leading-relaxed whitespace-normal break-words">{content}</span>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
};


function CategoriesPage() {
  const router = useRouter();
  const currentUser = tokenStorage.getUser();
  const hasCurrentUser = Boolean(currentUser);
  const currentUserRole = (currentUser?.role || '').toLowerCase();
  const isAdminOrSupervisor =
    currentUserRole.includes('admin') || currentUserRole.includes('supervisor');
  const isStudent = currentUserRole.includes('student');
  const gradingTabs = [
    ...(isStudent ? [] : [{ id: 'list', label: 'Danh sách' }]),
    { id: 'score', label: 'Chấm điểm' },
    ...(isAdminOrSupervisor ? [{ id: 'reports', label: 'Danh mục' }] : []),
  ];

  // Reusable glass card class per design tokens
  const glassCardClass = 'bg-white/45 backdrop-blur-md border border-white/70 rounded-xl shadow-sm shadow-slate-300/40 p-4';

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // States cho Category và Criteria
  const [categories, setCategories] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);

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
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // States cho chế độ xem: 'kanban' (mặc định) hoặc 'master-detail' (layout 4/6 mới)
  const [viewMode, setViewMode] = useState<'kanban' | 'master-detail'>('master-detail');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');

  // Hàm tải dữ liệu từ database thông qua API
  const fetchData = async () => {
    try {
      setIsFetching(true);
      const [backendCats, backendCris] = await Promise.all([
        categoryApi.getCategories(),
        criteriaApi.getCriteria()
      ]);

      // Đọc các cột đã lưu từ localStorage
      const savedCols = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('category_columns') || '{}') : {};

      // Mapping Categories từ Backend về định dạng Frontend
      const mappedCats = backendCats.map((cat: any) => {
        const defaultColId = cat.sort_order <= 2 ? 'col-1' : 'col-2';
        const columnId = savedCols[cat.category_code] || defaultColId;
        return {
          id: cat.category_code,
          _id: cat._id,
          name: cat.category_name,
          description: '',
          maxPoints: cat.max_score,
          sort_order: cat.sort_order,
          status: true,
          columnId
        };
      });

      // Mapping Criteria từ Backend về định dạng Frontend
      const mappedCris = backendCris.map((cri: any) => {
        const parentCat = backendCats.find((cat: any) => cat._id === (typeof cri.category_id === 'object' ? cri.category_id?._id : cri.category_id));
        return {
          id: cri._id,
          _id: cri._id,
          code: cri.criterion_code,
          name: cri.criterion_name,
          type: cri.criterion_type,
          points: cri.score_per_unit,
          minPoints: cri.min_score,
          maxPoints: cri.max_score,
          categoryId: parentCat ? parentCat.category_code : '',
          categoryObjectId: parentCat ? parentCat._id : (typeof cri.category_id === 'object' ? cri.category_id?._id : cri.category_id),
          is_locked: !!cri.is_locked,
          is_score_counted: cri.is_score_counted !== false,
          scoring_mode: cri.scoring_mode || 'count',
          options: cri.options || []
        };
      });

      setCategories(mappedCats);
      setCriteria(mappedCris);

      if (mappedCats.length > 0) {
        setSelectedCategoryId(prev => prev || mappedCats[0].id);
      }

      // Cập nhật trạng thái thu gọn mặc định cho các categories mới (giữ lại trạng thái cũ nếu đã có)
      setExpandedCategories(prev => {
        const nextState = { ...prev };
        mappedCats.forEach(cat => {
          if (nextState[cat.id] === undefined) {
            nextState[cat.id] = false;
          }
        });
        return nextState;
      });

    } catch (error: any) {
      toast.error('Lỗi khi tải dữ liệu từ database: ' + error.message);
    } finally {
      setIsInitialLoading(false);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (!hasCurrentUser) return;

    if (!isAdminOrSupervisor) {
      router.replace(isStudent ? '/grading/score' : '/grading');
      return;
    }

    fetchData();
  }, [hasCurrentUser, isAdminOrSupervisor, isStudent, router]);

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

    if (toDeleteIds.length === 0) return;

    criteriaApi.deleteCriteria(toDeleteIds).then(() => {
      fetchData();
      setSelectedCriteriaIds(prev => prev.filter(id => !toDeleteIds.includes(id)));
      const catName = categories.find(cat => cat.id === bulkDeleteCatId)?.name || '';
      toast.success(`Đã xóa thành công ${toDeleteIds.length} tiêu chí đã chọn trong danh mục "${catName}"!`);
    }).catch(err => toast.error('Lỗi khi xóa hàng loạt tiêu chí: ' + err.message))
      .finally(() => {
        setIsDeleteBulkCriteriaModalOpen(false);
        setBulkDeleteCatId('');
        setBulkCriteriaToDeleteCount(0);
      });
  };

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  // Drag and Drop Handlers cho Tiêu chí (Criteria Item)
  const handleDragStart = (e: React.DragEvent, criteriaId: string) => {
    e.stopPropagation();
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

    Object.values(dragTimeoutRef.current).forEach(clearTimeout);
    dragTimeoutRef.current = {};
  };

  const handleDragOver = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('criteria-id')) {
      if (dragOverCategoryId !== categoryId) {
        setDragOverCategoryId(categoryId);

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
    e.stopPropagation();

    const criteriaId = e.dataTransfer.getData('criteria-id') || draggingCriteriaId;
    const draggedCatId = e.dataTransfer.getData('category-id') || draggingCategoryId;

    if (dragTimeoutRef.current[targetCatId]) {
      clearTimeout(dragTimeoutRef.current[targetCatId]);
      delete dragTimeoutRef.current[targetCatId];
    }

    if (criteriaId) {
      const draggedItem = criteria.find(c => c.id === criteriaId);
      if (draggedItem) {
        if (draggedItem.categoryId === targetCatId) {
          setDragOverCategoryId(null);
          return;
        }

        const targetCat = categories.find(cat => cat.id === targetCatId);
        if (targetCat) {

          setCriteria(prev =>
            prev.map(item =>
              item.id === criteriaId ? { ...item, categoryId: targetCatId, categoryObjectId: targetCat._id } : item
            )
          );

          criteriaApi.updateCriterion(draggedItem._id, {
            category_id: targetCat._id
          }).then(() => {
            fetchData();
            toast.success(`Đã chuyển tiêu chí "${draggedItem.name}" sang danh mục "${targetCat.name}"!`);
          }).catch(err => {
            fetchData();
            toast.error('Lỗi khi chuyển danh mục tiêu chí: ' + err.message);
          });
        }
      }
    }
    else if (draggedCatId && draggedCatId !== targetCatId) {
      const draggedCat = categories.find(c => c.id === draggedCatId);
      const targetCat = categories.find(c => c.id === targetCatId);

      if (draggedCat && targetCat) {
        const filtered = categories.filter(c => c.id !== draggedCatId);
        const targetIdx = filtered.findIndex(c => c.id === targetCatId);
        const updatedDraggedCat = { ...draggedCat, columnId: targetCat.columnId };
        const newCategories = [...filtered];
        newCategories.splice(targetIdx, 0, updatedDraggedCat);

        setCategories(newCategories);

        const updatePromises = newCategories.map((cat, idx) => {
          return categoryApi.updateCategory(cat._id, {
            sort_order: idx + 1
          });
        });

        Promise.all(updatePromises).then(() => {
          fetchData();
          toast.success(`Đã thay đổi thứ tự của danh mục "${draggedCat.name}"!`);
        }).catch(err => {
          fetchData();
          toast.error('Lỗi khi lưu thứ tự danh mục: ' + err.message);
        });
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

        const savedCols = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('category_columns') || '{}') : {};
        savedCols[catId] = targetColId;
        localStorage.setItem('category_columns', JSON.stringify(savedCols));

        const colName = targetColId === 'col-1' ? 'Cột danh mục 1' : 'Cột danh mục 2';
        toast.success(`Đã chuyển danh mục "${draggedCat.name}" sang ${colName}!`);
      }
    }
    setDragOverColumnId(null);
  };

  // Thêm/Sửa danh mục
  const handleSaveCategory = (data: any) => {
    if (isEditing && selectedCategory) {
      const newMaxScore = Number(data.maxPoints);

      categoryApi.updateCategory(selectedCategory._id, {
        category_code: data.id,
        category_name: data.name,
        max_score: newMaxScore,
        sort_order: Number(data.sort_order || selectedCategory.sort_order || 1)
      }).then(() => {
        fetchData();
        toast.success(`Đã cập nhật danh mục "${data.name}" thành công!`);
      }).catch(err => toast.error('Lỗi khi cập nhật danh mục: ' + err.message));
    } else {
      categoryApi.createCategory({
        category_code: data.id,
        category_name: data.name,
        max_score: Number(data.maxPoints),
        sort_order: Number(data.sort_order || categories.length + 1)
      }).then((newCat) => {
        fetchData().then(() => {
          setExpandedCategories(prev => ({
            ...prev,
            [data.id]: true
          }));
        });
        toast.success(`Đã thêm danh mục "${data.name}" thành công!`);
      }).catch(err => toast.error('Lỗi khi thêm danh mục: ' + err.message));
    }
  };

  // Xóa danh mục
  const handleConfirmDeleteCategory = async () => {
    if (categoryToDelete) {
      try {
        await categoryApi.deleteCategory(categoryToDelete._id);
        const catCriteriaIds = criteria.filter(c => c.categoryId === categoryToDelete.id).map(c => c._id);
        if (catCriteriaIds.length > 0) {
          await criteriaApi.deleteCriteria(catCriteriaIds);
        }
        fetchData();
        toast.success(`Đã xóa danh mục "${categoryToDelete.name}" thành công!`);
      } catch (err: any) {
        toast.error('Lỗi khi xóa danh mục: ' + err.message);
      } finally {
        setIsDeleteModalOpen(false);
        setCategoryToDelete(null);
      }
    }
  };

  // Thêm/Sửa tiêu chí
  const handleSaveCriteria = async (data: any) => {
    const parentCat = categories.find(cat => cat.id === data.categoryId);
    const categoryObjectId = parentCat?._id || data.categoryId;

    if (isEditingCriteria && selectedCriteria) {
      await criteriaApi.updateCriterion(selectedCriteria._id, {
        category_id: categoryObjectId,
        criterion_code: data.criterion_code,
        criterion_name: data.name,
        criterion_type: data.type,
        score_per_unit: Number(data.points),
        min_score: Number(data.minPoints),
        max_score: Number(data.maxPoints),
        is_locked: !!data.is_locked,
        is_score_counted: data.type === 'ky_luat' ? !!data.is_score_counted : true,
        scoring_mode: data.scoring_mode,
        options: data.options?.map((opt: any) => {
          const { _id, ...rest } = opt;
          return rest;
        })
      });
      await fetchData();
    } else {
      await criteriaApi.createCriterion({
        category_id: categoryObjectId,
        criterion_code: data.criterion_code,
        criterion_name: data.name,
        criterion_type: data.type,
        score_per_unit: Number(data.points),
        min_score: Number(data.minPoints),
        max_score: Number(data.maxPoints),
        is_locked: !!data.is_locked,
        is_score_counted: data.type === 'ky_luat' ? !!data.is_score_counted : true,
        scoring_mode: data.scoring_mode,
        options: data.options?.map((opt: any) => {
          const { _id, ...rest } = opt;
          return rest;
        })
      });
      await fetchData();
    }
  };

  // Xóa tiêu chí
  const handleConfirmDeleteCriteria = () => {
    if (criteriaToDelete) {
      criteriaApi.deleteCriterion(criteriaToDelete._id).then(() => {
        fetchData();
        toast.success(`Đã xóa tiêu chí "${criteriaToDelete.name}" thành công!`);
      }).catch(err => toast.error('Lỗi khi xóa tiêu chí: ' + err.message))
        .finally(() => {
          setIsDeleteCriteriaModalOpen(false);
          setCriteriaToDelete(null);
        });
    }
  };

  const getCategoryCriteriaTotalMaxPoints = (categoryId: string) =>
    criteria
      .filter((item) => item.categoryId === categoryId)
      .reduce((sum, item) => sum + Number(item.maxPoints || 0), 0);
  const renderStatsRow = (isMobile: boolean) => {
    const premiumStatsGlassCardClass = 'bg-gradient-to-br from-white/60 to-white/35 backdrop-blur-lg border border-white/80 rounded-xl shadow-sm shadow-slate-200/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] px-3.5 py-3 flex items-center justify-between gap-3 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-300/30';
    
    return (
      <div className={`grid ${isMobile ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-4'} gap-3 w-full`}>
        {/* Tổng số danh mục */}
        <div className={premiumStatsGlassCardClass}>
          <span 
            className="font-sans font-semibold text-slate-500 text-[8.5px] xs:text-[9.5px] sm:text-[10px] tracking-[0.5px] uppercase leading-tight truncate" 
            title="TỔNG SỐ DANH MỤC"
          >
            TỔNG SỐ DANH MỤC
          </span>
          <span className="font-sans font-bold text-[#005bbf] text-[18px] sm:text-[20px] leading-none shrink-0">
            {isInitialLoading ? (
              <Skeleton className="h-5 w-8 bg-slate-100/80 rounded-xl animate-pulse" />
            ) : (
              categories.length
            )}
          </span>
        </div>

        {/* Tiêu chí khen thưởng */}
        <div className={premiumStatsGlassCardClass}>
          <span 
            className="font-sans font-semibold text-slate-500 text-[8.5px] xs:text-[9.5px] sm:text-[10px] tracking-[0.5px] uppercase leading-tight truncate" 
            title="TIÊU CHÍ KHEN THƯỜNG"
          >
            TIÊU CHÍ KHEN THƯỜNG
          </span>
          <span className="font-sans font-bold text-[#006d2b] text-[18px] sm:text-[20px] leading-none shrink-0">
            {isInitialLoading ? (
              <Skeleton className="h-5 w-8 bg-slate-100/80 rounded-xl animate-pulse" />
            ) : (
              criteria.filter(c => c.type === 'khen_thuong' || c.type === 'cong_diem').length
            )}
          </span>
        </div>

        {/* Tiêu chí kỷ luật */}
        <div className={premiumStatsGlassCardClass}>
          <span 
            className="font-sans font-semibold text-slate-500 text-[8.5px] xs:text-[9.5px] sm:text-[10px] tracking-[0.5px] uppercase leading-tight truncate" 
            title="TIÊU CHÍ KỶ LUẬT"
          >
            TIÊU CHÍ KỶ LUẬT
          </span>
          <span className="font-sans font-bold text-[#ba1a1a] text-[18px] sm:text-[20px] leading-none shrink-0">
            {isInitialLoading ? (
              <Skeleton className="h-5 w-8 bg-slate-100/80 rounded-xl animate-pulse" />
            ) : (
              criteria.filter(c => c.type === 'ky_luat').length
            )}
          </span>
        </div>

        {/* Điểm tối đa TB */}
        <div className={premiumStatsGlassCardClass}>
          <span 
            className="font-sans font-semibold text-slate-500 text-[8.5px] xs:text-[9.5px] sm:text-[10px] tracking-[0.5px] uppercase leading-tight truncate" 
            title="ĐIỂM TỐI ĐA TB"
          >
            ĐIỂM TỐI ĐA TB
          </span>
          <span className="font-sans font-bold text-[#f9ab00] text-[18px] sm:text-[20px] leading-none shrink-0">
            {isInitialLoading ? (
              <Skeleton className="h-5 w-12 bg-slate-100/80 rounded-xl animate-pulse" />
            ) : (
              Math.min(categories.reduce((sum, c) => sum + c.maxPoints, 0), 100)
            )}
          </span>
        </div>
      </div>
    );
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

          <TabNavigation
            tabs={gradingTabs}
            activeTab={'reports'}
            onTabChange={(id) => {
              if (id === 'list') {
                router.push('/grading');
              } else if (id === 'score') {
                router.push('/grading/score');
              }
            }}
          />

          <main className="flex-1 p-4 md:px-8 flex flex-col gap-3 w-full overflow-hidden">
            {/* Tab Cấu hình danh mục - Giao diện kéo thả Kanban cao cấp theo Figma */}
            <div className={`${glassCardClass} flex-1 flex flex-col gap-5 min-h-0 overflow-hidden w-full font-sans`}> 
              {/* Header chứa các chỉ số thống kê bento và nút Thêm danh mục đặt chung một hàng flex */}
              {/* Header chứa các nút điều khiển */}
              <div className="flex items-center justify-between w-full shrink-0 px-1 pt-1">
                <h2 className="text-[16px] font-bold text-slate-800 font-sans hidden lg:block">
                  Quản lý Danh mục & Tiêu chí
                </h2>
                
                {/* Toggle View Mode + Nút Thêm danh mục */}
                <div className="flex items-center justify-between lg:justify-end gap-2 shrink-0 w-full lg:w-auto">
                  {/* Toggle chế độ xem */}
                  <div className="flex items-center bg-white/45 backdrop-blur-md border border-white/70 rounded-xl p-1 h-[40px] flex-1 lg:flex-none justify-around lg:justify-start">
                    <button
                      disabled={isInitialLoading}
                      onClick={() => setViewMode('kanban')}
                      className={`flex items-center gap-1.5 px-3 h-full rounded-xl text-[12px] font-semibold transition-all duration-150 ease-out hover:scale-[1.01] ${isInitialLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${viewMode === 'kanban' ? 'bg-white/70 text-[#1A73E8] shadow-sm' : 'text-[#64748B] hover:bg-white/50'}`}
                      title="Chế độ Kanban"
                    >
                      <LayoutGrid size={15} strokeWidth={2} />
                      <span className="hidden xl:inline">Kanban</span>
                    </button>
                    <button
                      disabled={isInitialLoading}
                      onClick={() => {
                        setViewMode('master-detail');
                        if (!selectedCategoryId && categories.length > 0) {
                          setSelectedCategoryId(categories[0].id);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 h-full rounded-xl text-[12px] font-semibold transition-all duration-150 ease-out hover:scale-[1.01] ${isInitialLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${viewMode === 'master-detail' ? 'bg-white/70 text-[#1A73E8] shadow-sm' : 'text-[#64748B] hover:bg-white/50'}`}
                      title="Chế độ Chi tiết"
                    >
                      <PanelLeftClose size={15} strokeWidth={2} />
                      <span className="hidden xl:inline">Chi tiết</span>
                    </button>
                  </div>

                  {/* Nút Thêm danh mục */}
                  <button
                    disabled={isInitialLoading}
                    onClick={() => {
                      setIsEditing(false);
                      setSelectedCategory(null);
                      setIsModalOpen(true);
                    }}
                    className={`text-white transition-all duration-150 ease-out shrink-0 h-[40px] flex items-center justify-center rounded-xl bg-[#1A73E8] w-[40px] md:w-auto md:px-4 md:py-2 md:gap-2 font-semibold text-[14px] ${isInitialLoading ? 'opacity-60 cursor-not-allowed shadow-none' : 'hover:bg-[#155FC0] hover:scale-[1.01] shadow-sm cursor-pointer'}`}
                    title="Thêm danh mục"
                  >
                    <Plus size={16} strokeWidth={2.5} className="shrink-0" />
                    <span className="hidden md:inline">Thêm danh mục</span>
                  </button>
                </div>
              </div>

              {/* Category Columns — Chế độ Kanban hoặc Master-Detail */}
              <div className="flex-1 overflow-y-auto pb-6 pr-1 flex flex-col gap-6 custom-scrollbar">
                {/* Stats Row on Desktop */}
                <div className="hidden lg:block shrink-0">
                  {renderStatsRow(false)}
                </div>

                {/* ===== CHẾ ĐỘ MASTER-DETAIL (Layout 4/6) ===== */}
                {viewMode === 'master-detail' && (() => {
                  const activeCat = categories.find(c => c.id === selectedCategoryId);
                  const activeCriteria = activeCat ? criteria.filter(c => c.categoryId === activeCat.id) : [];
                  const activeCriteriaTotalMaxPoints = activeCat ? getCategoryCriteriaTotalMaxPoints(activeCat.id) : 0;
                  const isActiveCriteriaTotalOverMax = activeCat ? activeCriteriaTotalMaxPoints > Number(activeCat.maxPoints || 0) : false;
                  const borderColors = ['#60a5fa', '#34d399', '#fbbf24', '#c084fc'];
                  const bgBadgeColors = ['bg-[#d8e2ff] text-[#005bbf]', 'bg-[#96f8a1]/30 text-[#006d2b]', 'bg-[rgba(249,171,0,0.1)] text-[#f9ab00]', 'bg-[#f3e5f5] text-[#7b2cbf]'];

                  return (
                    <div className="flex flex-col lg:flex-row gap-5 w-full items-start h-full">
                      {/* ── Sidebar trái (40%) — Danh sách danh mục ── */}
                      <div className={`w-full lg:w-2/5 flex flex-col gap-3 shrink-0 ${selectedCategoryId !== null ? 'hidden lg:flex' : 'flex'}`}>
                        {/* Search danh mục */}
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <Search size={15} />
                          </div>
                          <input
                            type="text"
                            placeholder="Tìm danh mục..."
                            value={categorySearchTerm}
                            onChange={(e) => setCategorySearchTerm(e.target.value)}
                            className="w-full bg-white/50 backdrop-blur-sm border border-white/70 rounded-xl pl-9 pr-4 py-2.5 text-[13px] font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-[#1A73E8]/10 focus:border-[#1A73E8] transition-all outline-none text-[#1E293B]"
                          />
                        </div>

                        {/* Danh sách danh mục */}
                        <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-320px)] pr-1 custom-scrollbar">
                          {isInitialLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                              <div key={`skel-cat-${i}`} className="bg-white/45 backdrop-blur-md border border-white/70 rounded-xl p-4 animate-pulse">
                                <div className="flex items-center gap-3">
                                  <div className="w-1 h-10 rounded-xl bg-slate-100" />
                                  <div className="flex-1 flex flex-col gap-2">
                                    <Skeleton className="h-3 w-14 bg-slate-100 rounded-xl" />
                                    <Skeleton className="h-4 w-3/4 bg-slate-100 rounded-xl" />
                                    <Skeleton className="h-3 w-1/2 bg-slate-100 rounded-xl" />
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : categories.length === 0 ? (
                            <div className="border-2 border-dashed border-slate-200 rounded-xl py-12 flex flex-col items-center justify-center text-slate-400 text-[13px] font-medium gap-2">
                              <LayoutGrid size={32} strokeWidth={1.5} className="text-slate-300" />
                              <span>Chưa có danh mục nào</span>
                              <button
                                onClick={() => { setIsEditing(false); setSelectedCategory(null); setIsModalOpen(true); }}
                                className="text-blue-600 hover:text-blue-700 text-[12px] font-bold hover:underline cursor-pointer mt-1"
                              >
                                + Thêm danh mục đầu tiên
                              </button>
                            </div>
                          ) : (
                            categories.filter(cat => {
                              const term = categorySearchTerm.toLowerCase().trim();
                              if (!term) return true;
                              return cat.name.toLowerCase().includes(term) || cat.id.toLowerCase().includes(term);
                            }).map((cat, idx) => {
                              const catCriteriaCount = criteria.filter(c => c.categoryId === cat.id).length;
                              const criteriaTotalMaxPoints = getCategoryCriteriaTotalMaxPoints(cat.id);
                              const isCriteriaTotalOverMax = criteriaTotalMaxPoints > Number(cat.maxPoints || 0);
                              const isActive = selectedCategoryId === cat.id;
                              const borderColor = borderColors[idx % borderColors.length];
                              const badgeClass = bgBadgeColors[idx % bgBadgeColors.length];

                              return (
                                <motion.div
                                  key={cat.id}
                                  layout
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.03 }}
                                >
                                  <div
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={`group relative bg-white/40 backdrop-blur-md border border-white/70 rounded-xl p-4 transition-all duration-150 ease-out cursor-pointer flex items-start gap-3 hover:scale-[1.01] ${isActive ? 'shadow-sm shadow-slate-300/40 ring-1 ring-[#1A73E8]/8 bg-white/60' : 'hover:shadow-sm hover:shadow-slate-300/40'}`}
                                  >
                                    {/* Color indicator */}
                                      <div
                                      className="w-1 min-h-[40px] self-stretch rounded-xl transition-all"
                                      style={{ backgroundColor: borderColor }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase inline-block w-fit ${badgeClass}`}>
                                          {cat.id}
                                        </span>
                                        {/* Action buttons on hover */}
                                        <div className={`flex gap-0.5 items-center transition-opacity duration-150 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setIsEditing(true); setSelectedCategory(cat); setIsModalOpen(true); }}
                                            className="p-1 text-slate-400 hover:text-[#1A73E8] hover:bg-white/50 rounded-xl transition-colors cursor-pointer"
                                            title="Sửa danh mục"
                                          >
                                            <Pencil size={12} strokeWidth={2.5} />
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setCategoryToDelete(cat); setIsDeleteModalOpen(true); }}
                                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                            title="Xóa danh mục"
                                          >
                                            <Trash2 size={12} strokeWidth={2.5} />
                                          </button>
                                        </div>
                                      </div>
                                      <h4 className="font-bold text-slate-800 text-[13.5px] leading-[18px] mt-1.5 flex items-center min-w-0">
                                        <FullContentPopover content={cat.name} label="Nội dung danh mục:" threshold={100} className="truncate" />
                                      </h4>
                                      <div className="flex flex-wrap gap-x-3 gap-y-1 items-center text-[10.5px] text-slate-500 font-medium mt-2">
                                        <div className={`flex gap-1 items-center ${isCriteriaTotalOverMax ? 'text-red-600' : ''}`}>
                                          <span>Điểm tối đa:</span>
                                          <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${isCriteriaTotalOverMax ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50/60'}`}>{cat.maxPoints}</span>
                                        </div>
                                        <div className="flex gap-1 items-center">
                                          <span>Tiêu chí:</span>
                                          <span className="font-bold text-blue-600 bg-blue-50/60 px-1.5 py-0.5 rounded text-[10px]">{String(catCriteriaCount).padStart(2, '0')}</span>
                                        </div>
                                        <div className="flex gap-1 items-center">
                                          <span>Tổng điểm tiêu chí:</span>
                                          <span className="font-bold text-blue-600 bg-blue-50/60 px-1.5 py-0.5 rounded text-[10px]">{criteriaTotalMaxPoints}</span>
                                        </div>
                                      </div>
                                    </div>
                                    {/* Active indicator */}
                                    {isActive && (
                                      <motion.div
                                        layoutId="activeCatIndicator"
                                            className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#1A73E8] rounded-l-xl"
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                      />
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* ── Panel phải (60%) — Chi tiết tiêu chí ── */}
                      <div className={`w-full lg:w-3/5 flex flex-col gap-0 min-h-[500px] ${selectedCategoryId === null ? 'hidden lg:flex' : 'flex'}`}>
                        {isInitialLoading ? (
                          /* Skeleton Detail Panel cho Panel bên phải */
                          <div className={`${glassCardClass} overflow-hidden flex flex-col min-h-[500px] animate-pulse`}>
                            {/* Header thông tin danh mục skeleton */}
                            <div className="px-4 py-4 md:px-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white animate-pulse">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5 md:gap-3 w-full">
                                  <button
                                    onClick={() => setSelectedCategoryId(null)}
                                    className="lg:hidden p-1.5 hover:bg-white/60 rounded-xl text-slate-400 mr-1 cursor-pointer shrink-0"
                                  >
                                    <ChevronLeft size={18} strokeWidth={2.5} />
                                  </button>
                                  <div className="w-1.5 h-10 rounded-xl bg-slate-100 shrink-0" />
                                  <div className="flex flex-col gap-2 w-2/3">
                                    <Skeleton className="h-3 w-16 bg-slate-100 rounded-xl" />
                                    <Skeleton className="h-5 w-full bg-slate-100 rounded-xl mt-1" />
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium pl-[18px] mt-2">
                                <Skeleton className="h-4 w-28 bg-slate-100 rounded-xl" />
                                <Skeleton className="h-4 w-28 bg-slate-100 rounded-xl" />
                              </div>
                            </div>

                            {/* Toolbar skeleton */}
                              <div className="px-6 py-2 flex items-center justify-between animate-pulse border-b border-slate-50">
                              <div className="flex items-center gap-2">
                                <Skeleton className="w-3.5 h-3.5 rounded-xl bg-slate-100" />
                                <Skeleton className="h-4 w-20 bg-slate-100 rounded-xl" />
                              </div>
                              <Skeleton className="h-7 w-24 bg-slate-100 rounded-xl" />
                            </div>

                            {/* Criteria List skeleton */}
                            <div className="flex-1 overflow-y-auto px-3 custom-scrollbar py-3">
                              <div className="flex flex-col gap-2.5">
                                  {Array.from({ length: 3 }).map((_, i) => (
                                      <div key={`skel-cri-${i}`} className="bg-white/45 backdrop-blur-md border border-white/70 rounded-xl p-4 flex items-center gap-4 animate-pulse">
                                    <Skeleton className="w-3.5 h-3.5 rounded-xl bg-slate-100 shrink-0" />
                                    <div className="flex-1 flex flex-col gap-2">
                                      <Skeleton className="h-4 w-3/4 bg-slate-100 rounded-xl" />
                                      <div className="flex items-center gap-2 mt-1">
                                        <Skeleton className="h-3 w-16 bg-slate-100 rounded-xl" />
                                        <Skeleton className="h-3 w-28 bg-slate-100 rounded-xl" />
                                      </div>
                                    </div>
                                    <Skeleton className="h-7 w-12 bg-slate-100 rounded-xl shrink-0" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : !activeCat ? (
                          /* Empty state: chưa chọn danh mục */
                          <div className={`${glassCardClass} flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[500px]`}>
                            <div className="p-5 bg-white/40 border border-white/60 rounded-xl mb-4">
                              <PanelLeftClose size={40} strokeWidth={1.5} className="text-slate-300" />
                            </div>
                            <h3 className="text-[16px] font-bold text-slate-700 mb-1">Chọn một danh mục</h3>
                            <p className="text-[13px] text-slate-400 font-medium max-w-[260px]">
                              Chọn một danh mục ở bên trái để xem và quản lý tiêu chí
                            </p>
                          </div>
                        ) : (
                          /* Panel hiển thị tiêu chí của danh mục đang chọn */
                          <div className={`${glassCardClass} overflow-hidden flex flex-col min-h-[500px]`}>
                            {/* Header thông tin danh mục */}
                            <div className="px-4 py-4 md:px-6 border-b border-white/60 bg-gradient-to-r from-white/30 to-white/60 backdrop-blur-sm">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                                  {/* Nút quay lại trên mobile */}
                                  <button
                                    onClick={() => setSelectedCategoryId(null)}
                                    className="lg:hidden p-1.5 hover:bg-white/60 rounded-xl text-slate-500 hover:text-slate-700 transition-colors mr-1 cursor-pointer shrink-0"
                                    title="Quay lại danh sách"
                                  >
                                    <ChevronLeft size={18} strokeWidth={2.5} />
                                  </button>
                                  <div
                                    className="w-1.5 h-10 rounded-xl shrink-0"
                                    style={{ backgroundColor: borderColors[categories.findIndex(c => c.id === activeCat.id) % borderColors.length] }}
                                  />
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <span className={`px-2 py-0.5 rounded-xl text-[9px] font-bold tracking-wider uppercase shrink-0 ${bgBadgeColors[categories.findIndex(c => c.id === activeCat.id) % bgBadgeColors.length]}`}>
                                      {activeCat.id}
                                    </span>
                                    <h2 className="font-bold text-slate-800 text-[15px] sm:text-[16px] leading-[22px] flex items-center min-w-0 max-w-[150px] sm:max-w-md lg:max-w-none">
                                      <FullContentPopover content={activeCat.name} label="Nội dung danh mục:" threshold={100} className="truncate" />
                                    </h2>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 items-center text-[11px] text-slate-500 font-medium pl-[18px] mt-2">
                                        <div className={`flex gap-1 items-center ${isActiveCriteriaTotalOverMax ? 'text-red-600' : ''}`}>
                                          <span>Điểm tối đa:</span>
                                          <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${isActiveCriteriaTotalOverMax ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50'}`}>{activeCat.maxPoints}</span>
                                        </div>
                                        <div className="flex gap-1 items-center">
                                          <span>Tổng tiêu chí:</span>
                                          <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[11px]">{String(activeCriteria.length).padStart(2, '0')}</span>
                                        </div>
                                        <div className="flex gap-1 items-center">
                                          <span>Tổng điểm tiêu chí:</span>
                                          <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[11px]">{activeCriteriaTotalMaxPoints}</span>
                                        </div>
                                      </div>
                            </div>

                            {/* Toolbar */}
                            <div className="px-6 py-2  flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  checked={isAllCriteriaInCatSelected(activeCat.id, activeCriteria)}
                                  ref={(el) => { if (el) el.indeterminate = isSomeCriteriaInCatSelected(activeCat.id, activeCriteria); }}
                                  onChange={() => toggleSelectAllCriteriaInCat(activeCat.id, activeCriteria)}
                                />
                                <span className="text-[11px] font-semibold text-slate-400 tracking-wide uppercase">Chọn tất cả</span>
                                {activeCriteria.some(c => isCriteriaSelected(c.id)) && (
                                  <button
                                    onClick={() => handleDeleteSelectedCriteria(activeCat.id)}
                                    className="ml-2 flex items-center gap-1 px-2.5 py-1 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={12} strokeWidth={2.5} />
                                    Xóa đã chọn
                                  </button>
                                )}
                              </div>
                              <button
                                onClick={() => { setIsEditingCriteria(false); setSelectedCriteria(null); setTargetCategoryId(activeCat.id); setIsCriteriaModalOpen(true); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-[12px] font-bold transition-colors cursor-pointer"
                              >
                                <Plus size={14} strokeWidth={2.5} />
                                Thêm tiêu chí
                              </button>
                            </div>

                            {/* Criteria List */}
                            <div className="flex-1 overflow-y-auto px-3 custom-scrollbar">
                              {activeCriteria.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                                  <div className="p-4 bg-white/40 border border-white/60 rounded-xl mb-3">
                                    <Plus size={28} strokeWidth={1.5} className="text-slate-300" />
                                  </div>
                                  <p className="text-[13px] text-slate-400 font-medium">Chưa có tiêu chí nào</p>
                                  <button
                                    onClick={() => { setIsEditingCriteria(false); setSelectedCriteria(null); setTargetCategoryId(activeCat.id); setIsCriteriaModalOpen(true); }}
                                    className="text-blue-600 hover:text-blue-700 text-[12px] font-bold hover:underline cursor-pointer mt-2"
                                  >
                                    + Thêm tiêu chí đầu tiên
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2.5">
                                  <AnimatePresence>
                                    {activeCriteria.map((item, itemIdx) => {
                                      let typeLabel = 'CỘNG ĐIỂM';
                                      let typeClass = 'bg-blue-50 text-blue-700 border-blue-100/50';
                                      let pointClass = 'text-blue-600';
                                      let formattedPoints = `+${item.points}đ/lần`;
                                      let pointBg = 'bg-blue-50';
                                      if (item.type === 'khen_thuong') {
                                        typeLabel = 'KHEN THƯỞNG';
                                        typeClass = 'bg-[rgba(36,136,63,0.1)] text-[#006d2b] border-[#24883f]/10';
                                        pointClass = 'text-[#006d2b]';
                                        pointBg = 'bg-[#f0fdf4]';
                                      } else if (item.type === 'ky_luat') {
                                        typeLabel = 'KỶ LUẬT';
                                        typeClass = 'bg-[rgba(255,218,214,0.3)] text-[#ba1a1a] border-[#ffdad6]/20';
                                        pointClass = 'text-[#ba1a1a]';
                                        formattedPoints = `${item.points}đ/lần`;
                                        pointBg = 'bg-red-50';
                                      }

                                      return (
                                        <motion.div
                                          key={item.id}
                                          layout
                                          initial={{ opacity: 0, y: 8 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          exit={{ opacity: 0, x: -20 }}
                                          transition={{ delay: itemIdx * 0.02 }}
                                        >
                                          <div className="group bg-white/50 backdrop-blur-sm border border-white/80 hover:border-white/100 rounded-xl px-3 py-3 flex items-center gap-4 transition-all duration-150 ease-out hover:scale-[1.01] hover:bg-white/60 hover:shadow-sm shadow-sm shadow-slate-300/20">
                                            {/* Checkbox */}
                                            <input
                                              type="checkbox"
                                              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                                              checked={isCriteriaSelected(item.id)}
                                              onChange={() => toggleCriteriaSelection(item.id)}
                                            />

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                              <h4 className="font-bold text-slate-800 text-[13px] flex items-center min-w-0">
                                                <FullContentPopover content={item.name} label="Nội dung tiêu chí:" threshold={50} className="truncate" />
                                              </h4>
                                              <div className="flex items-center gap-2 mt-1.5">
                                                <span className={`px-2 py-0.5 rounded-xl text-[8px] font-extrabold uppercase border tracking-wider ${typeClass}`}>
                                                  {typeLabel}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                  <span className="text-[12px] font-medium text-slate-400">Dải điểm: {item.minPoints} — {item.maxPoints}</span>
                                                  {item.is_locked && (
                                                    <Lock size={12} className="text-red-500 shrink-0" strokeWidth={2.5} />
                                                  )}
                                                </div>
                                              </div>
                                            </div>

                                            {/* Points */}
                                            <div className={`px-3 py-1.5 rounded-xl ${pointBg} shrink-0`}>
                                              <span className={`font-black text-[12px] ${pointClass}`}>{formattedPoints}</span>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                                              <button
                                                onClick={() => { setIsEditingCriteria(true); setSelectedCriteria(item); setTargetCategoryId(activeCat.id); setIsCriteriaModalOpen(true); }}
                                                className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/40 border border-white/70 text-slate-500 hover:text-[#1A73E8] hover:bg-white/70 transition-all duration-150 cursor-pointer"
                                                title="Sửa tiêu chí"
                                              >
                                                <Pencil size={13} strokeWidth={2.5} />
                                              </button>
                                              <button
                                                onClick={() => { setCriteriaToDelete(item); setIsDeleteCriteriaModalOpen(true); }}
                                                className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/40 border border-white/70 text-slate-500 hover:text-rose-600 hover:bg-rose-50/70 transition-all duration-150 cursor-pointer"
                                                title="Xóa tiêu chí"
                                              >
                                                <Trash2 size={13} strokeWidth={2.5} />
                                              </button>
                                            </div>
                                          </div>
                                        </motion.div>
                                      );
                                    })}
                                  </AnimatePresence>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ===== CHẾ ĐỘ KANBAN (Layout hiện tại) ===== */}
                {viewMode === 'kanban' && (
                  <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
                    <div
                      onDragOver={(e) => handleColumnDragOver(e, 'col-1')}
                      onDragLeave={handleColumnDragLeave}
                      onDrop={(e) => handleColumnDrop(e, 'col-1')}
                      className={`flex-1 flex flex-col gap-4 p-4 rounded-2xl transition-all duration-300 min-h-[500px] w-full ${dragOverColumnId === 'col-1' ? 'ring-2 ring-[#1A73E8]/30 bg-white/45 border border-[#1A73E8]/30' : 'bg-white/30 backdrop-blur-md border border-white/60'}`}
                    >
                      {isInitialLoading ? (
                        <>
                          <div className="bg-white/55 backdrop-blur-md border border-white/75 border-t-[3px] border-[#60a5fa] border-solid flex flex-col items-start overflow-hidden pt-1 relative rounded-xl shadow-sm w-full animate-pulse">
                            <div className="w-full px-5 py-4 flex flex-col gap-2">
                              <div className="flex items-start justify-between w-full">
                                <div className="flex flex-col gap-1.5 w-2/3">
                                  <Skeleton className="h-4 w-16 bg-slate-100/80 rounded-xl" />
                                  <Skeleton className="h-5 w-full bg-slate-100/80 rounded-xl mt-1" />
                                </div>
                                <div className="flex gap-1.5 items-center">
                                  <Skeleton className="h-7 w-7 bg-slate-100/80 rounded-xl animate-pulse" />
                                  <Skeleton className="h-7 w-7 bg-slate-100/80 rounded-xl animate-pulse" />
                                  <Skeleton className="h-7 w-7 bg-slate-100/80 rounded-xl animate-pulse" />
                                </div>
                              </div>
                              <div className="flex gap-4 items-center mt-1">
                                <Skeleton className="h-4 w-24 bg-slate-100/80 rounded-xl" />
                                <Skeleton className="h-4 w-20 bg-slate-100/80 rounded-xl" />
                              </div>
                            </div>
                          </div>
                          <div className="bg-white/55 backdrop-blur-md border border-white/75 border-t-[3px] border-[#34d399] border-solid flex flex-col items-start overflow-hidden pt-1 relative rounded-xl shadow-sm w-full animate-pulse">
                            <div className="w-full px-5 py-4 flex flex-col gap-2">
                              <div className="flex items-start justify-between w-full">
                                <div className="flex flex-col gap-1.5 w-2/3">
                                  <Skeleton className="h-4 w-16 bg-slate-100/80 rounded-xl" />
                                  <Skeleton className="h-5 w-full bg-slate-100/80 rounded-xl mt-1" />
                                </div>
                                <div className="flex gap-1.5 items-center">
                                  <Skeleton className="h-7 w-7 bg-slate-100/80 rounded-xl animate-pulse" />
                                  <Skeleton className="h-7 w-7 bg-slate-100/80 rounded-xl animate-pulse" />
                                  <Skeleton className="h-7 w-7 bg-slate-100/80 rounded-xl animate-pulse" />
                                </div>
                              </div>
                              <div className="flex gap-4 items-center mt-1">
                                <Skeleton className="h-4 w-24 bg-slate-100/80 rounded-xl" />
                                <Skeleton className="h-4 w-20 bg-slate-100/80 rounded-xl" />
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        categories.filter(cat => cat.columnId === 'col-1' || !cat.columnId).map((cat, idx) => {
                          const catCriteria = criteria.filter(c => c.categoryId === cat.id);
                          const isOver = dragOverCategoryId === cat.id;
                          const isExpanded = !!expandedCategories[cat.id];
                          const criteriaTotalMaxPoints = getCategoryCriteriaTotalMaxPoints(cat.id);
                          const isCriteriaTotalOverMax = criteriaTotalMaxPoints > Number(cat.maxPoints || 0);
                          const borderColors = ['border-[#60a5fa]', 'border-[#34d399]', 'border-[#fbbf24]', 'border-[#c084fc]'];
                          const bgBadgeColors = ['bg-[#d8e2ff] text-[#005bbf]', 'bg-[#96f8a1]/30 text-[#006d2b]', 'bg-[rgba(249,171,0,0.1)] text-[#f9ab00]', 'bg-[#f3e5f5] text-[#7b2cbf]'];
                          const borderClass = borderColors[idx % borderColors.length];
                          const badgeClass = bgBadgeColors[idx % bgBadgeColors.length];
                          return (
                            <motion.div layout="position" key={cat.id} className={`w-full ${draggingCategoryId === cat.id ? 'opacity-40' : ''}`}>
                              <div draggable onDragStart={(e) => handleCategoryDragStart(e, cat.id)} onDragEnd={handleCategoryDragEnd} onDragOver={(e) => handleDragOver(e, cat.id)} onDragLeave={() => handleDragLeave(cat.id)} onDrop={(e) => handleDrop(e, cat.id)} className={`bg-white/40 backdrop-blur-md border border-white/70 flex flex-col items-start overflow-hidden relative rounded-xl shadow-sm shadow-slate-300/40 transition-all duration-150 w-full cursor-grab active:cursor-grabbing hover:shadow-md ${isOver ? 'ring-2 ring-[#1A73E8] scale-[1.01] bg-white/50' : 'hover:scale-[1.01]'}`}>
                                <div className={`border-white/40 ${isExpanded ? 'border-b' : ''} border-solid w-full px-4 py-4 flex flex-col gap-2 cursor-pointer select-none hover:bg-white/50 transition-colors`} onClick={() => toggleCategoryExpand(cat.id)}>
                                  <div className="flex items-start justify-between w-full">
                                    <div className="flex flex-col gap-0.5">
                                      <span className={`px-2 py-0.5 rounded-xl text-[10px] font-bold tracking-wider uppercase inline-block w-fit ${badgeClass}`}>{cat.id}</span>
                                      <h3 className="font-bold text-slate-800 text-[15px] leading-[20px] mt-1 flex items-center min-w-0">
                                        <FullContentPopover content={cat.name} label="Nội dung danh mục:" threshold={100} className="truncate" />
                                      </h3>
                                    </div>
                                    <div className="flex gap-1 items-center">
                                      <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); setSelectedCategory(cat); setIsModalOpen(true); }} className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/40 border border-white/70 text-slate-500 hover:text-[#1A73E8] hover:bg-white/70 transition-all duration-150 cursor-pointer" title="Sửa danh mục"><Pencil size={14} strokeWidth={2.5} /></button>
                                      <button onClick={(e) => { e.stopPropagation(); setCategoryToDelete(cat); setIsDeleteModalOpen(true); }} className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/40 border border-white/70 text-slate-500 hover:text-rose-600 hover:bg-rose-50/70 transition-all duration-150 cursor-pointer" title="Xóa danh mục"><Trash2 size={14} strokeWidth={2.5} /></button>
                                      <button onClick={(e) => { e.stopPropagation(); toggleCategoryExpand(cat.id); }} className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/40 border border-white/70 text-slate-500 hover:text-slate-700 hover:bg-white/60 transition-all cursor-pointer ml-0.5" title={isExpanded ? "Thu gọn" : "Mở rộng"}><motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown size={15} strokeWidth={2.5} /></motion.div></button>
                                    </div>
                                  </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 items-center text-[11px] text-slate-500 font-medium tracking-wide">
                                    <div className={`flex gap-1 items-center ${isCriteriaTotalOverMax ? 'text-red-600' : ''}`}><span>Điểm tối đa:</span><span className={`font-bold px-1.5 py-0.5 rounded-xl ${isCriteriaTotalOverMax ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50/50'}`}>{cat.maxPoints}</span></div>
                                    <div className="flex gap-1 items-center"><span>Số tiêu chí:</span><span className="font-bold text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded-xl">{String(catCriteria.length).padStart(2, '0')}</span></div>
                                    <div className="flex gap-1 items-center"><span>Tổng điểm tiêu chí:</span><span className="font-bold text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded-xl">{criteriaTotalMaxPoints}</span></div>
                                  </div>
                                </div>
                                <AnimatePresence initial={false}>
                                  {isExpanded && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeInOut' }} className="w-full overflow-hidden">
                                      <div className="bg-white/35 backdrop-blur-md border-t border-white/60 w-full p-5 flex flex-col gap-4">
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
                                                    <div draggable onDragStart={(e) => handleDragStart(e, item.id)} onDragEnd={handleDragEnd} className="bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl px-3 py-3 flex flex-col gap-3 shadow-sm shadow-slate-300/20 hover:bg-white/60 hover:shadow-sm hover:border-white/100 transition-all duration-150 ease-out hover:scale-[1.01] group cursor-grab active:cursor-grabbing relative overflow-hidden w-full">
                                                      <div className="flex items-center justify-between w-full">
                                                        <div className="flex items-center gap-3">
                                                          <div className="text-slate-300 group-hover:text-slate-400 transition-colors shrink-0"><GripVertical size={16} /></div>
                                                          <div className="flex flex-col gap-1">
                                                            <h4 className="font-bold text-slate-800 text-[13px] leading-[18px] group-hover:text-[#1A73E8] transition-colors flex items-center min-w-0">
                                                              <FullContentPopover content={item.name} label="Nội dung tiêu chí:" threshold={50} className="truncate" />
                                                            </h4>
                                                            <span className={`px-2 py-0.5 rounded-xl text-[8px] font-extrabold uppercase border tracking-wider w-fit ${typeClass}`}>{typeLabel}</span>
                                                          </div>
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
                                                        <div className="flex items-center gap-1">
                                                          <span className="text-[12px] font-semibold text-slate-500">Dải điểm: {item.minPoints} - {item.maxPoints}</span>
                                                          {item.is_locked && (
                                                            <Lock size={13} className="text-red-500 shrink-0" strokeWidth={2.5} />
                                                          )}

                                                        </div>
                                                        <div className="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                          <button onClick={(e) => { e.stopPropagation(); setIsEditingCriteria(true); setSelectedCriteria(item); setTargetCategoryId(cat.id); setIsCriteriaModalOpen(true); }} className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/40 border border-white/70 text-slate-500 hover:text-[#1A73E8] hover:bg-white/70 transition-all duration-150 cursor-pointer" title="Sửa tiêu chí"><Pencil size={14} strokeWidth={2.5} /></button>
                                                          <button onClick={(e) => { e.stopPropagation(); setCriteriaToDelete(item); setIsDeleteCriteriaModalOpen(true); }} className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/40 border border-white/70 text-slate-500 hover:text-rose-600 hover:bg-rose-50/70 transition-all duration-150 cursor-pointer" title="Xóa tiêu chí"><Trash2 size={14} strokeWidth={2.5} /></button>
                                                        </div>
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
                        })
                      )}
                    </div>
                    <div
                      onDragOver={(e) => handleColumnDragOver(e, 'col-2')}
                      onDragLeave={handleColumnDragLeave}
                      onDrop={(e) => handleColumnDrop(e, 'col-2')}
                      className={`flex-1 flex flex-col gap-4 p-4 rounded-2xl transition-all duration-300 min-h-[500px] w-full ${dragOverColumnId === 'col-2' ? 'ring-2 ring-[#1A73E8]/30 bg-white/45 border border-[#1A73E8]/30' : 'bg-white/30 backdrop-blur-md border border-white/60'}`}
                    >
                      {isInitialLoading ? (
                        <>
                          <div className="bg-white/55 backdrop-blur-md border border-white/75 border-t-[3px] border-[#fbbf24] border-solid flex flex-col items-start overflow-hidden pt-1 relative rounded-xl shadow-sm w-full animate-pulse">
                            <div className="w-full px-5 py-4 flex flex-col gap-2">
                              <div className="flex items-start justify-between w-full">
                                <div className="flex flex-col gap-1.5 w-2/3">
                                  <Skeleton className="h-4 w-16 bg-slate-100/80 rounded-xl" />
                                  <Skeleton className="h-5 w-full bg-slate-100/80 rounded-xl mt-1" />
                                </div>
                                <div className="flex gap-1.5 items-center">
                                  <Skeleton className="h-7 w-7 bg-slate-100/80 rounded-xl animate-pulse" />
                                  <Skeleton className="h-7 w-7 bg-slate-100/80 rounded-xl animate-pulse" />
                                  <Skeleton className="h-7 w-7 bg-slate-100/80 rounded-xl animate-pulse" />
                                </div>
                              </div>
                              <div className="flex gap-4 items-center mt-1">
                                <Skeleton className="h-4 w-24 bg-slate-100/80 rounded-xl" />
                                <Skeleton className="h-4 w-20 bg-slate-100/80 rounded-xl" />
                              </div>
                            </div>
                          </div>
                          <div className="bg-white/55 backdrop-blur-md border border-white/75 border-t-[3px] border-[#c084fc] border-solid flex flex-col items-start overflow-hidden pt-1 relative rounded-xl shadow-sm w-full animate-pulse">
                            <div className="w-full px-5 py-4 flex flex-col gap-2">
                              <div className="flex items-start justify-between w-full">
                                <div className="flex flex-col gap-1.5 w-2/3">
                                  <Skeleton className="h-4 w-16 bg-slate-100/80 rounded-xl" />
                                  <Skeleton className="h-5 w-full bg-slate-100/80 rounded-xl mt-1" />
                                </div>
                                <div className="flex gap-1.5 items-center">
                                  <Skeleton className="h-7 w-7 bg-slate-100/80 rounded-xl animate-pulse" />
                                  <Skeleton className="h-7 w-7 bg-slate-100/80 rounded-xl animate-pulse" />
                                  <Skeleton className="h-7 w-7 bg-slate-100/80 rounded-xl animate-pulse" />
                                </div>
                              </div>
                              <div className="flex gap-4 items-center mt-1">
                                <Skeleton className="h-4 w-24 bg-slate-100/80 rounded-xl" />
                                <Skeleton className="h-4 w-20 bg-slate-100/80 rounded-xl" />
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        categories.filter(cat => cat.columnId === 'col-2').map((cat, idx) => {
                          const catCriteria = criteria.filter(c => c.categoryId === cat.id);
                          const isOver = dragOverCategoryId === cat.id;
                          const isExpanded = !!expandedCategories[cat.id];
                          const criteriaTotalMaxPoints = getCategoryCriteriaTotalMaxPoints(cat.id);
                          const isCriteriaTotalOverMax = criteriaTotalMaxPoints > Number(cat.maxPoints || 0);
                          const borderColors = ['border-[#60a5fa]', 'border-[#34d399]', 'border-[#fbbf24]', 'border-[#c084fc]'];
                          const bgBadgeColors = ['bg-[#d8e2ff] text-[#005bbf]', 'bg-[#96f8a1]/30 text-[#006d2b]', 'bg-[rgba(249,171,0,0.1)] text-[#f9ab00]', 'bg-[#f3e5f5] text-[#7b2cbf]'];
                          const borderClass = borderColors[(idx + 2) % borderColors.length];
                          const badgeClass = bgBadgeColors[(idx + 2) % bgBadgeColors.length];
                          return (
                            <motion.div layout="position" key={cat.id} className={`w-full ${draggingCategoryId === cat.id ? 'opacity-40' : ''}`}>
                              <div draggable onDragStart={(e) => handleCategoryDragStart(e, cat.id)} onDragEnd={handleCategoryDragEnd} onDragOver={(e) => handleDragOver(e, cat.id)} onDragLeave={() => handleDragLeave(cat.id)} onDrop={(e) => handleDrop(e, cat.id)} className={`bg-white/55 backdrop-blur-md border border-white/75 border-t-[3px] ${borderClass} border-solid flex flex-col items-start overflow-hidden pt-1 relative rounded-xl shadow-sm transition-all duration-300 w-full cursor-grab active:cursor-grabbing hover:shadow-sm ${isOver ? 'ring-2 ring-[#1A73E8] scale-[1.01] bg-white/45' : ''}`}>
                                <div className={`border-[#f1f5f9] ${isExpanded ? 'border-b' : ''} border-solid w-full px-5 py-4 flex flex-col gap-2 cursor-pointer select-none hover:bg-slate-50/40 transition-colors`} onClick={() => toggleCategoryExpand(cat.id)}>
                                  <div className="flex items-start justify-between w-full">
                                    <div className="flex flex-col gap-0.5">
                                      <span className={`px-2 py-0.5 rounded-xl text-[10px] font-bold tracking-wider uppercase inline-block w-fit ${badgeClass}`}>{cat.id}</span>
                                      <h3 className="font-bold text-slate-800 text-[15px] leading-[20px] mt-1 flex items-center min-w-0">
                                        <FullContentPopover content={cat.name} label="Nội dung danh mục:" threshold={100} className="truncate" />
                                      </h3>
                                    </div>
                                    <div className="flex gap-1 items-center">
                                      <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); setSelectedCategory(cat); setIsModalOpen(true); }} className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/40 border border-white/70 text-slate-500 hover:text-[#1A73E8] hover:bg-white/70 transition-all duration-150 cursor-pointer" title="Sửa danh mục"><Pencil size={14} strokeWidth={2.5} /></button>
                                      <button onClick={(e) => { e.stopPropagation(); setCategoryToDelete(cat); setIsDeleteModalOpen(true); }} className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/40 border border-white/70 text-slate-500 hover:text-rose-600 hover:bg-rose-50/70 transition-all duration-150 cursor-pointer" title="Xóa danh mục"><Trash2 size={14} strokeWidth={2.5} /></button>
                                      <button onClick={(e) => { e.stopPropagation(); toggleCategoryExpand(cat.id); }} className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/40 border border-white/70 text-slate-500 hover:text-slate-700 hover:bg-white/60 transition-all cursor-pointer ml-0.5" title={isExpanded ? "Thu gọn" : "Mở rộng"}><motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown size={15} strokeWidth={2.5} /></motion.div></button>
                                    </div>
                                  </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 items-center text-[11px] text-slate-500 font-medium tracking-wide">
                                    <div className={`flex gap-1 items-center ${isCriteriaTotalOverMax ? 'text-red-600' : ''}`}><span>Điểm tối đa:</span><span className={`font-bold px-1.5 py-0.5 rounded-xl ${isCriteriaTotalOverMax ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50/50'}`}>{cat.maxPoints}</span></div>
                                    <div className="flex gap-1 items-center"><span>Số tiêu chí:</span><span className="font-bold text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded-xl">{String(catCriteria.length).padStart(2, '0')}</span></div>
                                    <div className="flex gap-1 items-center"><span>Tổng điểm tiêu chí:</span><span className="font-bold text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded-xl">{criteriaTotalMaxPoints}</span></div>
                                  </div>
                                </div>
                                <AnimatePresence initial={false}>
                                  {isExpanded && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeInOut' }} className="w-full overflow-hidden">
                                      <div className="bg-white/35 backdrop-blur-md border-t border-white/60 w-full p-5 flex flex-col gap-4">
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
                                                    <div draggable onDragStart={(e) => handleDragStart(e, item.id)} onDragEnd={handleDragEnd} className="bg-white/55 backdrop-blur-sm border border-white/70 rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-sm hover:border-blue-100 transition-all duration-150 ease-out hover:scale-[1.01] group cursor-grab active:cursor-grabbing relative overflow-hidden w-full">
                                                      <div className="flex items-center justify-between w-full">
                                                        <div className="flex items-center gap-3">
                                                          <div className="text-slate-300 group-hover:text-slate-400 transition-colors shrink-0"><GripVertical size={16} /></div>
                                                          <div className="flex flex-col gap-1">
                                                            <h4 className="font-bold text-slate-800 text-[13px] flex items-center min-w-0">
                                                              <FullContentPopover content={item.name} label="Nội dung tiêu chí:" threshold={50} className="truncate" />
                                                            </h4>
                                                            <span className={`px-2 py-0.5 rounded-xl text-[8px] font-extrabold uppercase border tracking-wider w-fit ${typeClass}`}>{typeLabel}</span>
                                                          </div>
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
                                                        <div className="flex items-center gap-1">
                                                          <span className="text-[10px] font-semibold text-slate-500">Dải điểm: {item.minPoints} - {item.maxPoints}</span>
                                                          {item.is_locked && (
                                                            <Lock size={11} className="text-red-500 shrink-0" strokeWidth={2.5} />
                                                          )}
                                                        </div>
                                                        <div className="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                          <button onClick={(e) => { e.stopPropagation(); setIsEditingCriteria(true); setSelectedCriteria(item); setTargetCategoryId(cat.id); setIsCriteriaModalOpen(true); }} className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/40 border border-white/70 text-slate-500 hover:text-[#1A73E8] hover:bg-white/70 transition-all duration-150 cursor-pointer" title="Sửa tiêu chí"><Pencil size={14} strokeWidth={2.5} /></button>
                                                          <button onClick={(e) => { e.stopPropagation(); setCriteriaToDelete(item); setIsDeleteCriteriaModalOpen(true); }} className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/40 border border-white/70 text-slate-500 hover:text-rose-600 hover:bg-rose-50/70 transition-all duration-150 cursor-pointer" title="Xóa tiêu chí"><Trash2 size={14} strokeWidth={2.5} /></button>
                                                        </div>
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
                        })
                      )}
                    </div>

                  </div>
                )}

                {/* Stats Row on Mobile */}
                <div className="block lg:hidden shrink-0 mt-2">
                  {renderStatsRow(true)}
                </div>
              </div>
            </div>
          </main>

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
          criteria={criteria}
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
    </>
  );
}

export default function ProtectedCategoriesPage() {
  return (
    <RouteGuard requiredPermission="GRADING_PAGE">
      <CategoriesPage />
    </RouteGuard>
  );
}

