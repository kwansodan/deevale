import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  FileSignature,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Receipt,
  ShieldCheck,
  Star,
  TrendingUp,
  Wallet,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Wordmark } from "@/components/Wordmark"
import { StageTracker } from "@/components/landing/StageTracker"
import { StatCounter } from "@/components/landing/StatCounter"
import { LogoStrip } from "@/components/landing/LogoStrip"
import { Testimonials } from "@/components/landing/Testimonials"
import { Faq } from "@/components/landing/Faq"
import { CurrencyToggle } from "@/components/landing/CurrencyToggle"
import { useCurrency } from "@/hooks/useCurrency"
import { useInView } from "@/hooks/useInView"
import { cn } from "@/lib/utils"
import { figures, useLandingConfig } from "@/config/landing"
import { SEO } from "@/components/SEO"
import { LeadCaptureSection } from "@/components/landing/LeadCaptureSection"

// Deliberately not translated. tw.json is still a machine draft
// (_meta.reviewed:false); unreviewed Twi on the page whose whole job is
// building trust would undercut it. Revisit once a native review lands.

type Audience = "local" | "foreign"
type Rating = { score: string | null; count: string | null; source: string | null }

/** Renders a configured figure, or an honest fallback when it is unset. */
function Figure({ value, fallback }: { value: string | null; fallback: string }) {
  if (!value) return <span className="text-muted-foreground font-normal">{fallback}</span>
  return <span>{value}</span>
}

/** A bordered square container, so icons read as one system rather than confetti. */
function IconTile({ icon: Icon }: { icon: typeof ShieldCheck }) {
  return (
    <span className="border-border bg-secondary text-accent-600 flex size-9 items-center justify-center rounded-md border">
      <Icon className="size-4" />
    </span>
  )
}

/** Star rating line, rendered only when a real score is configured. */
function RatingInline({ rating, tone = "light" }: { rating: Rating; tone?: "light" | "dark" }) {
  if (!rating.score) return null
  const dark = tone === "dark"
  return (
    <div className={cn("flex items-center gap-2 text-sm", dark ? "text-primary-foreground/80" : "text-muted-foreground")}>
      <span className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={cn("size-4", "fill-accent", dark ? "text-accent-400" : "text-accent-600")} />
        ))}
      </span>
      <span>
        <strong className={dark ? "text-primary-foreground" : "text-foreground"}>{rating.score}</strong>/5
        {rating.count ? ` · ${rating.count} reviews` : ""}
        {rating.source ? ` on ${rating.source}` : ""}
      </span>
    </div>
  )
}

/**
 * Sections previously shared identical metrics, which is what made the page read
 * as chapters of a textbook. `surface` and `width` exist so the rhythm can be
 * varied deliberately rather than by hand-rolling classes at each call site.
 */
function Section({
  id,
  eyebrow,
  title,
  surface = "default",
  width = "wide",
  center = false,
  children,
}: {
  id?: string
  eyebrow?: string
  title: string
  surface?: "default" | "tinted" | "ink"
  width?: "wide" | "narrow"
  center?: boolean
  children: React.ReactNode
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <section
      id={id}
      className={cn(
        "px-4 py-16 md:py-24",
        surface === "default" && "border-border border-t",
        surface === "tinted" && "bg-secondary/40 border-border border-y",
        surface === "ink" && "ink-gradient text-primary-foreground"
      )}
    >
      <div
        ref={ref}
        className={cn(
          "mx-auto",
          width === "wide" ? "max-w-5xl" : "max-w-3xl",
          center && "text-center",
          // Starts visible; only hidden while waiting when motion is allowed,
          // so reduced-motion readers never get a blank section.
          "motion-safe:transition-all motion-safe:duration-700",
          !inView && "motion-safe:translate-y-3 motion-safe:opacity-0"
        )}
      >
        {eyebrow && (
          <p
            className={cn(
              "mb-2 text-sm font-semibold tracking-wide uppercase",
              // On the slate-green ink section the bright yellow accent-400
              // reads cleanly; on light sections the eyebrow uses the primary.
              surface === "ink" ? "text-accent-400" : "text-primary"
            )}
          >
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
        <div className={cn("mt-8", center && "text-left")}>{children}</div>
      </div>
    </section>
  )
}

export default function LandingPage() {
  const [audience, setAudience] = useState<Audience>("local")
  const [scrolled, setScrolled] = useState(false)
  const { baseCurrency, company, compliance, entities, gipc, hasTrustSignals, legal, logos, rating, testimonials } =
    useLandingConfig()
  const { currency, setCurrency, convert } = useCurrency()
  const money = (amount: number | null, fallback: string) =>
    amount == null ? (
      <span className="text-muted-foreground font-normal">{fallback}</span>
    ) : (
      <span>{convert(amount, baseCurrency)}</span>
    )
  const isForeign = audience === "foreign"
  const visibleEntities = entities.filter((e) => (isForeign ? true : !e.foreignTrack))

  // Header gains a shadow once the hero scrolls under it -- flat while at the
  // top, grounded once it is floating over content.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const scrollToForm = (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    const el = document.getElementById("get-started-form")
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
      window.history.pushState(null, "", "#get-started-form")
    }
  }

  // Auto-scroll to #get-started-form when arriving via anchor link / hash URL
  useEffect(() => {
    if (window.location.hash === "#get-started-form" || window.location.hash === "#quote") {
      const timer = setTimeout(() => {
        const el = document.getElementById("get-started-form")
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [])

  return (
    <div className="bg-background min-h-svh">
      <SEO
        title="Business Registration in Ghana | ORC, GIPC & Tax Setup - Deevale GH"
        description="Register and run your business in Ghana without the guesswork. Company Limited by Shares, GIPC foreign investor registration, GRA TIN, SSNIT, and statutory corporate compliance in Accra."
        canonicalUrl="https://deevalegh.com/"
        keywords="business registration in ghana, register company in ghana, orc business registration, company limited by shares ghana, gipc registration ghana, foreign company registration ghana, ssnit employer registration, gra tin registration ghana, virtual office accra, corporate secretarial ghana"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "LegalService",
          "@id": "https://deevalegh.com/#organization",
          "name": "Deevale GH",
          "legalName": "Deevale GH",
          "alternateName": ["Deevale", "Deevale GH", "Deevale Corporate Services"],
          "url": "https://deevalegh.com/",
          "logo": "https://deevalegh.com/deevalegh-icon.svg",
          "image": "https://deevalegh.com/deevalegh-icon.svg",
          "description": "Statutory company registration, GIPC foreign investor compliance, and corporate secretarial platform in Accra, Ghana.",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": company.address ?? "3rd Floor, Atlantic Tower, Airport City",
            "addressLocality": "Accra",
            "addressRegion": "Greater Accra",
            "addressCountry": "GH",
          },
          "telephone": company.phone ?? undefined,
          "email": company.email ?? "support@deevalegh.com",
          "sameAs": [
            "https://www.linkedin.com/company/deevalegh",
            "https://x.com/deevalegh",
            "https://facebook.com/deevalegh",
            "https://github.com/kwansodan/deevale",
          ],
          "knowsAbout": [
            "Ghana Companies Act 2019 (Act 992)",
            "Ghana Investment Promotion Centre Act 2013 (Act 865)",
            "Office of the Registrar of Companies (ORC) Ghana",
            "Ghana Revenue Authority (GRA) Tax Identification Number",
            "Social Security and National Insurance Trust (SSNIT)",
            "Foreign Direct Investment in Ghana",
            "Corporate Secretarial Services",
          ],
          "priceRange": "$$",
        }}
      />
      {/* Needs its own translucent ground: bare backdrop-blur left the header
          transparent, so the ink wordmark vanished over the ink section. */}
      <header
        className={cn(
          "border-border bg-background/85 sticky top-0 z-20 border-b backdrop-blur transition-shadow",
          scrolled && "shadow-card"
        )}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Wordmark size="md" />
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/services/accounting-and-bookkeeping"
              className="text-muted-foreground hover:text-foreground hidden text-sm font-medium sm:block"
            >
              Accounting &amp; Tax
            </Link>
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
            <Link
              to="/guides"
              className="text-muted-foreground hover:text-foreground hidden text-sm font-medium sm:block"
            >
              Statutory Guides
            </Link>
            <Button render={<Link to="/login">Log in</Link>} nativeButton={false} variant="ghost" size="sm" />
            <Button
              onClick={scrollToForm}
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent-300 font-semibold hidden sm:inline-flex"
            >
              Free Quote
            </Button>
            <Button render={<Link to="/signup">Get started</Link>} nativeButton={false} size="sm" />
          </nav>
        </div>
      </header>

      {/* Hero + the audience fork. The product itself branches on
          WorkflowDefinition.variant standard|foreign, so the page does too. */}
      <section className="relative overflow-hidden">
        {/* Layered backdrop: warm accent + slate glow over a faint dotted grid. */}
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden />

        <div className="relative mx-auto grid max-w-5xl items-center gap-12 px-4 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-24">
          <div>
            <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent-700 mb-4 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold">
              <ShieldCheck className="size-3.5" /> Powered by Service 4 Limited • Corporate Secretarial &amp; Accounting
            </Badge>

            <h1 className="text-4xl font-bold tracking-tight text-balance md:text-6xl">
              Form your company. Balance your books.{" "}
              <span className="highlight-accent">Stay 100% compliant in Ghana.</span>
            </h1>
            <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed">
              Deevale (powered by Service 4 Limited) is the all-in-one corporate and financial back office for founders. We incorporate your entity at the ORC, set up your GRA tax and SSNIT accounts, and continue as your outsourced monthly bookkeeping, tax, and payroll team.
            </p>

            <div className="mt-8">
              <p className="text-muted-foreground mb-3 text-sm font-medium">Where are you starting from?</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={audience === "local" ? "default" : "outline"}
                  onClick={() => setAudience("local")}
                >
                  <Building2 /> I&apos;m in Ghana
                </Button>
                <Button
                  variant={isForeign ? "default" : "outline"}
                  onClick={() => setAudience("foreign")}
                >
                  <Globe2 /> I&apos;m investing from abroad
                </Button>
              </div>
            </div>

            {/* Chips rather than a paragraph */}
            <ul className="mt-6 flex flex-wrap gap-2">
              {(isForeign
                ? ["No travel required", "GIPC handled", "Chartered accounting", "Ghanaian office address"]
                : ["ORC business registration", "Monthly bookkeeping", "GRA VAT/WHT filing", "Payroll & SSNIT"]
              ).map((chip) => (
                <li
                  key={chip}
                  className="border-border bg-background/60 text-foreground flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
                >
                  <Check className="text-accent-600 size-3.5" />
                  {chip}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                onClick={scrollToForm}
                size="lg"
                className="bg-accent text-accent-foreground hover:bg-accent-300 font-semibold shadow-sm"
              >
                Claim Free Assessment &amp; Quote <ArrowRight />
              </Button>
              <Button
                render={
                  <Link to="/services/accounting-and-bookkeeping">
                    Outsourced Accounting &amp; Tax &rarr;
                  </Link>
                }
                nativeButton={false}
                variant="outline"
                size="lg"
              />
              <Button
                render={
                  <Link to="/signup">
                    Start Business Registration
                  </Link>
                }
                nativeButton={false}
                variant="ghost"
                size="lg"
              />
            </div>

            {rating.score && (
              <div className="mt-6">
                <RatingInline rating={rating} />
              </div>
            )}
          </div>

          {/* The page's main image: the product's own case timeline, floated
              over a soft accent glow for depth. */}
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 relative motion-safe:duration-700">
            <div
              className="bg-accent/20 absolute -inset-5 -z-10 rounded-[2rem] blur-2xl"
              aria-hidden
            />
            <StageTracker audience={audience} />
          </div>
        </div>

        {/* Figures derived from the workflow library, not marketing claims. */}
        <dl className="relative mx-auto grid max-w-5xl grid-cols-3 gap-6 border-t px-4 pt-8 pb-16">
          {figures.map((f) => (
            <StatCounter key={f.label} value={f.value} label={f.label} />
          ))}
        </dl>
      </section>

      {/* Real, admin-managed client/partner logos. Hidden when none set. */}
      <LogoStrip logos={logos} />

      {hasTrustSignals && (
        <div className="border-border bg-muted/30 border-y px-4 py-6">
          <div className="text-muted-foreground mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-3 text-sm">
            {company.registrationNumber && (
              <span className="flex items-center gap-2">
                <ShieldCheck className="text-primary size-4" />
                Registered in Ghana - {company.registrationNumber}
              </span>
            )}
            {company.yearsOperating && <span>{company.yearsOperating}+ years operating</span>}
            {company.casesCompleted && (
              <span>{company.casesCompleted.toLocaleString()} registrations completed</span>
            )}
            {company.dataProtectionNumber && (
              <span>Data Protection Commission - {company.dataProtectionNumber}</span>
            )}
          </div>
        </div>
      )}

      {/* The Post-Incorporation Trap vs Complete Lifecycle */}
      <Section
        eyebrow="The Complete Lifecycle"
        title="Registration is Day 0. What keeps you alive is what happens next."
        surface="default"
      >
        <p className="text-muted-foreground -mt-4 mb-10 max-w-3xl text-base leading-relaxed">
          Most founders assume obtaining an ORC certificate is the finish line. In reality, that is when statutory obligations begin.
          The Ghana Revenue Authority and SSNIT expect monthly filings regardless of whether you have traded. Deevale, powered by
          Service 4 Limited, bridges the gap between company registration and ongoing financial operations.
        </p>

        <div className="grid gap-6 md:grid-cols-4">
          {[
            {
              step: "01",
              title: "ORC Incorporation",
              timeline: "Days 1 to 7",
              body: "Name reservation, Form 3 and Form 4 filings, certified corporate constitution, and official Certificate of Incorporation.",
            },
            {
              step: "02",
              title: "Tax & Bank Setup",
              timeline: "Days 8 to 14",
              body: "GRA Corporate TIN activation, SSNIT employer onboarding, registered address setup, and bank account introduction.",
            },
            {
              step: "03",
              title: "Monthly Bookkeeping",
              timeline: "Day 30 onwards",
              body: "Reconciling bank accounts, MoMo merchant wallets, and expense receipts into clean, audit-ready cloud ledgers.",
            },
            {
              step: "04",
              title: "Taxes, Payroll & Reports",
              timeline: "Every Month",
              body: "Filing monthly GRA VAT/WHT, remitting SSNIT Tier 1 & 2 pensions, and delivering executive P&L and Balance Sheets.",
            },
          ].map((item) => (
            <Card key={item.step} className="border-border shadow-card hover-lift rounded-2xl relative overflow-hidden">
              <span className="bg-primary/20 absolute inset-x-0 top-0 h-1" aria-hidden />
              <CardHeader className="pb-2">
                <span className="text-primary font-mono text-xs font-bold uppercase tracking-wider">{item.step} • {item.timeline}</span>
                <CardTitle className="text-base font-semibold">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs leading-relaxed">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* Dedicated Accounting & Bookkeeping Section */}
      <Section
        id="accounting"
        eyebrow="Chartered Accounting & Taxes"
        title="Your dedicated outsourced finance team in Ghana"
        surface="tinted"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 -mt-4 mb-8">
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            All accounting and compliance operations are executed directly by <strong>Service 4 Limited</strong>, a professional corporate
            accounting practice in Accra. Gain the capabilities of a full finance department without hiring in-house staff.
          </p>
          <Link
            to="/services/accounting-and-bookkeeping"
            className="text-primary font-semibold text-sm hover:underline shrink-0 inline-flex items-center gap-1"
          >
            Full Accounting Details <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Receipt,
              title: "Monthly Bookkeeping",
              desc: "Complete reconciliation of local GHS accounts, foreign currency (USD/GBP/EUR) accounts, and Mobile Money merchant wallets.",
            },
            {
              icon: Calculator,
              title: "Statutory GRA Taxes",
              desc: "Timely monthly filing of Withholding Tax (WHT), VAT/NHIL/GETFund returns, and quarterly provisional CIT assessments.",
            },
            {
              icon: Wallet,
              title: "Payroll & SSNIT (Act 766)",
              desc: "Staff payroll calculation, electronic pay slips, PAYE tax deductions, and mandatory Tier 1 & Tier 2 pension remittances.",
            },
            {
              icon: TrendingUp,
              title: "Management Accounts",
              desc: "Monthly Profit & Loss statements, balance sheets, cash flow tracking, and annual statutory return preparation.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="border-border shadow-card hover-lift rounded-2xl bg-card">
              <CardContent className="pt-6">
                <div className="border-border bg-secondary text-primary flex size-10 items-center justify-center rounded-xl border mb-4">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-semibold text-base mb-1.5">{title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* Foreign path only. Remoteness is the overseas buyer's make-or-break
          question and barely registers for someone already in Accra, so it
          does not need its own section for both audiences. */}
      {isForeign && (
        <Section eyebrow="Remote by default" title="You never have to be in the room">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: FileSignature,
                title: "Sign electronically",
                body: "Every party signs online, in the right order, wherever they are.",
              },
              {
                icon: ShieldCheck,
                title: "Upload ID securely",
                body: "Passports go into an encrypted vault. Each co-founder verifies on their own account.",
              },
              {
                icon: MapPin,
                title: "Use our address",
                body: "We receive your official mail, scan it, and it appears in your dashboard.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <IconTile icon={Icon} />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section id="pricing" eyebrow="Pricing" title="What it costs, all in" surface="tinted">
        {/* Prices are entered in one base currency and shown to the visitor in
            GHS (Ghana) or USD (elsewhere), auto-detected with a manual toggle. */}
        <div className="-mt-4 mb-6 flex items-center gap-3">
          <span className="text-muted-foreground text-sm">Show prices in</span>
          <CurrencyToggle currency={currency} onChange={setCurrency} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {visibleEntities.map((entity) => (
            <Card
              key={entity.key}
              className="border-border shadow-card hover-lift relative overflow-hidden rounded-2xl"
            >
              {/* Thin accent cap -- a fill, palette-legal, and reads "product card". */}
              <span className="bg-accent absolute inset-x-0 top-0 h-1" aria-hidden />
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">{entity.name}</CardTitle>
                  {entity.foreignTrack && <Badge variant="secondary">Foreign</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">{entity.blurb}</p>
                <Separator className="my-4" />
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground text-xs">From</dt>
                    <dd className="font-heading text-lg font-semibold">
                      {money(entity.price, "Request a quote")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Typical time</dt>
                    <dd className="font-heading text-lg font-semibold">
                      <Figure value={entity.timeline} fallback="Ask us" />
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-muted-foreground mt-4 text-sm">
          Every quote itemises the government fee separately from ours.
          {currency !== "GHS" && " Prices in USD are indicative; you're billed in Ghana cedis (GHS)."}
        </p>
      </Section>

      <Section eyebrow="How it works" title="Four steps, tracked end to end" center>
        <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
          {/* Connector line behind the numerals on desktop. */}
          <div
            className="via-border absolute top-4 right-8 left-8 hidden h-px bg-gradient-to-r from-transparent to-transparent md:block"
            aria-hidden
          />
          {[
            ["Tell us about the business", "A guided questionnaire works out the right structure and what the law requires of it."],
            ["Upload and sign", "Submit IDs and supporting documents once. Every party signs electronically."],
            ["We file it", "We lodge with the Registrar and follow up with GRA, SSNIT and your local assembly."],
            ["You're trading", "Certificates land in your document vault. Compliance deadlines start tracking automatically."],
          ].map(([title, body], i) => (
            <li key={title} className="relative">
              <div className="bg-accent text-accent-foreground shadow-card font-heading mx-auto flex size-9 items-center justify-center rounded-full text-sm font-semibold">
                {i + 1}
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Real client quotes. The whole section is skipped when none are set. */}
      {testimonials.length > 0 && (
        <Section eyebrow="In their words" title="Founders who started here" surface="tinted">
          <Testimonials items={testimonials} />
        </Section>
      )}

      {isForeign && (
        <Section eyebrow="Foreign investors" title="What Ghana will require of you">
          <p className="text-muted-foreground -mt-4 mb-8 max-w-2xl text-sm">
            The GIPC Act sets a minimum equity threshold that depends on the shape of the business.
            We confirm which applies before you commit to anything.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Joint venture with a Ghanaian", gipc.jointVenture],
              ["Wholly foreign-owned", gipc.whollyForeign],
              ["Trading enterprise", gipc.trading],
            ].map(([label, value]) => (
              <Card key={label as string} className="border-border shadow-card hover-lift rounded-2xl">
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-xs">{label}</p>
                  <p className="font-heading mt-1 text-xl font-semibold">
                    <Figure value={value as string | null} fallback="Confirm with us" />
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">minimum equity</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {gipc.registrationFee && (
            <p className="text-muted-foreground mt-4 text-sm">
              GIPC registration fee: <strong className="text-foreground">{gipc.registrationFee}</strong>
            </p>
          )}
          <p className="text-muted-foreground mt-6 text-xs">
            Thresholds are set by statute and change by amendment. We confirm the current figure in
            writing before you transfer any capital.
          </p>
        </Section>
      )}

      <Section eyebrow="After you're registered" title="Staying compliant, year after year" surface="ink">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="text-sm leading-relaxed">
              Registering is the easy part. Annual returns, tax filings, SSNIT and permit renewals
              carry penalties that accrue quietly until they don&apos;t. That risk is heaviest
              from another country.
            </p>
          </div>
          <Card className="border-border shadow-card-lg rounded-2xl">
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm">Compliance plan, monthly</span>
                <span className="font-semibold">{money(compliance.monthlyPrice, "Request a quote")}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm">Compliance plan, annual</span>
                <span className="font-semibold">{money(compliance.annualPrice, "Request a quote")}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm">Registered office address</span>
                <span className="font-semibold">{money(compliance.registeredAddressPrice, "Request a quote")}</span>
              </div>
              <Separator />
              <ul className="space-y-2">
                {[
                  "Deadline tracking for your entity type",
                  "Reminders by email and SMS",
                  "“File it for me” on every obligation",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section eyebrow="For firms" title="Law and accounting firms" width="narrow">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
            Register clients through our partner API, under your own branding. You keep the
            relationship; we do the filing.
          </p>
          <Button
            render={
              <a href={`mailto:${company.email ?? ""}?subject=Partner%20programme`}>
                Talk to us about partnering
              </a>
            }
            nativeButton={false}
            variant="outline"
          />
        </div>
      </Section>

      <Section eyebrow="Questions" title="The things people ask first" width="narrow" center>
        <Faq />
      </Section>

      {/* Lead Capture & Free Consultation Section */}
      <LeadCaptureSection />

      <footer className="border-border text-muted-foreground border-t px-4 py-12 text-sm">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-5">
          <div className="space-y-2">
            <Wordmark size="md" />
            <p className="text-foreground font-semibold">{company.legalName ?? "Deevale GH"}</p>
            {company.address && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                {company.address}
              </p>
            )}
          </div>
          <nav className="flex flex-col gap-2">
            <p className="text-foreground font-semibold">Services</p>
            <Link to="/services" className="hover:underline">
              All Services
            </Link>
            <Link to="/services/accounting-and-bookkeeping" className="hover:underline font-medium text-foreground">
              Accounting &amp; Tax
            </Link>
            <Link to="/services/company-limited-by-shares" className="hover:underline">
              Company (LTD)
            </Link>
            <Link to="/services/sole-proprietorship" className="hover:underline">
              Sole Proprietorship
            </Link>
            <Link to="/services/gipc-registration" className="hover:underline">
              GIPC Registration
            </Link>
            <Link to="/services/gra-tax-tin-registration" className="hover:underline">
              GRA Tax &amp; TIN
            </Link>
          </nav>
          <nav className="flex flex-col gap-2">
            <p className="text-foreground font-semibold">Resources</p>
            <Link to="/calculator" className="hover:underline">
              Fee Calculator
            </Link>
            <Link to="/guides" className="hover:underline">
              Statutory Guides
            </Link>
            <Link to="/guides/how-to-register-a-company-in-ghana-2026" className="hover:underline">
              Company Registration
            </Link>
            <Link to="/guides/foreign-company-registration-ghana-gipc-guide" className="hover:underline">
              GIPC Foreign Guide
            </Link>
          </nav>
          <nav className="flex flex-col gap-2">
            <p className="text-foreground font-semibold">Contact</p>
            {company.email && (
              <a href={`mailto:${company.email}`} className="flex items-center gap-2 hover:underline">
                <Mail className="size-4 shrink-0" />
                {company.email}
              </a>
            )}
            {company.phone && (
              <a href={`tel:${company.phone}`} className="flex items-center gap-2 hover:underline">
                <Phone className="size-4 shrink-0" />
                {company.phone}
              </a>
            )}
          </nav>
          <nav className="flex flex-col gap-2">
            <p className="text-foreground font-semibold">Company</p>
            {/* An admin-configured external URL wins; otherwise link to the
                in-app legal page so these are always live. */}
            {legal.termsUrl ? (
              <a href={legal.termsUrl} className="hover:underline">
                Terms of service
              </a>
            ) : (
              <Link to="/legal/terms" className="hover:underline">
                Terms of service
              </Link>
            )}
            {legal.privacyUrl ? (
              <a href={legal.privacyUrl} className="hover:underline">
                Privacy policy
              </a>
            ) : (
              <Link to="/legal/privacy" className="hover:underline">
                Privacy policy
              </Link>
            )}
            {legal.refundUrl ? (
              <a href={legal.refundUrl} className="hover:underline">
                Refund policy
              </a>
            ) : (
              <Link to="/legal/refund" className="hover:underline">
                Refund policy
              </Link>
            )}
            <Link to="/login" className="hover:underline">
              Log in
            </Link>
          </nav>
        </div>
        <div className="mx-auto mt-8 max-w-5xl">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Deevale GH is a corporate secretarial and accounting technology platform powered by Service 4 Limited. We provide business formation, chartered bookkeeping, GRA tax compliance, and payroll management in Accra, Ghana. We are not a law firm and do not provide legal advocacy.
          </p>
        </div>
      </footer>
    </div>
  )
}
