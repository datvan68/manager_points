'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { X, Sparkles, Paintbrush, Palette, Heart, Users, Clock, MapPin, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  BACKGROUND_TEMPLATES, 
  getPatternStyle, 
  DEFAULT_STATE_BUTTONS,
  normalizeBackgroundConfig
} from './activity-view-policy';

const PET_ACCENT_OPTIONS = [
  { id: 'none', name: 'Không sử dụng' },
  { id: 'paw-border', name: 'Dấu chân di chuyển' },
  { id: 'cat-slide', name: 'Mèo lướt' },
  { id: 'dog-bone', name: 'Xương chó bay' },
  { id: 'pet-orbit', name: 'Thú bay quỹ đạo' },
];

const ACCENT_PRESETS = [
  '#64748B', // Slate
  '#3B82F6', // Blue
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#F43F5E', // Rose
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#CA8A04', // Honey Yellow
  '#22C55E', // Green
];

interface ActivityCardDesignModalProps {
  open: boolean;
  onClose: () => void;
  initialConfig?: any;
  onSave: (config: any) => void;
  activityName?: string;
  activityCode?: string;
  activityCategory?: string;
}

export default function ActivityCardDesignModal({
  open,
  onClose,
  initialConfig,
  onSave,
  activityName = 'Tên hoạt động mẫu',
  activityCode = 'CODE_MAU',
  activityCategory = 'academic'
}: ActivityCardDesignModalProps) {
  const [config, setConfig] = useState<any>(() => normalizeBackgroundConfig(initialConfig));
  const [activeTab, setActiveTab] = useState<'background' | 'buttons'>('background');
  const [selectedState, setSelectedState] = useState<'none' | 'pending' | 'active' | 'rejected'>('none');

  useEffect(() => {
    if (open) {
      setConfig(normalizeBackgroundConfig(initialConfig));
    }
  }, [open, initialConfig]);

  const handleTemplateSelect = (templateId: string) => {
    const template = BACKGROUND_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    setConfig((prev: any) => ({
      ...prev,
      pattern: template.id,
      accentColor: template.accentColor,
    }));
  };

  const handleAccentSelect = (color: string) => {
    setConfig((prev: any) => ({
      ...prev,
      accentColor: color,
    }));
  };

  const handleStateButtonChange = (field: string, value: string) => {
    setConfig((prev: any) => {
      const nextStates = { ...prev.states };
      nextStates[selectedState] = {
        ...nextStates[selectedState],
        [field]: value
      };
      return {
        ...prev,
        states: nextStates
      };
    });
  };

  const handleSave = () => {
    onSave(normalizeBackgroundConfig(config));
  };

  const currentTemplate = BACKGROUND_TEMPLATES.find(t => t.id === config.pattern) || BACKGROUND_TEMPLATES[0];
  const isDark = !!currentTemplate?.isDark;
  const currentAccent = config.accentColor || currentTemplate?.accentColor || '#3B82F6';

  // Preview properties
  const cardBgClass = currentTemplate?.bgClass || 'bg-white border-slate-200';
  const previewPatternId = config.pattern;
  const previewPetType = config.petAccentType;

  // Resolve button style for preview
  const getPreviewButtonStyle = (state: 'none' | 'pending' | 'active' | 'rejected') => {
    const stateConfig = config.states?.[state] || {};
    const fallback = DEFAULT_STATE_BUTTONS[state];
    return {
      label: stateConfig.label || fallback.label,
      bgClass: stateConfig.bgClass || fallback.bgClass,
      textClass: stateConfig.textClass || fallback.textClass
    };
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl rounded-3xl overflow-hidden bg-slate-50 border border-slate-200 p-0 shadow-2xl flex flex-col h-[85vh]">
        <DialogHeader className="px-6 py-4 bg-white border-b border-slate-100 flex flex-row items-center justify-between">
          <DialogTitle className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Paintbrush size={18} className="text-blue-500" />
            Thiết kế giao diện thẻ hoạt động
          </DialogTitle>
        </DialogHeader>

        {/* Workspace Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel: Editors */}
          <div className="w-7/12 p-6 overflow-y-auto space-y-6 border-r border-slate-150">
            {/* Tabs Navigation */}
            <div className="flex p-1 bg-slate-200/60 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('background')}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                  activeTab === 'background' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Palette size={14} />
                Nền & Hoạt họa Accent
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('buttons')}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                  activeTab === 'buttons' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Sparkles size={14} />
                Nút trạng thái Đăng ký
              </button>
            </div>

            {activeTab === 'background' ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Templates grid */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">1. Chọn mẫu giao diện (Templates)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {BACKGROUND_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => handleTemplateSelect(tmpl.id)}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all hover:scale-[1.01] hover:shadow-sm relative overflow-hidden flex flex-col justify-between h-20",
                          tmpl.bgClass,
                          config.pattern === tmpl.id ? "ring-2 ring-blue-500 border-blue-500 shadow-md scale-[1.01]" : "border-slate-200"
                        )}
                      >
                        {tmpl.patternId && (
                          <div 
                            className="absolute inset-0 pointer-events-none opacity-45" 
                            style={getPatternStyle(tmpl.patternId, tmpl.accentColor)} 
                          />
                        )}
                        <span className={cn("text-xs font-black relative z-10", tmpl.isDark ? "text-white" : "text-slate-800")}>
                          {tmpl.name}
                        </span>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md relative z-10 w-fit uppercase", tmpl.isDark ? "bg-white/10 text-slate-300" : "bg-slate-200/50 text-slate-500")}>
                          {tmpl.category}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent Color picker */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">2. Màu Accent (Đường viền/Màu nhấn)</h4>
                  <div className="flex flex-wrap gap-2.5">
                    {ACCENT_PRESETS.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleAccentSelect(color)}
                        className={cn(
                          "w-8 h-8 rounded-full border border-black/10 transition-all hover:scale-110 relative flex items-center justify-center",
                          config.accentColor === color && "ring-2 ring-offset-2 ring-blue-500"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Mã màu:</span>
                      <input
                        type="text"
                        value={config.accentColor || ''}
                        onChange={(e) => handleAccentSelect(e.target.value)}
                        placeholder="#HEX"
                        className="w-20 px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-center font-mono font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Avatar settings & background image */}
                <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">3. Ảnh nền tùy chỉnh</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-650">Sử dụng logo làm ảnh nền mờ</p>
                        <p className="text-[10px] text-slate-400">Tự động lấy ảnh logo/avatar làm nền background</p>
                      </div>
                      <div className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={!!config.useAvatarAsBackground}
                          onChange={(e) => setConfig((prev: any) => ({ ...prev, useAvatarAsBackground: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                    </div>

                    {!config.useAvatarAsBackground && (
                      <Input
                        label="Đường dẫn ảnh nền ngoài (URL)"
                        value={config.backgroundImageUrl || ''}
                        onChange={(e) => setConfig((prev: any) => ({ ...prev, backgroundImageUrl: e.target.value || null }))}
                        placeholder="https://example.com/background.jpg"
                      />
                    )}
                  </div>
                </div>

                {/* Pet animation selection */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">4. Hiệu ứng Accent hoạt họa thú cưng</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {PET_ACCENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setConfig((prev: any) => ({ ...prev, petAccentType: opt.id }))}
                        className={cn(
                          "px-3 py-2 text-xs font-bold rounded-xl border text-center transition-all hover:bg-slate-50",
                          config.petAccentType === opt.id || (!config.petAccentType && opt.id === 'none')
                            ? "border-blue-500 bg-blue-50/50 text-blue-650"
                            : "border-slate-200 text-slate-655"
                        )}
                      >
                        {opt.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* State selector */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">1. Chọn trạng thái cần cấu hình</h4>
                  <div className="flex gap-1.5 p-1 bg-slate-200/40 rounded-xl">
                    {(['none', 'pending', 'active', 'rejected'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setSelectedState(st)}
                        className={cn(
                          "flex-1 py-1.5 text-[10px] font-extrabold rounded-lg uppercase tracking-wider transition-all",
                          selectedState === st ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-750"
                        )}
                      >
                        {st === 'none' ? 'None (Đăng ký)' : st === 'pending' ? 'Pending' : st === 'active' ? 'Active' : 'Rejected'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Button detail customization */}
                <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    Cấu hình nhãn & style cho: {selectedState.toUpperCase()}
                  </h4>
                  <div className="space-y-4">
                    <Input
                      label="Nhãn nút hiển thị (Label)"
                      value={config.states?.[selectedState]?.label || ''}
                      onChange={(e) => handleStateButtonChange('label', e.target.value)}
                      placeholder={DEFAULT_STATE_BUTTONS[selectedState].label}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Background class (Tailwind)"
                        value={config.states?.[selectedState]?.bgClass || ''}
                        onChange={(e) => handleStateButtonChange('bgClass', e.target.value)}
                        placeholder={DEFAULT_STATE_BUTTONS[selectedState].bgClass}
                      />
                      <Input
                        label="Text class (Tailwind)"
                        value={config.states?.[selectedState]?.textClass || ''}
                        onChange={(e) => handleStateButtonChange('textClass', e.target.value)}
                        placeholder={DEFAULT_STATE_BUTTONS[selectedState].textClass}
                      />
                    </div>

                    <div className="text-[10px] text-slate-400 font-medium leading-normal bg-slate-50 p-3 rounded-lg">
                      💡 Nhập các class Tailwind tùy chỉnh để thay đổi hình dạng nút (ví dụ: <code className="font-mono text-blue-600 bg-blue-50 px-1 rounded">bg-red-500 hover:bg-red-600 text-white rounded-xl</code>). Để trống để sử dụng mặc định.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right panel: Live Preview */}
          <div className="w-5/12 p-6 bg-slate-100 flex flex-col justify-center items-center select-none relative">
            <span className="absolute top-4 left-4 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Eye size={12} />
              Bản xem trước trực tiếp (Live Preview)
            </span>

            {/* Preview Card Shell */}
            <div
              className={cn(
                "w-full max-w-[280px] min-h-[250px] rounded-2xl overflow-hidden shadow-md border p-4 flex flex-col justify-between gap-3.5 relative template-shine-effect bg-white",
                cardBgClass
              )}
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                boxShadow: isDark 
                  ? `0 4px 20px -2px rgba(0,0,0,0.35)` 
                  : `0 10px 25px -5px rgba(0,0,0,0.05)`,
              }}
            >
              {/* Corner Dots */}
              <div className="absolute top-3 left-3 w-1.5 h-1.5 rounded-full z-20" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : `${currentAccent}50` }} />
              <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full z-20" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : `${currentAccent}50` }} />
              <div className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full z-20" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : `${currentAccent}50` }} />
              <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full z-20" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : `${currentAccent}50` }} />

              {/* Custom background color/mock layout */}
              {previewPatternId && (
                <div 
                  className="absolute inset-0 pointer-events-none opacity-65 z-0" 
                  style={getPatternStyle(previewPatternId, currentAccent)} 
                />
              )}

              {/* Pet animated mock */}
              {previewPetType && previewPetType !== 'none' && (
                <div className="absolute top-2 right-2 text-xs opacity-40 z-10 font-bold" style={{ color: currentAccent }}>
                  🐾 {previewPetType === 'cat-slide' ? '🐱' : previewPetType === 'dog-bone' ? '🦴' : previewPetType === 'pet-orbit' ? '🛸' : '👣'}
                </div>
              )}

              {/* Header Badges */}
              <div className="flex justify-between items-start gap-2 z-10">
                <span className={cn(
                  "text-[9px] font-extrabold px-2 py-0.5 rounded-full border",
                  isDark ? "bg-white/10 text-slate-200 border-white/10" : "bg-white/70 text-slate-800 border-slate-200/50"
                )}>
                  {activityCategory === 'academic' ? 'Học thuật' : activityCategory === 'sports' ? 'Thể thao' : 'Nghệ thuật'}
                </span>
                <span className={cn(
                  "text-[9px] font-mono font-bold tracking-wider",
                  isDark ? "text-white/40" : "text-slate-400/85"
                )}>
                  {activityCode}
                </span>
              </div>

              {/* Title */}
              <div className="flex-1 flex flex-col justify-start min-w-0 z-10 mt-1">
                <h3 className={cn(
                  "text-xs font-extrabold line-clamp-2 leading-snug",
                  isDark ? "text-slate-100" : "text-slate-800"
                )}>
                  {activityName}
                </h3>
              </div>

              {/* Schedule and Location info */}
              <div className={cn("space-y-1 text-[10px] font-bold w-full z-10 my-1", isDark ? "text-slate-350" : "text-slate-655")}>
                <div className="flex items-center gap-1.5">
                  <Clock size={10} className="text-blue-500 shrink-0" />
                  <span className={isDark ? "text-slate-200" : "text-slate-700"}>Thứ 2, Thứ 4: 08:00 - 10:00</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={10} className="text-amber-500 shrink-0" />
                  <span className={isDark ? "text-slate-200" : "text-slate-700"}>Phòng B.102</span>
                </div>
              </div>

              {/* Action buttons preview area */}
              <div className="border-t border-slate-200/40 pt-2 flex items-center justify-between gap-1 z-10">
                <div className={cn("flex items-center gap-1 text-[9px] font-bold", isDark ? "text-slate-400" : "text-slate-500")}>
                  <Users size={10} />
                  <span>5/30</span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Active preview button showing configured style */}
                  {(() => {
                    const btn = getPreviewButtonStyle(selectedState);
                    return (
                      <span className={cn(
                        "px-2.5 py-1 text-[9px] font-black rounded-lg shadow-sm tracking-wider uppercase border-0 inline-block",
                        btn.bgClass,
                        btn.textClass
                      )}>
                        {btn.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Hint */}
            <div className="mt-4 text-[10px] text-slate-400 font-bold max-w-[250px] text-center leading-normal">
              💡 Bấm chọn các tab trạng thái (None, Pending, Active, Rejected) bên trái để xem trước hiển thị nút tương ứng.
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 px-4 text-xs font-bold rounded-xl"
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="h-9 px-5 text-xs bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-750 text-white font-black rounded-xl shadow-md border-0"
          >
            Lưu thiết kế
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
