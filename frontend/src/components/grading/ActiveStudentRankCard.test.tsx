import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import ActiveStudentRankCard, { StudentData } from "./ActiveStudentRankCard";

afterEach(() => {
  cleanup();
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

// Mock lucide-react to avoid icon render issues if any
vi.mock("lucide-react", () => {
  return {
    Check: () => <span>Check</span>,
    Award: () => <span>Award</span>,
    Diamond: () => <span>Diamond</span>,
  };
});

describe("ActiveStudentRankCard Component", () => {
  const mockStudentWithCode: StudentData = {
    id: "6a34de61ab48320e8208220a",
    studentCode: "20216001",
    name: "Bui Dang Hao",
    email: "hao@gmail.com",
    dob: "2002-01-01",
    gender: "Nam",
    score: 85,
    status: "active",
    gradingStatus: "draft",
    classId: "C01",
    className: "Class 1",
  };

  const mockStudentWithoutCode: StudentData = {
    id: "6a34de61ab48320e8208220b",
    name: "Tran Van A",
    email: "a@gmail.com",
    dob: "2002-02-02",
    gender: "Nam",
    score: 95,
    status: "active",
    gradingStatus: "locked",
    classId: "C01",
    className: "Class 1",
  };

  it("renders studentCode as MSSV when studentCode is provided", () => {
    render(<ActiveStudentRankCard activeStudent={mockStudentWithCode} />);
    
    // MSSV should display the studentCode
    expect(screen.getByText("20216001")).toBeDefined();
    
    // MSSV should NOT display the MongoDB ObjectId
    expect(screen.queryByText("6a34de61ab48320e8208220a")).toBeNull();
  });

  it("falls back to id as MSSV when studentCode is not provided", () => {
    render(<ActiveStudentRankCard activeStudent={mockStudentWithoutCode} />);
    
    // MSSV should fall back to the MongoDB ObjectId
    expect(screen.getByText("6a34de61ab48320e8208220b")).toBeDefined();
  });
});
