import { describe, it, expect } from "vitest";
import {
  buildSummaryIndex,
  findSummaryForStudent,
  mapRosterWithSummaries,
} from "./summary-matching";

describe("Summary Matching Utility Tests", () => {
  const mockColors = [{ bg: "bg-[#dbe3f1]", text: "text-[#141c26]" }];

  describe("buildSummaryIndex", () => {
    it("should build correct index mapping student identifiers to summaries", () => {
      const mockSummaries = [
        {
          _id: "summary-1",
          student_id: {
            _id: "db-student-id-1",
            student_code: "SV001",
            id: "id-1",
          },
          total_score: 85,
          status: "draft",
        },
        {
          _id: "summary-2",
          student_id: "db-student-id-2", // Raw string ObjectId
          total_score: 90,
          status: "locked",
        },
      ];

      const index = buildSummaryIndex(mockSummaries);

      expect(index.get("db-student-id-1")).toEqual(mockSummaries[0]);
      expect(index.get("sv001")).toEqual(mockSummaries[0]);
      expect(index.get("id-1")).toEqual(mockSummaries[0]);
      expect(index.get("db-student-id-2")).toEqual(mockSummaries[1]);
      
      // key summary._id should not exist in the index mapping
      expect(index.has("summary-1")).toBe(false);
      expect(index.has("summary-2")).toBe(false);
    });
  });

  describe("findSummaryForStudent", () => {
    it("should find summary using any valid student identifier candidate", () => {
      const mockSummaries = [
        {
          _id: "summary-1",
          student_id: {
            _id: "db-student-id-1",
            student_code: "SV001",
          },
        },
      ];
      const index = buildSummaryIndex(mockSummaries);

      const studentByCode = { student_code: "SV001" };
      const studentByDbId = { _id: "db-student-id-1" };
      const studentById = { id: "db-student-id-1" };

      expect(findSummaryForStudent(studentByCode, index)).toEqual(mockSummaries[0]);
      expect(findSummaryForStudent(studentByDbId, index)).toEqual(mockSummaries[0]);
      expect(findSummaryForStudent(studentById, index)).toEqual(mockSummaries[0]);
    });

    it("should return null if no summary matches student identifiers", () => {
      const mockSummaries = [
        {
          _id: "summary-1",
          student_id: "db-student-id-1",
        },
      ];
      const index = buildSummaryIndex(mockSummaries);

      const unknownStudent = { student_code: "SV999", _id: "unknown-id" };
      expect(findSummaryForStudent(unknownStudent, index)).toBeNull();
    });
  });

  describe("mapRosterWithSummaries", () => {
    it("should map roster students with existing summaries and handle missing summaries correctly", () => {
      const mockRoster = [
        {
          _id: "stud-id-1",
          student_code: "SV001",
          full_name: "Nguyen Van A",
          class_id: {
            _id: "class-1",
            class_name: "Lop 1A",
          },
        },
        {
          _id: "stud-id-2",
          student_code: "SV002",
          full_name: "Tran Thi B",
          class_id: "class-1",
        },
      ];

      const mockSummaries = [
        {
          _id: "sum-id-1",
          student_id: "stud-id-1",
          total_score: 85,
          status: "locked",
        },
      ];

      const mapped = mapRosterWithSummaries(mockRoster, mockSummaries, mockColors);

      expect(mapped).toHaveLength(2);

      // Student 1 has summary
      expect(mapped[0].id).toBe("SV001");
      expect(mapped[0].score).toBe(85);
      expect(mapped[0].gradingStatus).toBe("locked");
      expect(mapped[0].classId).toBe("class-1");
      expect(mapped[0].className).toBe("Lop 1A");

      // Student 2 misses summary -> should map to 'no_summary'
      expect(mapped[1].id).toBe("SV002");
      expect(mapped[1].score).toBe(0);
      expect(mapped[1].gradingStatus).toBe("no_summary");
    });

    it("should map existing summary with score 0 as draft, not no_summary", () => {
      const mockRoster = [
        {
          _id: "stud-id-1",
          student_code: "SV001",
          full_name: "Nguyen Van A",
        },
      ];

      const mockSummaries = [
        {
          _id: "sum-id-1",
          student_id: "stud-id-1",
          total_score: 0,
          status: "draft",
        },
      ];

      const mapped = mapRosterWithSummaries(mockRoster, mockSummaries, mockColors);

      expect(mapped[0].score).toBe(0);
      expect(mapped[0].gradingStatus).toBe("draft");
    });

    it("should filter out and exclude summaries with specific period_id values (semester-level rule)", () => {
      const mockRoster = [
        {
          _id: "stud-id-1",
          student_code: "SV001",
          full_name: "Nguyen Van A",
        },
      ];

      const mockSummaries = [
        {
          _id: "sum-id-1",
          student_id: "stud-id-1",
          total_score: 75,
          status: "locked",
          period_id: "period-123", // Has specific period_id -> should be ignored
        },
      ];

      const mapped = mapRosterWithSummaries(mockRoster, mockSummaries, mockColors);

      expect(mapped[0].gradingStatus).toBe("no_summary");
      expect(mapped[0].score).toBe(0);
    });
  });
});
