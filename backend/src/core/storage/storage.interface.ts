export type StorageVisibility = 'public' | 'private';

export type StorageNamespace =
  | 'activities'
  | 'invoices'
  | 'dormitory-qr'
  | 'room-fee-invoices';

export type AssetLifecycleState =
  | 'staged'
  | 'active'
  | 'orphan_candidate'
  | 'quarantined'
  | 'purged';

export interface StoredFileMetadata {
  key: string;
  filename: string;
  url: string;
  mime_type: string;
  size: number;
  width?: number;
  height?: number;
  sha256: string;
  visibility: StorageVisibility;
  created_at: Date;
}

export interface StorageCapacityInfo {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usagePercent: number;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
  status: 'normal' | 'warning' | 'critical' | 'degraded';
  degraded?: boolean;
}

export interface SaveFileOptions {
  namespace: StorageNamespace;
  subfolder?: string;
  filename?: string;
  visibility: StorageVisibility;
  contentType?: string;
}

export type ImagePreset =
  | 'activity_cover'
  | 'activity_logo'
  | 'activity_frame'
  | 'invoice_proof'
  | 'transfer_qr';

export interface ProcessedImageResult {
  buffer: Buffer;
  mime_type: string;
  extension: string;
  width?: number;
  height?: number;
  size: number;
}

export interface QuarantineManifest {
  asset_id: string;
  original_key: string;
  original_relative_path: string;
  quarantine_key: string;
  sha256: string;
  size: number;
  mime_type: string;
  quarantined_at: Date;
  expires_at: Date;
  reason?: string;
  actor?: string;
}

export interface ManagedFileInfo {
  key: string;
  filename: string;
  size: number;
  mtime: Date;
  ctime: Date;
  mime_type: string;
  visibility: StorageVisibility;
  namespace: StorageNamespace;
}

export interface StorageInventoryItem {
  id: string;
  namespace: StorageNamespace;
  filename: string;
  relative_key: string;
  url: string;
  size: number;
  mime_type: string;
  created_at: Date;
  modified_at: Date;
  status: AssetLifecycleState;
  referenced: boolean;
  domain_ref?: {
    domain: 'activities' | 'dormitory';
    owner_id: string;
    field: string;
    display_title?: string;
  };
  quarantine_manifest?: QuarantineManifest;
}

export interface StorageSummaryMetrics {
  capacity: StorageCapacityInfo;
  live_files_count: number;
  live_bytes: number;
  quarantined_files_count: number;
  quarantined_bytes: number;
  orphan_candidates_count: number;
  missing_references_count: number;
  last_scan?: {
    run_id: string;
    started_at: Date;
    completed_at?: Date;
    status: string;
    mode: string;
  };
}

export interface ReconciliationResult {
  run_id: string;
  mode: 'preview' | 'execute';
  scanned_files_count: number;
  scanned_bytes: number;
  referenced_files_count: number;
  orphan_files_count: number;
  missing_references_count: number;
  quarantined_count: number;
  quarantined_bytes: number;
  orphans: Array<{
    id: string;
    key: string;
    size: number;
    mtime: Date;
  }>;
  missing: Array<{
    key: string;
    domain: string;
    owner_id: string;
    field: string;
  }>;
  created_at: Date;
}
