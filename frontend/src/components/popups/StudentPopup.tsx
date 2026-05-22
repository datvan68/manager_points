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
    status: z.enum(['Studying', 'Reserved', 'Dropped', 'Graduated']),
});

type FormValues = z.infer<typeof formSchema>;

export default function StudentPopup({ isOpen, onClose, initialData, defaultClassId, onSuccess }: StudentPopupProps) {
    const [classesList, setClassesList] = useState<Class[]>([]);
    const [departmentsList, setDepartmentsList] = useState<Department[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);

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

    const onSubmit = async (data: FormValues) => {
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
        }
    };

    return (
        <Popup isOpen={isOpen} onClose={onClose} className="max-w-fit" contentClassName="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col w-[600px] max-w-[95vw]">
                {/* Header Custom as per Figma */}
                <div className="flex items-center justify-between pb-6 border-b border-[#f1f5f9]">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-[20px] font-bold text-[#0f172a] tracking-wide">
                            {initialData ? "Sửa Sinh viên" : "Thêm Sinh viên"}
                        </h2>
                        <p className="text-[14px] text-[#64748b]">
                            Điền thông tin hồ sơ sinh viên {initialData ? "hiện tại" : "mới"}
                        </p>
                    </div>
                </div>

                <div className="py-6 gap-x-6 gap-y-6 grid grid-cols-2">
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
                        <label className="text-sm font-medium text-slate-700 px-1">
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
                                                className={`w-full h-10 px-3 bg-[#f8fafc] border border-slate-200/60 rounded-lg text-[14px] transition-all flex items-center justify-between hover:bg-slate-100/50 focus:ring-2 focus:ring-[#135bec]/20 focus:outline-none focus:bg-white ${errors.dob ? 'border-red-500' : ''}`}
                                            >
                                                <span className={selectedDate && !isNaN(selectedDate.getTime()) ? 'text-slate-900' : 'text-slate-400'}>
                                                    {selectedDate && !isNaN(selectedDate.getTime())
                                                        ? format(selectedDate, 'dd/MM/yyyy')
                                                        : 'Chọn ngày sinh'}
                                                </span>
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            className="w-auto p-0 z-[110] bg-transparent border-none shadow-none"
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
                    <div className="col-span-1 space-y-2">
                        <label className="text-sm font-medium text-slate-700">Giới tính</label>
                        <div className="flex gap-[24px] h-10 items-center">
                            <label className="flex items-center gap-[7px] cursor-pointer group">
                                <div className="relative flex items-center justify-center w-[18px] h-[18px]">
                                    <input
                                        type="radio"
                                        name="gender"
                                        value="Nam"
                                        checked={genderValue === 'Nam'}
                                        onChange={() => setValue('gender', 'Nam')}
                                        className="peer appearance-none w-[16px] h-[16px] border border-[#cbd5e1] rounded-full focus:outline-none checked:bg-[#135bec] checked:border-transparent transition-all cursor-pointer m-0"
                                    />
                                    <div className="absolute w-[6px] h-[6px] bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                </div>
                                <span className="text-[14px] text-[#475569]">Nam</span>
                            </label>

                            <label className="flex items-center gap-[8px] cursor-pointer group">
                                <div className="relative flex items-center justify-center w-[18px] h-[18px]">
                                    <input
                                        type="radio"
                                        name="gender"
                                        value="Nữ"
                                        checked={genderValue === 'Nữ'}
                                        onChange={() => setValue('gender', 'Nữ')}
                                        className="peer appearance-none w-[16px] h-[16px] border border-[#cbd5e1] rounded-full focus:outline-none checked:bg-[#135bec] checked:border-transparent transition-all cursor-pointer m-0"
                                    />
                                    <div className="absolute w-[6px] h-[6px] bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                </div>
                                <span className="text-[14px] text-[#475569]">Nữ</span>
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
                        <label className="text-sm font-medium text-slate-700 px-1">Lớp</label>
                        {isLoadingData ? (
                            <div className="flex items-center gap-2 h-10 px-3 bg-gray-50 border border-slate-200/60 rounded-lg text-sm text-gray-500">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                Đang tải danh sách lớp...
                            </div>
                        ) : (
                            <Controller
                                name="classId"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className={`w-full h-10 px-3 bg-[#f8fafc] border-slate-200/60 rounded-lg text-[14px] text-slate-900 transition-all focus:ring-2 focus:ring-[#135bec]/20 focus:outline-none focus:bg-white shadow-none`}>
                                            <SelectValue placeholder="Chọn lớp" />
                                        </SelectTrigger>
                                        <SelectContent position="popper" className="z-[100] min-w-[var(--radix-select-trigger-width)] bg-white rounded-xl shadow-xl border border-gray-100 p-1">
                                            {classesList.map(cls => (
                                                <SelectItem key={cls._id} value={cls._id} className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">
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
                        <label className="text-sm font-medium text-slate-700 px-1">Khoa</label>
                        {isLoadingData ? (
                            <div className="flex items-center gap-2 h-10 px-3 bg-gray-50 border border-slate-200/60 rounded-lg text-sm text-gray-500">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                Đang tải danh sách khoa...
                            </div>
                        ) : (
                            <Controller
                                name="department"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value} disabled>
                                        <SelectTrigger className={`w-full h-10 px-3 bg-[#f8fafc] border-slate-200/60 rounded-lg text-[14px] text-slate-900 transition-all focus:ring-2 focus:ring-[#135bec]/20 focus:outline-none focus:bg-white shadow-none opacity-80 cursor-not-allowed`}>
                                            <SelectValue placeholder="Khoa tự chọn theo Lớp" />
                                        </SelectTrigger>
                                        <SelectContent position="popper" className="z-[100] min-w-[var(--radix-select-trigger-width)] bg-white rounded-xl shadow-xl border border-gray-100 p-1">
                                            {departmentsList.map(dept => (
                                                <SelectItem key={dept._id} value={dept._id} className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">
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
                        <label className="text-sm font-medium text-slate-700 px-1">Trạng thái</label>
                        <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="w-full h-10 px-3 bg-[#f8fafc] border-slate-200/60 rounded-lg text-[14px] text-slate-900 transition-all focus:ring-2 focus:ring-[#135bec]/20 focus:outline-none focus:bg-white shadow-none">
                                        <SelectValue placeholder="Chọn trạng thái" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="z-[100] min-w-[var(--radix-select-trigger-width)] bg-white rounded-xl shadow-xl border border-gray-100 p-1">
                                        <SelectItem value="Studying" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">
                                            Đang học
                                        </SelectItem>
                                        <SelectItem value="Reserved" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">
                                            Bảo lưu
                                        </SelectItem>
                                        <SelectItem value="Dropped" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">
                                            Thôi học
                                        </SelectItem>
                                        <SelectItem value="Graduated" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">
                                            Tốt nghiệp
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.status && <p className="px-1 text-[12px] font-medium text-red-500 mt-0.5">{errors.status.message}</p>}
                    </div>
                </div>

                {/* BOTTOM Section: Actions */}
                <div className="pt-4 flex items-center justify-end gap-3">
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
    );
}

