import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { format, formatDistanceToNowStrict, isPast } from "date-fns"
import { toast } from "sonner"

import { assignCase, fetchCaseQueue, listStaff } from "@/api/ops"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusChip } from "@/components/case/StatusChip"

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
]

const STAGE_FILTERS = [
  { value: "all", label: "All stages" },
  { value: "name_reservation", label: "Name Reservation" },
  { value: "incorporation", label: "Incorporation" },
  { value: "tax_registration", label: "Tax Registration" },
  { value: "ssnit_registration", label: "SSNIT Registration" },
  { value: "business_operating_permit", label: "Operating Permit" },
]

function caseStatusDisplay(status: string): string {
  switch (status) {
    case "completed":
      return "Done"
    case "blocked":
      return "Blocked"
    case "active":
      return "With government"
    default:
      return "Not started"
  }
}

const PAGE_SIZE = 15

const SLA_FILTERS = [
  { value: "all", label: "All SLAs" },
  { value: "breaching_soon", label: "Breaching soon (24h)" },
  { value: "breached", label: "Breached" },
]

function SlaCell({ dueAt, breached }: { dueAt: string | null; breached: boolean }) {
  if (breached) {
    return <span className="text-error text-xs font-semibold">Breached</span>
  }
  if (!dueAt) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  const due = new Date(dueAt)
  const overdue = isPast(due)
  return (
    <span className={cn("text-xs", overdue ? "text-error font-medium" : "text-muted-foreground")}>
      {overdue ? "overdue" : `${formatDistanceToNowStrict(due)} left`}
    </span>
  )
}

export default function QueuePage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("all")
  const [stageFilter, setStageFilter] = useState("all")
  const [officerFilter, setOfficerFilter] = useState("all")
  const [slaFilter, setSlaFilter] = useState("all")

  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff })

  const { data, isLoading } = useQuery({
    queryKey: ["case-queue", page, statusFilter, stageFilter, officerFilter, slaFilter],
    queryFn: () =>
      fetchCaseQueue({
        page,
        page_size: PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
        stage_code: stageFilter === "all" ? undefined : stageFilter,
        assigned_officer_id: officerFilter === "all" ? undefined : officerFilter,
        sla: slaFilter === "all" ? undefined : (slaFilter as "breached" | "breaching_soon"),
      }),
  })

  const assignMutation = useMutation({
    mutationFn: ({ caseId, officerId }: { caseId: string; officerId: string }) =>
      assignCase(caseId, officerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-queue"] })
      toast.success("Case assigned.")
    },
    onError: () => toast.error("Couldn't assign the case."),
  })

  const totalPages = data ? Math.max(Math.ceil(data.total / PAGE_SIZE), 1) : 1

  const officerItems = [
    { value: "all", label: "All officers" },
    { value: "unassigned", label: "Unassigned" },
    ...(staff ?? []).map((s) => ({ value: s.id, label: s.full_name })),
  ]

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Case Queue</h1>
        <div className="flex flex-wrap gap-2">
          <Select
            items={STATUS_FILTERS}
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as string)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={STAGE_FILTERS}
            value={stageFilter}
            onValueChange={(v) => {
              setStageFilter(v as string)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGE_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={officerItems}
            value={officerFilter}
            onValueChange={(v) => {
              setOfficerFilter(v as string)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {officerItems.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={SLA_FILTERS}
            value={slaFilter}
            onValueChange={(v) => {
              setSlaFilter(v as string)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLA_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Assigned to</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                    No cases match these filters.
                  </TableCell>
                </TableRow>
              )}
              {(data?.items ?? []).map((c) => (
                <TableRow key={c.id} className={cn(c.sla_breached && "bg-error/5 hover:bg-error/10")}>
                  <TableCell>
                    <Link to={`/ops/cases/${c.id}`} className="text-primary font-medium hover:underline">
                      {c.case_number}
                    </Link>
                  </TableCell>
                  <TableCell>{c.business_name}</TableCell>
                  <TableCell>{c.current_stage_name ?? "—"}</TableCell>
                  <TableCell>
                    <StatusChip label={caseStatusDisplay(c.status)} />
                  </TableCell>
                  <TableCell>
                    <SlaCell dueAt={c.next_sla_due_at} breached={c.sla_breached} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(c.created_at), "d MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <Select
                      items={(staff ?? []).map((s) => ({ value: s.id, label: s.full_name }))}
                      value={c.assigned_officer_id}
                      onValueChange={(v) =>
                        v && assignMutation.mutate({ caseId: c.id, officerId: v as string })
                      }
                    >
                      <SelectTrigger size="sm" className="w-36">
                        <SelectValue placeholder="Assign…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(staff ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {data ? `${data.total} case${data.total === 1 ? "" : "s"}` : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
