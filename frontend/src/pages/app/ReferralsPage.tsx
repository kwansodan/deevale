import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { format } from "date-fns"
import { Copy, Gift, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { listCases } from "@/api/cases"
import { formatMoney } from "@/api/bookkeeping"
import {
  getReferralMe,
  inviteCoFounder,
  listCoFounderInvites,
} from "@/api/referrals"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

function CoFounderInvites({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient()
  const { data: invites } = useQuery({
    queryKey: ["cofounder-invites", caseId],
    queryFn: () => listCoFounderInvites(caseId),
  })
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")

  const mutation = useMutation({
    mutationFn: () => inviteCoFounder(caseId, { invitee_name: name, invitee_email: email, role: "director" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cofounder-invites", caseId] })
      toast.success("Invite sent.")
      setName("")
      setEmail("")
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't send the invite."
      toast.error(message)
    },
  })

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="text-primary size-4" />
          Invite a co-founder or director
        </CardTitle>
        <CardDescription>
          They'll create their own account and complete their own ID verification — no need to share
          documents with you.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Their name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Their email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button
          className="justify-self-start"
          disabled={!name.trim() || !email.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Send invite
        </Button>

        {(invites ?? []).length > 0 && (
          <ul className="mt-2 grid gap-1.5 text-sm">
            {(invites ?? []).map((inv) => (
              <li key={inv.id} className="flex items-center justify-between">
                <span>{inv.invitee_name} <span className="text-muted-foreground text-xs">({inv.invitee_email})</span></span>
                <span className={cn("text-xs font-medium capitalize", inv.status === "accepted" ? "text-success" : "text-muted-foreground")}>
                  {inv.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export default function ReferralsPage() {
  const { t } = useTranslation()
  const { data: me, isLoading } = useQuery({ queryKey: ["referral-me"], queryFn: getReferralMe })
  const { data: cases } = useQuery({ queryKey: ["cases"], queryFn: listCases })
  const caseId = cases?.[0]?.id ?? null

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-semibold">{t("referrals.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("referrals.subtitle")}</p>
      </div>

      {isLoading || !me ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <Card className="border-accent/40 bg-accent-50 dark:bg-accent/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="text-accent-600 size-4" />
                {t("referrals.yourCode")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-center gap-2">
                <code className="bg-card flex-1 rounded px-3 py-2 text-lg font-bold tracking-widest">{me.code}</code>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(me.share_url)
                    toast.success("Invite link copied.")
                  }}
                >
                  <Copy data-icon="inline-start" className="size-4" />
                  {t("referrals.copyLink")}
                </Button>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t("referrals.balance")}</p>
                <p className="text-2xl font-semibold">{formatMoney(me.currency, me.available_balance_minor)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">{t("referrals.ledger")}</CardTitle>
            </CardHeader>
            <CardContent>
              {me.credits.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("referrals.empty")}</p>
              ) : (
                <ul className="grid gap-1.5 text-sm">
                  {me.credits.map((credit) => (
                    <li key={credit.id} className="flex items-center justify-between">
                      <span className="capitalize">
                        {credit.source} <span className="text-muted-foreground text-xs">· {format(new Date(credit.created_at), "d MMM yyyy")}</span>
                      </span>
                      <span className={cn("tabular-nums", credit.status === "applied" ? "text-muted-foreground line-through" : "text-success")}>
                        +{formatMoney(credit.currency, credit.amount_minor)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {caseId && <CoFounderInvites caseId={caseId} />}
        </>
      )}
    </div>
  )
}
