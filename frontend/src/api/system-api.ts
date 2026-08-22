import { httpClient, handleResponse } from './http-client';
import { tokenStorage } from './auth-api';
import { API_BASE } from './config';

export interface MessageResponse {
  message: string;
}

export interface AppBranding {
  name: string;
  shortName: string;
  version: string;
}

export const appBrandingApi = {
  publicUrl: `${API_BASE}/app-branding`,
  iconUrl(size: '180' | '192' | '512' | 'maskable-512', version: string) {
    return `${API_BASE}/app-branding/icons/${size}/${version}.png`;
  },
  async get(): Promise<AppBranding> {
    return handleResponse<AppBranding>(await fetch(`${API_BASE}/app-branding`, { cache: 'no-store' }));
  },
  async update(payload: { name: string; shortName: string; icons: Record<string, Blob> }): Promise<AppBranding> {
    const formData = new FormData();
    formData.set('name', payload.name);
    formData.set('shortName', payload.shortName);
    Object.entries(payload.icons).forEach(([name, icon]) => formData.append('icons', icon, `${name}.png`));
    return handleResponse<AppBranding>(await httpClient(`${API_BASE}/app-branding`, { method: 'PATCH', body: formData }));
  },
};

export interface LoginLog {
  _id: string;
  user_id: {
    _id: string;
    user_name: string;
    email: string;
    role: {
      name: string;
      role_code: string;
    };
  } | null;
  ip_address: string;
  action: 'login_success' | 'login_failure' | 'logout' | 'password_reset' | 'password_change' | 'admin_reset_password';
  login_time: string;
  details?: string;
  createdAt: string;
}

export interface LoginLogsSummary {
  today: {
    login_success: number;
    login_failure: number;
    logout: number;
    password_reset: number;
    password_change: number;
    admin_reset_password: number;
    total: number;
  };
  sevenDays: {
    login_success: number;
    login_failure: number;
    logout: number;
    password_reset: number;
    password_change: number;
    admin_reset_password: number;
    total: number;
  };
}

export interface SystemRequest {
  _id: string;
  title: string;
  description?: string;
  type: 'access' | 'data_change' | 'support' | 'backup' | 'other';
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  requester_id: {
    _id: string;
    user_name: string;
    email: string;
  };
  assignee_id?: {
    _id: string;
    user_name: string;
    email: string;
  } | null;
  related_entity_type?: string;
  related_entity_id?: string;
  metadata?: {
    history?: Array<{
      status: string;
      decision_note: string;
      updated_by: string;
      updated_at: string;
    }>;
    [key: string]: any;
  };
  status_history?: Array<{
    from_status: string;
    to_status: string;
    note: string;
    changed_by: string;
    changed_at: string;
  }>;
  decision_note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackupJob {
  _id: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  requested_by: {
    _id: string;
    user_name: string;
    email: string;
  };
  started_at?: string;
  finished_at?: string;
  file_name?: string;
  file_size?: number;
  collections?: string[];
  backup_format?: string;
  error_message?: string;
  createdAt: string;
}

export interface BackupPreviewCollection {
  name: string;
  document_count_in_backup: number;
  document_count_in_db: number;
  status: 'valid' | 'warning' | string;
}

export interface BackupImportPreview {
  previewSessionId: string;
  fileName: string;
  fileSize: number;
  format: string;
  hash: string;
  collections: BackupPreviewCollection[];
}

export interface RestoreJob {
  _id: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'preview' | 'cancelled' | 'expired';
  requested_by: {
    _id: string;
    user_name: string;
    email: string;
  };
  started_at?: string;
  finished_at?: string;
  source_file_name?: string;
  source_file_size?: number;
  mode?: string;
  collections?: string[];
  collection_summaries?: BackupPreviewCollection[];
  error_message?: string;
  requiresRelogin?: boolean;
  pre_restore_backup_job_id?: string;
  createdAt: string;
}

export type RestoreMode = 'replace_selected_collections' | 'merge_upsert';

export interface SystemActivity {
  hasActiveBackup: boolean;
  hasActiveRestore: boolean;
  activeJob: any;
  hasStaleJobs: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SystemPerformanceSummary {
  p50: Record<string, number>;
  p75: Record<string, number>;
  p95: Record<string, number>;
  average: Record<string, number>;
  total_samples: number;
  slow_apis: Array<{
    name: string;
    avg: number;
    p75: number;
    p95: number;
    samples: number;
  }>;
  recommendations: Array<{
    severity: 'critical' | 'warning' | 'info';
    code: string;
    message: string;
  }>;
}

export interface SystemPerformanceMetricPayload {
  route: string;
  device_type: 'desktop' | 'tablet' | 'mobile' | 'unknown';
  network_effective_type?: string;
  navigation_type?: 'navigate' | 'reload' | 'back_forward' | 'prerender' | 'unknown';
  ttfb_ms?: number;
  dom_content_loaded_ms?: number;
  load_event_ms?: number;
  fcp_ms?: number;
  lcp_ms?: number;
  cls?: number;
  inp_ms?: number;
  api_total_ms?: number;
  api_breakdown?: Array<{
    name: string;
    duration_ms: number;
    status?: number;
    ok?: boolean;
  }>;
}

export interface MailSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass?: string;
  from: string;
  hasPassword?: boolean;
}

export interface ModuleMaintenanceResponse {
  states: Record<string, boolean>;
  updatedAt?: string | null;
}

export const systemApi = {
  async getModuleMaintenanceStates(): Promise<ModuleMaintenanceResponse> {
    const res = await httpClient(`${API_BASE}/system/module-maintenance`);
    return handleResponse<ModuleMaintenanceResponse>(res);
  },

  async updateModuleMaintenanceState(moduleId: string, payload: { isMaintenance: boolean }): Promise<ModuleMaintenanceResponse> {
    const res = await httpClient(`${API_BASE}/system/module-maintenance/${encodeURIComponent(moduleId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<ModuleMaintenanceResponse>(res);
  },

  async getDashboardMetrics(semesterId?: string): Promise<any> {
    const params = new URLSearchParams();
    if (semesterId) {
      params.append('semesterId', semesterId);
    }
    const res = await httpClient(`${API_BASE}/system/dashboard-metrics?${params.toString()}`);
    return handleResponse<any>(res);
  },

  // ─── LOGIN LOGS ─────────────────────────────────────────────────────────────
  async getLoginLogs(query: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
    ip?: string;
    from?: string;
    to?: string;
    search?: string;
  }): Promise<PaginatedResponse<LoginLog>> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const res = await httpClient(`${API_BASE}/system/login-logs?${params.toString()}`);
    return handleResponse<PaginatedResponse<LoginLog>>(res);
  },

  async getLoginLogsSummary(query?: { from?: string; to?: string }): Promise<LoginLogsSummary> {
    const params = new URLSearchParams();
    if (query?.from) params.append("from", query.from);
    if (query?.to) params.append("to", query.to);
    const qs = params.toString();
    const res = await httpClient(`${API_BASE}/system/login-logs/summary${qs ? `?${qs}` : ""}`);
    return handleResponse<LoginLogsSummary>(res);
  },

  // ─── SYSTEM REQUESTS ─────────────────────────────────────────────────────────
  async getRequests(query: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    priority?: string;
    requesterId?: string;
    assigneeId?: string;
    search?: string;
    from?: string;
    to?: string;
  }): Promise<PaginatedResponse<SystemRequest>> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const res = await httpClient(`${API_BASE}/system/requests?${params.toString()}`);
    return handleResponse<PaginatedResponse<SystemRequest>>(res);
  },

  async getRequest(id: string): Promise<SystemRequest> {
    const res = await httpClient(`${API_BASE}/system/requests/${id}`);
    return handleResponse<SystemRequest>(res);
  },

  async createRequest(data: {
    title: string;
    description?: string;
    type: string;
    priority?: string;
    related_entity_type?: string;
    related_entity_id?: string;
    metadata?: Record<string, any>;
  }): Promise<SystemRequest> {
    const res = await httpClient(`${API_BASE}/system/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<SystemRequest>(res);
  },

  async updateRequest(
    id: string,
    data: {
      title?: string;
      description?: string;
      priority?: string;
      assignee_id?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<SystemRequest> {
    const res = await httpClient(`${API_BASE}/system/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<SystemRequest>(res);
  },

  async updateRequestStatus(
    id: string,
    data: {
      status: string;
      decision_note: string;
    },
  ): Promise<SystemRequest> {
    const res = await httpClient(`${API_BASE}/system/requests/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<SystemRequest>(res);
  },

  async deleteRequest(id: string): Promise<MessageResponse> {
    const res = await httpClient(`${API_BASE}/system/requests/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<MessageResponse>(res);
  },

  // ─── DATABASE BACKUPS ────────────────────────────────────────────────────────
  async getSystemActivity(): Promise<SystemActivity> {
    const res = await httpClient(`${API_BASE}/system/backups/activity`);
    return handleResponse<SystemActivity>(res);
  },

  async cleanupStaleJobs(): Promise<MessageResponse> {
    const res = await httpClient(`${API_BASE}/system/backups/cleanup-stale`, {
      method: 'POST',
    });
    return handleResponse<MessageResponse>(res);
  },

  async markJobFailed(id: string): Promise<MessageResponse> {
    const res = await httpClient(`${API_BASE}/system/backups/${id}/mark-failed`, {
      method: 'POST',
    });
    return handleResponse<MessageResponse>(res);
  },

  async getBackups(query: { page?: number; limit?: number }): Promise<PaginatedResponse<BackupJob>> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && (value as any) !== '') {
        params.append(key, String(value));
      }
    });
    const res = await httpClient(`${API_BASE}/system/backups?${params.toString()}`);
    return handleResponse<PaginatedResponse<BackupJob>>(res);
  },

  async createBackup(format?: 'auto' | 'archive' | 'ndjson'): Promise<BackupJob> {
    const res = await httpClient(`${API_BASE}/system/backups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: format || 'auto' }),
    });
    return handleResponse<BackupJob>(res);
  },

  async deleteBackup(id: string): Promise<MessageResponse> {
    const res = await httpClient(`${API_BASE}/system/backups/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<MessageResponse>(res);
  },

  async getMongoDbToolsHealth(): Promise<{ mongodump: boolean, mongorestore: boolean }> {
    const res = await httpClient(`${API_BASE}/system/backups/tools-health`);
    return handleResponse<{ mongodump: boolean, mongorestore: boolean }>(res);
  },

  async previewBackupImport(file: File): Promise<BackupImportPreview> {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await httpClient(`${API_BASE}/system/backups/import/preview`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<BackupImportPreview>(res);
  },

  async restoreBackupImport(payload: {
    previewSessionId: string;
    collections: string[];
    mode: RestoreMode;
    confirmationText: string;
  }): Promise<RestoreJob> {
    const res = await httpClient(`${API_BASE}/system/backups/import/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<RestoreJob>(res);
  },

  async cancelBackupPreview(previewSessionId: string): Promise<{ message: string }> {
    const res = await httpClient(`${API_BASE}/system/backups/import/preview/${previewSessionId}/cancel`, {
      method: 'POST',
    });
    return handleResponse<{ message: string }>(res);
  },

  async checkBsonTypes(): Promise<{ status: string, issues: any[] }> {
    const res = await httpClient(`${API_BASE}/system/backups/check-bson-types`);
    return handleResponse<{ status: string, issues: any[] }>(res);
  },

  async repairBsonTypes(): Promise<{ message: string, repaired: number, failed: number }> {
    const res = await httpClient(`${API_BASE}/system/backups/repair-bson-types`, {
      method: 'POST',
    });
    return handleResponse<{ message: string, repaired: number, failed: number }>(res);
  },

  async getRestoreJobs(query: { page?: number; limit?: number }): Promise<PaginatedResponse<RestoreJob>> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && (value as any) !== '') {
        params.append(key, String(value));
      }
    });
    const res = await httpClient(`${API_BASE}/system/backups/restore-jobs?${params.toString()}`);
    return handleResponse<PaginatedResponse<RestoreJob>>(res);
  },

  async downloadBackup(id: string, fileName: string, accessToken: string): Promise<void> {
    const res = await httpClient(`${API_BASE}/system/backups/${id}/download`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!res.ok) {
      throw new Error('Tải file sao lưu thất bại');
    }
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // ─── PERFORMANCE METRICS ───────────────────────────────────────────────────
  async sendPerformanceMetrics(payload: SystemPerformanceMetricPayload): Promise<void> {
    const url = `${API_BASE}/system/performance/metrics`;
    const tokenStr = tokenStorage.getAccessToken();
    let headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (tokenStr) {
      headers['Authorization'] = `Bearer ${tokenStr}`;
    }
    
    try {
      await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch (err) {
      console.warn('Failed to send performance metrics', err);
    }
  },

  async getPerformanceSummary(query?: { from?: string; to?: string; route?: string }): Promise<SystemPerformanceSummary> {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const res = await httpClient(`${API_BASE}/system/performance/summary?${params.toString()}`);
    return handleResponse<SystemPerformanceSummary>(res);
  },

  // ─── MAIL SETTINGS ─────────────────────────────────────────────────────────
  async getMailSettings(): Promise<MailSettings> {
    const res = await httpClient(`${API_BASE}/system/settings/mail`);
    return handleResponse<MailSettings>(res);
  },

  async updateMailSettings(payload: MailSettings): Promise<MessageResponse> {
    const res = await httpClient(`${API_BASE}/system/settings/mail`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<MessageResponse>(res);
  },

  async testMailConnection(payload?: Partial<MailSettings>): Promise<MessageResponse> {
    const res = await httpClient(`${API_BASE}/system/settings/mail/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return handleResponse<MessageResponse>(res);
  },

  async sendTestMail(to: string, config?: Partial<MailSettings>): Promise<MessageResponse> {
    const res = await httpClient(`${API_BASE}/system/settings/mail/send-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, config }),
    });
    return handleResponse<MessageResponse>(res);
  },

  // ─── STORAGE MANAGEMENT ───────────────────────────────────────────────────
  async getStorageSummary(): Promise<StorageSummaryMetrics> {
    const res = await httpClient(`${API_BASE}/system/storage/summary`);
    return handleResponse<StorageSummaryMetrics>(res);
  },

  async getStorageInventory(query?: {
    page?: number;
    limit?: number;
    status?: StorageLifecycleState;
    domain?: 'activities' | 'dormitory';
    namespace?: StorageNamespace;
    search?: string;
  }): Promise<PaginatedResponse<StorageInventoryItem>> {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const res = await httpClient(`${API_BASE}/system/storage/inventory?${params.toString()}`);
    return handleResponse<PaginatedResponse<StorageInventoryItem>>(res);
  },

  async previewStorageReconciliation(): Promise<StorageReconciliationResult> {
    const res = await httpClient(`${API_BASE}/system/storage/reconcile/preview`, {
      method: 'POST',
    });
    return handleResponse<StorageReconciliationResult>(res);
  },

  async executeStorageReconciliation(): Promise<StorageReconciliationResult> {
    const res = await httpClient(`${API_BASE}/system/storage/reconcile/execute`, {
      method: 'POST',
    });
    return handleResponse<StorageReconciliationResult>(res);
  },

  async restoreStorageAsset(assetId: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/system/storage/restore/${encodeURIComponent(assetId)}`, {
      method: 'POST',
    });
    return handleResponse<any>(res);
  },

  async purgeStorageAsset(
    assetId: string,
    payload: StoragePurgePayload,
  ): Promise<{ message: string; asset_id: string; reclaimed_bytes: number }> {
    const res = await httpClient(`${API_BASE}/system/storage/purge/${encodeURIComponent(assetId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ message: string; asset_id: string; reclaimed_bytes: number }>(res);
  },

  async getStorageAuditLogs(limit?: number): Promise<StorageAuditLogEntry[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    const res = await httpClient(`${API_BASE}/system/storage/audit-logs?${params.toString()}`);
    return handleResponse<StorageAuditLogEntry[]>(res);
  },
};

// ─── STORAGE TYPES ─────────────────────────────────────────────────────────
export type StorageLifecycleState = 'staged' | 'active' | 'orphan_candidate' | 'quarantined' | 'purged';
export type StorageNamespace = 'activities' | 'dormitory-qr' | 'invoices' | 'room-fee-invoices';

export interface StorageCapabilities {
  canExecuteReconciliation: boolean;
  canRestore: boolean;
  canPurge: boolean;
  quarantineRetentionDays: number;
}

export interface StoragePurgePayload {
  confirmationToken: string;
  confirmationPhrase: string;
  reason?: string;
}

export interface StorageCapacityInfo {
  source: 'filesystem_containing_media_root';
  measuredAt: string;
  status: 'healthy' | 'warning' | 'critical' | 'degraded';
  usedBytes: number;
  totalBytes: number;
  freeBytes: number;
  usagePercent: number;
  warningThresholdPercent?: number;
  criticalThresholdPercent?: number;
  degraded?: boolean;
}

export interface StorageSummaryMetrics {
  capacity: StorageCapacityInfo;
  capabilities?: StorageCapabilities;
  live_files_count: number;
  live_bytes: number;
  quarantined_files_count: number;
  quarantined_bytes: number;
  reclaimable_files_count: number;
  reclaimable_bytes: number;
  orphan_candidates_count: number;
  missing_references_count: number;
  last_scan?: {
    run_id: string;
    started_at: string;
    completed_at?: string;
    status: 'running' | 'completed' | 'failed' | 'partial';
    mode: 'preview' | 'execute';
  };
}

export interface StorageInventoryItem {
  id: string;
  namespace: StorageNamespace;
  filename: string;
  relative_key: string;
  url?: string;
  size: number;
  mime_type: string;
  created_at: string;
  modified_at: string;
  status: StorageLifecycleState;
  referenced: boolean;
  domain_ref?: {
    domain: 'activities' | 'dormitory';
    owner_id: string;
    field: string;
    display_title?: string;
  };
  quarantine_manifest?: {
    asset_id: string;
    original_key: string;
    size: number;
    mime_type: string;
    sha256: string;
    quarantined_at: string;
    expires_at: string;
    actor: string;
    reason: string;
    is_purge_eligible?: boolean;
    purge_eligible_at?: string;
    retention_remaining_days?: number;
    sha256_suffix?: string;
    purge_confirmation_token?: string;
  };
}

export interface StorageReconciliationResult {
  run_id: string;
  mode: 'preview' | 'execute';
  scanned_files_count: number;
  scanned_bytes: number;
  referenced_files_count: number;
  orphan_files_count: number;
  missing_references_count: number;
  quarantined_count: number;
  quarantined_bytes: number;
  orphans: Array<{ id: string; key: string; size: number; mtime: string }>;
  missing: Array<{ key: string; domain: string; owner_id: string; field: string }>;
  created_at: string;
}

export interface StorageAuditLogEntry {
  _id: string;
  run_id: string;
  action: 'preview' | 'quarantine' | 'restore' | 'purge';
  actor: string;
  mode: 'scheduled' | 'manual';
  status: 'success' | 'failed' | 'attempt';
  details?: Record<string, any>;
  createdAt: string;
}
