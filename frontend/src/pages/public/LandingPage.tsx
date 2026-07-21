import { useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  Building2,
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
import {
  company,
  compliance,
  entities,
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

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id?: string
  eyebrow?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="border-border border-t px-4 py-16 md:py-24">
      <div className="mx-auto max-w-5xl">
        {eyebrow && (
          <p className="text-primary mb-2 text-sm font-semibold tracking-wide uppercase">{eyebrow}</p>
        )}
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
        <div className="mt-8">{children}</div>
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
      <header className="border-border sticky top-0 z-10 border-b backdrop-blur">
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
        <div className="mx-auto max-w-5xl">
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-balance md:text-5xl">
            Register your business in Ghana, without the guesswork.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-lg">
            We handle incorporation with the Office of the Registrar of Companies, tax and SSNIT
            registration, and the filings that keep you compliant afterwards. You track every stage
            online.
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

          <Card className="border-border mt-8 max-w-2xl">
            <CardContent className="pt-6">
              {isForeign ? (
                <p className="text-sm leading-relaxed">
                  You can own a Ghanaian company as a non-resident and complete the entire process
                  without travelling. We prepare the GIPC registration, handle notarised
                  home-country documents, and give you a registered Ghanaian office address for
                  official correspondence.
                </p>
              ) : (
                <p className="text-sm leading-relaxed">
                  Fixed, itemised pricing with government fees shown at cost. Submit your details
                  and ID once, then follow each stage — name reservation, incorporation, TIN, SSNIT
                  — from your dashboard instead of chasing anyone for updates.
                </p>
              )}
            </CardContent>
          </Card>

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

      <Section eyebrow="Remote by default" title="You never have to be in the room">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: FileSignature,
              title: "Sign electronically",
              body: "Constitutions, consent forms and partnership deeds are signed online, in the right order, by every party — wherever they are.",
            },
            {
              icon: ShieldCheck,
              title: "Upload ID securely",
              body: "Passports and national IDs go straight into an encrypted vault. Each co-founder verifies themselves on their own account.",
            },
            {
              icon: MapPin,
              title: "Use our address",
              body: "Take a registered Ghanaian office address. We receive your official mail, scan it, and it appears in your dashboard.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <Icon className="text-primary size-5" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="pricing"
        eyebrow="Pricing"
        title="What it costs, all in"
      >
        <p className="text-muted-foreground -mt-4 mb-8 max-w-2xl text-sm">
          Every quote separates the government fee from our service fee, so you always know what is
          a statutory charge and what you are paying us.
        </p>
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
      </Section>

      <Section eyebrow="How it works" title="Four steps, tracked end to end">
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
            Foreign-owned entities must meet a minimum equity threshold set by the GIPC Act, and the
            figure depends on the shape of the business. We confirm which applies to you before you
            commit to anything.
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

      <Section eyebrow="After you're registered" title="The part that catches people out">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="text-sm leading-relaxed">
              Registering is the easy part. Ghanaian companies owe annual returns, tax filings,
              SSNIT contributions and permit renewals — and the penalties for missing them accrue
              quietly until they don&apos;t. That risk is heaviest if you are running the company
              from another country.
            </p>
            <p className="mt-4 text-sm leading-relaxed">
              Our compliance plan tracks every deadline against your specific entity, warns you
              ahead of time, and — if you want — files on your behalf.
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

      <Section eyebrow="For firms" title="Law and accounting firms">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
            Register clients through our partner API, with your own branding, scoped API keys and
            webhooks for every case event. You keep the relationship; we do the filing.
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

      <Section title="Ready to start?">
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
