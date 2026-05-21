export type OfficeRole = "admin" | "staff";

export function isOfficeRole(value?: string | null): value is OfficeRole {
  return value === "admin" || value === "staff";
}

export function officeRoleLabel(role: OfficeRole) {
  return role === "admin" ? "Administrator" : "Staff";
}

export function canApproveResidents(role: OfficeRole) {
  return role === "admin" || role === "staff";
}

export function canDeleteReports(role: OfficeRole) {
  return role === "admin";
}

export function canViewAnalytics(role: OfficeRole) {
  return role === "admin";
}

export function canManageOfficeAccounts(role: OfficeRole) {
  return role === "admin";
}
