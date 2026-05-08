'use client';
import React, { useEffect } from 'react';
import { BarChart2, ListTodo, Lightbulb, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SelectModulePage() {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === '1') {
        router.push('/'); // Thay đổi route tương ứng với trang quản lý (ví dụ: /admin hoặc /students)
      } else if (e.altKey && e.key === '2') {
        router.push('/select-module'); // Route tạm thời cho trang Ghi Nhận (Cần xác định lại route thực tế nếu khác /)
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  return (
    <div className="w-full flex justify-center px-[24px] py-[80px]">
      <div className="w-full max-w-[1024px] flex flex-col items-center">
        
        {/* Header Section */}
        <div className="flex flex-col gap-[16px] items-center text-center max-w-[896px] pb-[64px]">
          <h1 className="font-['Inter'] font-black text-[#0f172a] text-[48px] tracking-[-1.2px] leading-[48px]">
            Chào mừng bạn quay trở lại
          </h1>
          <p className="font-['Inter'] font-normal text-[#475569] text-[18px] leading-[28px]">
            Vui lòng chọn chức năng bạn muốn thực hiện tiếp theo để bắt đầu phiên làm việc.
          </p>
        </div>

        {/* Function Cards Grid */}
        <div className="flex flex-col md:flex-row gap-[32px] w-full max-w-[1024px] mb-[64px]">
          
          {/* Management Card */}
          <div className="bg-white rounded-[24px] flex-1 flex flex-col overflow-hidden shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] border border-transparent hover:border-[#135bec]/20 hover:shadow-lg transition-all duration-300 group">
            {/* Image Banner Area */}
            <div className="h-[256px] relative overflow-hidden bg-slate-100 flex-shrink-0">
              <img 
                src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2426&ixlib=rb-4.0.3" 
                alt="Management Dashboard Background" 
                className="absolute w-full h-full object-cover top-0 left-0 group-hover:scale-105 transition-transform duration-500"
              />
              {/* Overlay Overlay */}
              <div className="absolute inset-0 bg-[#135bec]/10"></div>
              
              {/* Floating Icon Box */}
              <div className="absolute top-[24px] left-[24px] bg-white rounded-[16px] w-[56px] h-[56px] flex items-center justify-center shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)]">
                <BarChart2 size={24} className="text-[#135bec]" strokeWidth={2.5} />
              </div>
            </div>

            {/* Content Area */}
            <div className="p-[32px] flex flex-col flex-1 gap-[12px]">
              <div className="flex items-center justify-between w-full">
                <h3 className="font-['Inter'] font-bold text-[#0f172a] text-[24px] leading-[32px]">
                  Trang Quản lý
                </h3>
                <ExternalLink size={20} className="text-slate-300 group-hover:text-[#135bec] transition-colors" />
              </div>
              <p className="font-['Inter'] font-normal text-[#475569] text-[16px] leading-[26px] flex-1">
                Công cụ quản lý hệ thống, nhân sự và theo dõi báo cáo chi tiết. Giúp bạn tối ưu hóa quy trình vận hành và đưa ra quyết định dựa trên dữ liệu.
              </p>
              
              <div className="pt-[12px] mt-auto">
                <Link href="/students" className="inline-flex items-center justify-center gap-[8px] bg-[#135bec] hover:bg-blue-700 text-white rounded-[8px] px-[24px] py-[10px] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)] transition-colors w-max">
                  <span className="font-['Inter'] font-semibold text-[16px] leading-[24px]">Truy cập ngay</span>
                  <ArrowIcon />
                </Link>
              </div>
            </div>
          </div>

          {/* Recording Card (Nhập liệu) */}
          <div className="bg-white rounded-[24px] flex-1 flex flex-col overflow-hidden shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] border border-transparent hover:border-[#135bec]/20 hover:shadow-lg transition-all duration-300 group">
            {/* Image Banner Area */}
            <div className="h-[256px] relative overflow-hidden bg-slate-100 flex-shrink-0">
              <img 
                src="https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&q=80&w=2670&ixlib=rb-4.0.3" 
                alt="Recording/Taking Notes Background" 
                className="absolute w-full h-full object-cover top-0 left-0 group-hover:scale-105 transition-transform duration-500"
              />
              {/* Overlay Overlay */}
              <div className="absolute inset-0 bg-[#135bec]/10"></div>
              
              {/* Floating Icon Box */}
              <div className="absolute top-[24px] left-[24px] bg-white rounded-[16px] w-[56px] h-[56px] flex items-center justify-center shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)]">
                <ListTodo size={24} className="text-[#135bec]" strokeWidth={2.5} />
              </div>
            </div>

            {/* Content Area */}
            <div className="p-[32px] flex flex-col flex-1 gap-[12px]">
              <div className="flex items-center justify-between w-full">
                <h3 className="font-['Inter'] font-bold text-[#0f172a] text-[24px] leading-[32px]">
                  Trang Ghi nhận
                </h3>
                <ExternalLink size={20} className="text-slate-300 group-hover:text-[#135bec] transition-colors" />
              </div>
              <p className="font-['Inter'] font-normal text-[#475569] text-[16px] leading-[26px] flex-1">
                Cập nhật tiến độ công việc, ghi nhận dữ liệu thực tế và nhật ký hàng ngày. Quy trình nhập liệu nhanh chóng, chính xác và đồng bộ tức thì.
              </p>
              
              <div className="pt-[12px] mt-auto">
                <Link href="/" className="inline-flex items-center justify-center gap-[8px] bg-[#135bec] hover:bg-blue-700 text-white rounded-[8px] px-[24px] py-[10px] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)] transition-colors w-max">
                  <span className="font-['Inter'] font-semibold text-[16px] leading-[24px]">Truy cập ngay</span>
                  <ArrowIcon />
                </Link>
              </div>
            </div>
          </div>

        </div>

        {/* Shortcut Info Section */}
        <div className="bg-[#135bec]/5 border border-[#135bec]/10 rounded-[16px] p-[16px] pr-[32px] flex items-center gap-[24px] max-w-[672px] w-full">
          {/* Bulb Icon */}
          <div className="bg-[#135bec]/20 rounded-full w-[48px] h-[48px] flex items-center justify-center flex-shrink-0">
            <Lightbulb size={24} className="text-[#135bec]" strokeWidth={2.5} />
          </div>
          
          {/* Shortcut Text */}
          <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px] font-['Inter'] font-medium text-[#334155] text-[14px]">
            <span className="font-bold text-[#135bec]">Mẹo:</span>
            <span>Bạn có thể sử dụng phím tắt</span>
            <kbd className="bg-white border border-[#e2e8f0] rounded-[4px] px-[8px] py-[2px] font-['Liberation_Mono'] text-[12px] leading-[16px]">
              Alt + 1
            </kbd>
            <span>để vào Quản lý và</span>
            <kbd className="bg-white border border-[#e2e8f0] rounded-[4px] px-[8px] py-[2px] font-['Liberation_Mono'] text-[12px] leading-[16px]">
              Alt + 2
            </kbd>
            <span>cho Ghi nhận.</span>
          </div>
        </div>

      </div>
    </div>
  );
}

// Reusable SVG Arrow Icon specifically sized for these buttons
function ArrowIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.33331 5H8.66665" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 1.33333L8.66667 5L5 8.66667" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
