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
    CheckCircle
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


function ClassStudentsPageContent() {
    const router = useRouter();
    const params = useParams();
    const classId = params.classId as string;
    const permissions = usePermission({
        canCreateStudent: 'STUDENT_CREATE',
        canImportStudent: 'STUDENT_IMPORT',
        canExportStudent: 'STUDENT_EXPORT',
        canActivateStudentAccount: 'STUDENT_ACCOUNT_ACTIVATE',
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

    // States cho Drawer sinh viên lấy từ API
    const [drawerStudent, setDrawerStudent] = useState<Student | null>(null);
    const [isDrawerLoading, setIsDrawerLoading] = useState(false);

    const [selectedClass, setSelectedClass] = useState<Class | null>(null);
    const [studentsList, setStudentsList] = useState<Student[]>([]);
    const [summaryMap, setSummaryMap] = useState<Map<string, any>>(new Map());

    // Tải thông tin lớp học
    useEffect(() => {
        classApi.getClass(classId)
            .then(setSelectedClass)
            .catch(err => console.error('Lỗi khi tải thông tin lớp học:', err));
    }, [classId]);

    // Tải danh sách sinh viên thực tế theo lớp học
    const fetchStudents = async () => {
        setIsDataLoading(true);
        try {
            const semesters = await semesterApi.getSemesters();
            const activeSemester = semesters.find(s => s.status === 'active');
            const activeSemesterId = activeSemester?._id;

            const [studentsRes, summariesRes] = await Promise.all([
                studentApi.getStudents({ classId }),
                summariesPointApi.getSummariesPoints({
                    classId,
                    semesterId: activeSemesterId,
                    limit: 100
                })
            ]);

            const studentsData = Array.isArray(studentsRes) ? studentsRes : (studentsRes?.data || []);
            const summariesData = summariesRes?.data || [];

            const map = new Map<string, any>();
            summariesData.forEach((item: any) => {
                const studentId = typeof item.student_id === 'object' ? item.student_id?._id : item.student_id;
                if (studentId) {
                    map.set(studentId, item);
                }
            });

            setStudentsList(studentsData);
            setSummaryMap(map);
        } catch (err: any) {
            console.error('Lỗi khi tải danh sách sinh viên và điểm rèn luyện:', err);
            toast.error('Không thể tải danh sách sinh viên hoặc điểm rèn luyện từ server');
        } finally {
            setIsDataLoading(false);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, [classId]);

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

    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Reset về trang 1 khi tìm kiếm, lọc hoặc đổi số lượng phần tử mỗi trang
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeTab, itemsPerPage]);

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

    const filteredStudents = studentsList.filter(student => {
        const matchesSearch = student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.student_code.includes(searchTerm);

        const mappedStatus = getVietnameseStatus(student.status);
        const matchesStatus = activeTab === 'Tất cả' || mappedStatus === activeTab;

        return matchesSearch && matchesStatus;
    });

    const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

    const handleActivateAccounts = async () => {
        if (selectedStudentIds.length === 0) return;
        setIsDataLoading(true);
        const token = tokenStorage.getAccessToken();
        let successCount = 0;
        let failCount = 0;

        try {
            // 1. Lấy danh sách vai trò (roles) để tìm vai trò 'Student'
            let studentRoleId = "";
            if (token) {
                try {
                    const roles = await authApi.getRoles(token);
                    const studentRole = roles.find(r => r.name?.toLowerCase() === 'student');
                    if (studentRole) {
                        studentRoleId = studentRole._id || studentRole.id;
                    }
                } catch (err) {
                    console.error("Không thể lấy danh sách vai trò:", err);
                }
            }

            // 2. Lấy danh sách người dùng ban đầu
            let allUsers: any[] = [];
            if (token) {
                try {
                    allUsers = await authApi.getUsers(token);
                } catch (err) {
                    console.error("Không thể lấy danh sách users ban đầu:", err);
                }
            }

            const newlyRegisteredEmails: string[] = [];

            for (const studentId of selectedStudentIds) {
                const student = studentsList.find(s => s._id === studentId);
                if (!student) continue;

                const dob = new Date(student.date_bir);
                const day = String(dob.getDate()).padStart(2, '0');
                const month = String(dob.getMonth() + 1).padStart(2, '0');
                const year = dob.getFullYear();
                const plainPassword = `${day}${month}${year}`;
                const studentEmail = student.email || `${student.student_code}@school.edu.vn`;

                try {
                    await authApi.register(student.full_name, studentEmail, plainPassword);
                    successCount++;
                    newlyRegisteredEmails.push(studentEmail);
                } catch (regErr: any) {
                    const isDuplicate = regErr.message?.toLowerCase().includes('đã được sử dụng') || 
                                       regErr.message?.toLowerCase().includes('tồn tại') || 
                                       regErr.status === 409;
                    if (isDuplicate && token) {
                        const matchedUser = allUsers.find(u => u.email?.toLowerCase() === studentEmail.toLowerCase());
                        if (matchedUser) {
                            try {
                                const userId = matchedUser._id || matchedUser.id;
                                await authApi.updateUser(userId, { status: 'active' }, token);
                                successCount++;
                                
                                // Gán quyền 'Student' luôn cho tài khoản cũ vừa kích hoạt
                                if (studentRoleId) {
                                    await authApi.assignRole(userId, studentRoleId, token);
                                }
                                continue;
                            } catch (updateErr) {
                                console.error("Lỗi khi kích hoạt tài khoản đã có:", updateErr);
                            }
                        }
                    }
                    failCount++;
                    continue;
                }
            }

            // Gán quyền Student cho tất cả tài khoản đăng ký mới ở cuối sau vòng lặp
            if (newlyRegisteredEmails.length > 0 && token && studentRoleId) {
                try {
                    const updatedUsers = await authApi.getUsers(token);
                    for (const email of newlyRegisteredEmails) {
                        const newUser = updatedUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
                        if (newUser) {
                            const newUserId = newUser._id || newUser.id;
                            try {
                                await authApi.assignRole(newUserId, studentRoleId, token);
                            } catch (roleErr) {
                                console.error("Lỗi khi gán vai trò Student cho tài khoản mới:", roleErr);
                            }
                        }
                    }
                } catch (roleErr) {
                    console.error("Lỗi khi tải danh sách users hoặc gán vai trò Student:", roleErr);
                }
            }

            if (successCount > 0) {
                toast.success(`Đã kích hoạt thành công tài khoản và gán quyền Student cho ${successCount} sinh viên.`);
            }
            if (failCount > 0) {
                toast.error(`Kích hoạt thất bại cho ${failCount} sinh viên.`);
            }
            
            setSelectedStudentIds([]);
            fetchStudents();
        } catch (err) {
            console.error("Lỗi khi xử lý kích hoạt tài khoản sinh viên:", err);
            toast.error("Đã xảy ra lỗi trong quá trình kích hoạt tài khoản.");
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

    return (
        <div className="flex bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] h-screen overflow-hidden font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 h-full">
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
                                             <span>Sĩ số: {filteredStudents.length} sinh viên</span>
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
                            <div className="overflow-x-auto flex-1 h-full">
                                <table className="w-full text-left border-collapse min-w-[1000px]">
                                    <thead className="bg-white/90 backdrop-blur-md sticky top-0 z-20 border-b border-white/80">
                                        <tr>
                                            <th className="px-4 py-4 w-16 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-primary w-4 h-4 cursor-pointer"
                                                    checked={paginatedStudents.length > 0 && selectedStudentIds.length === paginatedStudents.length}
                                                    onChange={toggleSelectAll}
                                                />
                                            </th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#334155] tracking-[0.6px] uppercase min-w-[100px]">MÃ SV</th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#334155] tracking-[0.6px] uppercase min-w-[200px]">HỌ VÀ TÊN</th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#334155] tracking-[0.6px] uppercase min-w-[110px]">NGÀY SINH</th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#334155] tracking-[0.6px] uppercase min-w-[90px]">GIỚI TÍNH</th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#334155] tracking-[0.6px] uppercase min-w-[80px]">ĐRL</th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#334155] tracking-[0.6px] uppercase text-center min-w-[120px]">TRẠNG THÁI</th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#334155] tracking-[0.6px] uppercase text-center min-w-[130px]">TÀI KHOẢN</th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#334155] tracking-[0.6px] uppercase text-right min-w-[100px]">HÀNH ĐỘNG</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        {isLoading || isDataLoading ? (
                                            Array.from({ length: 6 }).map((_, i) => (
                                                <tr key={i} className="h-[49px]">
                                                    <td className="px-4 text-center"><Skeleton className="w-4 h-4 rounded mx-auto" /></td>
                                                    <td className="px-6"><Skeleton className="w-20 h-4" /></td>
                                                    <td className="px-6 py-2 flex items-center gap-[12px] h-[49px]"><Skeleton className="w-[36px] h-[36px] rounded-full shrink-0" /><Skeleton className="w-32 h-4 rounded" /></td>
                                                    <td className="px-6"><Skeleton className="w-20 h-4" /></td>
                                                    <td className="px-6"><Skeleton className="w-12 h-4" /></td>
                                                    <td className="px-6"><Skeleton className="w-12 h-4" /></td>
                                                    <td className="px-6 text-center"><Skeleton className="w-20 h-6 rounded-xl mx-auto" /></td>
                                                    <td className="px-6 text-center"><Skeleton className="w-24 h-6 rounded-xl mx-auto" /></td>
                                                    <td className="px-6 text-right"><Skeleton className="w-8 h-8 rounded-xl ml-auto" /></td>
                                                </tr>
                                            ))
                                        ) : paginatedStudents.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="px-6 py-12 text-center text-gray-400 text-sm">
                                                    Không tìm thấy sinh viên nào trong lớp này.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedStudents.map((student, idx) => {
                                                const vDob = formatDob(student.date_bir);
                                                const vGender = student.sex === 'Male' ? 'Nam' : student.sex === 'Female' ? 'Nữ' : 'Khác';
                                                const resolvedScore = resolveDrlScore(summaryMap.get(student._id)) ?? resolveDrlScore(student.training_point_id);
                                                const vScore = resolvedScore !== null ? `${resolvedScore}` : 'N/A';
                                                const vStatus = getVietnameseStatus(student.status);

                                                return (
                                                    <motion.tr
                                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.1, delay: idx * 0.05 }}
                                                        key={student._id} className="hover:bg-white/50 transition-all duration-150 ease-out group h-[49px]"
                                                    >
                                                        <td className="px-4 text-center">
                                                            <input
                                                                type="checkbox"
                                                                className="rounded border-[#cbd5e1] text-primary w-4 h-4 cursor-pointer"
                                                                checked={selectedStudentIds.includes(student._id)}
                                                                onChange={() => toggleStudentSelection(student._id)}
                                                            />
                                                        </td>
                                                        <td className="px-6 font-mono text-[14px] text-[#64748B]">{student.student_code}</td>
                                                        <td className="px-6 py-2">
                                                            <div className="flex items-center gap-[12px]">
                                                                <StudentAvatar fullName={student.full_name} sizeClass="w-[36px] h-[36px]" />
                                                                <div>
                                                                    <div className="font-semibold text-[14px] text-[#1E293B]">{student.full_name}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 text-[14px] text-[#64748B]">{vDob}</td>
                                                        <td className="px-6 text-[14px] text-[#64748B]">{vGender}</td>
                                                        <td className="px-6">
                                                            <div className="flex items-center gap-[4px] font-bold">
                                                                <span className="text-[14px] text-[#1E293B]">{vScore}</span>
                                                                {vScore !== 'N/A' && <span className="text-[10px] text-[#64748B] font-normal">/100</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 text-center">
                                                            <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-xl font-bold text-[12px] border ${vStatus === 'Đang học' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' :
                                                                vStatus === 'Bảo lưu' ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' :
                                                                    'bg-rose-500/10 text-rose-700 border-rose-500/20'
                                                                }`}>
                                                                {vStatus}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 text-center">
                                                            <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-xl font-bold text-[12px] border ${student.account_status === 'active' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' :
                                                                student.account_status === 'locked' ? 'bg-rose-500/10 text-rose-700 border-rose-500/20' :
                                                                    'bg-slate-500/10 text-[#64748B] border border-slate-500/20'
                                                                }`}>
                                                                {student.account_status === 'active' ? 'Đã kích hoạt' :
                                                                    student.account_status === 'locked' ? 'Đang khóa' : 'Chưa active'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Action
                                                                    onView={() => setOpenDrawerId(student._id)}
                                                                    onEdit={() => handleEditStudent(student)}
                                                                    onDelete={() => handleDeleteSingle(student._id, student.full_name)}
                                                                    permissionView="STUDENT_READ"
                                                                    permissionEdit="STUDENT_UPDATE"
                                                                    permissionDelete="STUDENT_DELETE"
                                                                />
                                                            </div>
                                                        </td>
                                                    </motion.tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="sticky bottom-0 z-10 border-t border-white/60 mt-auto bg-white/40 backdrop-blur-md">
                            <CustomPagination
                                currentPage={currentPage}
                                pageSize={itemsPerPage}
                                totalItems={filteredStudents.length}
                                onPageChange={(page) => setCurrentPage(page)}
                                onPageSizeChange={setItemsPerPage}
                                label="sinh viên"
                                isLoading={isDataLoading}
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
                <DrawerContent className="w-[448px] h-full bg-white/80 backdrop-blur-xl border-l border-white/80 outline-none flex flex-col items-stretch overflow-hidden">
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
                            className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-slate-600 bg-white/80 border border-slate-200 rounded-full hover:bg-slate-50 transition-all select-none shadow-sm"
                        >
                            <Download className="w-3.5 h-3.5" /> Xuất file
                        </button>
                        )}

                        {permissions.canActivateStudentAccount && (
                        <button
                            onClick={handleActivateAccounts}
                            disabled={isDataLoading}
                            className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-white bg-[#135bec] rounded-full hover:bg-blue-600 active:bg-blue-700 transition-all disabled:opacity-50 select-none shadow-sm shadow-blue-500/10"
                        >
                            {isDataLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            Kích hoạt
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
