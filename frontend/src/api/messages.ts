import { apiClient } from "@/api/client"

export type CaseMessage = {
  id: string
  business_case_id: string
  sender_user_id: string
  body: string
  attachment_document_id: string | null
  client_read_at: string | null
  officer_read_at: string | null
  created_at: string
}

export async function listCaseMessages(caseId: string) {
  const { data } = await apiClient.get<CaseMessage[]>(`/cases/${caseId}/messages`)
  return data
}

export async function sendCaseMessage(caseId: string, body: string) {
  const { data } = await apiClient.post<CaseMessage>(`/cases/${caseId}/messages`, { body })
  return data
}

export async function markCaseMessagesRead(caseId: string) {
  const { data } = await apiClient.post<CaseMessage[]>(`/cases/${caseId}/messages/read`)
  return data
}
