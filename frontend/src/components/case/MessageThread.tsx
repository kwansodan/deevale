import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { Paperclip, SendHorizonal, X } from "lucide-react"
import { toast } from "sonner"

import { listCaseMessages, markCaseMessagesRead, sendCaseMessage } from "@/api/messages"
import { getDownloadUrl, uploadDocument } from "@/api/documents"
import { formatBytes } from "@/lib/format"
import { useAuthStore } from "@/stores/auth"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** Opens a document's presigned download URL (works once served over HTTPS). */
async function openAttachment(documentId: string) {
  try {
    const { download_url } = await getDownloadUrl(documentId)
    window.open(download_url, "_blank", "noopener")
  } catch {
    toast.error("Couldn't open the attachment.")
  }
}

export function MessageThread({ caseId }: { caseId: string }) {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState("")
  const [attached, setAttached] = useState<{ id: string; name: string; size: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: messages, isLoading } = useQuery({
    queryKey: ["case-messages", caseId],
    queryFn: () => listCaseMessages(caseId),
    refetchInterval: 20_000,
  })

  useEffect(() => {
    markCaseMessagesRead(caseId)
      .then(() => queryClient.invalidateQueries({ queryKey: ["messages-unread", caseId] }))
      .catch(() => {})
  }, [caseId, queryClient])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages?.length])

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadDocument({ business_case_id: caseId, document_type_code: "message_attachment", file }),
    onSuccess: (doc, file) => {
      setAttached({ id: doc.id, name: file.name, size: file.size })
      queryClient.invalidateQueries({ queryKey: ["case-documents", caseId] })
    },
    onError: () => toast.error("Attachment upload failed."),
  })

  const sendMutation = useMutation({
    mutationFn: () => sendCaseMessage(caseId, draft.trim(), attached?.id),
    onSuccess: () => {
      setDraft("")
      setAttached(null)
      queryClient.invalidateQueries({ queryKey: ["case-messages", caseId] })
    },
    onError: () => toast.error("Message didn't send. Try again."),
  })

  const canSend = (Boolean(draft.trim()) || Boolean(attached)) && !sendMutation.isPending

  if (isLoading) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="ml-auto h-12 w-2/3" />
        <Skeleton className="h-12 w-1/2" />
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="grid max-h-96 gap-3 overflow-y-auto pr-1">
        {(messages ?? []).length === 0 && (
          <p className="text-muted-foreground text-sm">
            No messages yet. Your case officer is one message away - ask anything about your registration.
          </p>
        )}
        {(messages ?? []).map((message) => {
          const isMine = message.sender_user_id === user?.id
          return (
            <div
              key={message.id}
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                isMine ? "bg-primary text-primary-foreground ml-auto" : "bg-muted"
              )}
            >
              {message.body && <p className="whitespace-pre-wrap">{message.body}</p>}
              {message.attachment_document_id && (
                <button
                  type="button"
                  onClick={() => openAttachment(message.attachment_document_id!)}
                  className={cn(
                    "mt-1 flex items-center gap-1.5 text-xs underline underline-offset-2",
                    isMine ? "text-primary-foreground" : "text-primary"
                  )}
                >
                  <Paperclip className="size-3" /> View attachment
                </button>
              )}
              <p className={cn("mt-1 text-[10px]", isMine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {format(new Date(message.created_at), "d MMM, HH:mm")}
              </p>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {attached && (
        <div className="bg-muted flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm">
          <span className="flex min-w-0 items-center gap-1.5">
            <Paperclip className="size-3.5 shrink-0" />
            <span className="truncate">{attached.name}</span>
            <span className="text-muted-foreground shrink-0 text-xs">{formatBytes(attached.size)}</span>
          </span>
          <button type="button" aria-label="Remove attachment" onClick={() => setAttached(null)}>
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSend) sendMutation.mutate()
        }}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadMutation.mutate(file)
            e.target.value = ""
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={uploadMutation.isPending}
          aria-label="Attach a file"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="size-4" />
        </Button>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={uploadMutation.isPending ? "Uploading attachment…" : "Write a message…"}
          rows={2}
          className="flex-1 resize-none"
        />
        <Button type="submit" size="icon" disabled={!canSend} aria-label="Send message">
          <SendHorizonal className="size-4" />
        </Button>
      </form>
    </div>
  )
}
