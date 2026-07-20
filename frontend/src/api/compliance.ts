import { apiClient } from "@/api/client"

export type ComplianceObligation = {
  id: string
  business_case_id: string
  code: string
  title: string
  description: string | null
  due_date: string
  recurrence: "annual" | "quarterly" | "monthly" | "one_off"
  status: "upcoming" | "completed" | "filed_by_us"
}

export async function listObligations() {
  const { data } = await apiClient.get<ComplianceObligation[]>("/compliance/obligations")
  return data
}

export async function completeObligation(id: string) {
  const { data } = await apiClient.post<ComplianceObligation>(`/compliance/obligations/${id}/complete`)
  return data
}

export async function requestFiling(id: string) {
  const { data } = await apiClient.post(`/compliance/obligations/${id}/file-request`)
  return data
}

export type SubscriptionStatus = {
  active: boolean
  subscription: {
    id: string
    plan: string
    status: string
    current_period_end: string | null
  } | null
  monthly_price_minor: number
  annual_price_minor: number
}

export async function getSubscriptionStatus() {
  const { data } = await apiClient.get<SubscriptionStatus>("/billing/subscription")
  return data
}

export async function subscribe(plan: "monthly" | "annual", callbackUrl: string) {
  const { data } = await apiClient.post<{ authorization_url: string; reference: string }>(
    "/billing/subscribe",
    { plan },
    { params: { callback_url: callbackUrl } }
  )
  return data
}

export type ServiceRequest = {
  id: string
  obligation_id: string
  business_case_id: string
  client_id: string
  status: "new" | "in_progress" | "done"
  assigned_officer_id: string | null
  note: string | null
  created_at: string
  obligation_title: string | null
}

export async function listServiceRequests() {
  const { data } = await apiClient.get<ServiceRequest[]>("/compliance/service-requests")
  return data
}

export async function transitionServiceRequest(id: string, status: "in_progress" | "done", note?: string) {
  const { data } = await apiClient.post<ServiceRequest>(`/compliance/service-requests/${id}/transition`, {
    status,
    note,
  })
  return data
}

export type BillingMetrics = {
  active_subscriptions: number
  active_monthly: number
  active_annual: number
  mrr_minor: number
  churned_last_30d: number
  churn_rate_30d: number
}

export async function fetchBillingMetrics() {
  const { data } = await apiClient.get<BillingMetrics>("/billing/finance/metrics")
  return data
}
