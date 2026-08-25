"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RouteGuard, usePermission } from "@/components/guards/RouteGuard";
import { useAuth } from "@/providers/auth-provider";
import {
  Search,
  Plus,
  Users,
  School,
  Calendar as CalendarIcon,
  Trash2,
  Edit,
  ChevronDown,
  ArrowLeft,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import ClassPopup from "@/components/popups/ClassPopup";
import DepartmentPopup from "@/components/popups/DepartmentPopup";
import ImportClassPopup from "@/components/popups/ImportClassPopup";
import ConfirmModal from "@/components/modals/ConfirmModal";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentAvatar } from "@/components/ui/StudentAvatar";
import { Button } from "@/components/ui/button";
import { Research } from "@/components/ui/Research";
import StudentDirectorySearch from "@/components/students/StudentDirectorySearch";
import { motion, AnimatePresence } from "framer-motion";
import TabNavigation from "@/components/ui/TabNavigation";
import Action from "@/components/ui/Action";
import { departmentApi, Department } from "@/api/department-api";
import { classApi, Class } from "@/api/class-api";
import { studentApi, Student } from "@/api/student-api";
import { addNotification } from "@/lib/notifications";
import { HeaderCustomMappings } from "@/providers/header-provider";
import { controlBase, controlHover } from "@/components/ui/controlStyles";
import { dormitoryApi } from "@/api/dormitory-api";

const ENABLE_MOCK_SEED = process.env.NEXT_PUBLIC_ENABLE_MOCK_SEED === "true";

function StudentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deptIdFromUrl = searchParams.get("deptId");
  const { user } = useAuth();
  
  const userRole = String(user?.role || "").toLowerCase();
  const isStudent = userRole.includes("student") || userRole.includes("học sinh") || userRole.includes("sinh viên");

  useEffect(() => {
    if (isStudent) {
      router.replace("/students/tasks");
    }
  }, [isStudent, router]);

  if (isStudent) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-400">
        Đang chuyển hướng...
      </div>
    );
  }

  const permissions = usePermission({
    canCreateDept: "DEPT_CREATE",

    canCreateClass: "CLASS_CREATE",
    canUpdateClass: "CLASS_UPDATE",
    canDeleteClass: "CLASS_DELETE",
  });

  const [deptsList, setDeptsList] = useState<Department[]>([]);
  const [classesList, setClassesList] = useState<Class[]>([]);
  const [classSummaries, setClassSummaries] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>(() => deptIdFromUrl || "");
  const [isClassPopupOpen, setIsClassPopupOpen] = useState(false);
  const [isImportClassPopupOpen, setIsImportClassPopupOpen] = useState(false);
  const [isDeptPopupOpen, setIsDeptPopupOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [isClassDeleteModalOpen, setIsClassDeleteModalOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<any>(null);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("classSearch") || "");
  const [deptSearchTerm, setDeptSearchTerm] = useState(() => searchParams.get("deptSearch") || "");
  const [isCaoDangExpanded, setIsCaoDangExpanded] = useState(true);
  const [isTrungCapExpanded, setIsTrungCapExpanded] = useState(true);
  const [isMobileViewClasses, setIsMobileViewClasses] = useState(() => searchParams.get("view") === "classes");
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);

  const classListScrollRef = useRef<HTMLDivElement | null>(null);
  const hasRestoredClassListScrollRef = useRef(false);

  const getClassListScrollKey = () =>
    `students:class-list-scroll:${selectedDept}:${searchTerm || "all"}`;

  const scrollClassListToTop = () => {
    classListScrollRef.current?.scrollTo({ top: 0 });
    hasRestoredClassListScrollRef.current = true;
  };



  const updateStudentsListUrl = (next: {
    deptId?: string;
    classSearch?: string;
    deptSearch?: string;
    view?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });

    const query = params.toString();
    router.replace(query ? `/students?${query}` : "/students", { scroll: false });
  };

  const fetchDepartments = async () => {
    try {
      let fetchedDepts = await departmentApi.getDepartments();
      if (ENABLE_MOCK_SEED && fetchedDepts.length === 0 && permissions.canCreateDept) {
        console.log("Database departments is empty. Seeding mock data...");
        const seedDepts = [
          {
            name: "Công nghệ thông tin - Kỹ thuật điện",
            code: "CNTT-KTĐ",
            description: "Khoa Công nghệ thông tin",
          },
          {
            name: "Kinh tế quốc tế",
            code: "KTQT",
            description: "Khoa Kinh tế quốc tế",
          },
          {
            name: "Ngôn ngữ Anh",
            code: "NNA",
            description: "Khoa Ngôn ngữ Anh",
          },
          {
            name: "Cơ khí chế tạo",
            code: "CKCT",
            description: "Khoa Cơ khí chế tạo",
          },
          { name: "Kiến trúc", code: "KTR", description: "Khoa Kiến trúc" },
        ];

        for (const d of seedDepts) {
          await departmentApi.createDepartment(d);
        }
        fetchedDepts = await departmentApi.getDepartments();
      }
      setDeptsList(fetchedDepts);

      // Auto select the first department if none is selected
      if (fetchedDepts.length > 0) {
        const urlDeptIsValid = deptIdFromUrl && fetchedDepts.some((dept) => dept._id === deptIdFromUrl);

        setSelectedDept((prev) => {
          if (urlDeptIsValid) return deptIdFromUrl;
          if (prev && fetchedDepts.some((d) => d._id === prev)) {
            return prev;
          }
          return fetchedDepts[0]._id;
        });
      }

      await Promise.all([fetchClasses(fetchedDepts), fetchClassSummaries()]);
    } catch (error: any) {
      toast.error("Không thể tải danh sách khoa: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClassSummaries = async () => {
    try {
      const summaries = await classApi.getClassSummary();
      setClassSummaries(summaries);
    } catch (error: any) {
      console.error("Error fetching class summaries:", error);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deptToDelete) return;
    try {
      await departmentApi.deleteDepartment(deptToDelete._id);
      toast.success(`Đã xóa khoa ${deptToDelete.name}`);
      fetchDepartments();
    } catch (error: any) {
      toast.error("Không thể xóa khoa: " + error.message);
    }
  };

  const handleClassDeleteConfirm = async () => {
    if (!classToDelete || !permissions.canDeleteClass) return;
    try {
      await classApi.deleteClass(classToDelete.id);
      toast.success(`Đã xóa lớp ${classToDelete.name}`);
      fetchDepartments();
    } catch (error: any) {
      toast.error("Không thể xóa lớp: " + error.message);
    }
  };

  const fetchClasses = async (currentDepts: Department[]) => {
    try {
      let fetchedClasses = await classApi.getClasses();
      if (ENABLE_MOCK_SEED && fetchedClasses.length === 0 && currentDepts.length > 0 && permissions.canCreateClass) {
        console.log("Database classes is empty. Seeding mock classes...");
        const cnttDept =
          currentDepts.find((d) => d.code === "CNTT") || currentDepts[0];
        const ktqtDept =
          currentDepts.find((d) => d.code === "KTQT") || currentDepts[0];

        const seedClasses = [
          {
            class_name: "Lớp CNTT-K45A",
            class_year: "2021 - 2025",
            dept_id: cnttDept._id,
            class_type: "Cao đẳng",
          },
          {
            class_name: "Lớp CNTT-K45B",
            class_year: "2021 - 2025",
            dept_id: cnttDept._id,
            class_type: "Cao đẳng",
          },
          {
            class_name: "Lớp CNTT-K44CLC",
            class_year: "2020 - 2024",
            dept_id: cnttDept._id,
            class_type: "Cao đẳng",
          },
          {
            class_name: "Lớp CNTT-K43",
            class_year: "2019 - 2023",
            dept_id: cnttDept._id,
            class_type: "Trung cấp",
          },
          {
            class_name: "Lớp KTQT-K45A",
            class_year: "2021 - 2025",
            dept_id: ktqtDept._id,
            class_type: "Cao đẳng",
          },
        ];

        for (const c of seedClasses) {
          await classApi.createClass(c);
        }
        fetchedClasses = await classApi.getClasses();
      }
      setClassesList(fetchedClasses);
    } catch (error: any) {
      console.error("Error fetching classes:", error);
    }
  };

  useEffect(() => {
    fetchDepartments();
    setUnclassifiedCount(0);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setIsDataLoading(false);
    }
  }, [selectedDept]);

  const handleClassClick = (classId: string) => {
    if (typeof window !== "undefined" && classListScrollRef.current) {
      sessionStorage.setItem(
        getClassListScrollKey(),
        String(classListScrollRef.current.scrollTop)
      );
    }

    const params = new URLSearchParams();
    if (selectedDept) params.set("deptId", selectedDept);
    if (searchTerm) params.set("classSearch", searchTerm);
    if (deptSearchTerm) params.set("deptSearch", deptSearchTerm);
    if (isMobileViewClasses) params.set("view", "classes");

    const query = params.toString();
    router.push(query ? `/students/${classId}?${query}` : `/students/${classId}`, { scroll: false });
  };

  const handleStudentDetail = (student: Student & { class_id?: any }) => {
    const classId = typeof student.class_id === "object"
      ? student.class_id?._id
      : student.class_id;
    if (classId && student._id) {
      router.push(`/students/${classId}/${student._id}`);
    }
  };

  const currentDeptName =
    deptsList.find((d) => d._id === selectedDept)?.name ||
    "Công nghệ thông tin - Kỹ thuật điện";

  const filteredDepts = deptsList.filter(
    (dept) =>
      dept.name.toLowerCase().includes(deptSearchTerm.toLowerCase()) ||
      dept.code.toLowerCase().includes(deptSearchTerm.toLowerCase()),
  );

  const filteredClasses = classesList
    .filter((cls) => {
      const deptIdStr =
        typeof cls.dept_id === "string" ? cls.dept_id : cls.dept_id?._id;
      return (
        deptIdStr === selectedDept &&
        cls.class_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    })
    .map((cls) => {
      const summary = classSummaries.find((s) => s.classId === cls._id);
      const studentCount = summary ? summary.studentCount : 0;
      const avatars = summary ? (summary.avatars || []) : [];
      const maxAvatars = 3;
      const extraStudents =
        studentCount > maxAvatars
          ? studentCount - maxAvatars
          : 0;

      return {
        id: cls._id,
        name: cls.class_name,
        year: cls.class_year,
        class_type: cls.class_type,
        headquarters: cls.headquarters || "",
        user_id:
          typeof cls.user_id === "string"
            ? cls.user_id
            : cls.user_id?._id || "",
        status: cls.class_name.includes("K44")
          ? "Sắp tốt nghiệp"
          : cls.class_name.includes("K43")
            ? "Đã tốt nghiệp"
            : "Đang học",
        students: studentCount,
        avatars,
        extraStudents,
      };
    });

  const caoDangClasses = filteredClasses.filter(
    (cls) => cls.class_type === "Cao đẳng",
  );

  const trungCapClasses = filteredClasses.filter(
    (cls) => cls.class_type === "Trung cấp",
  );

  useEffect(() => {
    if (isLoading || isDataLoading) return;
    if (!selectedDept) return;
    if (hasRestoredClassListScrollRef.current) return;

    const root = classListScrollRef.current;
    if (!root) return;

    const saved = sessionStorage.getItem(getClassListScrollKey());
    if (!saved) return;

    const scrollTop = Number(saved);
    if (!Number.isFinite(scrollTop)) return;

    requestAnimationFrame(() => {
      root.scrollTop = scrollTop;
      hasRestoredClassListScrollRef.current = true;
    });
  }, [isLoading, isDataLoading, selectedDept, searchTerm, filteredClasses.length]);

  return (
    <>
      <HeaderCustomMappings mappings={{ students: "Danh sách sinh viên" }} />
        <TabNavigation
          tabs={
            isStudent
              ? [
                  { id: "Ghi nhận", label: "Ghi nhận" },
                  { id: "Nhiệm vụ", label: "Nhiệm vụ" },
                ]
              : [
                  { id: "Danh sách", label: "Danh sách" },
                  { id: "Ghi nhận", label: "Ghi nhận" },
                  { id: "Nhiệm vụ", label: "Nhiệm vụ" },
                ]
          }
          activeTab="Danh sách"
          onTabChange={(id) => {
            if (id === "Ghi nhận") {
              router.push("/students/record");
            } else if (id === "Nhiệm vụ") {
              router.push("/students/tasks");
            }
          }}
        />
        <main className="flex-1 p-3 md:p-4 overflow-hidden flex flex-col bg-transparent relative">
          <div className="flex-1 flex flex-col xl:flex-row gap-4 min-h-0 w-full overflow-y-auto xl:overflow-hidden">
            {/* Left Column: Departments */}
            <div className={`w-full xl:w-80 flex-col gap-4 shrink-0 overflow-hidden xl:max-h-full ${isMobileViewClasses ? "hidden xl:flex" : "flex"}`}>
              <div className="flex items-center justify-between shrink-0 mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-bold text-slate-900 tracking-tight uppercase">
                    Khoa
                  </h3>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold min-w-4 h-4 px-1 flex items-center justify-center">
                    {deptsList.length}
                  </span>
                </div>
                {/* <button className="flex items-center gap-1.5 bg-white border border-slate-200/60 shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_0_rgba(0,0,0,0.1)] rounded-md px-2 py-1.5 text-[14px] text-slate-700 hover:bg-slate-50 transition-colors">
                            Trụ sở chính
                            <ChevronDown size={14} className="text-slate-400" />
                        </button> */}
              </div>

              <StudentDirectorySearch onOpenDetail={handleStudentDetail} />

              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-hover pb-4">
                {filteredDepts.map((dept) => {
                  const deptClassCount = classesList.filter((cls) => {
                    const deptIdStr =
                      typeof cls.dept_id === "string"
                        ? cls.dept_id
                        : cls.dept_id?._id;
                    return deptIdStr === dept._id;
                  }).length;
                  return (
                    <div
                      key={dept._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedDept(dept._id);
                        setIsMobileViewClasses(true);
                        scrollClassListToTop();
                        updateStudentsListUrl({ deptId: dept._id, view: "classes" });
                      }}
                      className={`w-full p-3 rounded-xl border text-left transition-all duration-150 ease-out shrink-0 group flex flex-col cursor-pointer ${
                        selectedDept === dept._id
                          ? "bg-white/60 backdrop-blur-md border-white/80 shadow-sm"
                          : "bg-white/40 backdrop-blur-sm border-white/60 hover:bg-white/60 hover:scale-[1.01]"
                      }`}
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div
                          className={`p-2.5 rounded-lg shrink-0 ${selectedDept === dept._id ? "bg-blue-600 text-white shadow-blue-200" : "bg-gray-50 text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600"} transition-colors`}
                        >
                          <School size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4
                            className={`font-semibold text-sm truncate ${selectedDept === dept._id ? "text-gray-900" : "text-gray-700"}`}
                          >
                            {dept.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                              {dept.code}
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500">
                              {deptClassCount} Lớp
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-full flex items-center justify-end border-t overflow-hidden transition-all duration-300 ease-in-out ${
                          selectedDept === dept._id
                            ? "max-h-14 opacity-100 mt-3 pt-3 border-blue-100"
                            : "max-h-0 opacity-0 mt-0 pt-0 border-transparent group-hover:max-h-14 group-hover:opacity-100 group-hover:mt-3 group-hover:pt-3 group-hover:border-gray-100"
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <Action
                            permissionEdit="DEPT_UPDATE"
                            permissionDelete="DEPT_DELETE"
                            onEdit={() => {
                              setEditingDept(dept);
                              setIsDeptPopupOpen(true);
                            }}
                            onDelete={() => {
                              setDeptToDelete(dept);
                              setIsDeleteModalOpen(true);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {permissions.canCreateDept && (
                  <button
                    onClick={() => {
                      setEditingDept(null);
                      setIsDeptPopupOpen(true);
                    }}
                    className="w-full py-3 border border-dashed border-white/80 bg-white/30 backdrop-blur-sm rounded-xl text-sm font-medium text-slate-500 hover:bg-white/50 hover:border-white transition-all duration-150 ease-out flex items-center justify-center gap-2 shrink-0 hover:scale-[1.01]"
                  >
                    <Plus size={18} />
                    Thêm khoa
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Class List */}
            <div className={`flex-1 bg-white/40 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm shadow-slate-300/40 flex-col min-w-0 overflow-hidden relative ${isMobileViewClasses ? "flex" : "hidden xl:flex"}`}>
              {/* Header */}
              <div className="px-4 py-4 md:px-8 md:py-6 border-b border-white/50 shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    {/* Hàng tiêu đề có nút Quay lại trên mobile */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setIsMobileViewClasses(false);
                          updateStudentsListUrl({ view: "" });
                        }}
                        className="xl:hidden p-1.5 hover:bg-white/60 active:bg-white/80 rounded-xl text-blue-600 transition-colors -ml-1 border border-transparent hover:border-white/50 shadow-sm flex items-center justify-center shrink-0"
                        title="Quay lại danh sách khoa"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <h2 className="text-[20px] md:text-[24px] font-bold text-[#1f2937] tracking-tight flex items-center gap-2">
                        Danh sách lớp
                        <span className="text-[11px] md:text-[12px] font-bold text-[#4f46e5] bg-[#eef2ff] px-2 py-0.5 md:px-[12px] md:py-[4px] rounded-full">
                          {filteredClasses.length} lớp
                        </span>
                      </h2>
                    </div>

                    <div className="flex items-center gap-1.5 text-[13px] md:text-[14px] text-[#1f2937] font-bold leading-tight flex-wrap mt-0.5">
                      <School size={15} className="text-[#6b7280] shrink-0" />
                      <span>{currentDeptName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full lg:w-auto mt-3 lg:mt-0">
                    <Research
                      placeholder="Tìm tên lớp..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        scrollClassListToTop();
                      }}
                      containerClassName="flex-1 max-w-none lg:max-w-[231px]"
                    />
                    {permissions.canCreateClass && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsImportClassPopupOpen(true)}
                          className="flex items-center gap-1.5 px-4 h-9 border border-white/80 bg-white/50 backdrop-blur-sm hover:bg-white/70 hover:scale-[1.01] rounded-xl cursor-pointer text-xs font-semibold text-slate-700 shadow-xs shrink-0 transition-all duration-150 ease-out focus:outline-none"
                        >
                          <Upload size={13} />
                          <span>Import lớp</span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingClass({ departmentId: selectedDept });
                            setIsClassPopupOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-4 h-9 border border-white/80 bg-white/50 backdrop-blur-sm hover:bg-white/70 hover:scale-[1.01] rounded-xl cursor-pointer text-xs font-semibold text-slate-700 shadow-xs shrink-0 transition-all duration-150 ease-out focus:outline-none"
                        >
                          <Plus size={13} />
                          <span>Thêm lớp</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Class cards container */}
              <div
                ref={classListScrollRef}
                className="flex-1 overflow-y-auto px-4 md:px-8 py-4 bg-transparent scrollbar-hover"
              >
                <div className="flex flex-col gap-4 w-full">
                  {isLoading || isDataLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col h-[180px]"
                        >
                          <Skeleton className="w-16 h-5 mb-3" />
                          <Skeleton className="w-3/4 h-6 mb-2" />
                          <Skeleton className="w-1/2 h-4 mb-4" />
                          <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                            <Skeleton className="w-20 h-4" />
                            <div className="flex -space-x-1.5 pl-2">
                              <Skeleton className="w-6 h-6 rounded-full" />
                              <Skeleton className="w-6 h-6 rounded-full" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {/* Cao đẳng Section */}
                      <div className="flex flex-col gap-4 w-full">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-1 items-center">
                            <span className="text-[14px] font-medium text-[#6b7280] tracking-wide">
                              Hệ Cao đẳng
                            </span>
                            <div className="flex-1 h-px bg-[#f3f4f6] ml-4" />
                          </div>
                          <button
                            onClick={() => {
                              setIsCaoDangExpanded(!isCaoDangExpanded);
                              scrollClassListToTop();
                            }}
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-650 transition-colors"
                          >
                            <ChevronDown
                              size={18}
                              className={`transition-transform duration-250 ${isCaoDangExpanded ? "" : "rotate-180"}`}
                            />
                          </button>
                        </div>

                        {isCaoDangExpanded && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {caoDangClasses.map((cls) => (
                              <div
                                key={cls.id}
                                onClick={() => handleClassClick(cls.id)}
                                className="group bg-white/50 backdrop-blur-md border border-white/70 rounded-2xl p-[21px] flex flex-col gap-[8px] h-full shadow-sm shadow-slate-300/40 hover:shadow-md transition-all duration-150 ease-out hover:scale-[1.01] relative cursor-pointer"
                              >
                                {/* Action Hover overlay */}
                                {(permissions.canUpdateClass || permissions.canDeleteClass) && <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 bg-white/95 backdrop-blur-sm p-1.5 rounded-xl">
                                  <Action
                                    permissionEdit="CLASS_UPDATE"
                                    permissionDelete="CLASS_DELETE"
                                    onEdit={() => {
                                      if (!permissions.canUpdateClass) return;
                                      setEditingClass({
                                        _id: cls.id,
                                        name: cls.name,
                                        year: cls.year,
                                        departmentId: selectedDept,
                                        degreeLevel: "Cao đẳng",
                                        headquarters: cls.headquarters,
                                        teacherId: cls.user_id,
                                      });
                                      setIsClassPopupOpen(true);
                                    }}
                                    onDelete={() => {
                                      if (!permissions.canDeleteClass) return;
                                      setClassToDelete(cls);
                                      setIsClassDeleteModalOpen(true);
                                    }}
                                  />
                                </div>}

                                <div className="flex items-start justify-between">
                                  <div
                                    className={`px-[10px] py-[4px] rounded-[8px] text-[10px] font-bold uppercase tracking-wider ${
                                      cls.status === "Đang học"
                                        ? "bg-[#f0fdf4] text-[#16a34a]"
                                        : cls.status === "Sắp tốt nghiệp"
                                          ? "bg-[#fff7ed] text-[#ea580c]"
                                          : "bg-[#f9fafb] border border-[#e5e7eb] text-[#6b7280]"
                                    }`}
                                  >
                                    {cls.status}
                                  </div>
                                </div>

                                <div className="flex-1 mt-2">
                                  <h4
                                    className="text-[18px] font-bold text-[#1f2937] leading-[28px] line-clamp-1 group-hover:text-[#5519f0] transition-colors"
                                    title={cls.name}
                                  >
                                    {cls.name}
                                  </h4>
                                  <div className="flex items-center gap-[12px] text-[12px] text-[#9ca3af] mt-1 font-normal flex-wrap">
                                    <div className="flex items-center gap-[6px]">
                                      <CalendarIcon
                                        size={14}
                                        className="text-[#9ca3af]"
                                      />
                                      <span>{cls.year}</span>
                                    </div>
                                    {cls.headquarters && (
                                      <>
                                        <span>•</span>
                                        <span className="bg-slate-100 text-slate-650 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                          {cls.headquarters}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="pt-6 border-t border-gray-50 flex items-center justify-between mt-4">
                                  <div className="bg-[#eef2ff] px-[8px] py-[6px] rounded-[8px] flex items-center gap-[8px] text-[12px] font-bold text-[#4f46e5]">
                                    <Users
                                      size={14}
                                      className="text-[#4f46e5]"
                                    />
                                    <span>
                                      {cls.students}{" "}
                                      <span className="text-[#9ca3af] text-[10px] font-normal">
                                        học viên
                                      </span>
                                    </span>
                                  </div>

                                  {cls.avatars.length > 0 && (
                                    <div className="flex -space-x-2 pl-2">
                                      {cls.avatars.map((avatar, idx) => (
                                        <StudentAvatar
                                          key={avatar._id || idx}
                                          fullName={avatar.full_name}
                                          sizeClass="w-[28px] h-[28px] border-2 border-white shadow-sm hover:translate-y-[-2px] transition-transform cursor-pointer"
                                          textClassName="text-[10px]"
                                        />
                                      ))}
                                      {cls.extraStudents > 0 && (
                                        <div className="w-[28px] h-[28px] rounded-full border-2 border-white bg-[#f9fafb] flex items-center justify-center text-[8px] font-bold text-[#6b7280] shadow-sm shrink-0">
                                          +{cls.extraStudents}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}

                            {/* Add new Class card inside Cao đẳng */}
                            {permissions.canCreateClass && (
                            <div
                              onClick={() => {
                                setEditingClass({
                                  departmentId: selectedDept,
                                  degreeLevel: "Cao đẳng",
                                });
                                setIsClassPopupOpen(true);
                              }}
                              className="border-2 border-dashed border-white/80 bg-white/30 backdrop-blur-md hover:border-white hover:bg-white/50 rounded-2xl flex flex-col items-center justify-center p-[22px] py-[50px] cursor-pointer hover:scale-[1.01] transition-all duration-150 ease-out group min-h-[190px]"
                            >
                              <div className="w-12 h-12 rounded-full bg-white border border-[#f3f4f6] group-hover:border-[#5519f0]/20 flex items-center justify-center text-gray-400 group-hover:text-[#5519f0] shadow-[0px_1px_1px_rgba(0,0,0,0.05)] transition-all group-hover:scale-110">
                                <Plus size={20} strokeWidth={2.5} />
                              </div>
                              <span className="text-[14px] font-bold text-[#6b7280] group-hover:text-[#5519f0] transition-colors mt-3">
                                Thêm lớp học mới
                              </span>
                            </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Trung cấp Section */}
                      <div className="flex flex-col gap-4 w-full">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-1 items-center">
                            <span className="text-[14px] font-medium text-[#6b7280] tracking-wide">
                              Hệ Trung cấp
                            </span>
                            <div className="flex-1 h-px bg-[#f3f4f6] ml-4" />
                          </div>
                          <button
                            onClick={() => {
                              setIsTrungCapExpanded(!isTrungCapExpanded);
                              scrollClassListToTop();
                            }}
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-650 transition-colors"
                          >
                            <ChevronDown
                              size={18}
                              className={`transition-transform duration-250 ${isTrungCapExpanded ? "" : "rotate-180"}`}
                            />
                          </button>
                        </div>

                        {isTrungCapExpanded && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {trungCapClasses.map((cls) => (
                              <div
                                key={cls.id}
                                onClick={() => handleClassClick(cls.id)}
                                className="group bg-white/50 backdrop-blur-md border border-white/70 rounded-2xl p-[21px] flex flex-col gap-[8px] h-full shadow-sm shadow-slate-300/40 hover:shadow-md transition-all duration-150 ease-out hover:scale-[1.01] relative cursor-pointer"
                              >
                                {/* Action Hover overlay */}
                                {(permissions.canUpdateClass || permissions.canDeleteClass) && <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 bg-white/95 backdrop-blur-sm p-1.5 rounded-xl">
                                  <Action
                                    permissionEdit="CLASS_UPDATE"
                                    permissionDelete="CLASS_DELETE"
                                    onEdit={() => {
                                      if (!permissions.canUpdateClass) return;
                                      setEditingClass({
                                        _id: cls.id,
                                        name: cls.name,
                                        year: cls.year,
                                        departmentId: selectedDept,
                                        degreeLevel: "Trung cấp",
                                        headquarters: cls.headquarters,
                                        teacherId: cls.user_id,
                                      });
                                      setIsClassPopupOpen(true);
                                    }}
                                    onDelete={() => {
                                      if (!permissions.canDeleteClass) return;
                                      setClassToDelete(cls);
                                      setIsClassDeleteModalOpen(true);
                                    }}
                                  />
                                </div>}

                                <div className="flex items-start justify-between">
                                  <div
                                    className={`px-[10px] py-[4px] rounded-[8px] text-[10px] font-bold uppercase tracking-wider ${
                                      cls.status === "Đang học"
                                        ? "bg-[#f0fdf4] text-[#16a34a]"
                                        : cls.status === "Sắp tốt nghiệp"
                                          ? "bg-[#fff7ed] text-[#ea580c]"
                                          : "bg-[#f9fafb] border border-[#e5e7eb] text-[#6b7280]"
                                    }`}
                                  >
                                    {cls.status}
                                  </div>
                                </div>

                                <div className="flex-1 mt-2">
                                  <h4
                                    className="text-[18px] font-bold text-[#1f2937] leading-[28px] line-clamp-1 group-hover:text-[#5519f0] transition-colors"
                                    title={cls.name}
                                  >
                                    {cls.name}
                                  </h4>
                                  <div className="flex items-center gap-[12px] text-[12px] text-[#9ca3af] mt-1 font-normal flex-wrap">
                                    <div className="flex items-center gap-[6px]">
                                      <CalendarIcon
                                        size={14}
                                        className="text-[#9ca3af]"
                                      />
                                      <span>{cls.year}</span>
                                    </div>
                                    {cls.headquarters && (
                                      <>
                                        <span>•</span>
                                        <span className="bg-slate-100 text-slate-650 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                          {cls.headquarters}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="pt-6 border-t border-gray-50 flex items-center justify-between mt-4">
                                  <div className="bg-[#eef2ff] px-[8px] py-[6px] rounded-[8px] flex items-center gap-[8px] text-[12px] font-bold text-[#4f46e5]">
                                    <Users
                                      size={14}
                                      className="text-[#4f46e5]"
                                    />
                                    <span>
                                      {cls.students}{" "}
                                      <span className="text-[#9ca3af] text-[10px] font-normal">
                                        học viên
                                      </span>
                                    </span>
                                  </div>

                                  {cls.avatars.length > 0 && (
                                    <div className="flex -space-x-2 pl-2">
                                      {cls.avatars.map((avatar, idx) => (
                                        <StudentAvatar
                                          key={avatar._id || idx}
                                          fullName={avatar.full_name}
                                          sizeClass="w-[28px] h-[28px] border-2 border-white shadow-sm hover:translate-y-[-2px] transition-transform cursor-pointer"
                                          textClassName="text-[10px]"
                                        />
                                      ))}
                                      {cls.extraStudents > 0 && (
                                        <div className="w-[28px] h-[28px] rounded-full border-2 border-white bg-[#f9fafb] flex items-center justify-center text-[8px] font-bold text-[#6b7280] shadow-sm shrink-0">
                                          +{cls.extraStudents}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      <ClassPopup
        isOpen={isClassPopupOpen && (editingClass?._id ? permissions.canUpdateClass : permissions.canCreateClass)}
        onClose={() => setIsClassPopupOpen(false)}
        initialData={editingClass}
        onSuccess={(data?: any) => {
          fetchDepartments();
          const isCreate = !editingClass?._id && !editingClass?.id;
          if (isCreate) {
            addNotification(
              'Lớp học mới được tạo',
              `Lớp học "${data?.class_name || 'Mới'}" vừa được khởi tạo thành công thuộc hệ đào tạo ${data?.class_type || 'Cao đẳng'}.`,
              'system',
              '/students'
            );
          }
        }}
      />
      <DepartmentPopup
        isOpen={isDeptPopupOpen}
        onClose={() => setIsDeptPopupOpen(false)}
        initialData={editingDept}
        onSuccess={(data?: any) => {
          fetchDepartments();
          const isCreate = !editingDept?._id;
          if (isCreate) {
            addNotification(
              'Khoa mới được tạo',
              `Khoa mới "${data?.name || 'Mới'}" (${data?.code || ''}) vừa được khởi tạo thành công trên hệ thống.`,
              'system',
              '/students'
            );
          }
        }}
      />
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeptToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Xác nhận xóa khoa"
        message={`Bạn có chắc chắn muốn xóa khoa ${deptToDelete?.name || ""}? Hành động này sẽ không thể hoàn tác.`}
        confirmLabel="Xóa khoa"
        cancelLabel="Hủy"
        variant="danger"
      />
      <ConfirmModal
        isOpen={isClassDeleteModalOpen}
        onClose={() => {
          setIsClassDeleteModalOpen(false);
          setClassToDelete(null);
        }}
        onConfirm={handleClassDeleteConfirm}
        title="Xác nhận xóa lớp học"
        message={`Bạn có chắc chắn muốn xóa lớp học ${classToDelete?.name || ""}? Tất cả sinh viên và tài khoản liên kết cũng sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa lớp"
        cancelLabel="Hủy"
        variant="danger"
      />

      <ImportClassPopup
        isOpen={isImportClassPopupOpen && permissions.canCreateClass}
        onClose={() => setIsImportClassPopupOpen(false)}
        onSuccess={() => {
          fetchDepartments();
        }}
      />
    </>
  );
}

export default function StudentsPage() {
  const { user } = useAuth();
  const userRole = String(user?.role || '').toLowerCase();
  const isStudent = userRole.includes('student') || userRole.includes('học sinh') || userRole.includes('sinh viên');

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-400">
          Loading student management...
        </div>
      }
    >
      {isStudent ? (
        <StudentsPageContent />
      ) : (
        <RouteGuard requiredPermission="STUDENT_PAGE">
          <StudentsPageContent />
        </RouteGuard>
      )}
    </Suspense>
  );
}
