import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import ProtectedGradingScorePage from "./page";
import { studentApi } from "@/api/student-api";
import { summariesPointApi } from "@/api/summaries-point-api";
import { semesterApi } from "@/api/semester-api";
import { classApi } from "@/api/class-api";
import { categoryApi } from "@/api/category-api";
import { criteriaApi } from "@/api/criteria-api";
import { evaluationDetailApi } from "@/api/evaluation-detail-api";
import { evaluationPeriodApi } from "@/api/evaluation-period-api";
import { toast } from "sonner";

// --- Mocks ---



// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_, prop) => (props: any) => {
      const Tag = typeof prop === "string" ? prop : "div";
      return <Tag {...props} />;
    }
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

// Mock @tanstack/react-virtual
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: vi.fn((options) => ({
    getTotalSize: () => options.count * 250,
    getVirtualItems: () => Array.from({ length: options.count }).map((_, index) => ({
      index,
      start: index * 250,
      size: 250,
    })),
    measureElement: vi.fn(),
    scrollToIndex: vi.fn(),
  })),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }
}));

// Mock Next Navigation
let mockSearchParams = new URLSearchParams();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: vi.fn(),
  })),
  useSearchParams: vi.fn(() => ({
    get: (key: string) => mockSearchParams.get(key),
  })),
}));

vi.mock("next/dynamic", () => ({
  default: (importFunc: any) => {
    const Component = (props: any) => {
      const [LoadedComponent, setLoadedComponent] = React.useState<any>(null);
      React.useEffect(() => {
        let mounted = true;
        importFunc().then((mod: any) => {
          if (mounted) setLoadedComponent(() => mod.default);
        });
        return () => { mounted = false; };
      }, []);
      if (!LoadedComponent) return <div data-testid="loading-dynamic">Loading...</div>;
      return <LoadedComponent {...props} />;
    };
    return Component;
  }
}));

// Mock APIs
vi.mock("@/api/student-api", () => ({
  studentApi: {
    getStudents: vi.fn(),
    getMyStudent: vi.fn(),
    getStudent: vi.fn(),
    resolveStudent: vi.fn(),
  }
}));

vi.mock("@/api/summaries-point-api", () => ({
  summariesPointApi: {
    getSummariesPoints: vi.fn(),
    getGradingAccess: vi.fn(),
    getSummariesPoint: vi.fn(),
  }
}));

vi.mock("@/api/semester-api", () => ({
  semesterApi: {
    getSemesters: vi.fn(),
  }
}));

vi.mock("@/api/class-api", () => ({
  classApi: {
    getClasses: vi.fn(),
  }
}));

vi.mock("@/api/category-api", () => ({
  categoryApi: {
    getCategories: vi.fn(),
  }
}));

vi.mock("@/api/criteria-api", () => ({
  criteriaApi: {
    getCriteria: vi.fn(),
  }
}));

vi.mock("@/api/evaluation-detail-api", () => ({
  evaluationDetailApi: {
    getEvaluationDetailsBySummary: vi.fn(),
  }
}));

vi.mock("@/api/evaluation-period-api", () => ({
  evaluationPeriodApi: {
    getEvaluationPeriods: vi.fn(),
  }
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "user-teacher-1", role: "admin", email: "teacher@gmail.com" },
    isLoading: false,
  }))
}));

vi.mock("@/hooks/useGradingRealtime", () => ({
  useGradingRealtime: vi.fn(() => ({ status: 'connected' }))
}));

vi.mock("@/components/guards/RouteGuard", () => ({
  RouteGuard: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/grading/SemesterModal", () => ({
  default: () => <div data-testid="semester-modal" />
}));

vi.mock("@/components/grading/ActiveStudentRankCard", () => ({
  default: ({ activeStudent }: any) => {
    console.log("Mock activeStudent KEYS:", Object.keys(activeStudent || {}), "FULL_NAME:", activeStudent?.full_name, "NAME:", activeStudent?.name);
    return (
      <div data-testid="active-student-card">
        Active Student Card: {activeStudent?.name || activeStudent?.full_name} ({activeStudent?.id})
      </div>
    );
  }
}));

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};
Object.defineProperty(window, "sessionStorage", {
  value: {
    getItem: vi.fn((key) => mockSessionStorage[key] || null),
    setItem: vi.fn((key, value) => {
      mockSessionStorage[key] = value;
    }),
    removeItem: vi.fn((key) => {
      delete mockSessionStorage[key];
    }),
    clear: vi.fn(() => {
      Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);
    }),
  },
  writable: true,
});

describe("Grading Score Page URL Context & Initialization", () => {
  const mockSemesters = [
    { _id: "sem-1", name: "Học kỳ I 2025-2026", status: "active" },
    { _id: "sem-2", name: "Học kỳ II 2025-2026", status: "inactive" }
  ];

  const mockClasses = [
    { _id: "class-1", class_name: "CNTT K19A", advisor_id: "user-teacher-1" },
    { _id: "class-2", class_name: "CNTT K19B", advisor_id: "user-teacher-1" }
  ];

  const mockRosterClass1 = [
    { _id: "stud-1", id: "stud-1", student_code: "SV001", full_name: "Nguyễn Văn A", class_id: "class-1" },
    { _id: "stud-2", id: "stud-2", student_code: "SV002", full_name: "Trần Thị B", class_id: "class-1" }
  ];

  const mockRosterClass2 = [
    { _id: "stud-3", id: "stud-3", student_code: "SV003", full_name: "Lê Văn C", class_id: "class-2" }
  ];

  const mockSummaries = [
    { _id: "sum-1", student_id: "stud-1", semester_id: "sem-1", class_id: "class-1", status: "draft" },
    { _id: "sum-2", student_id: "stud-2", semester_id: "sem-1", class_id: "class-1", status: "draft" },
    { _id: "sum-3", student_id: "stud-3", semester_id: "sem-1", class_id: "class-2", status: "draft" }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);
    
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;

    // Setup default API returns
    vi.mocked(semesterApi.getSemesters).mockResolvedValue(mockSemesters);
    vi.mocked(classApi.getClasses).mockResolvedValue(mockClasses);
    vi.mocked(categoryApi.getCategories).mockResolvedValue([]);
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue([]);
    vi.mocked(evaluationPeriodApi.getEvaluationPeriods).mockResolvedValue([{ _id: "period-1", name: "Period 1", semester_id: "sem-1" }]);
    vi.mocked(evaluationDetailApi.getEvaluationDetailsBySummary).mockResolvedValue([]);
    vi.mocked(summariesPointApi.getGradingAccess).mockResolvedValue({
      role: 'admin',
      isAdmin: true,
      isSupervisor: false,
      isAdminOrSupervisor: true,
      isTeacher: false,
      isStudent: false,
      canReadRoster: true,
      canModifyScoreByRole: true,
      canDeleteSummaryByRole: true,
      canDeleteHistoryByRole: true,
      canManageEvaluationPeriod: true,
    } as any);
    vi.mocked(summariesPointApi.getSummariesPoint).mockResolvedValue({
      _id: 'some-summary-id',
      student_id: 'stud-1',
      semester_id: 'sem-1',
      total_score: 80,
      grading: 'Tốt',
      status: 'draft',
      details: [],
    } as any);
    
    vi.mocked(studentApi.getStudents).mockImplementation(async (params: any) => {
      if (params?.classId === "class-1") return mockRosterClass1;
      if (params?.classId === "class-2") return mockRosterClass2;
      return [];
    });

    vi.mocked(summariesPointApi.getSummariesPoints).mockImplementation(async (params: any) => {
      const filtered = mockSummaries.filter(s => {
        let match = true;
        if (params?.semesterId && s.semester_id !== params.semesterId) match = false;
        if (params?.classId && s.class_id !== params.classId) match = false;
        return match;
      });
      return { data: filtered, meta: { total: filtered.length } };
    });

    vi.mocked(studentApi.getStudent).mockImplementation(async (id: string) => {
      const allStuds = [...mockRosterClass1, ...mockRosterClass2];
      const match = allStuds.find(s => s.id === id);
      if (match) return match as any;
      throw new Error("Student not found");
    });

    vi.mocked(studentApi.resolveStudent).mockImplementation(async (identifier: string) => {
      const allStuds = [...mockRosterClass1, ...mockRosterClass2];
      const match = allStuds.find(s => s.student_code === identifier || s.id === identifier);
      if (match) return match as any;
      throw new Error("Student not found");
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads students from URL context and sets the clicked student as active", async () => {
    mockSearchParams = new URLSearchParams({
      studentId: "stud-2",
      classId: "class-1",
      semesterId: "sem-1"
    });

    render(<ProtectedGradingScorePage />);

    // Kiểm tra xem active student rank card có hiển thị đúng thông tin của Trần Thị B
    await waitFor(() => {
      expect(screen.getByTestId("active-student-card")).toBeDefined();
      expect(screen.getAllByText(/Trần Thị B/i)[0]).toBeDefined();
      expect(screen.getAllByText(/stud-2/i)[0]).toBeDefined();
    });

    // Xác nhận context đã được đồng bộ vào sessionStorage
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith("grading_appliedSem", "sem-1");
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith("grading_appliedClass", "class-1");
  });

  it("overrides stale sessionStorage values when URL context is provided", async () => {
    // Session cũ đang lưu class-2 và sem-2
    mockSessionStorage["grading_appliedSem"] = "sem-2";
    mockSessionStorage["grading_appliedClass"] = "class-2";

    mockSearchParams = new URLSearchParams({
      studentId: "stud-1",
      classId: "class-1",
      semesterId: "sem-1"
    });

    render(<ProtectedGradingScorePage />);

    // Roster CNTT K19A (class-1) chứa stud-1 sẽ được load thay vì class-2
    await waitFor(() => {
      expect(screen.getByTestId("active-student-card")).toBeDefined();
      expect(screen.getAllByText(/Nguyễn Văn A/i)[0]).toBeDefined();
    });

    // Check sessionStorage được cập nhật đè lại
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith("grading_appliedSem", "sem-1");
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith("grading_appliedClass", "class-1");
  });

  it("falls back to the first student in roster when studentId is missing in URL", async () => {
    mockSearchParams = new URLSearchParams({
      classId: "class-1",
      semesterId: "sem-1"
    });

    render(<ProtectedGradingScorePage />);

    // Không có studentId trên URL, mặc định chọn sinh viên đầu tiên của CNTT K19A (stud-1)
    await waitFor(() => {
      expect(screen.getByTestId("active-student-card")).toBeDefined();
      expect(screen.getAllByText(/Nguyễn Văn A/i)[0]).toBeDefined();
    });
  });

  it("handles unknown studentId by displaying a warning toast and falling back safely", async () => {
    mockSearchParams = new URLSearchParams({
      studentId: "stud-unknown",
      classId: "class-1",
      semesterId: "sem-1"
    });

    render(<ProtectedGradingScorePage />);

    // Fallback về sinh viên đầu tiên của class-1 (Nguyễn Văn A) và hiển thị warning toast
    await waitFor(() => {
      expect(screen.getByTestId("active-student-card")).toBeDefined();
      expect(screen.getAllByText(/Nguyễn Văn A/i)[0]).toBeDefined();
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining("Không tìm thấy sinh viên hoặc bạn không có quyền")
      );
    });
  });

  it("resolves student context when student belongs to a different class but advisor has permission", async () => {
    // URL ban đầu có classId là class-1, nhưng studentId là stud-3 (thuộc class-2)
    mockSearchParams = new URLSearchParams({
      studentId: "stud-3",
      classId: "class-1",
      semesterId: "sem-1"
    });

    render(<ProtectedGradingScorePage />);

    // Sẽ tự động resolve sang class-2 do stud-3 thuộc class-2 và advisor có quyền quản lý cả hai lớp
    await waitFor(() => {
      expect(screen.getByTestId("active-student-card")).toBeDefined();
      expect(screen.getAllByText(/Lê Văn C/i)[0]).toBeDefined();
      expect(screen.getAllByText(/stud-3/i)[0]).toBeDefined();
    });

    // Check classId được lưu đè lại sang class-2
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith("grading_appliedClass", "class-2");
  });

  it("resolves legacy student code to correct student ObjectId and activates it", async () => {
    // SV002 là student_code của stud-2 (Trần Thị B)
    mockSearchParams = new URLSearchParams({
      studentId: "SV002",
      classId: "class-1",
      semesterId: "sem-1"
    });

    render(<ProtectedGradingScorePage />);

    await waitFor(() => expect(studentApi.resolveStudent).toHaveBeenCalledWith("SV002"));
    expect(studentApi.getStudent).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("active-student-card")).toBeDefined());
    try {
      await waitFor(() => expect(screen.getAllByText(/Trần Thị B/i)[0]).toBeDefined());
    } catch (e) {
      console.log("DOM content:", screen.getByTestId("active-student-card").innerHTML);
      throw e;
    }
    await waitFor(() => expect(screen.getAllByText(/stud-2/i)[0]).toBeDefined());
  });

  it("does not call getStudent with non-ObjectId values", async () => {
    mockSearchParams = new URLSearchParams({
      studentId: "SV001",
      classId: "class-1",
      semesterId: "sem-1"
    });

    render(<ProtectedGradingScorePage />);

    await waitFor(() => {
      expect(studentApi.resolveStudent).toHaveBeenCalledWith("SV001");
      expect(studentApi.getStudent).not.toHaveBeenCalled();
    });
  });
});

describe("Score Attribution Badges Rendering", () => {
  const mockCategories = [
    { _id: "cat-1", category_code: "CAT1", category_name: "Danh mục 1", max_score: 20, sort_order: 1 }
  ];

  const mockCriteria = [
    {
      _id: "cri-1",
      criterion_name: "Tiêu chí 1",
      category_id: "cat-1",
      score_per_unit: 2,
      criterion_type: "reward",
      max_score: 10,
      min_score: 0,
      is_locked: false,
      scoring_mode: "count",
      options: []
    }
  ];

  const mockSemesters = [
    { _id: "sem-1", name: "Học kỳ I 2025-2026", status: "active" }
  ];

  const mockClasses = [
    { _id: "class-1", class_name: "CNTT K19A", advisor_id: "user-teacher-1" }
  ];

  const mockRoster = [
    { _id: "stud-1", id: "stud-1", student_code: "SV001", full_name: "Nguyễn Văn A", class_id: "class-1" }
  ];

  const mockSummaries = [
    { _id: "sum-1", student_id: "stud-1", semester_id: "sem-1", class_id: "class-1", status: "draft" }
  ];

  let mockSearchParams = new URLSearchParams();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams({
      studentId: "stud-1",
      classId: "class-1",
      semesterId: "sem-1"
    });
    
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;

    vi.mocked(semesterApi.getSemesters).mockResolvedValue(mockSemesters);
    vi.mocked(classApi.getClasses).mockResolvedValue(mockClasses);
    vi.mocked(categoryApi.getCategories).mockResolvedValue(mockCategories);
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue(mockCriteria);
    vi.mocked(evaluationPeriodApi.getEvaluationPeriods).mockResolvedValue([]);
    vi.mocked(studentApi.getStudents).mockResolvedValue(mockRoster);
    vi.mocked(studentApi.getStudent).mockResolvedValue(mockRoster[0] as any);
    vi.mocked(summariesPointApi.getSummariesPoints).mockResolvedValue({ data: mockSummaries, meta: { total: 1 } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders SV, GV badges and hides P.HSSV for non-locked criteria", async () => {
    const mockDetails = [
      {
        _id: "det-1",
        criterion_id: "cri-1",
        sv_score: 6,
        gv_score: 8,
        final_score: 10,
        status: "draft"
      }
    ];
    vi.mocked(evaluationDetailApi.getEvaluationDetailsBySummary).mockResolvedValue(mockDetails);

    render(<ProtectedGradingScorePage />);

    // Chờ cho đến khi danh mục & tiêu chí hiển thị
    await waitFor(() => {
      expect(screen.getByText("Tiêu chí 1")).toBeDefined();
    });

    // Xác nhận badge SV, GV hiển thị đúng điểm số của chúng
    expect(screen.getByText("SV:")).toBeDefined();
    expect(screen.getAllByText("+6đ")[0]).toBeDefined(); // detail?.sv_score

    expect(screen.getByText("GV:")).toBeDefined();
    expect(screen.getAllByText("+8đ")[0]).toBeDefined(); // detail?.gv_score

    // Do is_locked là false, badge P.HSSV: không được hiển thị
    expect(screen.queryByText("P.HSSV:")).toBeNull();

    // Do status là 'draft' (chưa locked/approved), badge 'Đạt:' không được hiển thị
    expect(screen.queryByText("Đạt:")).toBeNull();
  });

  it("renders only P.HSSV badge and hides SV, GV badges for locked criteria", async () => {
    const lockedCriteria = [
      {
        ...mockCriteria[0],
        is_locked: true
      }
    ];
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue(lockedCriteria);

    const mockDetails = [
      {
        _id: "det-1",
        criterion_id: "cri-1",
        sv_score: 6,
        gv_score: 8,
        final_score: 10,
        status: "draft"
      }
    ];
    vi.mocked(evaluationDetailApi.getEvaluationDetailsBySummary).mockResolvedValue(mockDetails);

    render(<ProtectedGradingScorePage />);

    await waitFor(() => {
      expect(screen.getByText("Tiêu chí 1")).toBeDefined();
    });

    // Xác nhận badge P.HSSV hiển thị
    expect(screen.getByText("P.HSSV:")).toBeDefined();
    expect(screen.getAllByText("+10đ")[0]).toBeDefined(); // detail?.final_score

    // Xác nhận badge SV và GV bị ẩn
    expect(screen.queryByText("SV:")).toBeNull();
    expect(screen.queryByText("GV:")).toBeNull();

    // Do status là 'draft', badge 'Đạt:' không được hiển thị
    expect(screen.queryByText("Đạt:")).toBeNull();
  });

  it("renders only P.HSSV and Đạt badges for locked and approved criteria", async () => {
    const lockedCriteria = [
      {
        ...mockCriteria[0],
        is_locked: true
      }
    ];
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue(lockedCriteria);

    const mockDetails = [
      {
        _id: "det-1",
        criterion_id: "cri-1",
        sv_score: 6,
        gv_score: 8,
        final_score: 10,
        status: "locked" // approved/locked
      }
    ];
    vi.mocked(evaluationDetailApi.getEvaluationDetailsBySummary).mockResolvedValue(mockDetails);

    render(<ProtectedGradingScorePage />);

    await waitFor(() => {
      expect(screen.getByText("Tiêu chí 1")).toBeDefined();
    });

    // Chỉ badge P.HSSV và Đạt hiển thị
    expect(screen.getByText("P.HSSV:")).toBeDefined();
    expect(screen.getByText("Đạt:")).toBeDefined();

    // SV và GV bị ẩn
    expect(screen.queryByText("SV:")).toBeNull();
    expect(screen.queryByText("GV:")).toBeNull();
  });

  it("renders empty-state 'Chưa chấm' label for P.HSSV when scores are null on locked criteria", async () => {
    const lockedCriteria = [
      {
        ...mockCriteria[0],
        is_locked: true
      }
    ];
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue(lockedCriteria);

    const mockDetails = [
      {
        _id: "det-1",
        criterion_id: "cri-1",
        sv_score: null,
        gv_score: null,
        final_score: null,
        status: "draft"
      }
    ];
    vi.mocked(evaluationDetailApi.getEvaluationDetailsBySummary).mockResolvedValue(mockDetails);

    render(<ProtectedGradingScorePage />);

    await waitFor(() => {
      expect(screen.getByText("Tiêu chí 1")).toBeDefined();
    });

    // Xác nhận badge P.HSSV vẫn hiển thị
    expect(screen.getByText("P.HSSV:")).toBeDefined();
    
    // final_score null nên P.HSSV sẽ hiện "Chưa chấm". SV và GV bị ẩn vì criteria is_locked.
    const unsubmittedLabels = screen.getAllByText("Chưa chấm");
    expect(unsubmittedLabels.length).toBeGreaterThanOrEqual(1);

    expect(screen.queryByText("SV:")).toBeNull();
    expect(screen.queryByText("GV:")).toBeNull();
  });
});
