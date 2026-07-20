import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Download, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { getDownloadUrl, listCaseDocuments, uploadDocument, type CaseDocument } from "@/api/documents"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { FileDropzone } from "@/components/case/FileDropzone"
import { cn } from "@/lib/utils"

const REASON_LABELS: Record<string, string> = {
  illegible: "Illegible",
  expired: "Expired",
  name_mismatch: "Name mismatch",
  incomplete: "Incomplete",
  wrong_document: "Wrong document",
}

function typeLabel(code: string): string {
  return code.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase())
}

function ReviewBadge({ doc }: { doc: CaseDocument }) {
  const version = doc.versions[doc.versions.length - 1]
  if (!version) return null
  const status = version.review_status
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        status === "approved" && "bg-success/10 text-success",
        status === "rejected" && "bg-error/10 text-error",
        status === "pending_review" && "bg-warning/10 text-warning"
      )}
    >
      {status === "approved" && "Approved"}
      {status === "pending_review" && "Pending review"}
      {status === "rejected" &&
        `Rejected — ${REASON_LABELS[version.review_reason_code ?? ""] ?? "see note"}`}
    </span>
  )
}

export function DocumentCenter({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient()
  const { data: documents, isLoading } = useQuery({
    queryKey: ["case-documents", caseId],
    queryFn: () => listCaseDocuments(caseId),
  })

  const reuploadMutation = useMutation({
    mutationFn: ({ doc, file }: { doc: CaseDocument; file: File }) =>
      uploadDocument({
        business_case_id: caseId,
        document_type_code: doc.document_type_code,
        file,
        document_id: doc.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-documents", caseId] })
      toast.success("New version uploaded — it's back in the review queue.")
    },
    onError: () => toast.error("Upload failed. Please try again."),
  })

  async function handleDownload(doc: CaseDocument) {
    try {
      const { download_url } = await getDownloadUrl(doc.id)
      window.open(download_url, "_blank", "noopener")
    } catch {
      toast.error("Couldn't fetch the download link.")
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    )
  }

  const vaultDocs = (documents ?? []).filter((d) => d.is_vault)
  const regularDocs = (documents ?? []).filter((d) => !d.is_vault)
  const rejectedDocs = regularDocs.filter(
    (d) => d.versions[d.versions.length - 1]?.review_status === "rejected"
  )

  return (
    <div className="grid gap-6">
      {vaultDocs.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="text-primary size-4" />
            Your certificates
          </h3>
          <ul className="mt-2 grid gap-2">
            {vaultDocs.map((doc) => (
              <li
                key={doc.id}
                className="border-primary/30 bg-primary-50 flex items-center justify-between gap-3 rounded-lg border p-3 dark:bg-primary/10"
              >
                <span className="text-sm font-medium">{typeLabel(doc.document_type_code)}</span>
                <Button variant="outline" size="sm" onClick={() => handleDownload(doc)}>
                  <Download data-icon="inline-start" className="size-3.5" />
                  Download
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold">Your documents</h3>
        {regularDocs.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            No documents yet — tasks that need an upload will appear in your action list.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regularDocs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{typeLabel(doc.document_type_code)}</TableCell>
                    <TableCell>v{doc.current_version_number}</TableCell>
                    <TableCell>
                      <ReviewBadge doc={doc} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)}>
                        <Download className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {rejectedDocs.map((doc) => (
        <section key={doc.id}>
          <h3 className="text-sm font-semibold">
            Re-upload: {typeLabel(doc.document_type_code)}
          </h3>
          {doc.versions[doc.versions.length - 1]?.review_note && (
            <p className="text-muted-foreground mt-1 text-sm">
              Reviewer's note: {doc.versions[doc.versions.length - 1].review_note}
            </p>
          )}
          <div className="mt-2">
            <FileDropzone
              onFile={(file) => reuploadMutation.mutate({ doc, file })}
              disabled={reuploadMutation.isPending}
              label={reuploadMutation.isPending ? "Uploading…" : "Upload a corrected version"}
            />
          </div>
        </section>
      ))}
    </div>
  )
}
