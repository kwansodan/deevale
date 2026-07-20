import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"

import { formatGhs } from "@/api/cases"
import { fetchBillingMetrics } from "@/api/compliance"
import { listFinancePayments } from "@/api/ops"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

function MetricTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="border-border">
      <CardContent className="px-4 py-3">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export default function PaymentsPage() {
  const { data: payments, isLoading } = useQuery({
    queryKey: ["finance-payments"],
    queryFn: listFinancePayments,
  })
  const { data: metrics } = useQuery({
    queryKey: ["billing-metrics"],
    queryFn: fetchBillingMetrics,
  })

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Payments</h1>

      {metrics && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile label="MRR" value={formatGhs(metrics.mrr_minor)} hint="annual plans amortized" />
          <MetricTile
            label="Active subscriptions"
            value={String(metrics.active_subscriptions)}
            hint={`${metrics.active_monthly} monthly · ${metrics.active_annual} annual`}
          />
          <MetricTile label="Churned (30d)" value={String(metrics.churned_last_30d)} />
          <MetricTile label="Churn rate (30d)" value={`${Math.round(metrics.churn_rate_30d * 100)}%`} />
        </div>
      )}
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    No payments recorded yet.
                  </TableCell>
                </TableRow>
              )}
              {(payments ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{format(new Date(p.created_at), "d MMM yyyy, HH:mm")}</TableCell>
                  <TableCell className="capitalize">
                    {p.provider}
                    {p.is_manual_credit && (
                      <span className="text-muted-foreground ml-1 text-xs">(manual credit)</span>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{p.channel.replaceAll("_", " ")}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-xs font-medium capitalize",
                        p.status === "success" && "text-success",
                        p.status === "failed" && "text-error",
                        p.status === "refunded" && "text-warning"
                      )}
                    >
                      {p.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatGhs(p.amount_minor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
