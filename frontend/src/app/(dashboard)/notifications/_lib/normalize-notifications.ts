export interface NormalizedNotification {
  id: string;
  title: string;
  description: string;
  type: 'warning' | 'success' | 'info' | 'system';
  targetRole: 'all' | 'student' | 'teacher' | 'supervisor' | null;
  isRead: boolean;
  createdAt: string;
  readByUserIds: string[];
  routeUrl: string;
}

export function normalizeNotification(rawData: any): NormalizedNotification {
  if (!rawData || typeof rawData !== "object") {
    return {
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
  }

  // Fallback for id (from _id or id)
  const id = typeof rawData.id === "string" 
    ? rawData.id 
    : (typeof rawData._id === "string" ? rawData._id : "");
  
  // Fallback for title, description, routeUrl
  const title = typeof rawData.title === "string" ? rawData.title : "";
  const description = typeof rawData.description === "string" ? rawData.description : "";
  const routeUrl = typeof rawData.routeUrl === "string" ? rawData.routeUrl : "";

  // Fallback for type ('warning' | 'success' | 'info' | 'system')
  let type: 'warning' | 'success' | 'info' | 'system' = 'system';
  if (['warning', 'success', 'info', 'system'].includes(rawData.type)) {
    type = rawData.type;
  }

  // Fallback for targetRole ('all' | 'student' | 'teacher' | 'supervisor' | null)
  let targetRole: 'all' | 'student' | 'teacher' | 'supervisor' | null = null;
  if (['all', 'student', 'teacher', 'supervisor'].includes(rawData.targetRole)) {
    targetRole = rawData.targetRole;
  }

  // Fallback for isRead
  const isRead = typeof rawData.isRead === "boolean" ? rawData.isRead : false;

  // Fallback for createdAt
  const createdAt = typeof rawData.createdAt === "string" ? rawData.createdAt : "";

  // Fallback for readByUserIds
  const readByUserIds = Array.isArray(rawData.readByUserIds)
    ? rawData.readByUserIds.filter((item: any) => typeof item === "string")
    : [];

  return {
    id,
    title,
    description,
    type,
    targetRole,
    isRead,
    createdAt,
    readByUserIds,
    routeUrl,
  };
}

export function normalizeNotifications(rawItems: any): NormalizedNotification[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map(normalizeNotification);
}
