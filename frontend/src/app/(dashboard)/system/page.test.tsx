import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import SystemPage from './page';
import { systemApi } from '@/api/system-api';
import { useAuth } from '@/providers/auth-provider';



vi.mock('@/api/system-api', () => ({
  systemApi: {
    getDashboardMetrics: vi.fn().mockResolvedValue({}),
    getLoginLogs: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getLoginLogsSummary: vi.fn().mockResolvedValue({ today: {}, sevenDays: {} }),
    getRequests: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getBackups: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getRestoreJobs: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getPerformanceSummary: vi.fn().mockResolvedValue({ average: {}, p50: {}, p75: {}, p95: {}, slow_apis: [], recommendations: [] }),
    previewBackupImport: vi.fn(),
    restoreBackupImport: vi.fn(),
    getSystemActivity: vi.fn().mockResolvedValue({ hasActiveBackup: false, hasActiveRestore: false, hasStaleJobs: false }),
    sendPerformanceMetrics: vi.fn().mockResolvedValue({}),
    getMongoDbToolsHealth: vi.fn().mockResolvedValue({ mongodump: true, mongorestore: true }),
    cancelBackupPreview: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/components/guards/RouteGuard', () => ({
  RouteGuard: ({ children }: any) => <>{children}</>,
  usePermission: vi.fn(() => ({})),
}));

vi.mock('@xyflow/react', () => ({
  ReactFlow: () => <div data-testid="react-flow" />,
  Background: () => <div />,
  Controls: () => <div />,
  MiniMap: () => <div />,
  Panel: () => <div />,
  MarkerType: { ArrowClosed: 'arrow' },
}));

describe('SystemPage - Backup Import/Restore Modal', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.mocked(systemApi.getMongoDbToolsHealth).mockResolvedValue({ mongodump: true, mongorestore: true });
    vi.mocked(systemApi.getBackups).mockResolvedValue({ items: [], total: 0, page: 1, limit: 10, totalPages: 0 });
    vi.mocked(systemApi.getRestoreJobs).mockResolvedValue({ items: [], total: 0, page: 1, limit: 10, totalPages: 0 });
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { role: { permissions: ['DATABASE_BACKUP_READ', 'DATABASE_BACKUP_RESTORE'] } },
      hasPermission: (perm: string) => ['DATABASE_BACKUP_READ', 'DATABASE_BACKUP_RESTORE'].includes(perm),
      forceLogoutAfterRestore: vi.fn(),
    });
    
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should handle file upload, render preview modal, and submit restore job correctly', async () => {
    const mockPreviewData = {
      previewSessionId: 'test-session-123',
      fileName: 'backup.gz',
      fileSize: 1024,
      format: 'ndjson_gzip',
      hash: 'abc',
      collections: [
        { name: 'users', document_count_in_backup: 10, document_count_in_db: 5, status: 'valid' }
      ]
    };

    (systemApi.previewBackupImport as ReturnType<typeof vi.fn>).mockResolvedValue(mockPreviewData);
    (systemApi.restoreBackupImport as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'job-1' });

    await act(async () => {
      render(<SystemPage />);
    });

    // Wait for the import input to be in document
    // Find the hidden input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    // Upload file
    const file = new File(['dummy content'], 'backup.gz', { type: 'application/gzip' });
    
    // Wrap in act implicitly by using fireEvent
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Ensure API was called
    await waitFor(() => {
      expect(systemApi.previewBackupImport).toHaveBeenCalledWith(file);
    });

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('Khôi phục dữ liệu: Xem trước')).toBeTruthy();
    });

    // Check if collection is rendered
    expect(screen.getByText('users')).toBeTruthy();

    // Find the restore button, should be disabled initially (because confirmText and checkbox aren't checked)
    const restoreBtn = screen.getByRole('button', { name: 'Tiến hành khôi phục' });
    expect((restoreBtn as HTMLButtonElement).disabled).toBe(true);

    // Check the "I understand" checkbox
    const confirmationCheckboxes = screen.getAllByRole('checkbox').slice(-2);
    confirmationCheckboxes.forEach((checkbox) => fireEvent.click(checkbox));

    // Input "RESTORE" confirmation text
    const confirmInput = screen.getByPlaceholderText('RESTORE');
    fireEvent.change(confirmInput, { target: { value: 'RESTORE' } });

    // Button should be enabled now
    await waitFor(() => {
      expect((restoreBtn as HTMLButtonElement).disabled).toBe(false);
    });

    // Click restore
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(systemApi.restoreBackupImport).toHaveBeenCalledWith({
        previewSessionId: 'test-session-123',
        collections: ['users'], // Checked by default
        mode: 'replace_selected_collections',
        confirmationText: 'RESTORE'
      });
    });
  });

  it('renders the compact system header and only permitted features without decorative motion', async () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { role: { permissions: ['LOGIN_LOG_READ', 'SYSTEM_REQUEST_READ', 'DATABASE_BACKUP_READ', 'SYSTEM_PERFORMANCE_READ'] } },
      hasPermission: (perm: string) => ['LOGIN_LOG_READ', 'SYSTEM_REQUEST_READ', 'DATABASE_BACKUP_READ', 'SYSTEM_PERFORMANCE_READ'].includes(perm),
      forceLogoutAfterRestore: vi.fn(),
    });

    const { container } = render(<SystemPage />);

    expect(await screen.findByRole('heading', { name: 'Quản lý Phân hệ Hệ thống' })).toBeTruthy();
    expect(screen.getByText('Truy cập các tính năng hệ thống theo quyền được cấp.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Lịch sử đăng nhập/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Quản lý yêu cầu/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Sao lưu database/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Hiệu năng/ })).toBeTruthy();
    const headerMarkup = container.querySelector('main > div')?.innerHTML ?? '';
    expect(headerMarkup).not.toMatch(/animate-in|animate-pulse|hover:scale|transition-(all|colors)/);
  });

  it('hides feature navigation when its read permission is absent', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { role: { permissions: ['LOGIN_LOG_READ'] } },
      hasPermission: (perm: string) => perm === 'LOGIN_LOG_READ',
      forceLogoutAfterRestore: vi.fn(),
    });

    render(<SystemPage />);

    expect(screen.getByRole('button', { name: /Lịch sử đăng nhập/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Quản lý yêu cầu/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Sao lưu database/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Hiệu năng/ })).toBeNull();
  });
});
