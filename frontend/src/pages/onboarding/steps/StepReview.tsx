import { useState } from "react"
import { toast } from "sonner"

import { createCase, createInvoice, initializeTransaction } from "@/api/cases"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ENTITY_TYPE_LABELS, OWNER_ROLES, SECTORS } from "../constants"
import { hasForeignParticipation, type WizardData } from "../types"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

export function StepReview({ data, onBack }: { data: WizardData; onBack: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const sector = SECTORS.find((s) => s.value === data.sector)

  async function handlePay() {
    setIsSubmitting(true)
    try {
      const payload = {
        entity_type: data.entity_type,
        business_name: data.business_name,
        nationality: data.nationality,
        residency: data.residency,
        id_type: data.id_type,
        id_number: data.id_number,
        sector: data.sector,
        planned_employees: data.planned_employees,
        region: data.region,
        owners: data.owners,
        gipc_required: hasForeignParticipation(data),
      }
      const businessCase = await createCase(payload)
      const invoice = await createInvoice(businessCase.id)
      const callbackUrl = `${window.location.origin}/app/payment/callback?case_id=${businessCase.id}`
      const { authorization_url } = await initializeTransaction(invoice.id, callbackUrl)
      window.location.href = authorization_url
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Something went wrong creating your case. Please try again."
      toast.error(message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h3 className="text-lg font-semibold">One last look</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Check everything is right — then pay securely with card or Mobile Money via Paystack.
        </p>
      </div>

      <Card className="border-border">
        <CardContent className="grid gap-2.5 pt-5">
          <Row label="Business name" value={data.business_name} />
          <Row label="Entity type" value={ENTITY_TYPE_LABELS[data.entity_type]} />
          <Row label="Sector" value={sector?.label ?? data.sector} />
          <Row label="Region" value={data.region} />
          <Row label="Planned employees" value={String(data.planned_employees)} />
          <Separator className="my-1" />
          {data.owners.map((owner, index) => (
            <Row
              key={`${owner.full_name}-${index}`}
              label={OWNER_ROLES.find((r) => r.value === owner.role)?.label ?? owner.role}
              value={`${owner.full_name} (${owner.nationality === "ghanaian" ? "Ghanaian" : "Non-Ghanaian"})`}
            />
          ))}
          {hasForeignParticipation(data) && (
            <>
              <Separator className="my-1" />
              <Row label="GIPC registration" value="Included (foreign participation)" />
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button type="button" onClick={handlePay} disabled={isSubmitting}>
          {isSubmitting ? "Setting up payment…" : "Create my case & pay"}
        </Button>
      </div>
    </div>
  )
}
