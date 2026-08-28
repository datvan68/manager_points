import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentDirectorySearch from "./StudentDirectorySearch";
import { studentApi } from "@/api/student-api";
import { ApiError } from "@/api/http-client";
import { academicRecordApi } from "@/api/academic-record-api";
import { criteriaApi } from "@/api/criteria-api";
import { semesterApi } from "@/api/semester-api";
import { CRITERION_USAGE_STORAGE_KEY_PREFIX } from "@/components/grading/criterion-usage";

const mockPush = vi.fn();
const mockUseAuth = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/api/student-api", () => ({
  studentApi: { getStudents: vi.fn() },
}));

vi.mock("@/api/academic-record-api", () => ({
  academicRecordApi: { createAcademicRecord: vi.fn() },
}));
vi.mock("@/api/criteria-api", () => ({
  criteriaApi: { getCriteria: vi.fn() },
}));
vi.mock("@/api/semester-api", () => ({
  semesterApi: { getSemesters: vi.fn() },
}));
vi.mock("@/providers/auth-provider", () => ({
  useAuth: mockUseAuth,
}));

const student = {
  _id: "student-1",
  student_code: "SV001",
  full_name: "Nguyễn Văn A",
  date_bir: "2003-01-01",
  sex: "Male",
  email: "a@example.com",
  status: "Studying",
  class_id: { _id: "class-1", class_name: "CNTT-K45A" },
};

const makeMockStudents = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    _id: `student-${i + 1}`,
    student_code: `SV00${i + 1}`,
    full_name: `Sinh viên ${i + 1}`,
    date_bir: "2003-01-01",
    sex: "Male",
    email: `sv${i + 1}@example.com`,
    status: "Studying",
    class_id: { _id: `class-${i + 1}`, class_name: `CNTT-K45A` },
  }));

describe("StudentDirectorySearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    mockPush.mockClear();
    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, hasPermission: () => true });
  });
  afterEach(() => vi.useRealTimers());

  const openPreview = async () => {
    vi.mocked(studentApi.getStudents).mockResolvedValue({ data: [student], meta: {} });
    render(<StudentDirectorySearch />);
    fireEvent.change(screen.getByPlaceholderText("Tìm kiếm sinh viên..."), { target: { value: "SV" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: /Nguyễn Văn A/ }));
  };

  it("does not request for one trimmed character and debounces a bounded slider search with limit 20", async () => {
    vi.mocked(studentApi.getStudents).mockResolvedValue({ data: [student], meta: {} });
    render(<StudentDirectorySearch onOpenDetail={vi.fn()} />);
    const input = screen.getByPlaceholderText("Tìm kiếm sinh viên...");

    fireEvent.change(input, { target: { value: " A " } });
    act(() => vi.advanceTimersByTime(500));
    expect(studentApi.getStudents).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: " AB " } });
    act(() => vi.advanceTimersByTime(399));
    expect(studentApi.getStudents).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); await Promise.resolve(); });
    expect(studentApi.getStudents).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20, search: "AB", fields: "slider", signal: expect.any(AbortSignal) }));
  });

  it("aborts the previous request and opens a keyboard-accessible preview", async () => {
    const signals: AbortSignal[] = [];
    vi.mocked(studentApi.getStudents).mockImplementation(async (params) => {
      signals.push(params?.signal as AbortSignal);
      return { data: [student], meta: {} };
    });
    const onOpenDetail = vi.fn();
    render(<StudentDirectorySearch onOpenDetail={onOpenDetail} />);
    const input = screen.getByPlaceholderText("Tìm kiếm sinh viên...");
    fireEvent.change(input, { target: { value: "Ng" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Nguyễn" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });
    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Nguyễn Văn A/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("SV001");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ignores a stale response that resolves after the query has changed", async () => {
    let resolveFirst!: (value: { data: typeof student[] }) => void;
    let resolveSecond!: (value: { data: typeof student[] }) => void;
    const newerStudent = { ...student, _id: "student-2", full_name: "Nguyễn Văn B" };
    vi.mocked(studentApi.getStudents)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    render(<StudentDirectorySearch />);

    const input = screen.getByPlaceholderText("Tìm kiếm sinh viên...");
    fireEvent.change(input, { target: { value: "Ng" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });
    fireEvent.change(input, { target: { value: "Nguyễn" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });

    await act(async () => {
      resolveFirst({ data: [student] });
      resolveSecond({ data: [newerStudent] });
      await Promise.resolve();
    });

    expect(screen.queryByText("Nguyễn Văn A")).not.toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn B")).toBeInTheDocument();
  });

  it("renders array responses and an explicit empty state", async () => {
    vi.mocked(studentApi.getStudents).mockResolvedValueOnce([student]).mockResolvedValueOnce([]);
    render(<StudentDirectorySearch />);
    const input = screen.getByPlaceholderText("Tìm kiếm sinh viên...");

    fireEvent.change(input, { target: { value: "SV" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "XX" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });
    expect(screen.getByText("Không tìm thấy sinh viên phù hợp.")).toBeInTheDocument();
  });

  it("navigates through the populated class id from the preview", async () => {
    vi.mocked(studentApi.getStudents).mockResolvedValue({ data: [student], meta: {} });
    const onOpenDetail = vi.fn();
    render(<StudentDirectorySearch onOpenDetail={onOpenDetail} />);
    fireEvent.change(screen.getByPlaceholderText("Tìm kiếm sinh viên..."), { target: { value: "SV" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: /Nguyễn Văn A/ }));
    fireEvent.click(screen.getByRole("button", { name: /Chi tiết/ }));
    expect(onOpenDetail).toHaveBeenCalledWith(student);
  });

  it("uses mobile-sized targets for results, preview actions, and criterion controls", async () => {
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue([{ _id: "criterion-1", criterion_name: "Đi học đúng giờ" }] as any);
    vi.mocked(semesterApi.getSemesters).mockResolvedValue([{ _id: "semester-1", semester_name: "HK1", status: "active" }] as any);
    await openPreview();

    expect(screen.getByPlaceholderText("Tìm kiếm sinh viên...")).toHaveClass("min-h-11", "sm:min-h-0");
    expect(screen.getByRole("button", { name: "Đóng thông tin sinh viên" })).toHaveClass("h-11", "w-11", "sm:h-8", "sm:w-8");
    expect(screen.getByRole("button", { name: /Chi tiết/ })).toHaveClass("min-h-11", "sm:min-h-0");
    const recordButton = screen.getByRole("button", { name: "Ghi nhận" });
    expect(recordButton).toHaveClass("min-h-11", "sm:min-h-0");

    fireEvent.click(recordButton);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByPlaceholderText("Tìm tiêu chí...")).toHaveClass("min-h-11", "sm:min-h-0");
    expect(screen.getByRole("button", { name: /Đi học đúng giờ/ })).toHaveClass("min-h-11", "sm:min-h-0");
    expect(screen.getByRole("button", { name: "Đóng" })).toHaveClass("min-h-11", "sm:min-h-0");
    expect(screen.getByRole("button", { name: "Xác nhận ghi nhận" })).toHaveClass("min-h-11", "sm:min-h-0");
  });

  it("renders more than 8 results inside a capped scrollable container and replaces options on select", async () => {
    const mockStudents = makeMockStudents(12);
    vi.mocked(studentApi.getStudents).mockResolvedValue({ data: mockStudents, meta: {} });
    render(<StudentDirectorySearch onOpenDetail={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Tìm kiếm sinh viên..."), { target: { value: "Sinh" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });

    const list = screen.getByRole("list", { name: "Kết quả tìm kiếm sinh viên" });
    expect(list).toHaveClass("overflow-y-auto");
    expect(list).toHaveClass("max-h-[384px]");
    const buttons = screen.getAllByRole("button", { name: /Sinh viên/ });
    expect(buttons).toHaveLength(12);
    expect(buttons[0]).toHaveClass("min-h-11", "sm:min-h-0");

    // Selecting result replaces options surface with preview dialog
    fireEvent.click(buttons[0]);
    expect(screen.queryByRole("list", { name: "Kết quả tìm kiếm sinh viên" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Sinh viên 1");
  });

  it("handles 429 rate limit error and generic error", async () => {
    vi.mocked(studentApi.getStudents).mockRejectedValueOnce(new ApiError("Too Many Requests", 429));
    render(<StudentDirectorySearch onOpenDetail={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Tìm kiếm sinh viên..."), { target: { value: "SV" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });

    expect(screen.getByText("Bạn đang tìm kiếm quá nhanh. Vui lòng thử lại sau.")).toBeInTheDocument();
  });

  it("settles loading and shows a message for a generic request error", async () => {
    vi.mocked(studentApi.getStudents).mockRejectedValue(new Error("network unavailable"));
    render(<StudentDirectorySearch />);

    fireEvent.change(screen.getByPlaceholderText("Tìm kiếm sinh viên..."), { target: { value: "SV" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });

    expect(screen.queryByText("Đang tìm kiếm...")).not.toBeInTheDocument();
    expect(screen.getByText("Không thể tìm kiếm sinh viên.")).toBeInTheDocument();
  });

  it("supports default router navigation when onOpenDetail is omitted", async () => {
    vi.mocked(studentApi.getStudents).mockResolvedValue({ data: [student], meta: {} });
    render(<StudentDirectorySearch />);

    fireEvent.change(screen.getByPlaceholderText("Tìm kiếm sinh viên..."), { target: { value: "SV" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: /Nguyễn Văn A/ }));
    fireEvent.click(screen.getByRole("button", { name: /Chi tiết/ }));
    expect(mockPush).toHaveBeenCalledWith("/students/class-1/student-1");
  });

  it("supports controlled onClose and Escape to close surface when no student selected", async () => {
    const onClose = vi.fn();
    render(<StudentDirectorySearch isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByRole("button", { name: "Đóng tìm kiếm" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("portals preview to document.body when usePortal is true and preserves interactions", async () => {
    vi.mocked(studentApi.getStudents).mockResolvedValue({ data: [student], meta: {} });
    const onOpenDetail = vi.fn();
    const { container } = render(<StudentDirectorySearch onOpenDetail={onOpenDetail} usePortal={true} />);

    fireEvent.change(screen.getByPlaceholderText("Tìm kiếm sinh viên..."), { target: { value: "SV" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });

    fireEvent.click(screen.getByRole("button", { name: /Nguyễn Văn A/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(document.body).toContainElement(dialog);
    expect(container).not.toContainElement(dialog);

    const overlay = screen.getByRole("presentation");
    expect(overlay).toHaveClass("fixed", "inset-0", "z-50", "flex", "items-center", "justify-center");

    // Close via Đóng button
    const closeBtn = screen.getByRole("button", { name: "Đóng thông tin sinh viên" });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes portaled preview on outside click (overlay backdrop click)", async () => {
    vi.mocked(studentApi.getStudents).mockResolvedValue({ data: [student], meta: {} });
    render(<StudentDirectorySearch usePortal={true} />);

    fireEvent.change(screen.getByPlaceholderText("Tìm kiếm sinh viên..."), { target: { value: "SV" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });

    fireEvent.click(screen.getByRole("button", { name: /Nguyễn Văn A/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const overlay = screen.getByRole("presentation");
    fireEvent.mouseDown(overlay);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps preview inside container when usePortal is false (default)", async () => {
    vi.mocked(studentApi.getStudents).mockResolvedValue({ data: [student], meta: {} });
    const { container } = render(<StudentDirectorySearch />);

    fireEvent.change(screen.getByPlaceholderText("Tìm kiếm sinh viên..."), { target: { value: "SV" } });
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });

    fireEvent.click(screen.getByRole("button", { name: /Nguyễn Văn A/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(container).toContainElement(dialog);
  });

  it("gates record creation by permission", async () => {
    await openPreview();
    expect(screen.getByRole("button", { name: "Ghi nhận" })).toBeInTheDocument();
  });

  it("does not expose record creation to read-only users", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, hasPermission: () => false });
    await openPreview();
    expect(screen.queryByRole("button", { name: "Ghi nhận" })).not.toBeInTheDocument();
  });

  it("loads criteria and active semester, then creates one record with the selected values", async () => {
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue([{ _id: "criterion-1", criterion_name: "Đi học đúng giờ" }] as any);
    vi.mocked(semesterApi.getSemesters).mockResolvedValue([{ _id: "semester-1", semester_name: "HK1", status: "active" }] as any);
    vi.mocked(academicRecordApi.createAcademicRecord).mockResolvedValue({} as any);
    await openPreview();
    fireEvent.click(screen.getByRole("button", { name: "Ghi nhận" }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("button", { name: "Xác nhận ghi nhận" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Đi học đúng giờ/ }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận ghi nhận" }));
    await act(async () => { await Promise.resolve(); });
    expect(academicRecordApi.createAcademicRecord).toHaveBeenCalledWith(expect.objectContaining({
      student_id: "student-1", criterion_id: "criterion-1", semester_id: "semester-1",
      record_title: "Đi học đúng giờ", recorded_by: "user-1", status: "active",
      recorded_at: expect.any(String), idempotency_key: expect.any(String),
    }));
    expect(screen.getByText("Đã ghi nhận sinh viên thành công.")).toBeInTheDocument();
  });

  it("keeps the preview and selection after a create failure", async () => {
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue([{ _id: "criterion-1", criterion_name: "Đi học đúng giờ" }] as any);
    vi.mocked(semesterApi.getSemesters).mockResolvedValue([{ _id: "semester-1", semester_name: "HK1", status: "active" }] as any);
    vi.mocked(academicRecordApi.createAcademicRecord).mockRejectedValue(new Error("failed"));
    await openPreview();
    fireEvent.click(screen.getByRole("button", { name: "Ghi nhận" }));
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: /Đi học đúng giờ/ }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận ghi nhận" }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đi học đúng giờ/ })).toHaveClass("bg-blue-50");
    expect(screen.getByText("Không thể ghi nhận sinh viên. Vui lòng thử lại.")).toBeInTheDocument();
  });

  it("shows a safe server reason and keeps the selected criterion after an API rejection", async () => {
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue([{ _id: "criterion-1", criterion_name: "Đi học đúng giờ" }] as any);
    vi.mocked(semesterApi.getSemesters).mockResolvedValue([{ _id: "semester-1", semester_name: "HK1", status: "active" }] as any);
    vi.mocked(academicRecordApi.createAcademicRecord).mockRejectedValue(new ApiError("Học kỳ đã khóa", 403));
    await openPreview();
    fireEvent.click(screen.getByRole("button", { name: "Ghi nhận" }));
    await act(async () => { await Promise.resolve(); });
    const criterionButton = screen.getByRole("button", { name: /Đi học đúng giờ/ });
    fireEvent.click(criterionButton);
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận ghi nhận" }));
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText("Học kỳ đã khóa")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đi học đúng giờ/ })).toHaveClass("bg-blue-50");
  });

  it("renders unique criteria in a dynamic top-three group and promotes a selected criterion", async () => {
    localStorage.setItem(`${CRITERION_USAGE_STORAGE_KEY_PREFIX}user-1`, JSON.stringify({ one: 3, two: 2, three: 1 }));
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue([
      { _id: "one", criterion_name: "Một" },
      { _id: "two", criterion_name: "Hai" },
      { _id: "three", criterion_name: "Ba" },
      { _id: "four", criterion_name: "Bốn" },
      { _id: "two", criterion_name: "Hai (trùng)" },
    ] as any);
    vi.mocked(semesterApi.getSemesters).mockResolvedValue([{ _id: "semester-1", semester_name: "HK1", status: "active" }] as any);
    await openPreview();
    fireEvent.click(screen.getByRole("button", { name: "Ghi nhận" }));
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText("Sử dụng nhiều")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Hai/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Bốn/ })).toBeInTheDocument();

    const fourButton = screen.getByRole("button", { name: /Bốn/ });
    fireEvent.click(fourButton);
    fireEvent.click(screen.getByRole("button", { name: /Bốn/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bốn/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bốn/ }));
    expect(localStorage.getItem(`${CRITERION_USAGE_STORAGE_KEY_PREFIX}user-1`)).toContain('"four":4');
    const promotedFourButton = screen.getByRole("button", { name: /Bốn/ });
    const firstCriterionButton = screen.getByRole("button", { name: /Một/ });
    expect(promotedFourButton.compareDocumentPosition(firstCriterionButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ba/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Hai/ })).toHaveLength(1);
  });

  it("blocks duplicate submissions while the record is saving", async () => {
    let resolveCreate!: (value: any) => void;
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue([{ _id: "criterion-1", criterion_name: "Đi học đúng giờ" }] as any);
    vi.mocked(semesterApi.getSemesters).mockResolvedValue([{ _id: "semester-1", semester_name: "HK1", status: "active" }] as any);
    vi.mocked(academicRecordApi.createAcademicRecord).mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }));
    await openPreview();
    fireEvent.click(screen.getByRole("button", { name: "Ghi nhận" }));
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: /Đi học đúng giờ/ }));
    const confirm = screen.getByRole("button", { name: "Xác nhận ghi nhận" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(academicRecordApi.createAcademicRecord).toHaveBeenCalledTimes(1);
    await act(async () => { resolveCreate({}); await Promise.resolve(); });
  });
});
