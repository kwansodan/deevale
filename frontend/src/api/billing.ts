import { apiClient } from "@/api/client"

/** An invoice the platform has issued the customer (registration fees, etc.).
 *  Mirrors the backend InvoiceSchema. */
export type PlatformInvoiceLineItem = {
  id: string
  label: string
  amount_minor: number
  fee_type: string
}

export type PlatformInvoice = {
  id: string
  business_case_id: string
  invoice_number: string
  status: "draft" | "sent" | "paid" | "overdue" | string
  subtotal_government_minor: number
  subtotal_service_minor: number
  total_minor: number
  currency: string
  receipt_s3_key: string | null
  sent_at: string | null
  paid_at: string | null
  line_items: PlatformInvoiceLineItem[]
}

export type Subscription = {
  id: string
  plan: "monthly" | "annual" | string
  status: string
  current_period_end: string | null
  created_at: string
}

export type SubscriptionStatus = {
  active: boolean
  subscription: Subscription | null
  monthly_price_minor: number
  annual_price_minor: number
}

/** All invoices across the signed-in user's cases, newest first. */
export async function listMyInvoices() {
  const { data } = await apiClient.get<PlatformInvoice[]>("/payments/invoices")
  return data
}

/** Reconcile a payment on return from Paystack (idempotent with the webhook).
 *  Returns "paid" | "pending" | "failed". */
export async function verifyPayment(reference: string) {
  const { data } = await apiClient.post<{ status: string }>("/payments/verify", { reference })
  return data
}

/** Presigned URL to download a paid invoice's receipt PDF. */
export async function getReceiptUrl(invoiceId: string) {
  const { data } = await apiClient.get<{ download_url: string; expires_in: number }>(
    `/payments/invoices/${invoiceId}/receipt-url`
  )
  return data
}

export async function getSubscription() {
  const { data } = await apiClient.get<SubscriptionStatus>("/billing/subscription")
  return data
}

/** Starts a Paystack checkout for a compliance subscription; returns the URL to
 *  redirect to. Activation happens later via the charge.success webhook. */
export async function subscribe(plan: "monthly" | "annual", callbackUrl: string) {
  const { data } = await apiClient.post<{ authorization_url: string; reference: string }>(
    "/billing/subscribe",
    { plan },
    { params: { callback_url: callbackUrl } }
  )
  return data
}
