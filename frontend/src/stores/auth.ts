import { create } from "zustand"

const REFRESH_TOKEN_KEY = "launchgh.refresh_token"

export type CurrentUser = {
  id: string
  email: string
  phone: string
  full_name: string
  roles: string[]
  is_email_verified: boolean
  is_phone_verified: boolean
}

type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  user: CurrentUser | null
  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: CurrentUser | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  user: null,
  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    set({ accessToken, refreshToken })
  },
  setUser: (user) => set({ user }),
  clear: () => {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    set({ accessToken: null, refreshToken: null, user: null })
  },
}))

export function isStaffRole(roles: string[] | undefined): boolean {
  if (!roles) return false
  return roles.some((r) => ["case_officer", "reviewer", "finance", "admin"].includes(r))
}

export function hasRole(roles: string[] | undefined, ...allowed: string[]): boolean {
  if (!roles) return false
  return roles.some((r) => allowed.includes(r))
}
