'use client';
import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, ShieldCheck, Activity, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '@/lib/auth-api';

const registerSchema = z.object({
  fullName: z.string().min(3, 'Họ tên phải chứa ít nhất 3 ký tự'),
  email: z.string().min(1, 'Email không được để trống').email('Email không đúng định dạng'),
  password: z.string().min(8, 'Mật khẩu phải chứa ít nhất 8 ký tự'),
  terms: z.boolean().refine(val => val === true, {
    message: 'Bạn phải đồng ý với Điều khoản dịch vụ',
  }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
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
      // @ts-ignore - literal true checkbox workaround
      terms: false,
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
    <div className="w-full max-w-[896px] flex flex-col md:flex-row items-center gap-[48px] z-10">
      
      {/* Left Column: Branding & Info */}
      <div className="flex-1 flex flex-col items-start gap-[24px]">
        {/* Badge */}
        <div className="bg-[#135bec]/10 rounded-full px-[12px] py-[4px] flex items-center gap-[8px]">
          <div className="relative w-[8px] h-[8px] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#135bec] opacity-75 rounded-full animate-ping"></div>
            <div className="bg-[#135bec] rounded-full w-[8px] h-[8px] z-10"></div>
          </div>
          <span className="font-['Inter'] font-bold text-[#135bec] text-[12px] uppercase tracking-[0.6px] leading-[16px]">
            Tham gia cộng đồng 10K+ người dùng
          </span>
        </div>

        {/* Headline */}
        <div className="font-['Inter'] font-black text-[48px] leading-[1.2] tracking-[-1.2px]">
          <span className="text-[#0f172a] block">Kiến tạo tương lai</span>
          <span className="text-[#135bec] block">của bạn từ hôm</span>
          <span className="text-[#135bec] block">nay.</span>
        </div>

        {/* Subhead */}
        <p className="font-['Inter'] font-normal text-[#475569] text-[18px] leading-[28px] max-w-[448px]">
          Đăng ký tài khoản để khám phá trọn bộ công cụ tối ưu hóa hiệu suất và quản lý tài chính thông minh.
        </p>

        {/* Features Margin */}
        <div className="flex flex-col gap-[16px] w-full pt-[16px]">
          {/* Feature 1 */}
          <div className="flex items-center gap-[16px]">
            <div className="w-[40px] h-[40px] rounded-full bg-white border border-[#f1f5f9] flex items-center justify-center shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] text-[#135bec]">
              <ShieldCheck size={20} strokeWidth={2.5} />
            </div>
            <span className="font-['Inter'] font-medium text-[#0f172a] text-[16px] leading-[24px]">
              Bảo mật đa lớp tiêu chuẩn quốc tế
            </span>
          </div>
          {/* Feature 2 */}
          <div className="flex items-center gap-[16px]">
            <div className="w-[40px] h-[40px] rounded-full bg-white border border-[#f1f5f9] flex items-center justify-center shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] text-[#135bec]">
              <Activity size={20} strokeWidth={2.5} />
            </div>
            <span className="font-['Inter'] font-medium text-[#0f172a] text-[16px] leading-[24px]">
              Xử lý dữ liệu thời gian thực
            </span>
          </div>
        </div>
      </div>

      {/* Right Column: Registration Form */}
      <div className="flex-1 bg-white border border-[#f1f5f9] rounded-[24px] shadow-[0_25px_50px_-12px_rgba(226,232,240,0.5)] pt-[41px] pb-[57px] px-[41px] w-full max-w-[480px]">
        <div className="flex flex-col gap-[32px]">
          
          {/* Form Header */}
          <div className="flex flex-col gap-[8px]">
            <h2 className="font-['Inter'] font-bold text-[#0f172a] text-[24px] leading-[32px]">
              Tạo tài khoản mới
            </h2>
            <p className="font-['Inter'] font-normal text-[#64748b] text-[14px] leading-[20px]">
              Điền thông tin bên dưới để bắt đầu trải nghiệm.
            </p>
          </div>

          {/* Form Fields Container */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[20px]">
            
            {/* Full Name */}
            <div className="flex flex-col gap-[8px]">
              <label className="font-['Inter'] font-semibold text-[#334155] text-[14px]">
                Họ và tên
              </label>
              <div className={`bg-[#f8fafc] rounded-[12px] h-[56px] relative flex items-center border transition-all ${errors.fullName ? 'border-red-500 bg-white ring-1 ring-red-500' : 'border-transparent focus-within:border-[#135bec] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#135bec]'}`}>
                <div className="absolute left-[16px] text-[#94a3b8] pointer-events-none flex items-center">
                  <User size={20} />
                </div>
                <input 
                  type="text" 
                  placeholder="Nguyễn Văn A"
                  className="w-full h-full bg-transparent text-[#0f172a] text-[16px] font-['Inter'] placeholder:text-[#94a3b8] outline-none pl-[48px] pr-[16px]"
                  disabled={isLoading}
                  {...register('fullName')}
                />
              </div>
              {errors.fullName && <span className="text-red-500 text-sm mt-1">{errors.fullName.message}</span>}
            </div>

            {/* Email Field */}
            <div className="flex flex-col gap-[8px]">
              <label className="font-['Inter'] font-semibold text-[#334155] text-[14px]">
                Địa chỉ Email
              </label>
              <div className={`bg-[#f8fafc] rounded-[12px] h-[56px] relative flex items-center border transition-all ${errors.email ? 'border-red-500 bg-white ring-1 ring-red-500' : 'border-transparent focus-within:border-[#135bec] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#135bec]'}`}>
                <div className="absolute left-[16px] text-[#94a3b8] pointer-events-none flex items-center">
                  <Mail size={20} />
                </div>
                <input 
                  type="email" 
                  placeholder="example@company.com"
                  className="w-full h-full bg-transparent text-[#0f172a] text-[16px] font-['Inter'] placeholder:text-[#94a3b8] outline-none pl-[48px] pr-[16px]"
                  disabled={isLoading}
                  {...register('email')}
                />
              </div>
              {errors.email && <span className="text-red-500 text-sm mt-1">{errors.email.message}</span>}
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-[8px]">
              <label className="font-['Inter'] font-semibold text-[#334155] text-[14px]">
                Mật khẩu
              </label>
              <div className={`bg-[#f8fafc] rounded-[12px] h-[56px] relative flex items-center flex-row border transition-all ${errors.password ? 'border-red-500 bg-white ring-1 ring-red-500' : 'border-transparent focus-within:border-[#135bec] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#135bec]'}`}>
                <div className="absolute left-[16px] text-[#94a3b8] pointer-events-none flex items-center">
                  <Lock size={20} />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Tối thiểu 8 ký tự"
                  className="w-full h-full bg-transparent text-[#0f172a] text-[16px] tracking-wide font-['Inter'] placeholder:text-[#94a3b8] outline-none pl-[48px] pr-[16px]"
                  disabled={isLoading}
                  {...register('password')}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-[16px] text-slate-400 hover:text-slate-600 outline-none flex items-center justify-center"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && <span className="text-red-500 text-sm mt-1">{errors.password.message}</span>}
            </div>

            {/* Terms Checkbox */}
            <div className="flex flex-col gap-1 pt-[8px]">
              <div className="flex gap-[12px] items-start">
                <input 
                  type="checkbox" 
                  id="terms" 
                  className="w-5 h-5 flex-shrink-0 mt-[1px] border-[#e2e8f0] rounded text-[#135bec] focus:ring-[#135bec] bg-white cursor-pointer"
                  disabled={isLoading}
                  {...register('terms')}
                />
                <label htmlFor="terms" className="font-['Inter'] font-normal text-[#64748b] text-[14px] leading-[20px] cursor-pointer">
                  Tôi đồng ý với các{' '}
                  <Link href="#" className="font-semibold text-[#135bec] hover:underline">Điều khoản dịch vụ</Link>{' '}
                  và{' '}
                  <Link href="#" className="font-semibold text-[#135bec] hover:underline">Chính sách bảo mật</Link>{' '}
                  của NexusGlobal.
                </label>
              </div>
              {errors.terms && <span className="text-red-500 text-sm pl-8">{errors.terms.message}</span>}
            </div>

            {/* Register Button */}
            <button 
              type="submit"
              disabled={isLoading}
              className={`bg-[#135bec] hover:bg-blue-700 text-white rounded-[12px] h-[56px] flex items-center justify-center relative shadow-[0_10px_15px_-3px_rgba(19,91,236,0.2),0_4px_6px_-4px_rgba(19,91,236,0.2)] transition-all w-full mt-2 ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <span className="font-['Inter'] font-bold text-[18px] leading-[28px]">Đăng ký ngay</span>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center py-[16px] w-full">
              <div className="flex-1 border-t border-[#f1f5f9]"></div>
              <span className="px-[16px] font-['Inter'] font-medium text-[#94a3b8] text-[12px] tracking-[1.2px] uppercase">
                Hoặc
              </span>
              <div className="flex-1 border-t border-[#f1f5f9]"></div>
            </div>

            {/* Social Logins */}
            <div className="flex flex-col sm:flex-row gap-[16px] w-full">
              <button type="button" disabled={isLoading} className="flex-1 bg-white border border-[#e2e8f0] hover:bg-slate-50 h-[48px] rounded-[12px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="font-['Inter'] font-semibold text-[#0f172a] text-[14px]">Google</span>
              </button>
              <button type="button" disabled={isLoading} className="flex-1 bg-white border border-[#e2e8f0] hover:bg-slate-50 h-[48px] rounded-[12px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
                    <path d="M16.671 15.542l.532-3.469h-3.328v-2.25c0-.949.465-1.874 1.956-1.874h1.514V5.006s-1.374-.235-2.686-.235c-2.741 0-4.533 1.662-4.533 4.669v2.633H7.078v3.469h3.047v8.385a12.09 12.09 0 003.75 0v-8.385h2.796z" fill="white"/>
                </svg>
                <span className="font-['Inter'] font-semibold text-[#0f172a] text-[14px]">Facebook</span>
              </button>
            </div>
            
            {/* Footer Form Link */}
            <div className="flex flex-col items-center pt-[16px]">
              <p className="font-['Inter'] font-normal text-[#64748b] text-[14px]">
                Đã có tài khoản?{' '}
                <Link href="/login" className="font-bold text-[#135bec] hover:underline">
                  Đăng nhập tại đây
                </Link>
              </p>
            </div>

          </form>
        </div>
      </div>

    </div>
  );
}
