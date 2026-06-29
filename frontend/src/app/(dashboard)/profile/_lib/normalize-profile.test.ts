import { describe, it, expect } from "vitest";
import { normalizeProfile } from "./normalize-profile";

describe("normalizeProfile", () => {
  it("should normalize fully populated raw data correctly", () => {
    const rawData = {
      id: "user-123",
      user_name: "johndoe",
      email: "johndoe@example.com",
      phone_number: "123456789",
      date_birth: "1990-01-01",
      department: "IT Department",
      roleName: "Administrator",
      roleCode: "ADMIN",
      role: {
        id: "role-1",
        name: "Admin Role",
        code: "ADMIN_ROLE",
        permissions: [
          { name: "Read Users", code: "read:users" },
          { name: "Write Users", code: "write:users" },
        ],
      },
    };

    const result = normalizeProfile(rawData);

    expect(result).toEqual({
      id: "user-123",
      user_name: "johndoe",
      email: "johndoe@example.com",
      phone_number: "123456789",
      date_birth: "1990-01-01",
      department: "IT Department",
      roleName: "Administrator",
      roleCode: "ADMIN",
      role: {
        id: "role-1",
        name: "Administrator",
        code: "ADMIN",
        permissions: [
          { name: "Read Users", code: "read:users" },
          { name: "Write Users", code: "write:users" },
        ],
      },
      advisor_classes: [],
    });
  });

  it("should fallback to defaults when raw data has missing fields", () => {
    const rawData = {
      id: "user-123",
      user_name: "johndoe",
      email: "johndoe@example.com",
      role: {
        id: "role-1",
      },
    };

    const result = normalizeProfile(rawData);

    expect(result.phone_number).toBe("");
    expect(result.date_birth).toBe("");
    expect(result.department).toBe("");
    expect(result.roleName).toBe("User");
    expect(result.roleCode).toBe("USER");
    expect(result.role.permissions).toEqual([]);
  });

  it("should handle role as a string or complex object", () => {
    // Case A: Role as a string
    const rawDataWithStringRole = {
      id: "user-123",
      role: "ADMIN",
      roleName: "Admin User",
      roleCode: "ADMIN_CODE",
      permissions: [
        { name: "Write Profile", code: "write:profile" }
      ]
    };

    const resultA = normalizeProfile(rawDataWithStringRole);
    expect(resultA.role.id).toBe("");
    expect(resultA.roleName).toBe("Admin User");
    expect(resultA.roleCode).toBe("ADMIN_CODE");
    expect(resultA.role.permissions).toEqual([
      { name: "Write Profile", code: "write:profile" }
    ]);

    // Case B: Role as a complex object
    const rawDataWithComplexRole = {
      id: "user-123",
      role: {
        id: "role-id-99",
        name: "Manager Role",
        code: "MGR",
        permissions: [
          { name: "Manage Tasks", code: "manage:tasks" }
        ]
      }
    };
    const resultB = normalizeProfile(rawDataWithComplexRole);
    expect(resultB.role.id).toBe("role-id-99");
    expect(resultB.roleName).toBe("Manager Role");
    expect(resultB.roleCode).toBe("MGR");
    expect(resultB.role.permissions).toEqual([
      { name: "Manage Tasks", code: "manage:tasks" }
    ]);
  });

  it("should handle null and undefined rawData", () => {
    const defaultProfile = {
      id: "",
      user_name: "",
      email: "",
      phone_number: "",
      date_birth: "",
      department: "",
      roleName: "User",
      roleCode: "USER",
      role: {
        id: "",
        name: "User",
        code: "USER",
        permissions: [],
      },
      advisor_classes: [],
    };

    expect(normalizeProfile(null)).toEqual(defaultProfile);
    expect(normalizeProfile(undefined)).toEqual(defaultProfile);
    expect(normalizeProfile("invalid-data")).toEqual(defaultProfile);
  });

  it("should normalize real backend payload format using _id and role_code inside role object", () => {
    const rawData = {
      id: "user-123",
      user_name: "johndoe",
      email: "johndoe@example.com",
      phone_number: "123456789",
      date_birth: "1990-01-01",
      department: "IT Department",
      roleName: "Student",
      roleCode: "STUDENT",
      role: {
        _id: "role-123",
        name: "Student",
        role_code: "STUDENT",
        permissions: [
          { name: "View Student Page", code: "STUDENT_PAGE" }
        ]
      },
      permissions: ["STUDENT_PAGE"]
    };

    const result = normalizeProfile(rawData);

    expect(result.role.id).toBe("role-123");
    expect(result.roleCode).toBe("STUDENT");
    expect(result.role.code).toBe("STUDENT");
    expect(result.role.permissions).toEqual([
      { name: "View Student Page", code: "STUDENT_PAGE" }
    ]);
  });

  it("should filter out empty permission entries that miss both name and code", () => {
    const rawData = {
      id: "user-123",
      role: {
        id: "role-1",
        permissions: [
          { name: "Read Users", code: "read:users" },
          { name: "", code: "" },
          { name: "Write Users", code: "" },
          { name: "", code: "delete:users" },
          null,
          undefined,
          {},
        ],
      },
    };

    const result = normalizeProfile(rawData);

    expect(result.role.permissions).toEqual([
      { name: "Read Users", code: "read:users" },
      { name: "Write Users", code: "" },
      { name: "", code: "delete:users" },
    ]);
  });
});

