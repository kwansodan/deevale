import { useState } from "react"
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  Menu,
  LayoutDashboard,
  ShieldCheck,
  Wallet,
  Mail,
  Users,
  User,
  LogOut,
  Bell,
} from "lucide-react"

import { useAuthStore } from "@/stores/auth"
import { logout as apiLogout } from "@/api/auth"
import { useNotificationSocket } from "@/hooks/useNotificationSocket"
import { NotificationBell } from "@/components/NotificationBell"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Wordmark } from "@/components/Wordmark"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function initials(name: string | undefined): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}

export default function ClientLayout() {
  useNotificationSocket()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const user = useAuthStore((s) => s.user)
  const refreshToken = useAuthStore((s) => s.refreshToken)
  const clear = useAuthStore((s) => s.clear)

  async function handleLogout() {
    try {
      await apiLogout(refreshToken)
    } catch {
      // best-effort -- clear local state regardless
    }
    clear()
    navigate("/login", { replace: true })
  }

  const navItems = [
    { to: "/app", label: t("nav.dashboard"), icon: LayoutDashboard, exact: true },
    { to: "/app/compliance", label: t("nav.compliance"), icon: ShieldCheck },
    { to: "/app/money", label: t("nav.money"), icon: Wallet },
    { to: "/app/mail", label: t("nav.mail"), icon: Mail },
    { to: "/app/referrals", label: t("nav.referrals"), icon: Users },
  ]

  return (
    <div className="bg-background min-h-svh">
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground focus:ring-ring sr-only rounded px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:ring-2"
      >
        Skip to content
      </a>
      <header className="border-border bg-card sticky top-0 z-20 border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-5">
            <Link to="/app" className="focus-visible:ring-ring shrink-0 rounded focus-visible:outline-none focus-visible:ring-2">
              <Wordmark size="sm" />
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-sm" aria-label="Primary">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "transition-colors hover:text-foreground",
                      isActive ? "text-foreground font-semibold" : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <NotificationBell />

            {/* Desktop User Avatar Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="rounded-full focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none min-h-[36px] min-w-[36px] flex items-center justify-center"
                    aria-label="User profile options"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {initials(user?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                }
              />
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-sm">
                  <p className="font-medium">{user?.full_name ?? "Account"}</p>
                  <p className="text-muted-foreground text-xs">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link to="/app/account">{t("nav.account")}</Link>} />
                <DropdownMenuItem render={<Link to="/app/notifications">{t("nav.notifications")}</Link>} />
                <DropdownMenuItem onClick={handleLogout}>{t("nav.logout")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Navigation Drawer Trigger */}
            <div className="md:hidden">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger
                  render={
                    <button
                      type="button"
                      className="hover:bg-muted text-muted-foreground hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-md border border-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Open navigation menu"
                    >
                      <Menu className="size-5" />
                    </button>
                  }
                />
                <SheetContent side="right" className="w-[85vw] max-w-sm p-0 flex flex-col justify-between">
                  <div>
                    <SheetHeader className="border-border border-b p-4 text-left">
                      <SheetTitle>
                        <Wordmark size="sm" />
                      </SheetTitle>
                    </SheetHeader>

                    <div className="p-4 space-y-1">
                      {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = item.exact
                          ? location.pathname === item.to
                          : location.pathname.startsWith(item.to)
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setMobileNavOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground hover:bg-muted"
                            )}
                          >
                            <Icon className="size-4 shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}

                      <div className="my-2 border-t border-border pt-2">
                        <Link
                          to="/app/account"
                          onClick={() => setMobileNavOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                            location.pathname === "/app/account"
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground hover:bg-muted"
                          )}
                        >
                          <User className="size-4 shrink-0 text-muted-foreground" />
                          <span>{t("nav.account")}</span>
                        </Link>
                        <Link
                          to="/app/notifications"
                          onClick={() => setMobileNavOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                            location.pathname === "/app/notifications"
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground hover:bg-muted"
                          )}
                        >
                          <Bell className="size-4 shrink-0 text-muted-foreground" />
                          <span>{t("nav.notifications")}</span>
                        </Link>
                      </div>

                      <div className="pt-2 flex items-center justify-between px-3 py-2 bg-muted/40 rounded-lg">
                        <span className="text-xs font-medium text-muted-foreground">Language:</span>
                        <LanguageSwitcher />
                      </div>
                    </div>
                  </div>

                  <div className="border-border border-t p-4 bg-muted/30">
                    <div className="mb-3 px-1">
                      <p className="font-medium text-sm truncate">{user?.full_name ?? "Account"}</p>
                      <p className="text-muted-foreground text-xs truncate">{user?.email}</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMobileNavOpen(false)
                        handleLogout()
                      }}
                      className="w-full min-h-[44px] justify-center gap-2 text-destructive hover:text-destructive"
                    >
                      <LogOut className="size-4" />
                      <span>{t("nav.logout")}</span>
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
