import { Link } from "react-router-dom"

import { Wordmark } from "@/components/Wordmark"
import { SEO } from "@/components/SEO"
import { LeadCaptureSection } from "@/components/landing/LeadCaptureSection"
import { PublicHeader } from "@/components/public/PublicHeader"
import { useLandingConfig } from "@/config/landing"

export default function LeadCapturePage() {
  const { company } = useLandingConfig()

  return (
    <div className="bg-background min-h-svh flex flex-col justify-between">
      <SEO
        title="Get a Free Quote & Consultation | Deevale GH"
        description="Request a free business assessment and fee quote for company registration, accounting, GRA tax filing, or GIPC compliance in Ghana."
        canonicalUrl="https://deevalegh.com/quote"
      />

      <PublicHeader />

      {/* Main Form Body */}
      <main className="flex-1">
        <LeadCaptureSection />
      </main>

      {/* Footer */}
      <footer className="border-border text-muted-foreground border-t px-4 py-8 text-sm">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Wordmark size="sm" />
            <span>&copy; {new Date().getFullYear()} {company.legalName ?? "Deevale GH"}. Powered by Service 4 Limited.</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/legal/privacy" className="hover:underline">Privacy</Link>
            <Link to="/legal/terms" className="hover:underline">Terms</Link>
            <Link to="/services" className="hover:underline">Services</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
