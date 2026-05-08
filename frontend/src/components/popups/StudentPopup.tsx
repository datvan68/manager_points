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
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';

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

                <div className="py-6 gap-x-6 gap-y-6 grid grid-cols-2">
                    {/* Mã sinh viên */}
                    <Input 
                        label="Mã sinh viên"
                        required
                        placeholder="Nhập mã SV"
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
                    <Input 
                        label="Ngày sinh"
                        type="date"
                        {...register('dob')}
                        error={errors.dob?.message}
                    />

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

                    {/* Khoa */}
                    <div className="col-span-1 space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 px-1">Khoa</label>
                        <Controller
                            name="department"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className={`w-full h-10 px-3 bg-[#f8fafc] border-slate-200/60 rounded-lg text-[14px] text-slate-900 transition-all focus:ring-2 focus:ring-[#135bec]/20 focus:outline-none focus:bg-white shadow-none`}>
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
                        {errors.department && <p className="px-1 text-[12px] font-medium text-red-500 mt-0.5">{errors.department.message}</p>}
                    </div>
                     
                    {/* Lớp */}
                    <div className="col-span-1 space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 px-1">Lớp</label>
                        <Controller
                            name="classId"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className={`w-full h-10 px-3 bg-[#f8fafc] border-slate-200/60 rounded-lg text-[14px] text-slate-900 transition-all focus:ring-2 focus:ring-[#135bec]/20 focus:outline-none focus:bg-white shadow-none`}>
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
                        {errors.classId && <p className="px-1 text-[12px] font-medium text-red-500 mt-0.5">{errors.classId.message}</p>}
                    </div>
                </div>

                {/* BOTTOM Section: Actions */}
                <div className="pt-4 flex items-center justify-end gap-3">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        type="button"
                    >
                        Huỷ
                    </Button>
                    <Button
                        type="submit"
                    >
                        {initialData ? "Lưu thay đổi" : "Thêm mới"}
                    </Button>
                </div>
            </form>
        </Popup>
    );
}
