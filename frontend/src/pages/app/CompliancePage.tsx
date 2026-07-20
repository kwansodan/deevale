import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isPast,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Send, Sparkles } from "lucide-react"
import { toast } from "sonner"

import {
  completeObligation,
  getSubscriptionStatus,
  listObligations,
  requestFiling,
  subscribe,
  type ComplianceObligation,
} from "@/api/compliance"
import { formatGhs } from "@/api/cases"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Urgency = "overdue" | "soon" | "upcoming" | "handled"

function urgencyOf(obligation: ComplianceObligation): Urgency {
  if (obligation.status !== "upcoming") return "handled"
  const due = new Date(obligation.due_date)
  if (isPast(due) && !isSameDay(due, new Date())) return "overdue"
  if (differenceInCalendarDays(due, new Date()) <= 14) return "soon"
  return "upcoming"
}

const URGENCY_DOT: Record<Urgency, string> = {
  overdue: "bg-error",
  soon: "bg-warning",
  upcoming: "bg-primary",
  handled: "bg-muted-foreground/40",
}

const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: "text-error",
  soon: "text-warning",
  upcoming: "text-foreground",
  handled: "text-muted-foreground",
}

function MonthGrid({
  month,
  obligations,
}: {
  month: Date
  obligations: ComplianceObligation[]
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
  const byDay = useMemo(() => {
    const map = new Map<string, ComplianceObligation[]>()
    for (const obligation of obligations) {
      const key = obligation.due_date
      map.set(key, [...(map.get(key) ?? []), obligation])
    }
    return map
  }, [obligations])

  return (
    <div>
      <div className="text-muted-foreground grid grid-cols-7 pb-1 text-center text-[11px] font-medium">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="border-border grid grid-cols-7 overflow-hidden rounded-lg border">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd")
          const dayObligations = byDay.get(key) ?? []
          return (
            <div
              key={key}
              className={cn(
                "border-border/60 min-h-16 border-[0.5px] p-1.5",
                !isSameMonth(day, month) && "bg-muted/40",
                isSameDay(day, new Date()) && "bg-accent-50 dark:bg-accent/10"
              )}
            >
              <span
                className={cn(
                  "text-xs",
                  isSameMonth(day, month) ? "text-foreground" : "text-muted-foreground/60"
                )}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 grid gap-0.5">
                {dayObligations.slice(0, 2).map((obligation) => {
                  const urgency = urgencyOf(obligation)
                  return (
                    <span
                      key={obligation.id}
                      title={obligation.title}
                      className="flex items-center gap-1 truncate text-[10px] leading-tight"
                    >
                      <span className={cn("size-1.5 shrink-0 rounded-full", URGENCY_DOT[urgency])} />
                      <span className={cn("truncate", URGENCY_TEXT[urgency])}>{obligation.title}</span>
                    </span>
                  )
                })}
                {dayObligations.length > 2 && (
                  <span className="text-muted-foreground text-[10px]">+{dayObligations.length - 2} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="text-muted-foreground mt-2 flex gap-4 text-[11px]">
        <span className="flex items-center gap-1"><span className="bg-error size-1.5 rounded-full" /> Overdue</span>
        <span className="flex items-center gap-1"><span className="bg-warning size-1.5 rounded-full" /> Due within 14 days</span>
        <span className="flex items-center gap-1"><span className="bg-primary size-1.5 rounded-full" /> Upcoming</span>
        <span className="flex items-center gap-1"><span className="bg-muted-foreground/40 size-1.5 rounded-full" /> Handled</span>
      </div>
    </div>
  )
}

function SubscribeUpsell({
  monthlyPrice,
  annualPrice,
}: {
  monthlyPrice: number
  annualPrice: number
}) {
  const [isRedirecting, setIsRedirecting] = useState(false)

  async function handleSubscribe(plan: "monthly" | "annual") {
    setIsRedirecting(true)
    try {
      const callbackUrl = `${window.location.origin}/app/compliance`
      const { authorization_url } = await subscribe(plan, callbackUrl)
      window.location.href = authorization_url
    } catch {
      toast.error("Couldn't start the subscription checkout.")
      setIsRedirecting(false)
    }
  }

  return (
    <Card className="border-accent/40 bg-accent-50 dark:bg-accent/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="text-accent-600 size-4" />
          Let us handle your filings
        </CardTitle>
        <CardDescription>
          The LaunchGH compliance plan unlocks "File it for me" on every deadline — our team files,
          you get the receipts.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button disabled={isRedirecting} onClick={() => handleSubscribe("monthly")}>
          {formatGhs(monthlyPrice)}/month
        </Button>
        <Button variant="outline" disabled={isRedirecting} onClick={() => handleSubscribe("annual")}>
          {formatGhs(annualPrice)}/year — 2 months free
        </Button>
      </CardContent>
    </Card>
  )
}

export default function CompliancePage() {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(startOfMonth(new Date()))

  const { data: obligations, isLoading } = useQuery({
    queryKey: ["obligations"],
    queryFn: listObligations,
  })
  const { data: subscription } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: getSubscriptionStatus,
  })

  const fileMutation = useMutation({
    mutationFn: requestFiling,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obligations"] })
      toast.success("We're on it — our team will file this for you.")
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't create the filing request."
      toast.error(message)
    },
  })

  const completeMutation = useMutation({
    mutationFn: completeObligation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obligations"] })
      toast.success("Marked as handled.")
    },
  })

  const sorted = [...(obligations ?? [])].sort((a, b) => a.due_date.localeCompare(b.due_date))
  const open = sorted.filter((o) => o.status === "upcoming")
  const handled = sorted.filter((o) => o.status !== "upcoming")

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-semibold">Compliance calendar</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Every deadline your business owes the state — we remind you at 30, 14, 7 and 2 days out.
        </p>
      </div>

      {subscription && !subscription.active && (
        <SubscribeUpsell
          monthlyPrice={subscription.monthly_price_minor}
          annualPrice={subscription.annual_price_minor}
        />
      )}

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : (obligations ?? []).length === 0 ? (
        <Card className="border-border">
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-sm">
            <CalendarDays className="size-6" />
            Your calendar fills in automatically once your registration completes.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="month">
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>

          <TabsContent value="month" className="pt-4">
            <Card className="border-border">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{format(month, "MMMM yyyy")}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <MonthGrid month={month} obligations={obligations ?? []} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list" className="pt-4">
            <div className="grid gap-2">
              {open.map((obligation) => {
                const urgency = urgencyOf(obligation)
                return (
                  <Card key={obligation.id} className="border-border">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <span className={cn("size-2 shrink-0 rounded-full", URGENCY_DOT[urgency])} />
                          {obligation.title}
                        </p>
                        <p className={cn("mt-0.5 text-xs", URGENCY_TEXT[urgency])}>
                          Due {format(new Date(obligation.due_date), "d MMMM yyyy")}
                          {urgency === "overdue" && " — overdue"}
                        </p>
                        {obligation.description && (
                          <p className="text-muted-foreground mt-0.5 text-xs">{obligation.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          disabled={fileMutation.isPending}
                          onClick={() => fileMutation.mutate(obligation.id)}
                        >
                          <Send data-icon="inline-start" className="size-3.5" />
                          File it for me
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={completeMutation.isPending}
                          onClick={() => completeMutation.mutate(obligation.id)}
                        >
                          I've handled it
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {handled.length > 0 && (
                <div className="mt-2">
                  <p className="text-muted-foreground mb-1.5 text-xs font-medium">Handled</p>
                  {handled.map((obligation) => (
                    <p key={obligation.id} className="text-muted-foreground flex items-center gap-2 py-1 text-sm">
                      <CheckCircle2 className="text-success size-3.5" />
                      {obligation.title} — {format(new Date(obligation.due_date), "d MMM yyyy")}
                      {obligation.status === "filed_by_us" && " (filed by LaunchGH)"}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
