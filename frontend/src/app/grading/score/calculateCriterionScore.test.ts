import { describe, it, expect } from "vitest";
import { calculateCriterionScore } from "./page";

describe("calculateCriterionScore", () => {
  it("should calculate correct score for positive pointsPerUnit", () => {
    const criterion = {
      id: "cri-1",
      name: "Tham gia phong trao",
      maxScore: 10,
      minScore: 0,
      pointsPerUnit: 2,
    };
    
    // count = 0 -> score = 0
    expect(calculateCriterionScore(criterion as any, 0)).toBe(0);
    
    // count = 3 -> score = 6
    expect(calculateCriterionScore(criterion as any, 3)).toBe(6);
    
    // count = 10 -> score = 10 (capped at maxScore)
    expect(calculateCriterionScore(criterion as any, 10)).toBe(10);
  });

  it("should calculate correct score for discipline (negative pointsPerUnit)", () => {
    const criterion = {
      id: "cri-2",
      name: "Vi pham ky luat",
      maxScore: 10,
      minScore: 0,
      pointsPerUnit: -2,
    };
    
    // count = 0 -> score = 10
    expect(calculateCriterionScore(criterion as any, 0)).toBe(10);
    
    // count = 1 -> score = 10 - 2 = 8
    expect(calculateCriterionScore(criterion as any, 1)).toBe(8);
    
    // count = 6 -> score = 0 (capped at minScore)
    expect(calculateCriterionScore(criterion as any, 6)).toBe(0);
  });

  it("should use default maxScore = 10 and minScore = 0 if not provided", () => {
    const criterion = {
      id: "cri-3",
      name: "Default scores",
      pointsPerUnit: -5,
    };
    
    // maxScore is 10, count = 1 -> score = 10 - 5 = 5
    expect(calculateCriterionScore(criterion as any, 1)).toBe(5);
  });
});
