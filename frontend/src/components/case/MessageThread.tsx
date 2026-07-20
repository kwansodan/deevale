import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { SendHorizonal } from "lucide-react"
import { toast } from "sonner"

import { listCaseMessages, markCaseMessagesRead, sendCaseMessage } from "@/api/messages"
import { useAuthStore } from "@/stores/auth"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function MessageThread({ caseId }: { caseId: string }) {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: messages, isLoading } = useQuery({
    queryKey: ["case-messages", caseId],
    queryFn: () => listCaseMessages(caseId),
    refetchInterval: 20_000,
  })

  useEffect(() => {
    markCaseMessagesRead(caseId).catch(() => {})
  }, [caseId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages?.length])

  const sendMutation = useMutation({
    mutationFn: (body: string) => sendCaseMessage(caseId, body),
    onSuccess: () => {
      setDraft("")
      queryClient.invalidateQueries({ queryKey: ["case-messages", caseId] })
    },
    onError: () => toast.error("Message didn't send. Try again."),
  })

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
            No messages yet. Your case officer is one message away — ask anything about your registration.
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
              <p className="whitespace-pre-wrap">{message.body}</p>
              <p className={cn("mt-1 text-[10px]", isMine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {format(new Date(message.created_at), "d MMM, HH:mm")}
              </p>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const body = draft.trim()
          if (body) sendMutation.mutate(body)
        }}
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message to your case officer…"
          rows={2}
          className="flex-1 resize-none"
        />
        <Button type="submit" size="icon" disabled={!draft.trim() || sendMutation.isPending} aria-label="Send message">
          <SendHorizonal className="size-4" />
        </Button>
      </form>
    </div>
  )
}
