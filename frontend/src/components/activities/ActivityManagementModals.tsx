'use client';

import React from 'react';
import ConfirmModal from '@/components/modals/ConfirmModal';

interface ActivityManagementModalsProps {
  activityPendingDelete?: { id: string; name: string } | null;
  onCloseDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  
  activityToSwitch?: any | null;
  showSwitchConfirm: boolean;
  onCloseSwitch: () => void;
  onConfirmSwitch: () => Promise<void>;
  switchLoading?: boolean;
  transferPolicy?: any;
  
  activityToJoin?: any | null;
  showJoinConfirm: boolean;
  onCloseJoin: () => void;
  onConfirmJoin: () => Promise<void>;
  joinLoading?: boolean;

  bulkActionType?: 'delete' | 'deactivate' | null;
  onCloseBulk?: () => void;
  onConfirmBulk?: () => Promise<void>;
  selectedCount?: number;
}

export default function ActivityManagementModals({
  activityPendingDelete,
  onCloseDelete,
  onConfirmDelete,
  activityToSwitch,
  showSwitchConfirm,
  onCloseSwitch,
  onConfirmSwitch,
  switchLoading = false,
  transferPolicy,
  activityToJoin,
  showJoinConfirm,
  onCloseJoin,
  onConfirmJoin,
  joinLoading = false,
  bulkActionType,
  onCloseBulk = () => {},
  onConfirmBulk = async () => {},
  selectedCount = 0,
}: ActivityManagementModalsProps) {
  return (
    <>
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!activityPendingDelete}
        onClose={onCloseDelete}
        onConfirm={onConfirmDelete}
        title="Vô hiệu hóa hoạt động"
        message={`Bạn có chắc chắn muốn vô hiệu hóa hoạt động "${activityPendingDelete?.name}"?`}
        confirmLabel="Vô hiệu hóa"
        cancelLabel="Hủy"
        variant="danger"
      />

      {/* Switch Activity Confirmation Modal */}
      <ConfirmModal
        isOpen={showSwitchConfirm}
        onClose={onCloseSwitch}
        onConfirm={onConfirmSwitch}
        title="Xác nhận chuyển Câu lạc bộ"
        message={
          activityToSwitch ? (
            <div>
              <p className="mb-2">Bạn có chắc chắn muốn chuyển sang câu lạc bộ <strong>{activityToSwitch.name}</strong>?</p>
              <p className="text-slate-500 text-xs">
                {transferPolicy?.first_schedule_start_time && new Date() >= new Date(transferPolicy.first_schedule_start_time)
                  ? 'Lưu ý: Câu lạc bộ hiện tại đã bắt đầu hoạt động. Yêu cầu chuyển đổi sẽ ở trạng thái chờ duyệt.'
                  : `Hành động này sẽ rời khỏi câu lạc bộ hiện tại. Bạn còn lại ${transferPolicy ? transferPolicy.self_service_changes_remaining : 3} lượt tự chuyển đổi.`}
              </p>
            </div>
          ) : ''
        }
        confirmLabel={switchLoading ? 'Đang xử lý...' : 'Xác nhận chuyển'}
        cancelLabel="Hủy"
        variant="info"
      />

      {/* Join Activity Confirmation Modal */}
      <ConfirmModal
        isOpen={showJoinConfirm}
        onClose={onCloseJoin}
        onConfirm={onConfirmJoin}
        title="Xác nhận đăng ký tham gia"
        message={`Bạn có chắc chắn muốn đăng ký tham gia "${activityToJoin?.name}"?`}
        confirmLabel={joinLoading ? 'Đang xử lý...' : 'Xác nhận'}
        cancelLabel="Hủy"
        variant="info"
      />

      {/* Bulk Action Confirmation Modal */}
      <ConfirmModal
        isOpen={bulkActionType !== null && bulkActionType !== undefined}
        onClose={onCloseBulk}
        onConfirm={onConfirmBulk}
        title={bulkActionType === 'delete' ? 'Xóa nhiều hoạt động' : 'Vô hiệu hóa nhiều hoạt động'}
        message={
          bulkActionType === 'delete'
            ? `Bạn có chắc chắn muốn xóa ${selectedCount} hoạt động đã chọn? Hành động này không thể hoàn tác.`
            : `Bạn có chắc chắn muốn vô hiệu hóa ${selectedCount} hoạt động đã chọn? Các hoạt động sẽ chuyển sang trạng thái không hoạt động.`
        }
        confirmLabel={bulkActionType === 'delete' ? 'Xóa' : 'Vô hiệu hóa'}
        cancelLabel="Hủy"
        variant={bulkActionType === 'delete' ? 'danger' : 'warning'}
      />
    </>
  );
}
