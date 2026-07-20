import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, KeyRound, Plus } from "lucide-react"
import { toast } from "sonner"

import {
  API_SCOPES,
  createPartner,
  createPartnerKey,
  listPartnerCases,
  listPartnerKeys,
  listPartnerWebhooks,
  listPartners,
  revokePartnerKey,
  type Partner,
} from "@/api/partners"
import { useAuthStore, hasRole } from "@/stores/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

function CreatePartnerDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [accent, setAccent] = useState("#14532D")
  const mutation = useMutation({
    mutationFn: () => createPartner({ name, slug, accent_color: accent, rate_limit_per_hour: 1000 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] })
      toast.success("Partner created.")
      onClose()
    },
    onError: () => toast.error("Couldn't create the partner (slug may be taken)."),
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New partner firm</DialogTitle>
          <DialogDescription>Their accent color themes their branded case list.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Input placeholder="Firm name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="slug (e.g. acme-law)"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          />
          <label className="flex items-center gap-2 text-sm">
            Accent color
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
            <span className="text-muted-foreground font-mono text-xs">{accent}</span>
          </label>
          <Button disabled={!name.trim() || !slug.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            Create partner
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function KeyManager({ partnerId }: { partnerId: string }) {
  const queryClient = useQueryClient()
  const { data: keys } = useQuery({
    queryKey: ["partner-keys", partnerId],
    queryFn: () => listPartnerKeys(partnerId),
  })
  const [keyName, setKeyName] = useState("")
  const [scopes, setScopes] = useState<string[]>(["cases:read", "cases:write"])
  const [freshKey, setFreshKey] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () => createPartnerKey(partnerId, keyName, scopes),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["partner-keys", partnerId] })
      setFreshKey(data.plaintext_key)
      setKeyName("")
    },
    onError: () => toast.error("Couldn't create the key."),
  })
  const revokeMutation = useMutation({
    mutationFn: revokePartnerKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-keys", partnerId] })
      toast.success("Key revoked.")
    },
  })

  return (
    <div className="grid gap-3">
      {freshKey && (
        <div className="border-warning/40 bg-warning/5 grid gap-2 rounded-lg border p-3 text-sm">
          <p className="font-medium">Copy this key now — it won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="bg-muted flex-1 truncate rounded px-2 py-1 text-xs">{freshKey}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(freshKey)
                toast.success("Copied.")
              }}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <Input placeholder="Key name (e.g. production)" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {API_SCOPES.map((scope) => (
            <label key={scope} className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={scopes.includes(scope)}
                onChange={(e) =>
                  setScopes((s) => (e.target.checked ? [...s, scope] : s.filter((x) => x !== scope)))
                }
              />
              {scope}
            </label>
          ))}
        </div>
        <Button
          size="sm"
          className="justify-self-start"
          disabled={!keyName.trim() || scopes.length === 0 || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          <KeyRound data-icon="inline-start" className="size-3.5" />
          Generate key
        </Button>
      </div>

      <ul className="grid gap-1.5">
        {(keys ?? []).map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-2 text-sm">
            <span className={cn(!k.is_active && "text-muted-foreground line-through")}>
              <span className="font-mono text-xs">{k.prefix}</span> · {k.name}
              <span className="text-muted-foreground ml-2 text-xs">{k.scopes.join(", ")}</span>
            </span>
            {k.is_active && (
              <Button variant="ghost" size="sm" onClick={() => revokeMutation.mutate(k.id)}>
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function PartnerDetail({ partner }: { partner: Partner }) {
  const { data: webhooks } = useQuery({
    queryKey: ["partner-webhooks", partner.id],
    queryFn: () => listPartnerWebhooks(partner.id),
  })
  const { data: cases } = useQuery({
    queryKey: ["partner-cases", partner.id],
    queryFn: () => listPartnerCases(partner.id),
  })

  return (
    <div className="grid gap-4">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">API keys</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyManager partnerId={partner.id} />
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Webhooks</CardTitle>
          <CardDescription>Partners manage subscriptions through the API; shown here read-only.</CardDescription>
        </CardHeader>
        <CardContent>
          {(webhooks ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">No webhook subscriptions.</p>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {(webhooks ?? []).map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{w.url}</span>
                  <span className="text-muted-foreground text-xs">{w.event_types.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* White-label preview: the partner's accent color scoped via CSS
          variables, so shadcn components re-theme without any style rewrites. */}
      <div
        className="rounded-lg border p-4"
        style={
          {
            "--primary": partner.accent_color,
            "--ring": partner.accent_color,
            borderColor: partner.accent_color,
          } as React.CSSProperties
        }
      >
        <div className="mb-3 flex items-center gap-2">
          {partner.logo_url ? (
            <img src={partner.logo_url} alt={partner.name} className="h-6" />
          ) : (
            <span className="font-semibold" style={{ color: partner.accent_color }}>
              {partner.name}
            </span>
          )}
          <span className="text-muted-foreground text-xs">branded case list preview</span>
        </div>
        {(cases ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">No cases created via this partner yet.</p>
        ) : (
          <ul className="grid gap-1.5">
            {(cases ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span>{c.case_number}</span>
                <span className="text-muted-foreground text-xs capitalize">{c.status}</span>
              </li>
            ))}
          </ul>
        )}
        <Button size="sm" className="mt-3">Sample branded button</Button>
      </div>
    </div>
  )
}

export default function PartnersPage() {
  const user = useAuthStore((s) => s.user)
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: partners, isLoading } = useQuery({ queryKey: ["partners"], queryFn: listPartners })

  if (!hasRole(user?.roles, "admin")) {
    return <p className="text-muted-foreground text-sm">The partner console is available to admins only.</p>
  }

  const selected = (partners ?? []).find((p) => p.id === selectedId) ?? partners?.[0] ?? null

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Partners</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Law & accounting firms reselling LaunchGH through the partner API.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus data-icon="inline-start" className="size-4" />
          New partner
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (partners ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No partners yet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <div className="grid h-fit gap-1">
            {(partners ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm",
                  selected?.id === p.id ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted"
                )}
              >
                <span className="size-3 rounded-full" style={{ background: p.accent_color }} />
                {p.name}
              </button>
            ))}
          </div>
          {selected && <PartnerDetail partner={selected} />}
        </div>
      )}

      {creating && <CreatePartnerDialog onClose={() => setCreating(false)} />}
    </div>
  )
}
