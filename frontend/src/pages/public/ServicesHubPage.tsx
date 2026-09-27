import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Calculator, Clock, ShieldCheck } from "lucide-react"

import { SERVICES } from "@/data/servicesData"
import { Wordmark } from "@/components/Wordmark"
import { SEO } from "@/components/SEO"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export default function ServicesHubPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All")
  const categories = ["All", "Entity Incorporation", "Regulatory & Compliance"]

  const filteredServices =
    selectedCategory === "All"
      ? SERVICES
      : SERVICES.filter((s) => s.category === selectedCategory)

  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Ghana Business Registration & Statutory Secretarial Services",
    "url": "https://deevalegh.com/services",
    "description":
      "Official statutory business formation and corporate compliance services in Ghana. Company Limited by Shares, Sole Proprietorship, GIPC Foreign Investor Setup, GRA Tax TIN, and SSNIT filing.",
    "hasPart": SERVICES.map((s) => ({
      "@type": "Service",
      "name": s.title,
      "url": `https://deevalegh.com/services/${s.slug}`,
      "description": s.metaDescription,
    })),
  }

  return (
    <div className="bg-background min-h-svh text-foreground">
      <SEO
        title="Business Registration & Statutory Services in Ghana | Deevale GH"
        description="Comprehensive statutory services in Ghana: Company Limited by Shares, Sole Proprietorship, GIPC Foreign Investor Registration, GRA Tax, SSNIT, and Business Operating Permits."
        canonicalUrl="https://deevalegh.com/services"
        keywords="ghana business services, register company in ghana, orc company formation, gipc registration, gra corporate tin, ssnit employer registration, business permit accra"
        jsonLd={jsonLdData}
      />

      {/* Header */}
      <header className="border-border bg-background/90 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Wordmark size="md" />
          <nav className="flex items-center gap-3">
            <Link to="/calculator" className="text-muted-foreground hover:text-foreground hidden text-sm font-medium sm:block">
              Fee Calculator
            </Link>
            <Link to="/guides" className="text-muted-foreground hover:text-foreground hidden text-sm font-medium sm:block">
              Statutory Guides
            </Link>
            <Button render={<Link to="/signup">Get Started</Link>} nativeButton={false} size="sm" />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-border relative overflow-hidden border-b py-14 md:py-20">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 text-center">
          <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent-700 mb-3 inline-flex items-center gap-1.5 px-3 py-1 text-xs">
            <ShieldCheck className="size-3.5" /> Corporate Secretarial &amp; Statutory Setup
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Ghana Company Registration &amp; <span className="highlight-accent">Statutory Services</span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base md:text-lg">
            Complete company formation and ongoing regulatory filings across the ORC, GIPC, GRA, and SSNIT — executed with speed, compliance, and transparent pricing.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "border-border rounded-full border px-4 py-1.5 text-xs font-semibold transition-all",
                  selectedCategory === cat
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          {filteredServices.map((service) => (
            <Card
              key={service.slug}
              className="border-border shadow-card hover:shadow-card-lg flex flex-col justify-between transition-all rounded-2xl overflow-hidden group"
            >
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between text-xs">
                  <Badge variant="secondary" className="font-medium text-[11px]">
                    {service.category}
                  </Badge>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" /> {service.timeline}
                  </span>
                </div>
                <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors leading-snug">
                  <Link to={`/services/${service.slug}`}>{service.title}</Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3">
                  {service.snippet}
                </p>

                <div className="rounded-lg bg-secondary/50 p-2.5 text-xs flex items-center justify-between">
                  <span className="text-muted-foreground">{service.agency}</span>
                  <span className="font-semibold text-primary">From GHS {(service.indicativeFeeMinor / 100).toLocaleString()}</span>
                </div>

                <div className="border-t border-border/60 pt-3 flex items-center justify-between">
                  <Link
                    to={service.entityCode ? `/calculator?entity=${service.entityCode}` : `/calculator`}
                    className="text-muted-foreground hover:text-foreground text-xs inline-flex items-center gap-1"
                  >
                    <Calculator className="size-3" /> Estimate Fee
                  </Link>
                  <Link
                    to={`/services/${service.slug}`}
                    className="text-primary hover:text-primary/80 font-semibold text-xs inline-flex items-center gap-1"
                  >
                    View Details <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Free Tool Banner */}
        <section className="mt-16 rounded-2xl border border-border bg-gradient-to-r from-secondary/60 via-background to-secondary/60 p-8 text-center md:text-left md:flex items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <Badge variant="outline" className="text-xs border-primary/40 text-primary">
              Interactive Tool
            </Badge>
            <h3 className="text-xl font-bold">Calculate exact ORC statutory filing fees</h3>
            <p className="text-muted-foreground text-sm">
              Use our live fee calculator to see itemized government statutory charges, stamp duties, and professional service fees.
            </p>
          </div>
          <div className="mt-4 md:mt-0 shrink-0">
            <Button
              render={
                <Link to="/calculator">
                  <Calculator className="size-4 mr-2" /> Launch Fee Calculator
                </Link>
              }
              nativeButton={false}
              size="lg"
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-border text-muted-foreground border-t px-4 py-8 text-xs text-center">
        <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-between gap-4">
          <Wordmark size="sm" />
          <div className="flex gap-4">
            <Link to="/calculator" className="hover:underline">Fee Calculator</Link>
            <Link to="/guides" className="hover:underline">Statutory Guides</Link>
            <Link to="/legal/terms" className="hover:underline">Terms of Service</Link>
            <Link to="/legal/privacy" className="hover:underline">Privacy Policy</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Deevale GH. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
