import { useLocation } from "react-router-dom"

import { useLandingConfig } from "@/config/landing"

/** WhatsApp brand glyph (white, single path). lucide dropped brand icons, so the
 *  logo is inlined here. */
function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" fill="currentColor" aria-hidden="true">
      <path d="M16.003 3C9.38 3 4 8.38 4 15c0 2.09.55 4.13 1.6 5.93L4 29l8.28-1.55A11.9 11.9 0 0 0 16 27c6.62 0 12-5.38 12-12S22.62 3 16.003 3zm0 21.8c-1.86 0-3.68-.5-5.28-1.44l-.38-.22-4.92.92.94-4.8-.25-.4A9.77 9.77 0 0 1 6.2 15c0-5.4 4.4-9.8 9.8-9.8s9.8 4.4 9.8 9.8-4.4 9.8-9.8 9.8zm5.4-7.34c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.48-.5-.67-.5l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.5s1.07 2.9 1.22 3.1c.15.2 2.1 3.2 5.1 4.48.71.3 1.27.48 1.7.62.71.22 1.36.2 1.87.12.57-.08 1.75-.72 2-1.4.25-.7.25-1.28.17-1.4-.07-.13-.27-.2-.57-.35z" />
    </svg>
  )
}

/**
 * Floating "chat on WhatsApp" button, shown on every customer-facing page
 * (landing, auth, and the /app client area) but never in the /ops staff console.
 *
 * The number is admin-managed (company.whatsapp in landing settings). If it is
 * unset the button renders nothing -- same honesty rule as the rest of the site,
 * no dead link.
 */
export function WhatsAppFab() {
  const { pathname } = useLocation()
  const { company } = useLandingConfig()

  if (pathname.startsWith("/ops")) return null
  if (!company.whatsapp) return null

  const href = `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(
    "Hi Deevale GH, I'd like some help."
  )}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      className="fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-card-lg transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none"
    >
      <WhatsAppGlyph />
    </a>
  )
}
