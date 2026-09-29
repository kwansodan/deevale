import { Link } from "react-router-dom"
import { ArrowLeft, MessageSquare } from "lucide-react"

import { Wordmark } from "@/components/Wordmark"
import { SEO } from "@/components/SEO"
import { LeadCaptureSection } from "@/components/landing/LeadCaptureSection"
import { Button } from "@/components/ui/button"
import { useLandingConfig } from "@/config/landing"

export default function LeadCapturePage() {
  const { company } = useLandingConfig()
  const waNumber = company.whatsapp || "233249733286"

  return (
    <div className="bg-background min-h-svh flex flex-col justify-between">
      <SEO
        title="Get a Free Quote & Consultation | Deevale GH"
        description="Request a free business assessment and fee quote for company registration, accounting, GRA tax filing, or GIPC compliance in Ghana."
        canonicalUrl="https://deevalegh.com/quote"
      />

      {/* Header */}
      <header className="border-border bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Wordmark size="md" />
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/services"
              className="text-muted-foreground hover:text-foreground hidden text-sm font-medium sm:block"
            >
              Services
            </Link>
            <Link
              to="/calculator"
              className="text-muted-foreground hover:text-foreground hidden text-sm font-medium sm:block"
            >
              Fee Calculator
            </Link>
            <Button
              render={
                <a
                  href={`https://wa.me/${waNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent("Hi Deevale GH, I'd like to inquire about your corporate and tax services.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageSquare className="size-4" />
                  WhatsApp
                </a>
              }
              variant="outline"
              size="sm"
            />
            <Button render={<Link to="/"><ArrowLeft className="size-4" /> Home</Link>} variant="ghost" size="sm" />
          </nav>
        </div>
      </header>

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
