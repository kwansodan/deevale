import { useEffect } from "react"
import { useLocation } from "react-router-dom"

import { useLandingConfig } from "@/config/landing"
import { useAuthStore } from "@/stores/auth"

declare global {
  interface Window {
    chatwootSettings?: {
      hideMessageBubble?: boolean
      position?: "left" | "right"
      locale?: string
      type?: "standard" | "expanded_bubble"
      darkMode?: "auto" | "light" | "dark"
      launcherTitle?: string
      showPopoutButton?: boolean
      [key: string]: unknown
    }
    chatwootSDK?: {
      run: (config: { websiteToken: string; baseUrl: string }) => void
    }
    $chatwoot?: {
      setUser: (
        identifier: string,
        user: { name?: string; email?: string; avatar_url?: string; phone_number?: string }
      ) => void
      setCustomAttributes: (attributes: Record<string, unknown>) => void
      deleteCustomAttribute: (attributeName: string) => void
      setLocale: (locale: string) => void
      toggle: (state?: "open" | "close") => void
      toggleBubbleVisibility: (visibility: "show" | "hide") => void
      hide: () => void
      show: () => void
      reset: () => void
      isOpen: () => boolean
    }
  }
}

export function ChatwootWidget() {
  const { pathname } = useLocation()
  const { company } = useLandingConfig()
  const user = useAuthStore((s) => s.user)

  const websiteToken =
    company.chatwootWebsiteToken?.trim() ||
    (import.meta.env.VITE_CHATWOOT_WEBSITE_TOKEN as string | undefined)?.trim()

  const baseUrl =
    company.chatwootBaseUrl?.trim() ||
    (import.meta.env.VITE_CHATWOOT_BASE_URL as string | undefined)?.trim() ||
    "https://app.chatwoot.com"

  const isOpsRoute = pathname.startsWith("/ops")

  useEffect(() => {
    if (!websiteToken) return

    window.chatwootSettings = {
      hideMessageBubble: false,
      position: "right",
      locale: "en",
      type: "standard",
      darkMode: "auto",
      launcherTitle: "Chat with us",
      showPopoutButton: true,
    }

    const existingScript = document.getElementById("chatwoot-sdk")
    if (!existingScript) {
      const script = document.createElement("script")
      script.id = "chatwoot-sdk"
      script.src = `${baseUrl.replace(/\/+$/, "")}/packs/js/sdk.js`
      script.async = true
      script.defer = true
      script.onload = () => {
        if (window.chatwootSDK) {
          window.chatwootSDK.run({
            websiteToken,
            baseUrl: baseUrl.replace(/\/+$/, ""),
          })
        }
      }
      document.body.appendChild(script)
    } else if (window.chatwootSDK) {
      window.chatwootSDK.run({
        websiteToken,
        baseUrl: baseUrl.replace(/\/+$/, ""),
      })
    }
  }, [websiteToken, baseUrl])

  // Identify logged in users
  useEffect(() => {
    if (window.$chatwoot && user) {
      try {
        window.$chatwoot.setUser(String(user.id), {
          name: user.full_name,
          email: user.email,
          phone_number: user.phone || undefined,
        })
      } catch {
        // best-effort
      }
    }
  }, [user])

  // Hide the widget inside the /ops back-office console
  useEffect(() => {
    if (window.$chatwoot) {
      try {
        if (isOpsRoute) {
          window.$chatwoot.toggleBubbleVisibility("hide")
        } else {
          window.$chatwoot.toggleBubbleVisibility("show")
        }
      } catch {
        // best-effort
      }
    }
  }, [isOpsRoute])

  return null
}
