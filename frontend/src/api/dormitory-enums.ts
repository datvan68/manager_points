/** Display labels for persisted dormitory enum codes. Keep storage/API keys
 * independent from UI copy; Vietnamese values are retained for data
 * compatibility and must always be rendered as UTF-8. */
export const DORMITORY_ENUM_LABELS = {
  Active: 'Đang hoạt động',
  Inactive: 'Ngừng hoạt động',
  Maintenance: 'Bảo trì',
  Trống: 'Trống',
  Đầy: 'Đầy',
  Khóa: 'Khóa',
  'Đang sử dụng': 'Đang sử dụng',
  'Chờ duyệt': 'Chờ duyệt',
  'Đã duyệt': 'Đã duyệt',
  'Từ chối': 'Từ chối',
  'Hiệu lực': 'Hiệu lực',
  'Hết hạn': 'Hết hạn',
  'Đã hủy': 'Đã hủy',
  'Chưa thanh toán': 'Chưa thanh toán',
  'Đã thanh toán': 'Đã thanh toán',
  'Quá hạn': 'Quá hạn',
  'Mới': 'Mới',
  'Đang xử lý': 'Đang xử lý',
  'Hoàn tất': 'Hoàn tất',
  'Đang xét': 'Đang xét',
};

export const dormitoryLabel = (value: string | undefined | null) =>
  (value && DORMITORY_ENUM_LABELS[value as keyof typeof DORMITORY_ENUM_LABELS]) || value || '';
