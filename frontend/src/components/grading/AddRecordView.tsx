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
import { RecordSelectionDialog, quickGridClass, toggleSelectionValue, MobileStudentSelectionDialog } from './RecordSelectionUi';

const getDisplayClassName = (className?: string) =>
  String(className || '').replace(/\s*\(\d{4}\s*-\s*\d{4}\)\s*$/, '').trim();

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
  selectedStudentId?: string;
  entryMode?: 'manual' | 'quick';
  pendingQuickViolationKeys: string[];
  violationNote: string;
  addedViolations: ViolationItem[];
}

export function buildStudentRecordDraft({
  classIds, reportDate, criterionId, selectedStudentId = '', entryMode = 'quick',
  pendingQuickViolationKeys, violationNote, addedViolations,
}: {
  classIds: string[]; reportDate: Date; criterionId: string; selectedStudentId?: string;
  entryMode?: 'manual' | 'quick'; pendingQuickViolationKeys: Set<string>;
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
    && (draft.selectedStudentId === undefined || typeof draft.selectedStudentId === 'string')
    && (draft.entryMode === undefined || draft.entryMode === 'manual' || draft.entryMode === 'quick')
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
  const classIdsRef = React.useRef<string[]>([]);
  const [criterionId, setCriterionId] = useState('');
  const [isCriterionPickerOpen, setIsCriterionPickerOpen] = useState(false);
  const [criterionSearch, setCriterionSearch] = useState('');
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Card Phải (Ghi nhận sinh viên)
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileStudentOverlayOpen, setIsMobileStudentOverlayOpen] = useState(false);
  const handledPrereqKeyRef = React.useRef('');
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
    if (draft.selectedStudentId) {
      setSelectedStudentId(draft.selectedStudentId);
    }
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
      entryMode: 'quick',
      pendingQuickViolationKeys,
      violationNote,
      addedViolations,
    }));
  }, [
    addedViolations, classIds, criterionId, draftHydrated, isEditMode,
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
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateMobile = () => {
      setIsMobile(mediaQuery.matches);
    };
    updateMobile();
    mediaQuery.addEventListener?.('change', updateMobile);
    return () => mediaQuery.removeEventListener?.('change', updateMobile);
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

  // Auto open mobile student overlay when class and criterion are committed
  useEffect(() => {
    if (!isMobile || isEditMode) return;
    if (classIds.length === 0 || !criterionId) return;
    const prereqKey = `${classIds.slice().sort().join(',')}:${criterionId}`;
    if (prereqKey !== handledPrereqKeyRef.current) {
      handledPrereqKeyRef.current = prereqKey;
      setIsMobileStudentOverlayOpen(true);
    }
  }, [classIds, criterionId, isMobile, isEditMode]);

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

  const handleMobileRosterConfirm = async (confirmedStudentIds: string[]) => {
    if (!criterionId) return;
    const criterion = criteria.find(c => c._id === criterionId);
    if (!criterion) return;

    const otherViolations = addedViolations.filter(v => v.evaluation_detail_id !== criterionId);
    const newViolations = confirmedStudentIds.map(studentId => {
      const existing = addedViolations.find(v => v.student_id === studentId && v.evaluation_detail_id === criterionId);
      if (existing) return existing;
      const student = classStudents.find(s => s._id === studentId);
      if (!student) return null;
      return {
        student_id: student._id,
        class_id: typeof student.class_id === 'object' ? student.class_id?._id : student.class_id,
        student_name: student.full_name,
        student_code: student.student_code,
        evaluation_detail_id: criterion._id,
        criterion_name: criterion.criterion_name,
        points_effect: criterion.score_per_unit || criterion.min_score || -5,
        class_note: violationNote.trim() || 'Không có ghi chú',
      };
    }).filter(Boolean) as ViolationItem[];

    const nextViolations = [...otherViolations, ...newViolations];
    setAddedViolations(nextViolations);
    setPendingQuickViolationKeys(new Set());
    setIsMobileStudentOverlayOpen(false);

    await handleSave(undefined, nextViolations);
  };

  const handleSave = async (e?: React.FormEvent, overrideViolations?: ViolationItem[]) => {
    if (e) e.preventDefault();

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

    const currentViolations = overrideViolations ?? addedViolations;
    if (currentViolations.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 sinh viên vào danh sách ghi nhận!');
      return;
    }

    setIsSaving(true);
    const actionBatchId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    
    try {
      const recordsToCreate = currentViolations.map((violation) => {
        return {
          student_id: violation.student_id,
          criterion_id: violation.evaluation_detail_id,
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
      classIds, reportDate, criterionId, selectedStudentId, entryMode: 'quick',
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
      <div className="flex flex-col gap-4 sm:gap-5 mx-auto w-full md:flex-1 md:min-h-0">
        {/* Page Header Section */}
        <div className="flex items-center justify-between gap-4 w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            className="group bg-white/50 backdrop-blur-md border border-white/80 hover:bg-white/80 text-[#1A73E8] font-bold text-xs sm:text-sm h-auto py-1 px-1.5 pr-3.5 rounded-xl uppercase tracking-wide flex items-center gap-2 shadow-xs shadow-slate-300/30 transition-all duration-150 ease-out hover:scale-[1.02] cursor-pointer"
            title="Quay lại"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/60 border border-white/80 flex items-center justify-center shrink-0 group-hover:bg-white/90 transition-all">
              <ArrowLeft className="w-4 h-4 text-slate-700 group-hover:text-[#1A73E8] transition-colors" />
            </div>
            <div className="h-4 w-px bg-slate-300/60 shrink-0" />
            <Sparkles className="w-4 h-4 text-[#1A73E8] animate-pulse shrink-0" />
            <span className="truncate">{isEditMode ? 'Hệ thống chỉnh sửa ghi nhận HSSV' : 'Hệ thống ghi nhận HSSV'}</span>
          </Button>
        </div>

        {isLoadingData ? (
          <div className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl p-10 shadow-xs flex flex-col items-center justify-center min-h-[250px] gap-3">
            <Loader2 className="w-7 h-7 text-[#1A73E8] animate-spin" />
            <span className="text-[#1A73E8] font-semibold text-xs">Đang nạp dữ liệu rèn luyện...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-2 md:flex-1 md:min-h-0">
            {/* Main Grid Layout (12 Columns) */}
            <div className="grid grid-cols-12 gap-3.5 sm:gap-4 lg:gap-5 w-full relative z-10 md:flex-1 md:min-h-0">

              {/* Left Column: Core Info (col-span-12 md:col-span-5 lg:col-span-4) */}
              <div className="col-span-12 md:col-span-5 lg:col-span-4 flex flex-col gap-3.5 sm:gap-4 md:min-h-0">
                {/* Section 1: Thông tin cơ bản */}
                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-300/30 rounded-2xl p-3.5 sm:p-4 lg:p-4.5 flex flex-col gap-4 w-full md:flex-none">
                  <div className="flex gap-2.5 items-start text-[#1A73E8] border-b border-slate-200/60 pb-3">
                    <FileText className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm lg:text-[15px] leading-none">Thông tin cơ bản</h3>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">Thiết lập lớp, tiêu chí và thời điểm ghi nhận</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 w-full">
                    {/* Lớp học */}
                    <div className="flex flex-col w-full relative">
                      <RecordSelectionDialog
                        label="Lớp học"
                        labelClassName="text-[11px] md:text-[10px] uppercase tracking-wide text-slate-500"
                        title="Chọn lớp học"
                        description={isEditMode ? 'Chọn một lớp học cho bản ghi này.' : 'Chọn một hoặc nhiều lớp học rồi nhấn Xác nhận để áp dụng.'}
                        hideHeader={true}
                        value={isEditMode ? (classId || '') : classIds}
                        displayValue={
                          isEditMode
                            ? getDisplayClassName(classes.find(c => c._id === (classId || ''))?.class_name)
                            : (classIds.length > 0
                                ? classIds.map(id => getDisplayClassName(classes.find(c => c._id === id)?.class_name)).filter(Boolean).join(', ')
                                : '')
                        }
                        multiple={!isEditMode}
                        placeholder="Chọn lớp"
                        searchable
                        isMobile={isMobile}
                        mobileShowCloseButton={false}
                        mobilePreventOpenAutoFocus
                        onConfirm={(val) => {
                          if (isEditMode) {
                            const singleId = Array.isArray(val) ? val[0] || '' : val;
                            handleClassChange(singleId);
                          } else {
                            const nextIds = Array.isArray(val) ? val : (val ? [val] : []);
                            setClassIds(nextIds);
                          }
                        }}
                      >
                        {(draftValue, setDraftValue, searchQuery) => {
                          const filtered = classes.filter(c => `${c.class_name} ${c.class_year || ''} ${c._id}`.toLowerCase().includes(searchQuery.toLowerCase()));
                          const currentSelected = Array.isArray(draftValue) ? draftValue : (draftValue ? [draftValue] : []);
                          return (
                            <div className="flex flex-col gap-1">
                              {filtered.map(c => {
                                const isSelected = isEditMode ? draftValue === c._id : currentSelected.includes(c._id);
                                return (
                                  <button
                                    key={c._id}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => {
                                      if (isEditMode) {
                                        setDraftValue(c._id);
                                      } else {
                                        setDraftValue(toggleSelectionValue(currentSelected, c._id));
                                      }
                                    }}
                                    className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 md:py-2 text-left font-semibold transition-colors min-h-[44px] md:min-h-0 text-sm md:text-xs ${
                                      isSelected
                                        ? 'bg-blue-50 text-blue-800 font-bold'
                                        : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <span className="truncate">{getDisplayClassName(c.class_name)}</span>
                                    {isSelected && <Check className="h-4 w-4 shrink-0 text-[#1A73E8] ml-2" />}
                                  </button>
                                );
                              })}
                              {filtered.length === 0 && (
                                <div className="py-6 text-center text-sm md:text-xs text-slate-400">Không tìm thấy lớp.</div>
                              )}
                            </div>
                          );
                        }}
                      </RecordSelectionDialog>
                    </div>

                    {/* Tiêu chí ghi nhận (AC-03: rendered inside Thông tin cơ bản) */}
                    <div className="flex flex-col w-full">
                      <label className="text-[11px] md:text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 ml-1">Tiêu chí ghi nhận</label>
                      {!isMobile ? (
                        <Select
                          value={criterionId}
                          onValueChange={handleCriterionChange}
                        >
                          <SelectTrigger className="bg-white/40 border-white/70 backdrop-blur-sm min-h-[44px] md:min-h-0 h-11 md:h-9 md:sm:h-10 rounded-xl px-3.5 text-sm md:text-xs md:sm:text-[12.5px] text-[#1E293B] font-semibold outline-none w-full shadow-xs focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-150 ease-out hover:bg-white/60 cursor-pointer font-sans">
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
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsCriterionPickerOpen(true)}
                            className="min-h-[44px] md:min-h-0 h-11 md:h-9 md:sm:h-10 w-full justify-between rounded-xl border border-white/70 bg-white/40 backdrop-blur-sm px-3.5 text-left text-sm md:text-xs md:sm:text-[12.5px] font-semibold text-[#1E293B] shadow-xs hover:bg-white/60 transition-all duration-150 ease-out"
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
                                className="min-h-[44px] md:min-h-0 h-11 md:h-9.5 rounded-xl text-sm md:text-xs bg-slate-50 border-slate-200 placeholder:text-[#64748B]/60"
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
                                        className={`flex items-center justify-between rounded-xl px-3.5 py-3 md:py-2.5 text-left text-sm md:text-xs font-semibold transition-colors min-h-[44px] md:min-h-0 ${
                                          isSelected ? 'bg-blue-50 text-blue-800 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                      >
                                        <span className="truncate">{c.criterion_name}</span>
                                        <span className="ml-2 shrink-0 text-xs md:text-[11px] text-slate-400 font-mono">
                                          ({c.score_per_unit || c.min_score || 0}đ)
                                        </span>
                                      </button>
                                    );
                                  })}
                                {criteria.filter(c => c.criterion_name.toLowerCase().includes(criterionSearch.toLowerCase())).length === 0 && (
                                  <div className="py-6 text-center text-sm md:text-xs text-slate-400">Không tìm thấy tiêu chí.</div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
                    </div>

                    {/* Ngày ghi nhận */}
                    <div className="flex flex-col w-full">
                      <label className="text-[11px] md:text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 ml-1">Ngày ghi nhận</label>
                      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="bg-white/40 border border-white/70 backdrop-blur-sm min-h-[44px] md:min-h-0 h-11 md:h-9 md:sm:h-10 rounded-xl px-3.5 text-sm md:text-xs md:sm:text-[12.5px] text-[#1E293B] font-semibold outline-none flex items-center justify-between hover:bg-white/60 hover:scale-[1.005] transition-all duration-150 ease-out w-full shadow-xs text-left font-sans"
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

                    {/* Form elements for Single Edit Mode */}
                    {isEditMode && (
                      <>
                        <div className="flex flex-col w-full">
                          <label className="text-[11px] md:text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 ml-1">Họ tên sinh viên</label>
                          {!isMobile ? (
                            <Select
                              value={selectedStudentId}
                              onValueChange={setSelectedStudentId}
                              disabled={classIds.length === 0}
                            >
                              <SelectTrigger className="bg-white/40 border-white/70 backdrop-blur-sm min-h-[44px] md:min-h-0 h-11 md:h-9 md:sm:h-10 rounded-xl px-3.5 text-sm md:text-xs md:sm:text-[12.5px] text-[#1E293B] font-semibold outline-none w-full shadow-xs focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-150 ease-out hover:bg-white/60 cursor-pointer font-sans disabled:opacity-50">
                                <SelectValue placeholder={classIds.length > 0 ? 'Tìm tên...' : 'Vui lòng chọn lớp trước...'} />
                              </SelectTrigger>
                              <SelectContent className="bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-white/70 font-sans max-h-60">
                                {classStudents.map(s => (
                                  <SelectItem key={s._id} value={s._id}>
                                    {s.full_name} ({s.student_code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                disabled={classIds.length === 0}
                                onClick={() => setIsStudentPickerOpen(true)}
                                className="min-h-[44px] md:min-h-0 h-11 md:h-9 md:sm:h-10 w-full justify-between rounded-xl border border-white/70 bg-white/40 backdrop-blur-sm px-3.5 text-left text-sm md:text-xs md:sm:text-[12.5px] font-semibold text-[#1E293B] shadow-xs hover:bg-white/60 transition-all duration-150 ease-out disabled:opacity-50"
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
                                    autoFocus
                                    type="search"
                                    role="combobox"
                                    aria-expanded={isStudentPickerOpen}
                                    aria-label="Tìm sinh viên"
                                    value={studentsSearch}
                                    onChange={e => handleStudentSearch(e.target.value)}
                                    placeholder="Tìm tên hoặc mã sinh viên..."
                                    className="min-h-[44px] md:min-h-0 h-11 md:h-9.5 rounded-xl text-sm md:text-xs bg-slate-50 border-slate-200 placeholder:text-[#64748B]/60"
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
                                            className={`flex items-center justify-between rounded-xl px-3.5 py-3 md:py-2.5 text-left text-sm md:text-xs font-semibold transition-colors min-h-[44px] md:min-h-0 ${
                                              isSelected ? 'bg-blue-50 text-blue-800 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                          >
                                            <span className="truncate">{s.full_name}</span>
                                            <span className="ml-2 shrink-0 text-xs md:text-[11px] text-slate-400 font-mono">
                                              ({s.student_code})
                                            </span>
                                          </button>
                                        );
                                      })}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </>
                          )}
                        </div>

                        <Input
                          labelClassName="text-[11px] md:text-[10px] uppercase tracking-wide text-slate-500"
                          type="text"
                          label="Ghi chú chi tiết"
                          value={violationNote}
                          onChange={(e) => setViolationNote(e.target.value)}
                          placeholder="VD: Khen thưởng, vi phạm lần đầu..."
                          className="bg-white/40 border-white/70 backdrop-blur-sm min-h-[44px] md:min-h-0 h-11 md:h-9 md:sm:h-10 rounded-xl px-3.5 text-sm md:text-xs md:sm:text-[12.5px] text-[#1E293B] placeholder:text-[#64748B]/60 placeholder:font-normal focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:bg-white/70 focus-visible:border-blue-400 shadow-xs transition-all duration-150 ease-out"
                          containerClassName="w-full"
                        />
                      </>
                    )}

                  </div>
                </div>
              </div>

              {/* Right Column: Desktop Roster Section (AC-04: visible >=768px, one card only) */}
              <div className="hidden md:flex col-span-12 md:col-span-7 lg:col-span-8 flex-col gap-3.5 sm:gap-4 md:min-h-0">
                {isEditMode ? (
                  <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-300/30 rounded-2xl p-4.5 flex flex-col gap-3 w-full md:flex-1 md:min-h-0">
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-[#1A73E8] font-medium shadow-xs">
                      Bạn đang chỉnh sửa một bản ghi duy nhất. Các thay đổi sẽ được lưu bằng API cập nhật và không tạo thêm bản ghi mới.
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-300/30 rounded-2xl p-3.5 sm:p-4 lg:p-4.5 flex flex-col gap-3 w-full md:flex-1 md:min-h-0">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2 items-center text-[#1A73E8]">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <h3 className="font-bold text-sm lg:text-[15px] leading-none">Danh sách sinh viên</h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <span aria-live="polite">
                          Đã chọn: <strong className="text-[#1A73E8]">{addedViolations.filter(v => v.evaluation_detail_id === criterionId).length}</strong> / {classStudents.length}
                        </span>
                        {isStudentsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" aria-label="Đang tải sinh viên" />}
                      </div>
                    </div>

                    {/* Student Card Grid */}
                    <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2 md:flex-1 md:min-h-0 md:!max-h-none ${quickGridClass(classStudents.length)}`} aria-label="Danh sách sinh viên">
                      {classStudents.map(student => {
                        const selected = addedViolations.some(v => v.student_id === student._id && v.evaluation_detail_id === criterionId);
                        return (
                          <button
                            key={student._id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            disabled={!criterionId}
                            onClick={() => handleToggleQuickStudent(student)}
                            className={`h-full text-left rounded-xl border min-h-[52px] sm:min-h-[56px] lg:min-h-[52px] p-3 sm:p-3.5 lg:px-2.5 lg:py-2 transition-all duration-150 ease-out flex items-center justify-between gap-2 ${
                              selected
                                ? 'border-rose-400/90 bg-rose-50/90 text-rose-900 shadow-2xs'
                                : 'border-blue-200 bg-blue-50/70 text-slate-800 shadow-sm hover:border-blue-400 hover:bg-blue-100/80'
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
                              <span className="block text-sm md:text-[13.5px] lg:text-xs font-bold leading-tight break-words">{student.full_name}</span>
                              <span className="block text-xs md:text-xs lg:text-[10.5px] text-slate-500 font-mono leading-tight">MSSV: {student.student_code}</span>
                            </div>
                            {selected && (
                              <span className="shrink-0 text-[10px] font-bold text-red-600 bg-red-100/90 border border-red-200/80 px-1.5 py-0.5 rounded">
                                Đã chọn
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {!isStudentsLoading && classStudents.length === 0 && (
                        <div className="col-span-full py-5 text-center text-sm md:text-xs text-slate-400 italic">
                          {classIds.length === 0 ? 'Vui lòng chọn lớp học để xem danh sách sinh viên.' : 'Không tìm thấy sinh viên.'}
                        </div>
                      )}
                    </div>

                    {classIds.some(id => hasMoreStudents[id]) && classStudents.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleLoadMoreStudents}
                        disabled={isStudentsLoading}
                        className="self-center min-h-[44px] md:min-h-0 h-11 md:h-7.5 px-4 md:px-3 rounded-xl text-sm md:text-xs border-white/70 bg-white/40 backdrop-blur-sm hover:bg-white/60 transition-all duration-150 ease-out"
                      >
                        Tải thêm sinh viên
                      </Button>
                    )}
                    <p className="text-[11px] text-slate-400">Chọn tiêu chí trước, sau đó nhấn vào thẻ sinh viên để thêm hoặc bỏ ghi nhận.</p>
                  </div>
                )}
              </div>

            </div>

            {/* Mobile Student Selection Overlay (AC-05, AC-06) */}
            {isMobile && !isEditMode && (
              <MobileStudentSelectionDialog
                open={isMobileStudentOverlayOpen}
                onOpenChange={setIsMobileStudentOverlayOpen}
                students={classStudents}
                selectedStudentIds={addedViolations.filter(v => v.evaluation_detail_id === criterionId).map(v => v.student_id)}
                onConfirm={handleMobileRosterConfirm}
                onCancel={() => setIsMobileStudentOverlayOpen(false)}
                loading={isStudentsLoading}
                hasMore={classIds.some(id => hasMoreStudents[id])}
                onLoadMore={handleLoadMoreStudents}
              />
            )}

            {/* Footer Actions Panel */}
            <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-300/30 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 w-full md:w-[calc(66.666%-0.5rem)] md:ml-[calc(33.333%+0.5rem)] shrink-0">
              <div className="hidden sm:flex items-center text-xs text-slate-500 font-medium italic">
                Hãy kiểm tra kỹ thông tin rèn luyện trước khi lưu.
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 items-center justify-end w-full sm:w-auto ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="border border-white/70 bg-white/40 hover:bg-white/70 rounded-xl px-5 sm:px-7 py-2 text-[#1E293B] font-bold text-sm md:text-xs md:sm:text-[13px] min-h-[44px] md:min-h-0 h-11 md:h-9 md:sm:h-9.5 hover:scale-[1.01] transition-all duration-150 ease-out"
                >
                  Hủy bỏ
                </Button>

                <Button
                  type="submit"
                  disabled={isSaving}
                  className="relative bg-[#1A73E8] text-white font-bold px-6 sm:px-8 py-2 rounded-xl shadow-xs hover:bg-[#1557b0] focus:ring-2 focus:ring-blue-500/20 transition-all duration-150 ease-out hover:scale-[1.01] flex items-center justify-center gap-1.5 border-none outline-none cursor-pointer text-sm md:text-xs md:sm:text-[13px] min-h-[44px] md:min-h-0 h-11 md:h-9 md:sm:h-9.5 disabled:opacity-75 disabled:cursor-not-allowed"
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
