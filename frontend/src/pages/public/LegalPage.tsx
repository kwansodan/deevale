import { Link, Navigate, useParams } from "react-router-dom"

import { Wordmark } from "@/components/Wordmark"
import { useLandingConfig } from "@/config/landing"

// These are drafted, general-purpose policies for a Ghana business-registration
// and compliance service. They are a starting point and should be reviewed by a
// qualified Ghanaian lawyer before launch. Bracketed [ ] items are decisions the
// business must confirm. `LAST_UPDATED` should be set when finalised.
const LAST_UPDATED = "16 August 2026"

type Section = { heading: string; paras?: string[]; bullets?: string[] }
type LegalDoc = { title: string; intro: string[]; sections: Section[] }

function buildDocs(company: {
  legalName: string | null
  email: string | null
  address: string | null
}): Record<string, LegalDoc> {
  const name = company.legalName ?? "Deevale GH"
  const email = company.email ?? "[support email]"
  const address = company.address ?? "[registered office address]"

  return {
    terms: {
      title: "Terms of Service",
      intro: [
        `These Terms of Service ("Terms") govern your use of the ${name} website and services ("Services"). By creating an account or using the Services, you agree to these Terms.`,
      ],
      sections: [
        {
          heading: "1. Who we are and what we do",
          paras: [
            `${name} helps individuals and businesses register companies and stay compliant in Ghana — including incorporation, tax and SSNIT registration, permits, and ongoing statutory filings.`,
            `${name} is a business-registration and compliance service. We are not a law firm and do not provide legal, tax, or accounting advice. Where you need such advice, consult a qualified professional.`,
          ],
        },
        {
          heading: "2. Your account",
          paras: [
            "You must be at least 18 years old and provide accurate, current information. You are responsible for keeping your login credentials secure and for all activity under your account. Tell us immediately if you suspect unauthorised access.",
          ],
        },
        {
          heading: "3. The service and your responsibilities",
          paras: [
            "You authorise us to prepare and submit filings and applications to the relevant Ghanaian authorities on your behalf, based on the information and documents you provide.",
            "You are responsible for the accuracy, legality, and completeness of the information and documents you give us (including valid identification). Providing false or misleading information may delay or invalidate a registration.",
            "Timelines we show are estimates only. Registration steps depend on government agencies (for example the Office of the Registrar of Companies, GRA, SSNIT, GIPC, and local assemblies) whose processing times and decisions are outside our control. We do not guarantee any particular outcome, approval, or timeframe.",
          ],
        },
        {
          heading: "4. Fees and payment",
          paras: [
            "Fees are shown before you commit. Government fees are charged at cost and itemised separately from our service fee. Payments are processed by our payment provider (Paystack) in Ghana cedis (GHS).",
            "Compliance subscriptions renew automatically each period until you cancel. You can cancel future renewals at any time. Refunds are governed by our Refund Policy.",
          ],
        },
        {
          heading: "5. Third parties",
          paras: [
            "The Services rely on third parties, including government agencies and our payment provider. We are not responsible for their acts, omissions, delays, fees, or decisions.",
          ],
        },
        {
          heading: "6. Acceptable use",
          paras: [
            "You must not use the Services for any unlawful purpose, submit false information, impersonate others, attempt to disrupt the platform, or use it to facilitate fraud or money laundering.",
          ],
        },
        {
          heading: "7. Intellectual property",
          paras: [
            `The ${name} platform, branding, and content are owned by us or our licensors. The documents and data you upload remain yours; you grant us the licence needed to provide the Services.`,
          ],
        },
        {
          heading: "8. Disclaimers",
          paras: [
            'The Services are provided on an "as is" and "as available" basis. We do not warrant that the Services will be uninterrupted or error-free, and nothing on the platform constitutes legal or professional advice.',
          ],
        },
        {
          heading: "9. Limitation of liability",
          paras: [
            "To the maximum extent permitted by law, our total liability to you for any claim relating to the Services is limited to the service fees you paid us for the specific service giving rise to the claim. We are not liable for indirect, incidental, or consequential losses, including lost profits or business interruption. Nothing in these Terms excludes liability that cannot lawfully be excluded.",
          ],
        },
        {
          heading: "10. Suspension and termination",
          paras: [
            "We may suspend or terminate your access if you breach these Terms or use the Services unlawfully. You may stop using the Services at any time and may request account closure from your account settings.",
          ],
        },
        {
          heading: "11. Governing law",
          paras: [
            "These Terms are governed by the laws of the Republic of Ghana, and the courts of Ghana have exclusive jurisdiction over any dispute.",
          ],
        },
        {
          heading: "12. Changes and contact",
          paras: [
            `We may update these Terms from time to time; material changes will be notified through the Services. Questions? Contact ${name} at ${email}, registered office ${address}.`,
          ],
        },
      ],
    },

    privacy: {
      title: "Privacy Policy",
      intro: [
        `This Privacy Policy explains how ${name} collects, uses, shares, and protects your personal data. We handle personal data in line with Ghana's Data Protection Act, 2012 (Act 843).`,
      ],
      sections: [
        {
          heading: "1. Information we collect",
          bullets: [
            "Identity data: your name, government identification (e.g. Ghana Card or passport), and photographs where required for registration.",
            "Contact data: email address, phone number, and postal/business address.",
            "Business data: proposed company names, details of directors, shareholders, and beneficial owners, and other registration information.",
            "Payment data: processed by our payment provider (Paystack). We do not store your full card details.",
            "Documents: files you upload to your case (for example IDs and signed forms).",
            "Technical data: IP address, device/browser information, and cookies needed to run the service.",
          ],
        },
        {
          heading: "2. How we use your data",
          paras: [
            "We use your data to provide the Services — preparing and submitting registrations and filings to the relevant authorities, processing payments, communicating with you, meeting our legal obligations, and improving and securing the platform.",
          ],
        },
        {
          heading: "3. Legal basis",
          paras: [
            "We process personal data where necessary to perform our contract with you, to comply with a legal obligation, with your consent, or for our legitimate interests in operating and securing the Services.",
          ],
        },
        {
          heading: "4. Who we share it with",
          paras: [
            "We share personal data only as needed to deliver the Services:",
          ],
          bullets: [
            "Government agencies and regulators, to effect your registrations and filings.",
            "Our payment provider (Paystack), to process payments.",
            "Service providers who host our infrastructure and deliver email/SMS on our behalf, under confidentiality obligations.",
            "Professional advisers, and authorities where we are legally required to disclose.",
          ],
        },
        {
          heading: "5. Storage and security",
          paras: [
            "We store your data on secured infrastructure and restrict access to authorised personnel. Uploaded documents are held in access-controlled storage. No system is perfectly secure, but we take reasonable technical and organisational measures to protect your data.",
          ],
        },
        {
          heading: "6. Data retention",
          paras: [
            "We keep personal data for as long as needed to provide the Services and to meet legal, regulatory, and record-keeping obligations, after which we delete or anonymise it.",
          ],
        },
        {
          heading: "7. Your rights",
          paras: [
            "Under the Data Protection Act, 2012, you may request access to your personal data, ask us to correct it, object to or restrict certain processing, withdraw consent, and request deletion. You can request account closure from your account settings, or contact us to exercise any of these rights.",
          ],
        },
        {
          heading: "8. International transfers",
          paras: [
            "Some of our service providers may process data outside Ghana. Where they do, we take steps to ensure your data remains protected to a comparable standard.",
          ],
        },
        {
          heading: "9. Cookies",
          paras: [
            "We use cookies and similar technologies that are necessary to keep you logged in and to run core features of the site.",
          ],
        },
        {
          heading: "10. Children",
          paras: ["The Services are not directed to anyone under 18, and we do not knowingly collect their data."],
        },
        {
          heading: "11. Data protection and complaints",
          paras: [
            `We are registered with (or have notified) the Data Protection Commission of Ghana [registration number to confirm]. You may lodge a complaint with the Commission if you believe your data has been mishandled.`,
          ],
        },
        {
          heading: "12. Changes and contact",
          paras: [
            `We may update this Policy from time to time. For any privacy question, or to reach our data protection contact, email ${email}. Our registered office is ${address}.`,
          ],
        },
      ],
    },

    refund: {
      title: "Refund Policy",
      intro: [
        `This Refund Policy explains when and how refunds apply to payments made to ${name}.`,
      ],
      sections: [
        {
          heading: "1. Government fees",
          paras: [
            "Government fees are paid directly to the relevant agencies to lodge your filings. Once a filing has been submitted, these fees are non-refundable, because we cannot recover them from the agency.",
          ],
        },
        {
          heading: "2. Our service fees",
          paras: [
            "Before we begin work on your case, our service fee is refundable, less any costs we have already incurred on your behalf.",
            "Once we have started work or lodged filings, our service fee is generally non-refundable — except where we fail to deliver a service you paid for and the failure is our fault, in which case we will refund the affected service fee.",
          ],
        },
        {
          heading: "3. Compliance subscriptions",
          paras: [
            "Compliance plans renew automatically each period. You can cancel future renewals at any time from your account. Cancelling stops the next charge; the current period is not pro-rated or refunded [confirm your preferred policy].",
          ],
        },
        {
          heading: "4. Duplicate or erroneous charges",
          paras: [
            "If you are charged in error or charged twice for the same service, we will refund the incorrect charge in full.",
          ],
        },
        {
          heading: "5. How to request a refund",
          paras: [
            `Email ${email} within [X days] of the payment, with your account email and the details of the charge. We will review and respond promptly.`,
          ],
        },
        {
          heading: "6. How refunds are processed",
          paras: [
            "Approved refunds are made to your original payment method through our payment provider, typically within [X business days], subject to your bank or provider's processing times.",
          ],
        },
        {
          heading: "7. Contact",
          paras: [`Questions about this policy? Email ${email}.`],
        },
      ],
    },
  }
}

const TITLES: Record<string, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  refund: "Refund Policy",
}

export default function LegalPage() {
  const { doc } = useParams<{ doc: string }>()
  const { company } = useLandingConfig()

  if (!doc || !TITLES[doc]) return <Navigate to="/" replace />
  const docs = buildDocs(company)
  const content = docs[doc]
  const companyName = company.legalName ?? "Deevale GH"

  return (
    <div className="bg-background min-h-svh">
      <header className="border-border bg-background/85 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/">
            <Wordmark size="md" />
          </Link>
          <Link to="/" className="text-muted-foreground hover:text-foreground text-sm">
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">{content.title}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {companyName} · Last updated {LAST_UPDATED}
        </p>

        <div className="mt-8 grid gap-4">
          {content.intro.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed">
              {p}
            </p>
          ))}
        </div>

        <div className="mt-8 grid gap-8">
          {content.sections.map((s) => (
            <section key={s.heading} className="grid gap-3">
              <h2 className="font-heading text-lg font-semibold">{s.heading}</h2>
              {s.paras?.map((p, i) => (
                <p key={i} className="text-muted-foreground text-sm leading-relaxed">
                  {p}
                </p>
              ))}
              {s.bullets && (
                <ul className="text-muted-foreground grid gap-2 text-sm leading-relaxed">
                  {s.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden className="text-accent-600">
                        •
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <nav className="border-border mt-12 flex flex-wrap gap-4 border-t pt-6 text-sm">
          {Object.entries(TITLES)
            .filter(([slug]) => slug !== doc)
            .map(([slug, title]) => (
              <Link key={slug} to={`/legal/${slug}`} className="text-primary hover:underline">
                {title}
              </Link>
            ))}
        </nav>
      </main>
    </div>
  )
}
