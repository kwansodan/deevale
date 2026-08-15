import { apiClient } from "@/api/client"
import type { CurrentUser } from "@/stores/auth"

/** Self-service profile fields a customer may edit. Email and primary phone are
 *  deliberately absent -- they are read-only (login/recovery identity). */
export type ProfileUpdate = {
  full_name?: string
  secondary_phone?: string | null
  is_whatsapp_reachable?: boolean
  locale?: string
}

export async function updateProfile(payload: ProfileUpdate) {
  const { data } = await apiClient.patch<CurrentUser>("/auth/me", payload)
  return data
}

export async function changePassword(payload: {
  current_password: string
  new_password: string
}) {
  const { data } = await apiClient.post<{ message: string }>("/auth/me/password", payload)
  return data
}

export async function requestAccountDeletion() {
  const { data } = await apiClient.post<{ message: string }>("/auth/me/deletion-request")
  return data
}
