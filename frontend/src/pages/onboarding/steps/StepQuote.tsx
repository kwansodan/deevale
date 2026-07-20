import { useQuery } from "@tanstack/react-query"
import { Clock } from "lucide-react"

import { fetchQuotePreview, formatGhs } from "@/api/cases"
import { hasForeignParticipation } from "../types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { ENTITY_TYPE_LABELS } from "../constants"
import type { WizardData } from "../types"

export function StepQuote({
  data,
  onNext,
  onBack,
}: {
  data: WizardData
  onNext: (values: Partial<WizardData>) => void
  onBack: () => void
}) {
  const foreign = hasForeignParticipation(data)
  const { data: quote, isLoading, isError } = useQuery({
    queryKey: ["quote-preview", data.entity_type, foreign],
    queryFn: () => fetchQuotePreview(data.entity_type, foreign),
  })

  return (
    <div className="grid gap-5">
      <div>
        <h3 className="text-lg font-semibold">Your all-in price</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Registering <span className="text-foreground font-medium">{data.business_name}</span> as a{" "}
          {ENTITY_TYPE_LABELS[data.entity_type]}. Government fees are passed through at cost.
        </p>
      </div>

      <Card className="border-border">
        <CardContent className="pt-5">
          {isLoading && (
            <div className="grid gap-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-7 w-1/2" />
            </div>
          )}
          {isError && (
            <p className="text-error text-sm">Couldn't load your quote. Please try again in a moment.</p>
          )}
          {quote && (
            <div className="grid gap-2 text-sm">
              {quote.line_items.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4">
                  <span className={item.fee_type === "government" ? "text-muted-foreground" : ""}>
                    {item.label}
                    {item.fee_type === "government" && (
                      <span className="text-muted-foreground/70 ml-1.5 text-xs">(government fee)</span>
                    )}
                  </span>
                  <span className="tabular-nums">{formatGhs(item.amount_minor)}</span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>Government fees subtotal</span>
                <span className="tabular-nums">{formatGhs(quote.subtotal_government_minor)}</span>
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>LaunchGH service fee</span>
                <span className="tabular-nums">{formatGhs(quote.subtotal_service_minor)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatGhs(quote.total_minor)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="border-border bg-card flex items-center gap-3 rounded-lg border p-3 text-sm">
        <Clock className="text-accent-600 size-5 shrink-0" />
        <div>
          <p className="font-medium">Estimated timeline: 4–6 weeks</p>
          <p className="text-muted-foreground text-xs">
            From name reservation to your business operating permit, assuming documents come in promptly.
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" disabled={!quote} onClick={() => onNext({})}>
          Looks good
        </Button>
      </div>
    </div>
  )
}
