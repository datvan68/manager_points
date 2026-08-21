export type StorageVisibility = 'public' | 'private';

export type StorageNamespace =
  | 'activities'
  | 'invoices'
  | 'dormitory-qr'
  | 'room-fee-invoices';

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
  status: 'normal' | 'warning' | 'critical';
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
