import { describe, expect, it } from "vitest";
import { resolveLatestSummaryState } from "./page";

describe("ProfilePage latest finalized training score state", () => {
  it("distinguishes an empty result from a request error", () => {
    expect(resolveLatestSummaryState(null, null)).toBe("empty");
    expect(resolveLatestSummaryState(null, "timeout")).toBe("error");
  });

  it("keeps locked summaries in the finalized-score state", () => {
    expect(
      resolveLatestSummaryState(
        { status: "locked", total_score: 85, semester: "HK2 - 2025 - 2026" },
        null,
      ),
    ).toBe("locked");
  });
});
