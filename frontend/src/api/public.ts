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
  }
  prices: Record<EntityKey, string | null>
  timelines: Record<EntityKey, string | null>
  gipc: {
    jointVenture: string | null
    whollyForeign: string | null
    trading: string | null
    registrationFee: string | null
  }
  compliance: {
    monthlyPrice: string | null
    annualPrice: string | null
    registeredAddressPrice: string | null
  }
  legal: {
    termsUrl: string | null
    privacyUrl: string | null
    refundUrl: string | null
  }
}

export async function getLandingConfig() {
  const { data } = await apiClient.get<LandingConfig>("/public/landing-config")
  return data
}
