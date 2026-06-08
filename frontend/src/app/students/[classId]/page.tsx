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
            const data = await studentApi.getStudents();
            // Lọc các sinh viên thuộc lớp học hiện tại
            const filtered = data.filter(student => {
                const studentClassId = typeof student.class_id === 'object' ? (student.class_id as any)?._id : student.class_id;
                return studentClassId === classId;
            });
            setStudentsList(filtered);
        } catch (err: any) {
            console.error('Lỗi khi tải danh sách sinh viên:', err);
            toast.error('Không thể tải danh sách sinh viên từ server');
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

    const itemsPerPage = 50;

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

            for (const studentId of selectedStudentIds) {
                const student = studentsList.find(s => s._id === studentId);
                if (!student) continue;

                const dob = new Date(student.date_bir);
                const day = String(dob.getDate()).padStart(2, '0');
                const month = String(dob.getMonth() + 1).padStart(2, '0');
                const year = dob.getFullYear();
                const plainPassword = `${day}${month}${year}`;
                const studentEmail = student.email || `${student.student_code}@school.edu.vn`;

                let registeredNew = false;
                try {
                    await authApi.register(student.full_name, studentEmail, plainPassword);
                    registeredNew = true;
                    successCount++;
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

                // Nếu vừa đăng ký mới tài khoản thành công, tiến hành lấy User ID mới tạo để gán quyền Student
                if (registeredNew && token && studentRoleId) {
                    try {
                        const updatedUsers = await authApi.getUsers(token);
                        const newUser = updatedUsers.find(u => u.email?.toLowerCase() === studentEmail.toLowerCase());
                        if (newUser) {
                            const newUserId = newUser._id || newUser.id;
                            await authApi.assignRole(newUserId, studentRoleId, token);
                        }
                    } catch (roleErr) {
                        console.error("Lỗi khi gán vai trò Student cho tài khoản mới:", roleErr);
                    }
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
        <div className="flex bg-gray-50 h-screen overflow-hidden font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 h-full">
                <Header customMappings={{ [classId]: selectedClass ? selectedClass.class_name : classId }} />
                <main className="flex-1 p-4 overflow-hidden flex flex-col bg-gray-50 relative">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                        className="flex-1 flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
                    >
                        <div className="px-6 py-4 bg-white border-b border-dashed border-gray-200 flex items-center justify-between shrink-0 relative overflow-hidden">
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
                                        <div className="flex items-center gap-1.5 px-[10px] py-[4.5px] bg-[#eef2ff] text-[#4f46e5] rounded-[8px] text-[11px] font-bold uppercase tracking-wider shrink-0 select-none">
                                            <Users className="w-3.5 h-3.5 text-[#4f46e5]" />
                                            <span>Sĩ số: {filteredStudents.length} sinh viên</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-[10px] py-[4.5px] bg-[#f8fafc] text-[#475569] border border-[#e2e8f0] rounded-[8px] text-[11px] font-bold uppercase tracking-wider shrink-0 select-none">
                                            <User className="w-3.5 h-3.5 text-[#475569]" />
                                            <span>GVCN: {selectedClass?.user_id?.user_name || 'Chưa phân công'}</span>
                                        </div>
                                        {selectedClass?.headquarters && (
                                            <div className="flex items-center gap-1.5 px-[10px] py-[4.5px] bg-[#fdf2f8] text-[#db2777] border border-[#fbcfe8] rounded-[8px] text-[11px] font-bold uppercase tracking-wider shrink-0 select-none">
                                                <Compass className="w-3.5 h-3.5 text-[#db2777]" />
                                                <span>Trụ sở: {selectedClass.headquarters}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1" />
                                {permissions.canImportStudent && (
                                <button
                                    onClick={() => setIsImportPopupOpen(true)}
                                    className="flex items-center gap-2 px-[10px] py-[7px] text-[14px] font-bold text-[#475569] border border-gray-200 hover:bg-gray-50 rounded-[10px] hover:text-slate-700 shadow-sm transition-colors z-10 whitespace-nowrap bg-white"
                                >
                                    <Download className="w-4 h-4" /> Import
                                </button>
                                )}
                                {permissions.canCreateStudent && (
                                <button
                                    onClick={() => { setEditingStudent(null); setIsStudentPopupOpen(true); }}
                                    className="flex items-center gap-2 px-[10px] py-[7px] text-[14px] font-bold text-white bg-[#155dfc] rounded-[10px] hover:bg-blue-700 shadow-sm transition-colors z-10 whitespace-nowrap"
                                >
                                    <Plus className="w-4 h-4" /> Thêm sinh viên
                                </button>
                                )}
                            </div>
                        </div>

                        {/* Filter Bar */}
                        <div className="px-6 py-3 bg-white/50 backdrop-blur-[2px] flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 rounded-xl my-1 w-full max-w-screen-2xl mx-auto">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                                <div className="relative w-full sm:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-[14px] h-[14px]" />
                                    <input
                                        type="text"
                                        placeholder="Tìm theo tên hoặc mã SV..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-[rgba(255,255,255,0.56)] border-none rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all h-[33px]"
                                    />
                                </div>

                                {selectedStudentIds.length > 0 && permissions.canDeleteStudent && (
                                    <button
                                        onClick={handleDelete}
                                        disabled={isDataLoading}
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#ef4444] bg-[#fef2f2] border border-[#ef4444]/30 rounded-lg hover:bg-red-100/50 hover:border-[#ef4444] transition-all disabled:opacity-50 shrink-0 select-none h-[33px]"
                                    >
                                        {isDataLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                        Xóa ({selectedStudentIds.length})
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2 items-center min-h-[41px]">
                                <span className="text-[12px] font-semibold text-[#64748b]">Trạng thái:</span>
                                <div className="flex flex-wrap gap-1 items-center bg-transparent">
                                    {['Tất cả', 'Đang học', 'Bảo lưu', 'Thôi học'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => setActiveTab(status)}
                                            className={`px-3 py-1.5 text-[12px] transition-all rounded-[8px] ${activeTab === status
                                                ? 'bg-white text-[#135bec] shadow-sm font-bold'
                                                : 'text-[#64748b] font-medium hover:text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Student Table */}
                        <div className="flex-1 overflow-hidden bg-white max-w-screen-2xl w-full mx-auto relative flex flex-col mb-4">
                            <div className="overflow-x-auto flex-1 h-full">
                                <table className="w-full text-left border-collapse min-w-max">
                                    <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-[#f1f5f9]">
                                        <tr>
                                            <th className="px-4 py-4 w-16 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-primary w-4 h-4"
                                                    checked={paginatedStudents.length > 0 && selectedStudentIds.length === paginatedStudents.length}
                                                    onChange={toggleSelectAll}
                                                />
                                            </th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#64748b] tracking-[0.6px] uppercase">MÃ SV</th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#64748b] tracking-[0.6px] uppercase">HỌ VÀ TÊN</th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#64748b] tracking-[0.6px] uppercase">NGÀY SINH</th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#64748b] tracking-[0.6px] uppercase">GIỚI TÍNH</th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#64748b] tracking-[0.6px] uppercase">ĐRL</th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#64748b] tracking-[0.6px] uppercase text-center">TRẠNG THÁI</th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#64748b] tracking-[0.6px] uppercase text-center">TÀI KHOẢN</th>
                                            <th className="px-6 py-4 text-[12px] font-bold text-[#64748b] tracking-[0.6px] uppercase text-right">HÀNH ĐỘNG</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {isLoading || isDataLoading ? (
                                            Array.from({ length: 6 }).map((_, i) => (
                                                <tr key={i} className="h-[49px]">
                                                    <td className="px-4 text-center"><Skeleton className="w-4 h-4 rounded mx-auto" /></td>
                                                    <td className="px-6"><Skeleton className="w-20 h-4" /></td>
                                                    <td className="px-6 py-2"><Skeleton className="w-48 h-9 rounded-full" /></td>
                                                    <td className="px-6"><Skeleton className="w-24 h-4" /></td>
                                                    <td className="px-6"><Skeleton className="w-16 h-4" /></td>
                                                    <td className="px-6"><Skeleton className="w-16 h-4" /></td>
                                                    <td className="px-6 text-center"><Skeleton className="w-20 h-5 rounded-full mx-auto" /></td>
                                                    <td className="px-6 text-center"><Skeleton className="w-20 h-5 rounded-full mx-auto" /></td>
                                                    <td className="px-6 text-right"><Skeleton className="w-6 h-6 rounded-md ml-auto" /></td>
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
                                                const vScore = student.training_point_id?.score ?? 85;
                                                const vStatus = getVietnameseStatus(student.status);

                                                return (
                                                    <motion.tr
                                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.1, delay: idx * 0.05 }}
                                                        key={student._id} className="hover:bg-blue-50/20 transition-colors group h-[49px]"
                                                    >
                                                        <td className="px-4 text-center">
                                                            <input
                                                                type="checkbox"
                                                                className="rounded border-[#cbd5e1] text-primary w-4 h-4"
                                                                checked={selectedStudentIds.includes(student._id)}
                                                                onChange={() => toggleStudentSelection(student._id)}
                                                            />
                                                        </td>
                                                        <td className="px-6 font-mono text-[14px] text-[#64748b]">{student.student_code}</td>
                                                        <td className="px-6 py-2">
                                                            <div className="flex items-center gap-[12px]">
                                                                <StudentAvatar fullName={student.full_name} sizeClass="w-[36px] h-[36px]" />
                                                                <div>
                                                                    <div className="font-semibold text-[14px] text-[#0f172a]">{student.full_name}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 text-[14px] text-[#475569]">{vDob}</td>
                                                        <td className="px-6 text-[14px] text-[#475569]">{vGender}</td>
                                                        <td className="px-6">
                                                            <div className="flex items-center gap-[4px] font-bold">
                                                                <span className="text-[14px] text-[#334155]">{vScore}</span>
                                                                <span className="text-[10px] text-[#94a3b8] font-normal">/100</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 text-center">
                                                            <span className={`inline-flex items-center justify-center px-[8px] py-[3.5px] rounded-full font-bold text-[12px] ${vStatus === 'Đang học' ? 'bg-[#f0fdf4] text-[#16a34a]' :
                                                                vStatus === 'Bảo lưu' ? 'bg-[#fefce8] text-[#ca8a04]' :
                                                                    'bg-[#fef2f2] text-[#ef4444]'
                                                                }`}>
                                                                {vStatus}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 text-center">
                                                            <span className={`inline-flex items-center justify-center px-[8px] py-[3.5px] rounded-full font-bold text-[12px] ${student.account_status === 'active' ? 'bg-[#f0fdf4] text-[#16a34a]' :
                                                                student.account_status === 'locked' ? 'bg-[#fef2f2] text-[#ef4444]' :
                                                                    'bg-gray-100 text-gray-500'
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

                        <div className="sticky bottom-0 z-10 border-t border-[#f1f5f9] mt-auto">
                            <CustomPagination
                                currentPage={currentPage}
                                pageSize={itemsPerPage}
                                totalItems={filteredStudents.length}
                                onPageChange={(page) => setCurrentPage(page)}
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
                <DrawerContent className="w-[448px] h-full bg-white outline-none flex flex-col items-stretch overflow-hidden">
                    <div className="flex justify-between items-center p-6 border-b border-[#f1f5f9] bg-white shrink-0">
                        <div className="flex items-center gap-3">
                            <DrawerTitle className="text-lg font-semibold text-[#0f172a]">Thông tin sinh viên</DrawerTitle>
                            {!isDrawerLoading && drawerStudent && (
                                <button
                                    onClick={() => {
                                        setOpenDrawerId(null);
                                        router.push(`/students/${classId}/${drawerStudent._id}`);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#135bec] bg-[#ebf2ff] hover:bg-[#d6e4ff] rounded-lg transition-colors border border-[#d6e4ff]"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Chi tiết</span>
                                </button>
                            )}
                        </div>
                        <DrawerDescription className="sr-only">Thông tin chi tiết về sinh viên được chọn.</DrawerDescription>
                        <DrawerClose asChild>
                            <button className="w-7 h-7 flex justify-center items-center text-gray-500 hover:text-gray-700 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </DrawerClose>
                    </div>

                    {isDrawerLoading || !drawerStudent ? (
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 animate-pulse">
                            <div className="flex items-center gap-4">
                                <Skeleton className="w-16 h-16 rounded-full shrink-0" />
                                <div className="flex-1 flex flex-col gap-2">
                                    <Skeleton className="w-48 h-6 rounded-md" />
                                    <Skeleton className="w-32 h-4 rounded-md" />
                                </div>
                            </div>

                            <div className="flex flex-col gap-5">
                                <Skeleton className="w-24 h-4 rounded-md mb-2" />
                                <div className="flex justify-between"><Skeleton className="w-20 h-4 rounded" /><Skeleton className="w-32 h-4 rounded" /></div>
                                <div className="flex justify-between"><Skeleton className="w-20 h-4 rounded" /><Skeleton className="w-16 h-4 rounded" /></div>
                                <div className="flex justify-between"><Skeleton className="w-20 h-4 rounded" /><Skeleton className="w-40 h-4 rounded" /></div>
                                <div className="flex justify-between"><Skeleton className="w-20 h-4 rounded" /><Skeleton className="w-24 h-4 rounded" /></div>
                            </div>

                            <div className="flex flex-col gap-5">
                                <Skeleton className="w-32 h-4 rounded-md mb-2" />
                                <div className="flex justify-between"><Skeleton className="w-20 h-4 rounded" /><Skeleton className="w-44 h-4 rounded" /></div>
                                <div className="flex justify-between"><Skeleton className="w-20 h-4 rounded" /><Skeleton className="w-36 h-4 rounded" /></div>
                                <div className="flex justify-between"><Skeleton className="w-24 h-4 rounded" /><Skeleton className="w-12 h-4 rounded" /></div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
                            <div className="flex items-center gap-4">
                                <StudentAvatar fullName={drawerStudent.full_name} sizeClass="w-16 h-16" textClassName="text-xl font-bold" />
                                <div>
                                    <h2 className="text-xl font-bold text-[#0f172a]">{drawerStudent.full_name}</h2>
                                    <p className="text-sm text-[#64748b]">Mã SV: {drawerStudent.student_code}</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <h4 className="text-sm font-bold text-[#135bec] uppercase tracking-wider">Thông tin cá nhân</h4>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-sm">Ngày sinh</span>
                                    <span className="text-gray-900 font-medium text-sm">{formatDob(drawerStudent.date_bir)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-sm">Giới tính</span>
                                    <span className="text-gray-900 font-medium text-sm">
                                        {drawerStudent.sex === 'Male' ? 'Nam' : drawerStudent.sex === 'Female' ? 'Nữ' : 'Khác'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-sm">Email</span>
                                    <span className="text-gray-900 font-medium text-sm truncate max-w-[240px]" title={drawerStudent.email}>{drawerStudent.email || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-sm">Trạng thái</span>
                                    <span className="text-gray-900 font-medium text-sm">{getVietnameseStatus(drawerStudent.status)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-sm">Tài khoản</span>
                                    <span className={`font-bold text-sm ${drawerStudent.account_status === 'active' ? 'text-green-600' :
                                        drawerStudent.account_status === 'locked' ? 'text-red-600' : 'text-gray-500'
                                        }`}>
                                        {drawerStudent.account_status === 'active' ? 'Đã kích hoạt' :
                                            drawerStudent.account_status === 'locked' ? 'Đang khóa' : 'Chưa active'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <h4 className="text-sm font-bold text-[#135bec] uppercase tracking-wider">Thông tin học tập</h4>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-sm">Khoa</span>
                                    <span className="text-gray-900 font-medium text-sm text-right max-w-[240px] truncate" title={(drawerStudent.class_id as any)?.dept_id?.name || 'N/A'}>
                                        {(drawerStudent.class_id as any)?.dept_id?.name || 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-sm">Lớp học</span>
                                    <span className="text-gray-900 font-medium text-sm text-right max-w-[240px] truncate" title={(drawerStudent.class_id as any)?.class_name || 'N/A'}>
                                        {(drawerStudent.class_id as any)?.class_name || 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-sm">Điểm rèn luyện</span>
                                    <span className="text-gray-900 font-bold text-sm">
                                        {drawerStudent.training_point_id?.score !== undefined ? `${drawerStudent.training_point_id.score} / 100` : 'N/A'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <h4 className="text-sm font-bold text-[#135bec] uppercase tracking-wider">Hành động</h4>
                                {permissions.canTransferStudent && (
                                <button className="flex items-center justify-center gap-2 w-full py-3 bg-[#eff6ff] text-[#135bec] rounded-xl font-bold text-sm">
                                    <ArrowRightLeft className="w-5 h-5" /> Chuyển lớp
                                </button>
                                )}
                                <div className="flex gap-3">
                                    {permissions.canUpdateStudent && (
                                    <button
                                        onClick={() => {
                                            handleEditStudent(drawerStudent);
                                            setOpenDrawerId(null);
                                        }}
                                        className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
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
                                        className="flex-1 py-3 bg-[#fef2f2] text-red-600 rounded-xl font-medium text-sm border border-red-100 hover:bg-red-100/50 transition-colors flex items-center justify-center gap-1.5"
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
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50 text-gray-400">Loading students...</div>}>
            <RouteGuard requiredPermission="STUDENT_PAGE">
            <ClassStudentsPageContent />
            </RouteGuard>
        </Suspense>
    );
}
