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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { format, parse } from 'date-fns';
import { toast } from 'sonner';
import { classApi, Class } from '@/api/class-api';
import { studentApi, Student } from '@/api/student-api';
import { criteriaApi, Criterion } from '@/api/criteria-api';
import { academicRecordApi, AcademicRecord } from '@/api/academic-record-api';
import { semesterApi } from '@/api/semester-api';
import { summariesPointApi } from '@/api/summaries-point-api';
import { evaluationDetailApi } from '@/api/evaluation-detail-api';
import { departmentApi, Department } from '@/api/department-api';
import { useAuth } from '@/providers/auth-provider';
import { useLinkedTaskProgress } from '@/hooks/useLinkedTaskProgress';

interface ViolationItem {
  student_id: string;
  student_name: string;
  student_code: string;
  evaluation_detail_id: string;
  criterion_name: string;
  points_effect: number;
  class_note: string;
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

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isStudentsLoading, setIsStudentsLoading] = useState(false);

  // Card Trái (Thông tin cơ bản)
  const [departments, setDepartments] = useState<Department[]>([]);
  const [department, setDepartment] = useState('');
  const [classId, setClassId] = useState('');
  const [category, setCategory] = useState('ky_luat'); // 'ky_luat' hoặc 'khen_thuong'
  const [criterionId, setCriterionId] = useState('');
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Card Phải (Ghi nhận sinh viên)
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [violationNote, setViolationNote] = useState('');
  const [addedViolations, setAddedViolations] = useState<ViolationItem[]>([]);
  const [activeSemesterId, setActiveSemesterId] = useState('60d0fe4f5311236168a109cb');

  const isEditMode = Boolean(recordToEdit && recordToEdit._id);

  // Load classes, students, criteria
  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true);
      try {
        const classList = await classApi.getClasses();
        setClasses(classList);

        try {
          const departmentList = await departmentApi.getDepartments();
          setDepartments(departmentList);
        } catch (deptErr) {
          console.warn('Lỗi khi nạp danh sách Khoa:', deptErr);
        }

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
          let departmentIdFromRecord = '';
          if (studentObj?.class_id) {
            classIdFromRecord = typeof studentObj.class_id === 'object' ? studentObj.class_id?._id : studentObj.class_id;
            const classObj = typeof studentObj.class_id === 'object' ? studentObj.class_id : classList.find(c => c._id === classIdFromRecord);
            if (classObj && classObj.dept_id) {
              departmentIdFromRecord = typeof classObj.dept_id === 'object' ? classObj.dept_id?._id : classObj.dept_id;
            }
          } else if (studentIdStr) {
            try {
              const sObj = await studentApi.getStudent(studentIdStr);
              if (sObj) {
                classIdFromRecord = typeof sObj.class_id === 'object' ? sObj.class_id?._id : sObj.class_id;
                const classObj = typeof sObj.class_id === 'object' ? sObj.class_id : classList.find(c => c._id === classIdFromRecord);
                if (classObj && classObj.dept_id) {
                  departmentIdFromRecord = typeof classObj.dept_id === 'object' ? classObj.dept_id?._id : classObj.dept_id;
                }
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

          if (departmentIdFromRecord) {
            setDepartment(String(departmentIdFromRecord));
          }
          if (classIdFromRecord) {
            setClassId(classIdFromRecord);
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

  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsSearch, setStudentsSearch] = useState("");
  const [hasMoreStudents, setHasMoreStudents] = useState(true);

  const fetchClassStudents = async (page: number, searchVal: string, append: boolean = false) => {
    if (!classId) return;
    setIsStudentsLoading(true);
    try {
      const limit = 30;
      const res = await studentApi.getStudents({
        classId,
        page,
        limit,
        search: searchVal || undefined
      });
      
      const newStudents = Array.isArray(res) ? res : (res?.data || []);
      setClassStudents(prev => append ? [...prev, ...newStudents] : newStudents);
      setHasMoreStudents(newStudents.length >= limit);
    } catch (err) {
      console.warn('Lỗi nạp sinh viên lớp:', err);
      if (!append) {
        setClassStudents([]);
      }
    } finally {
      setIsStudentsLoading(false);
    }
  };

  const handleClassChange = (nextClassId: string) => {
    setClassId(nextClassId);
    setSelectedStudentId('');
    setViolationNote('');
    setAddedViolations([]);
  };

  const handleDepartmentChange = (nextDeptId: string) => {
    setDepartment(nextDeptId);
    setClassId('');
    setSelectedStudentId('');
    setViolationNote('');
    setAddedViolations([]);
  };

  const filteredClasses = classes.filter(c => {
    if (!department) return false;
    const cDeptId = typeof c.dept_id === 'object' ? c.dept_id?._id : c.dept_id;
    return cDeptId === department;
  });

  // Lọc sinh viên theo lớp học đang chọn từ backend
  useEffect(() => {
    setSelectedStudentId('');
    setViolationNote('');
    setStudentsPage(1);
    setStudentsSearch("");
    setHasMoreStudents(true);
    setClassStudents([]);
    if (classId) {
      fetchClassStudents(1, "");
      setAddedViolations([]);
    } else {
      setAddedViolations([]);
    }
  }, [classId]);

  // Tránh search liên tục khi gõ, ta dùng debounce
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  const handleStudentSearch = (query: string) => {
    setStudentsSearch(query);
    setStudentsPage(1);
    setHasMoreStudents(true);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      fetchClassStudents(1, query, false);
    }, 400);
  };

  const handleLoadMoreStudents = () => {
    if (isStudentsLoading || !hasMoreStudents) return;
    const nextPage = studentsPage + 1;
    setStudentsPage(nextPage);
    fetchClassStudents(nextPage, studentsSearch, true);
  };

  // Lọc danh sách tiêu chí (lấy tất cả không cần qua danh mục)
  const filteredCriteria = criteria;

  // Reset tiêu chí khi đổi danh mục
  useEffect(() => {
    setCriterionId('');
  }, [category]);

  const handleAddViolationToList = () => {
    if (!classId) {
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

    // Check trùng vi phạm cùng sinh viên
    const isDuplicate = addedViolations.some(
      v => v.student_id === selectedStudentId && v.evaluation_detail_id === criterionId
    );
    if (isDuplicate) {
      toast.error('Sinh viên này đã được ghi nhận tiêu chí này!');
      return;
    }

    const student = classStudents.find(s => s._id === selectedStudentId);
    const criterion = criteria.find(c => c._id === criterionId);

    if (student && criterion) {
      const newViolation: ViolationItem = {
        student_id: student._id,
        student_name: student.full_name,
        student_code: student.student_code,
        evaluation_detail_id: criterion._id,
        criterion_name: criterion.criterion_name,
        points_effect: criterion.score_per_unit || criterion.min_score || -5,
        class_note: violationNote.trim() || 'Không có ghi chú'
      };

      setAddedViolations([...addedViolations, newViolation]);

      // Reset input sinh viên & ghi chú
      setSelectedStudentId('');
      setViolationNote('');
      toast.success('Đã thêm sinh viên vào danh sách tạm!');
    }
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
      <div className="flex flex-col gap-[20px] mx-auto w-full">
        {/* Page Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
          <div className="flex gap-[12px] items-center">
            {/* Back Button Pill Glassmorphism using Custom Button */}
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="backdrop-blur-md bg-white/45 border border-white/70 rounded-xl w-10 h-10 p-0 flex items-center justify-center cursor-pointer hover:bg-white/80 transition-all duration-150 ease-out hover:scale-[1.05] shadow-sm shrink-0"
              title="Quay lại"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700" />
            </Button>

            {/* Figma Icon Block */}
            <div className="hidden xs:flex backdrop-blur-md bg-white/45 border border-white/70 items-center justify-center rounded-xl shadow-sm shrink-0 w-10 h-10">
              <FileText className="w-4 h-4 text-[#005bbf]" />
            </div>

            <div className="flex flex-col items-start min-w-0">
              <h2 className="font-bold text-[20px] lg:text-[23px] text-[#005bbf] leading-tight truncate">
                {isEditMode ? 'Chỉnh sửa Ghi nhận Rèn luyện' : 'Thêm Ghi nhận Rèn luyện'}
              </h2>
              <p className="font-normal text-[#414754] text-[13px] lg:text-[14px] leading-relaxed">
                {isEditMode ? 'Cập nhật thông tin ghi nhận hiện tại của sinh viên' : 'Ghi nhận khen thưởng hoặc vi phạm của sinh viên'}
              </p>
            </div>
          </div>
          <div className="flex items-center sm:justify-end shrink-0">
            <div className="bg-[#005bbf]/5 text-[#005bbf] font-bold text-[11px] px-3.5 py-1.5 rounded-xl uppercase tracking-wider border border-[#005bbf]/10 flex items-center gap-1.5 shadow-sm bg-white/40 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-[#005bbf] animate-pulse" />
              <span>Hệ thống ghi nhận</span>
            </div>
          </div>
        </div>
        {isLoadingData ? (
          <div className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl p-10 shadow-sm shadow-slate-300/40 flex flex-col items-center justify-center min-h-[250px] gap-3">
            <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
            <span className="text-[#005bbf] font-semibold text-xs">Đang nạp dữ liệu rèn luyện...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-[20px]">
            {/* Main Grid Layout (12 Columns) */}
            <div className="grid grid-cols-12 gap-[20px] w-full relative z-10">

              {/* Left Column: Core Info (col-span-4) */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-[20px]">
                {/* Section 1: Thông tin cơ bản */}
                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl p-[22px] lg:p-[26px] flex flex-col gap-[16px] w-full">
                  <div className="flex gap-[8px] items-center text-[#005bbf]">
                    <FileText className="w-4.5 h-4.5 shrink-0" />
                    <h3 className="font-bold text-[15px] lg:text-[16px] leading-none">Thông tin cơ bản</h3>
                  </div>

                  <div className="flex flex-col gap-[14px] w-full">
                    {/* Khoa học sử dụng Select Component */}
                    <div className="flex flex-col w-full relative">
                      <Select
                        value={department}
                        onValueChange={handleDepartmentChange}
                        label="Khoa"
                        required
                        error={""}
                      >
                        <SelectTrigger className="bg-white/50 border-white/80 backdrop-blur-sm h-10 rounded-xl px-[16px] text-[13.5px] text-[#1E293B] font-semibold outline-none focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all hover:bg-white/70 cursor-pointer w-full shadow-sm">
                          <SelectValue placeholder="Chọn Khoa..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-100/60">
                          {departments.map(d => (
                            <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                          ))}
                          {departments.length === 0 && (
                            <div className="p-4 text-center text-xs text-slate-400 italic">Không có khoa nào</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Lớp học sử dụng Select Component */}
                    <div className="flex flex-col w-full relative">
                      <Select
                        value={classId}
                        onValueChange={handleClassChange}
                        label="Lớp học"
                        required
                        error={""}
                      >
                        <SelectTrigger className="bg-white/50 border-white/80 backdrop-blur-sm h-10 rounded-xl px-[16px] text-[13.5px] text-[#1E293B] font-semibold outline-none focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all hover:bg-white/70 cursor-pointer w-full shadow-sm">
                          <SelectValue placeholder="Chọn lớp học..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-100/60">
                          {filteredClasses.map(c => (
                            <SelectItem key={c._id} value={c._id}>{c.class_name}</SelectItem>
                          ))}
                          {filteredClasses.length === 0 && (
                            <div className="p-4 text-center text-xs text-slate-400 italic">
                              {department ? 'Không có lớp học nào thuộc khoa này' : 'Vui lòng chọn Khoa trước'}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>


                    {/* Tiêu chí */}
                    <div className="flex flex-col w-full relative">
                      <Select
                        value={criterionId}
                        onValueChange={setCriterionId}
                        label="Tiêu chí ghi nhận"
                        required
                        error={""}
                      >
                        <SelectTrigger className="bg-white/50 border-white/80 backdrop-blur-sm h-10 rounded-xl px-[16px] text-[13.5px] text-[#1E293B] font-semibold outline-none focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all hover:bg-white/70 cursor-pointer w-full shadow-sm">
                          <SelectValue placeholder="Chọn tiêu chí..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-100/60 font-sans">
                          {filteredCriteria.map(c => (
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
                      <label className="text-[12px] font-medium text-[#414754] mb-1 ml-[4px]">Ngày báo cáo</label>
                      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="bg-white/50 border border-white/80 h-10 rounded-xl px-[16px] text-[13.5px] text-[#1E293B] font-semibold outline-none flex items-center justify-between hover:bg-white/70 focus:ring-2 focus:ring-blue-500/20 transition-all w-full shadow-sm text-left font-sans"
                          >
                            <span>{format(reportDate, 'dd/MM/yyyy')}</span>
                            <CalendarIcon className="w-[16px] h-[16px] text-slate-400 shrink-0" />
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
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-[20px]">
                <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl p-[22px] lg:p-[26px] flex flex-col gap-[16px] w-full">
                  <div className="flex gap-[8px] items-center text-[#005bbf]">
                    <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                    <h3 className="font-bold text-[15px] lg:text-[16px] leading-none">Ghi nhận sinh viên</h3>
                  </div>

                  {/* Entry Form: Kính mờ gọn gàng */}
                  <div className="bg-white/30 backdrop-blur-sm border border-white/60 rounded-xl p-[14px] w-full relative z-20">
                    <div className="grid grid-cols-12 gap-[12px] w-full">
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
                            className="bg-white/50 border-white/80 backdrop-blur-sm h-10 rounded-xl px-[14px] text-[12.5px] text-[#1E293B] font-semibold outline-none w-full shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all hover:bg-white/70 cursor-pointer font-sans"
                            disabled={!classId}
                          >
                            <SelectValue placeholder={classId ? "Tìm tên..." : "Vui lòng chọn lớp trước..."} />
                          </SelectTrigger>
                          <SelectContent 
                            lazyLoad 
                            onLoadMore={handleLoadMoreStudents}
                            className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-100/60"
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

                      {/* Ghi chú chi tiết sử dụng Input Component */}
                      <Input
                        type="text"
                        label="Ghi chú"
                        value={violationNote}
                        onChange={(e) => setViolationNote(e.target.value)}
                        placeholder="VD: Vi phạm lần đầu..."
                        className="bg-white/50 border-white/80 backdrop-blur-sm h-10 rounded-xl px-[14px] text-[12.5px] text-[#1E293B] placeholder:text-[#64748B] focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:bg-white/80 focus-visible:border-blue-400 shadow-sm"
                        containerClassName="col-span-12 md:col-span-6 w-full"
                      />

                      {!isEditMode && (
                        <div className="col-span-12 flex justify-end w-full mt-1">
                          <Button
                            type="button"
                            onClick={handleAddViolationToList}
                            className="bg-[#005bbf] hover:bg-[#004ca0] text-white font-bold h-10 px-6 rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01] border-none outline-none text-[12px] min-w-[120px]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Thêm vào danh sách</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isEditMode ? (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/90 p-3 text-[12px] text-blue-700 shadow-sm">
                      Bạn đang chỉnh sửa một bản ghi duy nhất. Các thay đổi sẽ được lưu bằng API cập nhật và không tạo thêm bản ghi mới.
                    </div>
                  ) : (
                    <div className="w-full overflow-hidden border border-white/60 rounded-xl shadow-sm bg-white/15">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white/50 backdrop-blur-sm border-b border-white/60">
                        <tr>
                          <th className="px-[20px] py-[10px] text-[11px] font-bold text-slate-600 uppercase tracking-wider">Họ tên & MSSV</th>
                          <th className="px-[20px] py-[10px] text-[11px] font-bold text-slate-600 uppercase tracking-wider">Tiêu chí ghi nhận</th>
                          <th className="px-[20px] py-[10px] text-[11px] font-bold text-slate-600 uppercase tracking-wider">Ghi chú</th>
                          <th className="px-[20px] py-[10px] text-[11px] font-bold text-slate-600 uppercase tracking-wider text-center w-[80px]">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
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
                            <tr key={idx} className="hover:bg-white/65 hover:scale-[1.002] transition-all duration-150 ease-out">
                              <td className="px-[20px] py-[12px] font-semibold text-slate-800 text-[13px]">
                                <div className="flex flex-col">
                                  <span>{violation.student_name}</span>
                                  <span className="text-slate-400 text-[10.5px] font-medium">MSSV: {violation.student_code}</span>
                                </div>
                              </td>
                              <td className="px-[20px] py-[12px]">
                                <span className={`font-bold rounded-xl px-[10px] py-[3px] text-[11.5px] inline-block tracking-wide ${badgeClass}`}>
                                  {violation.criterion_name}
                                </span>
                              </td>
                              <td className="px-[20px] py-[12px] font-normal text-[#414754] text-[13.5px] max-w-[200px] truncate" title={violation.class_note}>
                                {violation.class_note}
                              </td>
                              <td className="px-[20px] py-[12px] text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => handleRemoveViolationFromList(idx)}
                                  className="w-[28px] h-[28px] rounded-xl hover:bg-rose-100/80 hover:text-rose-600 p-0 flex items-center justify-center text-rose-500 transition-all duration-150 ease-out hover:scale-[1.05] bg-white/50 border border-white/80 shadow-sm outline-none cursor-pointer mx-auto"
                                  title="Xóa ghi nhận"
                                >
                                  <Trash2 className="w-[14px] h-[16px]" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}

                        {addedViolations.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-[20px] py-[24px] text-center text-[13px] text-slate-500 italic bg-white/10">
                              Chưa có ghi nhận sinh viên trong danh sách tạm.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  )}

                  {/* Hiển thị sĩ số/tổng hợp xem nhanh */}
                  <div className="flex flex-wrap items-center gap-4 lg:gap-6 text-[12px] font-bold text-slate-500 px-2 mt-1">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
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
            <div className="bg-white/45 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl p-[18px] flex items-center justify-between gap-4 w-full relative z-0">
              <div className="hidden sm:flex items-center text-[12.5px] text-[#414754] font-medium italic">
                Hãy kiểm tra kỹ thông tin rèn luyện trước khi lưu.
              </div>

              {/* Action Buttons */}
              <div className="flex gap-[12px] items-center justify-end w-full sm:w-auto ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="border border-[rgba(0,91,191,0.3)] bg-white/30 hover:bg-white/80 rounded-xl px-[32px] py-[10px] text-[#005bbf] font-bold text-[13px] tracking-[0.28px] h-10 hover:scale-[1.01] transition-all duration-150 ease-out"
                >
                  Hủy bỏ
                </Button>

                <Button
                  type="submit"
                  disabled={isSaving}
                  className="relative bg-[#005bbf] text-white font-bold px-[38px] py-[10px] rounded-xl shadow-sm hover:bg-[#004ca0] focus:ring-2 focus:ring-blue-500/20 transition-all duration-150 ease-out hover:scale-[1.01] flex items-center justify-center gap-2 border-none outline-none cursor-pointer text-[13px] tracking-[0.28px] h-10 disabled:opacity-75 disabled:cursor-not-allowed"
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
