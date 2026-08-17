import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Check,
  CheckCheck,
  Globe,
  Laptop,
  MessageCircle,
  MessageSquarePlus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  Sparkles,
  User,
  Volume2,
  VolumeX,
} from "lucide-react"
import { io, type Socket } from "socket.io-client"

import {
  closeOpsSession,
  getOpsSession,
  listOpsSessions,
  listOpsVisitors,
  sendStaffMessage,
  type LiveChatMessage,
  type LiveChatSession,
} from "@/api/liveChat"
import { SOCKET_URL } from "@/config/env"
import { useAuthStore } from "@/stores/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const CANNED_RESPONSES = [
  "Hello! Welcome to Deevale GH. How can I help you with your business registration today?",
  "Hi there! Are you looking to register a Limited Liability Company, Partnership, or NGO in Ghana?",
  "Our team handles the entire process at ORC, GRA (TIN), and SSNIT. Would you like a fee quote?",
  "Yes, foreign shareholders and directors are fully supported through our GIPC track. Let me know if you'd like details!",
]

export default function LiveChatPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)

  const [visitors, setVisitors] = useState<LiveChatSession[]>([])
  const [sessions, setSessions] = useState<LiveChatSession[]>([])
  const [selectedSession, setSelectedSession] = useState<LiveChatSession | null>(null)
  const [messages, setMessages] = useState<LiveChatMessage[]>([])
  const [input, setInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isVisitorTyping, setIsVisitorTyping] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  function playChime() {
    if (!soundEnabled) return
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === "suspended") ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15) // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } catch {
      // Audio not permitted yet
    }
  }

  // Load initial data
  async function refreshData() {
    try {
      const [vList, sList] = await Promise.all([listOpsVisitors(), listOpsSessions()])
      setVisitors(vList)
      setSessions(sList)
    } catch (e) {
      console.error("Error fetching live chat data:", e)
    }
  }

  useEffect(() => {
    refreshData()
  }, [])

  // Deep-link to session if in URL params
  useEffect(() => {
    const sessionParam = searchParams.get("session")
    if (sessionParam && (!selectedSession || selectedSession.id !== sessionParam)) {
      getOpsSession(sessionParam)
        .then((s) => {
          setSelectedSession(s)
          setMessages(s.messages || [])
        })
        .catch(() => {})
    }
  }, [searchParams])

  // Setup staff Socket.IO connection
  useEffect(() => {
    if (!accessToken) return

    const s = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
    })
    socketRef.current = s

    // Visitor joined or updated presence
    s.on("visitor:presence", (data: LiveChatSession) => {
      setVisitors((prev) => {
        const exists = prev.some((v) => v.id === data.id)
        if (exists) {
          return prev.map((v) => (v.id === data.id ? { ...v, ...data } : v))
        }
        playChime()
        return [data, ...prev]
      })

      setSessions((prev) => {
        const exists = prev.some((sess) => sess.id === data.id)
        if (exists) {
          return prev.map((sess) => (sess.id === data.id ? { ...sess, ...data } : sess))
        }
        return [data, ...prev]
      })

      if (selectedSession && selectedSession.id === data.id) {
        setSelectedSession((curr) => (curr ? { ...curr, ...data } : null))
      }
    })

    // Incoming chat message
    s.on("chat:incoming_message", (msg: LiveChatMessage) => {
      if (msg.sender_type === "visitor") {
        playChime()
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })

      // Update session last_message and unread_count
      setSessions((prev) =>
        prev.map((sess) => {
          if (sess.id === msg.session_id) {
            return {
              ...sess,
              last_message: msg,
              unread_count:
                msg.sender_type === "visitor" && selectedSession?.id !== msg.session_id
                  ? (sess.unread_count || 0) + 1
                  : sess.unread_count,
            }
          }
          return sess
        })
      )
    })

    // Typing indicator
    s.on("chat:typing", (data: { session_id: string; is_typing: boolean; sender_type: string }) => {
      if (data.sender_type === "visitor" && selectedSession?.id === data.session_id) {
        setIsVisitorTyping(data.is_typing)
      }
    })

    return () => {
      s.disconnect()
      socketRef.current = null
    }
  }, [accessToken, selectedSession, soundEnabled])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isVisitorTyping])

  async function handleSelectSession(session: LiveChatSession) {
    setSelectedSession(session)
    setSearchParams({ session: session.id })
    try {
      const full = await getOpsSession(session.id)
      setMessages(full.messages || [])
      // Reset unread count locally
      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, unread_count: 0 } : s))
      )
    } catch {
      setMessages(session.messages || [])
    }
  }

  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend || input).trim()
    if (!selectedSession || !text) return

    const tempMsg: LiveChatMessage = {
      id: "temp_" + Date.now(),
      session_id: selectedSession.id,
      sender_type: "staff",
      sender_name: user?.full_name || "Case Officer",
      body: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempMsg])
    setInput("")

    // Socket emit
    if (socketRef.current?.connected) {
      socketRef.current.emit("chat:message", {
        session_id: selectedSession.id,
        visitor_id: selectedSession.visitor_id,
        body: text,
        sender_type: "staff",
        sender_name: user?.full_name,
        token: accessToken,
      })
    } else {
      try {
        const saved = await sendStaffMessage(selectedSession.id, text)
        setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? saved : m)))
      } catch (e) {
        console.error("Failed to send staff message:", e)
      }
    }
  }

  async function handleCloseSession() {
    if (!selectedSession) return
    try {
      const updated = await closeOpsSession(selectedSession.id)
      setSelectedSession(updated)
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    } catch (e) {
      console.error("Failed to close session:", e)
    }
  }

  const onlineVisitors = visitors.filter((v) => v.is_online)
  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      s.visitor_name?.toLowerCase().includes(q) ||
      s.visitor_email?.toLowerCase().includes(q) ||
      s.visitor_phone?.toLowerCase().includes(q) ||
      s.current_page.toLowerCase().includes(q) ||
      s.visitor_id.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Radio className="size-5 text-emerald-500 animate-pulse" />
            Live Chat & Visitor Presence
          </h1>
          <p className="text-muted-foreground text-xs">
            Monitor real-time landing page visitors and chat proactively with prospective clients.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-xs h-8"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="size-3.5 mr-1.5 text-emerald-600" /> Sound alerts ON
              </>
            ) : (
              <>
                <VolumeX className="size-3.5 mr-1.5 text-muted-foreground" /> Sound alerts OFF
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={refreshData} className="text-xs h-8">
            <RefreshCw className="size-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-190px)] min-h-[580px]">
        {/* Left Column: Visitors & Sessions Tabs (5 cols) */}
        <Card className="lg:col-span-5 flex flex-col overflow-hidden border border-border bg-card p-0">
          <Tabs defaultValue="visitors" className="flex flex-col h-full">
            <div className="border-b border-border px-3 pt-3 bg-muted/20">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="visitors" className="text-xs">
                  Online Visitors
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    {onlineVisitors.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="conversations" className="text-xs">
                  Conversations
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                    {sessions.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <div className="relative py-2.5">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search visitors, pages, emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>
            </div>

            {/* TAB 1: Online Visitors */}
            <TabsContent value="visitors" className="flex-1 overflow-y-auto m-0 p-2 space-y-2">
              {onlineVisitors.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground space-y-2">
                  <Globe className="size-8 mx-auto stroke-1 opacity-50" />
                  <p className="text-xs">No visitors currently on the website.</p>
                  <p className="text-[11px]">When someone lands on the page, they will appear here live.</p>
                </div>
              ) : (
                onlineVisitors.map((v) => {
                  const isSelected = selectedSession?.id === v.id
                  const isMobile = v.user_agent?.toLowerCase().includes("mobile")
                  return (
                    <div
                      key={v.id}
                      onClick={() => handleSelectSession(v)}
                      className={cn(
                        "flex items-start justify-between p-3 rounded-lg border text-xs cursor-pointer transition-all",
                        isSelected
                          ? "bg-primary/10 border-primary shadow-xs"
                          : "bg-background hover:bg-muted/50 border-border"
                      )}
                    >
                      <div className="space-y-1 min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="font-semibold text-foreground truncate">
                            {v.visitor_name || `Visitor ${v.visitor_id.slice(-6)}`}
                          </span>
                          {v.unread_count ? (
                            <Badge className="bg-destructive text-[10px] px-1 py-0 h-4">
                              {v.unread_count} new
                            </Badge>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1 truncate max-w-[160px]">
                            <Globe className="size-3 shrink-0" /> {v.current_page}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            {isMobile ? <Smartphone className="size-3" /> : <Laptop className="size-3" />}
                            {isMobile ? "Mobile" : "Desktop"}
                          </span>
                        </div>

                        {v.last_message && (
                          <p className="text-[11px] text-foreground/80 truncate pt-0.5">
                            <span className="text-muted-foreground font-medium">Last:</span> {v.last_message.body}
                          </p>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        className="text-[11px] h-7 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectSession(v)
                        }}
                      >
                        <MessageSquarePlus className="size-3 mr-1" />
                        Chat
                      </Button>
                    </div>
                  )
                })
              )}
            </TabsContent>

            {/* TAB 2: Conversations */}
            <TabsContent value="conversations" className="flex-1 overflow-y-auto m-0 p-2 space-y-2">
              {filteredSessions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  No conversations match your query.
                </div>
              ) : (
                filteredSessions.map((s) => {
                  const isSelected = selectedSession?.id === s.id
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSession(s)}
                      className={cn(
                        "flex items-start justify-between p-3 rounded-lg border text-xs cursor-pointer transition-all",
                        isSelected
                          ? "bg-primary/10 border-primary shadow-xs"
                          : "bg-background hover:bg-muted/50 border-border"
                      )}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "size-2 rounded-full shrink-0",
                              s.is_online ? "bg-emerald-500" : "bg-muted-foreground/40"
                            )}
                          />
                          <span className="font-semibold text-foreground truncate">
                            {s.visitor_name || `Visitor ${s.visitor_id.slice(-6)}`}
                          </span>
                          {s.status === "closed" && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              Closed
                            </Badge>
                          )}
                          {s.unread_count ? (
                            <Badge className="bg-destructive text-[10px] px-1 py-0 h-4">
                              {s.unread_count} new
                            </Badge>
                          ) : null}
                        </div>

                        {s.visitor_email && (
                          <p className="text-[11px] text-muted-foreground truncate">{s.visitor_email}</p>
                        )}

                        <p className="text-[11px] text-foreground/80 truncate">
                          {s.last_message ? s.last_message.body : "No messages yet"}
                        </p>
                      </div>

                      <span className="text-[10px] text-muted-foreground shrink-0 pl-2">
                        {new Date(s.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )
                })
              )}
            </TabsContent>
          </Tabs>
        </Card>

        {/* Right Column: Chat Transcript & Action Panel (7 cols) */}
        <Card className="lg:col-span-7 flex flex-col overflow-hidden border border-border bg-card p-0">
          {selectedSession ? (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                      {selectedSession.visitor_name?.slice(0, 2).toUpperCase() || (
                        <User className="size-5" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 size-3 rounded-full border-2 border-card",
                        selectedSession.is_online ? "bg-emerald-500" : "bg-muted-foreground/50"
                      )}
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-foreground">
                        {selectedSession.visitor_name || `Visitor (${selectedSession.visitor_id})`}
                      </h2>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          selectedSession.is_online
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {selectedSession.is_online ? "Online Now" : "Offline"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
                      <span>Page: <strong>{selectedSession.current_page}</strong></span>
                      {selectedSession.visitor_email && <span>• {selectedSession.visitor_email}</span>}
                      {selectedSession.visitor_phone && <span>• {selectedSession.visitor_phone}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedSession.status === "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCloseSession}
                      className="text-xs h-8 text-muted-foreground hover:text-foreground"
                    >
                      <Check className="size-3.5 mr-1" /> Mark Resolved
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Resolved
                    </Badge>
                  )}
                </div>
              </div>

              {/* Message Transcript */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/50">
                {messages.length === 0 && (
                  <div className="text-center py-8 space-y-3">
                    <Sparkles className="size-7 mx-auto text-primary opacity-80" />
                    <p className="text-xs font-semibold text-foreground">
                      Start a conversation with this visitor!
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      The visitor is currently viewing <code>{selectedSession.current_page}</code>. Send a proactive greeting below to appear on their screen.
                    </p>
                  </div>
                )}

                {messages.map((msg) => {
                  const isStaff = msg.sender_type === "staff"
                  return (
                    <div
                      key={msg.id}
                      className={cn("flex flex-col", isStaff ? "items-end" : "items-start")}
                    >
                      <span className="text-[10px] text-muted-foreground px-1 pb-1">
                        {isStaff ? msg.sender_name || "Staff" : selectedSession.visitor_name || "Visitor"}
                      </span>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-xs break-words",
                          isStaff
                            ? "bg-primary text-primary-foreground rounded-br-xs"
                            : "bg-muted text-foreground rounded-bl-xs border border-border"
                        )}
                      >
                        {msg.body}
                      </div>
                      <span className="text-[9px] text-muted-foreground/70 px-1 pt-1 flex items-center gap-1">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {isStaff && <CheckCheck className="size-3 text-primary" />}
                      </span>
                    </div>
                  )
                })}

                {isVisitorTyping && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse py-1">
                    <span className="size-2 rounded-full bg-primary animate-bounce" />
                    <span className="text-[11px]">Visitor is typing...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Canned Responses Bar */}
              <div className="border-t border-border bg-muted/10 px-3 py-2 flex items-center gap-1.5 overflow-x-auto text-xs">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground shrink-0 pr-1">
                  Quick replies:
                </span>
                {CANNED_RESPONSES.map((resp, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(resp)}
                    className="rounded-full border border-border bg-background px-3 py-1 text-[11px] text-foreground hover:bg-muted whitespace-nowrap transition-colors"
                  >
                    {resp.slice(0, 32)}...
                  </button>
                ))}
              </div>

              {/* Footer Input */}
              <div className="border-t border-border bg-card p-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSendMessage()
                  }}
                  className="flex items-center gap-2"
                >
                  <Input
                    placeholder={`Reply to ${selectedSession.visitor_name || "visitor"}...`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="text-xs h-9 flex-1"
                  />
                  <Button type="submit" size="sm" disabled={!input.trim()} className="text-xs h-9 px-4">
                    <Send className="size-3.5 mr-1.5" /> Send
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-3 text-muted-foreground">
              <MessageCircle className="size-10 stroke-1 text-muted-foreground/60" />
              <h3 className="text-sm font-semibold text-foreground">No Conversation Selected</h3>
              <p className="text-xs max-w-sm">
                Select an active visitor from the left pane to view their page location and initiate a live chat.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
