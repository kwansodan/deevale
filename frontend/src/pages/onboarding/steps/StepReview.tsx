import { useState } from "react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
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
        // ISIC Rev.4 classification carried alongside the curated sector so
        // staff filings reference a standard code.
        sector_isic: sector ? `${sector.isic.section}${sector.isic.code}` : null,
        sector_isic_label: sector?.isic.label ?? null,
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
        t("wizard.review.genericError")
      toast.error(message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h3 className="text-lg font-semibold">{t("wizard.review.heading")}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{t("wizard.review.subtitle")}</p>
      </div>

      <Card className="border-border">
        <CardContent className="grid gap-2.5 pt-5">
          <Row label={t("wizard.review.businessName")} value={data.business_name} />
          <Row label={t("wizard.review.entityType")} value={ENTITY_TYPE_LABELS[data.entity_type]} />
          <Row label={t("wizard.review.sector")} value={sector?.label ?? data.sector} />
          {sector && (
            <Row
              label={t("wizard.review.isicClass")}
              value={`${sector.isic.section}${sector.isic.code} · ${sector.isic.label}`}
            />
          )}
          <Row label={t("wizard.review.region")} value={data.region} />
          <Row label={t("wizard.review.plannedEmployees")} value={String(data.planned_employees)} />
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
              <Row label={t("wizard.review.gipcLabel")} value={t("wizard.review.gipcValue")} />
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
          {t("wizard.common.back")}
        </Button>
        <Button type="button" onClick={handlePay} disabled={isSubmitting}>
          {isSubmitting ? t("wizard.review.settingUp") : t("wizard.review.payCta")}
        </Button>
      </div>
    </div>
  )
}
