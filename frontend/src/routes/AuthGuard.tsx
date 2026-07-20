import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuthStore, isStaffRole } from "@/stores/auth"

export function RequireAuth() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}

export function RequireStaff() {
  const user = useAuthStore((s) => s.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (!isStaffRole(user.roles)) {
    return <Navigate to="/app" replace />
  }
  return <Outlet />
}
