'use client';

import { notificationApi, NotificationItem, UpdateNotificationDto } from '@/api/notification-api';
import { isAuthError } from '@/api/http-client';

export type { NotificationItem };

/**
 * Lớp adapter hỗ trợ tương thích ngược cho các tác vụ chạy nền (background helper).
 * Các phương thức ở đây bắt lỗi và ghi log console mà không ném lỗi lên giao diện (best-effort).
 * ĐỐI VỚI CÁC THAO TÁC TRỰC TIẾP TỪ UI (nhập liệu, sửa, xóa thủ công), hãy sử dụng trực tiếp `notificationApi` 
 * từ `@/api/notification-api` để xử lý ngoại lệ và hiển thị thông báo lỗi (Toast) rõ ràng.
 */

function logUnexpectedNotificationError(message: string, error: unknown) {
  if (!isAuthError(error)) {
    console.error(message, error);
  }
}

export const getNotifications = async (): Promise<NotificationItem[]> => {
  try {
    const data = await notificationApi.getNotifications({ page: 1, limit: 100 });
    return data.items;
  } catch (error) {
    logUnexpectedNotificationError('Failed to fetch notifications:', error);
    return [];
  }
};

export const addNotification = async (
  title: string,
  description: string,
  type: NotificationItem['type'],
  routeUrl?: string
): Promise<void> => {
  try {
    await notificationApi.createNotification({ title, description, type, routeUrl });
    window.dispatchEvent(new Event('notifications-updated'));
  } catch (error) {
    logUnexpectedNotificationError('Failed to add notification:', error);
  }
};

export const updateNotification = async (
  id: string,
  updatedFields: UpdateNotificationDto
): Promise<void> => {
  try {
    await notificationApi.updateNotification(id, updatedFields);
    window.dispatchEvent(new Event('notifications-updated'));
  } catch (error) {
    logUnexpectedNotificationError('Failed to update notification:', error);
  }
};

export const markRead = async (id: string): Promise<void> => {
  try {
    await notificationApi.markRead(id);
    window.dispatchEvent(new Event('notifications-updated'));
  } catch (error) {
    logUnexpectedNotificationError('Failed to mark notification as read:', error);
  }
};

export const markAllRead = async (): Promise<void> => {
  try {
    await notificationApi.markAllRead();
    window.dispatchEvent(new Event('notifications-updated'));
  } catch (error) {
    logUnexpectedNotificationError('Failed to mark all notifications as read:', error);
  }
};

export const deleteNotification = async (id: string): Promise<void> => {
  try {
    await notificationApi.deleteNotification(id);
    window.dispatchEvent(new Event('notifications-updated'));
  } catch (error) {
    logUnexpectedNotificationError('Failed to delete notification:', error);
  }
};
