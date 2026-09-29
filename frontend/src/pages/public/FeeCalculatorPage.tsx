import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  Building2,
  Calculator,
  Check,
  ChevronDown,
  Globe2,
  Info,
  MapPin,
  Receipt,
  ShieldCheck,
} from "lucide-react"

import { getQuotePreview } from "@/api/public"
import { Wordmark } from "@/components/Wordmark"
import { SEO } from "@/components/SEO"
import { PublicHeader } from "@/components/public/PublicHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useCurrency } from "@/hooks/useCurrency"
import { useLandingConfig } from "@/config/landing"
import { cn } from "@/lib/utils"

type EntityOption = {
  id: string
  code: string
  name: string
  tag: string
  description: string
  governmentBaseMinor: number
  serviceBaseMinor: number
}

const ENTITY_OPTIONS: EntityOption[] = [
  {
    id: "ltd_shares",
    code: "company_limited_by_shares",
    name: "Company Limited by Shares (LTD)",
    tag: "Most Popular",
    description: "Standard private liability company for tech startups, trading, consulting, and growth ventures.",
    governmentBaseMinor: 29500, // Name reservation (2500) + Filing (27000)
    serviceBaseMinor: 150000,
  },
  {
    id: "sole_proprietorship",
    code: "sole_proprietorship",
    name: "Sole Proprietorship",
    tag: "Lowest Cost",
    description: "Registered trade name for single Ghanaian individual. Quickest setup, zero corporate separation.",
    governmentBaseMinor: 12000,
    serviceBaseMinor: 75000,
  },
  {
    id: "partnership",
    code: "partnership",
    name: "Incorporated Partnership",
    tag: "2-20 Partners",
    description: "For two or more professionals or business partners operating under a joint agreement.",
    governmentBaseMinor: 26500,
    serviceBaseMinor: 100000,
  },
  {
    id: "ltd_guarantee",
    code: "company_limited_by_guarantee",
    name: "Company Limited by Guarantee (NGO)",
    tag: "Non-Profit",
    description: "For non-governmental organizations, philanthropic foundations, and religious associations.",
    governmentBaseMinor: 29500,
    serviceBaseMinor: 180000,
  },
  {
    id: "external_company",
    code: "external_company",
    name: "External Company (Ghana Branch)",
    tag: "Foreign Parent",
    description: "Registration of an existing foreign corporation as a registered branch in Ghana.",
    governmentBaseMinor: 652500,
    serviceBaseMinor: 250000,
  },
]

export default function FeeCalculatorPage() {
  const [selectedEntity, setSelectedEntity] = useState<EntityOption>(ENTITY_OPTIONS[0])
  const [isForeign, setIsForeign] = useState(false)
  const [includeAddress, setIncludeAddress] = useState(false)
  const [includeCompliance, setIncludeCompliance] = useState(false)
  const [includeBookkeeping, setIncludeBookkeeping] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)

  const { currency, setCurrency, convert } = useCurrency()
  const { compliance } = useLandingConfig()

  // Fetch real-time fee items from public API endpoint
  const { data: quotePreview } = useQuery({
    queryKey: ["publicQuotePreview", selectedEntity.code, isForeign],
    queryFn: () => getQuotePreview(selectedEntity.code, isForeign),
    staleTime: 1000 * 60 * 15,
  })

  // Calculate pricing with add-ons
  const addressCostMinor = 250000 // GHS 2,500/year (250000 pesewas)
  const complianceCostMinor = compliance.annualPrice ? compliance.annualPrice * 100 : 99900
  const bookkeepingCostMinor = 240000 // GHS 2,400 for first 3 months bundle (Service 4 Limited)

  const baseGovMinor = quotePreview?.subtotal_government_minor ?? (isForeign ? 1229500 : selectedEntity.governmentBaseMinor)
  const baseServiceMinor = quotePreview?.subtotal_service_minor ?? selectedEntity.serviceBaseMinor

  const totalAddonsMinor =
    (includeAddress ? addressCostMinor : 0) +
    (includeCompliance ? complianceCostMinor : 0) +
    (includeBookkeeping ? bookkeepingCostMinor : 0)
  const grandTotalMinor = baseGovMinor + baseServiceMinor + totalAddonsMinor

  const formatMinor = (minor: number) => {
    return convert(minor / 100, "GHS")
  }

  // Schema.org FAQ Data
  const faqData = useMemo(
    () => [
      {
        question: "Are government statutory fees included in Deevale GH packages?",
        answer:
          "Yes. Our calculator and quotes clearly itemize government statutory fees (ORC filing, name reservation, stamp duties) at exact cost alongside our transparent professional service fees. There are no hidden surcharges.",
      },
      {
        question: "How does foreign ownership affect the total registration cost?",
        answer:
          "If any shareholder is a non-Ghanaian citizen, the enterprise is subject to Ghana Investment Promotion Centre (GIPC) registration. GIPC statutory registration fee is ~GHS 12,000, and minimum capital requirements apply depending on whether you operate as a Joint Venture ($200k) or Wholly Foreign ($500k).",
      },
      {
        question: "Can I pay in US Dollars or Ghanaian Cedis?",
        answer:
          "Yes. Deevale GH accepts domestic payments via Ghanaian Mobile Money (MTN MoMo, Telecel Cash, AT Money) and local cards, as well as international debit/credit cards (Visa, Mastercard) and wire transfers.",
      },
      {
        question: "What is included in the Registered Office Address add-on?",
        answer:
          "The add-on provides an official commercial registered office address at Atlantic Tower, Airport City, Accra, complete with GhanaPost GPS digital address, mail receipt, and mail scanning in our virtual mailroom.",
      },
      {
        question: "Can I bundle business registration with bookkeeping and monthly tax filing?",
        answer:
          "Yes. Selecting the 1st Quarter Bookkeeping & Tax Bundle adds 3 months of full-service financial management by Service 4 Limited at a 25% discount. This covers your initial chart of accounts, bank reconciliations, employee payroll, and mandatory monthly GRA VAT/WHT filings.",
      },
    ],
    []
  )

  const jsonLdData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "Ghana Business Registration Fee Calculator",
        "url": "https://deevalegh.com/calculator",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "description":
          "Instant calculation of ORC government filing fees, statutory stamp duty, and professional service fees for incorporating a business in Ghana.",
        "offers": {
          "@type": "Offer",
          "price": (grandTotalMinor / 100).toFixed(2),
          "priceCurrency": "GHS",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqData.map((f) => ({
          "@type": "Question",
          "name": f.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": f.answer,
          },
        })),
      },
    ],
    [grandTotalMinor, faqData]
  )

  return (
    <div className="bg-background min-h-svh text-foreground">
      <SEO
        title="Ghana Business Registration Fee Calculator (2026) | ORC & GIPC Costs"
        description="Calculate instant, itemized government filing fees and service costs for registering a business in Ghana. Transparent fees for LLC, Sole Proprietorship, and GIPC foreign companies."
        canonicalUrl="https://deevalegh.com/calculator"
        keywords="ghana company registration fee calculator, cost of registering a business in ghana, orc registration fees 2026, gipc registration fee, company limited by shares cost ghana"
        jsonLd={jsonLdData}
      />

      <PublicHeader currency={currency} onCurrencyChange={setCurrency} />

      {/* Hero Section */}
      <section className="border-border relative overflow-hidden border-b py-12 md:py-16">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 text-center">
          <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent-700 mb-3 inline-flex items-center gap-1.5 px-3 py-1 text-xs">
            <Calculator className="size-3.5" /> 2026 Official Statutory Fee Schedule
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Ghana Company Registration <span className="highlight-accent">Fee Calculator</span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base md:text-lg">
            Transparent pricing without the middlemen markup. Calculate exact ORC statutory filing
            fees, stamp duties, and professional incorporation costs in seconds.
          </p>
        </div>
      </section>

      {/* Calculator Grid */}
      <main className="mx-auto max-w-5xl px-4 py-10 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Controls Column */}
          <div className="space-y-8">
            {/* 1. Entity Selection */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-semibold tracking-wide uppercase">
                  1. Select Business Entity
                </label>
                <Link to="/guides/how-to-register-a-company-in-ghana-2026" className="text-primary hover:underline text-xs">
                  Not sure which? Read guide &rarr;
                </Link>
              </div>
              <div className="space-y-2.5">
                {ENTITY_OPTIONS.map((entity) => {
                  const isSelected = selectedEntity.id === entity.id
                  return (
                    <div
                      key={entity.id}
                      onClick={() => setSelectedEntity(entity)}
                      className={cn(
                        "border-border hover:border-primary/50 relative flex cursor-pointer items-start justify-between rounded-xl border p-4 transition-all",
                        isSelected && "border-primary bg-primary/5 ring-primary/20 ring-1"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{entity.name}</span>
                          <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                            {entity.tag}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs leading-relaxed">{entity.description}</p>
                      </div>
                      <div
                        className={cn(
                          "border-border mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                          isSelected && "border-primary bg-primary text-primary-foreground"
                        )}
                      >
                        {isSelected && <Check className="size-3" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 2. Ownership Track */}
            <div>
              <label className="mb-3 block text-sm font-semibold tracking-wide uppercase">
                2. Ownership Structure
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsForeign(false)}
                  className={cn(
                    "border-border hover:border-primary/50 flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                    !isForeign && "border-primary bg-primary/5 ring-primary/20 ring-1"
                  )}
                >
                  <Building2 className="text-primary size-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Wholly Ghanaian</p>
                    <p className="text-muted-foreground text-xs">100% Ghanaian citizen owned</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsForeign(true)}
                  className={cn(
                    "border-border hover:border-primary/50 flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                    isForeign && "border-primary bg-primary/5 ring-primary/20 ring-1"
                  )}
                >
                  <Globe2 className="text-accent-600 size-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Foreign / Expat</p>
                    <p className="text-muted-foreground text-xs">Includes GIPC registration</p>
                  </div>
                </button>
              </div>

              {isForeign && (
                <div className="border-border bg-secondary/50 mt-3 rounded-lg border p-3 text-xs leading-relaxed">
                  <div className="text-foreground flex items-center gap-1.5 font-semibold">
                    <Info className="size-4 text-amber-600 shrink-0" /> GIPC Minimum Capital Requirement Notice
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Foreign participation requires GIPC registration (~GHS 12,000 fee included) and statutory capital:{" "}
                    <strong>$200,000</strong> for Joint Venture (10% Ghanaian) or <strong>$500,000</strong> for 100% foreign equity.
                  </p>
                </div>
              )}
            </div>

            {/* 3. Optional Add-ons */}
            <div>
              <label className="mb-3 block text-sm font-semibold tracking-wide uppercase">
                3. High-Value Add-Ons
              </label>
              <div className="space-y-2.5">
                <label
                  className={cn(
                    "border-border hover:border-primary/50 flex cursor-pointer flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition-all",
                    includeAddress && "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={includeAddress}
                      onChange={(e) => setIncludeAddress(e.target.checked)}
                      className="accent-primary mt-1 size-4 rounded shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Registered Office Address (Airport City, Accra)</span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Atlantic Tower address, digital GPS code, mailroom reception & digital scanning for 1 year.
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold shrink-0 sm:text-right pl-7 sm:pl-0">{formatMinor(addressCostMinor)}/yr</span>
                </label>

                <label
                  className={cn(
                    "border-border hover:border-primary/50 flex cursor-pointer flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition-all",
                    includeCompliance && "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={includeCompliance}
                      onChange={(e) => setIncludeCompliance(e.target.checked)}
                      className="accent-primary mt-1 size-4 rounded shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Annual Corporate Compliance Care Plan</span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Statutory deadline monitoring, ORC annual returns filing, and corporate secretarial retainers.
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold shrink-0 sm:text-right pl-7 sm:pl-0">{formatMinor(complianceCostMinor)}/yr</span>
                </label>

                <label
                  className={cn(
                    "border-border hover:border-primary/50 flex cursor-pointer flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition-all",
                    includeBookkeeping && "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={includeBookkeeping}
                      onChange={(e) => setIncludeBookkeeping(e.target.checked)}
                      className="accent-primary mt-1 size-4 rounded shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">1st Quarter Bookkeeping &amp; Tax Bundle (Service 4 Ltd)</span>
                        <Badge variant="secondary" className="text-[10px] bg-accent/20 text-accent-700">Recommended</Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        3 months of full bookkeeping, bank reconciliation, staff payroll (PAYE/SSNIT), and monthly GRA VAT/WHT filing.
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold shrink-0 sm:text-right pl-7 sm:pl-0">{formatMinor(bookkeepingCostMinor)}/3mo</span>
                </label>
              </div>
            </div>
          </div>

          {/* Quote Breakdown Card (Sticky) */}
          <div>
            <div className="sticky top-20">
              <Card className="border-border shadow-card-lg rounded-2xl">
                <CardHeader className="border-border border-b pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">Itemized Estimate</span>
                      <CardTitle className="text-xl font-bold">{selectedEntity.name}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {currency}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4 text-sm">
                  {/* Itemized lines */}
                  <div className="space-y-2">
                    <div className="text-muted-foreground flex justify-between text-xs font-medium uppercase">
                      <span>Fee Item</span>
                      <span>Estimated Amount</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="text-muted-foreground size-3.5" /> ORC Government Statutory Fees
                      </span>
                      <span className="font-medium">{formatMinor(baseGovMinor)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="text-muted-foreground size-3.5" /> Deevale GH Professional Service
                      </span>
                      <span className="font-medium">{formatMinor(baseServiceMinor)}</span>
                    </div>

                    {isForeign && (
                      <div className="flex justify-between text-accent-700">
                        <span className="flex items-center gap-1.5">
                          <Globe2 className="size-3.5" /> GIPC Statutory Registration Filing
                        </span>
                        <span className="font-medium">Included</span>
                      </div>
                    )}

                    {includeAddress && (
                      <div className="flex justify-between">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="text-muted-foreground size-3.5" /> Registered Office (1 Year)
                        </span>
                        <span className="font-medium">{formatMinor(addressCostMinor)}</span>
                      </div>
                    )}

                    {includeCompliance && (
                      <div className="flex justify-between">
                        <span className="flex items-center gap-1.5">
                          <Check className="text-muted-foreground size-3.5" /> Annual Compliance Retainer
                        </span>
                        <span className="font-medium">{formatMinor(complianceCostMinor)}</span>
                      </div>
                    )}

                    {includeBookkeeping && (
                      <div className="flex justify-between text-primary">
                        <span className="flex items-center gap-1.5">
                          <Receipt className="size-3.5" /> 1st Qtr Bookkeeping &amp; Tax (Service 4)
                        </span>
                        <span className="font-medium">{formatMinor(bookkeepingCostMinor)}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Totals */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Government statutory portion:</span>
                      <span>{formatMinor(baseGovMinor)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Service &amp; add-ons portion:</span>
                      <span>{formatMinor(baseServiceMinor + totalAddonsMinor)}</span>
                    </div>
                    <div className="flex items-baseline justify-between pt-2">
                      <span className="text-base font-bold">Total All-In Fee</span>
                      <div className="text-right">
                        <span className="text-2xl font-extrabold text-foreground">
                          {formatMinor(grandTotalMinor)}
                        </span>
                        <p className="text-muted-foreground text-[11px]">Indicative estimate based on active schedule</p>
                      </div>
                    </div>
                  </div>

                  {/* Primary CTA */}
                  <div className="space-y-2 pt-2">
                    <Button
                      render={
                        <Link to={`/signup?entity=${selectedEntity.code}&foreign=${isForeign ? "1" : "0"}`}>
                          Start Registration with this Quote <ArrowRight className="size-4 ml-1.5" />
                        </Link>
                      }
                      nativeButton={false}
                      className="w-full justify-center"
                      size="lg"
                    />

                    <p className="text-muted-foreground text-center text-xs">
                      No commitment required to create your account. We review your details before any payment.
                    </p>
                  </div>

                  {/* Trust badges */}
                  <div className="border-border bg-secondary/40 rounded-xl border p-3">
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <ShieldCheck className="text-primary size-3.5 shrink-0" /> Act 992 Compliant
                      </div>
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Check className="text-accent-600 size-3.5 shrink-0" /> Direct ORC Portal Filing
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* FAQs Section */}
        <section className="mt-16 border-t border-border pt-12">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Frequently Asked Questions on Fees</h2>
            <p className="text-muted-foreground text-sm mt-2">
              Everything you need to know about official fees and pricing when registering a company in Ghana.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {faqData.map((faq, idx) => {
              const isOpen = openFaqIndex === idx
              return (
                <div
                  key={faq.question}
                  className="border-border rounded-xl border bg-card transition-all overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between p-4 text-left font-semibold text-sm hover:bg-secondary/40"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown className={cn("size-4 transition-transform duration-200", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="p-4 pt-0 text-xs leading-relaxed text-muted-foreground border-t border-border/50 mt-1">
                      {faq.answer}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-border text-muted-foreground border-t px-4 py-8 text-xs text-center">
        <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-between gap-4">
          <Wordmark size="sm" />
          <div className="flex gap-4">
            <Link to="/guides" className="hover:underline">Statutory Guides</Link>
            <Link to="/legal/terms" className="hover:underline">Terms of Service</Link>
            <Link to="/legal/privacy" className="hover:underline">Privacy Policy</Link>
            <Link to="/login" className="hover:underline">Log in</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Deevale GH. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
