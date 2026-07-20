import { apiClient } from "@/api/client"

export type QuoteLineItem = {
  label: string
  amount_minor: number
  fee_type: "government" | "service"
}

export type QuotePreview = {
  line_items: QuoteLineItem[]
  subtotal_government_minor: number
  subtotal_service_minor: number
  total_minor: number
  currency: string
}

export type CaseTask = {
  id: string
  code: string
  name: string
  description: string | null
  status: string
  status_display: string
  assignee_type: "client" | "staff"
  is_required: boolean
  requires_document: boolean
  required_document_type: string | null
  linked_document_id: string | null
  government_reference_note: string | null
  deadline_at: string | null
  completed_at: string | null
}

export type CaseStage = {
  id: string
  code: string
  name: string
  sequence_order: number
  status: string
  is_gated_by_payment: boolean
  started_at: string | null
  completed_at: string | null
  deadline_at: string | null
  tasks: CaseTask[]
}

export type Quote = {
  id: string
  status: string
  subtotal_government_minor: number
  subtotal_service_minor: number
  total_minor: number
  currency: string
  line_items: (QuoteLineItem & { id: string })[]
}

export type BusinessCase = {
  id: string
  case_number: string
  client_id: string
  assigned_officer_id: string | null
  entity_type: string
  status: string
  onboarding_payload: Record<string, unknown>
  created_at: string
  stages: CaseStage[]
  quote: Quote | null
  client: { id: string; full_name: string; email: string; phone: string } | null
}

export type CaseSummary = {
  id: string
  case_number: string
  entity_type: string
  status: string
  assigned_officer_id: string | null
  created_at: string
}

export type OnboardingDraft = {
  payload: Record<string, unknown>
  current_step: number
}

export async function fetchQuotePreview(entityType: string, foreignParticipation = false) {
  const { data } = await apiClient.post<QuotePreview>("/cases/quote-preview", {
    entity_type: entityType,
    foreign_participation: foreignParticipation,
  })
  return data
}

export async function getOnboardingDraft() {
  const { data } = await apiClient.get<OnboardingDraft>("/cases/onboarding-draft")
  return data
}

export async function saveOnboardingDraft(draft: OnboardingDraft) {
  const { data } = await apiClient.put<OnboardingDraft>("/cases/onboarding-draft", draft)
  return data
}

export async function createCase(onboardingPayload: Record<string, unknown>) {
  const { data } = await apiClient.post<BusinessCase>("/cases", onboardingPayload)
  return data
}

export async function listCases() {
  const { data } = await apiClient.get<CaseSummary[]>("/cases")
  return data
}

export async function getCase(caseId: string) {
  const { data } = await apiClient.get<BusinessCase>(`/cases/${caseId}`)
  return data
}

export async function completeClientTask(caseId: string, taskId: string, note?: string) {
  const { data } = await apiClient.post<BusinessCase>(
    `/cases/${caseId}/tasks/${taskId}/complete`,
    note ? { note } : {}
  )
  return data
}

export async function createInvoice(caseId: string) {
  const { data } = await apiClient.post<{ id: string; invoice_number: string; total_minor: number }>(
    `/payments/cases/${caseId}/invoice`
  )
  return data
}

export async function initializeTransaction(invoiceId: string, callbackUrl: string) {
  const { data } = await apiClient.post<{ authorization_url: string; provider_reference: string }>(
    `/payments/invoices/${invoiceId}/initialize-transaction`,
    null,
    { params: { callback_url: callbackUrl } }
  )
  return data
}

export function formatGhs(amountMinor: number): string {
  return `GHS ${(amountMinor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`
}
