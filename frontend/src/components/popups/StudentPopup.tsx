'use client';
import React, { useEffect, useState } from 'react';
import Popup from './Popup';
import {
    User, Calendar, Mail, Phone,
    School, Check, Download, Users, Loader2
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { studentApi } from '@/api/student-api';
import { classApi, Class } from '@/api/class-api';
import { departmentApi, Department } from '@/api/department-api';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { format } from 'date-fns';
import ImportStudentPopup from './ImportStudentPopup';
import ConfirmModal from '@/components/modals/ConfirmModal';

interface StudentPopupProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: FormValues | null;
    defaultClassId?: string;
    onSuccess?: () => void;
}

const formSchema = z.object({
    _id: z.string().optional(),
    fullName: z.string().min(2, { message: "Họ và tên bắt buộc nhập" }),
    dob: z.string().min(1, { message: "Ngày sinh bắt buộc nhập" }),
    gender: z.enum(['Nam', 'Nữ']),
    email: z.string().email({ message: "Email không hợp lệ" }).or(z.literal('')),
    phone: z.string().optional(),
    studentId: z.string().min(1, { message: "Mã sinh viên bắt buộc nhập" }),
    department: z.string().min(1, { message: "Khoa bắt buộc nhập" }),
    classId: z.string().min(1, { message: "Lớp bắt buộc nhập" }),
    status: z.enum(['Studying', 'Reserved', 'Dropped', 'Graduated', 'Suspended']),
});

type FormValues = z.infer<typeof formSchema>;

export default function StudentPopup({ isOpen, onClose, initialData, defaultClassId, onSuccess }: StudentPopupProps) {
    const [classesList, setClassesList] = useState<Class[]>([]);
    const [departmentsList, setDepartmentsList] = useState<Department[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [pendingData, setPendingData] = useState<FormValues | null>(null);

    const {
        register,
        control,
        handleSubmit,
        reset,
        watch,
        setValue,
        setError,
        formState: { errors }
    } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            fullName: '',
            dob: '',
            gender: 'Nam',
            email: '',
            phone: '',
            studentId: '',
            department: '',
            classId: '',
            status: 'Studying'
        }
    });

    const genderValue = watch('gender');
    const selectedClassId = watch('classId');

    // Load classes & departments from API
    useEffect(() => {
        if (isOpen) {
            setIsLoadingData(true);
            Promise.all([
                classApi.getClasses(),
                departmentApi.getDepartments()
            ]).then(([classesData, departmentsData]) => {
                setClassesList(classesData);
                setDepartmentsList(departmentsData);
            }).catch(err => {
                console.error('Lỗi khi tải danh sách lớp học và khoa:', err);
                toast.error('Không thể tải danh sách lớp học và khoa');
            }).finally(() => {
                setIsLoadingData(false);
            });
        }
    }, [isOpen]);

    // Auto-select department when class is chosen
    useEffect(() => {
        if (selectedClassId && classesList.length > 0) {
            const cls = classesList.find(c => c._id === selectedClassId);
            if (cls) {
                const deptId = typeof cls.dept_id === 'object' ? (cls.dept_id as any)._id : cls.dept_id;
                if (deptId) {
                    setValue('department', deptId);
                }
            }
        }
    }, [selectedClassId, classesList, setValue]);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                reset(initialData);
            } else {
                reset({
                    fullName: '',
                    dob: '',
                    gender: 'Nam',
                    email: '',
                    phone: '',
                    studentId: '',
                    department: '',
                    classId: defaultClassId || '',
                    status: 'Studying'
                });
            }
        }
    }, [isOpen, initialData, defaultClassId, reset]);

    const onSubmit = async (data: FormValues, forceSubmit = false) => {
        const isTransitioningFromStudying = initialData?.status === 'Studying' && data.status !== 'Studying';
        if (isTransitioningFromStudying && !forceSubmit) {
            setPendingData(data);
            setIsConfirmOpen(true);
            return;
        }

        setIsSubmitting(true);
        try {
            // Map from FormValues to Student API DTO
            const studentDto = {
                student_code: data.studentId,
                full_name: data.fullName,
                date_bir: new Date(data.dob).toISOString(),
                sex: data.gender === 'Nam' ? 'Male' : 'Female' as any,
                status: data.status as any,
                class_id: data.classId,
                email: data.email || undefined,
                deleteTrainingScoresConfirmed: isTransitioningFromStudying ? true : undefined,
            };

            if (data._id) {
                // Update
                await studentApi.updateStudent(data._id, studentDto);
                toast.success(`Đã cập nhật sinh viên: ${data.fullName}`);
            } else {
                // Create
                await studentApi.createStudent(studentDto);
                toast.success(`Đã thêm mới sinh viên: ${data.fullName}`);
            }

            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (error: any) {
            console.error('Lỗi khi lưu sinh viên:', error);
            const msg = error.message || '';
            if (msg.includes('đã tồn tại') || msg.includes('duplicate') || msg.includes('E11000')) {
                toast.error(`Mã sinh viên "${data.studentId}" đã tồn tại. Vui lòng nhập mã khác!`);
                setError('studentId', { type: 'manual', message: 'Mã sinh viên đã tồn tại' });
            } else {
                toast.error(msg || 'Đã xảy ra lỗi khi lưu thông tin sinh viên');
            }
        } finally {
            setIsSubmitting(false);
            setIsConfirmOpen(false);
            setPendingData(null);
        }
    };

    const handleConfirmSave = () => {
        if (pendingData) {
            onSubmit(pendingData, true);
        }
    };

    const handleCancelSave = () => {
        setIsConfirmOpen(false);
        setPendingData(null);
    };

    const handleFormSubmit = (data: FormValues) => {
        onSubmit(data, false);
    };

    return (
        <>
            <Popup isOpen={isOpen} onClose={onClose} className="max-w-fit bg-white/80 backdrop-blur-xl border border-white/80 rounded-2xl shadow-lg shadow-slate-300/40" contentClassName="p-6">
                <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col w-[600px] max-w-[95vw] bg-transparent">
                {/* Header Custom as per Figma */}
                <div className="flex items-center justify-between pb-6 border-b border-white/60">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-[20px] font-bold text-[#1E293B] tracking-wide">
                            {initialData ? "Sửa Sinh viên" : "Thêm Sinh viên"}
                        </h2>
                        <p className="text-[14px] text-[#64748B]">
                            Điền thông tin hồ sơ sinh viên {initialData ? "hiện tại" : "mới"}
                        </p>
                    </div>
                </div>

                <div className="py-6 gap-x-6 gap-y-5 grid grid-cols-2">
                    {/* Mã sinh viên */}
                    <Input
                        label="Mã sinh viên"
                        required
                        placeholder="Nhập mã SV"
                        disabled={!!initialData} // Không cho phép đổi mã sinh viên khi sửa
                        {...register('studentId')}
                        error={errors.studentId?.message}
                    />

                    {/* Họ và tên */}
                    <Input
                        label="Họ và tên"
                        required
                        placeholder="Nhập họ và tên đầy đủ"
                        {...register('fullName')}
                        error={errors.fullName?.message}
                    />

                    {/* Ngày sinh */}
                    <div className="col-span-1 space-y-1.5 flex flex-col justify-start">
                        <label className="text-[13px] font-bold text-[#1E293B] px-1">
                            Ngày sinh <span className="text-red-500">*</span>
                        </label>
                        <Controller
                            name="dob"
                            control={control}
                            render={({ field }) => {
                                const selectedDate = field.value ? new Date(field.value) : null;
                                return (
                                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                        <PopoverTrigger asChild>
                                            <button
                                                type="button"
                                                className={`w-full h-10 px-3 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-[14px] transition-all duration-150 ease-out hover:scale-[1.01] flex items-center justify-between hover:bg-white/70 focus:ring-2 focus:ring-[#1A73E8]/30 focus:outline-none ${errors.dob ? 'border-red-500' : ''}`}
                                            >
                                                <span className={selectedDate && !isNaN(selectedDate.getTime()) ? 'text-[#1E293B] font-medium' : 'text-[#64748B]/60'}>
                                                    {selectedDate && !isNaN(selectedDate.getTime())
                                                        ? format(selectedDate, 'dd/MM/yyyy')
                                                        : 'Chọn ngày sinh'}
                                                </span>
                                                <Calendar className="w-4 h-4 text-[#64748B]" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            className="w-auto p-0.5 z-[110] bg-white/80 backdrop-blur-xl border border-white/80 rounded-2xl shadow-lg shadow-slate-300/40 overflow-hidden"
                                            align="start"
                                            side="bottom"
                                            sideOffset={6}
                                        >
                                            <CustomCalendar
                                                startDate={selectedDate && !isNaN(selectedDate.getTime()) ? selectedDate : null}
                                                endDate={null}
                                                onRangeSelect={(start) => {
                                                    if (start) {
                                                        const yyyy = start.getFullYear();
                                                        const mm = String(start.getMonth() + 1).padStart(2, '0');
                                                        const dd = String(start.getDate()).padStart(2, '0');
                                                        field.onChange(`${yyyy}-${mm}-${dd}`);
                                                    }
                                                }}
                                                onCancel={() => setIsCalendarOpen(false)}
                                                onConfirm={() => setIsCalendarOpen(false)}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                );
                            }}
                        />
                        {errors.dob && <p className="px-1 text-[12px] font-medium text-red-500 mt-0.5">{errors.dob.message}</p>}
                    </div>

                    {/* Giới tính */}
                    <div className="col-span-1 space-y-1.5 flex flex-col justify-start">
                        <label className="text-[13px] font-bold text-[#1E293B] px-1">Giới tính</label>
                        <div className="flex gap-4 h-10 items-center">
                            <label className={`flex-1 flex items-center justify-center gap-2 h-10 border rounded-xl cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01] ${genderValue === 'Nam' ? 'bg-[#1A73E8]/10 border-[#1A73E8]/30 text-[#1A73E8]' : 'bg-white/50 backdrop-blur-sm border-white/80 text-[#64748B] hover:bg-white/70'}`}>
                                <input
                                    type="radio"
                                    name="gender"
                                    value="Nam"
                                    checked={genderValue === 'Nam'}
                                    onChange={() => setValue('gender', 'Nam')}
                                    className="hidden"
                                />
                                <span className="text-[13px] font-bold">Nam</span>
                            </label>

                            <label className={`flex-1 flex items-center justify-center gap-2 h-10 border rounded-xl cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01] ${genderValue === 'Nữ' ? 'bg-[#1A73E8]/10 border-[#1A73E8]/30 text-[#1A73E8]' : 'bg-white/50 backdrop-blur-sm border-white/80 text-[#64748B] hover:bg-white/70'}`}>
                                <input
                                    type="radio"
                                    name="gender"
                                    value="Nữ"
                                    checked={genderValue === 'Nữ'}
                                    onChange={() => setValue('gender', 'Nữ')}
                                    className="hidden"
                                />
                                <span className="text-[13px] font-bold">Nữ</span>
                            </label>
                        </div>
                    </div>

                    {/* Email */}
                    <Input
                        label="Email"
                        placeholder="Nhập email sinh viên (nếu có)"
                        {...register('email')}
                        error={errors.email?.message}
                    />

                    {/* Lớp */}
                    <div className="col-span-1 space-y-1.5">
                        <label className="text-[13px] font-bold text-[#1E293B] px-1">Lớp</label>
                        {isLoadingData ? (
                            <div className="flex items-center gap-2 h-10 px-3 bg-white/40 border border-white/80 rounded-xl text-sm text-[#64748B] backdrop-blur-sm">
                                <Loader2 className="w-4 h-4 animate-spin text-[#1A73E8]" />
                                Đang tải danh sách lớp...
                            </div>
                        ) : (
                            <Controller
                                name="classId"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="w-full h-10 px-3 bg-white/50 border border-white/80 rounded-xl text-[14px] text-[#1E293B] font-medium transition-all duration-150 ease-out hover:scale-[1.01] focus:ring-2 focus:ring-[#1A73E8]/30 focus:outline-none shadow-none">
                                            <SelectValue placeholder="Chọn lớp" />
                                        </SelectTrigger>
                                        <SelectContent position="popper" className="z-[100] min-w-[var(--radix-select-trigger-width)] bg-white/85 backdrop-blur-md rounded-xl shadow-lg shadow-slate-300/40 border border-white/70 p-1">
                                            {classesList.map(cls => (
                                                <SelectItem key={cls._id} value={cls._id} className="rounded-xl cursor-pointer focus:bg-[#1A73E8]/10 focus:text-[#1A73E8] text-[#1E293B] font-medium transition-colors">
                                                    {cls.class_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        )}
                        {errors.classId && <p className="px-1 text-[12px] font-medium text-red-500 mt-0.5">{errors.classId.message}</p>}
                    </div>

                    {/* Khoa */}
                    <div className="col-span-1 space-y-1.5">
                        <label className="text-[13px] font-bold text-[#1E293B] px-1">Khoa</label>
                        {isLoadingData ? (
                            <div className="flex items-center gap-2 h-10 px-3 bg-white/40 border border-white/80 rounded-xl text-sm text-[#64748B] backdrop-blur-sm">
                                <Loader2 className="w-4 h-4 animate-spin text-[#1A73E8]" />
                                Đang tải danh sách khoa...
                            </div>
                        ) : (
                            <Controller
                                name="department"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value} disabled>
                                        <SelectTrigger className="w-full h-10 px-3 bg-white/40 border border-white/80 rounded-xl text-[14px] text-[#1E293B] font-medium transition-all shadow-none opacity-60 cursor-not-allowed">
                                            <SelectValue placeholder="Khoa tự chọn theo Lớp" />
                                        </SelectTrigger>
                                        <SelectContent position="popper" className="z-[100] min-w-[var(--radix-select-trigger-width)] bg-white/85 backdrop-blur-md rounded-xl shadow-lg shadow-slate-300/40 border border-white/70 p-1">
                                            {departmentsList.map(dept => (
                                                <SelectItem key={dept._id} value={dept._id} className="rounded-xl cursor-pointer focus:bg-[#1A73E8]/10 focus:text-[#1A73E8] text-[#1E293B] font-medium transition-colors">
                                                    {dept.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        )}
                        {errors.department && <p className="px-1 text-[12px] font-medium text-red-500 mt-0.5">{errors.department.message}</p>}
                    </div>

                    {/* Trạng thái */}
                    <div className="col-span-1 space-y-1.5">
                        <label className="text-[13px] font-bold text-[#1E293B] px-1">Trạng thái</label>
                        <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="w-full h-10 px-3 bg-white/50 border border-white/80 rounded-xl text-[14px] text-[#1E293B] font-medium transition-all duration-150 ease-out hover:scale-[1.01] focus:ring-2 focus:ring-[#1A73E8]/30 focus:outline-none shadow-none">
                                        <SelectValue placeholder="Chọn trạng thái" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="z-[100] min-w-[var(--radix-select-trigger-width)] bg-white/85 backdrop-blur-md rounded-xl shadow-lg shadow-slate-300/40 border border-white/70 p-1">
                                        <SelectItem value="Studying" className="rounded-xl cursor-pointer focus:bg-[#1A73E8]/10 focus:text-[#1A73E8] text-[#1E293B] font-medium transition-colors">
                                            Đang học
                                        </SelectItem>
                                        <SelectItem value="Reserved" className="rounded-xl cursor-pointer focus:bg-[#1A73E8]/10 focus:text-[#1A73E8] text-[#1E293B] font-medium transition-colors">
                                            Bảo lưu
                                        </SelectItem>
                                        <SelectItem value="Dropped" className="rounded-xl cursor-pointer focus:bg-[#1A73E8]/10 focus:text-[#1A73E8] text-[#1E293B] font-medium transition-colors">
                                            Thôi học
                                        </SelectItem>
                                        <SelectItem value="Graduated" className="rounded-xl cursor-pointer focus:bg-[#1A73E8]/10 focus:text-[#1A73E8] text-[#1E293B] font-medium transition-colors">
                                            Tốt nghiệp
                                        </SelectItem>
                                        <SelectItem value="Suspended" className="rounded-xl cursor-pointer focus:bg-[#1A73E8]/10 focus:text-[#1A73E8] text-[#1E293B] font-medium transition-colors">
                                            Đình chỉ
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.status && <p className="px-1 text-[12px] font-medium text-red-500 mt-0.5">{errors.status.message}</p>}
                    </div>
                </div>

                {/* BOTTOM Section: Actions */}
                <div className="pt-5 border-t border-white/60 flex items-center justify-end gap-3 mt-2">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        type="button"
                        disabled={isSubmitting}
                    >
                        Huỷ
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-1.5"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {initialData ? "Lưu thay đổi" : "Thêm mới"}
                    </Button>
                </div>
                </form>
            </Popup>
            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={handleCancelSave}
                onConfirm={handleConfirmSave}
                title="Xác nhận thay đổi trạng thái"
                message="Sinh viên sẽ không còn đủ điều kiện có bảng điểm rèn luyện. Các bảng điểm rèn luyện hiện tại của sinh viên này sẽ bị xóa. Bạn có chắc chắn muốn lưu thay đổi này không?"
                confirmLabel="Xác nhận"
                cancelLabel="Hủy"
                variant="warning"
            />
        </>
    );
}

