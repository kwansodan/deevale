import { useLocation } from "react-router-dom"

import { useLandingConfig } from "@/config/landing"

/** WhatsApp brand glyph (white, single path). */
function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" fill="currentColor" aria-hidden="true">
      <path d="M16.003 3C9.38 3 4 8.38 4 15c0 2.09.55 4.13 1.6 5.93L4 29l8.28-1.55A11.9 11.9 0 0 0 16 27c6.62 0 12-5.38 12-12S22.62 3 16.003 3zm0 21.8c-1.86 0-3.68-.5-5.28-1.44l-.38-.22-4.92.92.94-4.8-.25-.4A9.77 9.77 0 0 1 6.2 15c0-5.4 4.4-9.8 9.8-9.8s9.8 4.4 9.8 9.8-4.4 9.8-9.8 9.8zm5.4-7.34c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.48-.5-.67-.5l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.5s1.07 2.9 1.22 3.1c.15.2 2.1 3.2 5.1 4.48.71.3 1.27.48 1.7.62.71.22 1.36.2 1.87.12.57-.08 1.75-.72 2-1.4.25-.7.25-1.28.17-1.4-.07-.13-.27-.2-.57-.35z" />
    </svg>
  )
}

/**
 * Floating "Chat on WhatsApp" button, positioned directly above the Chatwoot widget
 * on all public pages (landing, services, guides, calculator, auth, etc.).
 */
export function WhatsAppFab() {
  const { pathname } = useLocation()
  const { company } = useLandingConfig()

  // Do not show in the internal ops staff console
  if (pathname.startsWith("/ops")) return null

  // Reliable WhatsApp number with safe fallback
  const rawNumber =
    company.whatsapp?.trim() ||
    (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined)?.trim() ||
    "233596044738"

  const cleanNumber = rawNumber.replace(/[^0-9]/g, "")
  if (!cleanNumber) return null

  const href = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(
    "Hi Deevale GH, I would like some assistance."
  )}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      className="fixed right-5 bottom-[88px] z-50 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-all duration-200 hover:scale-110 hover:bg-[#20ba5a] hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:outline-none group motion-reduce:transition-none"
    >
      <WhatsAppGlyph />
      {/* Presence indicator dot */}
      <span className="absolute top-1 right-1 flex size-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
        <span className="relative inline-flex size-3 rounded-full bg-emerald-300"></span>
      </span>
      {/* Desktop hover tooltip */}
      <span className="pointer-events-none absolute right-16 hidden rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 sm:inline-block whitespace-nowrap">
        Chat on WhatsApp
      </span>
    </a>
  )
}
