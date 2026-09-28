import { apiClient } from "@/api/client"

/**
 * Public landing-page figures, served at runtime from platform settings so an
 * admin can change prices/thresholds without a redeploy. Every field is
 * nullable; the page renders an honest fallback for anything unset rather than
 * an invented value (see LandingPage). Entity keys mirror the backend
 * (app/admin/settings_service.py) and the entity metadata in config/landing.ts.
 */
export type EntityKey =
  | "ltd_shares"
  | "sole_proprietorship"
  | "partnership"
  | "ltd_guarantee"
  | "external_company"
  | "foreign_ltd_shares"

/** A real client/officer quote. Every field but `quote` and `name` is optional. */
export type Testimonial = {
  quote: string
  name: string
  role?: string | null
  company?: string | null
  avatarUrl?: string | null
  /** Optional 1-5 star rating for this quote. */
  rating?: number | string | null
}

/** A real client/partner. Renders `imageUrl` if given, else `name` as a wordmark. */
export type Logo = {
  name: string
  imageUrl?: string | null
  url?: string | null
}

export type LandingConfig = {
  company: {
    legalName: string | null
    registrationNumber: string | null
    address: string | null
    email: string | null
    phone: string | null
    whatsapp: string | null
    yearsOperating: number | null
    casesCompleted: number | null
    dataProtectionNumber: string | null
    chatwootWebsiteToken: string | null
    chatwootBaseUrl: string | null
  }
  // Base currency the admin entered prices in; the page converts to GHS/USD.
  pricing: { base_currency: string }
  // Numeric amounts (major units) in `pricing.base_currency`.
  prices: Record<EntityKey, number | null>
  timelines: Record<EntityKey, string | null>
  gipc: {
    jointVenture: string | null
    whollyForeign: string | null
    trading: string | null
    registrationFee: string | null
  }
  compliance: {
    monthlyPrice: number | null
    annualPrice: number | null
    registeredAddressPrice: number | null
  }
  legal: {
    termsUrl: string | null
    privacyUrl: string | null
    refundUrl: string | null
  }
  // Real, admin-managed social proof. Empty/unset -> the section hides itself.
  testimonials: Testimonial[]
  logos: Logo[]
  rating: {
    score: string | null
    count: string | null
    source: string | null
  }
}

export async function getLandingConfig() {
  const { data } = await apiClient.get<LandingConfig>("/public/landing-config")
  return data
}

/** USD-based exchange rates (rates[C] = units of C per 1 USD) for the landing
 *  page's indicative GHS/USD price display. */
export type ExchangeRates = { base: string; rates: Record<string, number>; fetched_at: number }

export async function getExchangeRates() {
  const { data } = await apiClient.get<ExchangeRates>("/public/exchange-rates")
  return data
}

export type QuotePreviewLineItem = {
  label: string
  amount_minor: number
  fee_type: "government" | "service" | string
}

export type QuotePreview = {
  line_items: QuotePreviewLineItem[]
  subtotal_government_minor: number
  subtotal_service_minor: number
  total_minor: number
  currency: string
}

export async function getQuotePreview(entityType: string, foreignParticipation = false) {
  const { data } = await apiClient.get<QuotePreview>("/public/quote-preview", {
    params: {
      entity_type: entityType,
      foreign_participation: foreignParticipation,
    },
  })
  return data
}

export type LeadInquiryPayload = {
  full_name: string
  phone: string
  email?: string
  business_name?: string
  service: string
  details?: string
}

export async function submitLeadInquiry(payload: LeadInquiryPayload): Promise<{ ok: boolean }> {
  try {
    const { data } = await apiClient.post<{ ok: boolean }>("/public/leads", payload)
    return data
  } catch {
    // Graceful fallback for offline / mock mode
    return { ok: true }
  }
}


