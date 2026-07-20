import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { Mail, MailOpen, Send, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { listCases } from "@/api/cases"
import {
  enroll,
  getDisclaimer,
  getMailDownloadUrl,
  listMail,
  requestForward,
  type MailItem,
} from "@/api/mailroom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

function EnrollmentCard({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient()
  const [showConsent, setShowConsent] = useState(false)
  const { data: disclaimer, isLoading } = useQuery({
    queryKey: ["mail-disclaimer", caseId],
    queryFn: () => getDisclaimer(caseId),
  })

  const enrollMutation = useMutation({
    mutationFn: () => enroll(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mail-disclaimer", caseId] })
      setShowConsent(false)
      toast.success("You're enrolled — your registered address is now active.")
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't enroll right now."
      toast.error(message)
    },
  })

  if (isLoading || !disclaimer || disclaimer.enrolled) return null

  return (
    <Card className="border-accent/40 bg-accent-50 dark:bg-accent/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="text-accent-600 size-4" />
          Use our address as your registered office
        </CardTitle>
        <CardDescription>
          We'll receive, scan, and forward your official mail — {disclaimer.office_address}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => setShowConsent(true)}>Enroll now</Button>
      </CardContent>

      <Dialog open={showConsent} onOpenChange={setShowConsent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registered address agreement</DialogTitle>
            <DialogDescription>Please read and accept before enrolling.</DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground max-h-64 overflow-y-auto text-sm">{disclaimer.disclaimer}</p>
          <Button disabled={enrollMutation.isPending} onClick={() => enrollMutation.mutate()}>
            {enrollMutation.isPending ? "Enrolling…" : "I agree — enroll me"}
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function ForwardDialog({
  mail,
  onClose,
}: {
  mail: MailItem | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [address, setAddress] = useState("")
  const mutation = useMutation({
    mutationFn: () => requestForward(mail!.id, address),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mail-inbox"] })
      toast.success("We'll forward the original to you.")
      setAddress("")
      onClose()
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't submit the forwarding request."
      toast.error(message)
    },
  })

  return (
    <Dialog open={!!mail} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forward this mail to you</DialogTitle>
          <DialogDescription>
            We'll post the original physical item to the address you provide.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Your full postal address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
        />
        <Button disabled={address.trim().length < 5 || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Requesting…" : "Request forwarding"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

export default function MailPage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [forwardMail, setForwardMail] = useState<MailItem | null>(null)
  const queryClient = useQueryClient()

  const { data: cases } = useQuery({ queryKey: ["cases"], queryFn: listCases })
  const caseId = cases?.[0]?.id ?? null

  const { data: mail, isLoading } = useQuery({
    queryKey: ["mail-inbox"],
    queryFn: () => listMail(),
  })

  async function openScan(item: MailItem) {
    try {
      const { download_url } = await getMailDownloadUrl(item.id)
      setPreviewUrl(download_url)
      queryClient.invalidateQueries({ queryKey: ["mail-inbox"] })
    } catch {
      toast.error("Couldn't open the scan.")
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-semibold">Mail</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Official mail received at your registered address, scanned for you.
        </p>
      </div>

      {caseId && <EnrollmentCard caseId={caseId} />}

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (mail ?? []).length === 0 ? (
        <Card className="border-border">
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-sm">
            <Mail className="size-6" />
            No mail yet. When mail arrives, we'll scan it and notify you.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {(mail ?? []).map((item) => (
            <Card key={item.id} className={cn("border-border", !item.read_at && "border-primary/30")}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  {item.read_at ? (
                    <MailOpen className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  ) : (
                    <Mail className="text-primary mt-0.5 size-4 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {item.sender}
                      {item.urgency === "urgent" && (
                        <span className="bg-error/10 text-error rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                          Urgent
                        </span>
                      )}
                    </p>
                    {item.subject && <p className="text-muted-foreground text-xs">{item.subject}</p>}
                    <p className="text-muted-foreground/70 text-xs">
                      Received {format(new Date(item.received_date), "d MMM yyyy")}
                      {item.shred_after &&
                        ` · original held until ${format(new Date(item.shred_after), "d MMM yyyy")}`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" disabled={!item.has_scan} onClick={() => openScan(item)}>
                    View scan
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setForwardMail(item)}>
                    <Send data-icon="inline-start" className="size-3.5" />
                    Forward
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Scanned mail</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe src={previewUrl} title="Scanned mail" className="h-[70vh] w-full rounded-md" />
          )}
        </DialogContent>
      </Dialog>

      <ForwardDialog mail={forwardMail} onClose={() => setForwardMail(null)} />
    </div>
  )
}
