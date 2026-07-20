import axios from "axios"

import { apiClient } from "@/api/client"

export type Disclaimer = {
  office_address: string
  disclaimer: string
  subscription_required: boolean
  enrolled: boolean
}

export type MailItem = {
  id: string
  business_case_id: string
  client_id: string
  sender: string
  subject: string | null
  received_date: string
  urgency: "normal" | "urgent"
  status: "logged" | "scanned" | "shredded"
  read_at: string | null
  shred_after: string | null
  created_at: string
  has_scan: boolean
}

export type ForwardRequest = {
  id: string
  mail_item_id: string
  forwarding_address: string
  status: "new" | "in_progress" | "done"
  created_at: string
}

export async function getDisclaimer(businessCaseId: string) {
  const { data } = await apiClient.get<Disclaimer>("/mailroom/disclaimer", {
    params: { business_case_id: businessCaseId },
  })
  return data
}

export async function enroll(businessCaseId: string) {
  const { data } = await apiClient.post("/mailroom/enroll", {
    business_case_id: businessCaseId,
    consent: true,
  })
  return data
}

export async function listMail(businessCaseId?: string) {
  const { data } = await apiClient.get<MailItem[]>("/mailroom/mail", {
    params: businessCaseId ? { business_case_id: businessCaseId } : {},
  })
  return data
}

export async function getMailDownloadUrl(mailId: string) {
  const { data } = await apiClient.get<{ download_url: string; expires_in: number }>(
    `/mailroom/mail/${mailId}/download-url`
  )
  return data
}

export async function requestForward(mailId: string, forwardingAddress: string) {
  const { data } = await apiClient.post(`/mailroom/mail/${mailId}/forward`, {
    forwarding_address: forwardingAddress,
  })
  return data
}

export async function logMail(params: {
  business_case_id: string
  sender: string
  subject?: string
  received_date: string
  urgency: "normal" | "urgent"
}) {
  const { data } = await apiClient.post<MailItem>("/mailroom/mail", params)
  return data
}

/** Scan-upload flow: request slot -> PUT the multi-page PDF -> confirm. */
export async function uploadMailScan(mailId: string, file: File) {
  const { data: slot } = await apiClient.post<{ upload_url: string; s3_key: string }>(
    `/mailroom/mail/${mailId}/scan-slot`,
    { original_filename: file.name, content_type: file.type, size_bytes: file.size }
  )
  await axios.put(slot.upload_url, file, { headers: { "Content-Type": file.type } })
  const { data } = await apiClient.post<MailItem>(`/mailroom/mail/${mailId}/scan-confirm`)
  return data
}

export async function listForwardRequests() {
  const { data } = await apiClient.get<ForwardRequest[]>("/mailroom/forward-requests")
  return data
}

export async function transitionForwardRequest(id: string, status: "in_progress" | "done") {
  const { data } = await apiClient.post<ForwardRequest>(
    `/mailroom/forward-requests/${id}/transition`,
    { status }
  )
  return data
}
