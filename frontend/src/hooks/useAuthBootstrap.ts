import { useEffect, useState } from "react"

import { apiClient } from "@/api/client"
import { fetchCurrentUser } from "@/api/auth"
import { useAuthStore } from "@/stores/auth"

/**
 * On first load, the access token only ever lives in memory (never
 * localStorage, to reduce XSS blast radius) -- so a page refresh needs to
 * silently redeem the persisted refresh token for a fresh access token
 * before any protected route renders. Returns `true` once that attempt
 * (success or failure) has settled.
 */
export function useAuthBootstrap(): boolean {
  const [ready, setReady] = useState(false)
  const refreshToken = useAuthStore((s) => s.refreshToken)
  const accessToken = useAuthStore((s) => s.accessToken)
  const setTokens = useAuthStore((s) => s.setTokens)
  const setUser = useAuthStore((s) => s.setUser)
  const clear = useAuthStore((s) => s.clear)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (accessToken) {
        setReady(true)
        return
      }
      if (!refreshToken) {
        setReady(true)
        return
      }
      try {
        const resp = await apiClient.post(
          "/auth/refresh",
          null,
          { headers: { Authorization: `Bearer ${refreshToken}` } }
        )
        if (cancelled) return
        setTokens(resp.data.access_token, resp.data.refresh_token)
        const user = await fetchCurrentUser()
        if (!cancelled) setUser(user)
      } catch {
        if (!cancelled) clear()
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return ready
}
