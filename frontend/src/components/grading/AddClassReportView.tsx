'use client';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar as CalendarIcon, Loader2, Plus, Trash2, AlertTriangle, FileText, Check, Users, Save, Settings, Sparkles } from 'lucide-react';
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
  if (violations.length >= 10) return 'limit';
  if (violations.some(item => item.student_id === studentId && item.criterion_id === criterionId)) return 'duplicate';
  return null;
}

export function mergeStudentsById(studentGroups: Student[][]): Student[] {
  const studentsById = new Map<string, Student>();
  studentGroups.flat().forEach(student => studentsById.set(student._id, student));
  return Array.from(studentsById.values());
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

interface AddClassReportViewProps {
  onBack: () => void;
  reportToEdit?: DailyClassReport | null;
  onSuccess: () => void;
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
  const [classSearch, setClassSearch] = useState('');
  const [isClassPickerOpen, setIsClassPickerOpen] = useState(false);

  // Sĩ số states (ẩn chỉnh tay, tự động tính toán hoặc cho phép xem)
  const [totalPresent, setTotalPresent] = useState<number>(0);
  const [totalAbsent, setTotalAbsent] = useState<number>(0);

  // Student Violation inputs
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCriterionId, setSelectedCriterionId] = useState('');
  const [violationNote, setViolationNote] = useState('');
  const [addedViolations, setAddedViolations] = useState<ViolationItem[]>([]);
  const [pendingQuickViolationKeys, setPendingQuickViolationKeys] = useState<Set<string>>(new Set());
  const [entryMode, setEntryMode] = useState<'manual' | 'quick'>('quick');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setCriterionUsage(readCriterionUsage(user?.id));
  }, [user?.id]);

  // Cấu hình tiêu chí vắng mặt
  const [absentCriteriaIds, setAbsentCriteriaIds] = useState<string[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Học kỳ hoạt động thực tế
  const [activeSemesterId, setActiveSemesterId] = useState('60d0fe4f5311236168a109cb');

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
            const violationsMapped: ViolationItem[] = records.map(rec => {
              const stObj = typeof rec.student_id === 'object' ? rec.student_id : null;
              const matchedCriterion = resolveCriterionFromRecord(rec, criteria);
              const evalDetailObj = typeof rec.evaluation_detail_id === 'object' ? rec.evaluation_detail_id : null;
              const evaluationDetailId = evalDetailObj ? (evalDetailObj._id || '') : (typeof rec.evaluation_detail_id === 'string' ? rec.evaluation_detail_id : '');
              const originalCriterionId = getIdValue((rec as any).criterion_id) || getIdValue((rec as any).criteria_id) || (evalDetailObj ? getIdValue(evalDetailObj.criterion_id) : '');
              const criterionName = matchedCriterion?.criterion_name || rec.record_title || (rec as any).criterion_name || 'Vi phạm';
              const pointsEffect = matchedCriterion?.score_per_unit || matchedCriterion?.min_score || rec.points_effect || -5;
              return {
                student_id: stObj ? stObj._id : rec.student_id,
                student_name: stObj ? stObj.full_name : 'Sinh viên',
                student_code: stObj ? stObj.student_code : '',
                criterion_id: matchedCriterion?._id || originalCriterionId || '',
                evaluation_detail_id: evaluationDetailId,
                criterion_name: criterionName,
                points_effect: pointsEffect,
                class_note: rec.description || ''
              };
            });
            setAddedViolations(violationsMapped);
          } catch (e) {
            console.error('Lỗi tải vi phạm của báo cáo lớp:', e);
          }
        }
      } catch (err) {
        console.error('Lỗi nạp dữ liệu:', err);
        toast.error('Không thể nạp dữ liệu ban đầu');
      } finally {
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
    setSelectedStudentId('');
    setSelectedCriterionId('');
    setViolationNote('');
    setStudentsSearch("");
    setStudentsPages(Object.fromEntries(classIds.map(id => [id, 1])));
    setHasMoreStudents(Object.fromEntries(classIds.map(id => [id, true])));
    setClassStudentTotals({});
    setTotalStudentsCount(0);
    setClassStudents(prev => prev.filter(student => classIds.includes(getIdValue(student.class_id))));
    if (classIds.length > 0) {
      void Promise.all(classIds.map(id => fetchClassStudents(id, 1, "")));
      // Nếu không ở edit mode hoặc đổi lớp khác, reset vi phạm cũ
      if (!reportToEdit) {
        setAddedViolations(prev => prev.filter(violation => !violation.class_id || classIds.includes(violation.class_id)));
      }
    } else {
      setClassStudents([]);
      setAddedViolations([]);
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

  // Tự động tính toán sĩ số dựa trên danh sách sinh viên vắng mặt (vi phạm vắng học được cấu hình)
  useEffect(() => {
    if (totalStudentsCount > 0) {
      // Chỉ đếm những vi phạm thuộc tiêu chí được cấu hình tính vắng mặt hoặc có chứa từ khóa "vắng"
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

  // Thêm vi phạm vào danh sách tạm
  const handleAddViolationToList = () => {
    if (classIds.length === 0) {
      toast.error('Vui lòng chọn lớp học trước!');
      return;
    }
    if (!selectedStudentId) {
      toast.error('Vui lòng chọn sinh viên vi phạm!');
      return;
    }
    if (!selectedCriterionId) {
      toast.error('Vui lòng chọn tiêu chí vi phạm!');
      return;
    }

    const addError = getViolationAddError(addedViolations, selectedStudentId, selectedCriterionId);
    if (addError === 'limit') {
      toast.error('Chỉ được ghi nhận tối đa 10 mục vi phạm!');
      return;
    }

    // Check trùng vi phạm cùng sinh viên
    if (addError === 'duplicate') {
      toast.error('Sinh viên này đã bị ghi nhận tiêu chí vi phạm này!');
      return;
    }

    const student = classStudents.find(s => s._id === selectedStudentId);
    const criterion = criteria.find(c => c._id === selectedCriterionId);

    if (!student) {
      toast.error('Không tìm thấy sinh viên đã chọn, vui lòng tải lại danh sách');
      return;
    }

    if (!criterion) {
      toast.error('Không tìm thấy tiêu chí đã chọn, vui lòng tải lại danh sách tiêu chí');
      return;
    }

    if (student && criterion) {
      const newViolation = createViolationItem(student, criterion, violationNote);

      setAddedViolations([...addedViolations, newViolation]);

      // Reset inputs
      setSelectedStudentId('');
      setSelectedCriterionId('');
      toast.success('Đã thêm vi phạm vào danh sách!');
    }
  };

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

  // Xóa vi phạm khỏi danh sách tạm
  const handleRemoveViolationFromList = (index: number) => {
    setAddedViolations(prev => prev.filter((_, i) => i !== index));
    toast.success('Đã xóa vi phạm khỏi danh sách tạm.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (classIds.length === 0) {
      toast.error('Vui lòng chọn lớp học!');
      return;
    }
    setIsSaving(true);
    const dateFormatted = reportDate.toISOString();

    try {
      const reportIdsByClass = new Map<string, string>();
      let dailyReportId = '';

      if (reportToEdit) {
        // --- CHẾ ĐỘ CHỈNH SỬA ---
        // 1. Cập nhật báo cáo lớp học
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

        // 2. Xóa toàn bộ các academic_records cũ của daily report này để ghi đè sạch sẽ
        try {
          const oldRecords = await academicRecordApi.getAcademicRecordsByDailyReport(dailyReportId);
          await Promise.all(oldRecords.map(rec => academicRecordApi.deleteAcademicRecord(rec._id, true)));
        } catch (e) {
          console.warn('Không thể làm sạch bản ghi cũ hoặc không có bản ghi cũ:', e);
        }

        toast.success('Cập nhật thông tin chung thành công!');
      } else {
        // --- CHẾ ĐỘ TẠO MỚI ---
        // 1. Tạo mới báo cáo lớp học hàng ngày
        const newReport = await dailyClassReportApi.createDailyClassReport({
          class_id: classIds[0],
          reported_by: user?.id || '60d0fe4f5311236168a109ca', // use logged-in user or fallback
          report_date: dateFormatted,
          teacher_name: teacherName.trim(),
          total_present: Math.max(0, (classStudentTotals[classIds[0]] || totalStudentsCount) - new Set(addedViolations.filter(violation =>
            (violation.class_id || classIds[0]) === classIds[0] && (absentCriteriaIds.includes(violation.criterion_id) || violation.criterion_name.toLowerCase().includes('vắng')),
          ).map(violation => violation.student_id)).size),
          total_absent: new Set(addedViolations.filter(violation =>
            (violation.class_id || classIds[0]) === classIds[0] && (absentCriteriaIds.includes(violation.criterion_id) || violation.criterion_name.toLowerCase().includes('vắng')),
          ).map(violation => violation.student_id)).size,
          class_notes: classNote.trim(),
        });
        dailyReportId = newReport._id;
        reportIdsByClass.set(classIds[0], newReport._id);
        for (const selectedClassId of classIds.slice(1)) {
          const classViolations = addedViolations.filter(violation => violation.class_id === selectedClassId);
          const absentCount = new Set(classViolations.filter(violation =>
            absentCriteriaIds.includes(violation.criterion_id) || violation.criterion_name.toLowerCase().includes('vắng'),
          ).map(violation => violation.student_id)).size;
          const classTotal = classStudentTotals[selectedClassId] || 0;
          const additionalReport = await dailyClassReportApi.createDailyClassReport({
            class_id: selectedClassId,
            reported_by: user?.id || '60d0fe4f5311236168a109cb',
            report_date: dateFormatted,
            teacher_name: teacherName.trim(),
            total_present: Math.max(0, classTotal - absentCount),
            total_absent: absentCount,
            class_notes: classNote.trim(),
          });
          reportIdsByClass.set(selectedClassId, additionalReport._id);
        }
        toast.success('Tạo báo cáo lớp học hàng ngày thành công!');
      }

      // 2. Lưu các bản ghi vi phạm bằng batch API
      if (addedViolations.length > 0) {
        const recordsToCreate = addedViolations.map(violation => {
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

      onSuccess();
    } catch (err: any) {
      console.error('Lỗi khi lưu:', err);
      toast.error(err.message || 'Lưu báo cáo thất bại');
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
      <div className="flex flex-col gap-3.5 sm:gap-4 mx-auto w-full">
        {/* Page Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div className="flex gap-2.5 sm:gap-3 items-center">
            {/* Back Button Pill Glassmorphism using Custom Button */}
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="backdrop-blur-md bg-white/45 border border-white/70 rounded-xl w-9 h-9 sm:w-10 sm:h-10 p-0 flex items-center justify-center cursor-pointer hover:bg-white/80 transition-all duration-150 ease-out hover:scale-[1.05] shadow-xs shrink-0"
              title="Quay lại"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700" />
            </Button>

            {/* Figma Icon Block */}
            <div className="hidden xs:flex backdrop-blur-md bg-white/45 border border-white/70 items-center justify-center rounded-xl shadow-xs shrink-0 w-9 h-9 sm:w-10 sm:h-10">
              <FileText className="w-4 h-4 text-[#005bbf]" />
            </div>

            <div className="flex flex-col items-start min-w-0">
              <h2 className="font-bold text-[18px] sm:text-[20px] lg:text-[22px] text-[#005bbf] leading-tight truncate">
                {reportToEdit ? 'Chỉnh sửa ghi nhận lớp' : 'Ghi nhận lớp'}
              </h2>
            </div>
          </div>
          <div className="flex items-center sm:justify-end shrink-0">
            <div className="bg-[#005bbf]/5 text-[#005bbf] font-bold text-[11px] px-3 py-1.5 rounded-xl uppercase tracking-wider border border-[#005bbf]/10 flex items-center gap-1.5 shadow-xs bg-white/40 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-[#005bbf] animate-pulse" />
              <span>Hệ thống ghi nhận</span>
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoadingData ? (
          <div className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl p-8 shadow-xs shadow-slate-300/30 flex flex-col items-center justify-center min-h-[220px] gap-2.5">
            <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
            <span className="text-[#005bbf] font-semibold text-xs">Đang nạp dữ liệu rèn luyện...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-3.5 sm:gap-4">
            {/* Main Grid Layout (12 Columns) */}
            <div className="grid grid-cols-12 gap-3.5 sm:gap-4 w-full">

              {/* Left Column: Core Info (col-span-4) */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-3.5 sm:gap-4">
                {/* Section 1: Thông tin cơ bản */}
                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-300/30 rounded-2xl p-3.5 sm:p-4 lg:p-4.5 flex flex-col gap-3 w-full">
                  <div className="flex gap-2 items-center text-[#005bbf]">
                    <FileText className="w-4 h-4 shrink-0" />
                    <h3 className="font-bold text-sm lg:text-[15px] leading-none">Thông tin cơ bản</h3>
                  </div>

                  <div className="flex flex-col gap-2.5 sm:gap-3 w-full">
                    {/* Mã lớp học: hỗ trợ chọn nhiều lớp */}
                    <div className="flex flex-col w-full relative">
                      <label className="text-xs font-medium text-[#414754] mb-1 ml-1">Mã lớp học</label>
                      <Popover open={isClassPickerOpen} onOpenChange={setIsClassPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="ghost" className="h-9 sm:h-10 w-full justify-between rounded-xl border border-white/70 bg-white/40 backdrop-blur-sm px-3 text-left text-xs sm:text-[12.5px] shadow-xs hover:bg-white/60 transition-all duration-150 ease-out">
                            <span className={`truncate ${classIds.length > 0 ? 'font-semibold text-[#1E293B]' : 'font-normal text-[#64748B]/60'}`}>
                              {classIds.length > 0 ? classIds.map(id => classes.find(c => c._id === id)?.class_name).filter(Boolean).join(', ') : 'Chọn mã lớp học...'}
                            </span>
                            <span className="ml-2 text-slate-400">⌄</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="z-[100] w-[var(--radix-popover-trigger-width)] rounded-xl border border-white/70 bg-white/90 backdrop-blur-md p-2 shadow-xl" align="start">
                          <Input
                            type="search"
                            role="combobox"
                            aria-expanded={isClassPickerOpen}
                            aria-label="Tìm lớp học"
                            value={classSearch}
                            onChange={e => setClassSearch(e.target.value)}
                            placeholder="Nhập tên hoặc mã lớp..."
                            className="mb-2 h-8 sm:h-9 rounded-xl text-xs bg-white/40 border-white/70 backdrop-blur-sm placeholder:text-[#64748B]/60 placeholder:font-normal focus-visible:bg-white/70"
                          />
                          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto" aria-label="Danh sách lớp học">
                            {filterClassesBySearch(classes, classSearch).map(c => {
                              const selected = classIds.includes(c._id);
                              return (
                                <label key={c._id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${selected ? 'bg-blue-50/80 text-blue-800' : 'hover:bg-white/60 text-slate-700'}`}>
                                  <input type="checkbox" checked={selected} onChange={() => setClassIds(prev => selected ? prev.filter(id => id !== c._id) : [...prev, c._id])} className="accent-blue-600" />
                                  <span className="truncate">{c.class_name}{c.class_year ? ` (${c.class_year})` : ''}</span>
                                </label>
                              );
                            })}
                            {filterClassesBySearch(classes, classSearch).length === 0 && <span className="px-2 py-3 text-center text-xs text-slate-400">Không tìm thấy lớp.</span>}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <span className="mt-1 ml-1 text-[11px] text-slate-500" aria-live="polite">
                        {classIds.length > 0 ? `Đã chọn ${classIds.length} lớp` : 'Chọn mã lớp học...'}
                      </span>
                    </div>

                    {/* Tên giảng viên sử dụng Input Component */}
                    <Input
                      type="text"
                      label="Tên giảng viên"
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      placeholder="Nhập tên giảng viên đứng lớp"
                      className="bg-white/40 border-white/70 backdrop-blur-sm h-9 sm:h-10 rounded-xl px-3.5 text-xs sm:text-[13px] text-[#1E293B] font-semibold placeholder:text-[#64748B]/60 placeholder:font-normal focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:bg-white/70 focus-visible:border-blue-400 shadow-xs transition-all duration-150 ease-out"
                      containerClassName="w-full"
                    />

                    {/* Ngày báo cáo */}
                    <div className="flex flex-col w-full">
                      <label className="text-xs font-medium text-[#414754] mb-1 ml-1">Ngày báo cáo</label>
                      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="bg-white/40 border border-white/70 backdrop-blur-sm h-9 sm:h-10 rounded-xl px-3.5 text-xs sm:text-[13px] text-[#1E293B] font-semibold outline-none flex items-center justify-between hover:bg-white/60 focus:ring-2 focus:ring-blue-500/20 transition-all duration-150 ease-out w-full shadow-xs text-left font-sans"
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

                {/* Section 2: Ghi chú lớp học */}
                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-300/30 rounded-2xl p-3.5 sm:p-4 lg:p-4.5 flex flex-col gap-3 w-full">
                  <div className="flex gap-2 items-center text-[#005bbf]">
                    <FileText className="w-4 h-4 shrink-0" />
                    <h3 className="font-bold text-sm lg:text-[15px] leading-none">Ghi chú lớp học</h3>
                  </div>

                  <Input
                    multiline
                    value={classNote}
                    onChange={(e) => setClassNote(e.target.value)}
                    placeholder="Nhập nhận xét chung về tình hình lớp học, mức độ tiếp thu..."
                    className="bg-white/40 border-white/70 backdrop-blur-sm rounded-xl p-3 min-h-[85px] sm:min-h-[95px] text-xs sm:text-[13px] text-[#1E293B] outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:bg-white/70 focus-visible:border-blue-400 transition-all duration-150 ease-out w-full resize-none shadow-xs font-semibold leading-relaxed placeholder:text-[#64748B]/60 placeholder:font-normal"
                    containerClassName="w-full"
                  />
                </div>
              </div>

              {/* Right Column: Violations Section (col-span-8) */}
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-3.5 sm:gap-4">
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chế độ nhập vi phạm">
                  <Button
                    type="button"
                    variant={entryMode === 'manual' ? 'default' : 'outline'}
                    aria-pressed={entryMode === 'manual'}
                    disabled={isMobile}
                    onClick={() => { if (!isMobile) setEntryMode('manual'); }}
                    className={`rounded-xl h-8 px-3.5 text-xs font-bold transition-all duration-150 ease-out ${entryMode === 'manual' ? 'bg-[#005bbf] text-white hover:bg-[#004ca0]' : 'border-white/70 bg-white/40 backdrop-blur-sm text-[#1E293B] hover:bg-white/60'}`}
                  >
                    Nhập thủ công
                  </Button>
                  <Button
                    type="button"
                    variant={entryMode === 'quick' ? 'default' : 'outline'}
                    aria-pressed={entryMode === 'quick'}
                    onClick={() => setEntryMode('quick')}
                    className={`rounded-xl h-8 px-3.5 text-xs font-bold transition-all duration-150 ease-out ${entryMode === 'quick' ? 'bg-[#005bbf] text-white hover:bg-[#004ca0]' : 'border-white/70 bg-white/40 backdrop-blur-sm text-[#1E293B] hover:bg-white/60'}`}
                  >
                    Chọn nhanh nhiều sinh viên
                  </Button>
                </div>

                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-300/30 rounded-2xl p-3.5 sm:p-4 lg:p-4.5 flex flex-col gap-3 w-full">
                  <div className="flex gap-2 items-center text-[#005bbf]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <h3 className="font-bold text-sm lg:text-[15px] leading-none">Ghi nhận sinh viên vi phạm (nếu có)</h3>
                  </div>

                  {/* Entry Form: Tinh gọn không bị lồng nhiều lớp */}
                  <div className="bg-white/35 backdrop-blur-xs border border-white/60 rounded-xl p-3 sm:p-3.5 w-full relative z-20">
                    {entryMode === 'manual' ? (
                    <div className="grid grid-cols-12 gap-2.5 sm:gap-3 w-full">
                      {/* Họ tên sinh viên sử dụng Select Component */}
                      <div className="col-span-12 md:col-span-6 flex flex-col items-start w-full relative">
                        <Select
                          value={selectedStudentId}
                          onValueChange={setSelectedStudentId}
                          onSearchQueryChange={handleStudentSearch}
                          label="Họ tên sinh viên"
                          error={""}
                        >
                          <SelectTrigger
                            className="bg-white/40 border-white/70 backdrop-blur-sm h-9 sm:h-10 rounded-xl px-3.5 text-xs sm:text-[12.5px] text-[#1E293B] font-semibold outline-none w-full shadow-xs focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-150 ease-out hover:bg-white/60 cursor-pointer font-sans"
                            disabled={classIds.length === 0}
                          >
                            <SelectValue placeholder={classIds.length > 0 ? "Tìm tên..." : "Vui lòng chọn lớp trước..."} />
                          </SelectTrigger>
                          <SelectContent 
                            lazyLoad 
                            onLoadMore={handleLoadMoreStudents}
                            className="bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-white/70"
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
                      </div>

                      {/* Tiêu chí sử dụng Select Component */}
                      <div className="col-span-12 md:col-span-6 flex flex-col items-start w-full relative">
                        <Select
                          value={selectedCriterionId}
                          onValueChange={handleCriterionChange}
                          label="Tiêu chí ghi nhận"
                          error={""}
                        >
                          <SelectTrigger className="bg-white/40 border-white/70 backdrop-blur-sm h-9 sm:h-10 rounded-xl px-3.5 text-xs sm:text-[12.5px] text-[#1E293B] font-semibold outline-none w-full shadow-xs focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-150 ease-out hover:bg-white/60 cursor-pointer font-sans">
                            <SelectValue placeholder="Chọn tiêu chí..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-white/70 font-sans">
                            {orderedCriteria.frequent.length > 0 && <SelectLabel>Sử dụng nhiều</SelectLabel>}
                            {orderedCriteria.frequent.map(c => (
                              <SelectItem key={c._id} value={c._id}>{c.criterion_name} ({c.score_per_unit || c.min_score || -5}đ)</SelectItem>
                            ))}
                            {orderedCriteria.frequent.length > 0 && orderedCriteria.remaining.length > 0 && <SelectSeparator />}
                            {orderedCriteria.remaining.map(c => (
                              <SelectItem key={c._id} value={c._id}>{c.criterion_name} ({c.score_per_unit || c.min_score || -5}đ)</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Ghi chú chi tiết sử dụng Input Component */}
                      <Input
                        type="text"
                        label="Ghi chú chi tiết"
                        value={violationNote}
                        onChange={(e) => setViolationNote(e.target.value)}
                        placeholder="VD: Nhắc nhở lần 1..."
                        className="bg-white/40 border-white/70 backdrop-blur-sm h-9 sm:h-10 rounded-xl px-3.5 text-xs sm:text-[12.5px] text-[#1E293B] placeholder:text-[#64748B]/60 placeholder:font-normal focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:bg-white/70 focus-visible:border-blue-400 shadow-xs transition-all duration-150 ease-out"
                        containerClassName="col-span-12 md:col-span-9 w-full"
                      />

                      {/* Nút Thêm sử dụng Button Component */}
                      <div className="col-span-12 md:col-span-3 flex items-end w-full">
                        <Button
                          type="button"
                          onClick={handleAddViolationToList}
                          className="bg-[#005bbf] hover:bg-[#004ca0] text-white font-bold h-9 sm:h-10 rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01] border-none outline-none w-full text-xs sm:text-[12.5px]"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          <span>Thêm</span>
                        </Button>
                      </div>
                    </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {/* Tiêu chí ghi nhận (full width, ẩn Tìm sinh viên) */}
                        <div className="w-full">
                          <Select
                            value={selectedCriterionId}
                            onValueChange={handleCriterionChange}
                            label="Tiêu chí ghi nhận"
                            error=""
                          >
                            <SelectTrigger className="bg-white/40 border-white/70 backdrop-blur-sm h-9 sm:h-10 rounded-xl px-3.5 text-xs sm:text-[12.5px] text-[#1E293B] font-semibold outline-none w-full shadow-xs hover:bg-white/60 transition-all duration-150 ease-out">
                              <SelectValue placeholder="Chọn tiêu chí..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-white/70 font-sans">
                              {orderedCriteria.frequent.length > 0 && <SelectLabel>Sử dụng nhiều</SelectLabel>}
                              {orderedCriteria.frequent.map(c => <SelectItem key={c._id} value={c._id}>{c.criterion_name} ({c.score_per_unit || c.min_score || -5}đ)</SelectItem>)}
                              {orderedCriteria.frequent.length > 0 && orderedCriteria.remaining.length > 0 && <SelectSeparator />}
                              {orderedCriteria.remaining.map(c => <SelectItem key={c._id} value={c._id}>{c.criterion_name} ({c.score_per_unit || c.min_score || -5}đ)</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-0.5">
                          <span aria-live="polite">Đã chọn: <strong className="text-[#005bbf]">{addedViolations.filter(v => v.criterion_id === selectedCriterionId).length}</strong> / {totalStudentsCount || classStudents.length}</span>
                          {isStudentsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" aria-label="Đang tải sinh viên" />}
                        </div>

                        {/* Danh sách sinh viên tinh gọn */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2 max-h-[260px] sm:max-h-[300px] overflow-y-auto pr-1" aria-label="Danh sách sinh viên">
                          {classStudents.map(student => {
                            const selected = addedViolations.some(v => v.student_id === student._id && v.criterion_id === selectedCriterionId);
                            return (
                              <button
                                key={student._id}
                                type="button"
                                aria-pressed={selected}
                                disabled={!selectedCriterionId}
                                onClick={() => handleToggleQuickStudent(student)}
                                className={`text-left rounded-lg border p-2 sm:px-2.5 sm:py-2 transition-all duration-150 ease-out flex items-center justify-between gap-2 ${
                                  selected
                                    ? 'border-rose-400/90 bg-rose-50/90 text-rose-900 shadow-2xs'
                                    : 'border-white/70 bg-white/50 backdrop-blur-2xs hover:border-blue-400/60 hover:bg-white/80 text-[#1E293B]'
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="block text-xs font-bold truncate">{student.full_name}</span>
                                  <span className="block text-[10.5px] text-slate-500 font-mono">MSSV: {student.student_code}</span>
                                </div>
                                {selected && (
                                  <span className="shrink-0 text-[10px] font-bold text-red-600 bg-red-100/90 border border-red-200/80 px-1.5 py-0.5 rounded">
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
                        <p className="text-[11px] text-slate-400">Chọn tiêu chí trước, sau đó nhấn vào thẻ sinh viên để thêm hoặc bỏ ghi nhận.</p>
                      </div>
                    )}
                  </div>

                  {entryMode === 'manual' && <>
                  {/* Violation Table */}
                  <div className="border border-white/60 rounded-xl overflow-hidden w-full shadow-xs bg-white/15 backdrop-blur-2xs">
                    <table className="w-full text-left border-collapse min-w-max">
                      <thead>
                        <tr className="bg-white/40 backdrop-blur-sm border-b border-white/60">
                          <th className="px-3.5 py-2 font-bold text-[#005bbf] text-[11px] tracking-[0.5px] uppercase">HỌ TÊN</th>
                          <th className="px-3.5 py-2 font-bold text-[#005bbf] text-[11px] tracking-[0.5px] uppercase">TIÊU CHÍ</th>
                          <th className="px-3.5 py-2 font-bold text-[#005bbf] text-[11px] tracking-[0.5px] uppercase">GHI CHÚ</th>
                          <th className="px-3.5 py-2 font-bold text-[#005bbf] text-[11px] tracking-[0.5px] uppercase text-center w-24">THAO TÁC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/20">
                        {addedViolations.map((violation, idx) => {
                          const criterion = criteria.find(c => c._id === violation.criterion_id);
                          const type = criterion?.criterion_type || (violation.points_effect > 0 ? 'cong_diem' : 'ky_luat');

                          let badgeClass = 'bg-blue-50 text-blue-600 border border-blue-100';
                          if (type === 'khen_thuong') {
                            badgeClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
                          } else if (type === 'ky_luat') {
                            badgeClass = 'bg-rose-50 text-rose-600 border border-rose-100';
                          }

                          return (
                            <tr key={idx} className="hover:bg-white/50 transition-all duration-150 ease-out">
                              <td className="px-3.5 py-2 font-semibold text-[#111c2d] text-xs">
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
                              <td className="px-3.5 py-2 font-normal text-[#414754] text-xs max-w-[200px] truncate" title={violation.class_note}>
                                {violation.class_note}
                              </td>
                              <td className="px-3.5 py-2 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => handleRemoveViolationFromList(idx)}
                                  className="w-7 h-7 rounded-lg hover:bg-rose-100/80 hover:text-rose-600 p-0 flex items-center justify-center text-rose-500 transition-all duration-150 ease-out hover:scale-[1.05] bg-white/40 border border-white/70 shadow-xs outline-none cursor-pointer mx-auto"
                                  title="Xóa vi phạm"
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
                              Chưa có ghi nhận sinh viên vi phạm trong buổi học này.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  </>}

                  {/* Sĩ số hiển thị xem nhanh */}
                  <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs font-bold text-slate-600 px-3 py-2 bg-white/40 border border-white/60 rounded-xl mt-0.5">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      <span>Sĩ số lớp: <strong className="text-slate-800">
                        {isStudentsLoading ? (
                          <Loader2 className="inline-block w-3.5 h-3.5 animate-spin text-slate-400 align-middle ml-1" />
                        ) : (
                          `${classStudents.length} SV`
                        )}
                      </strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Hiện diện: <strong className="text-emerald-600">
                        {isStudentsLoading ? (
                          <Loader2 className="inline-block w-3.5 h-3.5 animate-spin text-emerald-400 align-middle ml-1" />
                        ) : (
                          `${totalPresent} SV`
                        )}
                      </strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>Vắng mặt: <strong className="text-rose-600">
                        {isStudentsLoading ? (
                          <Loader2 className="inline-block w-3.5 h-3.5 animate-spin text-rose-400 align-middle ml-1" />
                        ) : (
                          `${totalAbsent} SV`
                        )}
                      </strong></span>
                    </div>
                    <div className="ml-auto text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-lg text-[11px] min-w-[85px] text-center border border-emerald-100 font-semibold">
                      {isStudentsLoading ? (
                        <Loader2 className="inline-block w-3.5 h-3.5 animate-spin text-emerald-500 align-middle" />
                      ) : (
                        `${classStudents.length > 0 ? Math.round((totalPresent / classStudents.length) * 100) : 0}% Chuyên cần`
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions Panel */}
            <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-xs shadow-slate-300/30 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 w-full">
              {/* Reset/Placeholder info */}
              <div className="hidden sm:flex items-center text-xs text-[#414754] font-medium italic">
                Hãy kiểm tra kỹ thông tin chuyên cần & kỷ luật trước khi lưu.
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 items-center justify-end w-full sm:w-auto ml-auto">
                {/* Hủy bỏ */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="border border-[rgba(0,91,191,0.3)] bg-white/40 hover:bg-white/70 rounded-xl px-5 sm:px-7 py-2 text-[#005bbf] font-bold text-xs sm:text-[13px] h-9 sm:h-9.5 hover:scale-[1.01] transition-all duration-150 ease-out"
                >
                  Hủy bỏ
                </Button>

                {/* Lưu ghi nhận */}
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="relative bg-[#005bbf] text-white font-bold px-6 sm:px-8 py-2 rounded-xl shadow-xs hover:bg-[#004ca0] focus:ring-2 focus:ring-blue-500/20 transition-all duration-150 ease-out hover:scale-[1.01] flex items-center justify-center gap-1.5 border-none outline-none cursor-pointer text-xs sm:text-[13px] h-9 sm:h-9.5 disabled:opacity-75 disabled:cursor-not-allowed"
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
