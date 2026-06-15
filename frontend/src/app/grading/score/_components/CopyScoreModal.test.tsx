import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CopyScoreModal, { StudentData } from "./CopyScoreModal";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

// Mock framer-motion to simplify rendering and avoid animation timing issues in JSDOM
vi.mock("framer-motion", () => {
  const React = require("react");
  const mockMotion = new Proxy({}, {
    get: (target, propertyName) => {
      if (typeof propertyName !== "string") return undefined;
      return ({ children, className, style, onClick, ...props }: any) => {
        const { initial, animate, transition, exit, layout, ...domProps } = props;
        return React.createElement(propertyName, { className, style, onClick, ...domProps }, children);
      };
    }
  });

  return {
    motion: mockMotion,
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});

describe("CopyScoreModal Component", () => {
  const sourceStudent: StudentData = {
    id: "SV001",
    name: "Nguyễn Văn Nguồn",
    email: "nguon@gmail.com",
    dob: "2004-01-01",
    gender: "Nam",
    score: 85,
    status: "active",
    gradingStatus: "draft",
    classId: "C01"
  };

  const mockStudents: StudentData[] = [
    sourceStudent,
    {
      id: "SV002",
      name: "Trần Văn Đích",
      email: "dich@gmail.com",
      dob: "2004-02-02",
      gender: "Nam",
      score: 70,
      status: "active",
      gradingStatus: "draft",
      classId: "C01"
    },
    {
      id: "SV003",
      name: "Lê Thị Khóa",
      email: "khoa@gmail.com",
      dob: "2004-03-03",
      gender: "Nữ",
      score: 90,
      status: "active",
      gradingStatus: "locked", // Bị khóa
      classId: "C01"
    },
    {
      id: "SV004",
      name: "Phạm Văn Trống",
      email: "trong@gmail.com",
      dob: "2004-04-04",
      gender: "Nam",
      score: 0,
      status: "active",
      gradingStatus: "draft",
      classId: "C01"
    }
  ];

  const studentSummaryMap = {
    SV001: "sum_001",
    SV002: "sum_002",
    SV003: "sum_003"
    // SV004 không có summary
  };

  const apiSummariesPoints = [
    { _id: "sum_001", status: "draft" },
    { _id: "sum_002", status: "draft" },
    { _id: "sum_003", status: "locked" } // Locked ở summary status
  ];

  it("renders source student details and disabled target states correctly", () => {
    const handleClose = vi.fn();
    const handleCopyConfirm = vi.fn();

    render(
      <CopyScoreModal
        isOpen={true}
        onClose={handleClose}
        sourceStudent={sourceStudent}
        students={mockStudents}
        studentSummaryMap={studentSummaryMap}
        apiSummariesPoints={apiSummariesPoints}
        semesterName="Học kỳ I"
        className="Lớp CNTT1"
        onCopyConfirm={handleCopyConfirm}
      />
    );

    // Kiểm tra thông tin SV nguồn
    expect(screen.getAllByText("Nguyễn Văn Nguồn").length).toBe(2);
    expect(screen.getAllByText(/MSSV:\s*SV001/i).length).toBe(2);
    expect(screen.getByText("85")).toBeDefined();

    // SV001 là nguồn -> Phải bị disabled
    expect(screen.getByText("Sinh viên nguồn")).toBeDefined();

    // SV003 bị khóa -> Phải bị disabled
    expect(screen.getByText("Bảng điểm đã chốt")).toBeDefined();

    // SV004 không có summary -> Phải bị disabled
    expect(screen.getByText("Chưa tạo bảng điểm")).toBeDefined();

    // Chỉ có SV002 là selectable
    expect(screen.getByText("Trần Văn Đích")).toBeDefined();
  });

  it("supports toggle select and select all visible", () => {
    const handleClose = vi.fn();
    const handleCopyConfirm = vi.fn();

    render(
      <CopyScoreModal
        isOpen={true}
        onClose={handleClose}
        sourceStudent={sourceStudent}
        students={mockStudents}
        studentSummaryMap={studentSummaryMap}
        apiSummariesPoints={apiSummariesPoints}
        semesterName="Học kỳ I"
        className="Lớp CNTT1"
        onCopyConfirm={handleCopyConfirm}
      />
    );

    // Chỉ có Trần Văn Đích (SV002) chọn được, chọn SV002
    const dichRow = screen.getByText("Trần Văn Đích");
    fireEvent.click(dichRow);

    expect(screen.getByText(/Đã chọn/i)).toBeDefined();
    expect(screen.getByText("1")).toBeDefined(); // Số lượng chọn là 1

    // Thử nút Chọn tất cả (lúc này chữ là "Bỏ chọn tất cả" do visible target đã được chọn hết)
    const selectAllBtn = screen.getByText("Bỏ chọn tất cả");
    fireEvent.click(selectAllBtn);

    // Vì đã bỏ chọn, số lượng chọn sẽ về 0
    expect(screen.getByText("0")).toBeDefined();
  });

  it("shows correct success banner when all targets succeed", async () => {
    const handleClose = vi.fn();
    const handleCopyConfirm = vi.fn().mockResolvedValue([
      { studentId: "SV002", studentName: "Trần Văn Đích", status: "success" }
    ]);

    render(
      <CopyScoreModal
        isOpen={true}
        onClose={handleClose}
        sourceStudent={sourceStudent}
        students={mockStudents}
        studentSummaryMap={studentSummaryMap}
        apiSummariesPoints={apiSummariesPoints}
        semesterName="Học kỳ I"
        className="Lớp CNTT1"
        onCopyConfirm={handleCopyConfirm}
      />
    );

    // Chọn target
    const dichRow = screen.getByText("Trần Văn Đích");
    fireEvent.click(dichRow);

    // Bấm copy
    const confirmBtn = screen.getByText("Xác nhận sao chép");
    fireEvent.click(confirmBtn);

    // Chờ resolve và kiểm tra banner thành công
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText("Sao chép thành công!")).toBeDefined();
    expect(screen.getByText("Thành công")).toBeDefined();
  });

  it("shows warning banner for partial success", async () => {
    const handleClose = vi.fn();
    const mockResultsPartial = [
      { studentId: "SV002", studentName: "Trần Văn Đích", status: "success" },
      { studentId: "SV005", studentName: "Lỗi Test", status: "error", message: "Bị khóa" }
    ];
    
    const handleCopyConfirmPartial = vi.fn().mockResolvedValue(mockResultsPartial);

    render(
      <CopyScoreModal
        isOpen={true}
        onClose={handleClose}
        sourceStudent={sourceStudent}
        students={mockStudents}
        studentSummaryMap={studentSummaryMap}
        apiSummariesPoints={apiSummariesPoints}
        semesterName="Học kỳ I"
        className="Lớp CNTT1"
        onCopyConfirm={handleCopyConfirmPartial}
      />
    );

    fireEvent.click(screen.getByText("Trần Văn Đích"));
    fireEvent.click(screen.getByText("Xác nhận sao chép"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText("Sao chép thành công một phần!")).toBeDefined();
    expect(screen.getByText(/Thất bại ở 1 sinh viên/i)).toBeDefined();
  });

  it("shows error banner for all failures", async () => {
    const handleClose = vi.fn();
    const handleCopyConfirmAllFailed = vi.fn().mockResolvedValue([
      { studentId: "SV002", studentName: "Trần Văn Đích", status: "error", message: "Lỗi DB" }
    ]);

    render(
      <CopyScoreModal
        isOpen={true}
        onClose={handleClose}
        sourceStudent={sourceStudent}
        students={mockStudents}
        studentSummaryMap={studentSummaryMap}
        apiSummariesPoints={apiSummariesPoints}
        semesterName="Học kỳ I"
        className="Lớp CNTT1"
        onCopyConfirm={handleCopyConfirmAllFailed}
      />
    );

    fireEvent.click(screen.getByText("Trần Văn Đích"));
    fireEvent.click(screen.getByText("Xác nhận sao chép"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText("Sao chép thất bại!")).toBeDefined();
    expect(screen.getByText(/Không thể sao chép điểm rèn luyện/i)).toBeDefined();
  });

  it("shows unexpected system error message", async () => {
    const handleClose = vi.fn();
    const handleCopyConfirmError = vi.fn().mockRejectedValue(new Error("Lỗi kết nối API"));

    render(
      <CopyScoreModal
        isOpen={true}
        onClose={handleClose}
        sourceStudent={sourceStudent}
        students={mockStudents}
        studentSummaryMap={studentSummaryMap}
        apiSummariesPoints={apiSummariesPoints}
        semesterName="Học kỳ I"
        className="Lớp CNTT1"
        onCopyConfirm={handleCopyConfirmError}
      />
    );

    fireEvent.click(screen.getByText("Trần Văn Đích"));
    fireEvent.click(screen.getByText("Xác nhận sao chép"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText("Lỗi hệ thống ngoài dự kiến")).toBeDefined();
    expect(screen.getByText("Lỗi kết nối API")).toBeDefined();
  });
});
