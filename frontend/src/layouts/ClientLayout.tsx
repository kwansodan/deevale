import { Outlet, useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { useAuthStore } from "@/stores/auth"
import { logout as apiLogout } from "@/api/auth"
import { useNotificationSocket } from "@/hooks/useNotificationSocket"
import { NotificationBell } from "@/components/NotificationBell"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Wordmark } from "@/components/Wordmark"
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

  return (
    <div className="bg-background min-h-svh">
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground focus:ring-ring sr-only rounded px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:ring-2"
      >
        Skip to content
      </a>
      <header className="border-border bg-card sticky top-0 z-10 border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-5">
            <Link to="/app">
              <Wordmark size="sm" />
            </Link>
            <nav className="flex items-center gap-4 text-sm" aria-label="Primary">
              <Link to="/app" className="text-muted-foreground hover:text-foreground">
                {t("nav.dashboard")}
              </Link>
              <Link to="/app/compliance" className="text-muted-foreground hover:text-foreground">
                {t("nav.compliance")}
              </Link>
              <Link to="/app/money" className="text-muted-foreground hover:text-foreground">
                {t("nav.money")}
              </Link>
              <Link to="/app/mail" className="text-muted-foreground hover:text-foreground">
                {t("nav.mail")}
              </Link>
              <Link to="/app/referrals" className="text-muted-foreground hover:text-foreground">
                {t("nav.referrals")}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="rounded-full focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none">
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground">
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
                <DropdownMenuItem render={<Link to="/app/notifications">{t("nav.notifications")}</Link>} />
                <DropdownMenuItem onSelect={handleLogout}>{t("nav.logout")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
