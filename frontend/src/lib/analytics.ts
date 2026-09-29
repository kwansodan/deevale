declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

export const GOOGLE_ADS_ID = "AW-18479398948"
export const GOOGLE_ADS_LEAD_CONVERSION = "AW-18479398948/GUPYCK2AgYsDEKSA1etE"

/**
 * Fires the Google Ads conversion event and GA4 generate_lead event
 * when a user submits a lead / quote request form.
 */
export function trackLeadConversion(service?: string) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    // Official Google Ads conversion tag for "Submit lead form"
    window.gtag("event", "conversion", {
      send_to: GOOGLE_ADS_LEAD_CONVERSION,
      event_category: "lead_form",
      event_label: service,
    })

    // Standard GA4 generate_lead event
    window.gtag("event", "generate_lead", {
      event_category: "lead_form",
      event_label: service,
      value: 1,
    })
  }
}
