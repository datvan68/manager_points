import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogClose, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Zap, RefreshCw, Camera, X, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export interface PopupCameraProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const MOCK_SCANS = [
  { id: 1, name: 'Nguyễn Văn An', mssv: '202160432', time: '2 phút trước', match: 98, avatar: '1' },
  { id: 2, name: 'Trần Thị Bích Ngọc', mssv: '202160111', time: '5 phút trước', match: 95, avatar: '2' },
  { id: 3, name: 'Lê Minh Khôi', mssv: '202060789', time: '12 phút trước', match: 99, avatar: '3' },
];

export function PopupCamera({ isOpen, onOpenChange }: PopupCameraProps) {
  const [isScanning, setIsScanning] = useState(true);

  // Reset scan animation when opened
  useEffect(() => {
    if (isOpen) setIsScanning(true);
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] w-[95vw] h-[90vh] max-h-[750px] p-0 overflow-hidden bg-[#f8fafc] border border-slate-200 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-[24px] flex flex-col focus:outline-none">
        
        {/* Main Interface Wrapper */}
        <div className="flex-1 flex flex-col min-h-0 w-full p-6 md:p-8 gap-6 overflow-y-auto">
          
          {/* Header Section */}
          <div className="flex items-center justify-between shrink-0">
            <DialogTitle className="text-2xl font-normal text-slate-900 tracking-tight">Hệ Thống Nhận Diện Thẻ Sinh Viên</DialogTitle>
            <DialogClose asChild>
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
                <ArrowLeft className="w-4 h-4" />
                Quay lại
              </button>
            </DialogClose>
          </div>

          {/* Scanning Content Grid */}
          <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
            
            {/* Left Column - Camera Viewport */}
            <div className="flex-1 bg-white border border-slate-100 rounded-[24px] p-4 shadow-sm flex flex-col gap-6">
              
              {/* Camera Background */}
              <div className="relative w-full aspect-[4/3] bg-[#1a1a1a] rounded-[16px] overflow-hidden flex-shrink-0">
                {/* Mock Camera Stream */}
                <div className="absolute inset-0 flex items-center justify-center opacity-60">
                   <img src="https://images.unsplash.com/photo-1516961642265-531546e84af2?auto=format&fit=crop&q=80" alt="Camera feed" className="w-full h-full object-cover grayscale opacity-50" />
                </div>
                
                {/* Viewfinder Overlays */}
                <div className="absolute inset-y-[15%] inset-x-[15%] rounded-xl border border-white/20">
                  {/* Corners */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-xl"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-xl"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-xl"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-xl"></div>
                  
                  {/* Animated Scanning Line */}
                  {isScanning && (
                    <motion.div 
                      key="scanline"
                      className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500/0 via-blue-500 to-blue-500/0 shadow-[0_0_15px_2px_rgba(59,130,246,0.7)]"
                      initial={{ top: 0 }}
                      animate={{ top: '100%' }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                </div>

                {/* Camera Controls */}
                <div className="absolute top-4 right-4 flex flex-col gap-3">
                  <button className="p-3 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors">
                    <Zap className="w-5 h-5" fill="currentColor" />
                  </button>
                  <button className="p-3 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>

                {/* Instruction Text */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                  <div className="bg-black/40 backdrop-blur-sm px-6 py-2 rounded-full text-white text-sm">
                    Vui lòng đặt thẻ sinh viên vào khung để nhận diện
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm shadow-blue-200">
                  <Camera className="w-4 h-4" />
                  Chụp ảnh thẻ
                </button>
                <DialogClose asChild>
                  <button className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors shadow-sm">
                    <X className="w-4 h-4" />
                    Đóng camera
                  </button>
                </DialogClose>
              </div>
            </div>

            {/* Right Column - Recent Scans */}
            <div className="w-full lg:w-[400px] shrink-0 bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm flex flex-col h-full lg:h-auto min-h-0">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-4 shrink-0">
                <h3 className="text-[18px] font-semibold text-slate-900">Danh sách nhận diện</h3>
                <span className="px-2.5 py-1 bg-blue-100 text-blue-600 text-[12px] font-semibold rounded-full">3 mới</span>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3">
                {MOCK_SCANS.map((scan, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={scan.id} 
                    className="flex bg-slate-50 border border-slate-100 rounded-2xl p-3 gap-3 items-center group hover:bg-slate-100/70 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-xl bg-slate-200 overflow-hidden shrink-0">
                       <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${scan.avatar}&backgroundColor=cbd5e1`} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[15px] font-medium text-slate-900 truncate">{scan.name}</h4>
                      <p className="text-[12px] text-slate-500 uppercase tracking-wide truncate">MSSV: {scan.mssv}</p>
                    </div>
                    {/* Status */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold text-blue-600">{scan.match}% Match</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Footer Button */}
              <div className="pt-4 shrink-0 mt-4 border-t border-slate-100 flex justify-center">
                <button className="text-[14px] text-slate-400 font-medium hover:text-blue-600 transition-colors">
                  Xem tất cả lịch sử quét
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Status Footer */}
        <div className="bg-[#f8fafc] border-t border-slate-200 px-8 py-3 shrink-0 flex items-center gap-4 text-[13px] text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
            Camera Online
          </div>
          <span>|</span>
          <span>Độ trễ: 12ms</span>
        </div>

      </DialogContent>
    </Dialog>
  );
}
