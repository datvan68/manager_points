import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Plus, X, Trash2, Check, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface PopupUploadProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PopupUpload({ isOpen, onOpenChange }: PopupUploadProps) {
  // Mock initial uploaded images
  const [images, setImages] = useState([
    { id: '1', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200&h=200', selected: true },
    { id: '2', url: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=200&h=200', selected: true },
    { id: '3', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200&h=200', selected: true },
    { id: '4', url: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&q=80&w=200&h=200', selected: true },
    { id: '5', url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200&h=200', selected: true },
  ]);

  const selectedCount = images.filter(img => img.selected).length;
  // fake size calculation
  const totalSizeMb = (selectedCount * 0.35).toFixed(1);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImages(imgs => imgs.map(img => img.id === id ? { ...img, selected: !img.selected } : img));
  };

  const removeImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImages(imgs => imgs.filter(img => img.id !== id));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] p-0 overflow-hidden bg-white gap-0 border-slate-100 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-[12px]">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 flex flex-row items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex gap-3 items-center">
            <div className="w-8 h-8 rounded shrink-0 bg-blue-50 flex items-center justify-center text-blue-600">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div className="flex flex-col text-left">
              <DialogTitle className="text-xl font-bold text-slate-900 leading-snug">Danh sách ảnh đã tải lên</DialogTitle>
              <DialogDescription className="text-sm font-normal text-slate-500 mt-0.5">
                Quản lý các tệp tin hình ảnh thẻ sinh viên
              </DialogDescription>
            </div>
          </div>
          {/* Default Close button from Dialog is automatically applied, setting right position if need be */}
        </DialogHeader>

        {/* Sub-header Actions */}
        <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-900">{selectedCount} ảnh đã chọn</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">Dung lượng: {totalSizeMb} MB</span>
          </div>
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm shadow-blue-600/20">
            <Plus className="w-4 h-4" />
            Thêm ảnh
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="p-6 overflow-y-auto max-h-[450px] bg-white">
          <div className="grid grid-cols-4 gap-4">
            <AnimatePresence>
              {images.map((img) => (
                <motion.div
                  key={img.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ scale: 1.02 }}
                  className={`relative aspect-square rounded-xl border object-cover overflow-hidden group cursor-pointer transition-colors ${
                    img.selected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                  }`}
                  onClick={(e) => toggleSelect(img.id, e)}
                >
                  <img src={img.url} alt="Uploaded student card" className={`w-full h-full object-cover transition-opacity ${img.selected ? 'opacity-100' : 'opacity-70'}`} />
                  
                  {/* Status Indicator */}
                  {img.selected && (
                    <div className="absolute top-2 left-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10">
                      <Check className="w-3 h-3 text-white stroke-[3]" />
                    </div>
                  )}

                  {/* Hover Actions Overlay */}
                  <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button 
                      className="w-8 h-8 bg-white/90 hover:bg-white text-slate-700 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                      onClick={(e) => { e.stopPropagation(); /* View action */ }}
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <button 
                      className="w-8 h-8 bg-rose-500/90 hover:bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                      onClick={(e) => removeImage(img.id, e)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Empty Add Button */}
            <motion.button 
              layout
              className="aspect-square flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-slate-400 hover:text-blue-500 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium">Tải thêm</span>
            </motion.button>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-white flex items-center gap-3 sm:justify-end">
          <DialogClose asChild>
            <button className="px-6 py-2.5 text-slate-600 font-semibold text-[15px] hover:bg-slate-50 rounded-lg transition-colors">
              Hủy
            </button>
          </DialogClose>
          <button 
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[15px] rounded-lg transition-colors shadow-sm shadow-blue-600/20"
            onClick={() => onOpenChange(false)}
          >
            Bắt đầu nhận diện
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
