import axios from "axios"

import { apiClient } from "@/api/client"

export type BusinessProfile = {
  id: string | null
  business_case_id: string
  display_name: string
  address: string | null
  default_currency: string
  is_vat_registered: boolean
  vat_rate_bps: number
  vat_number: string | null
}

export type LineItem = {
  description: string
  quantity_milli: number
  unit_price_minor: number
  amount_minor?: number
}

export type ClientInvoice = {
  id: string
  invoice_number: string
  business_case_id: string
  customer_name: string
  customer_email: string | null
  currency: string
  status: "draft" | "sent" | "paid" | "overdue"
  issue_date: string
  due_date: string | null
  notes: string | null
  vat_rate_bps: number
  subtotal_minor: number
  vat_minor: number
  total_minor: number
  share_token: string | null
  line_items: LineItem[]
}

export type Expense = {
  id: string
  description: string
  category: string
  currency: string
  amount_minor: number
  expense_date: string
  note: string | null
  has_receipt: boolean
  created_at: string
}

export type MonthlyReport = {
  year: number
  currencies: string[]
  months: { month: number; income_minor: number; expense_minor: number; vat_collected_minor: number }[]
  total_income_minor: number
  total_expense_minor: number
  total_vat_collected_minor: number
}

export async function getCategories() {
  const { data } = await apiClient.get<{ code: string; label: string }[]>("/bookkeeping/categories")
  return data
}

export async function getProfile(caseId: string) {
  const { data } = await apiClient.get<BusinessProfile>(`/bookkeeping/cases/${caseId}/profile`)
  return data
}

export async function saveProfile(caseId: string, profile: Partial<BusinessProfile>) {
  const { data } = await apiClient.put<BusinessProfile>(`/bookkeeping/cases/${caseId}/profile`, profile)
  return data
}

export async function listInvoices(caseId: string) {
  const { data } = await apiClient.get<ClientInvoice[]>(`/bookkeeping/cases/${caseId}/invoices`)
  return data
}

export async function createInvoice(caseId: string, invoice: Partial<ClientInvoice>) {
  const { data } = await apiClient.post<ClientInvoice>(`/bookkeeping/cases/${caseId}/invoices`, invoice)
  return data
}

export async function sendInvoice(id: string) {
  const { data } = await apiClient.post<ClientInvoice>(`/bookkeeping/invoices/${id}/send`)
  return data
}

export async function markInvoicePaid(id: string) {
  const { data } = await apiClient.post<ClientInvoice>(`/bookkeeping/invoices/${id}/mark-paid`)
  return data
}

export async function listExpenses(caseId: string) {
  const { data } = await apiClient.get<Expense[]>(`/bookkeeping/cases/${caseId}/expenses`)
  return data
}

export async function createExpense(caseId: string, expense: Partial<Expense>) {
  const { data } = await apiClient.post<Expense>(`/bookkeeping/cases/${caseId}/expenses`, expense)
  return data
}

export async function uploadExpenseReceipt(expenseId: string, file: File) {
  const { data: slot } = await apiClient.post<{ upload_url: string }>(
    `/bookkeeping/expenses/${expenseId}/receipt-slot`,
    { original_filename: file.name, content_type: file.type, size_bytes: file.size }
  )
  await axios.put(slot.upload_url, file, { headers: { "Content-Type": file.type } })
}

export async function getReport(caseId: string, year: number) {
  const { data } = await apiClient.get<MonthlyReport>(`/bookkeeping/cases/${caseId}/report`, {
    params: { year },
  })
  return data
}

export async function getPublicInvoice(token: string) {
  const { data } = await apiClient.get(`/bookkeeping/invoices/shared/${token}`)
  return data
}

export async function downloadBookkeepingCsv(caseId: string) {
  const { data } = await apiClient.get(`/bookkeeping/cases/${caseId}/export.csv`, { responseType: "blob" })
  const url = URL.createObjectURL(data as Blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "bookkeeping.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export function formatMoney(currency: string, minor: number): string {
  return `${currency} ${(minor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`
}
