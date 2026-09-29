import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, BookOpen, Calculator, Clock } from "lucide-react"

import { GUIDES } from "@/data/guidesData"
import { Wordmark } from "@/components/Wordmark"
import { SEO } from "@/components/SEO"
import { PublicHeader } from "@/components/public/PublicHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export default function GuidesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All")

  const categories = ["All", "Incorporation", "Foreign Investment", "Compliance & Tax"]

  const filteredGuides = selectedCategory === "All"
    ? GUIDES
    : GUIDES.filter((g) => g.category === selectedCategory)

  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Ghana Business & Company Registration Statutory Guides",
    "url": "https://deevalegh.com/guides",
    "description":
      "Legal-grade statutory guides on business registration, GIPC foreign direct investment requirements, and annual compliance in Ghana under Companies Act 2019.",
    "hasPart": GUIDES.map((g) => ({
      "@type": "Article",
      "headline": g.title,
      "url": `https://deevalegh.com/guides/${g.slug}`,
      "description": g.metaDescription,
    })),
  }

  return (
    <div className="bg-background min-h-svh text-foreground">
      <SEO
        title="Ghana Business Registration & Statutory Compliance Guides (2026)"
        description="Comprehensive, statutory guides to company incorporation, ORC procedures, GIPC foreign investor requirements, and GRA tax compliance in Ghana."
        canonicalUrl="https://deevalegh.com/guides"
        keywords="ghana company registration guides, how to register a business in ghana, orc company formation, gipc foreign investment guide, ghana compliance calendar"
        jsonLd={jsonLdData}
      />

      <PublicHeader />

      {/* Hero */}
      <section className="border-border relative overflow-hidden border-b py-14 md:py-20">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 text-center">
          <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent-700 mb-3 inline-flex items-center gap-1.5 px-3 py-1 text-xs">
            <BookOpen className="size-3.5" /> Ghana Corporate Statutory Knowledge Hub
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Doing Business in Ghana: <span className="highlight-accent">The Statutory Guides</span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base md:text-lg">
            Straightforward legal insights on the Companies Act 2019 (Act 992), GIPC foreign investment rules,
            and corporate statutory obligations in Ghana - without the confusing legal jargon.
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

      {/* Guides Grid */}
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filteredGuides.map((guide) => (
            <Card key={guide.slug} className="border-border shadow-card hover:shadow-card-lg flex flex-col justify-between transition-all rounded-2xl overflow-hidden group">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between text-xs">
                  <Badge variant="secondary" className="font-medium text-[11px]">
                    {guide.category}
                  </Badge>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" /> {guide.readTime}
                  </span>
                </div>
                <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors leading-snug">
                  <Link to={`/guides/${guide.slug}`}>{guide.title}</Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3">
                  {guide.summary}
                </p>
                <div className="border-t border-border/60 pt-4 flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">Updated {guide.lastUpdated}</span>
                  <Link
                    to={`/guides/${guide.slug}`}
                    className="text-primary hover:text-primary/80 font-semibold text-xs inline-flex items-center gap-1"
                  >
                    Read Guide <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
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
            <h3 className="text-xl font-bold">Need an instant fee breakdown for your company?</h3>
            <p className="text-muted-foreground text-sm">
              Use our official Ghana Incorporation Fee Calculator to see itemized government statutory fees and professional package costs in GHS or USD.
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
