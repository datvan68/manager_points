import type { StudentData } from "../_types";

const getEntityId = (value: any): string => {
  if (!value) return "";
  if (typeof value === "object") {
    return value._id || value.id || "";
  }
  return value;
};

/**
 * Xây dựng một Map (chỉ mục) từ danh sách summaries để phục vụ tra cứu với độ phức tạp O(1).
 * Hỗ trợ tra cứu qua nhiều loại định danh khác nhau của sinh viên (ID, student_code).
 * Loại bỏ summary._id khỏi key chỉ mục để tránh so khớp sai lệch.
 *
 * @param summaries - Danh sách các bảng điểm rèn luyện.
 * @returns Map<string, any> - Bảng băm mapping từ định danh sinh viên sang dữ liệu bảng điểm.
 */
export const buildSummaryIndex = (summaries: any[]): Map<string, any> => {
  const index = new Map<string, any>();
  if (!Array.isArray(summaries)) return index;

  summaries.forEach((summary) => {
    if (!summary) return;
    const studentIdVal = summary.student_id;
    if (studentIdVal) {
      if (typeof studentIdVal === "object") {
        if (studentIdVal._id) index.set(String(studentIdVal._id).trim().toLowerCase(), summary);
        if (studentIdVal.id) index.set(String(studentIdVal.id).trim().toLowerCase(), summary);
        if (studentIdVal.student_code) index.set(String(studentIdVal.student_code).trim().toLowerCase(), summary);
      } else if (typeof studentIdVal === "string") {
        index.set(studentIdVal.trim().toLowerCase(), summary);
      }
    }
  });

  return index;
};

/**
 * Tra cứu bảng điểm tương ứng với sinh viên O(1) từ summaryIndex.
 * Kiểm tra tuần tự các mã định danh có thể có của sinh viên (_id, id).
 *
 * @param student - Object chứa thông tin sinh viên cần tra cứu.
 * @param summaryIndex - Chỉ mục (Map) các bảng điểm đã được khởi tạo từ hàm `buildSummaryIndex`.
 * @returns Object bảng điểm nếu tìm thấy, hoặc null nếu không có.
 */
export const findSummaryForStudent = (student: any, summaryIndex: Map<string, any>): any | null => {
  if (!student || !summaryIndex) return null;

  const candidates = [
    student._id,
    student.id
  ].filter(Boolean).map(val => String(val).trim().toLowerCase());

  for (const candidate of candidates) {
    if (summaryIndex.has(candidate)) {
      return summaryIndex.get(candidate);
    }
  }

  return null;
};

/**
 * Ánh xạ danh sách roster sinh viên sang cấu trúc dữ liệu StudentData[] hiển thị trên Slider
 */
export const mapRosterWithSummaries = (
  students: any[],
  summariesData: any[],
  colors: { bg: string; text: string }[]
): StudentData[] => {
  if (!Array.isArray(students)) return [];

  // Lọc chỉ giữ summaries của học kỳ (period_id: null hoặc undefined)
  const semesterSummaries = (summariesData || []).filter(
    (sum) => !sum.period_id || sum.period_id === null
  );

  const summaryIndex = buildSummaryIndex(semesterSummaries);

  return students.map((student, idx) => {
    const studentObjectId = student._id || student.id || "";
    const studentCode = student.student_code || "";
    const summary = findSummaryForStudent(student, summaryIndex);

    const studentName = student.full_name || "Chưa rõ";
    const studentClassId = getEntityId(student.class_id);
    let studentClassName = undefined;
    if (typeof student.class_id === "object" && student.class_id?.class_name) {
      studentClassName = student.class_id.class_name;
    }

    let avatarUrl = undefined;
    if (studentCode === "20216001") {
      avatarUrl =
        "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&q=80";
    } else if (studentCode === "20216002") {
      avatarUrl =
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80";
    }

    return {
      id: studentObjectId,
      studentCode,
      name: studentName,
      email: student.email || "",
      dob: student.date_bir
        ? new Date(student.date_bir).toLocaleDateString("vi-VN")
        : "",
      gender:
        student.sex === "Male"
          ? "Nam"
          : student.sex === "Female"
            ? "Nữ"
            : "Khác",
      score: summary ? (summary.total_score || 0) : 0,
      status: student.status || "Studying",
      gradingStatus: summary ? (summary.status || "draft") : "no_summary",
      classId: studentClassId,
      className: studentClassName,
      avatarUrl,
      colorTheme: colors[idx % colors.length],
    };
  });
};
