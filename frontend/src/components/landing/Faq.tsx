import { Plus } from "lucide-react"

// Product-honest Q&A -- factual descriptions of how the service works, not
// claims. A native <details> accordion keeps this accessible and dependency-free.
const FAQS: { q: string; a: string }[] = [
  {
    q: "How long does registration take?",
    a: "Most registrations start the same day we receive your documents. Name reservation targets 72 hours and incorporation about five working days. Actual timelines depend on the Registrar's queue, which we track for you and show on your dashboard.",
  },
  {
    q: "What's included in the price?",
    a: "Every quote itemises the government fee separately from our service fee, so you can see exactly what goes to the Office of the Registrar, GRA, SSNIT or GIPC, and what is ours. Government fees are charged at cost.",
  },
  {
    q: "Can I register from outside Ghana?",
    a: "Yes. Every party signs electronically in the right order, IDs upload to an encrypted vault, and we provide a Ghanaian office address to receive your official mail — so you never have to travel or be in the room.",
  },
  {
    q: "What happens after I'm registered?",
    a: "Your certificates land in your document vault and we begin tracking your compliance deadlines — annual returns, tax filings, SSNIT and permit renewals — with reminders by email and SMS and a “file it for me” option on each obligation.",
  },
  {
    q: "Do you handle refunds?",
    a: "Government fees are paid directly to the agencies and can't be recovered once a filing is lodged. Our own service terms are set out in writing before you commit, so there are no surprises.",
  },
  {
    q: "Are you a law firm?",
    a: "No. Deevale GH is a business registration and compliance service, not a law firm, and we don't provide legal advice.",
  },
]

export function Faq() {
  return (
    <div className="mx-auto grid max-w-3xl gap-3">
      {FAQS.map(({ q, a }) => (
        <details
          key={q}
          className="group bg-card border-border shadow-card open:shadow-card-lg rounded-xl border px-5 transition-shadow"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
            {q}
            <Plus className="text-accent-600 size-5 shrink-0 transition-transform group-open:rotate-45" />
          </summary>
          <p className="text-muted-foreground pb-5 text-sm leading-relaxed">{a}</p>
        </details>
      ))}
    </div>
  )
}
