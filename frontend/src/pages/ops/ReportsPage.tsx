import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, subDays } from "date-fns"
import { Download } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatGhs } from "@/api/cases"
import { downloadReportCsv, fetchOfficerWorkload, fetchReportKpis } from "@/api/ops"
import { useAuthStore, hasRole } from "@/stores/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const RANGE_PRESETS = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 180 days" },
]

const SERIES_1 = "var(--chart-1)" // green — first categorical slot
const SERIES_2 = "var(--chart-2)" // gold — second categorical slot
const GRID = "var(--border)"
const MUTED_TEXT = "var(--muted-foreground)"

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
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

function LegendRow({ entries }: { entries: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 px-1 pb-2">
      {entries.map((entry) => (
        <span key={entry.label} className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span className="size-2.5 rounded-full" style={{ background: entry.color }} />
          {entry.label}
        </span>
      ))}
    </div>
  )
}

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
}

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = hasRole(user?.roles, "admin")
  const [rangeDays, setRangeDays] = useState("30")

  const dateTo = format(new Date(), "yyyy-MM-dd")
  const dateFrom = format(subDays(new Date(), Number(rangeDays) - 1), "yyyy-MM-dd")

  const { data: kpis, isLoading } = useQuery({
    queryKey: ["report-kpis", dateFrom, dateTo],
    queryFn: () => fetchReportKpis(dateFrom, dateTo),
  })
  const { data: workload } = useQuery({
    queryKey: ["officer-workload"],
    queryFn: fetchOfficerWorkload,
    enabled: isAdmin,
  })

  if (!hasRole(user?.roles, "admin", "finance")) {
    return <p className="text-muted-foreground text-sm">Reports are available to admin and finance roles.</p>
  }

  const caseSeries = (kpis?.daily_series ?? []).map((d) => ({
    ...d,
    day: format(new Date(d.date), "d MMM"),
    service_ghs: d.revenue_service_minor / 100,
    government_ghs: d.revenue_government_minor / 100,
  }))

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select items={RANGE_PRESETS} value={rangeDays} onValueChange={(v) => setRangeDays(v as string)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(["cases", "revenue", "rejections", "cycle-times"] as const).map((report) => (
            <Button
              key={report}
              variant="outline"
              size="sm"
              onClick={() => downloadReportCsv(report, dateFrom, dateTo)}
            >
              <Download data-icon="inline-start" className="size-3.5" />
              {report}.csv
            </Button>
          ))}
        </div>
      </div>

      {isLoading || !kpis ? (
        <div className="grid gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Cases created" value={String(kpis.cases_created)} />
            <StatTile label="Cases completed" value={String(kpis.cases_completed)} />
            <StatTile
              label="Median cycle time"
              value={kpis.median_cycle_days != null ? `${kpis.median_cycle_days}d` : "—"}
            />
            <StatTile
              label="First-pass approval"
              value={
                kpis.first_pass_approval_rate != null
                  ? `${Math.round(kpis.first_pass_approval_rate * 100)}%`
                  : "—"
              }
              hint={`${kpis.first_pass_reviewed} reviews`}
            />
            <StatTile
              label="SLA breach rate"
              value={kpis.sla_breach_rate != null ? `${Math.round(kpis.sla_breach_rate * 100)}%` : "—"}
              hint={`${kpis.sla_tasks} timed tasks`}
            />
            <StatTile label="Subscription conversions" value={String(kpis.subscription_conversions)} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <StatTile label="Service fee revenue" value={formatGhs(kpis.revenue_service_minor)} />
            <StatTile
              label="Government pass-through"
              value={formatGhs(kpis.revenue_government_minor)}
              hint="collected at cost"
            />
          </div>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Cases over time</CardTitle>
            </CardHeader>
            <CardContent>
              <LegendRow
                entries={[
                  { color: SERIES_1, label: "Created" },
                  { color: SERIES_2, label: "Completed" },
                ]}
              />
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={caseSeries} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: MUTED_TEXT, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: GRID }}
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: MUTED_TEXT, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: GRID }} />
                  <Line
                    type="monotone"
                    dataKey="cases_created"
                    name="Created"
                    stroke={SERIES_1}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cases_completed"
                    name="Completed"
                    stroke={SERIES_2}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Median cycle time per stage (days)</CardTitle>
              </CardHeader>
              <CardContent>
                {kpis.cycle_per_stage.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No stages completed in this range.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(kpis.cycle_per_stage.length * 44, 120)}>
                    <BarChart
                      layout="vertical"
                      data={kpis.cycle_per_stage}
                      margin={{ top: 0, right: 32, bottom: 0, left: 8 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="stage_name"
                        width={150}
                        tick={{ fill: MUTED_TEXT, fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "transparent" }} />
                      <Bar
                        dataKey="median_days"
                        name="Median days"
                        fill={SERIES_1}
                        radius={[0, 4, 4, 0]}
                        barSize={14}
                        label={{ position: "right", fill: MUTED_TEXT, fontSize: 11 }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Rejection reasons</CardTitle>
              </CardHeader>
              <CardContent>
                {kpis.rejection_reasons.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No rejections in this range. 🎉</p>
                ) : (
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(kpis.rejection_reasons.length * 44, 120)}
                  >
                    <BarChart
                      layout="vertical"
                      data={kpis.rejection_reasons.map((r) => ({
                        ...r,
                        label: r.reason.replaceAll("_", " "),
                      }))}
                      margin={{ top: 0, right: 32, bottom: 0, left: 8 }}
                    >
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={120}
                        tick={{ fill: MUTED_TEXT, fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "transparent" }} />
                      <Bar
                        dataKey="count"
                        name="Rejections"
                        fill={SERIES_1}
                        radius={[0, 4, 4, 0]}
                        barSize={14}
                        label={{ position: "right", fill: MUTED_TEXT, fontSize: 11 }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Revenue (GHS)</CardTitle>
            </CardHeader>
            <CardContent>
              <LegendRow
                entries={[
                  { color: SERIES_1, label: "Service fees" },
                  { color: SERIES_2, label: "Government pass-through" },
                ]}
              />
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={caseSeries} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: MUTED_TEXT, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: GRID }}
                    minTickGap={24}
                  />
                  <YAxis tick={{ fill: MUTED_TEXT, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                  <Bar
                    dataKey="service_ghs"
                    name="Service fees"
                    stackId="revenue"
                    fill={SERIES_1}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                  <Bar
                    dataKey="government_ghs"
                    name="Government pass-through"
                    stackId="revenue"
                    fill={SERIES_2}
                    stroke="var(--card)"
                    strokeWidth={2}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {isAdmin && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Officer workload</CardTitle>
              </CardHeader>
              <CardContent>
                {!workload || workload.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No case officers yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Officer</TableHead>
                          <TableHead className="text-right">Open cases</TableHead>
                          <TableHead className="text-right">Open tasks</TableHead>
                          <TableHead className="text-right">Breached</TableHead>
                          <TableHead className="text-right">Breach rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workload.map((row) => (
                          <TableRow key={row.officer_id}>
                            <TableCell className="font-medium">{row.officer_name}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.open_cases}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.open_tasks}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.breached_tasks}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {Math.round(row.breach_rate * 100)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
