"use client";

import { createContext, ReactNode, useContext } from "react";
import type { OfficeRole } from "@/lib/roles";

type AdminRoleContextValue = {
  role: OfficeRole;
};

const AdminRoleContext = createContext<AdminRoleContextValue | null>(null);

export function AdminRoleProvider({
  children,
  role
}: {
  children: ReactNode;
  role: OfficeRole;
}) {
  return (
    <AdminRoleContext.Provider value={{ role }}>
      {children}
    </AdminRoleContext.Provider>
  );
}

export function useAdminRole() {
  const context = useContext(AdminRoleContext);
  if (!context) {
    throw new Error("useAdminRole must be used inside AdminRoleProvider.");
  }

  return context;
}
