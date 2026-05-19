'use client';
import React, { useState } from 'react';
import { Mail, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '@/api/auth-api';

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email không được để trống').email('Email không đúng định dạng'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      await authApi.forgotPassword(data.email);
      toast.success('Yêu cầu đã được gửi', {
        description: `Vui lòng kiểm tra hòm thư ${data.email} để đặt lại mật khẩu.`,
      });
      router.push('/reset-password');
    } catch (err: any) {
      toast.error('Gửi yêu cầu thất bại', {
        description: err.message || 'Đã xảy ra lỗi.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] flex flex-col gap-[32px] z-10">
        
        {/* Top Icon */}
        <div className="flex justify-center w-full">
          <div className="bg-[rgba(19,91,236,0.1)] rounded-full w-[80px] h-[80px] flex items-center justify-center">
            {/* Custom SVG Grid Icon */}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="7" height="7" rx="1" fill="#135bec"/>
              <rect x="14" y="3" width="7" height="7" rx="1" fill="#135bec"/>
              <rect x="14" y="14" width="7" height="7" rx="1" fill="#135bec"/>
              <rect x="3" y="14" width="7" height="7" rx="1" fill="#135bec"/>
            </svg>
          </div>
        </div>

        {/* Content Header */}
        <div className="flex flex-col gap-[12px] items-center text-center">
          <h1 className="font-['Inter'] font-black text-[#0f172a] text-[30px] tracking-[-0.75px] leading-[36px]">
            Quên mật khẩu?
          </h1>
          <p className="font-['Inter'] font-normal text-[#64748b] text-[16px] leading-[26px]">
            Nhập địa chỉ email liên kết với tài khoản của bạn và chúng tôi sẽ gửi liên kết để đặt lại mật khẩu của bạn.
          </p>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[24px] w-full mt-2">
          {/* Email Field */}
          <div className="flex flex-col gap-[8px]">
            <label className="font-['Inter'] font-semibold text-[#334155] text-[14px]">
              Địa chỉ Email
            </label>
            <div className={`bg-white border rounded-[12px] h-[56px] relative flex items-center shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] transition-all ${errors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-[#e2e8f0] focus-within:border-[#135bec] focus-within:ring-1 focus-within:ring-[#135bec]'}`}>
              <div className="absolute left-[16px] text-slate-400 pointer-events-none flex items-center">
                <Mail size={20} />
              </div>
              <input 
                type="email" 
                placeholder="name@example.com"
                className="w-full h-full bg-transparent text-[#0f172a] text-[16px] font-['Inter'] placeholder:text-[#94a3b8] outline-none pl-[48px] pr-[16px]"
                disabled={isLoading}
                {...register('email')}
              />
            </div>
            {errors.email && <span className="text-red-500 text-sm mt-1">{errors.email.message}</span>}
          </div>

          {/* Submit Button */}
          <button 
            type="submit"
            disabled={isLoading}
            className={`bg-[#135bec] hover:bg-blue-700 text-white rounded-[12px] h-[56px] flex items-center justify-center gap-2 relative shadow-[0_20px_25px_-5px_rgba(19,91,236,0.25),0_8px_10px_-6px_rgba(19,91,236,0.25)] transition-all w-full px-[24px] ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <>
                <span className="font-['Inter'] font-bold text-[18px]">Gửi liên kết đặt lại</span>
                <ArrowRight size={20} strokeWidth={2.5} />
              </>
            )}
          </button>
        </form>

        {/* Back to Login Link */}
        <div className="flex justify-center -mt-2">
          <Link href="/login" className="flex items-center gap-[8px] font-['Inter'] font-medium text-[#135bec] text-[16px] hover:text-blue-700 transition-colors">
            <ArrowLeft size={18} strokeWidth={2.5} />
            Quay lại trang Đăng nhập
          </Link>
        </div>

        {/* Support Notice */}
        <div className="w-full border-t border-[#e2e8f0] pt-[32px] mt-4 flex items-center justify-center">
          <p className="font-['Inter'] font-normal text-[#64748b] text-[14px] text-center">
            Bạn gặp khó khăn?{' '}
            <Link href="#" className="font-semibold text-[#135bec] hover:underline">
              Liên hệ bộ phận hỗ trợ
            </Link>
          </p>
        </div>

    </div>
  );
}
