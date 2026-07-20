import { apiClient } from "@/api/client"

export type SignatureParty = {
  id: string
  name: string
  email: string
  order_index: number
  status: "pending" | "signed" | "declined"
  sign_token: string
  signature_type: string | null
  signed_at: string | null
}

export type SignatureRequest = {
  id: string
  business_case_id: string
  case_task_id: string | null
  title: string
  provider: string
  status: "draft" | "sent" | "completed" | "declined"
  sent_at: string | null
  completed_at: string | null
  parties: SignatureParty[]
}

export type SigningView = {
  title: string
  merged_html: string
  party_name: string
  status: string
  can_sign: boolean
  already_signed: boolean
}

export async function listCaseSignatureRequests(caseId: string) {
  const { data } = await apiClient.get<SignatureRequest[]>(`/signatures/cases/${caseId}/requests`)
  return data
}

export async function createSignatureRequest(params: {
  business_case_id: string
  case_task_id?: string
  title: string
  body_html?: string
  template_id?: string
  merge_values?: Record<string, string>
  parties: { name: string; email: string }[]
}) {
  const { data } = await apiClient.post<SignatureRequest>("/signatures/requests", params)
  return data
}

export async function sendSignatureRequest(id: string) {
  const { data } = await apiClient.post<SignatureRequest>(`/signatures/requests/${id}/send`)
  return data
}

// Public (no auth) signing endpoints.
export async function getSigningView(token: string) {
  const { data } = await apiClient.get<SigningView>(`/signatures/sign/${token}`)
  return data
}

export async function submitSignature(
  token: string,
  signatureType: "drawn" | "typed",
  signatureData: string
) {
  const { data } = await apiClient.post<SigningView>(`/signatures/sign/${token}`, {
    signature_type: signatureType,
    signature_data: signatureData,
  })
  return data
}
