import { apiClient } from "@/api/client"
import type { BusinessCase, CaseSummary } from "@/api/cases"
import type { CurrentUser } from "@/stores/auth"

export type PaginatedCases = {
  items: (CaseSummary & {
    business_name: string
    current_stage_name: string | null
    next_sla_due_at: string | null
    sla_breached: boolean
  })[]
  total: number
  page: number
  page_size: number
}

export type QueueFilters = {
  page: number
  page_size: number
  status?: string
  entity_type?: string
  stage_code?: string
  assigned_officer_id?: string
  sla?: "breached" | "breaching_soon"
}

export async function fetchCaseQueue(filters: QueueFilters) {
  const { data } = await apiClient.get<PaginatedCases>("/cases/queue", { params: filters })
  return data
}

export async function assignCase(caseId: string, officerId: string) {
  const { data } = await apiClient.post(`/cases/${caseId}/assign`, { officer_id: officerId })
  return data
}

export async function listStaff() {
  const { data } = await apiClient.get<CurrentUser[]>("/auth/staff")
  return data
}

export type AuditLogEntry = {
  id: string
  actor_user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  context: Record<string, unknown>
  created_at: string
}

export async function fetchCaseAuditLogs(caseId: string) {
  const { data } = await apiClient.get<AuditLogEntry[]>(`/cases/${caseId}/audit-logs`)
  return data
}

export type CaseInvoice = {
  id: string
  invoice_number: string
  status: string
  total_minor: number
  currency: string
  paid_at: string | null
  sent_at: string | null
  line_items: { id: string; label: string; amount_minor: number; fee_type: string }[]
}

export async function fetchCaseInvoices(caseId: string) {
  const { data } = await apiClient.get<CaseInvoice[]>(`/payments/cases/${caseId}/invoices`)
  return data
}

export async function transitionStage(caseId: string, stageId: string, newStatus: string, note?: string) {
  const { data } = await apiClient.post<BusinessCase>(`/cases/${caseId}/stages/${stageId}/transition`, {
    new_status: newStatus,
    note,
  })
  return data
}

export async function transitionTask(caseId: string, taskId: string, newStatus: string, note?: string) {
  const { data } = await apiClient.post<BusinessCase>(`/cases/${caseId}/tasks/${taskId}/transition`, {
    new_status: newStatus,
    note,
  })
  return data
}

export async function reviewDocumentVersion(
  documentId: string,
  versionNumber: number,
  decision: "approve" | "reject",
  reasonCode?: string,
  note?: string
) {
  const { data } = await apiClient.post(`/documents/${documentId}/versions/${versionNumber}/review`, {
    decision,
    reason_code: reasonCode,
    note,
  })
  return data
}

// --- Admin: fee schedule & templates ---------------------------------------

export type FeeScheduleItem = {
  id: string
  code: string
  label: string
  applies_to_entity_type: string | null
  applies_to_stage_code: string | null
  amount_minor: number
  currency: string
  fee_type: "government" | "service"
  is_active: boolean
}

export async function listFeeSchedule() {
  const { data } = await apiClient.get<FeeScheduleItem[]>("/admin/fee-schedule")
  return data
}

export async function updateFeeScheduleItem(
  itemId: string,
  changes: Partial<Pick<FeeScheduleItem, "label" | "amount_minor" | "is_active">>
) {
  const { data } = await apiClient.put<FeeScheduleItem>(`/admin/fee-schedule/${itemId}`, changes)
  return data
}

export async function createFeeScheduleItem(item: {
  code: string
  label: string
  amount_minor: number
  fee_type: string
  applies_to_entity_type?: string | null
  applies_to_stage_code?: string | null
}) {
  const { data } = await apiClient.post<FeeScheduleItem>("/admin/fee-schedule", item)
  return data
}

export type NotificationTemplate = {
  id: string | null
  category: string
  title_template: string
  body_template: string
  is_override: boolean
}

export async function listNotificationTemplates() {
  const { data } = await apiClient.get<NotificationTemplate[]>("/admin/notification-templates")
  return data
}

export async function upsertNotificationTemplate(template: {
  category: string
  title_template: string
  body_template: string
}) {
  const { data } = await apiClient.put<NotificationTemplate>("/admin/notification-templates", template)
  return data
}

export async function resetNotificationTemplate(category: string) {
  await apiClient.delete(`/admin/notification-templates/${category}`)
}

export type ReportKpis = {
  date_from: string
  date_to: string
  cases_created: number
  cases_completed: number
  median_cycle_days: number | null
  cycle_per_stage: { stage_code: string; stage_name: string; median_days: number | null }[]
  first_pass_reviewed: number
  first_pass_approval_rate: number | null
  rejection_reasons: { reason: string; count: number }[]
  revenue_service_minor: number
  revenue_government_minor: number
  sla_tasks: number
  sla_breach_rate: number | null
  subscription_conversions: number
  daily_series: {
    date: string
    cases_created: number
    cases_completed: number
    revenue_service_minor: number
    revenue_government_minor: number
  }[]
}

export async function fetchReportKpis(dateFrom: string, dateTo: string) {
  const { data } = await apiClient.get<ReportKpis>("/reports/kpis", {
    params: { date_from: dateFrom, date_to: dateTo },
  })
  return data
}

export type OfficerWorkload = {
  officer_id: string
  officer_name: string
  open_cases: number
  open_tasks: number
  breached_tasks: number
  breach_rate: number
}

export async function fetchOfficerWorkload() {
  const { data } = await apiClient.get<OfficerWorkload[]>("/admin/officer-workload")
  return data
}

export async function downloadReportCsv(report: string, dateFrom: string, dateTo: string) {
  // Auth header comes from the apiClient interceptor, so fetch as a blob and
  // hand the browser an object URL rather than window.open-ing a raw link.
  const { data } = await apiClient.get(`/reports/export/${report}.csv`, {
    params: { date_from: dateFrom, date_to: dateTo },
    responseType: "blob",
  })
  const url = URL.createObjectURL(data as Blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${report}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export type FinancePayment = {
  id: string
  invoice_id: string
  provider: string
  channel: string
  amount_minor: number
  currency: string
  status: string
  is_manual_credit: boolean
  note: string | null
  paid_at: string | null
  created_at: string
}

export async function listFinancePayments() {
  const { data } = await apiClient.get<FinancePayment[]>("/payments/finance/payments")
  return data
}
