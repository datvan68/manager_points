'use client';
import React, { useEffect } from 'react';
import Popup from './Popup';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';

interface DepartmentPopupProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: FormValues | null;
}

const formSchema = z.object({
    name: z.string().min(2, { message: "Tên khoa phải có ít nhất 2 ký tự." }),
    code: z.string().min(2, { message: "Mã khoa phải có ít nhất 2 ký tự." }).max(10, { message: "Mã khoa tối đa 10 ký tự." }),
});

type FormValues = z.infer<typeof formSchema>;

export default function DepartmentPopup({ isOpen, onClose, initialData }: DepartmentPopupProps) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            code: ''
        }
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                reset(initialData);
            } else {
                reset({ name: '', code: '' });
            }
        }
    }, [isOpen, initialData, reset]);

    const onSubmit = (data: FormValues) => {
        console.log('Submitting department:', data);
        if (initialData) {
            toast.success(`Đã cập nhật khoa: ${data.name}`);
        } else {
            toast.success(`Đã thêm khoa mới: ${data.name}`);
        }
        onClose();
    };

    const isEditMode = !!initialData;

    return (
        <Popup isOpen={isOpen} onClose={onClose} title={isEditMode ? "Sửa Khoa" : "Thêm Khoa"}>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 pt-2">
                <div className="flex flex-col gap-5 px-1">
                    <Input 
                        label="Tên khoa"
                        required
                        placeholder="Vui lòng nhập tên khoa"
                        {...register('name')}
                        error={errors.name?.message}
                    />

                    <div className="space-y-1">
                        <Input 
                            label="Mã khoa"
                            required
                            placeholder="NHẬP MÃ KHOA"
                            className="uppercase placeholder:normal-case"
                            {...register('code')}
                            error={errors.code?.message}
                        />
                        {!errors.code && (
                            <p className="text-[12px] text-[#94a3b8] px-1">Mã khoa nên viết tắt, không dấu và viết hoa.</p>
                        )}
                    </div>
                </div>

                {/* BOTTOM Section: Actions */}
                <div className="pt-4 border-t border-[#f1f5f9] flex items-center justify-end gap-3 mt-2">
                    <Button 
                        type="button" 
                        variant="secondary"
                        onClick={onClose}
                    >
                        Huỷ
                    </Button>
                    <Button 
                        type="submit" 
                    >
                        {isEditMode ? "Lưu thay đổi" : "Thêm khoa"}
                    </Button>
                </div>
            </form>
        </Popup>
    );
}
