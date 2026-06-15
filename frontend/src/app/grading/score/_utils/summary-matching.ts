import type { StudentData } from "../_types";

const getEntityId = (value: any): string => {
  if (!value) return "";
  if (typeof value === "object") {
    return value._id || value.id || "";
  }
  return value;
};

/**
 * Lập chỉ mục summaries theo các định danh sinh viên để phục vụ tra cứu O(1)
 * Loại bỏ summary._id khỏi key chỉ mục để tránh so khớp sai lệch
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
 * Tra cứu summary tương ứng với sinh viên O(1) từ summaryIndex
 */
export const findSummaryForStudent = (student: any, summaryIndex: Map<string, any>): any | null => {
  if (!student || !summaryIndex) return null;

  const candidates = [
    student.student_code,
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
    const studentId = student.student_code || student._id || `student-${idx}`;
    const summary = findSummaryForStudent(student, summaryIndex);

    const studentName = student.full_name || "Chưa rõ";
    const studentClassId = getEntityId(student.class_id);

    let avatarUrl = undefined;
    if (studentId === "20216001") {
      avatarUrl =
        "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&q=80";
    } else if (studentId === "20216002") {
      avatarUrl =
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80";
    }

    return {
      id: studentId,
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
      avatarUrl,
      colorTheme: colors[idx % colors.length],
    };
  });
};
