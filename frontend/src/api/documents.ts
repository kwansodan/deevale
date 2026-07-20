import axios from "axios"

import { apiClient } from "@/api/client"

export type DocumentVersion = {
  id: string
  version_number: number
  original_filename: string
  content_type: string
  size_bytes: number | null
  upload_status: string
  review_status: "pending_review" | "approved" | "rejected"
  review_reason_code: string | null
  review_note: string | null
  reviewed_at: string | null
  virus_scan_status: string
  uploaded_at: string | null
  created_at: string
}

export type CaseDocument = {
  id: string
  business_case_id: string
  case_task_id: string | null
  document_type_code: string
  uploaded_by_user_id: string
  is_vault: boolean
  current_version_number: number
  created_at: string
  versions: DocumentVersion[]
}

export type UploadSlot = {
  document_id: string
  version_id: string
  version_number: number
  upload_url: string
  s3_key: string
}

export async function listCaseDocuments(caseId: string) {
  const { data } = await apiClient.get<CaseDocument[]>(`/documents/cases/${caseId}`)
  return data
}

export async function requestUploadSlot(params: {
  business_case_id: string
  document_type_code: string
  original_filename: string
  content_type: string
  size_bytes: number
  case_task_id?: string
  document_id?: string
}) {
  const { data } = await apiClient.post<UploadSlot>("/documents/upload-slot", params)
  return data
}

export async function confirmUpload(documentId: string, versionNumber: number) {
  const { data } = await apiClient.post<CaseDocument>(
    `/documents/${documentId}/versions/${versionNumber}/confirm`
  )
  return data
}

export async function getDownloadUrl(documentId: string) {
  const { data } = await apiClient.get<{ download_url: string; expires_in: number }>(
    `/documents/${documentId}/download-url`
  )
  return data
}

/** Full presigned-URL upload flow: slot -> direct PUT to storage -> confirm. */
export async function uploadDocument(params: {
  business_case_id: string
  document_type_code: string
  file: File
  case_task_id?: string
  document_id?: string
}) {
  const slot = await requestUploadSlot({
    business_case_id: params.business_case_id,
    document_type_code: params.document_type_code,
    original_filename: params.file.name,
    content_type: params.file.type,
    size_bytes: params.file.size,
    case_task_id: params.case_task_id,
    document_id: params.document_id,
  })
  // Direct-to-storage PUT -- deliberately not apiClient (no auth header; the
  // presigned URL itself is the credential).
  await axios.put(slot.upload_url, params.file, { headers: { "Content-Type": params.file.type } })
  return confirmUpload(slot.document_id, slot.version_number)
}

export const ACCEPTED_FILE_TYPES = "application/pdf,image/jpeg,image/png"
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

export function validateFile(file: File): string | null {
  if (!ACCEPTED_FILE_TYPES.split(",").includes(file.type)) {
    return "Only PDF, JPG, and PNG files are accepted."
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Files must be 10 MB or smaller."
  }
  return null
}
