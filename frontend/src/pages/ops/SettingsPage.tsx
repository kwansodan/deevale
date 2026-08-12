import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, RotateCcw } from "lucide-react"

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
              disabled={updateMutation.isPending || !editLabel || Number.isNaN(Number(editAmount))}
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
      const parsed = value.trim() === "" ? null : numericCompany ? Number(value) : value
      return { ...prev, [section]: { ...prev[section], [key]: parsed } }
    })
  }

  function Section({
    title,
    section,
    labels,
  }: {
    title: string
    section: keyof LandingConfig
    labels: Record<string, string>
  }) {
    const group = draft![section] as Record<string, string | number | null>
    return (
      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(labels).map(([key, label]) => (
            <label key={key} className="grid gap-1 text-xs font-medium">
              {label}
              <Input
                value={group[key] == null ? "" : String(group[key])}
                onChange={(e) => setField(section, key, e.target.value)}
                placeholder="Unset (hidden on site)"
              />
            </label>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      <p className="text-muted-foreground text-sm">
        These figures show on the public landing page. Leave a field blank to hide it (the page shows
        "Request a quote" rather than an invented number). Changes apply immediately, no redeploy.
      </p>
      <Section title="Company / trust signals" section="company" labels={COMPANY_LABELS} />
      <Section title="Prices (all-in, government fees included)" section="prices" labels={ENTITY_LABELS} />
      <Section title="Timelines" section="timelines" labels={ENTITY_LABELS} />
      <Section title="GIPC thresholds" section="gipc" labels={GIPC_LABELS} />
      <Section title="Recurring services" section="compliance" labels={COMPLIANCE_LABELS} />
      <Section title="Legal links" section="legal" labels={LEGAL_LABELS} />
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
