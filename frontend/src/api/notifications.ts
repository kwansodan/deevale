import { apiClient } from "@/api/client"

export type Notification = {
  id: string
  category: string
  title: string
  body: string
  related_case_id: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export async function listNotifications() {
  const { data } = await apiClient.get<Notification[]>("/notifications")
  return data
}

export async function getUnreadCount() {
  const { data } = await apiClient.get<{ count: number }>("/notifications/unread-count")
  return data.count
}

export async function markNotificationRead(id: string) {
  const { data } = await apiClient.post<Notification>(`/notifications/${id}/read`)
  return data
}

export type NotificationPreference = {
  category: string
  email_enabled: boolean
  in_app_enabled: boolean
  sms_enabled: boolean | null
  whatsapp_enabled: boolean | null
}

export async function getNotificationPreferences() {
  const { data } = await apiClient.get<NotificationPreference[]>("/notifications/preferences")
  return data
}

export async function updateNotificationPreferences(preferences: NotificationPreference[]) {
  const { data } = await apiClient.put<NotificationPreference[]>("/notifications/preferences", {
    preferences,
  })
  return data
}
