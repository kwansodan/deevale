import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate, useParams } from "react-router-dom"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { acceptCoFounderInvite, getPublicInvite } from "@/api/referrals"
import { useAuthStore } from "@/stores/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function CoFounderAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-invite", token],
    queryFn: () => getPublicInvite(token!),
    enabled: !!token,
    retry: false,
  })

  async function handleAccept() {
    if (!token) return
    setAccepting(true)
    try {
      await acceptCoFounderInvite(token)
      setAccepted(true)
      toast.success("You've joined — next, verify your ID from your dashboard.")
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't accept the invite."
      toast.error(message)
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="bg-background flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-md">
        <p className="text-primary mb-4 text-center text-lg font-bold">LaunchGH</p>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : isError || !data ? (
          <Card className="border-border">
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              This invitation is invalid or has expired.
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Join {data.business_name}</CardTitle>
              <CardDescription>
                {data.inviter_name} invited you to join as {data.role}.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {accepted || data.status === "accepted" ? (
                <div className="grid gap-3">
                  <div className="text-success flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="size-5" />
                    You've joined {data.business_name}.
                  </div>
                  <Button render={<Link to="/app">Go to your dashboard to verify your ID</Link>} />
                </div>
              ) : !user ? (
                <div className="grid gap-3 text-sm">
                  <p className="text-muted-foreground">
                    First, create your own LaunchGH account (or log in) — your ID verification stays
                    private to you.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => navigate(`/signup?invite=${token}`)}
                    >
                      Create account
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/login")}>
                      Log in
                    </Button>
                  </div>
                </div>
              ) : (
                <Button disabled={accepting} onClick={handleAccept}>
                  {accepting ? "Joining…" : `Accept & join as ${data.role}`}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
