import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StorageManagementPage from './page';
import { useAuth, isAdminUser } from '@/providers/auth-provider';
import { systemApi } from '@/api/system-api';

// Mock dependencies
vi.mock('@/providers/auth-provider', () => ({
  useAuth: vi.fn(),
  isAdminUser: vi.fn(),
}));

vi.mock('@/api/system-api', () => ({
  systemApi: {
    getStorageSummary: vi.fn(),
    getStorageInventory: vi.fn(),
    previewStorageReconciliation: vi.fn(),
    executeStorageReconciliation: vi.fn(),
    restoreStorageAsset: vi.fn(),
    purgeStorageAsset: vi.fn(),
    getStorageAuditLogs: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('StorageManagementPage', () => {
  const mockSummary = {
    capacity: {
      status: 'healthy' as const,
      usedBytes: 35000000,
      totalBytes: 100000000,
      freeBytes: 65000000,
      usagePercent: 35,
      degraded: false,
    },
    live_files_count: 42,
    live_bytes: 32000000,
    quarantined_files_count: 5,
    quarantined_bytes: 3000000,
    orphan_candidates_count: 3,
    missing_references_count: 1,
  };

  const mockInventory = {
    items: [
      {
        id: 'token-abc123456789',
        namespace: 'activities' as const,
        filename: 'club-logo.png',
        relative_key: 'public/activities/club-logo.png',
        url: '/api/media/public/activities/club-logo.png',
        size: 154000,
        mime_type: 'image/png',
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        status: 'active' as const,
        referenced: true,
        domain_ref: {
          domain: 'activities' as const,
          owner_id: 'act-1',
          field: 'logo_url',
          display_title: 'CLB Tin Học',
        },
      },
      {
        id: 'token-quarantine987654',
        namespace: 'invoices' as const,
        filename: 'quarantined_token-quarantine987654',
        relative_key: 'private/invoices/proofs/old-proof.jpg',
        size: 520000,
        mime_type: 'image/jpeg',
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        status: 'quarantined' as const,
        referenced: false,
      },
    ],
    total: 2,
    page: 1,
    limit: 15,
    totalPages: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'admin-1', role: 'admin' },
      isLoading: false,
      hasPermission: vi.fn(() => true),
      hasAnyPermission: vi.fn(() => true),
      hasAllPermissions: vi.fn(() => true),
      isAuthenticated: true,
      permissions: ['SYSTEM_ADMIN'],
      logout: vi.fn(),
      checkAuth: vi.fn(),
      forceLogoutAfterRestore: vi.fn(),
    });
    vi.mocked(isAdminUser).mockReturnValue(true);
    vi.mocked(systemApi.getStorageSummary).mockResolvedValue(mockSummary);
    vi.mocked(systemApi.getStorageInventory).mockResolvedValue(mockInventory);
  });

  it('denies access to non-admin users', () => {
    vi.mocked(isAdminUser).mockReturnValue(false);
    render(<StorageManagementPage />);

    expect(screen.getByText('Truy cập bị từ chối')).toBeDefined();
    expect(screen.getByText(/Chức năng quản trị và đối soát lưu trữ chỉ dành riêng cho Quản trị viên/)).toBeDefined();
  });

  it('renders summary cards and capacity for admin users', async () => {
    render(<StorageManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Quản trị & Đối soát Lưu trữ')).toBeDefined();
      expect(screen.getByText('Dung lượng Ổ đĩa Lưu trữ')).toBeDefined();
      expect(screen.getByText('35%')).toBeDefined();
      expect(screen.getByText('42')).toBeDefined(); // live files count
      expect(screen.getByText('5')).toBeDefined(); // quarantined count
      expect(screen.getByText('3')).toBeDefined(); // orphan candidates count
      expect(screen.getByText('1')).toBeDefined(); // missing references count
    });
  });

  it('renders degraded status warning if telemetry is degraded', async () => {
    vi.mocked(systemApi.getStorageSummary).mockResolvedValueOnce({
      ...mockSummary,
      capacity: {
        ...mockSummary.capacity,
        status: 'degraded',
        degraded: true,
      },
    });

    render(<StorageManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/Suy giảm \(Degraded Telemetry\)/)).toBeDefined();
    });
  });

  it('renders inventory table with privacy-safe opaque metadata and no private image tags', async () => {
    render(<StorageManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('club-logo.png')).toBeDefined();
      expect(screen.getByText('CLB Tin Học')).toBeDefined();
      expect(screen.getByText('quarantined_token-quarantine987654')).toBeDefined();
      expect(screen.getByText('Khôi phục')).toBeDefined();
    });

    // Verify privacy safety: no <img> tag exists rendering payment proof or QR
    const images = document.querySelectorAll('img');
    expect(images.length).toBe(0);
  });

  it('executes preview reconciliation on button click', async () => {
    vi.mocked(systemApi.previewStorageReconciliation).mockResolvedValueOnce({
      run_id: 'run-1',
      mode: 'preview',
      scanned_files_count: 47,
      scanned_bytes: 35000000,
      referenced_files_count: 42,
      orphan_files_count: 3,
      missing_references_count: 1,
      quarantined_count: 0,
      quarantined_bytes: 0,
      orphans: [],
      missing: [],
      created_at: new Date().toISOString(),
    });

    render(<StorageManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Quét kiểm tra (Preview)')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Quét kiểm tra (Preview)'));

    await waitFor(() => {
      expect(systemApi.previewStorageReconciliation).toHaveBeenCalledTimes(1);
    });
  });

  it('opens confirmation modal and executes quarantine on confirm', async () => {
    vi.mocked(systemApi.executeStorageReconciliation).mockResolvedValueOnce({
      run_id: 'run-2',
      mode: 'execute',
      scanned_files_count: 47,
      scanned_bytes: 35000000,
      referenced_files_count: 42,
      orphan_files_count: 3,
      missing_references_count: 1,
      quarantined_count: 3,
      quarantined_bytes: 1800000,
      orphans: [],
      missing: [],
      created_at: new Date().toISOString(),
    });

    render(<StorageManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Cách ly tệp rác (Execute)')).toBeDefined();
    });

    // Click execute button to open modal
    fireEvent.click(screen.getByText('Cách ly tệp rác (Execute)'));

    // Modal should be visible
    expect(screen.getByText('Xác nhận Cách ly Tệp tin Rác')).toBeDefined();
    expect(screen.getByText(/Chính sách Ân hạn 24 giờ/)).toBeDefined();

    // Confirm in modal
    fireEvent.click(screen.getByText('Bắt đầu Cách ly'));

    await waitFor(() => {
      expect(systemApi.executeStorageReconciliation).toHaveBeenCalledTimes(1);
    });
  });

  it('restores quarantined asset on restore button click', async () => {
    vi.mocked(systemApi.restoreStorageAsset).mockResolvedValueOnce({
      asset_id: 'token-quarantine987654',
      original_key: 'private/invoices/proofs/old-proof.jpg',
      size: 520000,
    });

    render(<StorageManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Khôi phục')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Khôi phục'));

    await waitFor(() => {
      expect(systemApi.restoreStorageAsset).toHaveBeenCalledWith('token-quarantine987654');
    });
  });
});
