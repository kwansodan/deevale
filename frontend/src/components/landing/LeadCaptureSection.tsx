import { useState } from "react"
import { CheckCircle2, ShieldCheck, Clock, ArrowRight, MessageSquare, Building2 } from "lucide-react"

import { useLandingConfig } from "@/config/landing"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CertificateMark } from "@/components/landing/CertificateMark"

const SERVICES_OPTIONS = [
  { value: "bookkeeping_tax", label: "Outsourced Bookkeeping & Monthly Accounts" },
  { value: "gra_tax_filing", label: "GRA Tax Filing & Penalty Resolution (VAT/CIT/WHT)" },
  { value: "company_registration", label: "Company Registration at ORC (Limited by Shares)" },
  { value: "gipc_compliance", label: "GIPC Foreign Investor Setup & Compliance" },
  { value: "payroll_ssnit", label: "Payroll Administration & SSNIT Management" },
  { value: "other_advisory", label: "Other Corporate Secretarial / Advisory" },
]

export function LeadCaptureSection() {
  const { company } = useLandingConfig()
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [service, setService] = useState("bookkeeping_tax")
  const [details, setDetails] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError("Please provide your full name.")
      return
    }
    if (!phone.trim() || phone.trim().length < 7) {
      setError("Please provide a valid phone or WhatsApp number.")
      return
    }
    setError(null)

    // Track lead generation conversion in Google Ads / Analytics if gtag is loaded
    if (typeof window !== "undefined" && (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag) {
      (window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", "generate_lead", {
        event_category: "lead_form",
        event_label: service,
        value: 1,
      })
    }

    // Save lead record in local storage for fail-safe persistence
    try {
      const existingLeads = JSON.parse(localStorage.getItem("deevale_client_leads") || "[]")
      existingLeads.push({
        fullName,
        phone,
        email,
        businessName,
        service,
        details,
        submittedAt: new Date().toISOString(),
      })
      localStorage.setItem("deevale_client_leads", JSON.stringify(existingLeads))
    } catch {
      // Ignore localStorage errors
    }

    setSubmitted(true)
  }

  const selectedServiceLabel =
    SERVICES_OPTIONS.find((s) => s.value === service)?.label || "Accounting & Tax Services"

  const waNumber = company.whatsapp || "233596044738"
  const waMessage = `Hi Deevale GH, I just submitted an inquiry on deevalegh.com:
- Name: ${fullName}
- Phone/WhatsApp: ${phone}
${email ? `- Email: ${email}` : ""}
${businessName ? `- Business: ${businessName}` : ""}
- Service Requested: ${selectedServiceLabel}
${details ? `- Notes: ${details}` : ""}`

  const waUrl = `https://wa.me/${waNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
    waMessage
  )}`

  return (
    <section
      id="get-started-form"
      className="ink-gradient text-primary-foreground relative overflow-hidden px-4 py-20 md:py-28"
    >
      <CertificateMark
        className="pointer-events-none absolute -right-10 -bottom-12 h-80 w-auto opacity-10 md:opacity-15"
      />
      <div className="relative mx-auto max-w-5xl">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Value Proposition & Reassurance */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/20 px-3.5 py-1 text-xs font-semibold text-accent uppercase tracking-wider">
              <span>Free Consultation &amp; Fee Quote</span>
            </div>

            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl leading-tight">
              Ready to hand over your books and stay 100% compliant?
            </h2>

            <p className="text-primary-foreground/85 text-lg leading-relaxed">
              Tell us what your business needs. Our team (powered by Service 4 Limited) will assess your statutory status, prepare an itemized quote, and guide you every step of the way.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground font-bold text-xs">
                  ✓
                </div>
                <div>
                  <p className="font-semibold text-primary-foreground">Free 15-Minute Tax &amp; Bookkeeping Review</p>
                  <p className="text-sm text-primary-foreground/75">Find out if you have unfiled VAT, WHT or back taxes before the GRA flags them.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground font-bold text-xs">
                  ✓
                </div>
                <div>
                  <p className="font-semibold text-primary-foreground">Itemized, Fixed-Fee Quote Within 2 Hours</p>
                  <p className="text-sm text-primary-foreground/75">Clear monthly pricing with zero surprise charges or hidden onboarding fees.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground font-bold text-xs">
                  ✓
                </div>
                <div>
                  <p className="font-semibold text-primary-foreground">Dedicated Accountant on WhatsApp</p>
                  <p className="text-sm text-primary-foreground/75">Direct communication whenever you need quick answers, invoices, or filings.</p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-6 text-sm text-primary-foreground/70 border-t border-primary-foreground/15">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-accent" />
                <span>Confidential &amp; Secure</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-accent" />
                <span>Fast 2-Hour Response</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-accent" />
                <span>Accra, Ghana</span>
              </div>
            </div>
          </div>

          {/* Right Column: High-Converting Form Card */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-primary-foreground/15 bg-background p-6 text-foreground shadow-2xl sm:p-8">
              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold font-heading tracking-tight text-primary">
                      Request Your Free Assessment &amp; Quote
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Fill out this 60-second form. We will contact you via WhatsApp or phone.
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive font-medium">
                      {error}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="lead-name">Full Name *</Label>
                    <Input
                      id="lead-name"
                      placeholder="e.g. Kwame Mensah"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="lead-phone">WhatsApp / Phone Number *</Label>
                      <Input
                        id="lead-phone"
                        type="tel"
                        placeholder="e.g. 054 123 4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lead-email">Email Address (Optional)</Label>
                      <Input
                        id="lead-email"
                        type="email"
                        placeholder="kwame@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lead-business">Business Name (or Proposed Name)</Label>
                    <Input
                      id="lead-business"
                      placeholder="e.g. Apex Ventures or New Business"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lead-service">What service do you need? *</Label>
                    <select
                      id="lead-service"
                      value={service}
                      onChange={(e) => setService(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {SERVICES_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lead-details">Tell us a bit about your current situation (Optional)</Label>
                    <Textarea
                      id="lead-details"
                      rows={2}
                      placeholder="e.g. We have an existing company and need monthly bookkeeping plus GRA tax returns, or need to register a new LTD."
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-accent text-accent-foreground hover:bg-accent-300 font-semibold text-base shadow-sm"
                  >
                    Claim Free Assessment &amp; Quote <ArrowRight className="size-4" />
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    🔒 Zero spam. Your business and tax details remain strictly confidential.
                  </p>
                </form>
              ) : (
                <div className="py-6 text-center space-y-5">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="size-8" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold font-heading text-primary">
                      Thank You, {fullName}!
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      We have received your request for <strong className="text-foreground">{selectedServiceLabel}</strong>. An advisor from Deevale GH will review your details and contact you shortly at <strong className="text-foreground">{phone}</strong>.
                    </p>
                  </div>

                  <div className="pt-2">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#20ba5a] transition-colors"
                    >
                      <MessageSquare className="size-4" />
                      Connect Immediately on WhatsApp
                    </a>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Click to chat with our client advisor right now on WhatsApp.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitted(false)
                        setFullName("")
                        setPhone("")
                        setEmail("")
                        setBusinessName("")
                        setDetails("")
                      }}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Submit another inquiry
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
