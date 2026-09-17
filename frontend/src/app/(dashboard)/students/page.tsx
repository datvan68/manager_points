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
import { motion, AnimatePresence } from "framer-motion";
import StudentSectionTabs from "@/components/students/StudentSectionTabs";
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

  const renderClassCard = (
    cls: (typeof filteredClasses)[0],
    degreeLevel: "Cao đẳng" | "Trung cấp",
  ) => (
    <div
      key={cls.id}
      onClick={() => handleClassClick(cls.id)}
      className="group bg-white/55 backdrop-blur-md border border-white/80 rounded-xl p-3.5 md:p-4 flex flex-col justify-between shadow-xs shadow-slate-200/50 hover:shadow-md transition-all duration-150 ease-out hover:scale-[1.01] hover:bg-white/75 relative cursor-pointer min-h-[125px]"
    >
      {/* Action overlay: visible on hover (desktop) or always visible on touch/mobile */}
      {(permissions.canUpdateClass || permissions.canDeleteClass) && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 xl:opacity-0 xl:group-hover:opacity-100 max-xl:opacity-100 transition-opacity duration-150 z-10 bg-white/90 backdrop-blur-sm p-1 rounded-lg shadow-xs"
        >
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
                degreeLevel,
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
        </div>
      )}

      <div>
        {/* Row 1: Status badge + Headquarters tag */}
        <div className="flex items-center justify-between gap-2 pr-6">
          <div
            className={`px-2 py-0.5 rounded-md text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${
              cls.status === "Đang học"
                ? "bg-[#f0fdf4] text-[#16a34a]"
                : cls.status === "Sắp tốt nghiệp"
                  ? "bg-[#fff7ed] text-[#ea580c]"
                  : "bg-[#f9fafb] border border-[#e5e7eb] text-[#6b7280]"
            }`}
          >
            {cls.status}
          </div>
          {cls.headquarters && (
            <span className="bg-slate-100/90 text-slate-600 px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-semibold truncate max-w-[110px]">
              {cls.headquarters}
            </span>
          )}
        </div>

        {/* Row 2: Class Name */}
        <h4
          className="text-[15px] md:text-[16px] font-bold text-[#1f2937] leading-snug line-clamp-1 group-hover:text-[#5519f0] transition-colors mt-1.5"
          title={cls.name}
        >
          {cls.name}
        </h4>

        {/* Row 3: School Year */}
        <div className="flex items-center gap-1.5 text-[11px] md:text-[12px] text-slate-500 mt-1 font-normal">
          <CalendarIcon size={12} className="text-slate-400 shrink-0" />
          <span>{cls.year}</span>
        </div>
      </div>

      {/* Row 4 (Footer): Student Count & Avatars */}
      <div className="pt-2.5 border-t border-slate-100/80 flex items-center justify-between mt-2.5">
        <div className="bg-[#eef2ff] px-2 py-1 rounded-md flex items-center gap-1.5 text-[11px] md:text-[12px] font-bold text-[#4f46e5]">
          <Users size={13} className="text-[#4f46e5] shrink-0" />
          <span>
            {cls.students}{" "}
            <span className="text-slate-500 text-[10px] font-normal">
              học viên
            </span>
          </span>
        </div>

        {cls.avatars.length > 0 && (
          <div className="flex -space-x-1.5 pl-2 items-center">
            {cls.avatars.slice(0, 3).map((avatar, idx) => (
              <StudentAvatar
                key={avatar._id || idx}
                fullName={avatar.full_name}
                sizeClass="w-[22px] h-[22px] md:w-[24px] md:h-[24px] border-1.5 border-white shadow-xs"
                textClassName="text-[8px] md:text-[9px]"
              />
            ))}
            {cls.extraStudents > 0 && (
              <div className="w-[22px] h-[22px] md:w-[24px] md:h-[24px] rounded-full border-1.5 border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-600 shadow-xs shrink-0">
                +{cls.extraStudents}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <HeaderCustomMappings mappings={{ students: "Danh sách sinh viên" }} />
        <StudentSectionTabs activeTab="Danh sách" />
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
              </div>

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
              <div className="px-4 py-3 md:px-6 md:py-4 border-b border-white/50 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    {/* Hàng tiêu đề có nút Quay lại trên mobile */}
                    <div className="flex items-center gap-2 min-w-0">
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
                      <h2 className="text-[18px] md:text-[22px] font-bold text-[#1f2937] tracking-tight flex items-center gap-2 truncate">
                        <span className="truncate">Danh sách lớp</span>
                        <span className="text-[11px] md:text-[12px] font-bold text-[#4f46e5] bg-[#eef2ff] px-2 py-0.5 md:px-[10px] md:py-[2px] rounded-full shrink-0">
                          {filteredClasses.length} lớp
                        </span>
                      </h2>
                    </div>

                    <div className="flex items-center gap-1.5 text-[12px] md:text-[13px] text-slate-600 font-medium leading-tight truncate">
                      <School size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate">{currentDeptName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <Research
                      placeholder="Tìm tên lớp..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        scrollClassListToTop();
                      }}
                      containerClassName="flex-1 max-w-none sm:w-[170px] lg:w-[210px]"
                    />
                    {permissions.canCreateClass && (
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <Button
                          variant="outline"
                          onClick={() => setIsImportClassPopupOpen(true)}
                          className="flex items-center gap-1.5 px-2.5 sm:px-3.5 h-8.5 sm:h-9 border border-white/80 bg-white/50 backdrop-blur-sm hover:bg-white/70 hover:scale-[1.01] rounded-xl cursor-pointer text-xs font-semibold text-slate-700 shadow-xs shrink-0 transition-all duration-150 ease-out focus:outline-none"
                          title="Import lớp"
                        >
                          <Upload size={13} />
                          <span className="hidden sm:inline">Import lớp</span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingClass({ departmentId: selectedDept });
                            setIsClassPopupOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-2.5 sm:px-3.5 h-8.5 sm:h-9 border border-white/80 bg-white/50 backdrop-blur-sm hover:bg-white/70 hover:scale-[1.01] rounded-xl cursor-pointer text-xs font-semibold text-slate-700 shadow-xs shrink-0 transition-all duration-150 ease-out focus:outline-none"
                          title="Thêm lớp"
                        >
                          <Plus size={13} />
                          <span className="hidden sm:inline">Thêm lớp</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Class cards container */}
              <div
                ref={classListScrollRef}
                className="flex-1 overflow-y-auto px-3.5 sm:px-6 md:px-8 py-3.5 sm:py-4 bg-transparent scrollbar-hover pb-24 md:pb-6"
              >
                <div className="flex flex-col gap-3.5 w-full">
                  {isLoading || isDataLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="bg-white/60 rounded-xl border border-white/70 p-3.5 md:p-4 flex flex-col justify-between h-[125px]"
                        >
                          <div>
                            <Skeleton className="w-14 h-4 mb-2" />
                            <Skeleton className="w-3/4 h-5 mb-1.5" />
                            <Skeleton className="w-1/2 h-3.5" />
                          </div>
                          <div className="pt-2.5 border-t border-slate-100/80 flex items-center justify-between">
                            <Skeleton className="w-16 h-4" />
                            <div className="flex -space-x-1 pl-2">
                              <Skeleton className="w-5 h-5 rounded-full" />
                              <Skeleton className="w-5 h-5 rounded-full" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {/* Cao đẳng Section */}
                      <div className="flex flex-col gap-2.5 w-full">
                        <div className="flex items-center justify-between w-full py-0.5">
                          <div className="flex flex-1 items-center gap-2">
                            <span className="text-[12px] md:text-[13px] font-bold text-slate-600 tracking-wide uppercase">
                              Hệ Cao đẳng
                            </span>
                            <span className="text-[11px] font-semibold text-slate-400">
                              ({caoDangClasses.length})
                            </span>
                            <div className="flex-1 h-px bg-slate-200/60 ml-2" />
                          </div>
                          <button
                            onClick={() => {
                              setIsCaoDangExpanded(!isCaoDangExpanded);
                              scrollClassListToTop();
                            }}
                            className="p-1 hover:bg-white/60 active:bg-white/80 rounded-lg text-slate-400 hover:text-slate-650 transition-colors ml-2"
                            title={isCaoDangExpanded ? "Thu gọn" : "Mở rộng"}
                          >
                            <ChevronDown
                              size={16}
                              className={`transition-transform duration-200 ${isCaoDangExpanded ? "" : "rotate-180"}`}
                            />
                          </button>
                        </div>

                        {isCaoDangExpanded && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                            {caoDangClasses.map((cls) =>
                              renderClassCard(cls, "Cao đẳng"),
                            )}

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
                                className="border-2 border-dashed border-white/80 bg-white/30 backdrop-blur-md hover:border-white hover:bg-white/50 rounded-xl flex flex-col items-center justify-center p-3.5 py-4 cursor-pointer hover:scale-[1.01] transition-all duration-150 ease-out group min-h-[125px]"
                              >
                                <div className="w-9 h-9 rounded-full bg-white border border-[#f3f4f6] group-hover:border-[#5519f0]/20 flex items-center justify-center text-gray-400 group-hover:text-[#5519f0] shadow-xs transition-all group-hover:scale-110">
                                  <Plus size={16} strokeWidth={2.5} />
                                </div>
                                <span className="text-[12px] md:text-[13px] font-bold text-[#6b7280] group-hover:text-[#5519f0] transition-colors mt-2">
                                  Thêm lớp học mới
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Trung cấp Section */}
                      <div className="flex flex-col gap-2.5 w-full mt-1">
                        <div className="flex items-center justify-between w-full py-0.5">
                          <div className="flex flex-1 items-center gap-2">
                            <span className="text-[12px] md:text-[13px] font-bold text-slate-600 tracking-wide uppercase">
                              Hệ Trung cấp
                            </span>
                            <span className="text-[11px] font-semibold text-slate-400">
                              ({trungCapClasses.length})
                            </span>
                            <div className="flex-1 h-px bg-slate-200/60 ml-2" />
                          </div>
                          <button
                            onClick={() => {
                              setIsTrungCapExpanded(!isTrungCapExpanded);
                              scrollClassListToTop();
                            }}
                            className="p-1 hover:bg-white/60 active:bg-white/80 rounded-lg text-slate-400 hover:text-slate-650 transition-colors ml-2"
                            title={isTrungCapExpanded ? "Thu gọn" : "Mở rộng"}
                          >
                            <ChevronDown
                              size={16}
                              className={`transition-transform duration-200 ${isTrungCapExpanded ? "" : "rotate-180"}`}
                            />
                          </button>
                        </div>

                        {isTrungCapExpanded && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                            {trungCapClasses.length === 0 ? (
                              <p className="col-span-full py-3 text-center text-xs text-slate-400 italic">
                                Chưa có lớp Trung cấp nào trong khoa này
                              </p>
                            ) : (
                              trungCapClasses.map((cls) =>
                                renderClassCard(cls, "Trung cấp"),
                              )
                            )}
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
