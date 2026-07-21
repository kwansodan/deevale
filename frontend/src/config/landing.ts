/**
 * Every public-facing figure on the landing page comes from build-time env
 * vars so prices, credentials and statutory thresholds can change without a
 * code commit.
 *
 * Two rules this module enforces:
 *
 * 1. Reads are STATIC (`import.meta.env.VITE_X`), never dynamic lookups, so
 *    Vite's build-time replacement is guaranteed to fire.
 * 2. An unset var resolves to `null`, never to an invented default. Callers
 *    fall back to "Request a quote" or hide the section entirely. Shipping a
 *    placeholder price to a public page misleads customers who budget off it,
 *    so a missing figure must degrade visibly, not silently.
 *
 * These are all `VITE_`-prefixed and therefore PUBLIC — readable by anyone who
 * opens devtools. Never put a secret here.
 */

function str(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function num(value: string | undefined): number | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/** Who we are — the trust signals a buyer checks before sending money. */
export const company = {
  legalName: str(import.meta.env.VITE_COMPANY_LEGAL_NAME),
  registrationNumber: str(import.meta.env.VITE_COMPANY_REG_NUMBER),
  address: str(import.meta.env.VITE_COMPANY_ADDRESS),
  email: str(import.meta.env.VITE_COMPANY_EMAIL),
  phone: str(import.meta.env.VITE_COMPANY_PHONE),
  whatsapp: str(import.meta.env.VITE_COMPANY_WHATSAPP),
  yearsOperating: num(import.meta.env.VITE_YEARS_OPERATING),
  casesCompleted: num(import.meta.env.VITE_CASES_COMPLETED),
  dataProtectionNumber: str(import.meta.env.VITE_DPC_REGISTRATION_NUMBER),
}

export type EntityOffer = {
  key: string
  name: string
  blurb: string
  /** All-in indicative price, government fees included. */
  price: string | null
  timeline: string | null
  /** Shown on the foreign-investor path rather than the local one. */
  foreignTrack: boolean
}

/**
 * Entity types mirror app/workflow/workflow_library.py. Copy lives here;
 * only the figures come from env.
 */
export const entities: EntityOffer[] = [
  {
    key: "ltd_shares",
    name: "Company Limited by Shares",
    blurb: "The standard private company for a trading or services business.",
    price: str(import.meta.env.VITE_PRICE_LTD_SHARES),
    timeline: str(import.meta.env.VITE_TIMELINE_LTD_SHARES),
    foreignTrack: false,
  },
  {
    key: "sole_proprietorship",
    name: "Sole Proprietorship",
    blurb: "Fastest and cheapest, but no separation between you and the business.",
    price: str(import.meta.env.VITE_PRICE_SOLE_PROP),
    timeline: str(import.meta.env.VITE_TIMELINE_SOLE_PROP),
    foreignTrack: false,
  },
  {
    key: "partnership",
    name: "Partnership",
    blurb: "Two or more partners under a registered partnership agreement.",
    price: str(import.meta.env.VITE_PRICE_PARTNERSHIP),
    timeline: str(import.meta.env.VITE_TIMELINE_PARTNERSHIP),
    foreignTrack: false,
  },
  {
    key: "ltd_guarantee",
    name: "Company Limited by Guarantee",
    blurb: "For NGOs, foundations and associations that do not distribute profit.",
    price: str(import.meta.env.VITE_PRICE_LTD_GUARANTEE),
    timeline: str(import.meta.env.VITE_TIMELINE_LTD_GUARANTEE),
    foreignTrack: false,
  },
  {
    key: "external_company",
    name: "External Company (Branch)",
    blurb: "Your existing overseas company, registered as a branch in Ghana.",
    price: str(import.meta.env.VITE_PRICE_EXTERNAL_COMPANY),
    timeline: str(import.meta.env.VITE_TIMELINE_EXTERNAL_COMPANY),
    foreignTrack: true,
  },
  {
    key: "foreign_ltd_shares",
    name: "Foreign-Owned Company + GIPC",
    blurb: "A Ghanaian company with foreign shareholders, registered with the GIPC.",
    price: str(import.meta.env.VITE_PRICE_FOREIGN_LTD),
    timeline: str(import.meta.env.VITE_TIMELINE_FOREIGN_LTD),
    foreignTrack: true,
  },
]

/**
 * GIPC minimum equity thresholds. These are set by statute and change by
 * amendment — they are env-driven so they can be corrected without a deploy
 * of new code, and they render as "confirm with us" when unset rather than
 * risking a wrong figure a client budgets against.
 */
export const gipc = {
  jointVenture: str(import.meta.env.VITE_GIPC_CAPITAL_JOINT_VENTURE),
  whollyForeign: str(import.meta.env.VITE_GIPC_CAPITAL_WHOLLY_FOREIGN),
  trading: str(import.meta.env.VITE_GIPC_CAPITAL_TRADING),
  registrationFee: str(import.meta.env.VITE_GIPC_FEE),
}

export const compliance = {
  monthlyPrice: str(import.meta.env.VITE_PRICE_COMPLIANCE_MONTHLY),
  annualPrice: str(import.meta.env.VITE_PRICE_COMPLIANCE_ANNUAL),
  registeredAddressPrice: str(import.meta.env.VITE_PRICE_REGISTERED_ADDRESS),
}

export type StageState = "done" | "active" | "upcoming"
export type TrackerStage = { name: string; sla: string; state: StageState }

/**
 * The stage sequences shown in the hero device. These mirror the real workflows
 * in app/workflow/seed_workflow_company_ltd.py and workflow_library.py, names
 * and SLAs included — it is an illustrative case, not a mock-up of something
 * the product does not do.
 */
export const trackerStages: Record<"local" | "foreign", TrackerStage[]> = {
  local: [
    { name: "Name Reservation", sla: "72h", state: "done" },
    { name: "Incorporation", sla: "120h", state: "done" },
    { name: "Tax Registration", sla: "72h", state: "active" },
    { name: "SSNIT Registration", sla: "72h", state: "upcoming" },
    { name: "Business Operating Permit", sla: "120h", state: "upcoming" },
  ],
  foreign: [
    { name: "Home-Country Documents", sla: "—", state: "done" },
    { name: "Name Reservation", sla: "72h", state: "done" },
    { name: "Incorporation", sla: "120h", state: "active" },
    { name: "GIPC Registration", sla: "240h", state: "upcoming" },
    { name: "Tax Registration", sla: "72h", state: "upcoming" },
  ],
}

/**
 * Figures below the hero. Every one is a fact derivable from the workflow
 * library rather than a marketing claim, so none of them can be wrong.
 * Claim-shaped numbers (registrations completed, years operating) stay in
 * `company` above and hide when unset.
 */
export const figures = [
  { value: "5", label: "stages, tracked end to end" },
  { value: "4", label: "agencies handled for you" },
  { value: "72h", label: "target on name reservation" },
]

export const legal = {
  termsUrl: str(import.meta.env.VITE_TERMS_URL),
  privacyUrl: str(import.meta.env.VITE_PRIVACY_URL),
  refundUrl: str(import.meta.env.VITE_REFUND_URL),
}

/** True when enough is configured to show the credibility strip at all. */
export const hasTrustSignals = Boolean(
  company.registrationNumber || company.yearsOperating || company.casesCompleted
)
