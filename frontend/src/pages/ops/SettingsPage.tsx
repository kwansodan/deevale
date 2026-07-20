import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, RotateCcw } from "lucide-react"

import { formatGhs } from "@/api/cases"
import {
  listFeeSchedule,
  listNotificationTemplates,
  resetNotificationTemplate,
  updateFeeScheduleItem,
  upsertNotificationTemplate,
  type FeeScheduleItem,
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
              Changes apply to new quotes only — existing quotes keep their snapshot.
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
          <CardDescription>Fee schedule and client-facing notification templates.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="fees">
            <TabsList>
              <TabsTrigger value="fees">Fee schedule</TabsTrigger>
              {isAdmin && <TabsTrigger value="templates">Notification templates</TabsTrigger>}
            </TabsList>
            <TabsContent value="fees" className="pt-4">
              <FeeScheduleManager />
            </TabsContent>
            {isAdmin && (
              <TabsContent value="templates" className="pt-4">
                <TemplateManager />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
