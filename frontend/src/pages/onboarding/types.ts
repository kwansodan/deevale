export type OwnerEntry = {
  full_name: string
  role: string
  nationality: "ghanaian" | "foreign"
  // Foreign parties need a non-citizen TIN issued against their passport --
  // collected here so staff can file it without a follow-up round-trip.
  passport_number?: string
  passport_country?: string
}

export type WizardData = {
  // Step 1 — About you
  nationality: "ghanaian" | "foreign" | ""
  residency: "resident" | "non_resident" | ""
  id_type: "ghana_card" | "passport" | ""
  id_number: string
  // Step 2 — Your business
  venture_type: "for_profit" | "ngo" | "branch" | ""
  business_name: string
  sector: string
  planned_employees: number
  region: string
  // Step 3 — Ownership
  owners: OwnerEntry[]
  // Step 4 — Recommendation
  entity_type: string
}

export const EMPTY_WIZARD_DATA: WizardData = {
  nationality: "",
  residency: "",
  id_type: "",
  id_number: "",
  venture_type: "",
  business_name: "",
  sector: "",
  planned_employees: 0,
  region: "",
  owners: [],
  entity_type: "company_limited_by_shares",
}

export function hasForeignParticipation(data: WizardData): boolean {
  return data.nationality === "foreign" || data.owners.some((o) => o.nationality === "foreign")
}
