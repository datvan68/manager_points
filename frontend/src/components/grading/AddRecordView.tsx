'use client';
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Calendar as CalendarIcon, Loader2, Plus, Trash2, AlertTriangle, FileText, Check, Users, Save, Settings, Sparkles, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectLabel, SelectSeparator } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { useRecordDraft } from '@/hooks/useRecordDraft';
import { incrementCriterionUsage, orderCriteriaByUsage, readCriterionUsage, CriterionUsage } from './criterion-usage';
import { RecordSelectionDialog, quickGridClass, toggleSelectionValue } from './RecordSelectionUi';

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

interface StudentRecordDraft {
  classIds: string[];
  reportDate: string;
  criterionId: string;
  selectedStudentId: string;
  entryMode: 'manual' | 'quick';
  pendingQuickViolationKeys: string[];
  violationNote: string;
  addedViolations: ViolationItem[];
}

export function buildStudentRecordDraft({
  classIds, reportDate, criterionId, selectedStudentId, entryMode,
  pendingQuickViolationKeys, violationNote, addedViolations,
}: {
  classIds: string[]; reportDate: Date; criterionId: string; selectedStudentId: string;
  entryMode: 'manual' | 'quick'; pendingQuickViolationKeys: Set<string>;
  violationNote: string; addedViolations: ViolationItem[];
}): StudentRecordDraft {
  return {
    classIds, reportDate: reportDate.toISOString(), criterionId, selectedStudentId, entryMode,
    pendingQuickViolationKeys: Array.from(pendingQuickViolationKeys), violationNote, addedViolations,
  };
}

export function isStudentRecordDraft(value: unknown): value is StudentRecordDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<StudentRecordDraft>;
  const validViolations = Array.isArray(draft.addedViolations) && draft.addedViolations.every(item => {
    if (!item || typeof item !== 'object') return false;
    const violation = item as Partial<ViolationItem>;
    return typeof violation.student_id === 'string'
      && (!violation.class_id || typeof violation.class_id === 'string')
      && typeof violation.student_name === 'string'
      && typeof violation.student_code === 'string'
      && typeof violation.evaluation_detail_id === 'string'
      && typeof violation.criterion_name === 'string'
      && typeof violation.points_effect === 'number'
      && typeof violation.class_note === 'string';
  });
  return Array.isArray(draft.classIds)
    && draft.classIds.every(item => typeof item === 'string')
    && typeof draft.reportDate === 'string'
    && typeof draft.criterionId === 'string'
    && typeof draft.selectedStudentId === 'string'
    && (draft.entryMode === 'manual' || draft.entryMode === 'quick')
    && Array.isArray(draft.pendingQuickViolationKeys)
    && draft.pendingQuickViolationKeys.every(item => typeof item === 'string')
    && typeof draft.violationNote === 'string'
    && validViolations;
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

export function shouldResetClassDependentState(isRestoringDraft: boolean): boolean {
  return !isRestoringDraft;
}

export function consumeClassHydrationMarker(marker: { current: boolean }): boolean {
  const isHydrating = marker.current;
  marker.current = false;
  return isHydrating;
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
  const [classId, setClassId] = useState('');
  const [classIds, setClassIds] = useState<string[]>([]);
  const [classSearch, setClassSearch] = useState('');
  const [isClassPickerOpen, setIsClassPickerOpen] = useState(false);
  const classIdsRef = React.useRef<string[]>([]);
  const [criterionId, setCriterionId] = useState('');
  const [isCriterionPickerOpen, setIsCriterionPickerOpen] = useState(false);
  const [criterionSearch, setCriterionSearch] = useState('');
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Card Phải (Ghi nhận sinh viên)
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<'manual' | 'quick'>('quick');
  const [isMobile, setIsMobile] = useState(false);
  const [pendingQuickViolationKeys, setPendingQuickViolationKeys] = useState<Set<string>>(new Set());
  const [violationNote, setViolationNote] = useState('');
  const [addedViolations, setAddedViolations] = useState<ViolationItem[]>([]);
  const [activeSemesterId, setActiveSemesterId] = useState('60d0fe4f5311236168a109cb');

  const isEditMode = Boolean(recordToEdit && recordToEdit._id);
  const {
    draft,
    hydrated: draftHydrated,
    saveDraft,
    clearDraft,
  } = useRecordDraft<StudentRecordDraft>({
    form: 'student',
    userId: user?.id,
    enabled: !isEditMode,
    validate: isStudentRecordDraft,
  });
  const draftRestoredRef = React.useRef(false);
  const restoringClassDependentStateRef = React.useRef(false);
  const dataReadyRef = React.useRef(false);

  useEffect(() => {
    if (!draftHydrated || draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    if (!draft || isEditMode) return;
    restoringClassDependentStateRef.current = true;
    const restoredDate = new Date(draft.reportDate);
    if (draft.classIds.length > 0) {
      setClassId(draft.classIds[0]);
    }
    setClassIds(draft.classIds);
    setCriterionId(draft.criterionId);
    setSelectedStudentId(draft.selectedStudentId);
    setEntryMode(draft.entryMode);
    setPendingQuickViolationKeys(new Set(draft.pendingQuickViolationKeys));
    setViolationNote(draft.violationNote);
    setAddedViolations(draft.addedViolations);
    if (!Number.isNaN(restoredDate.getTime())) setReportDate(restoredDate);
  }, [draft, draftHydrated, isEditMode]);

  useEffect(() => {
    if (!draftHydrated || isEditMode || !dataReadyRef.current || !draftRestoredRef.current) return;
    saveDraft(buildStudentRecordDraft({
      classIds,
      reportDate,
      criterionId,
      selectedStudentId,
      entryMode,
      pendingQuickViolationKeys,
      violationNote,
      addedViolations,
    }));
  }, [
    addedViolations, classIds, criterionId, draftHydrated, entryMode, isEditMode,
    pendingQuickViolationKeys, reportDate, saveDraft, selectedStudentId, violationNote,
  ]);

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
            restoringClassDependentStateRef.current = true;
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
          setEntryMode('manual');
        }
      } catch (err) {
        console.error('Lỗi nạp dữ liệu:', err);
        toast.error('Không thể nạp dữ liệu ban đầu');
      } finally {
        dataReadyRef.current = true;
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
    const isRestoringClassDependentState = consumeClassHydrationMarker(restoringClassDependentStateRef);
    classIdsRef.current = classIds;
    setStudentsPages(Object.fromEntries(classIds.map(id => [id, 1])));
    setStudentsSearch("");
    setHasMoreStudents(Object.fromEntries(classIds.map(id => [id, true])));
    setClassStudents(prev => prev.filter(student => {
      const studentClassId = typeof student.class_id === 'object' ? student.class_id?._id : student.class_id;
      return classIds.includes(studentClassId || '');
    }));
    if (shouldResetClassDependentState(isRestoringClassDependentState)) {
      setSelectedStudentId('');
      setViolationNote('');
    }
    if (classIds.length > 0) {
      void Promise.all(classIds.map(id => fetchClassStudents(id, 1, "")));
      if (!isRestoringClassDependentState && !isEditMode) {
        setAddedViolations(prev => prev.filter(violation => !violation.class_id || classIds.includes(violation.class_id)));
      }
    } else {
      setClassStudents([]);
      if (!isRestoringClassDependentState && !isEditMode) setAddedViolations([]);
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

  const handleAddViolationToList = () => {
    if (classIds.length === 0) {
      toast.error('Vui lòng chọn lớp học trước!');
      return;
    }
    if (!criterionId) {
      toast.error('Vui lòng chọn tiêu chí rèn luyện!');
      return;
    }
    if (!selectedStudentId) {
      toast.error('Vui lòng chọn sinh viên!');
      return;
    }

    const criterion = criteria.find(c => c._id === criterionId);
    if (!criterion) return;

    const newViolations = buildViolationItems(classStudents, [selectedStudentId], criterion, violationNote, addedViolations);
    if (newViolations.length === 0) {
      toast.error('Sinh viên này đã được ghi nhận tiêu chí này!');
      return;
    }

    setAddedViolations(prev => [...prev, ...newViolations]);
    setSelectedStudentId('');
    setViolationNote('');
    toast.success('Đã thêm sinh viên vào danh sách tạm!');
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
        clearDraft();
        onSuccess();
      } else {
        clearDraft();
        onBack();
      }
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi lưu ghi nhận!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (!isEditMode) saveDraft(buildStudentRecordDraft({
      classIds, reportDate, criterionId, selectedStudentId, entryMode,
      pendingQuickViolationKeys, violationNote, addedViolations,
    }));
    onBack();
  };

  const handleCancel = () => {
    if (!isEditMode) clearDraft();
    onBack();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full from-[#F4F7FC] to-[#E2EAF4] font-sans w-full overflow-y-auto"
    >
      <div className="flex flex-col gap-4 sm:gap-5 mx-auto w-full">
        {/* Page Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
          <div className="flex gap-3 items-center">
            {/* Back Button Pill Glassmorphism using Custom Button */}
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
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
                {isEditMode ? 'Chỉnh sửa ghi nhận HSSV' : 'Ghi nhận HSSV'}
              </h2>
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
          <form onSubmit={handleSave} className="flex flex-col gap-4 sm:gap-5">
            {/* Main Grid Layout (12 Columns) */}
            <div className="grid grid-cols-12 gap-3.5 sm:gap-4 lg:gap-5 w-full relative z-10">

              {/* Left Column: Core Info (col-span-4) */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-3.5 sm:gap-4">
                {/* Section 1: Thông tin cơ bản */}
                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-300/30 rounded-2xl p-3.5 sm:p-4 lg:p-4.5 flex flex-col gap-3 w-full">
                  <div className="flex gap-2 items-center text-[#1A73E8]">
                    <FileText className="w-4 h-4 shrink-0" />
                    <h3 className="font-bold text-sm lg:text-[15px] leading-none">Thông tin cơ bản</h3>
                  </div>

                  <div className="flex flex-col gap-3 w-full">
                    {/* Lớp học: create hỗ trợ chọn nhiều, edit giữ một lớp */}
                    <div className="flex flex-col w-full relative">
                      {!isMobile ? (
                        <Select
                          value={isEditMode ? (classId || '') : (classIds[0] || '')}
                          onValueChange={(val: string) => {
                            if (isEditMode) {
                              handleClassChange(val);
                            } else {
                              setClassIds(val ? [val] : []);
                            }
                          }}
                          label="Lớp học"
                        >
                          <SelectTrigger className="bg-white/40 border-white/70 backdrop-blur-sm h-9 sm:h-10 rounded-xl px-3.5 text-xs sm:text-[12.5px] text-[#1E293B] font-semibold outline-none w-full shadow-xs focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-150 ease-out hover:bg-white/60 cursor-pointer font-sans">
                            <SelectValue placeholder="Chọn lớp học..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-white/70 font-sans max-h-60">
                            {classes.map(c => (
                              <SelectItem key={c._id} value={c._id}>
                                {c.class_name}{c.class_year ? ` (${c.class_year})` : ''}
                              </SelectItem>
                            ))}
                            {classes.length === 0 && (
                              <div className="py-4 text-center text-xs text-slate-400">Không có lớp học nào</div>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex flex-col w-full">
                          <label className="text-xs font-semibold text-slate-600 mb-1 ml-1">Lớp học</label>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsClassPickerOpen(true)}
                            className="h-9 sm:h-10 w-full justify-between rounded-xl border border-white/70 bg-white/40 backdrop-blur-sm px-3.5 text-left text-xs sm:text-[12.5px] font-semibold text-[#1E293B] shadow-xs hover:bg-white/60 transition-all duration-150 ease-out"
                          >
                            <span className={`truncate ${isEditMode ? (classId ? 'text-[#1E293B]' : 'font-normal text-[#64748B]/60') : (classIds.length > 0 ? 'text-[#1E293B]' : 'font-normal text-[#64748B]/60')}`}>
                              {isEditMode
                                ? (classes.find(c => c._id === classId)?.class_name || 'Chọn lớp học...')
                                : (classIds.length > 0
                                  ? classIds.map(id => classes.find(c => c._id === id)?.class_name).filter(Boolean).join(', ')
                                  : 'Chọn lớp học...')}
                            </span>
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                          </Button>
                          <Dialog open={isClassPickerOpen} onOpenChange={setIsClassPickerOpen}>
                            <DialogContent
                              showCloseButton={false}
                              onOpenAutoFocus={(e) => e.preventDefault()}
                              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[calc(100vw-2.5rem)] max-w-md max-h-[75vh] flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/95 backdrop-blur-md p-4 shadow-2xl overflow-hidden"
                            >
                              <DialogTitle className="sr-only">Chọn lớp học</DialogTitle>
                              <DialogDescription className="sr-only">Danh sách lớp học</DialogDescription>
                              <Input
                                type="search"
                                role="combobox"
                                aria-expanded={isClassPickerOpen}
                                aria-label="Tìm lớp học"
                                value={classSearch}
                                onChange={e => setClassSearch(e.target.value)}
                                placeholder="Nhập tên hoặc mã lớp..."
                                className="h-9.5 rounded-xl text-xs bg-slate-50 border-slate-200 placeholder:text-[#64748B]/60"
                              />
                              <div className="flex flex-1 max-h-60 flex-col gap-1 overflow-y-auto overscroll-contain" aria-label="Danh sách lớp học">
                                {isEditMode ? (
                                  classes
                                    .filter(c => `${c.class_name} ${c.class_year || ''} ${c._id}`.toLowerCase().includes(classSearch.toLowerCase()))
                                    .map(c => {
                                      const isSelected = classId === c._id;
                                      return (
                                        <button
                                          key={c._id}
                                          type="button"
                                          role="option"
                                          aria-selected={isSelected}
                                          onClick={() => {
                                            handleClassChange(c._id);
                                            setIsClassPickerOpen(false);
                                            setClassSearch('');
                                          }}
                                          className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                                            isSelected ? 'bg-blue-50 text-blue-800 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                          }`}
                                        >
                                          <span className="truncate">{c.class_name}{c.class_year ? ` (${c.class_year})` : ''}</span>
                                        </button>
                                      );
                                    })
                                ) : (
                                  classes
                                    .filter(c => `${c.class_name} ${c.class_year || ''} ${c._id}`.toLowerCase().includes(classSearch.toLowerCase()))
                                    .map(c => {
                                      const selected = classIds.includes(c._id);
                                      return (
                                        <label
                                          key={c._id}
                                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold cursor-pointer transition-colors ${
                                            selected ? 'bg-blue-50 text-blue-800 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={selected}
                                            onChange={() => {
                                              setClassIds(prev => selected ? prev.filter(id => id !== c._id) : [...prev, c._id]);
                                            }}
                                            className="accent-[#1A73E8] rounded"
                                          />
                                          <span className="truncate">{c.class_name}{c.class_year ? ` (${c.class_year})` : ''}</span>
                                        </label>
                                      );
                                    })
                                )}
                                {classes.filter(c => `${c.class_name} ${c.class_year || ''} ${c._id}`.toLowerCase().includes(classSearch.toLowerCase())).length === 0 && (
                                  <span className="px-2 py-6 text-center text-xs text-slate-400">Không tìm thấy lớp.</span>
                                )}
                              </div>
                              {!isEditMode && (
                                <div className="flex justify-end pt-2 border-t border-slate-100">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => setIsClassPickerOpen(false)}
                                    className="h-8 px-4 rounded-xl text-xs font-bold bg-[#1A73E8] text-white hover:bg-[#1557b0]"
                                  >
                                    Xong
                                  </Button>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
                      {!isEditMode && (
                        <span className="mt-1 ml-1 text-[11px] text-slate-500" aria-live="polite">
                          {classIds.length > 0 ? `Đã chọn ${classIds.length} lớp` : 'Chọn lớp học...'}
                        </span>
                      )}
                    </div>

                    {/* Ngày ghi nhận */}
                    <div className="flex flex-col w-full">
                      <label className="text-xs font-semibold text-slate-600 mb-1 ml-1">Ngày ghi nhận</label>
                      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="bg-white/40 border border-white/70 backdrop-blur-sm h-9 sm:h-10 rounded-xl px-3.5 text-xs sm:text-[12.5px] text-[#1E293B] font-semibold outline-none flex items-center justify-between hover:bg-white/60 hover:scale-[1.005] transition-all duration-150 ease-out w-full shadow-xs text-left font-sans"
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
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-3.5 sm:gap-4">
                {!isEditMode && (
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chế độ nhập ghi nhận">
                    <Button
                      type="button"
                      variant={entryMode === 'manual' ? 'default' : 'outline'}
                      aria-pressed={entryMode === 'manual'}
                      disabled={isMobile}
                      onClick={() => { if (!isMobile) setEntryMode('manual'); }}
                      className={`rounded-xl h-8 px-3.5 text-xs font-bold transition-all duration-150 ease-out ${
                        entryMode === 'manual'
                          ? 'bg-[#1A73E8] text-white hover:bg-[#1557b0]'
                          : 'border-white/70 bg-white/40 backdrop-blur-sm text-[#1E293B] hover:bg-white/60'
                      }`}
                    >
                      Nhập thủ công
                    </Button>
                    <Button
                      type="button"
                      variant={entryMode === 'quick' ? 'default' : 'outline'}
                      aria-pressed={entryMode === 'quick'}
                      onClick={() => setEntryMode('quick')}
                      className={`rounded-xl h-8 px-3.5 text-xs font-bold transition-all duration-150 ease-out ${
                        entryMode === 'quick'
                          ? 'bg-[#1A73E8] text-white hover:bg-[#1557b0]'
                          : 'border-white/70 bg-white/40 backdrop-blur-sm text-[#1E293B] hover:bg-white/60'
                      }`}
                    >
                      Chọn nhanh nhiều sinh viên
                    </Button>
                  </div>
                )}

                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-300/30 rounded-2xl p-3.5 sm:p-4 lg:p-4.5 flex flex-col gap-3 w-full">
                  <div className="flex gap-2 items-center text-[#1A73E8]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <h3 className="font-bold text-sm lg:text-[15px] leading-none">Ghi nhận sinh viên</h3>
                  </div>

                  {/* Entry Form: Tinh gọn không bị lồng nhiều lớp */}
                  <div className="bg-white/35 backdrop-blur-xs border border-white/60 rounded-xl p-3 sm:p-3.5 w-full relative z-20">
                    {entryMode === 'manual' || isEditMode ? (
                      <div className="grid grid-cols-12 gap-2.5 sm:gap-3 w-full">
                        {/* Họ tên sinh viên */}
                        <div className="col-span-12 md:col-span-6 flex flex-col items-start w-full relative">
                          {!isMobile ? (
                            <Select
                              value={selectedStudentId}
                              onValueChange={setSelectedStudentId}
                              disabled={classIds.length === 0}
                              label="Họ tên sinh viên"
                            >
                              <SelectTrigger className="bg-white/40 border-white/70 backdrop-blur-sm h-9 sm:h-10 rounded-xl px-3.5 text-xs sm:text-[12.5px] text-[#1E293B] font-semibold outline-none w-full shadow-xs focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-150 ease-out hover:bg-white/60 cursor-pointer font-sans disabled:opacity-50">
                                <SelectValue placeholder={classIds.length > 0 ? 'Tìm tên...' : 'Vui lòng chọn lớp trước...'} />
                              </SelectTrigger>
                              <SelectContent className="bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-white/70 font-sans max-h-60">
                                {classStudents.map(s => (
                                  <SelectItem key={s._id} value={s._id}>
                                    {s.full_name} ({s.student_code})
                                  </SelectItem>
                                ))}
                                {classStudents.length === 0 && (
                                  <div className="py-4 text-center text-xs text-slate-400">
                                    {isStudentsLoading ? 'Đang tải sinh viên...' : 'Không có sinh viên nào'}
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex flex-col w-full">
                              <label className="text-xs font-semibold text-slate-600 mb-1 ml-1">Họ tên sinh viên</label>
                              <Button
                                type="button"
                                variant="ghost"
                                disabled={classIds.length === 0}
                                onClick={() => setIsStudentPickerOpen(true)}
                                className="h-9 sm:h-10 w-full justify-between rounded-xl border border-white/70 bg-white/40 backdrop-blur-sm px-3.5 text-left text-xs sm:text-[12.5px] font-semibold text-[#1E293B] shadow-xs hover:bg-white/60 transition-all duration-150 ease-out disabled:opacity-50"
                              >
                                <span className={`truncate ${selectedStudentId ? 'text-[#1E293B]' : 'font-normal text-[#64748B]/60'}`}>
                                  {classStudents.find(s => s._id === selectedStudentId)?.full_name || (classIds.length > 0 ? 'Tìm tên...' : 'Vui lòng chọn lớp trước...')}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                              </Button>
                              <Dialog open={isStudentPickerOpen} onOpenChange={setIsStudentPickerOpen}>
                                <DialogContent
                                  showCloseButton={false}
                                  onOpenAutoFocus={(e) => e.preventDefault()}
                                  className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[calc(100vw-2.5rem)] max-w-md max-h-[75vh] flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/95 backdrop-blur-md p-4 shadow-2xl overflow-hidden"
                                >
                                  <DialogTitle className="sr-only">Chọn sinh viên</DialogTitle>
                                  <DialogDescription className="sr-only">Danh sách sinh viên</DialogDescription>
                                  <Input
                                    type="search"
                                    role="combobox"
                                    aria-expanded={isStudentPickerOpen}
                                    aria-label="Tìm sinh viên"
                                    value={studentsSearch}
                                    onChange={e => handleStudentSearch(e.target.value)}
                                    placeholder="Tìm tên hoặc mã sinh viên..."
                                    className="h-9.5 rounded-xl text-xs bg-slate-50 border-slate-200 placeholder:text-[#64748B]/60"
                                  />
                                  <div className="flex flex-1 max-h-60 flex-col gap-1 overflow-y-auto overscroll-contain" role="listbox" aria-label="Danh sách sinh viên">
                                    {classStudents
                                      .filter(s => `${s.full_name} ${s.student_code}`.toLowerCase().includes(studentsSearch.toLowerCase()))
                                      .map(s => {
                                        const isSelected = selectedStudentId === s._id;
                                        return (
                                          <button
                                            key={s._id}
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            onClick={() => {
                                              setSelectedStudentId(s._id);
                                              setIsStudentPickerOpen(false);
                                            }}
                                            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                                              isSelected ? 'bg-blue-50 text-blue-800 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                          >
                                            <span className="truncate">{s.full_name}</span>
                                            <span className="ml-2 shrink-0 text-[11px] text-slate-400 font-mono">
                                              ({s.student_code})
                                            </span>
                                          </button>
                                        );
                                      })}
                                    {classStudents.filter(s => `${s.full_name} ${s.student_code}`.toLowerCase().includes(studentsSearch.toLowerCase())).length === 0 && (
                                      <div className="py-6 text-center text-xs text-slate-400">
                                        {isStudentsLoading ? 'Đang tải sinh viên...' : 'Không tìm thấy sinh viên.'}
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          )}
                        </div>

                        {/* Tiêu chí ghi nhận */}
                        <div className="col-span-12 md:col-span-6 flex flex-col items-start w-full relative">
                          {!isMobile ? (
                            <Select
                              value={criterionId}
                              onValueChange={handleCriterionChange}
                              label="Tiêu chí ghi nhận"
                            >
                              <SelectTrigger className="bg-white/40 border-white/70 backdrop-blur-sm h-9 sm:h-10 rounded-xl px-3.5 text-xs sm:text-[12.5px] text-[#1E293B] font-semibold outline-none w-full shadow-xs focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-150 ease-out hover:bg-white/60 cursor-pointer font-sans">
                                <SelectValue placeholder="Chọn tiêu chí..." />
                              </SelectTrigger>
                              <SelectContent className="bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-white/70 font-sans max-h-60">
                                {orderedCriteria.frequent.length > 0 && <SelectLabel>Sử dụng nhiều</SelectLabel>}
                                {orderedCriteria.frequent.map(c => (
                                  <SelectItem key={c._id} value={c._id}>
                                    {c.criterion_name} ({c.score_per_unit || c.min_score || 0}đ)
                                  </SelectItem>
                                ))}
                                {orderedCriteria.frequent.length > 0 && orderedCriteria.remaining.length > 0 && <SelectSeparator />}
                                {orderedCriteria.remaining.map(c => (
                                  <SelectItem key={c._id} value={c._id}>
                                    {c.criterion_name} ({c.score_per_unit || c.min_score || 0}đ)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex flex-col w-full">
                              <label className="text-xs font-semibold text-slate-600 mb-1 ml-1">Tiêu chí ghi nhận</label>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsCriterionPickerOpen(true)}
                                className="h-9 sm:h-10 w-full justify-between rounded-xl border border-white/70 bg-white/40 backdrop-blur-sm px-3.5 text-left text-xs sm:text-[12.5px] font-semibold text-[#1E293B] shadow-xs hover:bg-white/60 transition-all duration-150 ease-out"
                              >
                                <span className={`truncate ${criterionId ? 'text-[#1E293B]' : 'font-normal text-[#64748B]/60'}`}>
                                  {criteria.find(c => c._id === criterionId)?.criterion_name || 'Chọn tiêu chí...'}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                              </Button>
                              <Dialog open={isCriterionPickerOpen} onOpenChange={setIsCriterionPickerOpen}>
                                <DialogContent
                                  showCloseButton={false}
                                  onOpenAutoFocus={(e) => e.preventDefault()}
                                  className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[calc(100vw-2.5rem)] max-w-md max-h-[75vh] flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/95 backdrop-blur-md p-4 shadow-2xl overflow-hidden"
                                >
                                  <DialogTitle className="sr-only">Chọn tiêu chí</DialogTitle>
                                  <DialogDescription className="sr-only">Danh sách tiêu chí ghi nhận</DialogDescription>
                                  <Input
                                    type="search"
                                    role="combobox"
                                    aria-expanded={isCriterionPickerOpen}
                                    aria-label="Tìm tiêu chí"
                                    value={criterionSearch}
                                    onChange={e => setCriterionSearch(e.target.value)}
                                    placeholder="Tìm tiêu chí..."
                                    className="h-9.5 rounded-xl text-xs bg-slate-50 border-slate-200 placeholder:text-[#64748B]/60"
                                  />
                                  <div className="flex flex-1 max-h-60 flex-col gap-1 overflow-y-auto overscroll-contain" role="listbox" aria-label="Danh sách tiêu chí">
                                    {orderedCriteria.frequent.length > 0 && !criterionSearch && (
                                      <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                        Sử dụng nhiều
                                      </div>
                                    )}
                                    {[...orderedCriteria.frequent, ...orderedCriteria.remaining]
                                      .filter(c => c.criterion_name.toLowerCase().includes(criterionSearch.toLowerCase()))
                                      .map(c => {
                                        const isSelected = criterionId === c._id;
                                        return (
                                          <button
                                            key={c._id}
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            onClick={() => {
                                              handleCriterionChange(c._id);
                                              setIsCriterionPickerOpen(false);
                                              setCriterionSearch('');
                                            }}
                                            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                                              isSelected ? 'bg-blue-50 text-blue-800 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                          >
                                            <span className="truncate">{c.criterion_name}</span>
                                            <span className="ml-2 shrink-0 text-[11px] text-slate-400 font-mono">
                                              ({c.score_per_unit || c.min_score || 0}đ)
                                            </span>
                                          </button>
                                        );
                                      })}
                                    {criteria.filter(c => c.criterion_name.toLowerCase().includes(criterionSearch.toLowerCase())).length === 0 && (
                                      <div className="py-6 text-center text-xs text-slate-400">Không tìm thấy tiêu chí.</div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          )}
                        </div>

                        {/* Ghi chú chi tiết sử dụng Input Component */}
                        <Input
                          type="text"
                          label="Ghi chú chi tiết"
                          value={violationNote}
                          onChange={(e) => setViolationNote(e.target.value)}
                          placeholder="VD: Khen thưởng, vi phạm lần đầu..."
                          className="bg-white/40 border-white/70 backdrop-blur-sm h-9 sm:h-10 rounded-xl px-3.5 text-xs sm:text-[12.5px] text-[#1E293B] placeholder:text-[#64748B]/60 placeholder:font-normal focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:bg-white/70 focus-visible:border-blue-400 shadow-xs transition-all duration-150 ease-out"
                          containerClassName={isEditMode ? "col-span-12 w-full" : "col-span-12 md:col-span-9 w-full"}
                        />

                        {/* Nút Thêm (chỉ hiển thị khi không ở edit mode) */}
                        {!isEditMode && (
                          <div className="col-span-12 md:col-span-3 flex items-end w-full">
                            <Button
                              type="button"
                              onClick={handleAddViolationToList}
                              className="bg-[#1A73E8] hover:bg-[#1557b0] text-white font-bold h-9 sm:h-10 rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01] border-none outline-none w-full text-xs sm:text-[12.5px]"
                            >
                              <Plus className="w-3.5 h-3.5 shrink-0" />
                              <span>Thêm</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {/* Tiêu chí ghi nhận (full width) */}
                        <div className="w-full">
                          {!isMobile ? (
                            <Select
                              value={criterionId}
                              onValueChange={handleCriterionChange}
                              label="Tiêu chí ghi nhận"
                            >
                              <SelectTrigger className="bg-white/40 border-white/70 backdrop-blur-sm h-9 sm:h-10 rounded-xl px-3.5 text-xs sm:text-[12.5px] text-[#1E293B] font-semibold outline-none w-full shadow-xs focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-150 ease-out hover:bg-white/60 cursor-pointer font-sans">
                                <SelectValue placeholder="Chọn tiêu chí..." />
                              </SelectTrigger>
                              <SelectContent className="bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-white/70 font-sans max-h-60">
                                {orderedCriteria.frequent.length > 0 && <SelectLabel>Sử dụng nhiều</SelectLabel>}
                                {orderedCriteria.frequent.map(c => (
                                  <SelectItem key={c._id} value={c._id}>
                                    {c.criterion_name} ({c.score_per_unit || c.min_score || 0}đ)
                                  </SelectItem>
                                ))}
                                {orderedCriteria.frequent.length > 0 && orderedCriteria.remaining.length > 0 && <SelectSeparator />}
                                {orderedCriteria.remaining.map(c => (
                                  <SelectItem key={c._id} value={c._id}>
                                    {c.criterion_name} ({c.score_per_unit || c.min_score || 0}đ)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex flex-col w-full">
                              <label className="text-xs font-semibold text-slate-600 mb-1 ml-1">Tiêu chí ghi nhận</label>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsCriterionPickerOpen(true)}
                                className="h-9 sm:h-10 w-full justify-between rounded-xl border border-white/70 bg-white/40 backdrop-blur-sm px-3.5 text-left text-xs sm:text-[12.5px] font-semibold text-[#1E293B] shadow-xs hover:bg-white/60 transition-all duration-150 ease-out"
                              >
                                <span className={`truncate ${criterionId ? 'text-[#1E293B]' : 'font-normal text-[#64748B]/60'}`}>
                                  {criteria.find(c => c._id === criterionId)?.criterion_name || 'Chọn tiêu chí...'}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                              </Button>
                              <Dialog open={isCriterionPickerOpen} onOpenChange={setIsCriterionPickerOpen}>
                                <DialogContent
                                  showCloseButton={false}
                                  onOpenAutoFocus={(e) => e.preventDefault()}
                                  className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[calc(100vw-2.5rem)] max-w-md max-h-[75vh] flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/95 backdrop-blur-md p-4 shadow-2xl overflow-hidden"
                                >
                                  <DialogTitle className="sr-only">Chọn tiêu chí</DialogTitle>
                                  <DialogDescription className="sr-only">Danh sách tiêu chí ghi nhận</DialogDescription>
                                  <Input
                                    type="search"
                                    role="combobox"
                                    aria-expanded={isCriterionPickerOpen}
                                    aria-label="Tìm tiêu chí"
                                    value={criterionSearch}
                                    onChange={e => setCriterionSearch(e.target.value)}
                                    placeholder="Tìm tiêu chí..."
                                    className="h-9.5 rounded-xl text-xs bg-slate-50 border-slate-200 placeholder:text-[#64748B]/60"
                                  />
                                  <div className="flex flex-1 max-h-60 flex-col gap-1 overflow-y-auto overscroll-contain" role="listbox" aria-label="Danh sách tiêu chí">
                                    {orderedCriteria.frequent.length > 0 && !criterionSearch && (
                                      <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                        Sử dụng nhiều
                                      </div>
                                    )}
                                    {[...orderedCriteria.frequent, ...orderedCriteria.remaining]
                                      .filter(c => c.criterion_name.toLowerCase().includes(criterionSearch.toLowerCase()))
                                      .map(c => {
                                        const isSelected = criterionId === c._id;
                                        return (
                                          <button
                                            key={c._id}
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            onClick={() => {
                                              handleCriterionChange(c._id);
                                              setIsCriterionPickerOpen(false);
                                              setCriterionSearch('');
                                            }}
                                            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                                              isSelected ? 'bg-blue-50 text-blue-800 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                          >
                                            <span className="truncate">{c.criterion_name}</span>
                                            <span className="ml-2 shrink-0 text-[11px] text-slate-400 font-mono">
                                              ({c.score_per_unit || c.min_score || 0}đ)
                                            </span>
                                          </button>
                                        );
                                      })}
                                    {criteria.filter(c => c.criterion_name.toLowerCase().includes(criterionSearch.toLowerCase())).length === 0 && (
                                      <div className="py-6 text-center text-xs text-slate-400">Không tìm thấy tiêu chí.</div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-0.5">
                          <span aria-live="polite">Đã chọn: <strong className="text-[#1A73E8]">{addedViolations.filter(v => v.evaluation_detail_id === criterionId).length}</strong> / {classStudents.length}</span>
                          {isStudentsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" aria-label="Đang tải sinh viên" />}
                        </div>

                        {/* Danh sách sinh viên tinh gọn */}
                        <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2 ${quickGridClass(classStudents.length)}`} aria-label="Danh sách sinh viên">
                          {classStudents.map(student => {
                            const selected = addedViolations.some(v => v.student_id === student._id && v.evaluation_detail_id === criterionId);
                            return (
                              <button
                                key={student._id}
                                type="button"
                                aria-pressed={selected}
                                disabled={!criterionId}
                                onClick={() => handleToggleQuickStudent(student)}
                                className={`text-left rounded-lg border min-h-[52px] sm:min-h-[56px] lg:min-h-0 p-3 sm:p-3.5 lg:px-2.5 lg:py-2 transition-all duration-150 ease-out flex items-center justify-between gap-2 ${
                                  selected
                                    ? 'border-rose-400/90 bg-rose-50/90 text-rose-900 shadow-2xs'
                                    : 'border-blue-200 bg-blue-50/70 text-slate-800 shadow-sm hover:border-blue-400 hover:bg-blue-100/80'
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
                                  <span className="block text-[13.5px] sm:text-sm lg:text-xs font-bold truncate leading-tight">{student.full_name}</span>
                                  <span className="block text-xs lg:text-[10.5px] text-slate-500 font-mono leading-tight">MSSV: {student.student_code}</span>
                                </div>
                                {selected && (
                                  <span className="hidden lg:inline-flex shrink-0 text-[10px] font-bold text-red-600 bg-red-100/90 border border-red-200/80 px-1.5 py-0.5 rounded">
                                    Đã chọn
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          {!isStudentsLoading && classStudents.length === 0 && <div className="col-span-full py-5 text-center text-xs text-slate-400 italic">Không tìm thấy sinh viên.</div>}
                        </div>
                        {classIds.some(id => hasMoreStudents[id]) && classStudents.length > 0 && (
                          <Button type="button" variant="outline" onClick={handleLoadMoreStudents} disabled={isStudentsLoading} className="self-center h-7.5 rounded-lg text-xs border-white/70 bg-white/40 backdrop-blur-sm hover:bg-white/60 transition-all duration-150 ease-out">Tải thêm sinh viên</Button>
                        )}
                        <p className="hidden lg:block text-[11px] text-slate-400">Chọn tiêu chí trước, sau đó nhấn vào thẻ sinh viên để thêm hoặc bỏ ghi nhận.</p>
                      </div>
                    )}
                  </div>

                  {isEditMode ? (
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-[#1A73E8] font-medium shadow-xs">
                      Bạn đang chỉnh sửa một bản ghi duy nhất. Các thay đổi sẽ được lưu bằng API cập nhật và không tạo thêm bản ghi mới.
                    </div>
                  ) : null}

                  {entryMode === 'manual' && !isEditMode && (
                    <div className="border border-white/60 rounded-xl overflow-hidden w-full shadow-xs bg-white/15 backdrop-blur-2xs">
                      <table className="w-full text-left border-collapse min-w-max">
                        <thead>
                          <tr className="bg-white/40 backdrop-blur-sm border-b border-white/60">
                            <th className="px-3.5 py-2 font-bold text-[#1A73E8] text-[11px] tracking-[0.5px] uppercase">HỌ TÊN</th>
                            <th className="px-3.5 py-2 font-bold text-[#1A73E8] text-[11px] tracking-[0.5px] uppercase">TIÊU CHÍ</th>
                            <th className="px-3.5 py-2 font-bold text-[#1A73E8] text-[11px] tracking-[0.5px] uppercase">GHI CHÚ</th>
                            <th className="px-3.5 py-2 font-bold text-[#1A73E8] text-[11px] tracking-[0.5px] uppercase text-center w-24">THAO TÁC</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/20">
                          {addedViolations.map((violation, idx) => {
                            const criterion = criteria.find(c => c._id === violation.evaluation_detail_id);
                            const type = criterion?.criterion_type || (violation.points_effect > 0 ? 'cong_diem' : 'ky_luat');

                            let badgeClass = 'bg-blue-500/10 text-[#1A73E8] border border-blue-500/20';
                            if (type === 'khen_thuong') {
                              badgeClass = 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20';
                            } else if (type === 'ky_luat') {
                              badgeClass = 'bg-rose-500/10 text-rose-700 border border-rose-500/20';
                            }

                            return (
                              <tr key={idx} className="hover:bg-white/50 transition-all duration-150 ease-out">
                                <td className="px-3.5 py-2 font-semibold text-[#1E293B] text-xs">
                                  <div className="flex flex-col">
                                    <span>{violation.student_name}</span>
                                    <span className="text-slate-400 text-[10px] font-medium font-mono">MSSV: {violation.student_code}</span>
                                  </div>
                                </td>
                                <td className="px-3.5 py-2">
                                  <span className={`font-bold rounded-lg px-2 py-0.5 text-[11px] inline-block tracking-wide ${badgeClass}`}>
                                    {violation.criterion_name}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2 font-normal text-[#1E293B] text-xs max-w-[200px] truncate" title={violation.class_note}>
                                  {violation.class_note}
                                </td>
                                <td className="px-3.5 py-2 text-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => handleRemoveViolationFromList(idx)}
                                    className="w-7 h-7 rounded-lg hover:bg-rose-100/80 hover:text-rose-600 p-0 flex items-center justify-center text-rose-500 transition-all duration-150 ease-out hover:scale-[1.05] bg-white/40 border border-white/70 shadow-xs outline-none cursor-pointer mx-auto"
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
                              <td colSpan={4} className="px-3.5 py-4 text-center text-xs text-slate-500 italic bg-white/10">
                                Chưa có ghi nhận sinh viên trong danh sách tạm.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Hiển thị sĩ số/tổng hợp xem nhanh */}
                  <div className="hidden lg:flex flex-wrap items-center gap-3 sm:gap-5 text-xs font-bold text-slate-600 px-3 py-2 bg-white/40 border border-white/60 rounded-xl mt-0.5">
                    <div className="flex items-center gap-1.5">
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
            <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-300/30 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 w-full">
              <div className="hidden sm:flex items-center text-xs text-slate-500 font-medium italic">
                Hãy kiểm tra kỹ thông tin rèn luyện trước khi lưu.
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 items-center justify-end w-full sm:w-auto ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="border border-white/70 bg-white/40 hover:bg-white/70 rounded-xl px-5 sm:px-7 py-2 text-[#1E293B] font-bold text-xs sm:text-[13px] h-9 sm:h-9.5 hover:scale-[1.01] transition-all duration-150 ease-out"
                >
                  Hủy bỏ
                </Button>

                <Button
                  type="submit"
                  disabled={isSaving}
                  className="relative bg-[#1A73E8] text-white font-bold px-6 sm:px-8 py-2 rounded-xl shadow-xs hover:bg-[#1557b0] focus:ring-2 focus:ring-blue-500/20 transition-all duration-150 ease-out hover:scale-[1.01] flex items-center justify-center gap-1.5 border-none outline-none cursor-pointer text-xs sm:text-[13px] h-9 sm:h-9.5 disabled:opacity-75 disabled:cursor-not-allowed"
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
