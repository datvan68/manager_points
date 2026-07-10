import React, { useState } from 'react';
import { Search, Filter, Plus, Grid, List, MapPin, Users, Clock, Heart, Compass, X, Palette, Edit, Trash2, Calendar, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { tokenStorage } from '@/api/auth-api';
import { activityCategoryLabels } from './activity-view-policy';
import ActivityCard from './ActivityCard';

// Simple status badge
function ActivityStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; bg: string; text: string }> = {
    draft: { label: 'Nháp', bg: 'bg-slate-105/80', text: 'text-slate-650' },
    published: { label: 'Hoạt động', bg: 'bg-emerald-100/90', text: 'text-emerald-700' },
    completed: { label: 'Kết thúc', bg: 'bg-blue-105/90', text: 'text-blue-700' },
    cancelled: { label: 'Hủy', bg: 'bg-red-100/90', text: 'text-red-700' },
  };
  const config = configs[status] || configs.draft;
  return (
    <span className={cn("text-[9.5px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-black/5 shadow-xs", config.bg, config.text)}>
      <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
      {config.label}
    </span>
  );
}

interface ActivityListWorkspaceProps {
  activities: any[];
  loading: boolean;
  onJoinClick: (activity: any) => void;
  onFavoriteClick: (activity: any) => Promise<void>;
  onEditClick: (activity: any) => void;
  onDeleteClick: (activity: any) => void;
  onCreateClick: () => void;
  canManage: (activity: any) => boolean;
  onNavigateToDetail: (activityId: string) => void;
  onConfigureDesign?: (activity: any) => void;
  onScheduleClick?: () => void;
  onRefreshClick?: () => void;

  selectedActivityIds?: string[];
  onSelectedActivityIdsChange?: (ids: string[]) => void;
  onBulkActionClick?: (actionType: 'deactivate' | 'delete') => void;
  onSingleStatusChange?: (id: string, status: 'draft' | 'published' | 'cancelled') => Promise<void>;
}

export default function ActivityListWorkspace({
  activities,
  loading,
  onJoinClick,
  onFavoriteClick,
  onEditClick,
  onDeleteClick,
  onCreateClick,
  canManage,
  onNavigateToDetail,
  onConfigureDesign,
  onScheduleClick,
  onRefreshClick,

  selectedActivityIds = [],
  onSelectedActivityIdsChange,
  onBulkActionClick,
  onSingleStatusChange,
}: ActivityListWorkspaceProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const currentUser = tokenStorage.getUser();
  const isStudent = currentUser?.role?.toLowerCase() === 'student';

  // Local filtering
  const filtered = activities.filter((act) => {
    const matchesSearch =
      act.name?.toLowerCase().includes(search.toLowerCase()) ||
      act.code?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !filterCategory || act.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Sync selected activity IDs with filtered results
  React.useEffect(() => {
    if (selectedActivityIds && selectedActivityIds.length > 0) {
      const filteredIds = filtered.map(a => a._id);
      const validSelected = selectedActivityIds.filter(id => filteredIds.includes(id));
      if (validSelected.length !== selectedActivityIds.length) {
        onSelectedActivityIdsChange?.(validSelected);
      }
    }
  }, [search, filterCategory, activities]);

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white/30 backdrop-blur-sm p-3 rounded-2xl border border-white/50">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
          {/* Search trigger */}
          {isSearchOpen ? (
            <div className="relative flex-1 md:max-w-md flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên hoặc mã hoạt động..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-10 pr-10 py-2 bg-white/75 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearch('');
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-white/75 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm cursor-pointer shrink-0"
              title="Tìm kiếm"
            >
              <Search size={18} />
            </button>
          )}

          {/* Category Filter */}
          <div className="relative min-w-[180px] w-full sm:w-auto">
            <Filter size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full pl-10 pr-4 h-10 bg-white/75 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm cursor-pointer appearance-none"
            >
              <option value="">Tất cả phân loại</option>
              {Object.entries(activityCategoryLabels).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Button & View Toggle */}
        <div className="flex items-center justify-end gap-3 w-full md:w-auto shrink-0">
          <Button
            variant="outline"
            onClick={onScheduleClick}
            className="flex items-center gap-2 px-4 h-10 border-slate-200 bg-white/75 hover:bg-slate-50 rounded-xl cursor-pointer text-xs font-bold text-slate-605 shadow-sm shrink-0"
            title="Lịch trình hoạt động"
            data-testid="calendar-header-button"
          >
            <Calendar size={15} />
            <span>Lịch trình</span>
          </Button>

          <Button
            variant="outline"
            onClick={onRefreshClick}
            className="w-10 h-10 p-0 border-slate-200 bg-white/75 hover:bg-slate-50 rounded-xl cursor-pointer text-slate-605 shadow-sm shrink-0 flex items-center justify-center"
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={16} />
          </Button>

          {!isStudent && (
            <Button
              onClick={onCreateClick}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer h-10"
            >
              <Plus size={16} />
              Tạo Hoạt động Mới
            </Button>
          )}

          <div className="flex items-center gap-1.5 p-1 bg-slate-200/50 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-lg transition-all cursor-pointer",
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-2 rounded-lg transition-all cursor-pointer",
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* List Area */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-56 bg-white/40 border border-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/30 backdrop-blur-sm rounded-2xl border border-white/60 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-500">
            <Compass size={32} className="animate-spin-slow" />
          </div>
          <h3 className="text-base font-bold text-slate-700">Không tìm thấy hoạt động nào</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc khác.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-in fade-in duration-350">
          {filtered.map((act) => {
            const isManager = canManage(act);
            return (
              <ActivityCard
                key={act._id}
                activity={act}
                onJoinClick={onJoinClick}
                onFavoriteClick={onFavoriteClick}
                onEditClick={onEditClick}
                onDeleteClick={onDeleteClick}
                canManage={isManager}
                onNavigateToDetail={onNavigateToDetail}
                onConfigureDesign={onConfigureDesign}
              />
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="space-y-4 animate-in fade-in duration-350">
          {/* Bulk Action Toolbar */}
          {!isStudent && selectedActivityIds.length > 0 && (
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200/60 p-3 rounded-2xl shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">
                  Đang chọn <strong className="text-blue-600">{selectedActivityIds.length}</strong> hoạt động
                </span>
                <button
                  onClick={() => onSelectedActivityIdsChange?.([])}
                  className="text-xs text-slate-400 hover:text-slate-700 font-bold transition-all ml-2 cursor-pointer"
                >
                  Bỏ chọn
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => onBulkActionClick?.('deactivate')}
                  className="h-8 px-3.5 border border-amber-200 text-amber-600 hover:bg-amber-50 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Vô hiệu hóa
                </Button>
                <Button
                  onClick={() => onBulkActionClick?.('delete')}
                  className="h-8 px-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold border-0 shadow-xs cursor-pointer"
                >
                  Xóa
                </Button>
              </div>
            </div>
          )}

          <div className="w-full bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {!isStudent && (
                      <th className="px-5 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && selectedActivityIds.length === filtered.length}
                          ref={(el) => {
                            if (el) {
                              el.indeterminate = selectedActivityIds.length > 0 && selectedActivityIds.length < filtered.length;
                            }
                          }}
                          onChange={(e) => {
                            if (e.target.checked) {
                              onSelectedActivityIdsChange?.(filtered.map(a => a._id));
                            } else {
                              onSelectedActivityIdsChange?.([]);
                            }
                          }}
                          className="cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                    )}
                    <th className="px-5 py-3">Tên hoạt động</th>
                    <th className="px-5 py-3">Mã</th>
                    <th className="px-5 py-3">Phân loại</th>
                    <th className="px-5 py-3">Phòng</th>
                    <th className="px-5 py-3">Trạng thái</th>
                    <th className="px-5 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filtered.map((act) => {
                    const isManager = canManage(act);

                    return (
                      <tr
                        key={act._id}
                        onClick={() => onNavigateToDetail(act._id)}
                        className="hover:bg-white/40 transition-colors cursor-pointer"
                      >
                        {!isStudent && (
                          <td className="px-5 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedActivityIds.includes(act._id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                if (checked) {
                                  onSelectedActivityIdsChange?.([...selectedActivityIds, act._id]);
                                } else {
                                  onSelectedActivityIdsChange?.(selectedActivityIds.filter(id => id !== act._id));
                                }
                              }}
                              className="cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                        )}
                        <td className="px-5 py-4 font-bold text-slate-700">
                          {act.name}
                        </td>
                        <td className="px-5 py-4 font-mono font-semibold text-slate-500 uppercase">
                          {act.code}
                        </td>
                        <td className="px-5 py-4 text-slate-500 font-medium">
                          {activityCategoryLabels[act.category] || act.category}
                        </td>
                        <td className="px-5 py-4 text-slate-500 font-medium">
                          {act.classroom || '—'}
                        </td>
                        <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <ActivityStatusBadge status={act.participation_status || 'published'} />
                            {isManager && act.participation_status !== 'completed' && (
                              <div className="flex items-center gap-1 bg-slate-100/50 border border-slate-200/50 rounded-lg p-0.5 shadow-xs">
                                <button
                                  onClick={() => onSingleStatusChange?.(act._id, 'draft')}
                                  className="p-1 text-slate-400 hover:text-slate-750 hover:bg-slate-200/60 rounded transition-all cursor-pointer"
                                  title="Đưa về nháp"
                                  aria-label="Đưa về nháp"
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => onSingleStatusChange?.(act._id, 'published')}
                                  className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all cursor-pointer"
                                  title="Công khai đăng ký"
                                  aria-label="Công khai đăng ký"
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => onSingleStatusChange?.(act._id, 'cancelled')}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
                                  title="Hủy hoạt động"
                                  aria-label="Hủy hoạt động"
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onFavoriteClick(act)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-pink-500 hover:bg-pink-50/50 transition-colors shrink-0 cursor-pointer"
                              title={act.is_favorited ? "Bỏ yêu thích" : "Yêu thích"}
                              aria-label={act.is_favorited ? "Bỏ yêu thích" : "Yêu thích"}
                            >
                              <Heart size={14} className={act.is_favorited ? "fill-pink-500 text-pink-500" : ""} />
                            </button>

                            {isStudent && act.membership_status === 'none' && (
                              <Button
                                onClick={() => onJoinClick(act)}
                                className="h-7 px-2.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                              >
                                Tham gia
                              </Button>
                            )}

                            {isManager && (
                              <>
                                <button
                                  onClick={() => onConfigureDesign?.(act)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors shrink-0 cursor-pointer"
                                  title="Cấu hình thiết kế"
                                  aria-label="Cấu hình thiết kế"
                                  data-testid="table-configure-design-button"
                                >
                                  <Palette size={14} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditClick(act);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0 cursor-pointer"
                                  title="Chỉnh sửa"
                                  aria-label="Chỉnh sửa"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteClick(act);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                                  title="Xóa"
                                  aria-label="Xóa"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
