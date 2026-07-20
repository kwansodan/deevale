import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { CheckCircle2, Clock, Copy, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  createSignatureRequest,
  listCaseSignatureRequests,
  sendSignatureRequest,
} from "@/api/signatures"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/10 text-info",
  completed: "bg-success/10 text-success",
  declined: "bg-error/10 text-error",
}

function CreateDialog({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("<p>Constitution of {{ company_name }}.</p>")
  const [parties, setParties] = useState([{ name: "", email: "" }])

  const mutation = useMutation({
    mutationFn: () =>
      createSignatureRequest({
        business_case_id: caseId,
        title,
        body_html: body,
        parties: parties.filter((p) => p.name.trim() && p.email.trim()),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-requests", caseId] })
      toast.success("Draft created — send it when you're ready.")
      onClose()
    },
    onError: () => toast.error("Couldn't create the request."),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New signature request</DialogTitle>
          <DialogDescription>
            Merge fields like {"{{ company_name }}"} and {"{{ shares }}"} render into the document.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Input placeholder="Document title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="grid gap-2">
            <p className="text-sm font-medium">Signers (in signing order)</p>
            {parties.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input
                  placeholder="Name"
                  value={p.name}
                  onChange={(e) => setParties((ps) => ps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
                <Input
                  placeholder="Email"
                  value={p.email}
                  onChange={(e) => setParties((ps) => ps.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove signer"
                  disabled={parties.length === 1}
                  onClick={() => setParties((ps) => ps.filter((_, j) => j !== i))}
                >
                  <Trash2 className="text-muted-foreground size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => setParties((ps) => [...ps, { name: "", email: "" }])}
            >
              <Plus data-icon="inline-start" className="size-3.5" />
              Add signer
            </Button>
          </div>
          <Button
            disabled={!title.trim() || parties.every((p) => !p.name.trim()) || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Create draft
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SignaturesPanel({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const { data: requests, isLoading } = useQuery({
    queryKey: ["signature-requests", caseId],
    queryFn: () => listCaseSignatureRequests(caseId),
  })

  const sendMutation = useMutation({
    mutationFn: sendSignatureRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-requests", caseId] })
      toast.success("Sent for signature.")
    },
    onError: () => toast.error("Couldn't send the request."),
  })

  if (isLoading) return <Skeleton className="h-40 w-full" />

  return (
    <div className="grid gap-3">
      <Button className="justify-self-start" onClick={() => setCreating(true)}>
        <Plus data-icon="inline-start" className="size-4" />
        New signature request
      </Button>

      {(requests ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No signature requests yet.</p>
      ) : (
        (requests ?? []).map((req) => (
          <Card key={req.id} className="border-border">
            <CardContent className="grid gap-3 pt-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{req.title}</p>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[req.status])}>
                  {req.status}
                </span>
              </div>
              <ul className="grid gap-1.5">
                {req.parties.map((party) => (
                  <li key={party.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      {party.status === "signed" ? (
                        <CheckCircle2 className="text-success size-4" />
                      ) : (
                        <Clock className="text-muted-foreground size-4" />
                      )}
                      {party.name} <span className="text-muted-foreground text-xs">({party.email})</span>
                      {party.signed_at && (
                        <span className="text-muted-foreground text-xs">
                          · {format(new Date(party.signed_at), "d MMM, HH:mm")}
                        </span>
                      )}
                    </span>
                    {req.status === "sent" && party.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/sign/${party.sign_token}`)
                          toast.success("Signing link copied.")
                        }}
                      >
                        <Copy data-icon="inline-start" className="size-3.5" />
                        Copy link
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {req.status === "draft" && (
                <Button
                  size="sm"
                  className="justify-self-start"
                  disabled={sendMutation.isPending}
                  onClick={() => sendMutation.mutate(req.id)}
                >
                  Send for signature
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {creating && <CreateDialog caseId={caseId} onClose={() => setCreating(false)} />}
    </div>
  )
}
