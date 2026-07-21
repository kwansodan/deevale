import { useEffect, useState } from "react"
import { Check, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { trackerStages, type StageState } from "@/config/landing"

function StateDot({ state }: { state: StageState }) {
  if (state === "done") {
    return (
      <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full">
        <Check className="size-3" />
      </span>
    )
  }
  if (state === "active") {
    return (
      <span className="border-accent text-accent flex size-5 shrink-0 items-center justify-center rounded-full border-2">
        <Loader2 className="size-3 motion-safe:animate-spin" />
      </span>
    )
  }
  return <span className="border-border size-5 shrink-0 rounded-full border-2" />
}

/**
 * The hero's product device: the case timeline a client actually watches.
 *
 * This is the page's main image. It is built from the real workflow rather than
 * invented UI, so it doubles as proof of the "every stage tracked" claim — and
 * it is labelled as an example so nobody mistakes it for their own live case.
 */
export function StageTracker({ audience }: { audience: "local" | "foreign" }) {
  const stages = trackerStages[audience]
  const done = stages.filter((s) => s.state === "done").length
  const target = Math.round(((done + 0.5) / stages.length) * 100)

  // Grow the bar once after mount so the device has a moment of life on load.
  const [pct, setPct] = useState(0)
  useEffect(() => {
    setPct(0)
    const t = setTimeout(() => setPct(target), 120)
    return () => clearTimeout(t)
  }, [target, audience])

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">Example case</p>
            <p className="font-heading mt-0.5 text-lg font-semibold">Akoma Foods Ltd</p>
          </div>
          <Badge variant="secondary">In progress</Badge>
        </div>

        <div className="mt-4">
          <div className="text-muted-foreground mb-1.5 flex items-baseline justify-between text-xs">
            <span>
              {done} of {stages.length} stages complete
            </span>
            <span className="tabular-nums">{target}%</span>
          </div>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <Separator className="my-4" />

        <ol className="space-y-3">
          {stages.map((stage) => (
            <li key={stage.name} className="flex items-center gap-3">
              <StateDot state={stage.state} />
              <span
                className={cn(
                  "flex-1 text-sm",
                  stage.state === "upcoming" && "text-muted-foreground",
                  stage.state === "active" && "font-medium"
                )}
              >
                {stage.name}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">{stage.sla}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
