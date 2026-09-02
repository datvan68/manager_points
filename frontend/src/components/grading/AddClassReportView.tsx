'use client';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar as CalendarIcon, ChevronDown, Loader2, Plus, Trash2, AlertTriangle, FileText, Check, Save, Settings, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectLabel, SelectSeparator } from '@/components/ui/select';
import { format, parse } from 'date-fns';
import { toast } from 'sonner';
import { classApi, Class } from '@/api/class-api';
import { dailyClassReportApi, DailyClassReport } from '@/api/daily-class-report-api';
import { studentApi, Student } from '@/api/student-api';
import { criteriaApi, Criterion } from '@/api/criteria-api';
import { academicRecordApi, AcademicRecord } from '@/api/academic-record-api';
import { useAuth } from '@/providers/auth-provider';
import { semesterApi } from '@/api/semester-api';
import { summariesPointApi } from '@/api/summaries-point-api';
import { evaluationDetailApi, EvaluationDetail } from '@/api/evaluation-detail-api';
import { incrementCriterionUsage, orderCriteriaByUsage, readCriterionUsage, CriterionUsage } from './criterion-usage';
import { RecordSelectionDialog, quickGridClass, toggleSelectionValue, MobileStudentSelectionDialog } from './RecordSelectionUi';
import { useRecordDraft } from '@/hooks/useRecordDraft';

export interface ViolationItem {
  student_id: string;
  class_id?: string;
  student_name: string;
  student_code: string;
  // `criterion_id` is the actual Criterion ObjectId string
  criterion_id: string;
  // `evaluation_detail_id` is the optional EvaluationDetail id after it's created/fetched
  evaluation_detail_id?: string;
  criterion_name: string;
  points_effect: number;
  class_note: string;
}

export function createViolationItem(student: Student, criterion: Criterion, note: string): ViolationItem {
  return {
    student_id: student._id,
    class_id: getIdValue(student.class_id),
    student_name: student.full_name,
    student_code: student.student_code,
    criterion_id: criterion._id,
    evaluation_detail_id: undefined,
    criterion_name: criterion.criterion_name,
    points_effect: criterion.score_per_unit || criterion.min_score || -5,
    class_note: note.trim() || 'Không có ghi chú',
  };
}

export function getViolationAddError(
  violations: ViolationItem[],
  studentId: string,
  criterionId: string,
): 'duplicate' | 'limit' | null {
  if (violations.some(item => item.student_id === studentId && item.criterion_id === criterionId)) return 'duplicate';
  return null;
}

export function mergeStudentsById(studentGroups: Student[][]): Student[] {
  const studentsById = new Map<string, Student>();
  studentGroups.flat().forEach(student => studentsById.set(student._id, student));
  return Array.from(studentsById.values());
}

export function shouldResetClassDependentState(isRestoringDraft: boolean, isHydratingEdit = false): boolean {
  return !isRestoringDraft && !isHydratingEdit;
}

export function filterClassesBySearch(classes: Class[], query: string): Class[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return classes;
  return classes.filter(item => normalizeText(`${item.class_name} ${item.class_year} ${item._id}`).includes(normalizedQuery));
}

export function clearPendingQuickViolations(violations: ViolationItem[], pendingKeys: Set<string>): ViolationItem[] {
  return violations.filter(violation => !pendingKeys.has(`${violation.student_id}:${violation.criterion_id}`));
}

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

function getIdValue(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return value._id;
  return '';
}

function isValidObjectId(value: string): boolean {
  return typeof value === 'string' && OBJECT_ID_REGEX.test(value);
}

type DailyReportApiClient = Pick<typeof dailyClassReportApi, 'createDailyClassReport'>;

export async function resolveDailyReportForClass({
  api,
  fields,
}: {
  api: DailyReportApiClient;
  fields: Parameters<typeof dailyClassReportApi.createDailyClassReport>[0];
}): Promise<DailyClassReport> {
  return api.createDailyClassReport(fields);
}

function normalizeText(value: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function resolveCriterionByName(criteria: Criterion[], names: Array<string | undefined | null>) {
  const normalizedNames = names
    .map(name => normalizeText(name || ''))
    .filter(Boolean);

  if (normalizedNames.length === 0) return null;

  const exactMatches = criteria.filter(criterion => {
    const criterionName = normalizeText(criterion.criterion_name);
    return normalizedNames.some(name => criterionName === name);
  });

  if (exactMatches.length === 1) return exactMatches[0];

  if (exactMatches.length > 1) {
    return exactMatches.find(criterion => {
      const criterionName = normalizeText(criterion.criterion_name);
      return normalizedNames.includes(criterionName);
    }) || exactMatches[0];
  }

  const includesMatches = criteria.filter(criterion => {
    const criterionName = normalizeText(criterion.criterion_name);
    return normalizedNames.some(name => criterionName.includes(name) || name.includes(criterionName));
  });

  if (includesMatches.length === 1) return includesMatches[0];

  return null;
}

function resolveCriterionFromRecord(rec: AcademicRecord, criteria: Criterion[]) {
  const criterionIdFromPrimary = getIdValue((rec as any).criterion_id);
  const criterionIdFromCriteria = getIdValue((rec as any).criteria_id);
  const evalDetailObj = typeof rec.evaluation_detail_id === 'object' ? rec.evaluation_detail_id : null;
  const criterionIdFromEval = evalDetailObj ? getIdValue(evalDetailObj.criterion_id) : '';

  const canonicalName = (rec.record_title || rec.description || '').trim();
  const criterionNameFromRecord = (rec as any).criterion_name || canonicalName;

  const directId = criterionIdFromPrimary || criterionIdFromCriteria || criterionIdFromEval;
  if (directId) {
    const matchedById = criteria.find(c => c._id === directId);
    if (matchedById) return matchedById;
  }

  return resolveCriterionByName(criteria, [criterionNameFromRecord, canonicalName]);
}

export function getInitialCriterionId(violations: ViolationItem[], criteria: Criterion[]): string {
  return violations.find(violation => criteria.some(criterion => criterion._id === violation.criterion_id))?.criterion_id || '';
}

export function mapAcademicRecordsToViolations(
  records: AcademicRecord[],
  criteria: Criterion[],
  classId: string,
): ViolationItem[] {
  return records.map(rec => {
    const stObj = typeof rec.student_id === 'object' ? rec.student_id : null;
    const matchedCriterion = resolveCriterionFromRecord(rec, criteria);
    const evalDetailObj = typeof rec.evaluation_detail_id === 'object' ? rec.evaluation_detail_id : null;
    const evaluationDetailId = evalDetailObj ? (evalDetailObj._id || '') : (typeof rec.evaluation_detail_id === 'string' ? rec.evaluation_detail_id : '');
    const originalCriterionId = getIdValue((rec as any).criterion_id) || getIdValue((rec as any).criteria_id) || (evalDetailObj ? getIdValue(evalDetailObj.criterion_id) : '');
    const criterionName = matchedCriterion?.criterion_name || rec.record_title || (rec as any).criterion_name || 'Vi phạm';
    const pointsEffect = matchedCriterion?.score_per_unit || matchedCriterion?.min_score || rec.points_effect || -5;
    return {
      student_id: stObj ? stObj._id : rec.student_id,
      class_id: classId,
      student_name: stObj ? stObj.full_name : 'Sinh viên',
      student_code: stObj ? stObj.student_code : '',
      criterion_id: matchedCriterion?._id || originalCriterionId || '',
      evaluation_detail_id: evaluationDetailId,
      criterion_name: criterionName,
      points_effect: pointsEffect,
      class_note: rec.description || '',
    };
  });
}

interface AddClassReportViewProps {
  onBack: () => void;
  reportToEdit?: DailyClassReport | null;
  onSuccess: () => void;
}

interface ClassReportDraft {
  classIds: string[];
  reportDate: string;
  teacherName: string;
  classNote: string;
  selectedStudentId?: string;
  selectedCriterionId: string;
  violationNote: string;
  addedViolations: ViolationItem[];
  pendingQuickViolationKeys: string[];
  entryMode?: 'manual' | 'quick';
}

export function buildClassReportDraft({
  classIds, reportDate, teacherName, classNote, selectedStudentId = '', selectedCriterionId,
  violationNote, addedViolations, pendingQuickViolationKeys, entryMode = 'quick',
}: {
  classIds: string[]; reportDate: Date; teacherName: string; classNote: string;
  selectedStudentId?: string; selectedCriterionId: string; violationNote: string;
  addedViolations: ViolationItem[]; pendingQuickViolationKeys: Set<string>;
  entryMode?: 'manual' | 'quick';
}): ClassReportDraft {
  return {
    classIds, reportDate: reportDate.toISOString(), teacherName, classNote,
    selectedStudentId, selectedCriterionId, violationNote, addedViolations,
    pendingQuickViolationKeys: Array.from(pendingQuickViolationKeys), entryMode,
  };
}

export function isClassReportDraft(value: unknown): value is ClassReportDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<ClassReportDraft>;
  const validViolations = Array.isArray(draft.addedViolations) && draft.addedViolations.every(item => {
    if (!item || typeof item !== 'object') return false;
    const violation = item as Partial<ViolationItem>;
    return typeof violation.student_id === 'string'
      && (!violation.class_id || typeof violation.class_id === 'string')
      && typeof violation.student_name === 'string'
      && typeof violation.student_code === 'string'
      && typeof violation.criterion_id === 'string'
      && (!violation.evaluation_detail_id || typeof violation.evaluation_detail_id === 'string')
      && typeof violation.criterion_name === 'string'
      && typeof violation.points_effect === 'number'
      && typeof violation.class_note === 'string';
  });
  return Array.isArray(draft.classIds)
    && draft.classIds.every(item => typeof item === 'string')
    && typeof draft.reportDate === 'string'
    && typeof draft.teacherName === 'string'
    && typeof draft.classNote === 'string'
    && (draft.selectedStudentId === undefined || typeof draft.selectedStudentId === 'string')
    && typeof draft.selectedCriterionId === 'string'
    && typeof draft.violationNote === 'string'
    && validViolations
    && Array.isArray(draft.pendingQuickViolationKeys)
    && draft.pendingQuickViolationKeys.every(item => typeof item === 'string')
    && (draft.entryMode === undefined || draft.entryMode === 'manual' || draft.entryMode === 'quick');
}

export default function AddClassReportView({ onBack, reportToEdit, onSuccess }: AddClassReportViewProps) {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [criterionUsage, setCriterionUsage] = useState<CriterionUsage>({});

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // General Info states
  const [classIds, setClassIds] = useState<string[]>([]);
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [classNote, setClassNote] = useState('');

  // Sĩ số states (ẩn chỉnh tay, tự động tính toán hoặc cho phép xem)
  const [totalPresent, setTotalPresent] = useState<number>(0);
  const [totalAbsent, setTotalAbsent] = useState<number>(0);

  // Student Violation inputs
  const [selectedCriterionId, setSelectedCriterionId] = useState('');
  const [isCriterionPickerOpen, setIsCriterionPickerOpen] = useState(false);
  const [criterionSearch, setCriterionSearch] = useState('');
  const [violationNote, setViolationNote] = useState('');
  const [addedViolations, setAddedViolations] = useState<ViolationItem[]>([]);
  const [pendingQuickViolationKeys, setPendingQuickViolationKeys] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileStudentOverlayOpen, setIsMobileStudentOverlayOpen] = useState(false);
  const handledPrereqKeyRef = React.useRef('');

  useEffect(() => {
    setCriterionUsage(readCriterionUsage(user?.id));
  }, [user?.id]);

  // Cấu hình tiêu chí vắng mặt
  const [absentCriteriaIds, setAbsentCriteriaIds] = useState<string[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Học kỳ hoạt động thực tế
  const [activeSemesterId, setActiveSemesterId] = useState('60d0fe4f5311236168a109cb');

  const isEditMode = Boolean(reportToEdit && reportToEdit._id);
  const { draft, hydrated: draftHydrated, saveDraft, clearDraft } = useRecordDraft<ClassReportDraft>({
    form: 'class',
    userId: user?.id,
    enabled: !isEditMode,
    validate: isClassReportDraft,
  });
  const draftRestoredRef = React.useRef(false);
  const restoringDraftRef = React.useRef(false);
  const editHydrationPendingRef = React.useRef(false);
  const classIdsRef = React.useRef<string[]>([]);
  const dataReadyRef = React.useRef(false);

  useEffect(() => {
    if (!draftHydrated || draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    if (!draft || isEditMode) return;
    restoringDraftRef.current = true;
    const restoredDate = new Date(draft.reportDate);
    setClassIds(draft.classIds);
    setTeacherName(draft.teacherName);
    setClassNote(draft.classNote);
    setSelectedCriterionId(draft.selectedCriterionId);
    setViolationNote(draft.violationNote);
    setAddedViolations(draft.addedViolations);
    setPendingQuickViolationKeys(new Set(draft.pendingQuickViolationKeys));
    if (!Number.isNaN(restoredDate.getTime())) setReportDate(restoredDate);
  }, [draft, draftHydrated, isEditMode]);

  useEffect(() => {
    if (!draftHydrated || isEditMode || !dataReadyRef.current || !draftRestoredRef.current) return;
    saveDraft(buildClassReportDraft({
      classIds,
      reportDate,
      teacherName,
      classNote,
      selectedCriterionId,
      violationNote,
      addedViolations,
      pendingQuickViolationKeys,
      entryMode: 'quick',
    }));
  }, [addedViolations, classIds, classNote, draftHydrated, isEditMode,
    pendingQuickViolationKeys, reportDate, saveDraft, selectedCriterionId,
    teacherName, violationNote]);

  // Load classes, students, criteria and editing data
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

        // Thiết lập tiêu chí vắng mặt mặc định (chứa từ "vắng" kết hợp với "không phép" hoặc "có phép")
        const cached = localStorage.getItem('absentCriteriaIds');
        if (cached) {
          setAbsentCriteriaIds(JSON.parse(cached));
        } else {
          const defaultAbsents = criteriaList
            .filter(c => {
              const nameLower = c.criterion_name.toLowerCase();
              return nameLower.includes('vắng') && (nameLower.includes('không phép') || nameLower.includes('có phép'));
            })
            .map(c => c._id);
          setAbsentCriteriaIds(defaultAbsents);
          localStorage.setItem('absentCriteriaIds', JSON.stringify(defaultAbsents));
        }

        if (reportToEdit) {
          // Edit mode - Điền thông tin chung
          const classObj = typeof reportToEdit.class_id === 'object' ? reportToEdit.class_id : null;
          const classIdStr = classObj ? classObj._id : reportToEdit.class_id;
          editHydrationPendingRef.current = true;
          setClassIds(classIdStr ? [classIdStr] : []);

          setTeacherName(reportToEdit.teacher_name || '');
          setClassNote(reportToEdit.class_note || '');
          setTotalPresent(reportToEdit.total_present || 0);
          setTotalAbsent(reportToEdit.total_absent || 0);

          try {
            if (reportToEdit.report_date) {
              const dateStr = reportToEdit.report_date;
              if (dateStr.includes('/')) {
                const parsedDate = parse(dateStr, 'dd/MM/yyyy', new Date());
                setReportDate(parsedDate);
              } else {
                setReportDate(new Date(dateStr));
              }
            }
          } catch (e) {
            console.error('Lỗi parse ngày:', e);
            setReportDate(new Date());
          }

          // Tải danh sách vi phạm học sinh của báo cáo này từ API
          try {
            const records = await academicRecordApi.getAcademicRecordsByDailyReport(reportToEdit._id);
            const violationsMapped = mapAcademicRecordsToViolations(records, criteria, classIdStr || '');
            setAddedViolations(violationsMapped);
            setSelectedCriterionId(getInitialCriterionId(violationsMapped, criteria));
          } catch (e) {
            console.error('Lỗi tải vi phạm của báo cáo lớp:', e);
          }
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
  }, [reportToEdit]);

  const [isStudentsLoading, setIsStudentsLoading] = useState(false);
  const [summaryPointCache, setSummaryPointCache] = useState<Record<string, string>>({});
  const [evaluationDetailCache, setEvaluationDetailCache] = useState<Record<string, string>>({});

  const [studentsPages, setStudentsPages] = useState<Record<string, number>>({});
  const [studentsSearch, setStudentsSearch] = useState("");
  const [hasMoreStudents, setHasMoreStudents] = useState<Record<string, boolean>>({});
  const [classStudentTotals, setClassStudentTotals] = useState<Record<string, number>>({});
  const [totalStudentsCount, setTotalStudentsCount] = useState(0);

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

  const fetchClassStudents = async (classId: string, page: number, searchVal: string, append: boolean = false) => {
    setIsStudentsLoading(true);
    try {
      const limit = 30;
      const res = await studentApi.getStudents({
        classId,
        page,
        limit,
        search: searchVal || undefined
      });
      
      const newStudents = (Array.isArray(res) ? res : (res?.data || [])).map((student: Student) => ({
        ...student,
        class_id: student.class_id || classId,
      }));
      const total = (!Array.isArray(res) && res?.meta?.total) ? res.meta.total : newStudents.length;

      if (!classIdsRef.current.includes(classId)) return;
      if (page === 1) {
        setClassStudentTotals(prev => ({ ...prev, [classId]: total }));
      }

      setClassStudents(prev => mergeStudentsById([
        append ? prev : prev.filter(student => getIdValue(student.class_id) !== classId),
        newStudents,
      ]));
      setHasMoreStudents(prev => ({ ...prev, [classId]: newStudents.length >= limit }));
    } catch (err) {
      console.warn('Lỗi nạp sinh viên lớp:', err);
      if (!append) {
        setClassStudents(prev => prev.filter(student => getIdValue(student.class_id) !== classId));
        setClassStudentTotals(prev => ({ ...prev, [classId]: 0 }));
      }
    } finally {
      setIsStudentsLoading(false);
    }
  };

  // Lọc sinh viên theo các lớp học đang chọn từ backend
  useEffect(() => {
    const isRestoringDraft = restoringDraftRef.current;
    const isHydratingEdit = editHydrationPendingRef.current;
    editHydrationPendingRef.current = false;
    restoringDraftRef.current = false;
    classIdsRef.current = classIds;
    setStudentsSearch("");
    setStudentsPages(Object.fromEntries(classIds.map(id => [id, 1])));
    setHasMoreStudents(Object.fromEntries(classIds.map(id => [id, true])));
    setClassStudentTotals({});
    setTotalStudentsCount(0);
    setClassStudents(prev => prev.filter(student => classIds.includes(getIdValue(student.class_id))));
    if (shouldResetClassDependentState(isRestoringDraft, isHydratingEdit)) {
      setSelectedCriterionId('');
      setViolationNote('');
    }
    if (classIds.length > 0) {
      void Promise.all(classIds.map(id => fetchClassStudents(id, 1, "")));
      // Nếu không ở edit mode hoặc đổi lớp khác, reset vi phạm cũ
      if (!isRestoringDraft && !isHydratingEdit) {
        setAddedViolations(prev => prev.filter(violation => !violation.class_id || classIds.includes(violation.class_id)));
      }
    } else {
      setClassStudents([]);
      if (!isRestoringDraft) setAddedViolations([]);
    }
  }, [classIds]);

  useEffect(() => {
    setTotalStudentsCount(Object.values(classStudentTotals).reduce((sum, total) => sum + total, 0));
  }, [classStudentTotals]);

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

  // Tự động tính toán sĩ số dựa trên danh sách sinh viên vắng mặt
  useEffect(() => {
    if (totalStudentsCount > 0) {
      const absentViolations = addedViolations.filter(v => 
        absentCriteriaIds.includes(v.criterion_id) || 
        v.criterion_name.toLowerCase().includes('vắng')
      );
      const uniqueAbsentIds = new Set(absentViolations.map(v => v.student_id));
      const absentCount = uniqueAbsentIds.size;
      setTotalAbsent(absentCount);
      setTotalPresent(Math.max(0, totalStudentsCount - absentCount));
    } else {
      setTotalPresent(0);
      setTotalAbsent(0);
    }
  }, [addedViolations, totalStudentsCount, absentCriteriaIds]);

  // Auto open mobile student overlay when class and criterion are committed
  useEffect(() => {
    if (!isMobile || isEditMode) return;
    if (classIds.length === 0 || !selectedCriterionId) return;
    const prereqKey = `${classIds.slice().sort().join(',')}:${selectedCriterionId}`;
    if (prereqKey !== handledPrereqKeyRef.current) {
      handledPrereqKeyRef.current = prereqKey;
      setIsMobileStudentOverlayOpen(true);
    }
  }, [classIds, selectedCriterionId, isMobile, isEditMode]);

  const handleToggleQuickStudent = (student: Student) => {
    if (classIds.length === 0) {
      toast.error('Vui lòng chọn lớp học trước!');
      return;
    }
    if (!selectedCriterionId) {
      toast.error('Vui lòng chọn tiêu chí vi phạm!');
      return;
    }

    const existingViolation = addedViolations.find(
      violation => violation.student_id === student._id && violation.criterion_id === selectedCriterionId,
    );
    if (existingViolation) {
      setAddedViolations(prev => prev.filter(violation => violation !== existingViolation));
      setPendingQuickViolationKeys(prev => {
        const next = new Set(prev);
        next.delete(`${existingViolation.student_id}:${existingViolation.criterion_id}`);
        return next;
      });
      return;
    }
    const addError = getViolationAddError(addedViolations, student._id, selectedCriterionId);
    if (addError === 'limit') {
      toast.error('Chỉ được ghi nhận tối đa 10 mục vi phạm!');
      return;
    }

    const criterion = criteria.find(item => item._id === selectedCriterionId);
    if (!criterion) {
      toast.error('Không tìm thấy tiêu chí đã chọn, vui lòng tải lại danh sách tiêu chí');
      return;
    }
    setAddedViolations(prev => [...prev, createViolationItem(student, criterion, violationNote)]);
    setPendingQuickViolationKeys(prev => new Set(prev).add(`${student._id}:${selectedCriterionId}`));
  };

  const handleCriterionChange = (nextCriterionId: string) => {
    if (nextCriterionId !== selectedCriterionId && pendingQuickViolationKeys.size > 0) {
      setAddedViolations(prev => clearPendingQuickViolations(prev, pendingQuickViolationKeys));
      setPendingQuickViolationKeys(new Set());
    }
    setSelectedCriterionId(nextCriterionId);
    setCriterionUsage(incrementCriterionUsage(user?.id, nextCriterionId));
  };

  const orderedCriteria = orderCriteriaByUsage(criteria, criterionUsage);

  const handleMobileRosterConfirm = async (confirmedStudentIds: string[]) => {
    if (!selectedCriterionId) return;
    const criterion = criteria.find(c => c._id === selectedCriterionId);
    if (!criterion) return;

    const otherViolations = addedViolations.filter(v => v.criterion_id !== selectedCriterionId);
    const newViolations = confirmedStudentIds.map(studentId => {
      const existing = addedViolations.find(v => v.student_id === studentId && v.criterion_id === selectedCriterionId);
      if (existing) return existing;
      const student = classStudents.find(s => s._id === studentId);
      if (!student) return null;
      return createViolationItem(student, criterion, violationNote);
    }).filter(Boolean) as ViolationItem[];

    const nextViolations = [...otherViolations, ...newViolations];
    setAddedViolations(nextViolations);
    setPendingQuickViolationKeys(new Set());
    setIsMobileStudentOverlayOpen(false);

    await handleSave(undefined, nextViolations);
  };

  const handleSave = async (e?: React.FormEvent, overrideViolations?: ViolationItem[]) => {
    if (e) e.preventDefault();
    if (classIds.length === 0) {
      toast.error('Vui lòng chọn lớp học!');
      return;
    }
    setIsSaving(true);
    const dateFormatted = reportDate.toISOString();
    const currentViolations = overrideViolations ?? addedViolations;

    try {
      const reportIdsByClass = new Map<string, string>();
      let dailyReportId = '';

      if (reportToEdit) {
        // --- CHẾ ĐỘ CHỈNH SỬA ---
        await dailyClassReportApi.updateDailyClassReport(reportToEdit._id, {
          class_id: classIds[0],
          report_date: dateFormatted,
          teacher_name: teacherName.trim(),
          total_present: totalPresent,
          total_absent: totalAbsent,
          class_notes: classNote.trim(),
        });
        reportIdsByClass.set(classIds[0], reportToEdit._id);
        dailyReportId = reportToEdit._id;

        try {
          const oldRecords = await academicRecordApi.getAcademicRecordsByDailyReport(dailyReportId);
          await Promise.all(oldRecords.map(rec => academicRecordApi.deleteAcademicRecord(rec._id, true)));
        } catch (e) {
          console.warn('Không thể làm sạch bản ghi cũ hoặc không có bản ghi cũ:', e);
        }

        toast.success('Cập nhật thông tin chung thành công!');
      } else {
        // --- CHẾ ĐỘ TẠO MỚI ---
        const getReportFields = (selectedClassId: string) => {
          const classViolations = currentViolations.filter(violation => (violation.class_id || selectedClassId) === selectedClassId);
          const absentCount = new Set(classViolations.filter(violation =>
            absentCriteriaIds.includes(violation.criterion_id) || violation.criterion_name.toLowerCase().includes('vắng'),
          ).map(violation => violation.student_id)).size;
          const classTotal = classStudentTotals[selectedClassId] || (selectedClassId === classIds[0] ? totalStudentsCount : 0);
          return {
            class_id: selectedClassId,
            reported_by: user?.id || '60d0fe4f5311236168a109ca',
            report_date: dateFormatted,
            teacher_name: teacherName.trim(),
            total_present: Math.max(0, classTotal - absentCount),
            total_absent: absentCount,
            class_notes: classNote.trim(),
          };
        };

        const resolveReport = async (selectedClassId: string): Promise<DailyClassReport> => {
          return resolveDailyReportForClass({
            api: dailyClassReportApi,
            fields: getReportFields(selectedClassId),
          });
        };

        for (const selectedClassId of classIds) {
          const report = await resolveReport(selectedClassId);
          reportIdsByClass.set(selectedClassId, report._id);
          if (!dailyReportId) dailyReportId = report._id;
        }
        toast.success('Lưu báo cáo lớp học hàng ngày thành công!');
      }

      // Lưu các bản ghi vi phạm bằng batch API
      if (currentViolations.length > 0) {
        const recordsToCreate = currentViolations.map(violation => {
          const dailyReportId = reportIdsByClass.get(violation.class_id || classIds[0]);
          const resolvedCriterion = criteria.find(c => c._id === violation.criterion_id) || resolveCriterionByName(criteria, [violation.criterion_name]);
          if (!resolvedCriterion) {
            throw new Error(`Khong tim thay tieu chi cho ghi nhan: ${violation.criterion_name}. Vui long tai lai danh sach tieu chi hoac chon lai tieu chi`);
          }

          if (!isValidObjectId(violation.student_id)) {
            throw new Error(`Khong tim thay hoc sinh hop le cho ghi nhan: ${violation.student_name}`);
          }
          if (!isValidObjectId(activeSemesterId)) {
            throw new Error('Du lieu hoc ky khong hop le, vui long kiem tra lai');
          }
          if (!dailyReportId || !isValidObjectId(dailyReportId)) {
            throw new Error('Du lieu bao cao ngay khong hop le, khong the luu ghi nhan');
          }

          return {
            student_id: violation.student_id,
            criterion_id: resolvedCriterion._id,
            semester_id: activeSemesterId,
            record_title: resolvedCriterion.criterion_name,
            description: violation.class_note,
            daily_report_id: dailyReportId,
            status: 'active' as const,
            recorded_at: reportDate.toISOString(),
            recorded_by: isValidObjectId(user?.id || '') ? user?.id : undefined,
            idempotency_key: `daily_report:${dailyReportId}:${violation.student_id}:${resolvedCriterion._id}`,
            source: 'daily_class_report'
          };
        });

        const response = await academicRecordApi.bulkCreateAcademicRecords(recordsToCreate);
        if (response.insertedCount > 0) {
          toast.success(`Đã ghi nhận ${response.insertedCount} vi phạm rèn luyện thành công!`);
        }
        if (response.duplicatedCount > 0) {
          toast.warning(`Có ${response.duplicatedCount} ghi nhận bị trùng lặp hoặc đã tồn tại.`);
        }
      }

      if (!reportToEdit) clearDraft();
      onSuccess();
    } catch (err: any) {
      console.error('Lỗi khi lưu:', err);
      toast.error(err.message || 'Lưu báo cáo thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (!isEditMode) saveDraft(buildClassReportDraft({
      classIds, reportDate, teacherName, classNote, selectedCriterionId,
      violationNote, addedViolations, pendingQuickViolationKeys, entryMode: 'quick',
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
      <div className="flex flex-col gap-3.5 sm:gap-4 mx-auto w-full md:flex-1 md:min-h-0">
        {/* Page Header Section */}
        <div className="flex items-center justify-between gap-3 w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            className="group bg-white/45 backdrop-blur-md border border-white/70 hover:bg-white/80 text-[#005bbf] font-bold text-xs sm:text-sm h-auto py-1 px-1.5 pr-3.5 rounded-xl uppercase tracking-wide flex items-center gap-2 shadow-xs shadow-slate-300/30 transition-all duration-150 ease-out hover:scale-[1.02] cursor-pointer"
            title="Quay lại"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/60 border border-white/80 flex items-center justify-center shrink-0 group-hover:bg-white/90 transition-all">
              <ArrowLeft className="w-4 h-4 text-slate-700 group-hover:text-[#005bbf] transition-colors" />
            </div>
            <div className="h-4 w-px bg-slate-300/60 shrink-0" />
            <Sparkles className="w-4 h-4 text-[#005bbf] animate-pulse shrink-0" />
            <span className="truncate">{reportToEdit ? 'Hệ thống chỉnh sửa ghi nhận lớp' : 'Hệ thống ghi nhận lớp'}</span>
          </Button>
        </div>

        {/* Loading Spinner */}
        {isLoadingData ? (
          <div className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl p-8 shadow-xs shadow-slate-300/30 flex flex-col items-center justify-center min-h-[220px] gap-2.5">
            <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
            <span className="text-[#005bbf] font-semibold text-xs">Đang nạp dữ liệu rèn luyện...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-2 md:flex-1 md:min-h-0">
            {/* Main Grid Layout (12 Columns) */}
            <div className="grid grid-cols-12 gap-3 sm:gap-3.5 w-full md:flex-1 md:min-h-0">

              {/* Left Column: Core Info (col-span-12 md:col-span-5 lg:col-span-4) */}
              <div className="col-span-12 md:col-span-5 lg:col-span-4 flex flex-col gap-3.5 sm:gap-4 md:min-h-0">
                {/* Section 1: Thông tin cơ bản */}
                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-300/30 rounded-2xl p-3.5 sm:p-4 lg:p-4.5 flex flex-col gap-3.5 w-full md:flex-none">
                  <div className="flex gap-2.5 items-start text-[#005bbf] border-b border-slate-200/60 pb-3">
                    <FileText className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm lg:text-[15px] leading-none">Thông tin cơ bản</h3>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">Thiết lập lớp, tiêu chí và thông tin báo cáo</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 sm:gap-3 w-full">
                    {/* Mã lớp học */}
                    <div className="flex flex-col w-full relative">
                      <RecordSelectionDialog
                        label="Mã lớp học"
                        labelClassName="text-[11px] md:text-[10px] uppercase tracking-wide text-slate-500"
                        title="Chọn mã lớp học"
                        description={isEditMode ? 'Chọn một lớp học cho báo cáo này.' : 'Chọn một hoặc nhiều lớp học rồi nhấn Xác nhận để áp dụng.'}
                        hideHeader={true}
                        value={isEditMode ? (classIds[0] || '') : classIds}
                        displayValue={
                          isEditMode
                            ? (classes.find(c => c._id === (classIds[0] || ''))?.class_name || '')
                            : (classIds.length > 0
                                ? classIds.map(id => classes.find(c => c._id === id)?.class_name).filter(Boolean).join(', ')
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
                            setClassIds(singleId ? [singleId] : []);
                          } else {
                            const nextIds = Array.isArray(val) ? val : (val ? [val] : []);
                            setClassIds(nextIds);
                          }
                        }}
                      >
                        {(draftValue, setDraftValue, searchQuery) => {
                          const filtered = filterClassesBySearch(classes, searchQuery);
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
                                      if (!isEditMode) {
                                        setDraftValue(toggleSelectionValue(currentSelected, c._id));
                                      } else {
                                        setDraftValue(c._id);
                                      }
                                    }}
                                    className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 md:py-2 text-left font-semibold transition-colors min-h-[44px] md:min-h-0 text-sm md:text-xs ${
                                      isSelected
                                        ? 'bg-blue-50 text-blue-800 font-bold'
                                        : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <span className="truncate">{c.class_name}{c.class_year ? ` (${c.class_year})` : ''}</span>
                                    {isSelected && <Check className="h-4 w-4 shrink-0 text-[#005bbf] ml-2" />}
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

                    {/* Tiêu chí ghi nhận (AC-03: rendered exactly once inside Thông tin cơ bản) */}
                    <div className="flex flex-col w-full">
                      <label className="text-[11px] md:text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 ml-1">Tiêu chí ghi nhận</label>
                      {!isMobile ? (
                        <Select
                          value={selectedCriterionId}
                          onValueChange={handleCriterionChange}
                        >
                          <SelectTrigger className="bg-white/40 border-white/70 backdrop-blur-sm min-h-[44px] md:min-h-0 h-11 md:h-9 md:sm:h-10 rounded-xl px-3.5 text-sm md:text-xs md:sm:text-[12.5px] text-[#1E293B] font-semibold outline-none w-full shadow-xs focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-150 ease-out hover:bg-white/60 cursor-pointer font-sans">
                            <SelectValue placeholder="Chọn tiêu chí..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-white/70 font-sans max-h-60">
                            {orderedCriteria.frequent.length > 0 && <SelectLabel>Sử dụng nhiều</SelectLabel>}
                            {orderedCriteria.frequent.map(c => (
                              <SelectItem key={c._id} value={c._id}>
                                {c.criterion_name} ({c.score_per_unit || c.min_score || -5}đ)
                              </SelectItem>
                            ))}
                            {orderedCriteria.frequent.length > 0 && orderedCriteria.remaining.length > 0 && <SelectSeparator />}
                            {orderedCriteria.remaining.map(c => (
                              <SelectItem key={c._id} value={c._id}>
                                {c.criterion_name} ({c.score_per_unit || c.min_score || -5}đ)
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
                            <span className={`truncate ${selectedCriterionId ? 'text-[#1E293B]' : 'font-normal text-[#64748B]/60'}`}>
                              {criteria.find(c => c._id === selectedCriterionId)?.criterion_name || 'Chọn tiêu chí...'}
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
                                    const isSelected = selectedCriterionId === c._id;
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
                                          ({c.score_per_unit || c.min_score || -5}đ)
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

                    {/* Tên giảng viên */}
                    <Input
                      labelClassName="text-[11px] md:text-[10px] uppercase tracking-wide text-slate-500"
                      type="text"
                      label="Tên giảng viên"
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      placeholder="Nhập tên giảng viên đứng lớp"
                      className="bg-white/40 border-white/70 backdrop-blur-sm min-h-[44px] md:min-h-0 h-11 md:h-9 md:sm:h-10 rounded-xl px-3.5 text-sm md:text-xs md:sm:text-[13px] text-[#1E293B] font-semibold placeholder:text-[#64748B]/60 placeholder:font-normal focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:bg-white/70 focus-visible:border-blue-400 shadow-xs transition-all duration-150 ease-out"
                      containerClassName="w-full"
                    />

                    <Input
                      labelClassName="text-[11px] md:text-[10px] uppercase tracking-wide text-slate-500"
                      multiline
                      rows={3}
                      label="Ghi chú lớp"
                      value={classNote}
                      onChange={(e) => setClassNote(e.target.value)}
                      placeholder="Nhập ghi chú chung cho lớp..."
                      className="bg-white/40 border-white/70 backdrop-blur-sm rounded-xl text-sm md:text-xs text-[#1E293B] placeholder:text-[#64748B]/60 placeholder:font-normal focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:bg-white/70 focus-visible:border-blue-400 shadow-xs transition-all duration-150 ease-out"
                      containerClassName="w-full"
                    />

                    {/* Ngày báo cáo */}
                    <div className="flex flex-col w-full">
                      <label className="text-[11px] md:text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 ml-1">Ngày báo cáo</label>
                      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="bg-white/40 border border-white/70 backdrop-blur-sm min-h-[44px] md:min-h-0 h-11 md:h-9 md:sm:h-10 rounded-xl px-3.5 text-sm md:text-xs md:sm:text-[13px] text-[#1E293B] font-semibold outline-none flex items-center justify-between hover:bg-white/60 focus:ring-2 focus:ring-blue-500/20 transition-all duration-150 ease-out w-full shadow-xs text-left font-sans"
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

              {/* Right Column: Desktop Roster Section (AC-04: visible >=768px, one card only) */}
              <div className="hidden md:flex col-span-12 md:col-span-7 lg:col-span-8 flex-col gap-3.5 sm:gap-4 md:min-h-0">
                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-300/30 rounded-2xl p-3.5 sm:p-4 lg:p-4.5 flex flex-col gap-3 w-full md:flex-1 md:min-h-0">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2 items-center text-[#005bbf]">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <h3 className="font-bold text-sm lg:text-[15px] leading-none">Danh sách sinh viên</h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <span aria-live="polite">
                        Đã chọn: <strong className="text-[#005bbf]">{addedViolations.filter(v => v.criterion_id === selectedCriterionId).length}</strong> / {totalStudentsCount || classStudents.length}
                      </span>
                      {isStudentsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" aria-label="Đang tải sinh viên" />}
                    </div>
                  </div>

                  {/* Student Card Grid */}
                  <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2 md:flex-1 md:min-h-0 md:!max-h-none ${quickGridClass(classStudents.length)}`} aria-label="Danh sách sinh viên">
                    {classStudents.map(student => {
                      const selected = addedViolations.some(v => v.student_id === student._id && v.criterion_id === selectedCriterionId);
                      return (
                        <button
                          key={student._id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          disabled={!selectedCriterionId}
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
              </div>
            </div>

            {/* Mobile Student Selection Overlay (AC-05, AC-06) */}
            {isMobile && !isEditMode && (
              <MobileStudentSelectionDialog
                open={isMobileStudentOverlayOpen}
                onOpenChange={setIsMobileStudentOverlayOpen}
                students={classStudents}
                selectedStudentIds={addedViolations.filter(v => v.criterion_id === selectedCriterionId).map(v => v.student_id)}
                onConfirm={handleMobileRosterConfirm}
                onCancel={() => setIsMobileStudentOverlayOpen(false)}
                loading={isStudentsLoading}
                hasMore={classIds.some(id => hasMoreStudents[id])}
                onLoadMore={handleLoadMoreStudents}
              />
            )}

            {/* Footer Actions Panel */}
            <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-300/30 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 w-full md:w-[calc(66.666%-0.5rem)] md:ml-[calc(33.333%+0.5rem)] shrink-0">
              <div className="hidden sm:flex items-center text-xs text-[#414754] font-medium italic">
                Hãy kiểm tra kỹ thông tin chuyên cần & kỷ luật trước khi lưu.
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 items-center justify-end w-full sm:w-auto ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="border border-[rgba(0,91,191,0.3)] bg-white/40 hover:bg-white/70 rounded-xl px-5 sm:px-7 py-2 text-[#005bbf] font-bold text-sm md:text-xs md:sm:text-[13px] min-h-[44px] md:min-h-0 h-11 md:h-9 md:sm:h-9.5 hover:scale-[1.01] transition-all duration-150 ease-out"
                >
                  Hủy bỏ
                </Button>

                <Button
                  type="submit"
                  disabled={isSaving}
                  className="relative bg-[#005bbf] text-white font-bold px-6 sm:px-8 py-2 rounded-xl shadow-xs hover:bg-[#004ca0] focus:ring-2 focus:ring-blue-500/20 transition-all duration-150 ease-out hover:scale-[1.01] flex items-center justify-center gap-1.5 border-none outline-none cursor-pointer text-sm md:text-xs md:sm:text-[13px] min-h-[44px] md:min-h-0 h-11 md:h-9 md:sm:h-9.5 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Lưu ghi nhận</span>
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
