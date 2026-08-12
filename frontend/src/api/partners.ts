import { apiClient } from "@/api/client"
import type { CaseSummary } from "@/api/cases"

export type Partner = {
  id: string
  name: string
  slug: string
  contact_email: string | null
  logo_url: string | null
  accent_color: string
  status: string
  rate_limit_per_hour: number
  created_at: string
}

export type ApiKey = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  is_active: boolean
  last_used_at: string | null
  created_at: string
}

export type PartnerWebhook = {
  id: string
  url: string
  event_types: string[]
  is_active: boolean
  secret?: string // returned once on creation
}

export const API_SCOPES = ["cases:read", "cases:write", "documents:write", "webhooks:manage"]

export const PARTNER_EVENT_TYPES = [
  "case.created",
  "stage.completed",
  "document.approved",
  "document.rejected",
  "payment.received",
  "case.blocked",
]

export async function listPartners() {
  const { data } = await apiClient.get<Partner[]>("/admin/partners")
  return data
}

export async function createPartner(partner: {
  name: string
  slug: string
  contact_email?: string
  accent_color: string
  rate_limit_per_hour: number
}) {
  const { data } = await apiClient.post<Partner>("/admin/partners", partner)
  return data
}

export async function listPartnerKeys(partnerId: string) {
  const { data } = await apiClient.get<ApiKey[]>(`/admin/partners/${partnerId}/keys`)
  return data
}

export async function createPartnerKey(partnerId: string, name: string, scopes: string[]) {
  const { data } = await apiClient.post<ApiKey & { plaintext_key: string }>(
    `/admin/partners/${partnerId}/keys`,
    { name, scopes }
  )
  return data
}

export async function revokePartnerKey(keyId: string) {
  const { data } = await apiClient.post<ApiKey>(`/admin/partners/keys/${keyId}/revoke`)
  return data
}

export async function createPartnerWebhook(partnerId: string, url: string, eventTypes: string[]) {
  const { data } = await apiClient.post<PartnerWebhook>(`/admin/partners/${partnerId}/webhooks`, {
    url,
    event_types: eventTypes,
  })
  return data
}

export async function deletePartnerWebhook(webhookId: string) {
  await apiClient.delete(`/admin/partners/webhooks/${webhookId}`)
}

export async function listPartnerWebhooks(partnerId: string) {
  const { data } = await apiClient.get<PartnerWebhook[]>(`/admin/partners/${partnerId}/webhooks`)
  return data
}

export async function listPartnerCases(partnerId: string) {
  const { data } = await apiClient.get<CaseSummary[]>(`/admin/partners/${partnerId}/cases`)
  return data
}
