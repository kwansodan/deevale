import { useMemo, useState } from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  ChevronDown,
  Clock,
  Info,
  Lightbulb,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react"

import { GUIDES } from "@/data/guidesData"
import { Wordmark } from "@/components/Wordmark"
import { SEO } from "@/components/SEO"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export default function GuideDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const guide = GUIDES.find((g) => g.slug === slug)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)

  if (!guide) {
    return <Navigate to="/guides" replace />
  }

  // JSON-LD structured data: Article + FAQPage + HowTo (if steps present) + BreadcrumbList
  const jsonLdData = useMemo(() => {
    const schemas: Record<string, unknown>[] = [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": guide.title,
        "description": guide.metaDescription,
        "author": {
          "@type": "Organization",
          "name": "Deevale GH",
          "url": "https://www.deevalegh.com",
        },
        "publisher": {
          "@type": "Organization",
          "name": "Deevale GH",
          "logo": {
            "@type": "ImageObject",
            "url": "https://www.deevalegh.com/deevalegh-icon.svg",
          },
        },
        "dateModified": "2026-03-01",
        "datePublished": "2026-01-15",
        "mainEntityOfPage": `https://www.deevalegh.com/guides/${guide.slug}`,
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": guide.faqs.map((f) => ({
          "@type": "Question",
          "name": f.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": f.answer,
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
            "item": "https://www.deevalegh.com",
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Statutory Guides",
            "item": "https://www.deevalegh.com/guides",
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": guide.shortTitle,
            "item": `https://www.deevalegh.com/guides/${guide.slug}`,
          },
        ],
      },
    ]

    if (guide.howToSteps && guide.howToSteps.length > 0) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": guide.title,
        "description": guide.metaDescription,
        "step": guide.howToSteps.map((step, idx) => ({
          "@type": "HowToStep",
          "position": idx + 1,
          "name": step.name,
          "text": step.text,
          "url": `https://www.deevalegh.com/guides/${guide.slug}#${step.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        })),
      })
    }

    return schemas
  }, [guide])

  return (
    <div className="bg-background min-h-svh text-foreground">
      <SEO
        title={`${guide.shortTitle} — 2026 Statutory Guide`}
        description={guide.metaDescription}
        canonicalUrl={`https://www.deevalegh.com/guides/${guide.slug}`}
        keywords={guide.keywords}
        ogType="article"
        jsonLd={jsonLdData}
      />

      {/* Header */}
      <header className="border-border bg-background/90 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Wordmark size="md" />
            <Link
              to="/guides"
              className="text-muted-foreground hover:text-foreground hidden sm:flex items-center gap-1.5 text-xs font-medium border-l border-border pl-4"
            >
              <ArrowLeft className="size-3" /> All Guides
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Button
              render={
                <Link to="/calculator">
                  <Calculator className="size-3.5 mr-1.5" /> Fee Calculator
                </Link>
              }
              variant="outline"
              size="sm"
            />
            <Button render={<Link to="/signup">Start Registration</Link>} nativeButton={false} size="sm" />
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="border-border bg-secondary/30 relative border-b py-10 md:py-16">
        <div className="mx-auto max-w-4xl px-4">
          <nav className="text-muted-foreground mb-4 flex items-center gap-2 text-xs">
            <Link to="/" className="hover:underline">Home</Link>
            <span>/</span>
            <Link to="/guides" className="hover:underline">Guides</Link>
            <span>/</span>
            <span className="text-foreground truncate max-w-[200px] sm:max-w-none">{guide.shortTitle}</span>
          </nav>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="secondary" className="font-semibold text-xs">
              {guide.category}
            </Badge>
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Clock className="size-3" /> {guide.readTime}
            </span>
            <span className="text-muted-foreground text-xs">•</span>
            <span className="text-muted-foreground text-xs">Updated {guide.lastUpdated}</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight md:text-4xl text-balance">
            {guide.title}
          </h1>

          <p className="text-muted-foreground mt-4 text-base md:text-lg leading-relaxed">
            {guide.subtitle}
          </p>

          <div className="border-border bg-background mt-6 rounded-xl border p-4 text-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-primary size-5 shrink-0" />
              <span>Authored by <strong>{guide.author}</strong> in accordance with Ghanaian Act 992 &amp; Act 865</span>
            </div>
            <Link to="/calculator" className="text-primary font-semibold hover:underline shrink-0 hidden sm:inline">
              Calculate official fees &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <main className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
          {/* Table of Contents (Sticky Desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 rounded-xl border border-border p-4 bg-card/60">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Table of Contents
              </p>
              <nav className="space-y-2 text-xs">
                {guide.tableOfContents.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block text-muted-foreground hover:text-primary transition-colors py-1 leading-snug"
                  >
                    {item.title}
                  </a>
                ))}
              </nav>

              <Separator className="my-4" />

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-foreground">Need quick numbers?</p>
                <Link
                  to="/calculator"
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                >
                  <Calculator className="size-3" /> Launch Fee Calculator &rarr;
                </Link>
              </div>
            </div>
          </aside>

          {/* Article Body */}
          <article className="max-w-3xl space-y-10">
            {/* Executive Summary */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-sm leading-relaxed">
              <strong className="text-primary block font-semibold mb-1">Executive Summary</strong>
              <p className="text-muted-foreground">{guide.summary}</p>
            </div>

            {/* Sections */}
            {guide.sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24 space-y-4">
                <h2 className="text-xl font-bold tracking-tight md:text-2xl border-b border-border pb-2">
                  {section.title}
                </h2>

                {section.snippet && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs md:text-sm leading-relaxed text-foreground font-medium">
                    <span className="font-semibold text-primary block mb-1">Key Takeaway:</span>
                    {section.snippet}
                  </div>
                )}

                <div className="space-y-3 text-sm md:text-base leading-relaxed text-muted-foreground whitespace-pre-line font-sans">
                  {section.content}
                </div>

                {section.table && (
                  <div className="my-6 overflow-x-auto rounded-xl border border-border shadow-xs">
                    <table className="w-full text-left text-xs md:text-sm">
                      {section.table.caption && (
                        <caption className="p-3 text-left font-semibold text-muted-foreground text-xs bg-muted/40 border-b border-border">
                          {section.table.caption}
                        </caption>
                      )}
                      <thead className="bg-muted/60 text-foreground font-semibold border-b border-border">
                        <tr>
                          {section.table.headers.map((h, i) => (
                            <th key={i} className="p-3">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {section.table.rows.map((row, rIdx) => (
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
                )}

                {section.callout && (
                  <div
                    className={cn(
                      "rounded-xl border p-4 text-xs md:text-sm leading-relaxed flex items-start gap-3",
                      section.callout.type === "tip" && "border-primary/30 bg-primary/5 text-foreground",
                      section.callout.type === "warning" && "border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-200",
                      section.callout.type === "info" && "border-border bg-secondary text-foreground"
                    )}
                  >
                    {section.callout.type === "tip" && <Lightbulb className="size-5 text-primary shrink-0 mt-0.5" />}
                    {section.callout.type === "warning" && <ShieldAlert className="size-5 text-amber-600 shrink-0 mt-0.5" />}
                    {section.callout.type === "info" && <Info className="size-5 text-primary shrink-0 mt-0.5" />}
                    <div>
                      <strong className="block font-semibold mb-0.5 capitalize">
                        Statutory {section.callout.type}
                      </strong>
                      <span>{section.callout.text}</span>
                    </div>
                  </div>
                )}
              </section>
            ))}

            {/* FAQs Accordion */}
            {guide.faqs.length > 0 && (
              <section id="faqs" className="scroll-mt-24 border-t border-border pt-8 space-y-4">
                <h2 className="text-xl font-bold tracking-tight md:text-2xl">
                  Frequently Asked Questions
                </h2>

                <div className="space-y-3">
                  {guide.faqs.map((faq, idx) => {
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

            {/* In-Article Conversion Card */}
            <Card className="rounded-2xl border-primary/30 bg-gradient-to-br from-primary/5 via-secondary/20 to-accent/5 p-6 shadow-card-lg">
              <CardContent className="p-0 space-y-4 text-center sm:text-left sm:flex items-center justify-between gap-6">
                <div className="space-y-1.5">
                  <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                    Start Your Filing
                  </Badge>
                  <h3 className="text-xl font-bold">Register your Ghana company without the hassle</h3>
                  <p className="text-muted-foreground text-xs md:text-sm max-w-lg">
                    Deevale GH handles ORC filing, tax setup, and registered address with live milestone tracking.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <Button
                    render={
                      <Link to="/calculator">
                        <Calculator className="size-4 mr-1.5" /> Calculate Fees
                      </Link>
                    }
                    variant="outline"
                  />
                  <Button
                    render={
                      <Link to="/signup">
                        Create Account <ArrowRight className="size-4 ml-1.5" />
                      </Link>
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </article>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-border text-muted-foreground border-t px-4 py-8 text-xs text-center">
        <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-between gap-4">
          <Wordmark size="sm" />
          <div className="flex gap-4">
            <Link to="/calculator" className="hover:underline">Fee Calculator</Link>
            <Link to="/guides" className="hover:underline">All Guides</Link>
            <Link to="/legal/terms" className="hover:underline">Terms of Service</Link>
            <Link to="/legal/privacy" className="hover:underline">Privacy Policy</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Deevale GH. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
