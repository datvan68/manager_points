'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import {
    Search,
    Plus,
    MoreHorizontal,
    Users,
    ArrowLeft,
    Download,
    Trash2,
    Edit,
    X,
    User,
    ArrowRightLeft,
    Loader2,
    ExternalLink,
    Compass,
    CheckCircle,
    Key,
    ShieldAlert,
    ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { classApi, Class } from '@/api/class-api';
import { studentApi, Student } from '@/api/student-api';
import { authApi, tokenStorage } from '@/api/auth-api';
import { semesterApi } from '@/api/semester-api';
import { summariesPointApi } from '@/api/summaries-point-api';
import { resolveDrlScore } from '@/lib/drl-score';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer';
import StudentPopup from '@/components/popups/StudentPopup';
import ImportStudentPopup from '@/components/popups/ImportStudentPopup';
import Action from '@/components/ui/Action';
import { RouteGuard, usePermission } from '@/components/guards/RouteGuard';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { StudentAvatar } from '@/components/ui/StudentAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomPagination } from '@/components/ui/pagination';
import FloatingActionBar from '@/components/ui/FloatingActionBar';
import ResponsiveDataView, { ResponsiveColumn } from '@/components/ui/ResponsiveDataView';


function ClassStudentsPageContent() {
    const router = useRouter();
    const params = useParams();
    const classId = params.classId as string;
    const permissions = usePermission({
        canCreateStudent: 'STUDENT_CREATE',
        canImportStudent: 'STUDENT_IMPORT',
        canExportStudent: 'STUDENT_EXPORT',
        canActivateStudentAccount: 'STUDENT_ACCOUNT_ACTIVATE',
        canResetStudentPassword: 'STUDENT_ACCOUNT_RESET_PASSWORD',
        canTransferStudent: 'STUDENT_TRANSFER',
        canUpdateStudent: 'STUDENT_UPDATE',
        canDeleteStudent: 'STUDENT_DELETE',
    });


    const [activeTab, setActiveTab] = useState('Tất cả');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isStudentPopupOpen, setIsStudentPopupOpen] = useState(false);
    const [isImportPopupOpen, setIsImportPopupOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<any>(null);
    const [openDrawerId, setOpenDrawerId] = useState<string | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        variant: 'danger' | 'warning' | 'info' | 'success';
        confirmLabel?: string;
    }>({
        title: '',
        message: '',
        onConfirm: () => { },
        variant: 'danger',
    });
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDataLoading, setIsDataLoading] = useState(false);

    const [hasMoreStudents, setHasMoreStudents] = useState(true);
    const [isLoadingMoreStudents, setIsLoadingMoreStudents] = useState(false);
    const [loadMoreError, setLoadMoreError] = useState('');
    const studentsObserverTargetRef = React.useRef<HTMLDivElement | null>(null);
    const mobileScrollRootRef = React.useRef<HTMLDivElement | null>(null);
    const loadingMoreRef = React.useRef(false);

    const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
    useEffect(() => {
        const checkIsMobile = () => setIsMobileOrTablet(window.innerWidth < 1024);
        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    // States cho Drawer sinh viên lấy từ API
    const [drawerStudent, setDrawerStudent] = useState<Student | null>(null);
    const [isDrawerLoading, setIsDrawerLoading] = useState(false);

    const [selectedClass, setSelectedClass] = useState<Class | null>(null);
    const [studentsList, setStudentsList] = useState<Student[]>([]);
    const [totalStudents, setTotalStudents] = useState(0);
    const [summaryMap, setSummaryMap] = useState<Map<string, any>>(new Map());
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Tải thông tin lớp học
    useEffect(() => {
        classApi.getClass(classId)
            .then(setSelectedClass)
            .catch(err => console.error('Lỗi khi tải thông tin lớp học:', err));
    }, [classId]);

    const mapTabToStatus = (tab: string) => {
        switch (tab) {
            case 'Đang học':
                return 'Studying';
            case 'Bảo lưu':
                return 'Reserved';
            case 'Thôi học':
                return 'Dropped';
            default:
                return undefined;
        }
    };

    // Tải danh sách sinh viên thực tế theo lớp học
    const loadStudentsData = async (pageToFetch = 1, append = false) => {
        if (!append) {
             setIsDataLoading(true);
        } else {
             setIsLoadingMoreStudents(true);
        }
        try {
            const semesters = await semesterApi.getSemesters();
            const activeSemester = semesters.find(s => s.status === 'active');
            const activeSemesterId = activeSemester?._id;

            const apiParams = {
                classId,
                page: pageToFetch,
                limit: itemsPerPage,
                search: debouncedSearchTerm.trim() || undefined,
                status: mapTabToStatus(activeTab)
            };

            const studentsRes = await studentApi.getStudents(apiParams);

            let studentsData: Student[] = [];
            let total = 0;

            if (studentsRes && 'data' in studentsRes) {
                studentsData = studentsRes.data;
                total = studentsRes.meta?.total ?? studentsRes.data.length;
            } else if (Array.isArray(studentsRes)) {
                studentsData = studentsRes;
                total = studentsRes.length;
            }

            const studentIds = studentsData.map(s => s._id);
            let summariesData: any[] = [];

            if (studentIds.length > 0 && activeSemesterId) {
                const summariesRes = await summariesPointApi.getSummariesPoints({
                    studentIds,
                    semesterId: activeSemesterId,
                    limit: studentIds.length
                });
                summariesData = summariesRes?.data || [];
            }

            setSummaryMap(prevMap => {
                const newMap = new Map<string, any>(append ? prevMap : undefined);
                summariesData.forEach((item: any) => {
                    const studentId = typeof item.student_id === 'object' ? item.student_id?._id : item.student_id;
                    if (studentId) {
                        newMap.set(studentId, item);
                    }
                });
                return newMap;
            });

            if (append) {
                setStudentsList(prev => {
                    const existingIds = new Set(prev.map(s => s._id));
                    const newStudents = studentsData.filter(s => !existingIds.has(s._id));
                    return [...prev, ...newStudents];
                });
            } else {
                setStudentsList(studentsData);
            }
            
            setTotalStudents(total);
            
            if (studentsRes && 'meta' in studentsRes && studentsRes.meta?.totalPages !== undefined) {
                 setHasMoreStudents(pageToFetch < studentsRes.meta.totalPages);
            } else {
                 setHasMoreStudents(studentsData.length >= itemsPerPage);
            }
            setLoadMoreError('');
        } catch (err: any) {
            console.error('Lỗi khi tải danh sách sinh viên và điểm rèn luyện:', err);
            if (append) {
                setLoadMoreError('Lỗi khi tải thêm dữ liệu');
            } else {
                toast.error('Không thể tải danh sách sinh viên hoặc điểm rèn luyện từ server');
            }
        } finally {
            setIsDataLoading(false);
            setIsLoadingMoreStudents(false);
            setIsLoading(false);
            loadingMoreRef.current = false;
        }
    };

    const fetchStudents = () => {
        if (currentPage === 1) {
            loadStudentsData(1, false);
        } else {
            setCurrentPage(1);
        }
    };

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Lắng nghe thay đổi của các filter/phân trang để fetch lại
    useEffect(() => {
        const isAppend = isMobileOrTablet && currentPage > 1 && loadingMoreRef.current;
        loadStudentsData(currentPage, isAppend);
    }, [classId, currentPage, itemsPerPage, activeTab, debouncedSearchTerm]);

    // Infinite scroll observer
    useEffect(() => {
        if (!isMobileOrTablet || !hasMoreStudents) return;
        if (isLoading || isDataLoading || isLoadingMoreStudents) return;

        const root = mobileScrollRootRef.current;
        const target = studentsObserverTargetRef.current;
        if (!root || !target) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (!entry?.isIntersecting) return;
            if (loadingMoreRef.current) return;

            loadingMoreRef.current = true;
            setCurrentPage(prev => prev + 1);
        }, {
            root,
            rootMargin: '400px 0px',
            threshold: 0,
        });

        observer.observe(target);
        return () => observer.disconnect();
    }, [isMobileOrTablet, hasMoreStudents, isLoading, isDataLoading, isLoadingMoreStudents]);

    // Tự động tải thông tin chi tiết sinh viên từ API khi mở Drawer
    useEffect(() => {
        if (!openDrawerId) {
            setDrawerStudent(null);
            return;
        }

        const fetchDrawerStudent = async () => {
            setIsDrawerLoading(true);
            try {
                const data = await studentApi.getStudent(openDrawerId);
                setDrawerStudent(data);
            } catch (err: any) {
                console.error('Lỗi khi tải chi tiết sinh viên:', err);
                toast.error('Không thể tải thông tin chi tiết sinh viên');
                setOpenDrawerId(null);
            } finally {
                setIsDrawerLoading(false);
            }
        };

        fetchDrawerStudent();
    }, [openDrawerId]);



    // Reset về trang 1 khi tìm kiếm, lọc hoặc đổi số lượng phần tử mỗi trang
    useEffect(() => {
        setCurrentPage(1);
        if (isMobileOrTablet) {
            setStudentsList([]);
        }
        setHasMoreStudents(true);
        setLoadMoreError('');
        loadingMoreRef.current = false;
        setSelectedStudentIds([]);
    }, [debouncedSearchTerm, activeTab, itemsPerPage, classId]);

    // Định dạng ngày sinh YYYY-MM-DD sang DD/MM/YYYY
    const formatDob = (dobString?: string) => {
        if (!dobString) return '';
        const date = new Date(dobString);
        if (isNaN(date.getTime())) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Ánh xạ trạng thái từ backend sang hiển thị
    const getVietnameseStatus = (status: string) => {
        switch (status) {
            case 'Studying':
                return 'Đang học';
            case 'Reserved':
                return 'Bảo lưu';
            case 'Dropped':
            case 'Suspended':
                return 'Thôi học';
            case 'Graduated':
                return 'Tốt nghiệp';
            default:
                return 'Đang học';
        }
    };

    const paginatedStudents = studentsList;

    const toggleStudentSelection = (id: string) => {
        setSelectedStudentIds(prev =>
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedStudentIds.length === paginatedStudents.length) {
            setSelectedStudentIds([]);
        } else {
            setSelectedStudentIds(paginatedStudents.map(s => s._id));
        }
    };

    const handleExport = () => {
        toast.success(`Đã xuất file ${selectedStudentIds.length} sinh viên thành công.`);
    };

    const handleResetPassword = async (studentId: string, fullName: string) => {
        setConfirmConfig({
            title: "Reset mật khẩu",
            message: `Bạn có chắc chắn muốn đặt lại mật khẩu cho sinh viên ${fullName} về mặc định (ngày sinh ddmmyyyy) không? Hành động này sẽ thu hồi toàn bộ các phiên làm việc hiện tại của sinh viên.`,
            variant: 'warning',
            confirmLabel: 'Reset mật khẩu',
            onConfirm: async () => {
                setIsDataLoading(true);
                try {
                    const updatedStudent = await studentApi.resetStudentPassword(studentId);
                    toast.success(`Đặt lại mật khẩu cho sinh viên ${fullName} thành công về mặc định (ngày sinh ddmmyyyy).`);
                    setDrawerStudent(updatedStudent);
                    fetchStudents();
                } catch (err: any) {
                    console.error("Lỗi khi reset mật khẩu sinh viên:", err);
                    toast.error(err.message || "Không thể đặt lại mật khẩu sinh viên.");
                } finally {
                    setIsDataLoading(false);
                }
            }
        });
        setIsConfirmOpen(true);
    };

    const handleActivateSingle = async (studentId: string, fullName: string) => {
        setIsDataLoading(true);
        try {
            const updatedStudent = await studentApi.activateStudent(studentId);
            toast.success(`Đã kích hoạt tài khoản đăng nhập cho sinh viên ${fullName} thành công.`);
            setDrawerStudent(updatedStudent);
            fetchStudents();
        } catch (err: any) {
            console.error("Lỗi khi kích hoạt tài khoản sinh viên:", err);
            toast.error(err.message || "Không thể kích hoạt tài khoản sinh viên.");
        } finally {
            setIsDataLoading(false);
        }
    };

    const handleLockAccount = async (studentId: string, fullName: string) => {
        setConfirmConfig({
            title: "Khóa tài khoản",
            message: `Bạn có chắc chắn muốn KHÓA tài khoản đăng nhập của sinh viên ${fullName} không? Sinh viên sẽ bị đăng xuất khỏi tất cả thiết bị và không thể đăng nhập lại.`,
            variant: 'danger',
            confirmLabel: 'Khóa tài khoản',
            onConfirm: async () => {
                setIsDataLoading(true);
                try {
                    const updatedStudent = await studentApi.lockStudent(studentId);
                    toast.success(`Đã khóa tài khoản đăng nhập của sinh viên ${fullName} thành công.`);
                    setDrawerStudent(updatedStudent);
                    fetchStudents();
                } catch (err: any) {
                    console.error("Lỗi khi khóa tài khoản sinh viên:", err);
                    toast.error(err.message || "Không thể khóa tài khoản sinh viên.");
                } finally {
                    setIsDataLoading(false);
                }
            }
        });
        setIsConfirmOpen(true);
    };

    const handleUnlockAccount = async (studentId: string, fullName: string) => {
        setIsDataLoading(true);
        try {
            const updatedStudent = await studentApi.unlockStudent(studentId);
            toast.success(`Đã mở khóa tài khoản đăng nhập của sinh viên ${fullName} thành công.`);
            setDrawerStudent(updatedStudent);
            fetchStudents();
        } catch (err: any) {
            console.error("Lỗi khi mở khóa tài khoản sinh viên:", err);
            toast.error(err.message || "Không thể mở khóa tài khoản sinh viên.");
        } finally {
            setIsDataLoading(false);
        }
    };

    const handleActivateAccounts = async () => {
        if (selectedStudentIds.length === 0) return;
        setIsDataLoading(true);

        try {
            const result = await studentApi.bulkActivateStudents(selectedStudentIds);
            
            if (result.success > 0) {
                toast.success(`Đã kích hoạt thành công tài khoản cho ${result.success}/${result.total} sinh viên.`);
            }
            const failed = result.total - result.success;
            if (failed > 0) {
                toast.error(`Kích hoạt thất bại cho ${failed} sinh viên.`);
            }
            
            // Tải lại danh sách sinh viên
            fetchStudents();
            setSelectedStudentIds([]);
        } catch (error: any) {
            console.error("Lỗi trong quá trình kích hoạt tài khoản:", error);
            toast.error(error.message || "Đã xảy ra lỗi hệ thống khi kích hoạt tài khoản.");
        } finally {
            setIsDataLoading(false);
        }
    };

    // Xóa danh sách sinh viên được chọn (Xóa hàng loạt)
    const handleDelete = () => {
        if (selectedStudentIds.length === 0) return;
        setConfirmConfig({
            title: 'Xác nhận xóa nhiều sinh viên',
            message: `Bạn có chắc chắn muốn xóa ${selectedStudentIds.length} sinh viên đã chọn? Hành động này sẽ không thể hoàn tác.`,
            variant: 'danger',
            confirmLabel: 'Xóa sinh viên',
            onConfirm: async () => {
                setIsDataLoading(true);
                try {
                    await Promise.all(selectedStudentIds.map(id => studentApi.deleteStudent(id)));
                    toast.success(`Đã xóa ${selectedStudentIds.length} sinh viên thành công.`);
                    setSelectedStudentIds([]);
                    fetchStudents();
                } catch (err: any) {
                    console.error('Lỗi khi xóa nhiều sinh viên:', err);
                    toast.error('Một hoặc nhiều sinh viên không thể xóa');
                } finally {
                    setIsDataLoading(false);
                }
            }
        });
        setIsConfirmOpen(true);
    };

    // Xóa sinh viên đơn lẻ
    const handleDeleteSingle = (id: string, name: string) => {
        setConfirmConfig({
            title: 'Xác nhận xóa sinh viên',
            message: `Bạn có chắc chắn muốn xóa sinh viên ${name}? Hành động này sẽ không thể hoàn tác.`,
            variant: 'danger',
            confirmLabel: 'Xóa sinh viên',
            onConfirm: async () => {
                setIsDataLoading(true);
                try {
                    await studentApi.deleteStudent(id);
                    toast.success(`Đã xóa sinh viên ${name} thành công.`);
                    setOpenDrawerId(null);
                    fetchStudents();
                } catch (err: any) {
                    console.error('Lỗi khi xóa sinh viên:', err);
                    toast.error(err.message || 'Xóa sinh viên thất bại');
                } finally {
                    setIsDataLoading(false);
                }
            }
        });
        setIsConfirmOpen(true);
    };

    // Mở popup chỉnh sửa sinh viên
    const handleEditStudent = (student: Student) => {
        const classVal = typeof student.class_id === 'object' ? (student.class_id as any)?._id : student.class_id;
        const deptVal = typeof student.class_id === 'object'
            ? (typeof (student.class_id as any)?.dept_id === 'object' ? (student.class_id as any)?.dept_id?._id : (student.class_id as any)?.dept_id)
            : '';

        let dobString = '';
        if (student.date_bir) {
            const dateObj = new Date(student.date_bir);
            if (!isNaN(dateObj.getTime())) {
                dobString = dateObj.toISOString().split('T')[0];
            }
        }

        setEditingStudent({
            _id: student._id,
            studentId: student.student_code,
            fullName: student.full_name,
            dob: dobString,
            gender: student.sex === 'Male' ? 'Nam' : 'Nữ',
            email: student.email || '',
            phone: '',
            department: deptVal || '',
            classId: classVal || '',
            status: student.status || 'Studying',
        });
        setIsStudentPopupOpen(true);
    };

    const studentsColumns: ResponsiveColumn<Student>[] = [
        {
            key: 'student_code',
            header: 'MÃ SV',
            priority: 'secondary',
            className: 'font-mono text-[14px] text-[#64748B]',
            render: (val) => val
        },
        {
            key: 'full_name',
            header: 'HỌ VÀ TÊN',
            priority: 'primary',
            render: (_, student) => (
                <div className="flex items-center gap-[12px]">
                    <StudentAvatar fullName={student.full_name} sizeClass="w-[36px] h-[36px]" />
                    <div>
                        <div className="font-semibold text-[14px] text-[#1E293B]">{student.full_name}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'date_bir',
            header: 'NGÀY SINH',
            priority: 'metadata',
            className: 'text-[14px] text-[#64748B]',
            render: (_, student) => formatDob(student.date_bir)
        },
        {
            key: 'sex',
            header: 'GIỚI TÍNH',
            priority: 'metadata',
            className: 'text-[14px] text-[#64748B]',
            render: (val) => val === 'Male' ? 'Nam' : val === 'Female' ? 'Nữ' : 'Khác'
        },
        {
            key: 'training_point_id',
            header: 'ĐRL',
            priority: 'metadata',
            render: (_, student) => {
                const resolvedScore = resolveDrlScore(summaryMap.get(student._id)) ?? resolveDrlScore(student.training_point_id);
                const vScore = resolvedScore !== null ? `${resolvedScore}` : 'N/A';
                return (
                    <div className="flex items-center gap-[4px] font-bold">
                        <span className="text-[14px] text-[#1E293B]">{vScore}</span>
                        {vScore !== 'N/A' && <span className="text-[10px] text-[#64748B] font-normal">/100</span>}
                    </div>
                );
            }
        },
        {
            key: 'status',
            header: 'TRẠNG THÁI',
            priority: 'metadata',
            render: (val) => {
                const vStatus = getVietnameseStatus(val);
                return (
                    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-xl font-bold text-[12px] border ${vStatus === 'Đang học' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' :
                        vStatus === 'Bảo lưu' ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' :
                            'bg-rose-500/10 text-rose-700 border-rose-500/20'
                        }`}>
                        {vStatus}
                    </span>
                );
            }
        },
        {
            key: 'account_status',
            header: 'TÀI KHOẢN',
            priority: 'metadata',
            render: (val) => (
                <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-xl font-bold text-[12px] border ${val === 'active' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' :
                    val === 'locked' ? 'bg-rose-500/10 text-rose-700 border-rose-500/20' :
                        'bg-slate-500/10 text-[#64748B] border border-slate-500/20'
                    }`}>
                    {val === 'active' ? 'Đã kích hoạt' :
                        val === 'locked' ? 'Đang khóa' : 'Chưa active'}
                </span>
            )
        },
        {
            key: 'actions',
            header: 'HÀNH ĐỘNG',
            priority: 'action',
            className: 'text-right',
            render: (_, student) => (
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Action
                        onView={() => setOpenDrawerId(student._id)}
                        onEdit={() => handleEditStudent(student)}
                        onDelete={() => handleDeleteSingle(student._id, student.full_name)}
                        permissionView="STUDENT_READ"
                        permissionEdit="STUDENT_UPDATE"
                        permissionDelete="STUDENT_DELETE"
                    />
                </div>
            )
        }
    ];

    return (
        <div className="flex bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] h-screen overflow-hidden font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 h-full relative">
                <Header customMappings={{ [classId]: selectedClass ? selectedClass.class_name : classId }} />
                <main className="flex-1 p-4 overflow-hidden flex flex-col bg-transparent relative">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                        className="flex-1 flex flex-col h-full bg-white/45 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm shadow-slate-300/40 overflow-hidden"
                    >
                        <div className="px-6 py-4 bg-transparent border-b border-white/60 flex items-center justify-between shrink-0 relative overflow-hidden">
                            <div className="absolute top-0 right-0 bottom-0 w-64 bg-gradient-to-l from-blue-500/5 to-transparent pointer-events-none" />
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4 z-10 w-full max-w-screen-2xl mx-auto">
                                <div className="flex items-center gap-4 flex-1">
                                    <button
                                        onClick={() => router.push('/students')}
                                        className="flex items-center gap-1.5 text-gray-900 hover:text-primary transition-colors font-bold text-[16px] shrink-0"
                                    >
                                        <ArrowLeft className="w-5 h-5" /> {selectedClass ? selectedClass.class_name : 'Lớp học'}
                                    </button>

                                    <div className="hidden md:flex items-center gap-3">
                                         <div className="flex items-center gap-1.5 px-[10px] py-[4.5px] bg-blue-500/10 text-[#1A73E8] border border-blue-500/20 rounded-xl text-[11px] font-bold uppercase tracking-wider shrink-0 select-none">
                                             <Users className="w-3.5 h-3.5 text-[#1A73E8]" />
                                             <span>Sĩ số: {totalStudents} sinh viên</span>
                                         </div>
                                         <div className="flex items-center gap-1.5 px-[10px] py-[4.5px] bg-white/60 text-[#64748B] border border-white/80 rounded-xl text-[11px] font-bold uppercase tracking-wider shrink-0 select-none">
                                             <User className="w-3.5 h-3.5 text-[#64748B]" />
                                             <span>GVCN: {selectedClass?.user_id?.user_name || 'Chưa phân công'}</span>
                                         </div>
                                         {selectedClass?.headquarters && (
                                             <div className="flex items-center gap-1.5 px-[10px] py-[4.5px] bg-purple-500/10 text-purple-700 border border-purple-500/20 rounded-xl text-[11px] font-bold uppercase tracking-wider shrink-0 select-none">
                                                 <Compass className="w-3.5 h-3.5 text-purple-700" />
                                                 <span>Trụ sở: {selectedClass.headquarters}</span>
                                             </div>
                                         )}
                                    </div>
                                </div>

                                <div className="flex-1" />
                                {permissions.canImportStudent && (
                                <button
                                    onClick={() => setIsImportPopupOpen(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] font-bold text-[#64748B] border border-white/80 bg-white/50 backdrop-blur-sm hover:bg-white/70 hover:text-[#1E293B] rounded-xl shadow-sm transition-all duration-150 ease-out hover:scale-[1.01] z-10 whitespace-nowrap cursor-pointer"
                                >
                                    <Download className="w-4 h-4" /> Import
                                </button>
                                )}
                                {permissions.canCreateStudent && (
                                <button
                                    onClick={() => { setEditingStudent(null); setIsStudentPopupOpen(true); }}
                                    className="flex items-center gap-2 px-4 py-2 text-[12.5px] font-bold text-white bg-[#1A73E8] hover:bg-[#1557b0] rounded-xl shadow-sm transition-all duration-150 ease-out hover:scale-[1.01] z-10 whitespace-nowrap border-none cursor-pointer"
                                >
                                    <Plus className="w-4 h-4" /> Thêm sinh viên
                                </button>
                                )}
                            </div>
                        </div>

                        {/* Filter Bar */}
                        <div className="px-6 py-2.5 bg-white/30 backdrop-blur-sm border border-white/60 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 rounded-xl my-1.5 w-full max-w-screen-2xl mx-auto">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                                <div className="relative w-full sm:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] w-[14px] h-[14px]" />
                                    <input
                                        type="text"
                                        placeholder="Tìm theo tên hoặc mã SV..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-4 py-1.5 bg-white/50 border border-white/80 backdrop-blur-sm rounded-xl text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/20 focus:bg-white/80 transition-all h-[33px] font-semibold text-[#1E293B] placeholder-[#64748B]"
                                    />
                                </div>

                                {selectedStudentIds.length > 0 && permissions.canDeleteStudent && (
                                    <button
                                        onClick={handleDelete}
                                        disabled={isDataLoading}
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#ef4444] bg-[#fef2f2] border border-[#ef4444]/30 rounded-lg hover:bg-red-100/50 hover:border-[#ef4444] transition-all disabled:opacity-50 shrink-0 select-none h-[33px] cursor-pointer"
                                    >
                                        {isDataLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                        Xóa ({selectedStudentIds.length})
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2 items-center min-h-[41px]">
                                <span className="text-[12px] font-semibold text-[#64748B]">Trạng thái:</span>
                                <div className="flex flex-wrap gap-1 items-center bg-transparent">
                                    {['Tất cả', 'Đang học', 'Bảo lưu', 'Thôi học'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => setActiveTab(status)}
                                            className={`px-3 py-1.5 text-[12px] transition-all rounded-xl ${activeTab === status
                                                ? 'bg-white/70 text-[#1A73E8] border border-white/80 shadow-sm font-bold cursor-pointer'
                                                : 'text-[#64748B] border border-transparent font-medium hover:text-[#1E293B] hover:bg-white/40 cursor-pointer'
                                                }`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Student Table */}
                        <div className="flex-1 overflow-hidden bg-transparent max-w-screen-2xl w-full mx-auto relative flex flex-col mb-4">
                            <ResponsiveDataView
                                data={paginatedStudents}
                                columns={studentsColumns}
                                isLoading={isLoading || (isDataLoading && !isLoadingMoreStudents)}
                                mobileScrollRef={mobileScrollRootRef}
                                mobileFooter={isMobileOrTablet && paginatedStudents.length > 0 ? (
                                    <div ref={studentsObserverTargetRef} className="py-4 text-center text-xs text-slate-500">
                                        {loadMoreError ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="text-red-500">{loadMoreError}</span>
                                                <button onClick={() => { setLoadMoreError(''); loadStudentsData(currentPage, true); }} className="px-3 py-1 bg-white border border-slate-200 rounded-lg">Thử lại</button>
                                            </div>
                                        ) : isLoadingMoreStudents ? (
                                            <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải thêm sinh viên...</span>
                                        ) : hasMoreStudents ? (
                                            'Kéo xuống để tải thêm'
                                        ) : (
                                            'Đã tải hết sinh viên'
                                        )}
                                    </div>
                                ) : null}
                                emptyState={
                                    <div className="text-center py-12 text-gray-400 text-sm font-semibold">
                                        Không tìm thấy sinh viên nào trong lớp này.
                                    </div>
                                }
                                keyExtractor={(student) => student._id}
                                selection={{
                                    selectedKeys: selectedStudentIds,
                                    onSelectRow: (key, checked) => {
                                        if (checked) {
                                            setSelectedStudentIds(prev => [...prev, key]);
                                        } else {
                                            setSelectedStudentIds(prev => prev.filter(id => id !== key));
                                        }
                                    },
                                    onSelectAll: (checked) => {
                                        if (checked) {
                                            setSelectedStudentIds(paginatedStudents.map(s => s._id));
                                        } else {
                                            setSelectedStudentIds([]);
                                        }
                                    },
                                    allSelected: paginatedStudents.length > 0 && selectedStudentIds.length === paginatedStudents.length
                                }}
                                onRowClick={(student) => setOpenDrawerId(student._id)}
                                hidePaginationOnMobile={true}
                                pagination={!isMobileOrTablet ? (
                                    <CustomPagination
                                        currentPage={currentPage}
                                        pageSize={itemsPerPage}
                                        totalItems={totalStudents}
                                        onPageChange={(page) => setCurrentPage(page)}
                                        onPageSizeChange={setItemsPerPage}
                                        label="sinh viên"
                                        isLoading={isDataLoading}
                                        className="shadow-none border-none rounded-none bg-transparent"
                                    />
                                ) : null}
                            />
                        </div>
                    </motion.div>
                </main>
            </div>
            <StudentPopup
                isOpen={isStudentPopupOpen}
                onClose={() => setIsStudentPopupOpen(false)}
                initialData={editingStudent}
                defaultClassId={classId}
                onSuccess={fetchStudents}
            />
            <ImportStudentPopup
                isOpen={isImportPopupOpen}
                onClose={() => setIsImportPopupOpen(false)}
                classId={classId}
                onSuccess={fetchStudents}
            />
            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                variant={confirmConfig.variant}
                confirmLabel={confirmConfig.confirmLabel}
                cancelLabel="Hủy"
            />

            {/* Drawer dùng chung để hiển thị chi tiết thông tin sinh viên từ API */}
            <Drawer
                direction="right"
                open={openDrawerId !== null}
                onOpenChange={(isOpen) => setOpenDrawerId(isOpen ? openDrawerId : null)}
            >
                <DrawerContent className="w-full sm:w-[448px] h-full bg-white/80 backdrop-blur-xl border-l border-white/80 outline-none flex flex-col items-stretch overflow-hidden">
                    <div className="flex justify-between items-center p-6 border-b border-white/60 bg-transparent shrink-0">
                        <div className="flex items-center gap-3">
                            <DrawerTitle className="text-lg font-semibold text-[#1E293B]">Thông tin sinh viên</DrawerTitle>
                            {!isDrawerLoading && drawerStudent && (
                                <button
                                    onClick={() => {
                                        setOpenDrawerId(null);
                                        router.push(`/students/${classId}/${drawerStudent._id}`);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-[#1A73E8] bg-blue-500/10 hover:bg-blue-500/20 rounded-xl transition-all duration-150 border border-blue-500/20 hover:scale-[1.01]"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Chi tiết</span>
                                </button>
                            )}
                        </div>
                        <DrawerDescription className="sr-only">Thông tin chi tiết về sinh viên được chọn.</DrawerDescription>
                        <DrawerClose asChild>
                            <button className="w-7 h-7 flex justify-center items-center text-[#64748B] hover:text-[#1E293B] hover:bg-white/50 rounded-xl transition-all duration-150 ease-out hover:scale-[1.01]">
                                <X className="w-5 h-5" />
                            </button>
                        </DrawerClose>
                    </div>

                    {isDrawerLoading || !drawerStudent ? (
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 animate-pulse">
                            <div className="flex items-center gap-4 bg-white/40 border border-white/85 rounded-2xl p-4">
                                <Skeleton className="w-16 h-16 rounded-full shrink-0" />
                                <div className="flex-1 flex flex-col gap-2">
                                    <Skeleton className="w-48 h-6 rounded-md" />
                                    <Skeleton className="w-32 h-4 rounded-md" />
                                </div>
                            </div>

                            <div className="flex flex-col gap-4 bg-white/40 border border-white/80 rounded-xl p-4">
                                <Skeleton className="w-24 h-4 rounded-md mb-2" />
                                <div className="flex justify-between"><Skeleton className="w-20 h-4 rounded" /><Skeleton className="w-32 h-4 rounded" /></div>
                                <div className="flex justify-between"><Skeleton className="w-20 h-4 rounded" /><Skeleton className="w-16 h-4 rounded" /></div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-hover">
                            {/* Profile Header Card */}
                            <div className="flex items-center gap-4 bg-white/40 border border-white/85 rounded-2xl p-4 shadow-sm shadow-slate-200/50">
                                <StudentAvatar fullName={drawerStudent.full_name} sizeClass="w-16 h-16" textClassName="text-xl font-bold" />
                                <div>
                                    <h2 className="text-xl font-bold text-[#1E293B]">{drawerStudent.full_name}</h2>
                                    <p className="text-sm text-[#64748B] font-semibold mt-0.5">Mã SV: {drawerStudent.student_code}</p>
                                </div>
                            </div>

                            {/* Personal Info Box */}
                            <div className="bg-white/40 border border-white/70 rounded-xl p-4 flex flex-col gap-3.5 shadow-sm shadow-slate-200/50">
                                <h4 className="text-[12px] font-bold text-[#1A73E8] uppercase tracking-wider mb-0.5">Thông tin cá nhân</h4>
                                <div className="flex justify-between items-center py-0.5 border-b border-white/40 last:border-0 last:pb-0">
                                    <span className="text-[#64748B] text-xs font-semibold">Ngày sinh</span>
                                    <span className="text-[#1E293B] font-bold text-sm">{formatDob(drawerStudent.date_bir)}</span>
                                </div>
                                <div className="flex justify-between items-center py-0.5 border-b border-white/40 last:border-0 last:pb-0">
                                    <span className="text-[#64748B] text-xs font-semibold">Giới tính</span>
                                    <span className="text-[#1E293B] font-bold text-sm">
                                        {drawerStudent.sex === 'Male' ? 'Nam' : drawerStudent.sex === 'Female' ? 'Nữ' : 'Khác'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-0.5 border-b border-white/40 last:border-0 last:pb-0">
                                    <span className="text-[#64748B] text-xs font-semibold">Email</span>
                                    <span className="text-[#1E293B] font-bold text-sm truncate max-w-[200px]" title={drawerStudent.email}>{drawerStudent.email || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center py-0.5 border-b border-white/40 last:border-0 last:pb-0">
                                    <span className="text-[#64748B] text-xs font-semibold">Trạng thái</span>
                                    <span className="text-[#1E293B] font-bold text-sm">{getVietnameseStatus(drawerStudent.status)}</span>
                                </div>
                                <div className="flex justify-between items-center py-0.5 last:border-0 last:pb-0">
                                    <span className="text-[#64748B] text-xs font-semibold">Tài khoản</span>
                                    <span className={`font-bold text-sm ${
                                        drawerStudent.account_status === 'active' ? 'text-emerald-600' :
                                        drawerStudent.account_status === 'locked' ? 'text-rose-600' : 'text-slate-500'
                                    }`}>
                                        {drawerStudent.account_status === 'active' ? 'Đã kích hoạt' :
                                            drawerStudent.account_status === 'locked' ? 'Đang khóa' : 'Chưa active'}
                                    </span>
                                </div>
                            </div>

                            {/* Academic Info Box */}
                            <div className="bg-white/40 border border-white/70 rounded-xl p-4 flex flex-col gap-3.5 shadow-sm shadow-slate-200/50">
                                <h4 className="text-[12px] font-bold text-[#1A73E8] uppercase tracking-wider mb-0.5">Thông tin học tập</h4>
                                <div className="flex justify-between items-center py-0.5 border-b border-white/40 last:border-0 last:pb-0">
                                    <span className="text-[#64748B] text-xs font-semibold">Khoa</span>
                                    <span className="text-[#1E293B] font-bold text-sm text-right max-w-[200px] truncate" title={(drawerStudent.class_id as any)?.dept_id?.name || 'N/A'}>
                                        {(drawerStudent.class_id as any)?.dept_id?.name || 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-0.5 border-b border-white/40 last:border-0 last:pb-0">
                                    <span className="text-[#64748B] text-xs font-semibold">Lớp học</span>
                                    <span className="text-[#1E293B] font-bold text-sm text-right max-w-[200px] truncate" title={(drawerStudent.class_id as any)?.class_name || 'N/A'}>
                                        {(drawerStudent.class_id as any)?.class_name || 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-0.5 last:border-0 last:pb-0">
                                    <span className="text-[#64748B] text-xs font-semibold">Điểm rèn luyện</span>
                                    <span className="text-[#1E293B] font-bold text-sm">
                                        {(() => {
                                            const resolvedScore = resolveDrlScore(summaryMap.get(drawerStudent._id)) ?? resolveDrlScore(drawerStudent.training_point_id);
                                            return resolvedScore !== null ? `${resolvedScore} / 100` : 'N/A';
                                        })()}
                                    </span>
                                </div>
                            </div>

                            {/* Actions Info Box */}
                            <div className="bg-white/40 border border-white/70 rounded-xl p-4 flex flex-col gap-4 shadow-sm shadow-slate-200/50">
                                <h4 className="text-[12px] font-bold text-[#1A73E8] uppercase tracking-wider mb-0.5">Hành động</h4>
                                {permissions.canTransferStudent && (
                                <button className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#1A73E8] hover:bg-blue-600 text-white rounded-xl font-bold text-sm transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm shadow-blue-500/10 cursor-pointer">
                                    <ArrowRightLeft className="w-4 h-4" /> Chuyển lớp
                                </button>
                                )}
                                {/* Account lifecycle buttons based on status */}
                                {(!drawerStudent.account_status || drawerStudent.account_status === 'inactive') && permissions.canActivateStudentAccount && (
                                <button
                                    onClick={() => handleActivateSingle(drawerStudent._id, drawerStudent.full_name)}
                                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm shadow-green-500/10 cursor-pointer"
                                >
                                    <CheckCircle className="w-4 h-4" /> Kích hoạt tài khoản
                                </button>
                                )}

                                {drawerStudent.account_status === 'active' && permissions.canActivateStudentAccount && (
                                <button
                                    onClick={() => handleLockAccount(drawerStudent._id, drawerStudent.full_name)}
                                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm shadow-rose-500/10 cursor-pointer"
                                >
                                    <ShieldAlert className="w-4 h-4" /> Khóa tài khoản
                                </button>
                                )}

                                {drawerStudent.account_status === 'locked' && permissions.canActivateStudentAccount && (
                                <button
                                    onClick={() => handleUnlockAccount(drawerStudent._id, drawerStudent.full_name)}
                                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#1A73E8] hover:bg-blue-600 text-white rounded-xl font-bold text-sm transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm shadow-blue-500/10 cursor-pointer"
                                >
                                    <ShieldCheck className="w-4 h-4" /> Mở khóa tài khoản
                                </button>
                                )}

                                {drawerStudent.account_status && drawerStudent.account_status !== 'inactive' && permissions.canResetStudentPassword && (
                                <button
                                    onClick={() => handleResetPassword(drawerStudent._id, drawerStudent.full_name)}
                                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-all duration-150 ease-out hover:scale-[1.01] shadow-sm shadow-amber-500/10 cursor-pointer"
                                >
                                    <Key className="w-4 h-4" /> Reset mật khẩu
                                </button>
                                )}
                                <div className="flex gap-3">
                                    {permissions.canUpdateStudent && (
                                    <button
                                        onClick={() => {
                                            handleEditStudent(drawerStudent);
                                            setOpenDrawerId(null);
                                        }}
                                        className="flex-1 py-2.5 bg-white/50 backdrop-blur-sm border border-white/80 text-[#64748B] hover:text-[#1E293B] rounded-xl hover:bg-white/70 hover:scale-[1.01] transition-all duration-150 ease-out flex items-center justify-center gap-1.5 cursor-pointer font-bold text-sm"
                                    >
                                        <Edit className="w-4 h-4" /> Sửa
                                    </button>
                                    )}
                                    {permissions.canDeleteStudent && (
                                    <button
                                        onClick={() => {
                                            handleDeleteSingle(drawerStudent._id, drawerStudent.full_name);
                                            setOpenDrawerId(null);
                                        }}
                                        className="flex-1 py-2.5 bg-rose-500/10 text-rose-700 border border-rose-500/20 hover:bg-rose-600 hover:text-white hover:border-transparent rounded-xl hover:scale-[1.01] transition-all duration-150 ease-out flex items-center justify-center gap-1.5 cursor-pointer font-bold text-sm"
                                    >
                                        <Trash2 className="w-4 h-4" /> Xóa
                                    </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </DrawerContent>
            </Drawer>

            <FloatingActionBar
                selectedCount={selectedStudentIds.length}
                onClear={() => setSelectedStudentIds([])}
                variant="light"
                actions={
                    <>
                        {permissions.canExportStudent && (
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 text-[12px] font-bold text-slate-600 bg-white/80 border border-slate-200 rounded-full hover:bg-slate-50 transition-all select-none shadow-sm cursor-pointer"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Xuất file</span>
                        </button>
                        )}

                        {permissions.canActivateStudentAccount && (
                        <button
                            onClick={handleActivateAccounts}
                            disabled={isDataLoading}
                            className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 text-[12px] font-bold text-white bg-[#135bec] rounded-full hover:bg-blue-600 active:bg-blue-700 transition-all disabled:opacity-50 select-none shadow-sm shadow-blue-500/10 cursor-pointer"
                        >
                            {isDataLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">Kích hoạt</span>
                        </button>
                        )}
                    </>
                }
            />

        </div>
    );
}

export default function ClassStudentsPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] text-gray-400">Loading students...</div>}>
            <RouteGuard requiredPermission="STUDENT_PAGE">
            <ClassStudentsPageContent />
            </RouteGuard>
        </Suspense>
    );
}
