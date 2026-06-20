export interface Permission {
  name: string;
  code: string;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  permissions: Permission[];
}

export interface NormalizedProfile {
  id: string;
  user_name: string;
  email: string;
  phone_number: string;
  date_birth: string;
  department: string;
  roleName: string;
  roleCode: string;
  role: Role;
  advisor_classes?: any[];
}

export function normalizeProfile(rawData: any): NormalizedProfile {
  if (!rawData || typeof rawData !== "object") {
    return {
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
  }

  const roleData = rawData.role || {};
  const rawPermissions = Array.isArray(roleData.permissions)
    ? roleData.permissions
    : (Array.isArray(rawData.permissions) ? rawData.permissions : []);

  const permissions: Permission[] = rawPermissions
    .map((p: any) => ({
      name: typeof p?.name === "string" ? p.name : "",
      code: typeof p?.code === "string" ? p.code : "",
    }))
    .filter((p) => p.name || p.code);

  const roleName = typeof rawData.roleName === "string"
    ? rawData.roleName
    : (typeof roleData.name === "string" ? roleData.name : "User");
  
  const roleId = typeof roleData.id === "string"
    ? roleData.id
    : (typeof roleData._id === "string" ? roleData._id : "");

  const roleCode = typeof rawData.roleCode === "string"
    ? rawData.roleCode
    : (
        typeof roleData.code === "string"
          ? roleData.code
          : (typeof roleData.role_code === "string" ? roleData.role_code : "USER")
      );

  return {
    id: typeof rawData.id === "string" ? rawData.id : "",
    user_name: typeof rawData.user_name === "string" ? rawData.user_name : "",
    email: typeof rawData.email === "string" ? rawData.email : "",
    phone_number: typeof rawData.phone_number === "string" ? rawData.phone_number : "",
    date_birth: typeof rawData.date_birth === "string" ? rawData.date_birth : "",
    department: typeof rawData.department === "string" ? rawData.department : "",
    roleName,
    roleCode,
    role: {
      id: roleId,
      name: roleName,
      code: roleCode,
      permissions,
    },
    advisor_classes: Array.isArray(rawData.advisor_classes) ? rawData.advisor_classes : [],
  };
}
