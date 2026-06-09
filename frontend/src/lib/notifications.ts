'use client';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'warning' | 'success' | 'info' | 'system';
  isRead: boolean;
  routeUrl?: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n-1',
    title: 'Cảnh báo chuyên cần',
    description: 'HSSV Nguyễn Văn A vắng mặt 3 buổi không phép ở Lớp CNTT-K45A.',
    time: '5 phút trước',
    type: 'warning',
    isRead: false,
    routeUrl: '/students/record'
  },
  {
    id: 'n-2',
    title: 'Đạt thành tích xuất sắc',
    description: 'Lớp CNTT-K44CLC đạt giải Nhất cuộc thi Olympic Tin học cấp trường.',
    time: '2 giờ trước',
    type: 'success',
    isRead: false,
    routeUrl: '/students'
  },
  {
    id: 'n-3',
    title: 'Nhiệm vụ học tập mới',
    description: 'Nhiệm vụ mới "Thiết kế UI cho Mobile App" được giao cho lớp K45A.',
    time: '5 giờ trước',
    type: 'info',
    isRead: false,
    routeUrl: '/students/tasks'
  },
  {
    id: 'n-4',
    title: 'Bảo trì hệ thống định kỳ',
    description: 'Hệ thống sẽ tạm dừng hoạt động để cập nhật tính năng lúc 23:00 tối nay.',
    time: '1 ngày trước',
    type: 'system',
    isRead: true
  }
];

const STORAGE_KEY = 'user_notifications';

export const getNotifications = (): NotificationItem[] => {
  if (typeof window === 'undefined') return [];
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      return INITIAL_NOTIFICATIONS;
    }
  }
  // Initialize on first access
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_NOTIFICATIONS));
  return INITIAL_NOTIFICATIONS;
};

export const saveNotifications = (notifications: NotificationItem[]): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new Event('notifications-updated'));
};

export const addNotification = (
  title: string,
  description: string,
  type: NotificationItem['type'],
  routeUrl?: string
): void => {
  if (typeof window === 'undefined') return;
  const current = getNotifications();
  const newItem: NotificationItem = {
    id: `n-${Date.now()}`,
    title,
    description,
    time: 'Vừa xong',
    type,
    isRead: false,
    routeUrl
  };
  const updated = [newItem, ...current];
  saveNotifications(updated);
};

export const markRead = (id: string): void => {
  const current = getNotifications();
  const updated = current.map(n => n.id === id ? { ...n, isRead: true } : n);
  saveNotifications(updated);
};

export const markAllRead = (): void => {
  const current = getNotifications();
  const updated = current.map(n => ({ ...n, isRead: true }));
  saveNotifications(updated);
};

export const deleteNotification = (id: string): void => {
  const current = getNotifications();
  const updated = current.filter(n => n.id !== id);
  saveNotifications(updated);
};
