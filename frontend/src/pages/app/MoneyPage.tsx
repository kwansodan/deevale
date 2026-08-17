import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { Check, Download, Info, Percent, Plus, Receipt, Trash2 } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
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
  const [applyVat, setApplyVat] = useState(false)
  const [vatRatePercent, setVatRatePercent] = useState("15.0")

  useEffect(() => {
    if (profile) {
      setApplyVat(profile.is_vat_registered ?? false)
      setVatRatePercent(((profile.vat_rate_bps || 1500) / 100).toFixed(1))
    }
  }, [profile])

  const parsedVatRateBps = Math.max(0, Math.round(Number(vatRatePercent || 0) * 100))
  const currency = profile?.default_currency ?? "GHS"
  const subtotal = lines.reduce((sum, l) => sum + Math.round((l.quantity_milli * l.unit_price_minor) / 1000), 0)
  const vat = applyVat ? Math.round((subtotal * parsedVatRateBps) / 10000) : 0

  const mutation = useMutation({
    mutationFn: () =>
      createInvoice(caseId, {
        customer_name: customerName,
        customer_email: customerEmail || undefined,
        currency,
        due_date: dueDate || undefined,
        vat_rate_bps: applyVat ? parsedVatRateBps : 0,
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

          {/* VAT Toggle & Editable Rate for this Invoice */}
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyVat}
                  onChange={(e) => setApplyVat(e.target.checked)}
                  className="size-4 rounded border-input text-primary focus:ring-primary"
                />
                <span className="flex items-center gap-1">
                  <Percent className="size-3.5 text-primary" />
                  Apply VAT to this invoice
                </span>
              </label>

              {applyVat && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">Rate:</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={vatRatePercent}
                      onChange={(e) => setVatRatePercent(e.target.value)}
                      className="h-7 w-16 text-xs text-right px-1.5 py-0.5 bg-background"
                    />
                    <span className="font-semibold">%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-sm space-y-1 pt-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(currency, subtotal)}</span></div>
            {applyVat && (
              <div className="flex justify-between text-primary"><span className="text-muted-foreground">VAT ({Number(vatRatePercent || 0).toFixed(1)}%)</span><span>{formatMoney(currency, vat)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-1.5"><span>Total</span><span>{formatMoney(currency, subtotal + vat)}</span></div>
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
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">VAT</TableHead>
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
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(inv.currency, inv.subtotal_minor)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {inv.vat_minor > 0 ? (
                      <span className="text-primary font-medium">{formatMoney(inv.currency, inv.vat_minor)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatMoney(inv.currency, inv.total_minor)}</TableCell>
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
                                const url = `${window.location.origin}/i/${inv.share_token}`
                                navigator.clipboard.writeText(url)
                                toast.success("Invoice link copied.")
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
  const { data: expenses, isLoading } = useQuery({
    queryKey: ["bk-expenses", caseId],
    queryFn: () => listExpenses(caseId),
  })
  const { data: categories } = useQuery({ queryKey: ["bk-categories"], queryFn: getCategories })
  const { data: profile } = useQuery({ queryKey: ["bk-profile", caseId], queryFn: () => getProfile(caseId) })

  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("other")
  const [expenseDate, setExpenseDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const currency = profile?.default_currency ?? "GHS"

  const createMutation = useMutation({
    mutationFn: () =>
      createExpense(caseId, {
        description,
        category,
        currency,
        amount_minor: Math.round(Number(amount) * 100),
        expense_date: expenseDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bk-expenses", caseId] })
      setDescription("")
      setAmount("")
      toast.success("Expense recorded.")
    },
    onError: () => toast.error("Couldn't save the expense."),
  })

  if (isLoading) return <Skeleton className="h-40 w-full" />

  return (
    <div className="grid gap-4">
      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-base">Record expense</CardTitle></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createMutation.mutate()
            }}
            className="grid gap-3 sm:grid-cols-4"
          >
            <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder={`Amount (${currency})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Select value={category} onValueChange={(val) => val && setCategory(val)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            <Button
              type="submit"
              className="sm:col-span-4 justify-self-start"
              disabled={!description.trim() || Number.isNaN(Number(amount)) || Number(amount) <= 0 || createMutation.isPending}
            >
              <Plus data-icon="inline-start" className="size-4" />
              {createMutation.isPending ? "Recording…" : "Record expense"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {(expenses ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No expenses recorded yet.</p>
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
                  <TableCell>{exp.expense_date}</TableCell>
                  <TableCell className="font-medium">{exp.description}</TableCell>
                  <TableCell className="capitalize">{exp.category.replaceAll("_", " ")}</TableCell>
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
  const [isVatRegistered, setIsVatRegistered] = useState(false)
  const [vatRatePercent, setVatRatePercent] = useState("15.0")
  const [vatNumber, setVatNumber] = useState("")

  useEffect(() => {
    if (profile) {
      setIsVatRegistered(profile.is_vat_registered ?? false)
      setVatRatePercent(((profile.vat_rate_bps || 1500) / 100).toFixed(1))
      setVatNumber(profile.vat_number || "")
    }
  }, [profile])

  const mutation = useMutation({
    mutationFn: (vals: { is_vat_registered?: boolean; vat_rate_bps?: number; vat_number?: string }) => {
      const parsedRate =
        vals.vat_rate_bps !== undefined
          ? vals.vat_rate_bps
          : Math.max(0, Math.round(Number(vatRatePercent || 0) * 100))

      return saveProfile(caseId, {
        display_name: profile?.display_name || "My Business",
        address: profile?.address || null,
        default_currency: profile?.default_currency || "GHS",
        is_vat_registered: vals.is_vat_registered ?? isVatRegistered,
        vat_rate_bps: parsedRate,
        vat_number: vals.vat_number !== undefined ? vals.vat_number : vatNumber,
      })
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["bk-profile", caseId] })
      setIsVatRegistered(saved.is_vat_registered)
      setVatRatePercent(((saved.vat_rate_bps || 1500) / 100).toFixed(1))
      setVatNumber(saved.vat_number || "")
      toast.success("VAT settings saved.")
    },
    onError: () => toast.error("Couldn't save VAT settings."),
  })

  if (!profile) return null

  function handleToggle(checked: boolean) {
    setIsVatRegistered(checked)
    mutation.mutate({ is_vat_registered: checked })
  }

  function handleRatePreset(rate: number) {
    const formatted = rate.toFixed(1)
    setVatRatePercent(formatted)
    mutation.mutate({ vat_rate_bps: Math.round(rate * 100) })
  }

  function handleSaveAll() {
    const rateBps = Math.max(0, Math.round(Number(vatRatePercent || 0) * 100))
    mutation.mutate({
      is_vat_registered: isVatRegistered,
      vat_rate_bps: rateBps,
      vat_number: vatNumber.trim() || undefined,
    })
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="flex items-center gap-2.5 text-sm font-semibold text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={isVatRegistered}
              onChange={(e) => handleToggle(e.target.checked)}
              className="size-4.5 rounded border-input text-primary focus:ring-primary"
            />
            <span>My business is VAT-registered (adds a VAT line to invoices)</span>
          </label>

          <Badge
            variant="secondary"
            className={cn(
              "text-xs px-2.5 py-0.5 w-fit",
              isVatRegistered
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isVatRegistered ? `VAT Active (${Number(vatRatePercent || 0).toFixed(1)}%)` : "VAT Inactive"}
          </Badge>
        </div>

        {isVatRegistered && (
          <div className="space-y-3 pt-2.5 border-t border-border/60 animate-in fade-in slide-in-from-top-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Editable VAT Rate */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1">
                    <Percent className="size-3 text-primary" /> VAT Rate (%)
                  </label>
                  <span className="text-[11px] text-muted-foreground">Type any custom % or click a preset:</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="15.0"
                      value={vatRatePercent}
                      onChange={(e) => setVatRatePercent(e.target.value)}
                      className="h-8.5 text-xs pr-7 bg-background"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      %
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8.5 px-3 text-xs shrink-0"
                    onClick={handleSaveAll}
                    disabled={mutation.isPending}
                  >
                    <Check className="size-3.5 mr-1" /> Save
                  </Button>
                </div>

                {/* Quick Presets for convenience */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleRatePreset(15.0)}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                      Number(vatRatePercent) === 15.0
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    15.0% Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRatePreset(21.9)}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                      Number(vatRatePercent) === 21.9
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    21.9% With Levies
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRatePreset(3.0)}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                      Number(vatRatePercent) === 3.0
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    3.0% Flat Rate
                  </button>
                </div>
              </div>

              {/* GRA VAT / TIN Number */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground flex items-center gap-1">
                  <Receipt className="size-3 text-primary" /> GRA VAT / TIN Registration Number
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. C0012345678"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                    className="h-8.5 text-xs bg-background"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8.5 px-3 text-xs shrink-0"
                    onClick={handleSaveAll}
                    disabled={mutation.isPending}
                  >
                    <Check className="size-3.5 mr-1" /> Save
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Your tax ID is printed directly on your customer invoices and PDF receipts.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
          your taxes - export the CSV for your accountant when you need a proper set of books.
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
