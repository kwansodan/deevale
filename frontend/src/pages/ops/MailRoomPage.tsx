import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { toast } from "sonner"

import { fetchCaseQueue } from "@/api/ops"
import {
  listForwardRequests,
  listMail,
  logMail,
  transitionForwardRequest,
  uploadMailScan,
  type MailItem,
} from "@/api/mailroom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { FileDropzone } from "@/components/case/FileDropzone"
import { cn } from "@/lib/utils"

function LogMailForm() {
  const queryClient = useQueryClient()
  const [caseId, setCaseId] = useState<string | null>(null)
  const [sender, setSender] = useState("")
  const [subject, setSubject] = useState("")
  const [receivedDate, setReceivedDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [urgency, setUrgency] = useState<"normal" | "urgent">("normal")

  const { data: queue } = useQuery({
    queryKey: ["case-queue-mail"],
    queryFn: () => fetchCaseQueue({ page: 1, page_size: 100 }),
  })

  const mutation = useMutation({
    mutationFn: () =>
      logMail({
        business_case_id: caseId!,
        sender,
        subject: subject || undefined,
        received_date: receivedDate,
        urgency,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mailroom-items"] })
      toast.success("Mail logged — upload the scan below.")
      setSender("")
      setSubject("")
    },
    onError: () => toast.error("Couldn't log the mail."),
  })

  const caseItems = (queue?.items ?? []).map((c) => ({
    value: c.id,
    label: `${c.case_number} · ${c.business_name}`,
  }))

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base">Log incoming mail</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Select items={caseItems} value={caseId} onValueChange={(v) => setCaseId(v as string)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Which client / case?" />
          </SelectTrigger>
          <SelectContent>
            {caseItems.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Sender (e.g. GRA)" value={sender} onChange={(e) => setSender(e.target.value)} />
          <Input placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
          <Select items={[]} value={urgency} onValueChange={(v) => setUrgency(v as "normal" | "urgent")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          className="justify-self-start"
          disabled={!caseId || !sender.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Log mail
        </Button>
      </CardContent>
    </Card>
  )
}

function MailList() {
  const queryClient = useQueryClient()
  const { data: items, isLoading } = useQuery({
    queryKey: ["mailroom-items"],
    queryFn: () => listMail(),
  })

  const scanMutation = useMutation({
    mutationFn: ({ mailId, file }: { mailId: string; file: File }) => uploadMailScan(mailId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mailroom-items"] })
      toast.success("Scan uploaded — client notified.")
    },
    onError: () => toast.error("Scan upload failed."),
  })

  const [scanTarget, setScanTarget] = useState<MailItem | null>(null)

  if (isLoading) return <Skeleton className="h-40 w-full" />

  const awaitingScan = (items ?? []).filter((i) => i.status === "logged")
  const scanned = (items ?? []).filter((i) => i.status === "scanned")

  return (
    <div className="grid gap-5">
      <section>
        <h3 className="text-sm font-semibold">Awaiting scan ({awaitingScan.length})</h3>
        {awaitingScan.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">Nothing waiting to be scanned.</p>
        ) : (
          <div className="mt-2 grid gap-2">
            {awaitingScan.map((item) => (
              <Card key={item.id} className="border-warning/40 bg-warning/5">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{item.sender}</p>
                    <p className="text-muted-foreground text-xs">
                      {item.subject ?? "No subject"} · received{" "}
                      {format(new Date(item.received_date), "d MMM yyyy")}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setScanTarget(item)}>
                    Upload scan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {scanned.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">Scanned & delivered</h3>
          <ul className="mt-2 grid gap-1.5">
            {scanned.map((item) => (
              <li key={item.id} className="text-muted-foreground flex items-center justify-between text-sm">
                <span>
                  {item.sender} — {item.subject ?? "No subject"}
                </span>
                <span className="text-xs">{item.read_at ? "read" : "delivered"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {scanTarget && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Upload scan for {scanTarget.sender}</CardTitle>
          </CardHeader>
          <CardContent>
            <FileDropzone
              onFile={(file) => {
                scanMutation.mutate({ mailId: scanTarget.id, file })
                setScanTarget(null)
              }}
              disabled={scanMutation.isPending}
              label="Drop the multi-page PDF scan here, or tap to browse"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ForwardQueue() {
  const queryClient = useQueryClient()
  const { data: requests, isLoading } = useQuery({
    queryKey: ["mail-forward-requests"],
    queryFn: listForwardRequests,
  })
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "in_progress" | "done" }) =>
      transitionForwardRequest(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mail-forward-requests"] })
      toast.success("Updated.")
    },
  })

  if (isLoading) return <Skeleton className="h-32 w-full" />

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Forward to</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(requests ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                No open forwarding requests.
              </TableCell>
            </TableRow>
          )}
          {(requests ?? []).map((r) => (
            <TableRow key={r.id}>
              <TableCell className="max-w-xs truncate">{r.forwarding_address}</TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(r.created_at), "d MMM yyyy")}
              </TableCell>
              <TableCell>
                <span className={cn("text-xs font-medium capitalize", r.status === "new" ? "text-warning" : "text-info")}>
                  {r.status.replaceAll("_", " ")}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {r.status === "new" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ id: r.id, status: "in_progress" })}
                    >
                      Start
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ id: r.id, status: "done" })}
                  >
                    Mark forwarded
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default function MailRoomPage() {
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Mail Room</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Log, scan, and forward physical mail for registered-address clients.
        </p>
      </div>
      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">Log & scan</TabsTrigger>
          <TabsTrigger value="forwarding">Forwarding</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" className="grid gap-4 pt-4">
          <LogMailForm />
          <MailList />
        </TabsContent>
        <TabsContent value="forwarding" className="pt-4">
          <ForwardQueue />
        </TabsContent>
      </Tabs>
    </div>
  )
}
