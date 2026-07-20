import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useParams } from "react-router-dom"
import { format } from "date-fns"
import { toast } from "sonner"
import { ArrowLeft, FileUp, Landmark, ShieldCheck } from "lucide-react"

import { getCase, formatGhs, type CaseStage, type CaseTask } from "@/api/cases"
import { listCaseDocuments, getDownloadUrl, uploadDocument, type CaseDocument } from "@/api/documents"
import {
  fetchCaseAuditLogs,
  fetchCaseInvoices,
  reviewDocumentVersion,
  transitionStage,
  transitionTask,
} from "@/api/ops"
import { useAuthStore, hasRole } from "@/stores/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { StatusChip } from "@/components/case/StatusChip"
import { FileDropzone } from "@/components/case/FileDropzone"
import { MessageThread } from "@/components/case/MessageThread"
import { SignaturesPanel } from "@/components/case/SignaturesPanel"
import { cn } from "@/lib/utils"

const REJECT_REASONS = [
  { value: "illegible", label: "Illegible" },
  { value: "expired", label: "Expired" },
  { value: "name_mismatch", label: "Name mismatch" },
  { value: "incomplete", label: "Incomplete" },
  { value: "wrong_document", label: "Wrong document" },
]

function typeLabel(code: string): string {
  return code.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase())
}

// Mirrors the backend guard: a staff task requiring evidence can only be
// completed once its linked document's latest version is approved.
function taskEvidenceState(task: CaseTask, documents: CaseDocument[] | undefined) {
  if (!task.requires_document) return { canComplete: true, reason: null as string | null }
  const doc = documents?.find((d) => d.id === task.linked_document_id)
  const latest = doc?.versions[doc.versions.length - 1]
  if (!doc || !latest || latest.upload_status !== "uploaded") {
    return { canComplete: false, reason: "Upload the evidence document first" }
  }
  if (latest.review_status !== "approved") {
    return { canComplete: false, reason: "Evidence must be approved before completing" }
  }
  return { canComplete: true, reason: null }
}

function StageTaskTree({
  caseId,
  stages,
  documents,
  isReviewerOnly,
}: {
  caseId: string
  stages: CaseStage[]
  documents: CaseDocument[] | undefined
  isReviewerOnly: boolean
}) {
  const queryClient = useQueryClient()
  const [evidenceTask, setEvidenceTask] = useState<CaseTask | null>(null)

  const taskMutation = useMutation({
    mutationFn: ({ taskId, newStatus }: { taskId: string; newStatus: string }) =>
      transitionTask(caseId, taskId, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      toast.success("Task updated.")
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Transition not allowed."
      toast.error(message)
    },
  })

  const stageMutation = useMutation({
    mutationFn: ({ stageId, newStatus }: { stageId: string; newStatus: string }) =>
      transitionStage(caseId, stageId, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      toast.success("Stage updated.")
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Transition not allowed."
      toast.error(message)
    },
  })

  const uploadEvidenceMutation = useMutation({
    mutationFn: ({ task, file }: { task: CaseTask; file: File }) =>
      uploadDocument({
        business_case_id: caseId,
        document_type_code: task.required_document_type ?? "other",
        file,
        case_task_id: task.id,
        document_id: task.linked_document_id ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-documents", caseId] })
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      toast.success("Evidence uploaded — approve it in the Documents tab to unlock the task.")
      setEvidenceTask(null)
    },
    onError: () => toast.error("Upload failed."),
  })

  return (
    <div className="grid gap-4">
      {stages.map((stage) => {
        const requiredNotDone = stage.tasks.filter(
          (t) => t.is_required && !["done", "skipped"].includes(t.status)
        )
        const stageCompleteBlocked = requiredNotDone.length > 0
        return (
          <div key={stage.id} className="border-border rounded-lg border">
            <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{stage.name}</span>
                <StatusChip
                  label={
                    stage.status === "completed"
                      ? "Done"
                      : stage.status === "in_progress"
                        ? "With government"
                        : stage.status === "blocked_on_payment"
                          ? "Blocked"
                          : "Not started"
                  }
                />
              </div>
              {stage.status === "in_progress" && !isReviewerOnly && (
                <div className="flex items-center gap-2">
                  {stageCompleteBlocked && (
                    <span className="text-muted-foreground text-xs">
                      {requiredNotDone.length} required task{requiredNotDone.length === 1 ? "" : "s"} open
                    </span>
                  )}
                  <Button
                    size="sm"
                    disabled={stageCompleteBlocked || stageMutation.isPending}
                    onClick={() => stageMutation.mutate({ stageId: stage.id, newStatus: "completed" })}
                  >
                    Complete stage
                  </Button>
                </div>
              )}
              {stage.status === "blocked_on_payment" && (
                <span className="text-error text-xs font-medium">Awaiting payment</span>
              )}
            </div>
            <ul className="divide-border divide-y">
              {stage.tasks.map((task) => {
                const evidence = taskEvidenceState(task, documents)
                const isStaffTask = task.assignee_type === "staff"
                const actionable =
                  isStaffTask &&
                  !isReviewerOnly &&
                  !["done", "skipped"].includes(task.status) &&
                  stage.status === "in_progress"
                return (
                  <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-sm",
                            task.status === "done" && "text-muted-foreground line-through"
                          )}
                        >
                          {task.name}
                        </span>
                        <StatusChip label={task.status_display} />
                        {!task.is_required && (
                          <span className="text-muted-foreground text-xs">(optional)</span>
                        )}
                      </div>
                      {task.government_reference_note && (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Ref: {task.government_reference_note}
                        </p>
                      )}
                    </div>
                    {actionable && (
                      <div className="flex items-center gap-2">
                        {task.requires_document && (
                          <Button variant="outline" size="sm" onClick={() => setEvidenceTask(task)}>
                            <FileUp data-icon="inline-start" className="size-3.5" />
                            {task.linked_document_id ? "Replace evidence" : "Upload evidence"}
                          </Button>
                        )}
                        <div className="flex flex-col items-end gap-0.5">
                          <Button
                            size="sm"
                            disabled={!evidence.canComplete || taskMutation.isPending}
                            onClick={() => taskMutation.mutate({ taskId: task.id, newStatus: "done" })}
                          >
                            Mark done
                          </Button>
                          {!evidence.canComplete && (
                            <span className="text-muted-foreground text-[11px]">{evidence.reason}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}

      <Dialog open={!!evidenceTask} onOpenChange={(open) => !open && setEvidenceTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload evidence: {evidenceTask?.name}</DialogTitle>
            <DialogDescription>
              {evidenceTask?.required_document_type
                ? `Expected document: ${typeLabel(evidenceTask.required_document_type)}`
                : "Upload the government receipt or certificate for this task."}
            </DialogDescription>
          </DialogHeader>
          {evidenceTask && (
            <FileDropzone
              onFile={(file) => uploadEvidenceMutation.mutate({ task: evidenceTask, file })}
              disabled={uploadEvidenceMutation.isPending}
              label={uploadEvidenceMutation.isPending ? "Uploading…" : "Drop the file here or tap to browse"}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DocumentReviewPanel({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient()
  const { data: documents, isLoading } = useQuery({
    queryKey: ["case-documents", caseId],
    queryFn: () => listCaseDocuments(caseId),
  })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewIsPdf, setPreviewIsPdf] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<CaseDocument | null>(null)
  const [rejectReason, setRejectReason] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState("")

  const reviewMutation = useMutation({
    mutationFn: ({
      doc,
      decision,
      reasonCode,
      note,
    }: {
      doc: CaseDocument
      decision: "approve" | "reject"
      reasonCode?: string
      note?: string
    }) => reviewDocumentVersion(doc.id, doc.current_version_number, decision, reasonCode, note),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["case-documents", caseId] })
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      toast.success(vars.decision === "approve" ? "Document approved." : "Document rejected.")
      setRejectTarget(null)
      setRejectReason(null)
      setRejectNote("")
    },
    onError: () => toast.error("Review failed."),
  })

  async function openPreview(doc: CaseDocument) {
    try {
      const { download_url } = await getDownloadUrl(doc.id)
      const latest = doc.versions[doc.versions.length - 1]
      setPreviewIsPdf(latest?.content_type === "application/pdf")
      setPreviewUrl(download_url)
    } catch {
      toast.error("Couldn't load the document.")
    }
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />

  const pending = (documents ?? []).filter(
    (d) =>
      d.versions.length > 0 &&
      d.versions[d.versions.length - 1].upload_status === "uploaded" &&
      d.versions[d.versions.length - 1].review_status === "pending_review"
  )
  const decided = (documents ?? []).filter((d) => !pending.includes(d))

  return (
    <div className="grid gap-5">
      <section>
        <h3 className="text-sm font-semibold">Awaiting review ({pending.length})</h3>
        {pending.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">Review queue is clear. 🎉</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {pending.map((doc) => (
              <li
                key={doc.id}
                className="border-warning/40 bg-warning/5 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{typeLabel(doc.document_type_code)}</p>
                  <p className="text-muted-foreground text-xs">
                    v{doc.current_version_number} ·{" "}
                    {doc.versions[doc.versions.length - 1].original_filename}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openPreview(doc)}>
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    disabled={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ doc, decision: "approve" })}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={reviewMutation.isPending}
                    onClick={() => setRejectTarget(doc)}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">All documents</h3>
          <ul className="mt-2 grid gap-1.5">
            {decided.map((doc) => {
              const latest = doc.versions[doc.versions.length - 1]
              return (
                <li key={doc.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5">
                    {doc.is_vault && <ShieldCheck className="text-primary size-3.5" />}
                    {typeLabel(doc.document_type_code)} (v{doc.current_version_number})
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs",
                        latest?.review_status === "approved" && "text-success",
                        latest?.review_status === "rejected" && "text-error",
                        latest?.review_status === "pending_review" && "text-muted-foreground"
                      )}
                    >
                      {latest?.review_status.replaceAll("_", " ")}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => openPreview(doc)}>
                      View
                    </Button>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Document preview</DialogTitle>
          </DialogHeader>
          {previewUrl &&
            (previewIsPdf ? (
              <iframe src={previewUrl} title="Document preview" className="h-[70vh] w-full rounded-md" />
            ) : (
              <img src={previewUrl} alt="Document preview" className="max-h-[70vh] w-full object-contain" />
            ))}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reject {rejectTarget ? typeLabel(rejectTarget.document_type_code) : "document"}
            </DialogTitle>
            <DialogDescription>
              The client sees the reason you pick, plus your note — keep it actionable.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Select
              items={REJECT_REASONS}
              value={rejectReason}
              onValueChange={(v) => setRejectReason(v as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Reason code" />
              </SelectTrigger>
              <SelectContent>
                {REJECT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Optional note for the client, e.g. 'Please rescan page 2 in colour.'"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
            />
            <Button
              variant="destructive"
              disabled={!rejectReason || reviewMutation.isPending}
              onClick={() =>
                rejectTarget &&
                reviewMutation.mutate({
                  doc: rejectTarget,
                  decision: "reject",
                  reasonCode: rejectReason ?? undefined,
                  note: rejectNote || undefined,
                })
              }
            >
              Reject document
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PaymentsPanel({ caseId }: { caseId: string }) {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["case-invoices", caseId],
    queryFn: () => fetchCaseInvoices(caseId),
  })

  if (isLoading) return <Skeleton className="h-32 w-full" />
  if (!invoices || invoices.length === 0) {
    return <p className="text-muted-foreground text-sm">No invoices yet for this case.</p>
  }

  return (
    <div className="grid gap-3">
      {invoices.map((invoice) => (
        <div key={invoice.id} className="border-border rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{invoice.invoice_number}</span>
            <StatusChip
              label={
                invoice.status === "paid" ? "Done" : invoice.status === "failed" ? "Blocked" : "In review"
              }
            />
          </div>
          <div className="text-muted-foreground mt-1 flex items-center justify-between text-xs">
            <span>
              {invoice.paid_at
                ? `Paid ${format(new Date(invoice.paid_at), "d MMM yyyy, HH:mm")}`
                : invoice.sent_at
                  ? `Sent ${format(new Date(invoice.sent_at), "d MMM yyyy")}`
                  : "Draft"}
            </span>
            <span className="text-foreground font-medium">{formatGhs(invoice.total_minor)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function AuditLogPanel({ caseId }: { caseId: string }) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["case-audit", caseId],
    queryFn: () => fetchCaseAuditLogs(caseId),
  })

  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (!entries || entries.length === 0) {
    return <p className="text-muted-foreground text-sm">No audit entries.</p>
  }

  return (
    <ul className="grid gap-1.5">
      {entries.map((entry) => (
        <li key={entry.id} className="border-border flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm">
          <div className="min-w-0">
            <span className="font-medium">{entry.action.replaceAll("_", " ")}</span>
            {entry.context && Object.keys(entry.context).length > 0 && (
              <span className="text-muted-foreground ml-2 text-xs break-all">
                {JSON.stringify(entry.context)}
              </span>
            )}
          </div>
          <span className="text-muted-foreground shrink-0 text-xs">
            {format(new Date(entry.created_at), "d MMM, HH:mm:ss")}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const user = useAuthStore((s) => s.user)
  const isReviewerOnly =
    hasRole(user?.roles, "reviewer") && !hasRole(user?.roles, "case_officer", "admin")

  const { data: businessCase, isLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId!),
    enabled: !!caseId,
  })
  const { data: documents } = useQuery({
    queryKey: ["case-documents", caseId],
    queryFn: () => listCaseDocuments(caseId!),
    enabled: !!caseId,
  })

  if (isLoading || !businessCase) {
    return <Skeleton className="h-64 w-full" />
  }

  const client = businessCase.client as
    | { full_name: string; email: string; phone: string }
    | null

  return (
    <div className="grid gap-5">
      <div>
        <Link to="/ops/queue" className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
          <ArrowLeft className="size-3.5" />
          Back to queue
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">
              {(businessCase.onboarding_payload?.business_name as string) ?? businessCase.case_number}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {businessCase.case_number} · {typeLabel(businessCase.entity_type)}
            </p>
            {client && (
              <p className="text-muted-foreground mt-0.5 text-sm">
                {client.full_name} · {client.email} · {client.phone}
              </p>
            )}
          </div>
          {businessCase.quote && (
            <Card className="border-border">
              <CardContent className="flex items-center gap-3 px-4 py-3">
                <Landmark className="text-primary size-5" />
                <div>
                  <p className="text-muted-foreground text-xs">Quote total</p>
                  <p className="font-semibold">{formatGhs(businessCase.quote.total_minor)}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Tabs defaultValue="workflow">
        <TabsList>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="signatures">Signatures</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="workflow" className="pt-4">
          <StageTaskTree
            caseId={businessCase.id}
            stages={businessCase.stages}
            documents={documents}
            isReviewerOnly={isReviewerOnly}
          />
        </TabsContent>
        <TabsContent value="documents" className="pt-4">
          <Card className="border-border">
            <CardContent className="pt-5">
              <DocumentReviewPanel caseId={businessCase.id} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="messages" className="pt-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Client thread</CardTitle>
            </CardHeader>
            <CardContent>
              <MessageThread caseId={businessCase.id} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="signatures" className="pt-4">
          <SignaturesPanel caseId={businessCase.id} />
        </TabsContent>
        <TabsContent value="payments" className="pt-4">
          <PaymentsPanel caseId={businessCase.id} />
        </TabsContent>
        <TabsContent value="audit" className="pt-4">
          <AuditLogPanel caseId={businessCase.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
