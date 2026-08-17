import { apiClient } from "@/api/client"

export interface LiveChatMessage {
  id: string
  session_id: string
  sender_type: "visitor" | "staff" | "system"
  sender_user_id?: string | null
  sender_name?: string | null
  body: string
  read_at?: string | null
  created_at: string
}

export interface LiveChatSession {
  id: string
  visitor_id: string
  visitor_name?: string | null
  visitor_email?: string | null
  visitor_phone?: string | null
  current_page: string
  referrer?: string | null
  user_agent?: string | null
  ip_address?: string | null
  status: "active" | "closed"
  is_online: boolean
  last_seen_at?: string | null
  assigned_officer_id?: string | null
  assigned_officer_name?: string | null
  created_at: string
  updated_at: string
  unread_count?: number
  messages?: LiveChatMessage[]
  last_message?: LiveChatMessage | null
}

export async function initVisitorSession(
  visitor_id: string,
  page: string = "/",
  referrer?: string | null
): Promise<LiveChatSession> {
  const resp = await apiClient.post<LiveChatSession>("/public/live-chat/session", {
    visitor_id,
    page,
    referrer: referrer || document.referrer || null,
  })
  return resp.data
}

export async function getSessionMessages(sessionId: string): Promise<LiveChatMessage[]> {
  const resp = await apiClient.get<LiveChatMessage[]>(`/public/live-chat/sessions/${sessionId}/messages`)
  return resp.data
}

export async function sendVisitorMessage(
  sessionId: string,
  body: string,
  senderName?: string
): Promise<LiveChatMessage> {
  const resp = await apiClient.post<LiveChatMessage>(`/public/live-chat/sessions/${sessionId}/messages`, {
    body,
    sender_name: senderName,
  })
  return resp.data
}

export async function updateVisitorContact(
  sessionId: string,
  data: { visitor_name?: string; visitor_email?: string; visitor_phone?: string }
): Promise<LiveChatSession> {
  const resp = await apiClient.patch<LiveChatSession>(`/public/live-chat/sessions/${sessionId}/contact`, data)
  return resp.data
}

// --- Ops Staff Endpoints ----------------------------------------------------

export async function listOpsVisitors(): Promise<LiveChatSession[]> {
  const resp = await apiClient.get<LiveChatSession[]>("/ops/live-chat/visitors")
  return resp.data
}

export async function listOpsSessions(status?: string): Promise<LiveChatSession[]> {
  const resp = await apiClient.get<LiveChatSession[]>("/ops/live-chat/sessions", {
    params: status ? { status } : {},
  })
  return resp.data
}

export async function getOpsSession(sessionId: string): Promise<LiveChatSession> {
  const resp = await apiClient.get<LiveChatSession>(`/ops/live-chat/sessions/${sessionId}`)
  return resp.data
}

export async function sendStaffMessage(sessionId: string, body: string): Promise<LiveChatMessage> {
  const resp = await apiClient.post<LiveChatMessage>(`/ops/live-chat/sessions/${sessionId}/messages`, {
    body,
  })
  return resp.data
}

export async function closeOpsSession(sessionId: string): Promise<LiveChatSession> {
  const resp = await apiClient.patch<LiveChatSession>(`/ops/live-chat/sessions/${sessionId}/close`)
  return resp.data
}
