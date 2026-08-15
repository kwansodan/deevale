import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { FileCheck2 } from "lucide-react"

import { completeClientTask, type CaseTask, type TaskField } from "@/api/cases"
import { uploadDocument } from "@/api/documents"
import { formatBytes } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { StatusChip } from "@/components/case/StatusChip"
import { FileDropzone } from "@/components/case/FileDropzone"

/**
 * Renders a task's `input_schema` as a form and collects the answers. The
 * schema is data (defined on the workflow), so this component knows nothing
 * about any specific task -- adding a new data-entry task is configuration, not
 * code here. Keyed on task.id by the parent so state resets per task.
 */
function TaskInputForm({
  fields,
  initial,
  submitting,
  onSubmit,
}: {
  fields: TaskField[]
  initial: Record<string, string> | null
  submitting: boolean
  onSubmit: (data: Record<string, string>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, initial?.[f.name] ?? ""]))
  )
  const set = (name: string, v: string) => setValues((s) => ({ ...s, [name]: v }))
  const missingRequired = fields.some((f) => f.required && !values[f.name]?.trim())

  return (
    <div className="grid gap-4">
      {fields.map((field) => (
        <div key={field.name} className="grid gap-1.5">
          <Label>
            {field.label}
            {!field.required && (
              <span className="text-muted-foreground font-normal"> (optional)</span>
            )}
          </Label>
          {field.type === "textarea" ? (
            <Textarea
              value={values[field.name]}
              placeholder={field.placeholder}
              onChange={(e) => set(field.name, e.target.value)}
            />
          ) : field.type === "select" ? (
            <Select value={values[field.name]} onValueChange={(v) => set(field.name, v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={field.placeholder ?? "Select…"} />
              </SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={values[field.name]}
              placeholder={field.placeholder}
              onChange={(e) => set(field.name, e.target.value)}
            />
          )}
        </div>
      ))}
      <Button disabled={missingRequired || submitting} onClick={() => onSubmit(values)}>
        {submitting ? "Submitting…" : "Submit"}
      </Button>
    </div>
  )
}

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
  const [uploaded, setUploaded] = useState<{ name: string; size: number } | null>(null)

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
      setUploaded({ name: file.name, size: file.size })
      queryClient.invalidateQueries({ queryKey: ["case-documents", caseId] })
      toast.success("Uploaded - now submit it for review.")
    },
    onError: () => toast.error("Upload failed. Please try again."),
  })

  const completeMutation = useMutation({
    mutationFn: (vars?: { submitted_data?: Record<string, string> }) =>
      completeClientTask(caseId, task!.id, vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      toast.success(task?.requires_document ? "Submitted for review." : "Saved.")
      setUploaded(null)
      onClose()
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't complete this task."
      toast.error(message)
    },
  })

  const hasUploadForThisAttempt = Boolean(uploaded) || Boolean(task?.linked_document_id)
  const hasForm = Boolean(task?.input_schema && task.input_schema.length > 0)

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
              {hasForm ? (
                <TaskInputForm
                  key={task.id}
                  fields={task.input_schema!}
                  initial={task.submitted_data}
                  submitting={completeMutation.isPending}
                  onSubmit={(data) => completeMutation.mutate({ submitted_data: data })}
                />
              ) : task.requires_document ? (
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
                  {uploaded && (
                    <div className="text-success flex items-center gap-2 text-sm">
                      <FileCheck2 className="size-4" />
                      {uploaded.name} ({formatBytes(uploaded.size)}) uploaded
                    </div>
                  )}
                  <Button
                    disabled={!hasUploadForThisAttempt || completeMutation.isPending}
                    onClick={() => completeMutation.mutate(undefined)}
                  >
                    {completeMutation.isPending ? "Submitting…" : "Submit for review"}
                  </Button>
                </>
              ) : (
                <Button disabled={completeMutation.isPending} onClick={() => completeMutation.mutate(undefined)}>
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
