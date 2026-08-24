'use client';
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Calendar as CalendarIcon, Loader2, Plus, Trash2, AlertTriangle, FileText, Check, Users, Save, Settings, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectLabel, SelectSeparator } from '@/components/ui/select';
import { format, parse } from 'date-fns';
import { toast } from 'sonner';
import { classApi, Class } from '@/api/class-api';
import { studentApi, Student } from '@/api/student-api';
import { criteriaApi, Criterion } from '@/api/criteria-api';
import { academicRecordApi, AcademicRecord } from '@/api/academic-record-api';
import { semesterApi } from '@/api/semester-api';
import { summariesPointApi } from '@/api/summaries-point-api';
import { evaluationDetailApi } from '@/api/evaluation-detail-api';
import { useAuth } from '@/providers/auth-provider';
import { useLinkedTaskProgress } from '@/hooks/useLinkedTaskProgress';
import { incrementCriterionUsage, orderCriteriaByUsage, readCriterionUsage, CriterionUsage } from './criterion-usage';

interface ViolationItem {
  student_id: string;
  class_id?: string;
  student_name: string;
  student_code: string;
  evaluation_detail_id: string;
  criterion_name: string;
  points_effect: number;
  class_note: string;
}

export function buildViolationItems(
  students: Student[],
  selectedStudentIds: string[],
  criterion: Pick<Criterion, '_id' | 'criterion_name' | 'score_per_unit' | 'min_score'>,
  note: string,
  existing: ViolationItem[],
): ViolationItem[] {
  return students
    .filter(student => selectedStudentIds.includes(student._id))
    .filter(student => !existing.some(
      violation => violation.student_id === student._id && violation.evaluation_detail_id === criterion._id
    ))
    .map(student => ({
      student_id: student._id,
      class_id: typeof student.class_id === 'object' ? student.class_id?._id : student.class_id,
      student_name: student.full_name,
      student_code: student.student_code,
      evaluation_detail_id: criterion._id,
      criterion_name: criterion.criterion_name,
      points_effect: criterion.score_per_unit || criterion.min_score || -5,
      class_note: note.trim() || 'Không có ghi chú',
    }));
}

export function mergeStudentsById(studentGroups: Student[][]): Student[] {
  const studentsById = new Map<string, Student>();
  studentGroups.flat().forEach(student => studentsById.set(student._id, student));
  return Array.from(studentsById.values());
}

export function clearPendingQuickViolations(violations: ViolationItem[], pendingKeys: Set<string>): ViolationItem[] {
  return violations.filter(violation => !pendingKeys.has(`${violation.student_id}:${violation.evaluation_detail_id}`));
}

export function toggleStudentSelectionState(
  selectedIds: string[],
  selectedStudents: Student[],
  student: Student,
): { selectedIds: string[]; selectedStudents: Student[] } {
  if (selectedIds.includes(student._id)) {
    return {
      selectedIds: selectedIds.filter(id => id !== student._id),
      selectedStudents: selectedStudents.filter(item => item._id !== student._id),
    };
  }
  return {
    selectedIds: [...selectedIds, student._id],
    selectedStudents: selectedStudents.some(item => item._id === student._id)
      ? selectedStudents
      : [...selectedStudents, student],
  };
}

interface AddRecordViewProps {
  onBack: () => void;
  onSuccess?: () => void;
  recordToEdit?: AcademicRecord | null;
  taskId?: string | null;
}

export default function AddRecordView({ onBack, onSuccess, recordToEdit, taskId }: AddRecordViewProps) {
  const { user } = useAuth();

  useLinkedTaskProgress({
    taskId,
    linkedPage: '/students/record',
    sourceType: 'student_record',
  });

  const [classes, setClasses] = useState<Class[]>([]);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [criterionUsage, setCriterionUsage] = useState<CriterionUsage>({});

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isStudentsLoading, setIsStudentsLoading] = useState(false);

  // Card Trái (Thông tin cơ bản)
  const [classId, setClassId] = useState('');
  const [classIds, setClassIds] = useState<string[]>([]);
  const [classSearch, setClassSearch] = useState('');
  const [isClassPickerOpen, setIsClassPickerOpen] = useState(false);
  const classIdsRef = React.useRef<string[]>([]);
  const [category, setCategory] = useState('ky_luat'); // 'ky_luat' hoặc 'khen_thuong'
  const [criterionId, setCriterionId] = useState('');
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Card Phải (Ghi nhận sinh viên)
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [entryMode, setEntryMode] = useState<'manual' | 'quick'>('quick');
  const [isMobile, setIsMobile] = useState(false);
  const [pendingQuickViolationKeys, setPendingQuickViolationKeys] = useState<Set<string>>(new Set());
  const [violationNote, setViolationNote] = useState('');
  const [addedViolations, setAddedViolations] = useState<ViolationItem[]>([]);
  const [activeSemesterId, setActiveSemesterId] = useState('60d0fe4f5311236168a109cb');

  const isEditMode = Boolean(recordToEdit && recordToEdit._id);

  useEffect(() => {
    setCriterionUsage(readCriterionUsage(user?.id));
  }, [user?.id]);

  // Load classes, students, criteria
  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true);
      try {
        const classList = await classApi.getClasses();
        setClasses(classList);

        const criteriaList = await criteriaApi.getCriteria();
        setCriteria(criteriaList);

        // Lấy thông tin học kỳ đang hoạt động
        try {
          const semesterList = await semesterApi.getSemesters();
          const activeSem = semesterList.find(s => s.status === 'active');
          if (activeSem) {
            setActiveSemesterId(activeSem._id);
          } else if (semesterList.length > 0) {
            setActiveSemesterId(semesterList[0]._id);
          }
        } catch (semErr) {
          console.warn('Lỗi khi nạp kì học:', semErr);
        }

        if (recordToEdit) {
          const studentObj = typeof recordToEdit.student_id === 'object' ? recordToEdit.student_id : null;
          const studentIdStr = studentObj ? studentObj._id : (typeof recordToEdit.student_id === 'string' ? recordToEdit.student_id : '');
          
          // Resolve class from student object or by calling student API
          let classIdFromRecord = '';
          if (studentObj?.class_id) {
            classIdFromRecord = typeof studentObj.class_id === 'object' ? studentObj.class_id?._id : studentObj.class_id;
          } else if (studentIdStr) {
            try {
              const sObj = await studentApi.getStudent(studentIdStr);
              if (sObj) {
                classIdFromRecord = typeof sObj.class_id === 'object' ? sObj.class_id?._id : sObj.class_id;
              }
            } catch (err) {
              console.warn('Lỗi phân giải lớp từ sinh viên:', err);
            }
          }

          const criterionObj = typeof recordToEdit.criterion_id === 'object'
            ? recordToEdit.criterion_id
            : typeof recordToEdit.evaluation_detail_id === 'object'
              ? recordToEdit.evaluation_detail_id
              : null;
          const criterionIdFromRecord = recordToEdit.criterion_id
            ? (typeof recordToEdit.criterion_id === 'object' ? recordToEdit.criterion_id?._id : recordToEdit.criterion_id)
            : recordToEdit.criteria_id
              ? (typeof recordToEdit.criteria_id === 'object' ? recordToEdit.criteria_id?._id : recordToEdit.criteria_id)
              : criterionObj
                ? (typeof criterionObj.criterion_id === 'object' ? criterionObj.criterion_id?._id : criterionObj.criterion_id)
                : recordToEdit.evaluation_detail_id;
          const semesterId = typeof recordToEdit.semester_id === 'object'
            ? recordToEdit.semester_id?._id
            : recordToEdit.semester_id;

          if (classIdFromRecord) {
            setClassId(classIdFromRecord);
            setClassIds(classIdFromRecord ? [classIdFromRecord] : []);
          }
          if (criterionIdFromRecord) {
            setCriterionId(String(criterionIdFromRecord));
          }
          if (studentIdStr) {
            setSelectedStudentId(studentIdStr);
          }
          setViolationNote(recordToEdit.description || '');

          try {
            const sourceDate = recordToEdit.recorded_at || recordToEdit.date_record || recordToEdit.createdAt;
            if (sourceDate) {
              const parsed = sourceDate.includes('/')
                ? parse(sourceDate, 'dd/MM/yyyy', new Date())
                : new Date(sourceDate);
              if (!Number.isNaN(parsed.getTime())) {
                setReportDate(parsed);
              }
            }
          } catch (dateErr) {
            console.warn('Lỗi parse ngày ghi nhận:', dateErr);
          }

          if (semesterId) {
            setActiveSemesterId(String(semesterId));
          }
          setAddedViolations([]);
        }
      } catch (err) {
        console.error('Lỗi nạp dữ liệu:', err);
        toast.error('Không thể nạp dữ liệu ban đầu');
      } finally {
        setIsLoadingData(false);
      }
    }
    loadData();
  }, [recordToEdit]);

  const [studentsPages, setStudentsPages] = useState<Record<string, number>>({});
  const [studentsSearch, setStudentsSearch] = useState("");
  const [hasMoreStudents, setHasMoreStudents] = useState<Record<string, boolean>>({});

  const fetchClassStudents = async (selectedClassId: string, page: number, searchVal: string, append: boolean = false) => {
    setIsStudentsLoading(true);
    try {
      const limit = 30;
      const res = await studentApi.getStudents({
        classId: selectedClassId,
        page,
        limit,
        search: searchVal || undefined
      });
      
      const newStudents = (Array.isArray(res) ? res : (res?.data || [])).map(student => ({
        ...student,
        class_id: student.class_id || selectedClassId,
      }));
      if (!classIdsRef.current.includes(selectedClassId)) return;
      setClassStudents(prev => mergeStudentsById([
        append ? prev : prev.filter(student => {
          const studentClassId = typeof student.class_id === 'object' ? student.class_id?._id : student.class_id;
          return studentClassId !== selectedClassId;
        }),
        newStudents,
      ]));
      setHasMoreStudents(prev => ({ ...prev, [selectedClassId]: newStudents.length >= limit }));
    } catch (err) {
      console.warn('Lỗi nạp sinh viên lớp:', err);
      if (!append) {
        setClassStudents(prev => prev.filter(student => {
          const studentClassId = typeof student.class_id === 'object' ? student.class_id?._id : student.class_id;
          return studentClassId !== selectedClassId;
        }));
        setHasMoreStudents(prev => ({ ...prev, [selectedClassId]: false }));
      }
    } finally {
      setIsStudentsLoading(false);
    }
  };

  const handleClassChange = (nextClassId: string) => {
    setClassId(nextClassId);
    setClassIds(nextClassId ? [nextClassId] : []);
    setSelectedStudentId('');
    setSelectedStudentIds([]);
    setSelectedStudents([]);
    setViolationNote('');
    setAddedViolations([]);
    setPendingQuickViolationKeys(new Set());
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const updateMobile = () => {
      const mobile = mediaQuery.matches;
      setIsMobile(mobile);
      if (mobile) setEntryMode('quick');
    };
    updateMobile();
    mediaQuery.addEventListener('change', updateMobile);
    return () => mediaQuery.removeEventListener('change', updateMobile);
  }, []);

  // Lọc sinh viên theo lớp học đang chọn từ backend
  useEffect(() => {
    classIdsRef.current = classIds;
    setSelectedStudentId('');
    setSelectedStudentIds([]);
    setSelectedStudents([]);
    setViolationNote('');
    setStudentsPages(Object.fromEntries(classIds.map(id => [id, 1])));
    setStudentsSearch("");
    setHasMoreStudents(Object.fromEntries(classIds.map(id => [id, true])));
    setClassStudents(prev => prev.filter(student => {
      const studentClassId = typeof student.class_id === 'object' ? student.class_id?._id : student.class_id;
      return classIds.includes(studentClassId || '');
    }));
    if (classIds.length > 0) {
      void Promise.all(classIds.map(id => fetchClassStudents(id, 1, "")));
      if (!isEditMode) {
        setAddedViolations(prev => prev.filter(violation => !violation.class_id || classIds.includes(violation.class_id)));
      }
    } else {
      setClassStudents([]);
      if (!isEditMode) setAddedViolations([]);
    }
  }, [classIds, isEditMode]);

  // Tránh search liên tục khi gõ, ta dùng debounce
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  const handleStudentSearch = (query: string) => {
    setStudentsSearch(query);
    setStudentsPages(Object.fromEntries(classIds.map(id => [id, 1])));
    setHasMoreStudents(Object.fromEntries(classIds.map(id => [id, true])));
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      void Promise.all(classIds.map(id => fetchClassStudents(id, 1, query, false)));
    }, 400);
  };

  const handleLoadMoreStudents = () => {
    if (isStudentsLoading || !classIds.some(id => hasMoreStudents[id])) return;
    const nextPages = Object.fromEntries(classIds.map(id => [id, (studentsPages[id] || 1) + 1]));
    setStudentsPages(nextPages);
    void Promise.all(classIds.filter(id => hasMoreStudents[id]).map(id => fetchClassStudents(id, nextPages[id], studentsSearch, true)));
  };

  // Lọc danh sách tiêu chí (lấy tất cả không cần qua danh mục)
  const filteredCriteria = criteria;

  const handleCriterionChange = (nextCriterionId: string) => {
    if (nextCriterionId !== criterionId && pendingQuickViolationKeys.size > 0) {
      setAddedViolations(prev => clearPendingQuickViolations(prev, pendingQuickViolationKeys));
      setPendingQuickViolationKeys(new Set());
    }
    setCriterionId(nextCriterionId);
    setCriterionUsage(incrementCriterionUsage(user?.id, nextCriterionId));
  };

  const orderedCriteria = orderCriteriaByUsage(filteredCriteria, criterionUsage);

  // Reset tiêu chí khi đổi danh mục
  useEffect(() => {
    setCriterionId('');
  }, [category]);

  const handleAddViolationToList = () => {
    if (classIds.length === 0) {
      toast.error('Vui lòng chọn lớp học trước!');
      return;
    }
    if (!criterionId) {
      toast.error('Vui lòng chọn tiêu chí rèn luyện!');
      return;
    }
    if (isEditMode && !selectedStudentId) {
      toast.error('Vui lòng chọn sinh viên!');
      return;
    }
    if (!isEditMode && selectedStudentIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một sinh viên!');
      return;
    }

    const criterion = criteria.find(c => c._id === criterionId);

    if (!criterion) return;

    const selectedIds = isEditMode ? [selectedStudentId] : selectedStudentIds;
    const newViolations = buildViolationItems(classStudents, selectedIds, criterion, violationNote, addedViolations);
    if (newViolations.length === 0) {
      toast.error('Các sinh viên đã được ghi nhận tiêu chí này!');
      return;
    }

    setAddedViolations(prev => [...prev, ...newViolations]);
    setSelectedStudentId('');
    setSelectedStudentIds([]);
    setSelectedStudents([]);
    setViolationNote('');
    toast.success('Đã thêm sinh viên vào danh sách tạm!');
  };

  const toggleStudentSelection = (student: Student) => {
    setSelectedStudentIds(prev => {
      const next = toggleStudentSelectionState(prev, selectedStudents, student);
      setSelectedStudents(next.selectedStudents);
      return next.selectedIds;
    });
  };

  const handleToggleQuickStudent = (student: Student) => {
    if (classIds.length === 0) {
      toast.error('Vui lòng chọn lớp học trước!');
      return;
    }
    if (!criterionId) {
      toast.error('Vui lòng chọn tiêu chí rèn luyện!');
      return;
    }
    const existingViolation = addedViolations.find(
      violation => violation.student_id === student._id && violation.evaluation_detail_id === criterionId,
    );
    const key = `${student._id}:${criterionId}`;
    if (existingViolation) {
      setAddedViolations(prev => prev.filter(violation => violation !== existingViolation));
      setPendingQuickViolationKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return;
    }
    const criterion = criteria.find(item => item._id === criterionId);
    if (!criterion) return;
    setAddedViolations(prev => [...prev, {
      student_id: student._id,
      class_id: typeof student.class_id === 'object' ? student.class_id?._id : student.class_id,
      student_name: student.full_name,
      student_code: student.student_code,
      evaluation_detail_id: criterion._id,
      criterion_name: criterion.criterion_name,
      points_effect: criterion.score_per_unit || criterion.min_score || -5,
      class_note: violationNote.trim() || 'Không có ghi chú',
    }]);
    setPendingQuickViolationKeys(prev => new Set(prev).add(key));
  };

  const handleRemoveViolationFromList = (index: number) => {
    setAddedViolations(prev => prev.filter((_, i) => i !== index));
    toast.success('Đã xóa sinh viên khỏi danh sách tạm.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditMode) {
      if (!recordToEdit?._id) {
        toast.error('Không thể cập nhật vì bản ghi chưa có mã định danh.');
        return;
      }
      if (!classId) {
        toast.error('Vui lòng chọn lớp học!');
        return;
      }
      if (!selectedStudentId) {
        toast.error('Vui lòng chọn sinh viên!');
        return;
      }
      if (!criterionId) {
        toast.error('Vui lòng chọn tiêu chí rèn luyện!');
        return;
      }
      if (!reportDate) {
        toast.error('Vui lòng chọn ngày ghi nhận!');
        return;
      }

      const selectedCriterion = criteria.find(c => c._id === criterionId);
      const recordedById = typeof recordToEdit.recorded_by === 'object' 
        ? recordToEdit.recorded_by?._id 
        : recordToEdit.recorded_by;
      const semesterIdToUse = typeof recordToEdit.semester_id === 'object'
        ? recordToEdit.semester_id?._id
        : recordToEdit.semester_id || activeSemesterId;
      
      setIsSaving(true);
      try {
        await academicRecordApi.updateAcademicRecord(recordToEdit._id, {
          student_id: selectedStudentId,
          criterion_id: criterionId,
          semester_id: semesterIdToUse,
          record_title: selectedCriterion?.criterion_name || recordToEdit.record_title || 'Ghi nhận rèn luyện',
          description: violationNote.trim(),
          status: recordToEdit.status || 'active',
          recorded_at: reportDate.toISOString(),
          recorded_by: recordedById,
        });

        toast.success('Cập nhật ghi nhận thành công!');
        if (onSuccess) {
          onSuccess();
        } else {
          onBack();
        }
        return;
      } catch (err: any) {
        console.error('Lỗi khi cập nhật ghi nhận:', err);
        toast.error(err.message || 'Cập nhật ghi nhận thất bại!');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (addedViolations.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 sinh viên vào danh sách ghi nhận!');
      return;
    }

    setIsSaving(true);
    const actionBatchId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    
    try {
      const recordsToCreate = addedViolations.map((violation) => {
        return {
          student_id: violation.student_id,
          criterion_id: violation.evaluation_detail_id, // here it holds criterion_id
          semester_id: activeSemesterId,
          record_title: violation.criterion_name,
          description: violation.class_note,
          status: 'active' as const,
          recorded_at: reportDate.toISOString(),
          recorded_by: user?.id,
          idempotency_key: `manual_record:${actionBatchId}:${violation.student_id}:${violation.evaluation_detail_id}`,
          source: 'manual_record'
        };
      });

      const response = await academicRecordApi.bulkCreateAcademicRecords(recordsToCreate);
      
      if (response.insertedCount > 0) {
        toast.success(`Đã ghi nhận ${response.insertedCount} rèn luyện thành công!`);
      }
      if (response.duplicatedCount > 0) {
        toast.warning(`Có ${response.duplicatedCount} ghi nhận bị trùng lặp hoặc đã tồn tại.`);
      }
      if (response.insertedCount === 0 && response.duplicatedCount === 0) {
        toast.error('Không có ghi nhận nào được tạo thành công.');
      }

      if (onSuccess) {
        onSuccess();
      } else {
        onBack();
      }
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi lưu ghi nhận!');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full from-[#F4F7FC] to-[#E2EAF4] font-sans w-full overflow-y-auto"
    >
      <div className="flex flex-col gap-5 mx-auto w-full">
        {/* Page Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
          <div className="flex gap-3 items-center">
            {/* Back Button Pill Glassmorphism using Custom Button */}
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="backdrop-blur-md bg-white/50 border border-white/80 rounded-xl w-9 h-9 p-0 flex items-center justify-center cursor-pointer hover:bg-white/70 hover:scale-[1.01] transition-all duration-150 ease-out shadow-xs shrink-0"
              title="Quay lại"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700" />
            </Button>

            {/* Figma Icon Block */}
            <div className="hidden xs:flex backdrop-blur-md bg-white/50 border border-white/80 items-center justify-center rounded-xl shadow-xs shrink-0 w-9 h-9">
              <FileText className="w-4 h-4 text-[#1A73E8]" />
            </div>

            <div className="flex flex-col items-start min-w-0">
              <h2 className="font-bold text-lg lg:text-xl text-[#1A73E8] leading-tight truncate">
                {isEditMode ? 'Chỉnh sửa Ghi nhận Rèn luyện' : 'Thêm Ghi nhận Rèn luyện'}
              </h2>
              <p className="font-medium text-slate-500 text-xs lg:text-[13px] leading-relaxed">
                {isEditMode ? 'Cập nhật thông tin ghi nhận hiện tại của sinh viên' : 'Ghi nhận khen thưởng hoặc vi phạm của sinh viên'}
              </p>
            </div>
          </div>
          <div className="flex items-center sm:justify-end shrink-0">
            <div className="bg-white/50 backdrop-blur-md border border-white/80 text-[#1A73E8] font-bold text-[11px] px-3.5 py-1.5 rounded-xl uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#1A73E8] animate-pulse" />
              <span>Hệ thống ghi nhận</span>
            </div>
          </div>
        </div>
        {isLoadingData ? (
          <div className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl p-10 shadow-xs flex flex-col items-center justify-center min-h-[250px] gap-3">
            <Loader2 className="w-7 h-7 text-[#1A73E8] animate-spin" />
            <span className="text-[#1A73E8] font-semibold text-xs">Đang nạp dữ liệu rèn luyện...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-5">
            {/* Main Grid Layout (12 Columns) */}
            <div className="grid grid-cols-12 gap-5 w-full relative z-10">

              {/* Left Column: Core Info (col-span-4) */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">
                {/* Section 1: Thông tin cơ bản */}
                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-200/10 rounded-2xl p-5 lg:p-6 flex flex-col gap-4 w-full">
                  <div className="flex gap-2 items-center text-[#1A73E8]">
                    <FileText className="w-4 h-4 shrink-0" />
                    <h3 className="font-bold text-sm lg:text-base leading-none">Thông tin cơ bản</h3>
                  </div>

                  <div className="flex flex-col gap-3.5 w-full">
                    {/* Lớp học: create hỗ trợ chọn nhiều, edit giữ một lớp */}
                    <div className="flex flex-col w-full relative">
                      {isEditMode ? <Select value={classId} onValueChange={handleClassChange} label="Lớp học" required error="">
                        <SelectTrigger className="bg-white/50 border border-white/80 backdrop-blur-sm h-9 rounded-xl px-3.5 text-[13px] text-[#1E293B] font-medium outline-none focus-within:ring-0 focus-within:border-white/80 transition-all duration-150 ease-out hover:bg-white/70 hover:scale-[1.005] cursor-pointer w-full shadow-xs">
                          <SelectValue placeholder="Chọn lớp học..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-white/70">
                          {classes.map(c => (
                            <SelectItem key={c._id} value={c._id}>{c.class_name}</SelectItem>
                          ))}
                          {classes.length === 0 && <div className="p-4 text-center text-xs text-slate-400 italic">Không có lớp học nào</div>}
                        </SelectContent>
                      </Select> : <>
                        <label className="mb-1 ml-1 text-[12px] font-medium text-slate-600">Lớp học</label>
                        <Popover open={isClassPickerOpen} onOpenChange={setIsClassPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" className="h-9 w-full justify-between rounded-xl border-white/80 bg-white/50 px-3.5 text-left text-[13px] font-medium text-[#1E293B] shadow-xs hover:bg-white/70">
                              <span className="truncate">{classIds.length > 0 ? classIds.map(id => classes.find(c => c._id === id)?.class_name).filter(Boolean).join(', ') : 'Chọn lớp học...'}</span>
                              <span className="ml-2 text-slate-400">⌄</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="z-[100] w-[var(--radix-popover-trigger-width)] rounded-xl border border-slate-100 bg-white p-2 shadow-xl">
                            <Input type="search" role="combobox" aria-label="Tìm lớp học" value={classSearch} onChange={e => setClassSearch(e.target.value)} placeholder="Nhập tên hoặc mã lớp..." className="mb-2 h-9 rounded-lg text-[12px]" />
                            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto" aria-label="Danh sách lớp học">
                              {classes.filter(c => `${c.class_name} ${c.class_year} ${c._id}`.toLowerCase().includes(classSearch.toLowerCase())).map(c => {
                                const selected = classIds.includes(c._id);
                                return <label key={c._id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-semibold cursor-pointer ${selected ? 'bg-blue-50 text-blue-800' : 'hover:bg-slate-50 text-slate-700'}`}>
                                  <input type="checkbox" checked={selected} onChange={() => setClassIds(prev => selected ? prev.filter(id => id !== c._id) : [...prev, c._id])} className="accent-blue-600" />
                                  <span className="truncate">{c.class_name}{c.class_year ? ` (${c.class_year})` : ''}</span>
                                </label>;
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <span className="mt-1 ml-1 text-[11px] text-slate-500" aria-live="polite">{classIds.length > 0 ? `Đã chọn ${classIds.length} lớp` : 'Chọn lớp học...'}</span>
                      </>}
                    </div>

                    {/* Tiêu chí */}
                    <div className="flex flex-col w-full relative">
                      <Select
                        value={criterionId}
                        onValueChange={handleCriterionChange}
                        label="Tiêu chí ghi nhận"
                        required
                        error={""}
                      >
                        <SelectTrigger className="bg-white/50 border border-white/80 backdrop-blur-sm h-9 rounded-xl px-3.5 text-[13px] text-[#1E293B] font-medium outline-none focus-within:ring-0 focus-within:border-white/80 transition-all duration-150 ease-out hover:bg-white/70 hover:scale-[1.005] cursor-pointer w-full shadow-xs">
                          <SelectValue placeholder="Chọn tiêu chí..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-white/70 font-sans">
                          {orderedCriteria.frequent.length > 0 && <SelectLabel>Sử dụng nhiều</SelectLabel>}
                          {orderedCriteria.frequent.map(c => (
                            <SelectItem key={c._id} value={c._id}>{c.criterion_name} ({c.score_per_unit || c.min_score || 0}đ)</SelectItem>
                          ))}
                          {orderedCriteria.frequent.length > 0 && orderedCriteria.remaining.length > 0 && <SelectSeparator />}
                          {orderedCriteria.remaining.map(c => (
                            <SelectItem key={c._id} value={c._id}>{c.criterion_name} ({c.score_per_unit || c.min_score || 0}đ)</SelectItem>
                          ))}
                          {filteredCriteria.length === 0 && (
                            <div className="p-4 text-center text-xs text-slate-400 italic">Không có tiêu chí nào</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Ngày báo cáo */}
                    <div className="flex flex-col w-full">
                      <label className="text-[12px] font-medium text-slate-600 mb-1 ml-1">Ngày báo cáo</label>
                      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="bg-white/50 border border-white/80 backdrop-blur-sm h-9 rounded-xl px-3.5 text-[13px] text-[#1E293B] font-medium outline-none flex items-center justify-between hover:bg-white/70 hover:scale-[1.005] transition-all duration-150 ease-out w-full shadow-xs text-left font-sans"
                          >
                            <span>{format(reportDate, 'dd/MM/yyyy')}</span>
                            <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0 z-[100] bg-transparent border-none shadow-none overflow-hidden"
                          align="start"
                          side="bottom"
                          sideOffset={6}
                        >
                          <CustomCalendar
                            startDate={reportDate}
                            endDate={null}
                            onRangeSelect={(start) => { if (start) setReportDate(start); }}
                            onCancel={() => setIsCalendarOpen(false)}
                            onConfirm={() => setIsCalendarOpen(false)}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Violations Section (col-span-8) */}
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-5">
                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-200/10 rounded-2xl p-5 lg:p-6 flex flex-col gap-4 w-full">
                  <div className="flex gap-2 items-center text-[#1A73E8]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <h3 className="font-bold text-sm lg:text-base leading-none">Ghi nhận sinh viên</h3>
                  </div>

                  {!isEditMode && <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chế độ nhập ghi nhận">
                    <Button type="button" variant={entryMode === 'manual' ? 'default' : 'outline'} aria-pressed={entryMode === 'manual'} disabled={isMobile} onClick={() => { if (!isMobile) setEntryMode('manual'); }} className="h-9 rounded-lg px-4 text-[12px] font-bold">Nhập thủ công</Button>
                    <Button type="button" variant={entryMode === 'quick' ? 'default' : 'outline'} aria-pressed={entryMode === 'quick'} onClick={() => setEntryMode('quick')} className="h-9 rounded-lg px-4 text-[12px] font-bold">Chọn nhanh nhiều sinh viên</Button>
                  </div>}

                  {/* Entry Form: Kính mờ gọn gàng */}
                  {entryMode === 'quick' && !isEditMode ? <div className="bg-white/30 backdrop-blur-sm border border-white/60 rounded-xl p-3.5 w-full relative z-20">
                    <div className="grid grid-cols-12 gap-3">
                      <Input type="search" label="Tìm sinh viên" value={studentsSearch} onChange={e => handleStudentSearch(e.target.value)} placeholder={classIds.length > 0 ? 'Tìm theo tên hoặc mã sinh viên...' : 'Vui lòng chọn lớp trước...'} disabled={classIds.length === 0} className="col-span-12 h-9 rounded-xl bg-white/50 text-[12.5px]" />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[12px] font-semibold text-slate-500"><span aria-live="polite">Đã chọn: <strong className="text-[#005bbf]">{addedViolations.filter(v => v.evaluation_detail_id === criterionId).length}</strong></span>{isStudentsLoading && <Loader2 className="h-4 w-4 animate-spin" aria-label="Đang tải sinh viên" />}</div>
                    <div className="mt-2 grid max-h-[300px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" aria-label="Danh sách sinh viên">
                      {classStudents.map(student => {
                        const selected = addedViolations.some(v => v.student_id === student._id && v.evaluation_detail_id === criterionId);
                        return <button key={student._id} type="button" aria-pressed={selected} disabled={!criterionId} onClick={() => handleToggleQuickStudent(student)} className={`rounded-xl border px-3 py-2 text-left transition-colors ${selected ? 'border-red-500 bg-red-50 text-red-800' : 'border-slate-200 bg-white/60 hover:border-blue-300'} disabled:cursor-not-allowed disabled:opacity-60`}><span className="flex min-w-0 items-center justify-between gap-2 text-[13px] font-bold"><span className="min-w-0 truncate">{student.full_name}</span>{selected && <span className="shrink-0 text-[11px] font-bold text-red-600">Đã chọn</span>}</span><span className="block text-[11px] text-slate-500">MSSV: {student.student_code}</span></button>;
                      })}
                      {!isStudentsLoading && classStudents.length === 0 && <div className="col-span-full py-6 text-center text-[12px] text-slate-400 italic">Không tìm thấy sinh viên.</div>}
                    </div>
                    {classIds.some(id => hasMoreStudents[id]) && classStudents.length > 0 && <Button type="button" variant="outline" onClick={handleLoadMoreStudents} disabled={isStudentsLoading} className="mx-auto mt-3 block h-8 rounded-lg text-[11px]">Tải thêm sinh viên</Button>}
                  </div> : null}
                  {entryMode === 'manual' || isEditMode ? (
                  <div className="bg-white/30 backdrop-blur-sm border border-white/60 rounded-xl p-3.5 w-full relative z-20">
                    <div className="grid grid-cols-12 gap-3 w-full">
                      {/* Họ tên sinh viên: edit giữ luồng một sinh viên; create hỗ trợ chọn nhiều */}
                      <div className="col-span-12 md:col-span-6 flex flex-col items-start w-full relative">
                        <div className="w-full">
                        {isEditMode ? (
                        <Select
                          value={selectedStudentId}
                          onValueChange={setSelectedStudentId}
                          onSearchQueryChange={handleStudentSearch}
                          label="Họ tên sinh viên"
                          error={""}
                        >
                          <SelectTrigger
                            className="bg-white/50 border border-white/80 backdrop-blur-sm h-9 rounded-xl px-3.5 text-[12.5px] text-[#1E293B] font-medium outline-none w-full shadow-xs transition-all duration-150 ease-out hover:bg-white/70 hover:scale-[1.005] cursor-pointer font-sans"
                            disabled={!classId}
                          >
                            <SelectValue placeholder={classId ? "Tìm tên..." : "Vui lòng chọn lớp trước..."} />
                          </SelectTrigger>
                          <SelectContent 
                            lazyLoad 
                            onLoadMore={handleLoadMoreStudents}
                            className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-white/70"
                          >
                            {classStudents.map(s => (
                              <SelectItem key={s._id} value={s._id}>{s.full_name} ({s.student_code})</SelectItem>
                            ))}
                            {isStudentsLoading && (
                              <div className="flex items-center justify-center p-2 text-xs text-slate-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                Đang tải thêm...
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                        ) : (
                          <>
                            <label className="flex items-center gap-1 px-1 mb-1.5 text-[13px] font-bold text-[#1E293B]">Họ tên sinh viên<span className="text-red-500">*</span></label>
                            <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                disabled={!classId}
                                aria-label="Chọn sinh viên"
                                className="bg-white/50 border border-white/80 backdrop-blur-sm h-9 rounded-xl px-3.5 text-[12.5px] text-[#1E293B] font-medium outline-none w-full shadow-xs transition-all duration-150 ease-out hover:bg-white/70 cursor-pointer justify-start"
                              >
                                {classId ? (selectedStudentIds.length > 0 ? `Đã chọn ${selectedStudentIds.length} sinh viên` : 'Tìm và chọn sinh viên...') : 'Vui lòng chọn lớp trước...'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-72 p-2 bg-white/95 backdrop-blur-md border border-white/70">
                              <Input
                                autoFocus
                                type="search"
                                aria-label="Tìm sinh viên"
                                value={studentsSearch}
                                onChange={(e) => handleStudentSearch(e.target.value)}
                                placeholder="Tìm theo tên hoặc mã sinh viên..."
                                className="h-9 rounded-lg mb-2"
                              />
                              <div
                                role="group"
                                aria-label="Danh sách sinh viên"
                                className="max-h-56 overflow-y-auto"
                                onScroll={(e) => {
                                  const target = e.currentTarget;
                                  if (target.scrollHeight - target.scrollTop - target.clientHeight < 32) handleLoadMoreStudents();
                                }}
                              >
                                {classStudents.map(student => (
                                  <label key={student._id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs cursor-pointer hover:bg-blue-50">
                                    <input
                                      type="checkbox"
                                      checked={selectedStudentIds.includes(student._id)}
                                      onChange={() => toggleStudentSelection(student)}
                                      className="h-4 w-4 accent-[#1A73E8]"
                                    />
                                    <span>{student.full_name} ({student.student_code})</span>
                                  </label>
                                ))}
                                {isStudentsLoading && <div className="p-2 text-center text-xs text-slate-400"><Loader2 className="inline-block w-3.5 h-3.5 animate-spin mr-1.5" />Đang tải thêm...</div>}
                                {!isStudentsLoading && classStudents.length === 0 && <div className="p-3 text-center text-xs text-slate-400">Không tìm thấy sinh viên</div>}
                              </div>
                            </PopoverContent>
                            </Popover>
                          </>
                        )}
                        </div>
                      </div>

                      {/* Ghi chú chi tiết sử dụng Input Component */}
                      <Input
                        type="text"
                        label="Ghi chú"
                        value={violationNote}
                        onChange={(e) => setViolationNote(e.target.value)}
                        placeholder="VD: Vi phạm lần đầu..."
                        className="bg-white/50 border border-white/80 backdrop-blur-sm h-9 rounded-xl px-3.5 text-[12.5px] text-[#1E293B] placeholder:text-slate-400 hover:bg-white/70 focus-visible:bg-white/70 focus-visible:border-white/80 transition-all duration-150 ease-out shadow-xs"
                        containerClassName="col-span-12 md:col-span-6 w-full"
                      />

                      {!isEditMode && (
                        <div className="col-span-12 flex justify-end w-full mt-1">
                          <Button
                            type="button"
                            onClick={handleAddViolationToList}
                            className="bg-[#1A73E8] border border-[#1A73E8]/80 hover:bg-[#1A73E8]/90 text-white font-bold h-9 px-5 rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01] text-xs min-w-[120px]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Thêm vào danh sách</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  ) : null}

                  {isEditMode ? (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/90 p-3 text-xs text-blue-700 shadow-xs">
                      Bạn đang chỉnh sửa một bản ghi duy nhất. Các thay đổi sẽ được lưu bằng API cập nhật và không tạo thêm bản ghi mới.
                    </div>
                  ) : (
                    <div className="w-full overflow-hidden border border-white/70 rounded-xl shadow-xs bg-white/20 backdrop-blur-sm">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white/50 backdrop-blur-md border-b border-white/70">
                        <tr>
                          <th className="px-4 py-2.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">Họ tên & MSSV</th>
                          <th className="px-4 py-2.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">Tiêu chí ghi nhận</th>
                          <th className="px-4 py-2.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">Ghi chú</th>
                          <th className="px-4 py-2.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider text-center w-[80px]">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/20">
                        {addedViolations.map((violation, idx) => {
                          const criterion = criteria.find(c => c._id === violation.evaluation_detail_id);
                          const type = criterion?.criterion_type || (violation.points_effect > 0 ? 'cong_diem' : 'ky_luat');

                          let badgeClass = 'bg-blue-50 text-blue-600 border border-blue-100';
                          if (type === 'khen_thuong') {
                            badgeClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
                          } else if (type === 'ky_luat') {
                            badgeClass = 'bg-rose-50 text-rose-600 border border-rose-100';
                          }

                          return (
                            <tr key={idx} className="hover:bg-white/60 transition-all duration-150 ease-out">
                              <td className="px-4 py-3 font-semibold text-slate-800 text-[13px]">
                                <div className="flex flex-col">
                                  <span>{violation.student_name}</span>
                                  <span className="text-slate-400 text-[10.5px] font-medium">MSSV: {violation.student_code}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`font-bold rounded-xl px-2.5 py-0.5 text-[11.5px] inline-block tracking-wide ${badgeClass}`}>
                                  {violation.criterion_name}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-normal text-slate-600 text-[13px] max-w-[200px] truncate" title={violation.class_note}>
                                {violation.class_note}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => handleRemoveViolationFromList(idx)}
                                  className="w-7 h-7 rounded-xl hover:bg-rose-100/80 hover:text-rose-600 p-0 flex items-center justify-center text-rose-500 transition-all duration-150 ease-out hover:scale-[1.01] bg-white/50 border border-white/80 shadow-xs outline-none cursor-pointer mx-auto"
                                  title="Xóa ghi nhận"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}

                        {addedViolations.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-500 italic bg-white/10">
                              Chưa có ghi nhận sinh viên trong danh sách tạm.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  )}

                  {/* Hiển thị sĩ số/tổng hợp xem nhanh */}
                  <div className="flex flex-wrap items-center gap-4 lg:gap-6 text-xs font-bold text-slate-500 px-2 mt-1">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-[#1A73E8]" />
                      <span>Tổng số SV ghi nhận: <strong className="text-slate-800">
                        {isStudentsLoading ? (
                          <Loader2 className="inline-block w-3.5 h-3.5 animate-spin text-slate-400 align-middle ml-1" />
                        ) : (
                          `${new Set(addedViolations.map(v => v.student_id)).size} SV`
                        )}
                      </strong></span>
                    </div>
                  </div>

                </div>
              </div>

            </div>

            {/* Footer Actions Panel */}
            <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-200/10 rounded-2xl p-4 flex items-center justify-between gap-4 w-full relative z-0">
              <div className="hidden sm:flex items-center text-xs text-slate-500 font-medium italic">
                Hãy kiểm tra kỹ thông tin rèn luyện trước khi lưu.
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 items-center justify-end w-full sm:w-auto ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="border border-white/80 bg-white/50 backdrop-blur-sm hover:bg-white/70 hover:scale-[1.01] rounded-xl px-6 text-slate-700 font-bold text-xs h-9 transition-all duration-150 ease-out shadow-xs"
                >
                  Hủy bỏ
                </Button>

                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#1A73E8] border border-[#1A73E8]/80 hover:bg-[#1A73E8]/90 text-white font-bold px-7 rounded-xl shadow-xs transition-all duration-150 ease-out hover:scale-[1.01] flex items-center justify-center gap-2 text-xs h-9 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{isEditMode ? 'Cập nhật ghi nhận' : 'Lưu ghi nhận'}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

          </form>
        )}
      </div>
    </motion.div>
  );
}
