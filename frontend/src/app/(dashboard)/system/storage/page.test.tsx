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
      source: 'filesystem_containing_media_root' as const,
      measuredAt: new Date().toISOString(),
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
    reclaimable_files_count: 2,
    reclaimable_bytes: 1200000,
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
        id: 'token-quarantine-eligible',
        namespace: 'invoices' as const,
        filename: 'quarantined_token-eligible.jpg',
        relative_key: 'private/invoices/proofs/eligible.jpg',
        size: 520000,
        mime_type: 'image/jpeg',
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        status: 'quarantined' as const,
        referenced: false,
        quarantine_manifest: {
          asset_id: 'token-quarantine-eligible',
          original_key: 'private/invoices/proofs/eligible.jpg',
          size: 520000,
          mime_type: 'image/jpeg',
          sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          sha256_suffix: '567890',
          quarantined_at: new Date(Date.now() - 35 * 24 * 3600 * 1000).toISOString(),
          expires_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
          actor: 'system',
          reason: 'orphan_reconciliation',
          is_purge_eligible: true,
          purge_confirmation_token: 'valid-confirmation-token-123',
        },
      },
      {
        id: 'token-quarantine-locked',
        namespace: 'room-fee-invoices' as const,
        filename: 'quarantined_token-locked.jpg',
        relative_key: 'private/room-fee-invoices/locked.jpg',
        size: 680000,
        mime_type: 'image/jpeg',
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        status: 'quarantined' as const,
        referenced: false,
        quarantine_manifest: {
          asset_id: 'token-quarantine-locked',
          original_key: 'private/room-fee-invoices/locked.jpg',
          size: 680000,
          mime_type: 'image/jpeg',
          sha256: '9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef',
          sha256_suffix: '0abcdef',
          quarantined_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
          expires_at: new Date(Date.now() + 25 * 24 * 3600 * 1000).toISOString(),
          actor: 'system',
          reason: 'orphan_reconciliation',
          is_purge_eligible: false,
          retention_remaining_days: 25,
        },
      },
    ],
    total: 3,
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

  it('renders summary cards and capacity with volume source for admin users', async () => {
    render(<StorageManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Quản trị & Đối soát Lưu trữ')).toBeDefined();
      expect(screen.getByText('Dung lượng Volume Chứa Media')).toBeDefined();
      expect(screen.getByText(/filesystem_containing_media_root/)).toBeDefined();
      expect(screen.getByText('35%')).toBeDefined();
      expect(screen.getByText('42')).toBeDefined(); // live files count
      expect(screen.getByText('5')).toBeDefined(); // quarantined count
      expect(screen.getByText('2')).toBeDefined(); // reclaimable count
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
      expect(screen.getByText('quarantined_token-eligible.jpg')).toBeDefined();
      expect(screen.getByText('Xóa vĩnh viễn')).toBeDefined();
      expect(screen.getByText('Còn 25 ngày')).toBeDefined();
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

  it('opens restore confirmation modal and restores quarantined asset on confirm', async () => {
    vi.mocked(systemApi.restoreStorageAsset).mockResolvedValueOnce({
      asset_id: 'token-quarantine-eligible',
      original_key: 'private/invoices/proofs/eligible.jpg',
      size: 520000,
    });

    render(<StorageManagementPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Khôi phục').length).toBeGreaterThan(0);
    });

    // Click first Khôi phục button
    fireEvent.click(screen.getAllByText('Khôi phục')[0]);

    // Check modal appears
    expect(screen.getByText('Xác nhận Khôi phục Tệp tin')).toBeDefined();
    expect(screen.getByText('Khôi phục ngay')).toBeDefined();

    // Confirm restore
    fireEvent.click(screen.getByText('Khôi phục ngay'));

    await waitFor(() => {
      expect(systemApi.restoreStorageAsset).toHaveBeenCalledWith('token-quarantine-eligible');
    });
  });

  it('opens purge modal, requires confirmation phrase, and executes purge on confirm', async () => {
    vi.mocked(systemApi.purgeStorageAsset).mockResolvedValueOnce({
      message: 'Purged',
      asset_id: 'token-quarantine-eligible',
      reclaimed_bytes: 520000,
    });

    render(<StorageManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Xóa vĩnh viễn')).toBeDefined();
    });

    // Click Xóa vĩnh viễn button
    fireEvent.click(screen.getByText('Xóa vĩnh viễn'));

    // Purge modal appears
    expect(screen.getByText('Xác nhận Xóa Vĩnh Viễn Tệp Tin')).toBeDefined();
    expect(screen.getByText(/CẢNH BÁO NGUY HIỂM/)).toBeDefined();

    // Find submit button in modal
    const purgeSubmitBtn = screen.getByRole('button', { name: /Xác nhận Xóa Vĩnh Viễn/i });
    expect(purgeSubmitBtn.hasAttribute('disabled')).toBe(true);

    // Type phrase into input
    const phraseInput = screen.getByPlaceholderText('XÓA VĨNH VIỄN');
    fireEvent.change(phraseInput, { target: { value: 'XÓA VĨNH VIỄN' } });

    // Now button should be enabled
    expect(purgeSubmitBtn.hasAttribute('disabled')).toBe(false);

    // Add reason
    const reasonInput = screen.getByPlaceholderText(/Lý do xóa/i);
    fireEvent.change(reasonInput, { target: { value: 'Manual test cleanup' } });

    // Submit purge
    fireEvent.click(purgeSubmitBtn);

    await waitFor(() => {
      expect(systemApi.purgeStorageAsset).toHaveBeenCalledWith('token-quarantine-eligible', {
        confirmationToken: 'valid-confirmation-token-123',
        confirmationPhrase: 'XÓA VĨNH VIỄN',
        reason: 'Manual test cleanup',
      });
    });
  });

  it('disables execute, restore, and purge buttons when capabilities are disabled by configuration', async () => {
    vi.mocked(systemApi.getStorageSummary).mockResolvedValueOnce({
      ...mockSummary,
      capabilities: {
        canExecuteReconciliation: false,
        canRestore: false,
        canPurge: false,
        quarantineRetentionDays: 30,
      },
    });

    render(<StorageManagementPage />);

    await waitFor(() => {
      const executeBtn = screen.getByText('Cách ly tệp rác (Execute)').closest('button');
      expect(executeBtn?.disabled).toBe(true);
      expect(executeBtn?.title).toContain('bị vô hiệu hóa');

      const restoreBtn = screen.getAllByText('Khôi phục')[0].closest('button');
      expect(restoreBtn?.disabled).toBe(true);
      expect(restoreBtn?.title).toContain('bị vô hiệu hóa');

      const purgeBtn = screen.getByText('Xóa vĩnh viễn').closest('button');
      expect(purgeBtn?.disabled).toBe(true);
      expect(purgeBtn?.title).toContain('bị vô hiệu hóa');
    });
  });
});
