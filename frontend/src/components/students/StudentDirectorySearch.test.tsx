import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentDirectorySearch from "./StudentDirectorySearch";
import { studentApi } from "@/api/student-api";
import { ApiError } from "@/api/http-client";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/api/student-api", () => ({
  studentApi: { getStudents: vi.fn() },
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
    mockPush.mockClear();
  });
  afterEach(() => vi.useRealTimers());

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
});
