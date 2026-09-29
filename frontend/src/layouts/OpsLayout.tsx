import { useState } from "react"
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
  Menu,
} from "lucide-react"

import { useAuthStore, hasRole } from "@/stores/auth"
import { logout as apiLogout } from "@/api/auth"
import { useNotificationSocket } from "@/hooks/useNotificationSocket"
import { cn } from "@/lib/utils"
import { Wordmark } from "@/components/Wordmark"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
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
    <div className="bg-background flex flex-col md:flex-row min-h-svh">
      {/* Desktop Sidebar */}
      <aside className="border-border bg-card hidden md:flex w-56 shrink-0 flex-col border-r">
        <div className="border-border border-b px-4 py-4">
          <Wordmark size="sm" />
          <p className="text-muted-foreground text-xs mt-0.5">Ops Console</p>
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
            className="text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1.5 text-xs transition-colors"
          >
            <LogOut className="size-3.5" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main Container + Mobile Header */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="border-border bg-card sticky top-0 z-20 flex h-14 items-center justify-between border-b px-4 md:hidden">
          <div className="flex items-center gap-2">
            <Wordmark size="sm" />
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider">
              Ops
            </span>
          </div>
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger
              render={
                <button
                  type="button"
                  className="hover:bg-muted text-muted-foreground hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-md border border-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open staff navigation menu"
                >
                  <Menu className="size-5" />
                </button>
              }
            />
            <SheetContent side="left" className="w-[85vw] max-w-xs p-0 flex flex-col justify-between">
              <div>
                <SheetHeader className="border-border border-b p-4 text-left">
                  <SheetTitle className="flex items-center gap-2">
                    <Wordmark size="sm" />
                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                      Ops Console
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="p-3 space-y-1">
                  {visibleNav.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => setMobileNavOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-muted"
                        )
                      }
                    >
                      <Icon className="size-4 shrink-0" />
                      {label}
                    </NavLink>
                  ))}
                </nav>
              </div>

              <div className="border-border border-t p-4 bg-muted/30">
                <p className="truncate text-sm font-medium">{user?.full_name ?? "Staff"}</p>
                <p className="text-muted-foreground truncate text-xs">{user?.email}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMobileNavOpen(false)
                    handleLogout()
                  }}
                  className="mt-3 w-full min-h-[44px] justify-center gap-2 text-destructive hover:text-destructive"
                >
                  <LogOut className="size-4" />
                  Log out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-x-hidden px-4 py-4 md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
