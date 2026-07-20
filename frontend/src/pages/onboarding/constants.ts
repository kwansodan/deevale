export const GHANA_REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Western North",
  "Central",
  "Eastern",
  "Volta",
  "Oti",
  "Northern",
  "Savannah",
  "North East",
  "Upper East",
  "Upper West",
  "Bono",
  "Bono East",
  "Ahafo",
] as const

export type Sector = {
  value: string
  label: string
  reserved: boolean
  // Trading enterprises with foreign participation retain a minimum-capital
  // requirement under Ghana's investment law -- flagged with an interstitial.
  trading?: boolean
}

// `reserved: true` sectors are reserved for Ghanaian citizens under the GIPC
// Act -- foreign participation is blocked in the wizard with an explanation.
export const SECTORS: Sector[] = [
  { value: "it_services", label: "IT & Software Services", reserved: false },
  { value: "consulting", label: "Consulting & Professional Services", reserved: false },
  { value: "manufacturing", label: "Manufacturing", reserved: false },
  { value: "agriculture", label: "Agriculture & Agribusiness", reserved: false },
  { value: "construction", label: "Construction & Real Estate", reserved: false },
  { value: "hospitality", label: "Hospitality & Tourism", reserved: false },
  { value: "import_export", label: "Import / Export & Trading", reserved: false, trading: true },
  { value: "logistics", label: "Logistics & Transport", reserved: false },
  { value: "education", label: "Education & Training", reserved: false },
  { value: "healthcare", label: "Healthcare Services", reserved: false },
  { value: "media", label: "Media & Creative Arts", reserved: false },
  { value: "finance", label: "Financial Services", reserved: false },
  { value: "petty_trading", label: "Petty Trading", reserved: true },
  { value: "taxi_service", label: "Taxi / Small Transport Fleet", reserved: true },
  { value: "beauty_salon", label: "Beauty Salon & Barbering", reserved: true },
  { value: "retail_pharmacy", label: "Retail Pharmacy", reserved: true },
  { value: "small_scale_mining", label: "Small-Scale Mining", reserved: true },
]

export const OWNER_ROLES = [
  { value: "director", label: "Director" },
  { value: "shareholder", label: "Shareholder" },
  { value: "director_shareholder", label: "Director & Shareholder" },
] as const

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  company_limited_by_shares: "Company Limited by Shares",
  sole_proprietorship: "Sole Proprietorship",
  partnership: "Incorporated Private Partnership",
  company_limited_by_guarantee: "Company Limited by Guarantee (NGO)",
  external_company: "External Company (Foreign Branch)",
}

export const WIZARD_STEPS = [
  "About you",
  "Your business",
  "Ownership",
  "Recommendation",
  "Quote",
  "Review & pay",
] as const
