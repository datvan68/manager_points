/**
 * Persisted dormitory enum values are retained in Vietnamese for backwards
 * compatibility with existing documents. These maps are the only place where
 * storage values are translated into user-facing labels.
 */
export const DORMITORY_ENUMS = {
  buildingStatus: ['Active', 'Inactive', 'Maintenance'] as const,
  roomStatus: ['Trống', 'Đầy', 'Khóa', 'Bảo trì'] as const,
  // `Đã nghỉ` is the persisted compatibility label for retired beds.
  bedStatus: ['Trống', 'Đang sử dụng', 'Bảo trì', 'Đã nghỉ'] as const,
  registrationStatus: ['Chờ duyệt', 'Đã duyệt', 'Từ chối'] as const,
  contractStatus: ['Hiệu lực', 'Hết hạn', 'Đã hủy'] as const,
  invoiceStatus: ['Chưa thanh toán', 'Đã thanh toán', 'Quá hạn'] as const,
  violationStatus: ['Mới', 'Đã xử lý', 'Đang xét'] as const,
  maintenanceStatus: ['Mới', 'Đang xử lý', 'Hoàn tất', 'Từ chối'] as const,
  publicRegistrationStatus: ['Chờ xác nhận', 'Đã xác nhận', 'Từ chối'] as const,
  roomType: ['Thường', 'Máy lạnh'] as const,
} as const;

export const DORMITORY_ENUM_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(DORMITORY_ENUMS)
    .flat()
    .map((value) => [value, value]),
);
