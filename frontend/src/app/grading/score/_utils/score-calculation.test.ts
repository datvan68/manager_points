import { describe, it, expect } from "vitest";
import {
  calculateCriterionScore,
  getCriterionContributionScore,
  getResolvedRawCriterionScore,
  getResolvedCriterionScore,
  calculateCategoryScore,
  calculateTotalScore,
  Criteria,
  Category
} from "./score-calculation";

describe("score-calculation helper", () => {
  describe("calculateCriterionScore & getCriterionContributionScore", () => {
    it("1. Reward/cong diem", () => {
      const criterion: Criteria = {
        id: "cri-1",
        name: "Tham gia phong trao",
        maxScore: 10,
        minScore: 0,
        pointsPerUnit: 2,
        type: "reward"
      };

      expect(calculateCriterionScore(criterion, 3)).toBe(6);
      expect(getCriterionContributionScore(criterion, 3)).toBe(6);

      expect(calculateCriterionScore(criterion, 10)).toBe(10);
      expect(getCriterionContributionScore(criterion, 10)).toBe(10);
    });

    it("2. Violation co tinh diem", () => {
      const criterion: Criteria = {
        id: "cri-2",
        name: "Vi pham ky luat",
        maxScore: 10,
        minScore: 0,
        pointsPerUnit: -2,
        type: "violation",
        is_score_counted: true
      };

      expect(calculateCriterionScore(criterion, 0)).toBe(10);
      expect(getCriterionContributionScore(criterion, 0)).toBe(10);

      expect(calculateCriterionScore(criterion, 1)).toBe(8);
      expect(getCriterionContributionScore(criterion, 1)).toBe(8);

      expect(calculateCriterionScore(criterion, 6)).toBe(0);
      expect(getCriterionContributionScore(criterion, 6)).toBe(0);
    });

    it("2.1. Violation maxScore=10, pointsPerUnit=-1, count=3 => raw=7", () => {
      const criterion: Criteria = {
        id: "cri-2-1",
        name: "Vi pham nho",
        maxScore: 10,
        minScore: 0,
        pointsPerUnit: -1,
        type: "violation",
        is_score_counted: true
      };

      expect(calculateCriterionScore(criterion, 3)).toBe(7);
      expect(getCriterionContributionScore(criterion, 3)).toBe(7);
    });

    it("3. Violation khong tinh diem (is_score_counted === false)", () => {
      const criterion: Criteria = {
        id: "cri-3",
        name: "Tru diem thang",
        maxScore: 10,
        minScore: 0,
        pointsPerUnit: -2,
        type: "violation",
        is_score_counted: false
      };

      // count 0 -> rawScore is 10, contribution 0
      expect(calculateCriterionScore(criterion, 0)).toBe(10);
      expect(getCriterionContributionScore(criterion, 0)).toBe(0);

      // count 1 -> rawScore is 8, contribution -2
      expect(calculateCriterionScore(criterion, 1)).toBe(8);
      expect(getCriterionContributionScore(criterion, 1)).toBe(-2);

      // count 6 -> rawScore is 0, contribution -10
      expect(calculateCriterionScore(criterion, 6)).toBe(0);
      expect(getCriterionContributionScore(criterion, 6)).toBe(-10);
    });

    it("4. Single option", () => {
      const criterion: Criteria = {
        id: "cri-4",
        name: "Chon muc",
        maxScore: 10,
        minScore: 0,
        pointsPerUnit: 0,
        type: "reward",
        scoring_mode: "single_option",
        options: [
          { id: "opt-1", label: "Muc 1", score: 8 },
          { id: "opt-2", label: "Muc 2", score: 15 }
        ]
      };

      expect(calculateCriterionScore(criterion, 1, "opt-1")).toBe(8);
      expect(calculateCriterionScore(criterion, 1, "opt-2")).toBe(10); // clamped max 10

      const violationCriterion: Criteria = {
        id: "cri-5",
        name: "Violation non-counted single option",
        maxScore: 10,
        minScore: 0,
        pointsPerUnit: 0,
        type: "violation",
        is_score_counted: false,
        scoring_mode: "single_option",
        options: [
          { id: "opt-3", label: "Muc vi pham 3 diem", score: 7 }
        ]
      };

      // khong chon option -> rawScore maxScore (10), contribution 0
      expect(calculateCriterionScore(violationCriterion, 1, null)).toBe(10);
      expect(getCriterionContributionScore(violationCriterion, 1, null)).toBe(0);

      // chon option score=7 -> rawScore 7, contribution 7 - 10 = -3
      expect(calculateCriterionScore(violationCriterion, 1, "opt-3")).toBe(7);
      expect(getCriterionContributionScore(violationCriterion, 1, "opt-3")).toBe(-3);
    });
  });

  describe("getResolvedCriterionScore & getResolvedRawCriterionScore", () => {
    const criterion: Criteria = {
      id: "cri-1",
      name: "Tham gia phong trao",
      maxScore: 10,
      minScore: 0,
      pointsPerUnit: 2,
      type: "reward"
    };

    it("should fallback to calculated score if detail is undefined", () => {
      expect(getResolvedRawCriterionScore(criterion, 3)).toBe(6);
      expect(getResolvedCriterionScore(criterion, 3)).toBe(6);
    });

    it("should prioritize final_score over everything else", () => {
      const detail = { final_score: 9, gv_score: 8, sv_score: 7, system_score: 6 };
      expect(getResolvedRawCriterionScore(criterion, 3, null, detail)).toBe(9);
      expect(getResolvedCriterionScore(criterion, 3, null, detail)).toBe(9);
    });

    it("should fallback to gv_score if final_score is missing", () => {
      const detail = { gv_score: 8, sv_score: 7, system_score: 6 };
      expect(getResolvedRawCriterionScore(criterion, 3, null, detail)).toBe(8);
      expect(getResolvedCriterionScore(criterion, 3, null, detail)).toBe(8);
    });

    it("should fallback to sv_score if gv_score is missing", () => {
      const detail = { sv_score: 7, system_score: 6 };
      expect(getResolvedRawCriterionScore(criterion, 3, null, detail)).toBe(7);
      expect(getResolvedCriterionScore(criterion, 3, null, detail)).toBe(7);
    });

    it("should fallback to system_score if sv_score is missing", () => {
      const detail = { system_score: 6 };
      expect(getResolvedRawCriterionScore(criterion, 3, null, detail)).toBe(6);
      expect(getResolvedCriterionScore(criterion, 3, null, detail)).toBe(6);
    });

    it("should process is_score_counted correctly when detail is provided", () => {
      const vioCriterion: Criteria = {
        id: "cri-vio",
        name: "Violation",
        maxScore: 10,
        minScore: 0,
        pointsPerUnit: -2,
        type: "violation",
        is_score_counted: false
      };

      const detail = { final_score: 8 }; // raw score is 8
      // For non-counted violation, contribution is raw - maxScore = 8 - 10 = -2
      expect(getResolvedCriterionScore(vioCriterion, 3, null, detail)).toBe(-2);
    });

    it("Locked detail có final_score=7 => hiển thị 7, contribution = -3 nếu is_score_counted=false, = 7 nếu true", () => {
      const criterionNonCounted: Criteria = {
        id: "cri-vio-nc",
        name: "Violation NC",
        maxScore: 10,
        minScore: 0,
        pointsPerUnit: -1,
        type: "violation",
        is_score_counted: false
      };
      const criterionCounted: Criteria = {
        id: "cri-vio-c",
        name: "Violation C",
        maxScore: 10,
        minScore: 0,
        pointsPerUnit: -1,
        type: "violation",
        is_score_counted: true
      };

      const detail = { final_score: 7 };
      // Hiển thị (raw score)
      expect(getResolvedRawCriterionScore(criterionNonCounted, 3, null, detail)).toBe(7);
      expect(getResolvedRawCriterionScore(criterionCounted, 3, null, detail)).toBe(7);

      // Contribution
      expect(getResolvedCriterionScore(criterionNonCounted, 3, null, detail)).toBe(-3); // 7 - 10
      expect(getResolvedCriterionScore(criterionCounted, 3, null, detail)).toBe(7);
    });

    it("Locked detail cũ có final_score=-3 => normalize hiển thị thành 7, không hiện -3", () => {
      const criterion: Criteria = {
        id: "cri-vio-old",
        name: "Violation Old",
        maxScore: 10,
        minScore: 0,
        pointsPerUnit: -1,
        type: "violation",
        is_score_counted: true
      };

      const detail = { final_score: -3 };

      // raw score normalized = 10 - |-3| = 7
      expect(getResolvedRawCriterionScore(criterion, 3, null, detail)).toBe(7);
      expect(getResolvedCriterionScore(criterion, 3, null, detail)).toBe(7);
    });
  });

  describe("calculateCategoryScore", () => {
    it("5. Category clamp", () => {
      const category: Category = {
        id: "cat-1",
        title: "Danh muc 1",
        maxPoints: 20,
        items: [
          { id: "c1", name: "C1", pointsPerUnit: 10, maxScore: 15, type: "reward" },
          { id: "c2", name: "C2", pointsPerUnit: 10, maxScore: 15, type: "reward" },
          { id: "c3", name: "C3", pointsPerUnit: -5, maxScore: 10, type: "violation", is_score_counted: false }
        ]
      };

      const counts = { "c1": 2, "c2": 1, "c3": 0 };
      // c1: raw 15 (max 15), contrib 15
      // c2: raw 10, contrib 10
      // c3: contrib 0
      // sum = 25 -> clamp category to 20
      expect(calculateCategoryScore(category, counts, {})).toBe(20);

      const counts2 = { "c1": 0, "c2": 0, "c3": 6 };
      // c3 contrib = raw(0) - max(10) = -10
      // sum = -10 -> clamp to 0
      expect(calculateCategoryScore(category, counts2, {})).toBe(0);
    });

    it("7. Use detailsMap for category score calculation when provided", () => {
      const category: Category = {
        id: "cat-1",
        title: "Danh muc 1",
        maxPoints: 20,
        items: [
          { id: "c1", name: "C1", pointsPerUnit: 10, maxScore: 15, type: "reward" },
          { id: "c2", name: "C2", pointsPerUnit: 10, maxScore: 15, type: "reward" }
        ]
      };

      const counts = { "c1": 0, "c2": 0 }; // count 0 -> raw score 0
      const detailsMap = {
        "c1": { final_score: 10 },
        "c2": { sv_score: 8 }
      };
      // c1: final = 10
      // c2: sv = 8
      // sum = 18
      expect(calculateCategoryScore(category, counts, {}, detailsMap)).toBe(18);
    });
  });

  describe("calculateTotalScore", () => {
    it("6. Total clamp", () => {
      const categories: Category[] = [
        {
          id: "cat-1",
          title: "Cat 1",
          maxPoints: 60,
          items: [{ id: "c1", name: "C1", pointsPerUnit: 60, maxScore: 60, type: "reward" }]
        },
        {
          id: "cat-2",
          title: "Cat 2",
          maxPoints: 60,
          items: [{ id: "c2", name: "C2", pointsPerUnit: 60, maxScore: 60, type: "reward" }]
        }
      ];

      const counts = { "c1": 1, "c2": 1 };
      // cat1 = 60, cat2 = 60 -> total 120 -> clamp to 100
      expect(calculateTotalScore(categories, counts, {})).toBe(100);

      const counts2 = { "c1": 0, "c2": 0 };
      expect(calculateTotalScore(categories, counts2, {})).toBe(0);
    });

    it("8. Total score calculation correctly incorporates detailsMap", () => {
      const categories: Category[] = [
        {
          id: "cat-1",
          title: "Cat 1",
          maxPoints: 60,
          items: [{ id: "c1", name: "C1", pointsPerUnit: 60, maxScore: 60, type: "reward" }]
        }
      ];

      const counts = { "c1": 0 };
      const detailsMap = { "c1": { final_score: 45 } };

      expect(calculateTotalScore(categories, counts, {}, detailsMap)).toBe(45);
    });
  });
});
