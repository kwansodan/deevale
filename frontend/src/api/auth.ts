import { apiClient } from "@/api/client"
import type { CurrentUser } from "@/stores/auth"

export type SignupPayload = {
  email: string
  phone: string
  full_name: string
  password: string
  referral_code?: string
}

export type LoginPayload = {
  email: string
  password: string
}

export type TokenResponse = {
  access_token: string
  refresh_token: string
}

export async function signup(payload: SignupPayload) {
  const { data } = await apiClient.post<{ user_id: string; message: string }>("/auth/signup", payload)
  return data
}

export async function verifyOtp(identifier: string, code: string) {
  const { data } = await apiClient.post<{ message: string }>("/auth/verify-otp", { identifier, code })
  return data
}

export async function login(payload: LoginPayload) {
  const { data } = await apiClient.post<TokenResponse>("/auth/login", payload)
  return data
}

export async function logout(refreshToken: string | null) {
  await apiClient.post("/auth/logout", refreshToken ? { refresh_token: refreshToken } : {})
}

export async function fetchCurrentUser() {
  const { data } = await apiClient.get<CurrentUser>("/auth/me")
  return data
}

export async function requestPasswordReset(email: string) {
  const { data } = await apiClient.post<{ message: string }>("/auth/password-reset/request", { email })
  return data
}

export async function confirmPasswordReset(email: string, code: string, new_password: string) {
  const { data } = await apiClient.post<{ message: string }>("/auth/password-reset/confirm", {
    email,
    code,
    new_password,
  })
  return data
}
