import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react"

import { formatGhs } from "@/api/cases"
import {
  getLandingSettings,
  getReferralSettings,
  listFeeSchedule,
  listNotificationTemplates,
  resetNotificationTemplate,
  updateFeeScheduleItem,
  updateLandingSettings,
  updateReferralSettings,
  upsertNotificationTemplate,
  type FeeScheduleItem,
  type LandingConfig,
  type NotificationTemplate,
} from "@/api/ops"
import { useAuthStore, hasRole } from "@/stores/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function FeeScheduleManager() {
  const queryClient = useQueryClient()
  const { data: items, isLoading } = useQuery({ queryKey: ["fee-schedule"], queryFn: listFeeSchedule })
  const [editing, setEditing] = useState<FeeScheduleItem | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editLabel, setEditLabel] = useState("")

  const updateMutation = useMutation({
    mutationFn: () =>
      updateFeeScheduleItem(editing!.id, {
        label: editLabel,
        amount_minor: Math.round(Number(editAmount) * 100),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-schedule"] })
      toast.success("Fee updated.")
      setEditing(null)
    },
    onError: () => toast.error("Couldn't update the fee."),
  })

  if (isLoading) return <Skeleton className="h-40 w-full" />

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items ?? []).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">{item.code}</TableCell>
                <TableCell>{item.label}</TableCell>
                <TableCell className="capitalize">{item.fee_type}</TableCell>
                <TableCell className="text-right tabular-nums">{formatGhs(item.amount_minor)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${item.code}`}
                    onClick={() => {
                      setEditing(item)
                      setEditLabel(item.label)
                      setEditAmount((item.amount_minor / 100).toFixed(2))
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit fee: {editing?.code}</DialogTitle>
            <DialogDescription>
              Changes apply to new quotes only - existing quotes keep their snapshot.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Label
              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Amount (GHS)
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
            </label>
            <Button
              disabled={
                updateMutation.isPending ||
                !editLabel.trim() ||
                // Number("") is 0, not NaN, so an empty field would silently
                // save GHS 0 -- reject empty and negative explicitly.
                editAmount.trim() === "" ||
                !Number.isFinite(Number(editAmount)) ||
                Number(editAmount) < 0
              }
              onClick={() => updateMutation.mutate()}
            >
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TemplateManager() {
  const queryClient = useQueryClient()
  const { data: templates, isLoading } = useQuery({
    queryKey: ["notification-templates"],
    queryFn: listNotificationTemplates,
  })
  const [editing, setEditing] = useState<NotificationTemplate | null>(null)
  const [titleTemplate, setTitleTemplate] = useState("")
  const [bodyTemplate, setBodyTemplate] = useState("")

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertNotificationTemplate({
        category: editing!.category,
        title_template: titleTemplate,
        body_template: bodyTemplate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] })
      toast.success("Template saved.")
      setEditing(null)
    },
    onError: () => toast.error("Couldn't save the template."),
  })

  const resetMutation = useMutation({
    mutationFn: (category: string) => resetNotificationTemplate(category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] })
      toast.success("Reset to default.")
    },
    onError: () => toast.error("Couldn't reset the template."),
  })

  if (isLoading) return <Skeleton className="h-40 w-full" />

  return (
    <>
      <ul className="grid gap-2">
        {(templates ?? []).map((template) => (
          <li key={template.category} className="border-border rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {template.category.replaceAll("_", " ")}
                  {template.is_override && (
                    <span className="bg-accent-100 text-accent-900 ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                      customized
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">{template.title_template}</p>
              </div>
              <div className="flex gap-1.5">
                {template.is_override && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resetMutation.mutate(template.category)}
                    disabled={resetMutation.isPending}
                  >
                    <RotateCcw data-icon="inline-start" className="size-3.5" />
                    Reset
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(template)
                    setTitleTemplate(template.title_template)
                    setBodyTemplate(template.body_template)
                  }}
                >
                  Edit
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit template: {editing?.category.replaceAll("_", " ")}</DialogTitle>
            <DialogDescription>
              Placeholders like {"{business_name}"} and {"{task_name}"} are filled in automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Title
              <Input value={titleTemplate} onChange={(e) => setTitleTemplate(e.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Body
              <Textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} rows={4} />
            </label>
            <Button
              disabled={saveMutation.isPending || !titleTemplate || !bodyTemplate}
              onClick={() => saveMutation.mutate()}
            >
              Save template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ReferralSettingsManager() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ["referral-settings"], queryFn: getReferralSettings })
  const [reward, setReward] = useState("")
  const [welcome, setWelcome] = useState("")
  const [seeded, setSeeded] = useState(false)

  if (data && !seeded) {
    setReward((data.reward_minor / 100).toFixed(2))
    setWelcome((data.welcome_minor / 100).toFixed(2))
    setSeeded(true)
  }

  const mutation = useMutation({
    mutationFn: () =>
      updateReferralSettings({
        reward_minor: Math.round(Number(reward) * 100),
        welcome_minor: Math.round(Number(welcome) * 100),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-settings"] })
      toast.success("Referral rewards updated.")
    },
    onError: () => toast.error("Couldn't update referral rewards."),
  })

  if (isLoading) return <Skeleton className="h-40 w-full" />

  return (
    <div className="grid max-w-md gap-4">
      <p className="text-muted-foreground text-sm">
        Credits applied to Deevale GH invoices. The reward goes to the referrer on the referred
        client's first payment; the welcome credit goes to the new client (and to co-founder invitees).
      </p>
      <label className="grid gap-1.5 text-sm font-medium">
        Referrer reward (GHS)
        <Input type="number" min="0" step="0.01" value={reward} onChange={(e) => setReward(e.target.value)} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        New-client welcome credit (GHS)
        <Input type="number" min="0" step="0.01" value={welcome} onChange={(e) => setWelcome(e.target.value)} />
      </label>
      <Button
        className="justify-self-start"
        disabled={mutation.isPending || Number.isNaN(Number(reward)) || Number.isNaN(Number(welcome))}
        onClick={() => mutation.mutate()}
      >
        Save reward amounts
      </Button>
    </div>
  )
}

// Groups of editable landing figures. `entity`-typed sections key off the same
// entity keys the public site and backend use.
const ENTITY_LABELS: Record<string, string> = {
  ltd_shares: "Company Ltd by Shares",
  sole_proprietorship: "Sole Proprietorship",
  partnership: "Partnership",
  ltd_guarantee: "Company Ltd by Guarantee",
  external_company: "External Company",
  foreign_ltd_shares: "Foreign-Owned + GIPC",
}
const COMPANY_LABELS: Record<string, string> = {
  legalName: "Legal name",
  registrationNumber: "Registration number",
  address: "Address",
  email: "Email",
  phone: "Phone",
  whatsapp: "WhatsApp (digits, intl, no +)",
  yearsOperating: "Years operating (number)",
  casesCompleted: "Registrations completed (number)",
  dataProtectionNumber: "Data Protection reg. number",
}
const GIPC_LABELS: Record<string, string> = {
  jointVenture: "Joint-venture min. capital",
  whollyForeign: "Wholly-foreign min. capital",
  trading: "Trading min. capital",
  registrationFee: "GIPC registration fee",
}
const COMPLIANCE_LABELS: Record<string, string> = {
  monthlyPrice: "Compliance (monthly)",
  annualPrice: "Compliance (annual)",
  registeredAddressPrice: "Registered address",
}
const LEGAL_LABELS: Record<string, string> = {
  termsUrl: "Terms URL",
  privacyUrl: "Privacy URL",
  refundUrl: "Refund URL",
}
const RATING_LABELS: Record<string, string> = {
  score: "Score (e.g. 4.9)",
  count: "Number of reviews (e.g. 120)",
  source: "Source (e.g. Google)",
}

// Field definitions for the repeatable-list sections (real social proof).
type ListField = { key: string; label: string; type?: "text" | "textarea" }
const TESTIMONIAL_FIELDS: ListField[] = [
  { key: "quote", label: "Quote", type: "textarea" },
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "company", label: "Company" },
  { key: "avatarUrl", label: "Avatar image URL (optional)" },
  { key: "rating", label: "Stars 1-5 (optional)" },
]
const LOGO_FIELDS: ListField[] = [
  { key: "name", label: "Client / partner name" },
  { key: "imageUrl", label: "Logo image URL (optional)" },
  { key: "url", label: "Link URL (optional)" },
]

/**
 * Repeatable-row editor for the list sections (testimonials, logos). Module
 * scope on purpose -- defined inside the manager it would be a new component
 * type each render and every input would lose focus after one keystroke (the
 * bug fixed for the flat landing fields in commit 3d2a94a).
 */
function LandingListEditor({
  title,
  description,
  addLabel,
  items,
  fields,
  emptyItem,
  onChange,
}: {
  title: string
  description: string
  addLabel: string
  items: Array<Record<string, string>>
  fields: ListField[]
  emptyItem: Record<string, string>
  onChange: (items: Array<Record<string, string>>) => void
}) {
  const update = (i: number, key: string, value: string) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)))
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const add = () => onChange([...items, { ...emptyItem }])

  return (
    <div className="grid gap-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      {items.length === 0 && (
        <p className="text-muted-foreground text-xs italic">
          None yet — this section stays hidden on the site until you add one.
        </p>
      )}
      {items.map((item, i) => (
        <div key={i} className="border-border grid gap-2 rounded-md border p-3 sm:grid-cols-2">
          {fields.map((f) => (
            <label
              key={f.key}
              className={cn("grid gap-1 text-xs font-medium", f.type === "textarea" && "sm:col-span-2")}
            >
              {f.label}
              {f.type === "textarea" ? (
                <Textarea rows={2} value={item[f.key] ?? ""} onChange={(e) => update(i, f.key, e.target.value)} />
              ) : (
                <Input value={item[f.key] ?? ""} onChange={(e) => update(i, f.key, e.target.value)} />
              )}
            </label>
          ))}
          <div className="sm:col-span-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
              <Trash2 /> Remove
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={add}>
        <Plus /> {addLabel}
      </Button>
    </div>
  )
}

/**
 * Hoisted to module scope on purpose: defined inside LandingSettingsManager it
 * was a fresh component type every render, so React remounted every field on
 * each keystroke and the input lost focus after one character.
 */
function LandingSection({
  title,
  labels,
  group,
  onChange,
}: {
  title: string
  labels: Record<string, string>
  group: Record<string, string | number | null>
  onChange: (key: string, value: string) => void
}) {
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(labels).map(([key, label]) => (
          <label key={key} className="grid gap-1 text-xs font-medium">
            {label}
            <Input
              value={group[key] == null ? "" : String(group[key])}
              onChange={(e) => onChange(key, e.target.value)}
              placeholder="Unset (hidden on site)"
            />
          </label>
        ))}
      </div>
    </div>
  )
}

function LandingSettingsManager() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ["landing-settings"], queryFn: getLandingSettings })
  const [draft, setDraft] = useState<LandingConfig | null>(null)

  if (data && draft === null) setDraft(structuredClone(data))

  const mutation = useMutation({
    mutationFn: () => updateLandingSettings(draft as LandingConfig),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-settings"] })
      queryClient.invalidateQueries({ queryKey: ["landing-config"] })
      toast.success("Landing page updated.")
    },
    onError: () => toast.error("Couldn't update the landing page."),
  })

  if (isLoading || !draft) return <Skeleton className="h-64 w-full" />

  function setField(section: keyof LandingConfig, key: string, value: string) {
    setDraft((prev) => {
      if (!prev) return prev
      const numericCompany = section === "company" && (key === "yearsOperating" || key === "casesCompleted")
      // Prices/compliance are numeric amounts (converted for display); everything
      // else stays a string.
      const numericField = numericCompany || section === "prices" || section === "compliance"
      let parsed: string | number | null
      if (value.trim() === "") {
        parsed = null
      } else if (numericField) {
        const n = Number(value)
        parsed = Number.isFinite(n) ? n : null // never store NaN
      } else {
        parsed = value
      }
      return { ...prev, [section]: { ...prev[section], [key]: parsed } }
    })
  }

  const groupOf = (section: keyof LandingConfig) =>
    draft![section] as Record<string, string | number | null>

  const setList = (section: "testimonials" | "logos", items: Array<Record<string, string>>) =>
    setDraft((prev) => (prev ? ({ ...prev, [section]: items } as LandingConfig) : prev))

  return (
    <div className="grid gap-5">
      <p className="text-muted-foreground text-sm">
        These figures show on the public landing page. Leave a field blank to hide it (the page shows
        "Request a quote" rather than an invented number). Changes apply immediately, no redeploy.
      </p>
      <LandingSection title="Company / trust signals" labels={COMPANY_LABELS} group={groupOf("company")} onChange={(k, v) => setField("company", k, v)} />

      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">Pricing currency</h3>
        <label className="grid max-w-xs gap-1 text-xs font-medium">
          Currency you enter prices in
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={(groupOf("pricing").base_currency as string) ?? "GHS"}
            onChange={(e) => setField("pricing", "base_currency", e.target.value)}
          >
            {["GHS", "USD", "EUR", "GBP", "NGN", "ZAR", "CAD", "AUD"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <p className="text-muted-foreground text-xs">
          Enter prices below as plain numbers in this currency (e.g. 2000). Visitors see them in GHS
          (in Ghana) or USD (elsewhere), converted at live rates. Billing is always in GHS.
        </p>
      </div>

      <LandingSection title="Prices (amount only, no symbol)" labels={ENTITY_LABELS} group={groupOf("prices")} onChange={(k, v) => setField("prices", k, v)} />
      <LandingSection title="Timelines" labels={ENTITY_LABELS} group={groupOf("timelines")} onChange={(k, v) => setField("timelines", k, v)} />
      <LandingSection title="GIPC thresholds" labels={GIPC_LABELS} group={groupOf("gipc")} onChange={(k, v) => setField("gipc", k, v)} />
      <LandingSection title="Recurring services" labels={COMPLIANCE_LABELS} group={groupOf("compliance")} onChange={(k, v) => setField("compliance", k, v)} />
      <LandingSection title="Legal links" labels={LEGAL_LABELS} group={groupOf("legal")} onChange={(k, v) => setField("legal", k, v)} />

      <div className="border-border border-t pt-5">
        <p className="text-muted-foreground mb-4 text-sm">
          Social proof — shown only when real. Every item below is optional and each section stays
          hidden on the site until you add content. Never enter anything you can&apos;t stand behind.
        </p>
        <div className="grid gap-6">
          <LandingSection title="Overall rating" labels={RATING_LABELS} group={groupOf("rating")} onChange={(k, v) => setField("rating", k, v)} />
          <LandingListEditor
            title="Testimonials"
            description="Real client or officer quotes. Quote and name are required; the rest are optional."
            addLabel="Add testimonial"
            items={(draft.testimonials ?? []) as unknown as Array<Record<string, string>>}
            fields={TESTIMONIAL_FIELDS}
            emptyItem={{ quote: "", name: "", role: "", company: "", avatarUrl: "", rating: "" }}
            onChange={(items) => setList("testimonials", items)}
          />
          <LandingListEditor
            title="Client / partner logos"
            description="Real clients or partners. Enter a name (shown as text) and optionally a logo image URL."
            addLabel="Add logo"
            items={(draft.logos ?? []) as unknown as Array<Record<string, string>>}
            fields={LOGO_FIELDS}
            emptyItem={{ name: "", imageUrl: "", url: "" }}
            onChange={(items) => setList("logos", items)}
          />
        </div>
      </div>

      <Button className="justify-self-start" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        Save landing page
      </Button>
    </div>
  )
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = hasRole(user?.roles, "admin")
  const isFinance = hasRole(user?.roles, "finance")

  if (!isAdmin && !isFinance) {
    return (
      <p className="text-muted-foreground text-sm">
        Settings are available to admin and finance roles only.
      </p>
    )
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Fee schedule, notification templates, referral rewards and public landing-page figures.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="fees">
            <TabsList>
              <TabsTrigger value="fees">Fee schedule</TabsTrigger>
              {isAdmin && <TabsTrigger value="templates">Notification templates</TabsTrigger>}
              {isAdmin && <TabsTrigger value="referral">Referral rewards</TabsTrigger>}
              {isAdmin && <TabsTrigger value="landing">Landing page</TabsTrigger>}
            </TabsList>
            <TabsContent value="fees" className="pt-4">
              <FeeScheduleManager />
            </TabsContent>
            {isAdmin && (
              <TabsContent value="templates" className="pt-4">
                <TemplateManager />
              </TabsContent>
            )}
            {isAdmin && (
              <TabsContent value="referral" className="pt-4">
                <ReferralSettingsManager />
              </TabsContent>
            )}
            {isAdmin && (
              <TabsContent value="landing" className="pt-4">
                <LandingSettingsManager />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
