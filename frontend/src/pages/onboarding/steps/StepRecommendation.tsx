import { useState } from "react"
import { Building2, Globe, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ENTITY_TYPE_LABELS, SECTORS } from "../constants"
import { hasForeignParticipation, type WizardData } from "../types"

type Recommendation = {
  entity_type: string
  reasons: string[]
}

function computeRecommendation(data: WizardData): Recommendation {
  const foreign = hasForeignParticipation(data)
  const ownerCount = Math.max(data.owners.length, 1)

  if (data.venture_type === "branch") {
    return {
      entity_type: "external_company",
      reasons: [
        "A branch of an existing foreign company registers in Ghana as an External Company — the parent stays the legal entity.",
        "You'll provide notarized copies of the parent's incorporation documents and appoint a local manager by power of attorney.",
        "If you'd rather have a separate Ghanaian legal entity, a Company Limited by Shares subsidiary is the alternative.",
      ],
    }
  }
  if (data.venture_type === "ngo") {
    return {
      entity_type: "company_limited_by_guarantee",
      reasons: [
        "Non-profits in Ghana incorporate as Companies Limited by Guarantee — there are no shareholders, and income can't be distributed as profit.",
        "Expect a higher-scrutiny document set: executive council IDs and a beneficial ownership profile are required.",
        "This structure is what donors and the NGO directorate expect to see.",
      ],
    }
  }
  if (foreign) {
    return {
      entity_type: "company_limited_by_shares",
      reasons: [
        "Foreign participation requires an incorporated company — sole proprietorships are only open to Ghanaian citizens.",
        "A company limited by shares gives every investor clear, transferable ownership through shares.",
        "It's the structure GIPC expects when registering foreign investment.",
      ],
    }
  }
  if (ownerCount > 1) {
    return {
      entity_type: "company_limited_by_shares",
      reasons: [
        `With ${ownerCount} owners, a company limited by shares protects each person — liability stops at what each shareholder puts in.`,
        "Shares make it easy to split ownership fairly and bring in new investors later.",
        "Prefer a lighter structure? An Incorporated Private Partnership is also available below — but partners stay personally liable.",
      ],
    }
  }
  return {
    entity_type: "company_limited_by_shares",
    reasons: [
      "As a solo founder you could also run a sole proprietorship, but a limited company keeps your personal assets separate from business debts.",
      "It's easier to add co-founders or investors later without re-registering.",
      "Most clients on Deevale GH choose this structure — it grows with you.",
    ],
  }
}

const ENTITY_OPTIONS = [
  { value: "company_limited_by_shares", available: true },
  { value: "partnership", available: true },
  { value: "company_limited_by_guarantee", available: true },
  { value: "external_company", available: true },
  { value: "sole_proprietorship", available: false },
]

export function StepRecommendation({
  data,
  onNext,
  onBack,
}: {
  data: WizardData
  onNext: (values: Partial<WizardData>) => void
  onBack: () => void
}) {
  const recommendation = computeRecommendation(data)
  const [selected, setSelected] = useState(data.entity_type || recommendation.entity_type)

  const foreign = hasForeignParticipation(data)
  const sector = SECTORS.find((s) => s.value === data.sector)
  const reservedBlocked = Boolean(foreign && sector?.reserved)
  const selectedAvailable = ENTITY_OPTIONS.some((o) => o.value === selected && o.available)
  const canContinue = selectedAvailable && !reservedBlocked

  return (
    <div className="grid gap-5">
      <Card className="border-primary/30 bg-primary-50 dark:bg-primary/10">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="bg-primary text-primary-foreground rounded-lg p-2">
              <Building2 className="size-5" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Our recommendation
              </p>
              <h3 className="text-lg font-semibold">
                {ENTITY_TYPE_LABELS[recommendation.entity_type]}
              </h3>
            </div>
          </div>
          <ul className="mt-4 grid gap-2">
            {recommendation.reasons.map((reason) => (
              <li key={reason} className="flex gap-2 text-sm">
                <span className="text-primary mt-0.5">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {foreign && !reservedBlocked && (
        <div className="border-info/30 bg-info/5 flex gap-2 rounded-lg border p-3 text-sm">
          <Globe className="text-info mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-info font-medium">Foreign-owned setups include GIPC registration.</p>
            <p className="text-foreground/80 mt-1">
              Because your business has non-Ghanaian participation, it will also be registered with the
              Ghana Investment Promotion Centre. We'll guide you through the extra requirements — this is
              included in your journey, with GIPC-specific steps coming in a later phase.
            </p>
          </div>
        </div>
      )}

      {reservedBlocked && (
        <div role="alert" className="border-error/40 bg-error/5 text-error flex gap-2 rounded-lg border p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Your chosen sector is reserved for Ghanaian citizens.</p>
            <p className="text-error/90 mt-1">
              {sector?.label} cannot include foreign owners under the GIPC Act. Go back and change either
              the sector or the ownership to continue.
            </p>
          </div>
        </div>
      )}

      {foreign && sector?.trading && !reservedBlocked && (
        <div className="border-warning/40 bg-warning/5 flex gap-2 rounded-lg border p-3 text-sm">
          <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-warning font-medium">
              Trading enterprises keep a minimum-capital requirement.
            </p>
            <p className="text-foreground/80 mt-1">
              Ghana's new investment law removed most minimum-capital rules, but retained one for
              trading enterprises with foreign participation: you'll need to show US$1,000,000 in
              equity (cash or goods) during GIPC registration. Your equity transfer evidence will be
              checked against this. If that doesn't fit your plans, consider a services or
              manufacturing classification with your case officer.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <p className="text-sm font-medium">Your choice</p>
        {ENTITY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={!option.available}
            onClick={() => setSelected(option.value)}
            className={cn(
              "flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors",
              selected === option.value
                ? "border-primary bg-primary/5 font-medium"
                : "border-border hover:bg-muted",
              !option.available && "cursor-not-allowed opacity-50 hover:bg-transparent"
            )}
            aria-pressed={selected === option.value}
          >
            <span>{ENTITY_TYPE_LABELS[option.value]}</span>
            {!option.available && <span className="text-muted-foreground text-xs">Coming soon</span>}
          </button>
        ))}
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" disabled={!canContinue} onClick={() => onNext({ entity_type: selected })}>
          Continue
        </Button>
      </div>
    </div>
  )
}
