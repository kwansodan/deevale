import { useMemo, useState } from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileCheck,
  HelpCircle,
  Info,
  ShieldCheck,
} from "lucide-react"

import { SERVICES } from "@/data/servicesData"
import { Wordmark } from "@/components/Wordmark"
import { SEO } from "@/components/SEO"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export default function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const service = SERVICES.find((s) => s.slug === slug)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)

  if (!service) {
    return <Navigate to="/services" replace />
  }

  // Structured schemas: Service + HowTo + FAQPage + BreadcrumbList
  const jsonLdData = useMemo(() => {
    return [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        "@id": `https://deevalegh.com/services/${service.slug}#service`,
        "name": service.title,
        "serviceType": service.shortTitle,
        "description": service.metaDescription,
        "provider": {
          "@type": "LegalService",
          "name": "Deevale GH",
          "url": "https://deevalegh.com",
          "logo": "https://deevalegh.com/deevalegh-icon.svg",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "3rd Floor, Atlantic Tower, Airport City",
            "addressLocality": "Accra",
            "addressCountry": "GH",
          },
        },
        "areaServed": {
          "@type": "Country",
          "name": "Ghana",
        },
        "offers": {
          "@type": "Offer",
          "price": (service.indicativeFeeMinor / 100).toFixed(2),
          "priceCurrency": "GHS",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": `How to Complete ${service.shortTitle} in Ghana`,
        "description": service.snippet,
        "step": service.steps.map((step, idx) => ({
          "@type": "HowToStep",
          "position": idx + 1,
          "name": step.name,
          "text": step.description,
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": service.faqs.map((faq) => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer,
          },
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://deevalegh.com",
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Services",
            "item": "https://deevalegh.com/services",
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": service.shortTitle,
            "item": `https://deevalegh.com/services/${service.slug}`,
          },
        ],
      },
    ]
  }, [service])

  const calculatorQuery = service.entityCode
    ? `/calculator?entity=${service.entityCode}`
    : `/calculator`

  return (
    <div className="bg-background min-h-svh text-foreground">
      <SEO
        title={service.metaTitle}
        description={service.metaDescription}
        canonicalUrl={`https://deevalegh.com/services/${service.slug}`}
        keywords={service.keywords}
        jsonLd={jsonLdData}
      />

      {/* Header */}
      <header className="border-border bg-background/90 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Wordmark size="md" />
            <Link
              to="/services"
              className="text-muted-foreground hover:text-foreground hidden sm:flex items-center gap-1.5 text-xs font-medium border-l border-border pl-4"
            >
              <ArrowLeft className="size-3" /> All Services
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Button
              render={
                <Link to={calculatorQuery}>
                  <Calculator className="size-3.5 mr-1.5" /> Calculate Fees
                </Link>
              }
              variant="outline"
              size="sm"
            />
            <Button render={<Link to="/signup">Get Started</Link>} nativeButton={false} size="sm" />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-border bg-secondary/30 relative border-b py-10 md:py-16">
        <div className="mx-auto max-w-4xl px-4">
          <nav className="text-muted-foreground mb-4 flex items-center gap-2 text-xs">
            <Link to="/" className="hover:underline">Home</Link>
            <span>/</span>
            <Link to="/services" className="hover:underline">Services</Link>
            <span>/</span>
            <span className="text-foreground truncate">{service.shortTitle}</span>
          </nav>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="secondary" className="font-semibold text-xs">
              {service.category}
            </Badge>
            <Badge variant="outline" className="text-xs border-primary/40 text-primary">
              {service.heroBadge}
            </Badge>
          </div>

          <h1 className="text-2xl font-bold tracking-tight md:text-4xl text-balance">
            {service.title}
          </h1>

          {/* Snippet summary block for AEO / AI Overview extraction */}
          <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs md:text-sm leading-relaxed text-foreground font-medium">
            <span className="font-semibold text-primary block mb-1">Key Takeaway:</span>
            {service.snippet}
          </div>

          {/* Key Metric Pills */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border border-border bg-background p-3">
              <span className="text-muted-foreground block text-[11px]">Responsible Agency</span>
              <span className="font-semibold text-foreground mt-0.5 block truncate">{service.agency}</span>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <span className="text-muted-foreground block text-[11px]">Statutory Act</span>
              <span className="font-semibold text-foreground mt-0.5 block truncate">{service.statutoryAct}</span>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <span className="text-muted-foreground block text-[11px]">Filing SLA</span>
              <span className="font-semibold text-foreground mt-0.5 block">{service.timeline}</span>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <span className="text-muted-foreground block text-[11px]">Indicative Fee</span>
              <span className="font-semibold text-primary mt-0.5 block">From GHS {(service.indicativeFeeMinor / 100).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-10 md:py-14 space-y-12">
        {/* Deliverables */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
            <FileCheck className="size-5 text-primary" /> What Is Included in This Filing
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {service.deliverables.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2.5 rounded-xl border border-border p-3.5 bg-card">
                <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                <span className="text-xs md:text-sm">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Step-by-Step Chronological Workflow */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
            <Clock className="size-5 text-primary" /> Step-by-Step Filing Workflow
          </h2>
          <div className="space-y-3">
            {service.steps.map((step, idx) => (
              <div key={idx} className="rounded-xl border border-border p-4 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="size-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{step.name}</h3>
                    <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{step.description}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0 self-start sm:self-center text-xs">
                  {step.duration}
                </Badge>
              </div>
            ))}
          </div>
        </section>

        {/* Comparative / Statutory Table */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
            <Building2 className="size-5 text-primary" /> Statutory Requirements Matrix
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border shadow-xs">
            <table className="w-full text-left text-xs md:text-sm">
              <caption className="p-3 text-left font-semibold text-muted-foreground text-xs bg-muted/40 border-b border-border">
                {service.table.caption}
              </caption>
              <thead className="bg-muted/60 text-foreground font-semibold border-b border-border">
                <tr>
                  {service.table.headers.map((h, i) => (
                    <th key={i} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {service.table.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-muted/20 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-3 align-top leading-relaxed">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Requirements & Eligibility Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> Documents &amp; Info Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs md:text-sm">
              {service.requirements.map((req, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-accent-600 font-bold">•</span>
                  <span className="text-muted-foreground">{req}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Info className="size-4 text-primary" /> Who Needs This Filing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs md:text-sm">
              {service.whoNeedsThis.map((who, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-primary font-bold">✓</span>
                  <span className="text-muted-foreground">{who}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* FAQs */}
        {service.faqs.length > 0 && (
          <section className="space-y-4 border-t border-border pt-8">
            <h2 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
              <HelpCircle className="size-5 text-primary" /> Frequently Asked Questions
            </h2>
            <div className="space-y-3">
              {service.faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx
                return (
                  <div key={faq.question} className="border-border rounded-xl border bg-card transition-all overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="flex w-full items-center justify-between p-4 text-left font-semibold text-sm hover:bg-secondary/40"
                    >
                      <span>{faq.question}</span>
                      <ChevronDown className={cn("size-4 transition-transform duration-200", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                      <div className="p-4 pt-0 text-xs md:text-sm leading-relaxed text-muted-foreground border-t border-border/50 mt-1">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Bottom CTA Card */}
        <Card className="rounded-2xl border-primary/30 bg-gradient-to-br from-primary/5 via-secondary/20 to-accent/5 p-6 shadow-card-lg">
          <CardContent className="p-0 space-y-4 text-center sm:text-left sm:flex items-center justify-between gap-6">
            <div className="space-y-1.5">
              <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                Instant Online Onboarding
              </Badge>
              <h3 className="text-xl font-bold">Start Your {service.shortTitle} with Deevale GH</h3>
              <p className="text-muted-foreground text-xs md:text-sm max-w-lg">
                Transparent statutory pricing, live milestone tracking, and expert Ghanaian corporate secretarial support.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <Button
                render={
                  <Link to={calculatorQuery}>
                    <Calculator className="size-4 mr-1.5" /> Calculate Exact Fee
                  </Link>
                }
                variant="outline"
              />
              <Button
                render={
                  <Link to={`/signup?service=${service.slug}`}>
                    Get Started <ArrowRight className="size-4 ml-1.5" />
                  </Link>
                }
              />
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-border text-muted-foreground border-t px-4 py-8 text-xs text-center">
        <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-between gap-4">
          <Wordmark size="sm" />
          <div className="flex gap-4">
            <Link to="/services" className="hover:underline">All Services</Link>
            <Link to="/calculator" className="hover:underline">Fee Calculator</Link>
            <Link to="/guides" className="hover:underline">Statutory Guides</Link>
            <Link to="/legal/terms" className="hover:underline">Terms</Link>
            <Link to="/legal/privacy" className="hover:underline">Privacy</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Deevale GH. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
