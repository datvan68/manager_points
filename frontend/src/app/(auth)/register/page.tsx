'use client';
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '@/api/auth-api';

const registerSchema = z.object({
  fullName: z.string().min(3, 'Họ tên phải chứa ít nhất 3 ký tự'),
  email: z.string().min(1, 'Email không được để trống').email('Email không đúng định dạng'),
  password: z.string().min(8, 'Mật khẩu phải chứa ít nhất 8 ký tự'),
  confirmPassword: z.string().min(8, 'Xác nhận mật khẩu không được để trống'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Mật khẩu xác nhận không trùng khớp",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      await authApi.register(data.fullName, data.email, data.password);
      toast.success('Đăng ký tài khoản thành công!', {
        description: 'Vui lòng đăng nhập để tiếp tục.',
      });
      router.push('/login');
    } catch (err: any) {
      toast.error('Đăng ký thất bại', {
        description: err.message || 'Đã xảy ra lỗi khi tạo tài khoản.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Background Gradient */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(135deg, rgb(235, 242, 250) 0%, rgb(220, 230, 241) 100%)"
        }}
      />

      <div className="w-full max-w-[512px] z-10 px-4">
        {/* Create Account Card */}
        <div className="backdrop-blur-[6px] bg-white/45 border border-white/75 flex flex-col gap-[31.5px] items-stretch p-6 sm:p-[41px] relative rounded-[24px] shadow-[0px_4px_20px_rgba(203,213,225,0.4)]">

          {/* Trust Badge */}
          <div className="flex justify-center w-full">
            <div className="backdrop-blur-[2px] bg-white/50 border border-white/80 flex items-center justify-center px-[29px] py-[9px] rounded-full shadow-[0px_1px_2px_rgba(0,0,0,0.05)] shrink-0">
              <span className="font-['Inter'] font-semibold text-[#566069] text-[11px] tracking-[0.275px] whitespace-nowrap">
                HỌC SINH SINH VIÊN
              </span>
            </div>
          </div>

          {/* Heading Container */}
          <div className="flex flex-col gap-[8px] items-center text-center">
            <h1 className="font-['Inter'] font-semibold text-[#111c2d] text-[36px] tracking-tight leading-[44px]">
              Đăng ký tài khoản
            </h1>
            <p className="font-['Inter'] font-semibold text-[#64748b] text-[14px] leading-[20px]">
              Bắt đầu hành trình cùng Học sinh sinh viên
            </p>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[20px] w-full">

            {/* Full Name Field */}
            <div className="flex flex-col gap-[8px] w-full">
              <div className="pl-[16px]">
                <label className="font-['Inter'] font-medium text-[#566069] text-[11px] tracking-[1.1px] uppercase">
                  Họ và Tên
                </label>
              </div>
              <div className={`bg-white/40 border border-white/75 rounded-full h-[48px] px-[25px] flex items-center transition-all ${errors.fullName ? 'border-red-500 ring-1 ring-red-500 bg-red-50/10' : 'focus-within:border-[#005bbf] focus-within:ring-1 focus-within:ring-[#005bbf] focus-within:bg-white/80'}`}>
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  className="w-full h-full bg-transparent text-[#0f172a] text-[14px] font-['Inter'] font-semibold placeholder:text-[#c1c6d6] outline-none"
                  disabled={isLoading}
                  {...register('fullName')}
                />
              </div>
              {errors.fullName && (
                <span className="text-red-500 text-[12px] mt-1 pl-[16px]">{errors.fullName.message}</span>
              )}
            </div>

            {/* Email Field */}
            <div className="flex flex-col gap-[8px] w-full">
              <div className="pl-[16px]">
                <label className="font-['Inter'] font-medium text-[#566069] text-[11px] tracking-[1.1px] uppercase">
                  Email
                </label>
              </div>
              <div className={`bg-white/40 border border-white/75 rounded-full h-[48px] px-[25px] flex items-center transition-all ${errors.email ? 'border-red-500 ring-1 ring-red-500 bg-red-50/10' : 'focus-within:border-[#005bbf] focus-within:ring-1 focus-within:ring-[#005bbf] focus-within:bg-white/80'}`}>
                <input
                  type="email"
                  placeholder="example@lumina.com"
                  className="w-full h-full bg-transparent text-[#0f172a] text-[14px] font-['Inter'] font-semibold placeholder:text-[#c1c6d6] outline-none"
                  disabled={isLoading}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <span className="text-red-500 text-[12px] mt-1 pl-[16px]">{errors.email.message}</span>
              )}
            </div>

            {/* Passwords Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px] w-full">

              {/* Password */}
              <div className="flex flex-col gap-[8px] w-full">
                <div className="pl-[16px]">
                  <label className="font-['Inter'] font-medium text-[#566069] text-[11px] tracking-[1.1px] uppercase">
                    Mật khẩu
                  </label>
                </div>
                <div className={`bg-white/40 border border-white/75 rounded-full h-[48px] px-[25px] flex items-center transition-all ${errors.password ? 'border-red-500 ring-1 ring-red-500 bg-red-50/10' : 'focus-within:border-[#005bbf] focus-within:ring-1 focus-within:ring-[#005bbf] focus-within:bg-white/80'}`}>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full h-full bg-transparent text-[#0f172a] text-[14px] font-['Inter'] font-semibold placeholder:text-[#c1c6d6] outline-none tracking-widest"
                    disabled={isLoading}
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <span className="text-red-500 text-[12px] mt-1 pl-[16px]">{errors.password.message}</span>
                )}
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col gap-[8px] w-full">
                <div className="pl-[16px]">
                  <label className="font-['Inter'] font-medium text-[#566069] text-[11px] tracking-[1.1px] uppercase">
                    Xác nhận
                  </label>
                </div>
                <div className={`bg-white/40 border border-white/75 rounded-full h-[48px] px-[25px] flex items-center transition-all ${errors.confirmPassword ? 'border-red-500 ring-1 ring-red-500 bg-red-50/10' : 'focus-within:border-[#005bbf] focus-within:ring-1 focus-within:ring-[#005bbf] focus-within:bg-white/80'}`}>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full h-full bg-transparent text-[#0f172a] text-[14px] font-['Inter'] font-semibold placeholder:text-[#c1c6d6] outline-none tracking-widest"
                    disabled={isLoading}
                    {...register('confirmPassword')}
                  />
                </div>
                {errors.confirmPassword && (
                  <span className="text-red-500 text-[12px] mt-1 pl-[16px]">{errors.confirmPassword.message}</span>
                )}
              </div>

            </div>

            {/* Register Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`bg-[#005bbf] hover:bg-[#004da3] text-white rounded-full h-[48px] flex items-center justify-center gap-2 relative shadow-[0px_4px_6px_rgba(0,0,0,0.05)] transition-all mt-4 w-full ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <span className="font-['Inter'] font-semibold text-[20px]">Đăng ký ngay</span>
              )}
            </button>

            {/* Bottom Link Paragraph */}
            <div className="flex justify-center w-full mt-2 font-['Inter'] font-semibold text-[14px]">
              <span className="text-[#414754]">
                Bạn đã có tài khoản?{' '}
                <Link href="/login" className="text-[#005bbf] font-bold hover:underline ml-1">
                  Đăng nhập
                </Link>
              </span>
            </div>

          </form>

        </div>
      </div>
    </>
  );
}
