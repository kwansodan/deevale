/**
 * The public landing figures used to be baked into the bundle from build-time
 * `VITE_` env vars. They now come from the API at runtime
 * (`GET /public/landing-config`), so a platform admin can change prices,
 * statutory thresholds and trust signals from the ops console without a redeploy.
 *
 * Only the *figures* moved to the API. The static copy below (entity names,
 * blurbs, the illustrative tracker stages, the derived hero figures) stays in
 * code because it is product description, not configuration.
 *
 * The honesty rule is unchanged: an unset figure resolves to `null` and the
 * caller renders "Request a quote" / hides the section, never an invented value.
 */
import { useQuery } from "@tanstack/react-query"

import { getLandingConfig, type EntityKey, type LandingConfig } from "@/api/public"

export type EntityOffer = {
  key: EntityKey
  name: string
  blurb: string
  /** All-in indicative price as a numeric amount in the config base currency
   *  (converted for display). From the API; null when unset. */
  price: number | null
  timeline: string | null
  /** Shown on the foreign-investor path rather than the local one. */
  foreignTrack: boolean
}

/** Static entity metadata; prices/timelines are merged in from the API. */
const ENTITY_META: Omit<EntityOffer, "price" | "timeline">[] = [
  {
    key: "ltd_shares",
    name: "Company Limited by Shares",
    blurb: "The standard private company for a trading or services business.",
    foreignTrack: false,
  },
  {
    key: "sole_proprietorship",
    name: "Sole Proprietorship",
    blurb: "Fastest and cheapest, but no separation between you and the business.",
    foreignTrack: false,
  },
  {
    key: "partnership",
    name: "Partnership",
    blurb: "Two or more partners under a registered partnership agreement.",
    foreignTrack: false,
  },
  {
    key: "ltd_guarantee",
    name: "Company Limited by Guarantee",
    blurb: "For NGOs, foundations and associations that do not distribute profit.",
    foreignTrack: false,
  },
  {
    key: "external_company",
    name: "External Company (Branch)",
    blurb: "Your existing overseas company, registered as a branch in Ghana.",
    foreignTrack: true,
  },
  {
    key: "foreign_ltd_shares",
    name: "Foreign-Owned Company + GIPC",
    blurb: "A Ghanaian company with foreign shareholders, registered with the GIPC.",
    foreignTrack: true,
  },
]

const EMPTY_CONFIG: LandingConfig = {
  pricing: { base_currency: "GHS" },
  company: {
    legalName: null,
    registrationNumber: null,
    address: null,
    email: null,
    phone: null,
    whatsapp: null,
    yearsOperating: null,
    casesCompleted: null,
    dataProtectionNumber: null,
    chatwootWebsiteToken: null,
    chatwootBaseUrl: null,
  },
  prices: {
    ltd_shares: null,
    sole_proprietorship: null,
    partnership: null,
    ltd_guarantee: null,
    external_company: null,
    foreign_ltd_shares: null,
  },
  timelines: {
    ltd_shares: null,
    sole_proprietorship: null,
    partnership: null,
    ltd_guarantee: null,
    external_company: null,
    foreign_ltd_shares: null,
  },
  gipc: { jointVenture: null, whollyForeign: null, trading: null, registrationFee: null },
  compliance: { monthlyPrice: null, annualPrice: null, registeredAddressPrice: null },
  legal: { termsUrl: null, privacyUrl: null, refundUrl: null },
  testimonials: [],
  logos: [],
  rating: { score: null, count: null, source: null },
}

/**
 * Fetches the runtime landing figures and assembles the shape the page consumes.
 * While loading (or if the request fails) it returns the empty config, so the
 * page renders honest fallbacks rather than blanking.
 */
export function useLandingConfig() {
  const { data } = useQuery({
    queryKey: ["landing-config"],
    queryFn: getLandingConfig,
    staleTime: 5 * 60_000,
  })
  const config = data ?? EMPTY_CONFIG

  // Coerce to a finite number; anything else (unset, or a legacy free-text
  // value from before prices were numeric) becomes null -> "Request a quote".
  const num = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) && v !== null && v !== "" ? n : null
  }

  const entities: EntityOffer[] = ENTITY_META.map((meta) => ({
    ...meta,
    price: num(config.prices[meta.key]),
    timeline: config.timelines[meta.key],
  }))

  const hasTrustSignals = Boolean(
    config.company.registrationNumber ||
      config.company.yearsOperating ||
      config.company.casesCompleted
  )

  // Social-proof presence flags. A section renders only when it has real,
  // admin-entered content -- never a fabricated placeholder. Guard the arrays
  // in case an older stored blob predates these keys.
  const testimonials = (config.testimonials ?? []).filter((t) => t?.quote && t?.name)
  const logos = (config.logos ?? []).filter((l) => l?.name || l?.imageUrl)
  const rating = config.rating ?? { score: null, count: null, source: null }
  const hasRating = Boolean(rating.score)

  return {
    company: config.company,
    entities,
    baseCurrency: config.pricing?.base_currency || "GHS",
    gipc: config.gipc,
    compliance: {
      monthlyPrice: num(config.compliance.monthlyPrice),
      annualPrice: num(config.compliance.annualPrice),
      registeredAddressPrice: num(config.compliance.registeredAddressPrice),
    },
    legal: config.legal,
    hasTrustSignals,
    testimonials,
    logos,
    rating,
    hasTestimonials: testimonials.length > 0,
    hasLogos: logos.length > 0,
    hasRating,
  }
}

export type StageState = "done" | "active" | "upcoming"
export type TrackerStage = { name: string; sla: string; state: StageState }

/**
 * The stage sequences shown in the hero device. These mirror the real workflows
 * in app/workflow/seed_workflow_company_ltd.py and workflow_library.py, names
 * and SLAs included - it is an illustrative case, not a mock-up of something
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
    { name: "Home-Country Documents", sla: "-", state: "done" },
    { name: "Name Reservation", sla: "72h", state: "done" },
    { name: "Incorporation", sla: "120h", state: "active" },
    { name: "GIPC Registration", sla: "240h", state: "upcoming" },
    { name: "Tax Registration", sla: "72h", state: "upcoming" },
  ],
}

/**
 * Figures below the hero. Every one is a fact derivable from the workflow
 * library rather than a marketing claim, so none of them can be wrong.
 */
export const figures = [
  { value: "5", label: "stages, tracked end to end" },
  { value: "4", label: "agencies handled for you" },
  { value: "72h", label: "target on name reservation" },
]
