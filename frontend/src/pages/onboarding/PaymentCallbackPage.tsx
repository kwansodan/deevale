import { useQuery } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router-dom"
import { PartyPopper, CircleCheck } from "lucide-react"

import { getCase } from "@/api/cases"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function PaymentCallbackPage() {
  const [params] = useSearchParams()
  const caseId = params.get("case_id")

  const { data: businessCase, isLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId!),
    enabled: !!caseId,
    // The webhook that marks the invoice paid can lag the redirect by a few
    // seconds -- refetch briefly so the page picks up the unblocked stage.
    refetchInterval: (query) => (query.state.dataUpdateCount < 5 ? 3000 : false),
  })

  const businessName =
    (businessCase?.onboarding_payload?.business_name as string | undefined) ??
    businessCase?.case_number ??
    "your business"

  const actionNeeded =
    businessCase?.stages
      .flatMap((stage) => stage.tasks)
      .filter((task) => task.assignee_type === "client" && !["done", "skipped"].includes(task.status)) ?? []

  if (!caseId) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <p className="text-muted-foreground text-sm">Missing case reference.</p>
        <Button className="mt-4" render={<Link to="/app">Go to dashboard</Link>} nativeButton={false} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card className="border-border overflow-hidden">
        <div className="bg-primary px-6 py-8 text-center">
          <PartyPopper className="text-accent mx-auto size-10" />
          <h1 className="text-primary-foreground mt-3 text-2xl font-bold">
            Your journey to {businessName} has begun
          </h1>
          <p className="text-primary-foreground/80 mt-2 text-sm">
            Payment received — our team is on it. Here's what we need from you next.
          </p>
        </div>
        <CardContent className="pt-5">
          {isLoading ? (
            <div className="grid gap-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          ) : actionNeeded.length > 0 ? (
            <div className="grid gap-3">
              <p className="text-sm font-medium">Action needed from you</p>
              {actionNeeded.slice(0, 4).map((task) => (
                <div key={task.id} className="border-border flex items-start gap-3 rounded-lg border p-3">
                  <CircleCheck className="text-accent-600 mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{task.name}</p>
                    {task.description && (
                      <p className="text-muted-foreground mt-0.5 text-xs">{task.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nothing needed from you right now — we'll notify you the moment something changes.
            </p>
          )}
          <div className="mt-6 flex justify-center">
            <Button render={<Link to="/app">Go to my dashboard</Link>} nativeButton={false} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
