import { useTranslation } from "react-i18next"
import { Languages } from "lucide-react"

import { SUPPORTED_LANGUAGES } from "@/i18n"
import { apiClient } from "@/api/client"
import { useAuthStore } from "@/stores/auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = SUPPORTED_LANGUAGES.find((l) => i18n.language.startsWith(l.code)) ?? SUPPORTED_LANGUAGES[0]

  function changeLanguage(code: string) {
    i18n.changeLanguage(code)
    // Persist to the account (best-effort) so notifications use it too.
    if (useAuthStore.getState().accessToken) {
      apiClient.put("/auth/me/locale", { locale: code }).catch(() => {})
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" aria-label={t("common.language")}>
            <Languages className="size-4" />
            <span className="ml-1 text-xs uppercase">{current.code}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem key={lang.code} onSelect={() => changeLanguage(lang.code)}>
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
