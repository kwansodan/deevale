import { apiClient } from "@/api/client"

export type ReferralCredit = {
  id: string
  amount_minor: number
  currency: string
  source: string
  status: string
  created_at: string
}

export type ReferralMe = {
  code: string
  share_url: string
  available_balance_minor: number
  currency: string
  credits: ReferralCredit[]
}

export type CoFounderInvite = {
  id: string
  business_case_id: string
  invitee_name: string
  invitee_email: string
  role: string
  status: string
  created_at: string
}

export type PublicInvite = {
  invitee_name: string
  inviter_name: string
  business_name: string
  role: string
  status: string
}

export async function getReferralMe() {
  const { data } = await apiClient.get<ReferralMe>("/referrals/me")
  return data
}

export async function listCoFounderInvites(caseId: string) {
  const { data } = await apiClient.get<CoFounderInvite[]>(`/referrals/cases/${caseId}/cofounder-invites`)
  return data
}

export async function inviteCoFounder(caseId: string, invitee: { invitee_name: string; invitee_email: string; role: string }) {
  const { data } = await apiClient.post<CoFounderInvite>(
    `/referrals/cases/${caseId}/cofounder-invites`,
    invitee
  )
  return data
}

export async function getPublicInvite(token: string) {
  const { data } = await apiClient.get<PublicInvite>(`/referrals/cofounder-invite/${token}`)
  return data
}

export async function acceptCoFounderInvite(token: string) {
  const { data } = await apiClient.post(`/referrals/cofounder-invite/${token}/accept`)
  return data
}
