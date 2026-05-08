'use client';
import React, { useEffect } from 'react';
import Popup from './Popup';
import { 
  User, Calendar, Mail, Phone, 
  School, Check, Download, Users
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StudentPopupProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: FormValues | null;
}

const formSchema = z.object({
    fullName: z.string().min(2, { message: "Họ và tên bắt buộc nhập" }),
    dob: z.string().min(1, { message: "Ngày sinh bắt buộc nhập" }),
    gender: z.enum(['Nam', 'Nữ']),
    email: z.string().email({ message: "Email không hợp lệ" }).or(z.literal('')),
    phone: z.string().optional(),
    studentId: z.string().min(1, { message: "Mã sinh viên bắt buộc nhập" }),
    department: z.string().min(1, { message: "Khoa bắt buộc nhập" }),
    classId: z.string().min(1, { message: "Lớp bắt buộc nhập" }),
});

type FormValues = z.infer<typeof formSchema>;

export default function StudentPopup({ isOpen, onClose, initialData }: StudentPopupProps) {
    const {
        register,
        control,
        handleSubmit,
        reset,
        watch,
        setValue,
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
            classId: ''
        }
    });

    const genderValue = watch('gender');

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
                    classId: ''
                });
            }
        }
    }, [isOpen, initialData, reset]);

    const onSubmit = (data: FormValues) => {
        console.log('Submitting student:', data);
        const action = initialData ? 'cập nhật' : 'thêm';
        toast.success(`Đã ${action} sinh viên: ${data.fullName}`);
        onClose();
    };

    return (
        <Popup isOpen={isOpen} onClose={onClose} className="max-w-fit">
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
                    {!initialData && (
                        <button type="button" className="flex items-center justify-center gap-2 px-[13px] py-[7px] border border-transparent hover:bg-gray-50 rounded-[8px] transition-colors">
                            <Download size={15} className="text-[#475569]" />
                            <span className="text-[14px] font-medium text-[#475569]">Import</span>
                        </button>
                    )}
                </div>

                <div className="py-6 gap-x-6 gap-y-6 grid grid-cols-2 border-b border-transparent">
                    {/* Mã sinh viên */}
                    <div className="col-span-1 space-y-[8.5px]">
                        <label className="text-[12px] font-bold text-[#334155] uppercase tracking-[0.6px]">
                            Mã sinh viên <span className="text-[#ef4444]">*</span>
                        </label>
                        <div className="relative">
                            <div className="absolute left-[12px] top-1/2 -translate-y-1/2 text-gray-400">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M2.66663 3.33333C2.66663 2.59695 3.26358 2 3.99996 2H12C12.7363 2 13.3333 2.59695 13.3333 3.33333V12.6667C13.3333 13.403 12.7363 14 12 14H3.99996C3.26358 14 2.66663 13.403 2.66663 12.6667V3.33333Z" stroke="#94A3B8" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M6 5.33333H10M6 8H10M6 10.6667H8" stroke="#94A3B8" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                            <input 
                                type="text" 
                                {...register('studentId')}
                                placeholder="Nhập mã SV"
                                className={`w-full pl-[40px] pr-[16px] py-[13px] bg-[#f8fafc] rounded-[12px] text-[14px] text-[#6b7280] focus:outline-none focus:ring-2 transition-all ${errors.studentId ? 'ring-red-500 bg-red-50' : 'focus:ring-primary/20 focus:bg-white'}`}
                            />
                        </div>
                        {errors.studentId && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.studentId.message}</p>}
                    </div>

                    {/* Họ và tên */}
                    <div className="col-span-1 space-y-[8.5px]">
                        <label className="text-[12px] font-bold text-[#334155] uppercase tracking-[0.6px]">
                            Họ và tên <span className="text-[#ef4444]">*</span>
                        </label>
                        <div className="relative">
                            <div className="absolute left-[12px] top-1/2 -translate-y-1/2 text-gray-400">
                                <User size={15} color="#94A3B8" />
                            </div>
                            <input 
                                type="text" 
                                {...register('fullName')}
                                placeholder="Nhập họ và tên đầy đủ"
                                className={`w-full pl-[40px] pr-[16px] py-[13px] bg-[#f8fafc] rounded-[12px] text-[14px] text-[#6b7280] focus:outline-none focus:ring-2 transition-all ${errors.fullName ? 'ring-red-500 bg-red-50' : 'focus:ring-primary/20 focus:bg-white'}`}
                            />
                        </div>
                        {errors.fullName && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.fullName.message}</p>}
                    </div>

                    {/* Ngày sinh */}
                    <div className="col-span-1 space-y-[8.5px]">
                        <label className="text-[12px] font-bold text-[#334155] uppercase tracking-[0.6px]">Ngày sinh</label>
                        <div className="relative">
                            <div className="absolute left-[12px] top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <Calendar size={15} color="#94A3B8" />
                            </div>
                            <input 
                                type="date" 
                                {...register('dob')}
                                className={`w-full pl-[40px] pr-[16px] py-[12px] bg-[#f8fafc] rounded-[12px] text-[14px] text-[#475569] focus:outline-none focus:ring-2 transition-all ${errors.dob ? 'ring-red-500 bg-red-50' : 'focus:ring-primary/20 focus:bg-white'}`}
                            />
                        </div>
                        {errors.dob && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.dob.message}</p>}
                    </div>

                    {/* Giới tính */}
                    <div className="col-span-1 space-y-[8.5px]">
                        <label className="text-[12px] font-bold text-[#334155] uppercase tracking-[0.6px]">Giới tính</label>
                        <div className="flex gap-[24px] h-[46px] items-center">
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

                    {/* Khoa */}
                    <div className="col-span-1 space-y-[8.5px]">
                        <label className="text-[12px] font-bold text-[#334155] uppercase tracking-[0.6px]">Khoa</label>
                        <Controller
                            name="department"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className={`w-full h-[46px] px-[16px] bg-[#f8fafc] border-transparent rounded-[12px] text-[14px] text-[#475569] transition-all focus:ring-2 focus:ring-primary/20 focus:outline-none focus:bg-white shadow-none`}>
                                        <SelectValue placeholder="Chọn khoa" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="z-[100] min-w-[var(--radix-select-trigger-width)] bg-white rounded-xl shadow-xl border border-gray-100 p-1">
                                        <SelectItem value="CNTT" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">Công nghệ thông tin</SelectItem>
                                        <SelectItem value="Kinh Tế" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">Kinh tế</SelectItem>
                                        <SelectItem value="Ngoại Ngữ" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">Ngoại ngữ</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.department && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.department.message}</p>}
                    </div>
                     
                    {/* Lớp */}
                    <div className="col-span-1 space-y-[8.5px]">
                        <label className="text-[12px] font-bold text-[#334155] uppercase tracking-[0.6px]">Lớp</label>
                        <Controller
                            name="classId"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className={`w-full h-[46px] px-[16px] bg-[#f8fafc] border-transparent rounded-[12px] text-[14px] text-[#475569] transition-all focus:ring-2 focus:ring-primary/20 focus:outline-none focus:bg-white shadow-none`}>
                                        <SelectValue placeholder="Chọn lớp" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="z-[100] min-w-[var(--radix-select-trigger-width)] bg-white rounded-xl shadow-xl border border-gray-100 p-1">
                                        <SelectItem value="CNTT-K45A" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">CNTT-K45A</SelectItem>
                                        <SelectItem value="CNTT-K45B" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">CNTT-K45B</SelectItem>
                                        <SelectItem value="KT-K45A" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">KT-K45A</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.classId && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.classId.message}</p>}
                    </div>
                </div>

                {/* BOTTOM Section: Actions */}
                <div className="pt-0 flex items-center justify-end gap-[12px]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-[10px] py-[7px] w-[71px] bg-[#f4f4f4] rounded-[6px] text-[14px] font-bold text-[#878787] hover:bg-gray-200 transition-colors shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1)]"
                    >
                        Huỷ
                    </button>
                    <button
                        type="submit"
                        className="px-[10px] py-[7px] rounded-[6px] text-[14px] font-bold text-white bg-[#155dfc] hover:bg-blue-700 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)] transition-colors flex items-center gap-[4px]"
                    >
                        {initialData ? "Lưu thay đổi" : "Thêm mới"}
                    </button>
                </div>
            </form>
        </Popup>
    );
}
