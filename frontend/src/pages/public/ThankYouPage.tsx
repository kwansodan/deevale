import { useEffect } from "react"
import { Link } from "react-router-dom"
import { CheckCircle2, MessageSquare, ArrowRight, ShieldCheck, Clock } from "lucide-react"

import { SEO } from "@/components/SEO"
import { PublicHeader } from "@/components/public/PublicHeader"
import { Wordmark } from "@/components/Wordmark"
import { Button } from "@/components/ui/button"
import { useLandingConfig } from "@/config/landing"
import { trackLeadConversion } from "@/lib/analytics"

export default function ThankYouPage() {
  const { company } = useLandingConfig()

  useEffect(() => {
    // Fire Google Ads conversion tag on page load
    trackLeadConversion("thank_you_page")
  }, [])

  const waNumber = company.whatsapp || "233249733286"
  const waUrl = `https://wa.me/${waNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
    "Hi Deevale GH, I just submitted an inquiry on deevalegh.com and would like to connect."
  )}`

  return (
    <div className="bg-background min-h-svh flex flex-col justify-between overflow-x-hidden">
      <SEO
        title="Thank You | Deevale GH"
        description="Thank you for reaching out to Deevale GH. Our team is reviewing your inquiry."
        canonicalUrl="https://deevalegh.com/thank-you"
      />

      <PublicHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-16 sm:py-24">
        <div className="max-w-xl w-full text-center space-y-8">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-md">
            <CheckCircle2 className="size-12" />
          </div>

          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3.5 py-1 text-xs font-semibold text-accent-700 uppercase tracking-wider">
              Inquiry Received
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold font-heading tracking-tight text-foreground">
              Thank You for Reaching Out!
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-md mx-auto">
              We have received your details. A client advisor from Deevale GH (powered by Service 4 Limited) is reviewing your statutory and accounting requirements.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4 text-left">
            <div className="flex items-start gap-3">
              <Clock className="size-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Response Time</p>
                <p className="text-xs text-muted-foreground">We typically review all filings and inquiries within 2 business hours.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Confidential &amp; Secure</p>
                <p className="text-xs text-muted-foreground">All business records and personal data are protected under Data Protection Act 843.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#25D366] px-5 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-[#20ba5a] transition-colors"
            >
              <MessageSquare className="size-4" />
              Connect Immediately on WhatsApp
            </a>
            <Button
              render={<Link to="/">Return to Homepage <ArrowRight className="size-4 ml-1" /></Link>}
              nativeButton={false}
              variant="outline"
              className="w-full"
            />
          </div>
        </div>
      </main>

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
