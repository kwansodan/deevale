import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { Download, Info, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { listCases } from "@/api/cases"
import {
  createExpense,
  createInvoice,
  downloadBookkeepingCsv,
  getCategories,
  getProfile,
  getReport,
  listExpenses,
  listInvoices,
  markInvoicePaid,
  saveProfile,
  sendInvoice,
  formatMoney,
  type LineItem,
} from "@/api/bookkeeping"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/10 text-info",
  paid: "bg-success/10 text-success",
  overdue: "bg-error/10 text-error",
}

function InvoiceBuilder({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: profile } = useQuery({ queryKey: ["bk-profile", caseId], queryFn: () => getProfile(caseId) })
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [lines, setLines] = useState<LineItem[]>([
    { description: "", quantity_milli: 1000, unit_price_minor: 0 },
  ])
  const applyVat = profile?.is_vat_registered ?? false
  const currency = profile?.default_currency ?? "GHS"

  const subtotal = lines.reduce((sum, l) => sum + Math.round((l.quantity_milli * l.unit_price_minor) / 1000), 0)
  const vat = applyVat ? Math.round((subtotal * (profile?.vat_rate_bps ?? 0)) / 10000) : 0

  const mutation = useMutation({
    mutationFn: () =>
      createInvoice(caseId, {
        customer_name: customerName,
        customer_email: customerEmail || undefined,
        currency,
        due_date: dueDate || undefined,
        vat_rate_bps: applyVat ? profile?.vat_rate_bps : 0,
        line_items: lines.filter((l) => l.description.trim()),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bk-invoices", caseId] })
      toast.success("Invoice created as a draft.")
      onClose()
    },
    onError: () => toast.error("Couldn't create the invoice."),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New invoice</DialogTitle>
          <DialogDescription>Billed as {profile?.display_name ?? "your business"}.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <Input placeholder="Customer email (optional)" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="grid gap-2">
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[1fr_4rem_6rem_auto] items-center gap-2">
                <Input
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) =>
                    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, description: e.target.value } : l)))
                  }
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.quantity_milli / 1000}
                  aria-label="Quantity"
                  onChange={(e) =>
                    setLines((ls) =>
                      ls.map((l, j) => (j === i ? { ...l, quantity_milli: Math.round(Number(e.target.value) * 1000) } : l))
                    )
                  }
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Unit"
                  value={line.unit_price_minor / 100}
                  aria-label="Unit price"
                  onChange={(e) =>
                    setLines((ls) =>
                      ls.map((l, j) => (j === i ? { ...l, unit_price_minor: Math.round(Number(e.target.value) * 100) } : l))
                    )
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove line"
                  disabled={lines.length === 1}
                  onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                >
                  <Trash2 className="text-muted-foreground size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => setLines((ls) => [...ls, { description: "", quantity_milli: 1000, unit_price_minor: 0 }])}
            >
              <Plus data-icon="inline-start" className="size-3.5" />
              Add line
            </Button>
          </div>

          <div className="text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(currency, subtotal)}</span></div>
            {applyVat && (
              <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>{formatMoney(currency, vat)}</span></div>
            )}
            <div className="flex justify-between font-semibold"><span>Total</span><span>{formatMoney(currency, subtotal + vat)}</span></div>
          </div>

          <Button
            disabled={!customerName.trim() || subtotal === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Creating…" : "Create draft"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InvoicesTab({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient()
  const [building, setBuilding] = useState(false)
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["bk-invoices", caseId],
    queryFn: () => listInvoices(caseId),
  })

  const sendMutation = useMutation({
    mutationFn: sendInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bk-invoices", caseId] })
      toast.success("Invoice sent.")
    },
    onError: () => toast.error("Couldn't send the invoice."),
  })
  const paidMutation = useMutation({
    mutationFn: markInvoicePaid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bk-invoices", caseId] })
      toast.success("Marked as paid.")
    },
  })

  if (isLoading) return <Skeleton className="h-40 w-full" />

  return (
    <div className="grid gap-3">
      <Button className="justify-self-start" onClick={() => setBuilding(true)}>
        <Plus data-icon="inline-start" className="size-4" />
        New invoice
      </Button>
      {(invoices ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No invoices yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoices ?? []).map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.customer_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(inv.currency, inv.total_minor)}</TableCell>
                  <TableCell>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[inv.status])}>
                      {inv.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {inv.status === "draft" && (
                        <Button size="sm" disabled={sendMutation.isPending} onClick={() => sendMutation.mutate(inv.id)}>
                          Send
                        </Button>
                      )}
                      {(inv.status === "sent" || inv.status === "overdue") && (
                        <>
                          {inv.share_token && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/pay/${inv.share_token}`)
                                toast.success("Share link copied.")
                              }}
                            >
                              Copy link
                            </Button>
                          )}
                          <Button size="sm" disabled={paidMutation.isPending} onClick={() => paidMutation.mutate(inv.id)}>
                            Mark paid
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {building && <InvoiceBuilder caseId={caseId} onClose={() => setBuilding(false)} />}
    </div>
  )
}

function ExpensesTab({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient()
  const { data: categories } = useQuery({ queryKey: ["bk-categories"], queryFn: getCategories })
  const { data: expenses, isLoading } = useQuery({
    queryKey: ["bk-expenses", caseId],
    queryFn: () => listExpenses(caseId),
  })
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [expenseDate, setExpenseDate] = useState(format(new Date(), "yyyy-MM-dd"))

  const mutation = useMutation({
    mutationFn: () =>
      createExpense(caseId, {
        description,
        category: category!,
        amount_minor: Math.round(Number(amount) * 100),
        expense_date: expenseDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bk-expenses", caseId] })
      toast.success("Expense saved.")
      setDescription("")
      setAmount("")
    },
    onError: () => toast.error("Couldn't save the expense."),
  })

  const catLabel = (code: string) => categories?.find((c) => c.code === code)?.label ?? code

  return (
    <div className="grid gap-4">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Log an expense</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="What was it for?" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Select
            items={(categories ?? []).map((c) => ({ value: c.code, label: c.label }))}
            value={category}
            onValueChange={(v) => setCategory(v as string)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {(categories ?? []).map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="number" min={0} step="0.01" placeholder="Amount (GHS)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          <Button
            className="justify-self-start"
            disabled={!description.trim() || !category || !amount || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Save expense
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (expenses ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No expenses logged yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(expenses ?? []).map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell>{format(new Date(exp.expense_date), "d MMM yyyy")}</TableCell>
                  <TableCell>{exp.description}</TableCell>
                  <TableCell>{catLabel(exp.category)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(exp.currency, exp.amount_minor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function ReportsTab({ caseId }: { caseId: string }) {
  const year = new Date().getFullYear()
  const { data: report, isLoading } = useQuery({
    queryKey: ["bk-report", caseId, year],
    queryFn: () => getReport(caseId, year),
  })

  if (isLoading || !report) return <Skeleton className="h-48 w-full" />

  const currency = report.currencies[0]
  const monthName = (m: number) => format(new Date(2000, m - 1, 1), "MMM")

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="border-border"><CardContent className="px-4 py-3"><p className="text-muted-foreground text-xs">Income ({year})</p><p className="text-success mt-0.5 text-xl font-semibold">{formatMoney(currency, report.total_income_minor)}</p></CardContent></Card>
        <Card className="border-border"><CardContent className="px-4 py-3"><p className="text-muted-foreground text-xs">Expenses ({year})</p><p className="text-error mt-0.5 text-xl font-semibold">{formatMoney(currency, report.total_expense_minor)}</p></CardContent></Card>
        <Card className="border-border"><CardContent className="px-4 py-3"><p className="text-muted-foreground text-xs">VAT collected</p><p className="mt-0.5 text-xl font-semibold">{formatMoney(currency, report.total_vat_collected_minor)}</p></CardContent></Card>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">VAT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.months
              .filter((m) => m.income_minor || m.expense_minor)
              .map((m) => (
                <TableRow key={m.month}>
                  <TableCell>{monthName(m.month)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(currency, m.income_minor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(currency, m.expense_minor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(currency, m.vat_collected_minor)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Button variant="outline" className="justify-self-start" onClick={() => downloadBookkeepingCsv(caseId)}>
        <Download data-icon="inline-start" className="size-3.5" />
        Export CSV for your accountant
      </Button>
    </div>
  )
}

function VatSettings({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient()
  const { data: profile } = useQuery({ queryKey: ["bk-profile", caseId], queryFn: () => getProfile(caseId) })
  const mutation = useMutation({
    mutationFn: (vals: { is_vat_registered: boolean }) => saveProfile(caseId, { ...profile, ...vals }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bk-profile", caseId] })
      toast.success("Saved.")
    },
  })
  if (!profile) return null
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={profile.is_vat_registered}
        onChange={(e) => mutation.mutate({ is_vat_registered: e.target.checked })}
      />
      My business is VAT-registered (adds a VAT line to invoices)
    </label>
  )
}

export default function MoneyPage() {
  const { data: cases } = useQuery({ queryKey: ["cases"], queryFn: listCases })
  const caseId = cases?.[0]?.id ?? null

  if (!caseId) {
    return <p className="text-muted-foreground text-sm">Complete a registration to start invoicing.</p>
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-semibold">Money</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Invoice your customers and track expenses.
        </p>
      </div>

      <div className="border-info/30 bg-info/5 flex gap-2 rounded-lg border p-3 text-sm">
        <Info className="text-info mt-0.5 size-4 shrink-0" />
        <p className="text-foreground/80">
          This is a lightweight record-keeping tool, not full accounting software. It won't file
          your taxes — export the CSV for your accountant when you need a proper set of books.
        </p>
      </div>

      <VatSettings caseId={caseId} />

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices" className="pt-4"><InvoicesTab caseId={caseId} /></TabsContent>
        <TabsContent value="expenses" className="pt-4"><ExpensesTab caseId={caseId} /></TabsContent>
        <TabsContent value="reports" className="pt-4"><ReportsTab caseId={caseId} /></TabsContent>
      </Tabs>
    </div>
  )
}
