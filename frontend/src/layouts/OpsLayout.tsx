import { NavLink, Outlet, useNavigate } from "react-router-dom"
import {
  CalendarCheck,
  ClipboardList,
  FolderKanban,
  BarChart3,
  Building2,
  Mailbox,
  Settings,
  LogOut,
  Wallet,
} from "lucide-react"

import { useAuthStore, hasRole } from "@/stores/auth"
import { logout as apiLogout } from "@/api/auth"
import { useNotificationSocket } from "@/hooks/useNotificationSocket"
import { cn } from "@/lib/utils"

// Role-gated navigation: reviewers see the review queue only, finance sees
// payments (+ fee schedule settings), admin sees everything.
const NAV_ITEMS = [
  { to: "/ops/queue", label: "Queue", icon: ClipboardList, roles: ["case_officer", "reviewer", "admin"] },
  { to: "/ops/cases", label: "Cases", icon: FolderKanban, roles: ["case_officer", "admin"] },
  {
    to: "/ops/service-requests",
    label: "Service Requests",
    icon: CalendarCheck,
    roles: ["case_officer", "admin"],
  },
  { to: "/ops/mail-room", label: "Mail Room", icon: Mailbox, roles: ["case_officer", "admin"] },
  { to: "/ops/payments", label: "Payments", icon: Wallet, roles: ["finance", "admin"] },
  { to: "/ops/reports", label: "Reports", icon: BarChart3, roles: ["case_officer", "admin"] },
  { to: "/ops/partners", label: "Partners", icon: Building2, roles: ["admin"] },
  { to: "/ops/settings", label: "Settings", icon: Settings, roles: ["admin", "finance"] },
]

export default function OpsLayout() {
  useNotificationSocket()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const refreshToken = useAuthStore((s) => s.refreshToken)
  const clear = useAuthStore((s) => s.clear)
  const visibleNav = NAV_ITEMS.filter((item) => hasRole(user?.roles, ...item.roles))

  async function handleLogout() {
    try {
      await apiLogout(refreshToken)
    } catch {
      // best-effort
    }
    clear()
    navigate("/login", { replace: true })
  }

  return (
    <div className="bg-background flex min-h-svh">
      <aside className="border-border bg-card flex w-56 shrink-0 flex-col border-r">
        <div className="border-border border-b px-4 py-4">
          <span className="text-primary text-lg font-bold">LaunchGH</span>
          <p className="text-muted-foreground text-xs">Ops Console</p>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-border border-t p-3">
          <p className="truncate text-sm font-medium">{user?.full_name ?? "Staff"}</p>
          <p className="text-muted-foreground truncate text-xs">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1.5 text-xs"
          >
            <LogOut className="size-3.5" />
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
