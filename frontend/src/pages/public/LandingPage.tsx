import { useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  FileSignature,
  Globe2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Wordmark } from "@/components/Wordmark"
import { StageTracker } from "@/components/landing/StageTracker"
import { CertificateMark } from "@/components/landing/CertificateMark"
import { useInView } from "@/hooks/useInView"
import { cn } from "@/lib/utils"
import {
  company,
  compliance,
  entities,
  figures,
  gipc,
  hasTrustSignals,
  legal,
} from "@/config/landing"

// Deliberately not translated. tw.json is still a machine draft
// (_meta.reviewed:false); unreviewed Twi on the page whose whole job is
// building trust would undercut it. Revisit once a native review lands.

type Audience = "local" | "foreign"

/** Renders a configured figure, or an honest fallback when it is unset. */
function Figure({ value, fallback }: { value: string | null; fallback: string }) {
  if (!value) return <span className="text-muted-foreground font-normal">{fallback}</span>
  return <span>{value}</span>
}

/** A bordered square container, so icons read as one system rather than confetti. */
function IconTile({ icon: Icon }: { icon: typeof ShieldCheck }) {
  return (
    <span className="border-border bg-secondary text-accent flex size-9 items-center justify-center rounded-md border">
      <Icon className="size-4" />
    </span>
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
        surface === "ink" && "bg-primary text-primary-foreground"
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
              // accent-400 rather than --accent: brass at #8A6D3B is only
              // 3.61:1 on the ink ground, which fails AA at this size.
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
  const isForeign = audience === "foreign"
  const visibleEntities = entities.filter((e) => (isForeign ? true : !e.foreignTrack))

  return (
    <div className="bg-background min-h-svh">
      {/* Needs its own translucent ground: bare backdrop-blur left the header
          transparent, so the ink-navy wordmark vanished over the ink section. */}
      <header className="border-border bg-background/85 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Wordmark size="md" />
          <nav className="flex items-center gap-2">
            <Button render={<Link to="/login">Log in</Link>} nativeButton={false} variant="ghost" size="sm" />
            <Button render={<Link to="/signup">Get started</Link>} nativeButton={false} size="sm" />
          </nav>
        </div>
      </header>

      {/* Hero + the audience fork. The product itself branches on
          WorkflowDefinition.variant standard|foreign, so the page does too. */}
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-[1.05fr_0.95fr]">
          <div>
          <h1 className="text-3xl font-bold tracking-tight text-balance md:text-5xl">
            Register your business in Ghana, without the guesswork.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-lg">
            Incorporation, tax and SSNIT registration, and the filings that keep you compliant
            afterwards.
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

          {/* Chips rather than a paragraph: this restated the subhead, and a
              skimmer met three blocks of prose before reaching the CTA. */}
          <ul className="mt-6 flex flex-wrap gap-2">
            {(isForeign
              ? ["No travel required", "GIPC handled", "Ghanaian office address"]
              : ["Fixed, itemised pricing", "Government fees at cost", "Every stage tracked"]
            ).map((chip) => (
              <li
                key={chip}
                className="border-border text-foreground flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
              >
                <Check className="text-accent size-3.5" />
                {chip}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              render={
                <Link to="/signup">
                  Start your registration <ArrowRight />
                </Link>
              }
              nativeButton={false}
              size="lg"
            />
            <Button render={<a href="#pricing">See pricing</a>} nativeButton={false} variant="outline" size="lg" />
          </div>
          </div>

          {/* The page's main image: the product's own case timeline. */}
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
            <StageTracker audience={audience} />
          </div>
        </div>

        {/* Figures derived from the workflow library, not marketing claims. */}
        <dl className="mx-auto mt-16 grid max-w-5xl grid-cols-3 gap-6 border-t pt-8">
          {figures.map((f) => (
            <div key={f.label}>
              <dt className="font-heading text-3xl font-semibold md:text-4xl">{f.value}</dt>
              <dd className="text-muted-foreground mt-1 text-sm">{f.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {hasTrustSignals && (
        <div className="border-border bg-muted/30 border-y px-4 py-6">
          <div className="text-muted-foreground mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-3 text-sm">
            {company.registrationNumber && (
              <span className="flex items-center gap-2">
                <ShieldCheck className="text-primary size-4" />
                Registered in Ghana — {company.registrationNumber}
              </span>
            )}
            {company.yearsOperating && <span>{company.yearsOperating}+ years operating</span>}
            {company.casesCompleted && (
              <span>{company.casesCompleted.toLocaleString()} registrations completed</span>
            )}
            {company.dataProtectionNumber && (
              <span>Data Protection Commission — {company.dataProtectionNumber}</span>
            )}
          </div>
        </div>
      )}

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
        {/* The fee-split point now sits under the grid: it is reassurance, and
            it was standing between the reader and the actual prices. */}
        <div className="grid gap-4 md:grid-cols-2">
          {visibleEntities.map((entity) => (
            <Card key={entity.key} className="border-border">
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
                    <dd className="font-semibold">
                      <Figure value={entity.price} fallback="Request a quote" />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Typical time</dt>
                    <dd className="font-semibold">
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
        </p>
      </Section>

      <Section eyebrow="How it works" title="Four steps, tracked end to end" center>
        <ol className="grid gap-6 md:grid-cols-4">
          {[
            ["Tell us about the business", "A guided questionnaire works out the right structure and what the law requires of it."],
            ["Upload and sign", "Submit IDs and supporting documents once. Every party signs electronically."],
            ["We file it", "We lodge with the Registrar and follow up with GRA, SSNIT and your local assembly."],
            ["You're trading", "Certificates land in your document vault. Compliance deadlines start tracking automatically."],
          ].map(([title, body], i) => (
            <li key={title}>
              <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full text-sm font-semibold">
                {i + 1}
              </div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

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
              <Card key={label as string} className="border-border">
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-xs">{label}</p>
                  <p className="mt-1 text-lg font-semibold">
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

      <Section eyebrow="After you're registered" title="The part that catches people out" surface="ink">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="text-sm leading-relaxed">
              Registering is the easy part. Annual returns, tax filings, SSNIT and permit renewals
              carry penalties that accrue quietly until they don&apos;t. That risk is heaviest
              from another country.
            </p>
          </div>
          <Card className="border-border">
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm">Compliance plan, monthly</span>
                <span className="font-semibold">
                  <Figure value={compliance.monthlyPrice} fallback="Request a quote" />
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm">Compliance plan, annual</span>
                <span className="font-semibold">
                  <Figure value={compliance.annualPrice} fallback="Request a quote" />
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm">Registered office address</span>
                <span className="font-semibold">
                  <Figure value={compliance.registeredAddressPrice} fallback="Request a quote" />
                </span>
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

      <Section title="Ready to start?" width="narrow">
        <div className="grid items-center gap-10 sm:grid-cols-[1fr_auto]">
          <div>
        <div className="flex flex-wrap gap-3">
          <Button
            render={
              <Link to="/signup">
                Create your account <ArrowRight />
              </Link>
            }
            nativeButton={false}
            size="lg"
          />
          {company.whatsapp && (
            <Button
              render={<a href={`https://wa.me/${company.whatsapp}`}>Chat on WhatsApp</a>}
              nativeButton={false}
              variant="outline"
              size="lg"
            />
          )}
            </div>
            <p className="text-muted-foreground mt-4 text-sm">
              Most registrations start the same day we receive your documents.
            </p>
          </div>
          <CertificateMark className="hidden h-44 w-auto sm:block" />
        </div>
      </Section>

      <footer className="border-border text-muted-foreground border-t px-4 py-10 text-sm">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap justify-between gap-8">
            <div className="space-y-1">
              <p className="text-foreground font-semibold">{company.legalName ?? "Deevale GH"}</p>
              {company.address && (
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  {company.address}
                </p>
              )}
              {company.email && (
                <p className="flex items-center gap-2">
                  <Mail className="size-4 shrink-0" />
                  <a href={`mailto:${company.email}`} className="hover:underline">
                    {company.email}
                  </a>
                </p>
              )}
              {company.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0" />
                  <a href={`tel:${company.phone}`} className="hover:underline">
                    {company.phone}
                  </a>
                </p>
              )}
            </div>
            <nav className="flex flex-col gap-1">
              {legal.termsUrl && (
                <a href={legal.termsUrl} className="hover:underline">
                  Terms of service
                </a>
              )}
              {legal.privacyUrl && (
                <a href={legal.privacyUrl} className="hover:underline">
                  Privacy policy
                </a>
              )}
              {legal.refundUrl && (
                <a href={legal.refundUrl} className="hover:underline">
                  Refund policy
                </a>
              )}
              <Link to="/login" className="hover:underline">
                Log in
              </Link>
            </nav>
          </div>
          <p className="mt-8 text-xs">
            Deevale GH is a business registration and compliance service. We are not a law firm and
            do not provide legal advice.
          </p>
        </div>
      </footer>
    </div>
  )
}
