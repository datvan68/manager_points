'use client';
import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi, tokenStorage } from '@/api/auth-api';
import { useAuth } from '@/providers/auth-provider';

const loginSchema = z.object({
  email: z.string().min(1, 'Email hoặc Mã sinh viên không được để trống'),
  password: z.string().min(6, 'Mật khẩu phải chứa ít nhất 6 ký tự'),
  remember: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { checkAuth } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: false,
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const result = await authApi.login(data.email, data.password, !!data.remember);
      tokenStorage.setAccessToken(result.access_token);
      tokenStorage.setUser(result.user);
      
      // Update global auth state
      checkAuth();

      toast.success('Đăng nhập thành công', {
        description: `Chào mừng ${result.user.username} quay trở lại!`,
      });
      router.push('/select-module');
    } catch (err: any) {
      toast.error('Đăng nhập thất bại', {
        description: err.message || 'Vui lòng kiểm tra lại thông tin đăng nhập.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] flex flex-col gap-[32px] z-10">
      {/* Header Section */}
      <div className="flex flex-col gap-2 items-center text-center">
        <h1 className="font-['Inter'] font-bold text-[#0f172a] text-[36px] tracking-tight leading-[40px]">
          Chào mừng quay trở lại
        </h1>
        <p className="font-['Inter'] font-normal text-[#64748b] text-[16px] leading-[24px]">
          Vui lòng đăng nhập vào tài khoản của bạn
        </p>
      </div>

      {/* Main Form Section */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[24px] w-full">
        <div className="flex flex-col gap-[16px]">
          {/* Email Field */}
          <div className="flex flex-col gap-2">
            <label className="font-['Inter'] font-semibold text-[#334155] text-[14px]">
              Email hoặc Mã sinh viên
            </label>
            <div className={`bg-white border rounded-[12px] h-[56px] px-[17px] flex items-center transition-all ${errors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-[#e2e8f0] focus-within:border-[#135bec] focus-within:ring-1 focus-within:ring-[#135bec]'}`}>
              <input 
                type="text" 
                placeholder="Nhập email hoặc mã sinh viên..."
                className="w-full h-full bg-transparent text-[#0f172a] text-[16px] font-['Inter'] placeholder:text-[#6b7280] outline-none"
                disabled={isLoading}
                {...register('email')}
              />
            </div>
            {errors.email && (
              <span className="text-red-500 text-sm mt-1">{errors.email.message}</span>
            )}
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="font-['Inter'] font-semibold text-[#334155] text-[14px]">
                Mật khẩu
              </label>
              <Link href="/forgot-password" className="font-['Inter'] font-semibold text-[#135bec] text-[12px] hover:underline">
                Quên mật khẩu?
              </Link>
            </div>
            <div className={`bg-white border rounded-[12px] h-[56px] px-[17px] pr-[16px] flex items-center gap-3 transition-all ${errors.password ? 'border-red-500 ring-1 ring-red-500' : 'border-[#e2e8f0] focus-within:border-[#135bec] focus-within:ring-1 focus-within:ring-[#135bec]'}`}>
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••"
                className="w-full h-full bg-transparent text-[#0f172a] text-[16px] tracking-widest font-['Inter'] placeholder:text-[#6b7280] outline-none"
                disabled={isLoading}
                {...register('password')}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-slate-600 outline-none flex-shrink-0"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <span className="text-red-500 text-sm mt-1">{errors.password.message}</span>
            )}
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            id="remember" 
            className="w-4 h-4 border-[#cbd5e1] rounded text-[#135bec] focus:ring-[#135bec] bg-white cursor-pointer"
            disabled={isLoading}
            {...register('remember')}
          />
          <label htmlFor="remember" className="font-['Inter'] font-normal text-[#475569] text-[14px] cursor-pointer">
            Ghi nhớ đăng nhập
          </label>
        </div>

        {/* Login Button */}
        <button 
          type="submit"
          disabled={isLoading}
          className={`bg-[#135bec] hover:bg-blue-700 text-white rounded-[12px] h-[56px] flex items-center justify-center gap-2 relative shadow-[0_10px_15px_-3px_rgba(19,91,236,0.2),0_4px_6px_-4px_rgba(19,91,236,0.2)] transition-all ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
        >
          {isLoading ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <>
              <span className="font-['Inter'] font-bold text-[16px]">Đăng nhập</span>
              <ArrowRight size={18} strokeWidth={2.5} />
            </>
          )}
        </button>

        {/* Divider */}
        <div className="relative py-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#e2e8f0]"></div>
          </div>
          <div className="relative bg-[#f6f6f8] px-4 font-['Inter'] font-medium text-[#64748b] text-[12px] uppercase tracking-wider">
            Hoặc đăng nhập bằng
          </div>
        </div>

        {/* Social Logins */}
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <button type="button" disabled={isLoading} className="flex-1 bg-white border border-[#e2e8f0] hover:bg-slate-50 h-[48px] rounded-[12px] flex items-center justify-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="font-['Inter'] font-semibold text-[#0f172a] text-[14px]">Google</span>
          </button>
          <button type="button" disabled={isLoading} className="flex-1 bg-white border border-[#e2e8f0] hover:bg-slate-50 h-[48px] rounded-[12px] flex items-center justify-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.05 16.57c-.74 1.08-1.55 2.16-2.73 2.18-1.15.02-1.53-.68-2.85-.68-1.34 0-1.74.66-2.88.7-1.2.04-2.12-1.16-2.86-2.24-1.54-2.22-2.72-6.28-1.16-9.01.77-1.34 2.12-2.2 3.61-2.22 1.13-.02 2.18.76 2.87.76.68 0 1.96-.92 3.33-.78 1.41.05 2.68.61 3.51 1.69-2.81 1.66-2.33 5.75.46 6.94-.65 1.62-1.54 3.19-2.58 4.54l1.28-1.88z" fill="#0f172a"/>
                <path d="M15.11 4.54c.6-1.07.96-2.43.83-3.79-1.38.11-2.91.95-3.79 2.02-.75.92-1.29 2.27-1.1 3.63 1.48.16 2.92-.61 3.66-1.86v-1.1e-15z" fill="#0f172a"/>
            </svg>
            <span className="font-['Inter'] font-semibold text-[#0f172a] text-[14px]">Apple</span>
          </button>
        </div>
      </form>

      {/* Footer Link */}
      <div className="text-center font-['Inter'] font-normal text-[#64748b] text-[14px] mt-2">
        Chưa có tài khoản?{' '}
        <Link href="/register" className="font-bold text-[#135bec] hover:underline">
          Đăng ký ngay
        </Link>
      </div>
    </div>
  );
}
