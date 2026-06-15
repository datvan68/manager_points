import { describe, it, expect } from "vitest";
import { normalizeNotification, normalizeNotifications } from "./normalize-notifications";

describe("normalizeNotification", () => {
  it("should normalize fully populated raw notification correctly", () => {
    const rawData = {
      id: "notif-1",
      title: "New Update",
      description: "A new software update is available.",
      type: "info",
      targetRole: "student",
      isRead: true,
      createdAt: "2026-06-15T00:00:00Z",
      readByUserIds: ["user-1", "user-2"],
      routeUrl: "/dashboard/updates",
    };

    const result = normalizeNotification(rawData);

    expect(result).toEqual({
      id: "notif-1",
      title: "New Update",
      description: "A new software update is available.",
      type: "info",
      targetRole: "student",
      isRead: true,
      createdAt: "2026-06-15T00:00:00Z",
      readByUserIds: ["user-1", "user-2"],
      routeUrl: "/dashboard/updates",
    });
  });

  it("should fall back to defaults when raw data has missing fields", () => {
    const rawData = {
      title: "Short Title",
    };

    const result = normalizeNotification(rawData);

    expect(result).toEqual({
      id: "",
      title: "Short Title",
      description: "",
      type: "system",
      targetRole: null,
      isRead: false,
      createdAt: "",
      readByUserIds: [],
      routeUrl: "",
    });
  });

  it("should fallback to _id when id is not defined", () => {
    const rawData = {
      _id: "mongo-id-123",
      title: "Database Alert",
    };

    const result = normalizeNotification(rawData);
    expect(result.id).toBe("mongo-id-123");
  });

  it("should handle invalid type and targetRole inputs by reverting to default", () => {
    const rawData = {
      id: "notif-2",
      type: "invalid-type",
      targetRole: "invalid-role",
    };

    const result = normalizeNotification(rawData);
    expect(result.type).toBe("system");
    expect(result.targetRole).toBeNull();
  });

  it("should handle null, undefined, or non-object rawData", () => {
    const defaultNotification = {
      id: "",
      title: "",
      description: "",
      type: "system",
      targetRole: null,
      isRead: false,
      createdAt: "",
      readByUserIds: [],
      routeUrl: "",
    };

    expect(normalizeNotification(null)).toEqual(defaultNotification);
    expect(normalizeNotification(undefined)).toEqual(defaultNotification);
    expect(normalizeNotification("string-data")).toEqual(defaultNotification);
  });

  it("should filter out non-string items in readByUserIds", () => {
    const rawData = {
      readByUserIds: ["user-1", 123, null, "user-2"],
    };
    const result = normalizeNotification(rawData);
    expect(result.readByUserIds).toEqual(["user-1", "user-2"]);
  });
});

describe("normalizeNotifications", () => {
  it("should normalize an array of raw notifications", () => {
    const rawItems = [
      { id: "1", title: "Notif 1", type: "warning" },
      { _id: "2", title: "Notif 2", type: "success" },
    ];

    const result = normalizeNotifications(rawItems);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("1");
    expect(result[0].type).toBe("warning");
    expect(result[1].id).toBe("2");
    expect(result[1].type).toBe("success");
  });

  it("should return empty array if input is not an array", () => {
    expect(normalizeNotifications(null)).toEqual([]);
    expect(normalizeNotifications(undefined)).toEqual([]);
    expect(normalizeNotifications({ items: [] })).toEqual([]);
  });
});
