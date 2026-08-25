import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentDirectorySearch from "./StudentDirectorySearch";
import { studentApi } from "@/api/student-api";

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

describe("StudentDirectorySearch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not request for one trimmed character and debounces a bounded slider search", async () => {
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
    expect(studentApi.getStudents).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 8, search: "AB", fields: "slider", signal: expect.any(AbortSignal) }));
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
});
