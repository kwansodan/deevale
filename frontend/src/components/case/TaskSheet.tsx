import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { FileCheck2 } from "lucide-react"

import { completeClientTask, type CaseTask } from "@/api/cases"
import { uploadDocument } from "@/api/documents"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { StatusChip } from "@/components/case/StatusChip"
import { FileDropzone } from "@/components/case/FileDropzone"

export function TaskSheet({
  caseId,
  task,
  onClose,
}: {
  caseId: string
  task: CaseTask | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadDocument({
        business_case_id: caseId,
        document_type_code: task?.required_document_type ?? "other",
        file,
        case_task_id: task?.id,
        document_id: task?.linked_document_id ?? undefined,
      }),
    onSuccess: (_doc, file) => {
      setUploadedFileName(file.name)
      queryClient.invalidateQueries({ queryKey: ["case-documents", caseId] })
      toast.success("Uploaded — now submit it for review.")
    },
    onError: () => toast.error("Upload failed. Please try again."),
  })

  const completeMutation = useMutation({
    mutationFn: () => completeClientTask(caseId, task!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      toast.success(task?.requires_document ? "Submitted for review." : "Marked as done.")
      setUploadedFileName(null)
      onClose()
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't complete this task."
      toast.error(message)
    },
  })

  const hasUploadForThisAttempt = Boolean(uploadedFileName) || Boolean(task?.linked_document_id)

  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {task && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <SheetTitle>{task.name}</SheetTitle>
                <StatusChip label={task.status_display} />
              </div>
              <SheetDescription>
                {task.description ?? "Complete this step to keep your registration moving."}
              </SheetDescription>
            </SheetHeader>

            <div className="grid gap-4 px-4">
              {task.requires_document ? (
                <>
                  <FileDropzone
                    onFile={(file) => uploadMutation.mutate(file)}
                    disabled={uploadMutation.isPending}
                    label={
                      uploadMutation.isPending
                        ? "Uploading…"
                        : task.linked_document_id
                          ? "Upload a new version"
                          : "Drag & drop your document, or tap to browse"
                    }
                  />
                  {uploadedFileName && (
                    <div className="text-success flex items-center gap-2 text-sm">
                      <FileCheck2 className="size-4" />
                      {uploadedFileName} uploaded
                    </div>
                  )}
                  <Button
                    disabled={!hasUploadForThisAttempt || completeMutation.isPending}
                    onClick={() => completeMutation.mutate()}
                  >
                    {completeMutation.isPending ? "Submitting…" : "Submit for review"}
                  </Button>
                </>
              ) : (
                <Button disabled={completeMutation.isPending} onClick={() => completeMutation.mutate()}>
                  {completeMutation.isPending ? "Saving…" : "Mark as done"}
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
