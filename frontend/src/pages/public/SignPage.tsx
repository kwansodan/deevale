import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { getSigningView, submitSignature } from "@/api/signatures"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function SignatureCanvas({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.strokeStyle = "#14532D"
  }, [])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true
    const ctx = canvasRef.current!.getContext("2d")!
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext("2d")!
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    hasInk.current = true
  }
  function end() {
    if (!drawing.current) return
    drawing.current = false
    onChange(hasInk.current ? canvasRef.current!.toDataURL("image/png") : null)
  }
  function clear() {
    const canvas = canvasRef.current!
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height)
    hasInk.current = false
    onChange(null)
  }

  return (
    <div className="grid gap-2">
      <canvas
        ref={canvasRef}
        width={440}
        height={160}
        className="border-border w-full touch-none rounded-md border bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <Button variant="ghost" size="sm" className="justify-self-start" onClick={clear}>
        Clear
      </Button>
    </div>
  )
}

export default function SignPage() {
  const { token } = useParams<{ token: string }>()
  const [drawnData, setDrawnData] = useState<string | null>(null)
  const [typedName, setTypedName] = useState("")
  const [tab, setTab] = useState<"drawn" | "typed">("drawn")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["signing-view", token],
    queryFn: () => getSigningView(token!),
    enabled: !!token,
    retry: false,
  })

  async function handleSubmit() {
    if (!token) return
    const type = tab
    const value = tab === "drawn" ? drawnData : typedName.trim()
    if (!value) {
      toast.error(tab === "drawn" ? "Please draw your signature." : "Please type your name.")
      return
    }
    setSubmitting(true)
    try {
      await submitSignature(token, type, value)
      setDone(true)
      await refetch()
      toast.success("Signed — thank you!")
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't record your signature."
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-background flex min-h-svh items-start justify-center px-4 py-8">
      <div className="w-full max-w-xl">
        <p className="text-primary mb-4 text-center text-lg font-bold">LaunchGH</p>
        {isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : isError || !data ? (
          <Card className="border-border">
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              This signing link is invalid or has expired.
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>{data.title}</CardTitle>
              <CardDescription>Signing as {data.party_name}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div
                className="border-border prose-sm max-h-64 overflow-y-auto rounded-md border p-3 text-sm"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: data.merged_html }}
              />

              {done || data.already_signed ? (
                <div className="text-success flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="size-5" />
                  You've signed this document.
                </div>
              ) : !data.can_sign ? (
                <p className="text-muted-foreground text-sm">
                  {data.status === "sent"
                    ? "An earlier party needs to sign before it's your turn. We'll email you when you're up."
                    : "This document isn't open for signing yet."}
                </p>
              ) : (
                <>
                  <Tabs value={tab} onValueChange={(v) => setTab(v as "drawn" | "typed")}>
                    <TabsList>
                      <TabsTrigger value="drawn">Draw</TabsTrigger>
                      <TabsTrigger value="typed">Type</TabsTrigger>
                    </TabsList>
                    <TabsContent value="drawn" className="pt-3">
                      <SignatureCanvas onChange={setDrawnData} />
                    </TabsContent>
                    <TabsContent value="typed" className="pt-3">
                      <Input
                        placeholder="Type your full name"
                        value={typedName}
                        onChange={(e) => setTypedName(e.target.value)}
                        className="font-[cursive] text-lg"
                      />
                    </TabsContent>
                  </Tabs>
                  <p className="text-muted-foreground text-xs">
                    By signing you agree this is your simple electronic signature, bound to your
                    identity, the current time, and your IP address.
                  </p>
                  <Button disabled={submitting} onClick={handleSubmit}>
                    {submitting ? "Signing…" : "Sign document"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
