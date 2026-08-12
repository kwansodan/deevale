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

// ISIC Rev.4 classification (UN standard) attached to each curated sector: the
// section letter plus the division/group code and its official title. The
// curated list stays authoritative for the wizard's GIPC gating (see `reserved`
// / `trading`); ISIC is carried alongside so staff filings reference a standard
// code. There is no free official ISIC API -- Rev.4 is a fixed published table,
// so it is mapped statically here.
export type IsicClass = {
  section: string
  code: string
  label: string
}

export type Sector = {
  value: string
  label: string
  reserved: boolean
  // Trading enterprises with foreign participation retain a minimum-capital
  // requirement under Ghana's investment law -- flagged with an interstitial.
  trading?: boolean
  isic: IsicClass
}

// `reserved: true` sectors are reserved for Ghanaian citizens under the GIPC
// Act -- foreign participation is blocked in the wizard with an explanation.
export const SECTORS: Sector[] = [
  { value: "it_services", label: "IT & Software Services", reserved: false, isic: { section: "J", code: "62", label: "Computer programming, consultancy and related activities" } },
  { value: "consulting", label: "Consulting & Professional Services", reserved: false, isic: { section: "M", code: "70", label: "Activities of head offices; management consultancy" } },
  { value: "manufacturing", label: "Manufacturing", reserved: false, isic: { section: "C", code: "10-33", label: "Manufacturing" } },
  { value: "agriculture", label: "Agriculture & Agribusiness", reserved: false, isic: { section: "A", code: "01", label: "Crop and animal production, hunting and related service activities" } },
  { value: "construction", label: "Construction & Real Estate", reserved: false, isic: { section: "F", code: "41", label: "Construction of buildings" } },
  { value: "hospitality", label: "Hospitality & Tourism", reserved: false, isic: { section: "I", code: "55", label: "Accommodation" } },
  { value: "import_export", label: "Import / Export & Trading", reserved: false, trading: true, isic: { section: "G", code: "46", label: "Wholesale trade, except of motor vehicles and motorcycles" } },
  { value: "logistics", label: "Logistics & Transport", reserved: false, isic: { section: "H", code: "49-53", label: "Transportation and storage" } },
  { value: "education", label: "Education & Training", reserved: false, isic: { section: "P", code: "85", label: "Education" } },
  { value: "healthcare", label: "Healthcare Services", reserved: false, isic: { section: "Q", code: "86", label: "Human health activities" } },
  { value: "media", label: "Media & Creative Arts", reserved: false, isic: { section: "J", code: "59-60", label: "Motion picture, video, television and broadcasting" } },
  { value: "finance", label: "Financial Services", reserved: false, isic: { section: "K", code: "64", label: "Financial service activities, except insurance and pension funding" } },
  { value: "petty_trading", label: "Petty Trading", reserved: true, isic: { section: "G", code: "47", label: "Retail trade, except of motor vehicles and motorcycles" } },
  { value: "taxi_service", label: "Taxi / Small Transport Fleet", reserved: true, isic: { section: "H", code: "49", label: "Land transport and transport via pipelines" } },
  { value: "beauty_salon", label: "Beauty Salon & Barbering", reserved: true, isic: { section: "S", code: "96", label: "Other personal service activities" } },
  { value: "retail_pharmacy", label: "Retail Pharmacy", reserved: true, isic: { section: "G", code: "47", label: "Retail trade, except of motor vehicles and motorcycles" } },
  { value: "small_scale_mining", label: "Small-Scale Mining", reserved: true, isic: { section: "B", code: "07-08", label: "Mining of metal ores; other mining and quarrying" } },
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

// ISO 3166-1 country names, used for the passport issuing-country picker. Names
// (not codes) are stored on the payload so staff read them directly on filings.
export const COUNTRIES: string[] = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda",
  "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
  "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada",
  "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
  "Congo (Brazzaville)", "Congo (Kinshasa)", "Costa Rica", "Côte d'Ivoire", "Croatia",
  "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia",
  "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia",
  "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau",
  "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran",
  "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan",
  "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
  "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands",
  "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia",
  "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal",
  "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea",
  "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama",
  "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
  "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
  "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe",
  "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
  "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea",
  "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
  "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo",
  "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
  "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen",
  "Zambia", "Zimbabwe",
]

export const WIZARD_STEPS = [
  "About you",
  "Your business",
  "Ownership",
  "Recommendation",
  "Quote",
  "Review & pay",
] as const
