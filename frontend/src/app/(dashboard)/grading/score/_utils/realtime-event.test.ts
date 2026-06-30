import { describe, it, expect } from "vitest";
import { mergeRealtimeEvent } from "./realtime-event";

describe("realtime-event merge utility", () => {
  it("should handle active-student realtime event with no existing count/option map by creating them", () => {
    const event = {
      studentId: "student-1",
      criterionId: "cri-1",
      updatedDetail: {
        criterion_id: "cri-1",
        current_count: 3,
        status: "draft"
      }
    };

    const currentCounts = {};
    const currentOptions = {};
    const currentDetailsMap = {};

    const result = mergeRealtimeEvent({
      event,
      currentCounts,
      currentOptions,
      currentDetailsMap,
      activeStudentId: "student-1"
    });

    expect(result.nextCountsByStudent["student-1"]).toBeDefined();
    expect(result.nextCountsByStudent["student-1"]["cri-1"]).toBe(3);
    expect(result.nextOptionsByStudent["student-1"]).toBeDefined();
    expect(result.nextDetailsMap["cri-1"]).toBeDefined();
    expect(result.nextDetailsMap["cri-1"].current_count).toBe(3);
  });

  it("should update count, selected option, and details map from one snapshot", () => {
    const event = {
      studentId: "student-1",
      criterionId: "cri-1",
      updatedDetail: {
        criterion_id: "cri-1",
        current_count: 5,
        selected_option_id: "opt-1",
        status: "draft"
      }
    };

    const currentCounts = {
      "student-1": { "cri-1": 1 }
    };
    const currentOptions = {
      "student-1": { "cri-1": null }
    };
    const currentDetailsMap = {};

    const result = mergeRealtimeEvent({
      event,
      currentCounts,
      currentOptions,
      currentDetailsMap,
      activeStudentId: "student-1"
    });

    expect(result.normalizedCounts["cri-1"]).toBe(5);
    expect(result.normalizedOptions["cri-1"]).toBe("opt-1");
    expect(result.nextDetailsMap["cri-1"]).toEqual(event.updatedDetail);
  });

  it("should preserve existing option state when selected_option_id is absent from detail", () => {
    const event = {
      studentId: "student-1",
      criterionId: "cri-1",
      updatedDetail: {
        criterion_id: "cri-1",
        current_count: 2
        // selected_option_id is absent
      }
    };

    const currentCounts = {
      "student-1": { "cri-1": 1 }
    };
    const currentOptions = {
      "student-1": { "cri-1": "opt-existing" }
    };
    const currentDetailsMap = {};

    const result = mergeRealtimeEvent({
      event,
      currentCounts,
      currentOptions,
      currentDetailsMap,
      activeStudentId: "student-1"
    });

    expect(result.normalizedOptions["cri-1"]).toBe("opt-existing");
  });

  it("should remove option selection when selected_option_id is explicitly cleared (null or empty)", () => {
    const event = {
      studentId: "student-1",
      criterionId: "cri-1",
      updatedDetail: {
        criterion_id: "cri-1",
        current_count: 0,
        selected_option_id: null
      }
    };

    const currentCounts = {
      "student-1": { "cri-1": 1 }
    };
    const currentOptions = {
      "student-1": { "cri-1": "opt-existing" }
    };
    const currentDetailsMap = {};

    const result = mergeRealtimeEvent({
      event,
      currentCounts,
      currentOptions,
      currentDetailsMap,
      activeStudentId: "student-1"
    });

    expect(result.normalizedOptions["cri-1"]).toBeUndefined();
  });

  it("should normalize invalid count values to existing count or 0", () => {
    const event = {
      studentId: "student-1",
      criterionId: "cri-1",
      updatedDetail: {
        criterion_id: "cri-1",
        current_count: "invalid-count"
      }
    };

    const currentCounts = {
      "student-1": { "cri-1": 4 }
    };
    const currentOptions = {};
    const currentDetailsMap = {};

    const result = mergeRealtimeEvent({
      event,
      currentCounts,
      currentOptions,
      currentDetailsMap,
      activeStudentId: "student-1"
    });

    expect(result.normalizedCounts["cri-1"]).toBe(4);
  });

  it("should derive criterion IDs per detail from updatedDetails with multiple criteria", () => {
    const event = {
      studentId: "student-1",
      updatedDetails: [
        { criterion_id: "cri-1", current_count: 3 },
        { criterion_id: { _id: "cri-2" }, current_count: 4 }
      ]
    };
    const result = mergeRealtimeEvent({
      event,
      currentCounts: {},
      currentOptions: {},
      currentDetailsMap: {},
      activeStudentId: "student-1"
    });
    expect(result.normalizedCounts["cri-1"]).toBe(3);
    expect(result.normalizedCounts["cri-2"]).toBe(4);
    expect(result.nextDetailsMap["cri-1"]).toBeDefined();
    expect(result.nextDetailsMap["cri-2"]).toBeDefined();
  });

  it("should use event-level criterionId only as fallback for single detail event", () => {
    // Case 1: Single detail without criterion_id, fallback to event-level criterionId
    const eventSingle = {
      studentId: "student-1",
      criterionId: "cri-fallback",
      updatedDetail: { current_count: 5 }
    };
    const resultSingle = mergeRealtimeEvent({
      event: eventSingle,
      currentCounts: {},
      currentOptions: {},
      currentDetailsMap: {},
      activeStudentId: "student-1"
    });
    expect(resultSingle.normalizedCounts["cri-fallback"]).toBe(5);

    // Case 2: Multiple details without detail-level criterion_id should not fallback to event-level criterionId
    const eventMultiple = {
      studentId: "student-1",
      criterionId: "cri-fallback",
      updatedDetails: [
        { current_count: 2 },
        { current_count: 3 }
      ]
    };
    const resultMultiple = mergeRealtimeEvent({
      event: eventMultiple,
      currentCounts: {},
      currentOptions: {},
      currentDetailsMap: {},
      activeStudentId: "student-1"
    });
    expect(resultMultiple.normalizedCounts["cri-fallback"]).toBeUndefined();
  });

  it("should clear local count when current_count is explicitly 0 or clear event occurs", () => {
    const event = {
      studentId: "student-1",
      type: "clear",
      updatedDetail: {
        criterion_id: "cri-1",
        current_count: null
      }
    };
    const result = mergeRealtimeEvent({
      event,
      currentCounts: {
        "student-1": { "cri-1": 4 }
      },
      currentOptions: {},
      currentDetailsMap: {},
      activeStudentId: "student-1"
    });
    expect(result.normalizedCounts["cri-1"]).toBe(0);
  });

  it("should prune stale criteria not in snapshot except those locked/reviewed/approved/finalized", () => {
    const event = {
      studentId: "student-1",
      isSnapshot: true,
      updatedDetails: [
        { criterion_id: "cri-active", current_count: 2 }
      ]
    };

    const currentCounts = {
      "student-1": {
        "cri-active": 1,
        "cri-stale-draft": 3,
        "cri-stale-locked": 5,
        "cri-stale-reviewed": 7
      }
    };
    const currentOptions = {
      "student-1": {
        "cri-active": null,
        "cri-stale-draft": "opt-1",
        "cri-stale-locked": "opt-2",
        "cri-stale-reviewed": "opt-3"
      }
    };
    const currentDetailsMap = {
      "cri-stale-draft": { status: "draft", current_count: 3 },
      "cri-stale-locked": { status: "locked", current_count: 5 },
      "cri-stale-reviewed": { status: "gv_reviewed", current_count: 7, gv_reviewed_by: "gv-1" }
    };

    const result = mergeRealtimeEvent({
      event,
      currentCounts,
      currentOptions,
      currentDetailsMap,
      activeStudentId: "student-1"
    });

    // Active criterion updated
    expect(result.normalizedCounts["cri-active"]).toBe(2);

    // Stale draft pruned
    expect(result.normalizedCounts["cri-stale-draft"]).toBe(0);
    expect(result.normalizedOptions["cri-stale-draft"]).toBeUndefined();
    expect(result.nextDetailsMap["cri-stale-draft"]).toBeUndefined();

    // Stale locked/reviewed preserved
    expect(result.normalizedCounts["cri-stale-locked"]).toBe(5);
    expect(result.normalizedOptions["cri-stale-locked"]).toBe("opt-2");
    expect(result.nextDetailsMap["cri-stale-locked"]).toBeDefined();

    expect(result.normalizedCounts["cri-stale-reviewed"]).toBe(7);
    expect(result.normalizedOptions["cri-stale-reviewed"]).toBe("opt-3");
    expect(result.nextDetailsMap["cri-stale-reviewed"]).toBeDefined();
  });

  it("should set affected counts to 0 for deletion/no-record event declaring criterionIds but no details", () => {
    const event = {
      studentId: "student-1",
      type: "delete",
      criterionIds: ["cri-deleted-1", "cri-deleted-2"]
    };

    const currentCounts = {
      "student-1": {
        "cri-deleted-1": 4,
        "cri-deleted-2": 5,
        "cri-preserved": 6
      }
    };
    const currentOptions = {
      "student-1": {
        "cri-deleted-1": "opt-1",
        "cri-deleted-2": "opt-2",
        "cri-preserved": "opt-3"
      }
    };
    const currentDetailsMap = {
      "cri-deleted-1": { status: "draft" },
      "cri-deleted-2": { status: "draft" },
      "cri-preserved": { status: "draft" }
    };

    const result = mergeRealtimeEvent({
      event,
      currentCounts,
      currentOptions,
      currentDetailsMap,
      activeStudentId: "student-1"
    });

    expect(result.normalizedCounts["cri-deleted-1"]).toBe(0);
    expect(result.normalizedOptions["cri-deleted-1"]).toBeUndefined();
    expect(result.nextDetailsMap["cri-deleted-1"]).toBeUndefined();

    expect(result.normalizedCounts["cri-deleted-2"]).toBe(0);
    expect(result.normalizedOptions["cri-deleted-2"]).toBeUndefined();
    expect(result.nextDetailsMap["cri-deleted-2"]).toBeUndefined();

    expect(result.normalizedCounts["cri-preserved"]).toBe(6);
    expect(result.normalizedOptions["cri-preserved"]).toBe("opt-3");
    expect(result.nextDetailsMap["cri-preserved"]).toBeDefined();
  });

  it("should safely handle unknown student or stale context event without throwing", () => {
    const event = {
      studentId: undefined,
      type: "academic_record_changed"
    };

    expect(() => mergeRealtimeEvent({
      event,
      currentCounts: {},
      currentOptions: {},
      currentDetailsMap: {},
      activeStudentId: "student-1"
    })).not.toThrow();

    const eventStale = {
      studentId: "student-2",
      type: "academic_record_changed",
      updatedDetail: { criterion_id: "cri-1", current_count: 5 }
    };

    const result = mergeRealtimeEvent({
      event: eventStale,
      currentCounts: {},
      currentOptions: {},
      currentDetailsMap: {},
      activeStudentId: "student-1"
    });
    expect(result.nextCountsByStudent["student-2"]["cri-1"]).toBe(5);
    expect(result.nextDetailsMap["cri-1"]).toBeUndefined();
  });
});
