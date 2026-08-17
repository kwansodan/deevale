import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import {
  Check,
  ChevronDown,
  MessageCircle,
  Send,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react"

import { useVisitorLiveChat } from "@/hooks/useVisitorLiveChat"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const STARTER_PROMPTS = [
  "What are the requirements for a Limited Company?",
  "How much are the government fees?",
  "How long does registration take?",
  "Can foreign directors register a company?",
]

export function LiveChatWidget() {
  const { pathname } = useLocation()
  const {
    messages,
    isOpen,
    unreadCount,
    isStaffTyping,
    staffTypingName,
    proactiveMessage,
    openChat,
    closeChat,
    toggleChat,
    sendMessage,
    sendTyping,
    saveContact,
  } = useVisitorLiveChat()

  const [input, setInput] = useState("")
  const [showContactForm, setShowContactForm] = useState(false)
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactSaved, setContactSaved] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isStaffTyping, isOpen])

  function handleSend() {
    if (!input.trim()) return
    sendMessage(input.trim())
    setInput("")
    sendTyping(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value)
    sendTyping(e.target.value.length > 0)
  }

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contactName && !contactEmail && !contactPhone) return
    await saveContact({
      visitor_name: contactName || undefined,
      visitor_email: contactEmail || undefined,
      visitor_phone: contactPhone || undefined,
    })
    setContactSaved(true)
    setTimeout(() => {
      setShowContactForm(false)
      setContactSaved(false)
    }, 2000)
  }

  // Hide in ops portal
  if (pathname.startsWith("/ops")) return null

  return (
    <div className="fixed bottom-5 right-24 z-40 flex flex-col items-end print:hidden">
      {/* Proactive Greeting Toast Bubble */}
      {!isOpen && proactiveMessage && (
        <div
          onClick={openChat}
          className="mb-3 flex max-w-xs cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-xl transition-all duration-300 hover:scale-102 animate-in fade-in slide-in-from-bottom-3"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">
            {proactiveMessage.sender_name?.slice(0, 2).toUpperCase() || "GH"}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">
                {proactiveMessage.sender_name || "Deevale Support"}
              </p>
              <span className="text-[10px] text-muted-foreground">Just now</span>
            </div>
            <p className="text-xs text-foreground/90 line-clamp-3">{proactiveMessage.body}</p>
            <p className="text-[11px] font-medium text-primary pt-1">Click to reply &rarr;</p>
          </div>
        </div>
      )}

      {/* Main Chat Dialog Window */}
      {isOpen && (
        <div className="mb-3 flex h-[520px] w-[360px] sm:w-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  <Zap className="size-4 text-amber-300" />
                </div>
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card bg-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  Deevale GH Live Chat
                </h3>
                <p className="text-[11px] text-muted-foreground">Case Officers are online</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowContactForm(!showContactForm)}
                title="Your details"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <User className="size-4" />
              </button>
              <button
                onClick={closeChat}
                title="Close chat"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ChevronDown className="size-4" />
              </button>
            </div>
          </div>

          {/* Contact Details Dropdown Drawer */}
          {showContactForm && (
            <div className="border-b border-border bg-muted/20 p-3.5 text-xs animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-foreground">Your Contact Info (Optional)</span>
                <button
                  onClick={() => setShowContactForm(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <p className="text-muted-foreground text-[11px] mb-2.5">
                Leave your email or WhatsApp so our team can follow up if you step away.
              </p>
              <form onSubmit={handleContactSubmit} className="space-y-2">
                <input
                  type="text"
                  placeholder="Your Name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="tel"
                  placeholder="WhatsApp / Phone number"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button type="submit" size="sm" className="w-full text-xs h-7">
                  {contactSaved ? (
                    <>
                      <Check className="size-3.5 mr-1" /> Saved
                    </>
                  ) : (
                    "Save info"
                  )}
                </Button>
              </form>
            </div>
          )}

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Welcome banner if conversation is fresh */}
            {messages.length === 0 && (
              <div className="space-y-3 text-center py-4">
                <div className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">Welcome to Deevale GH!</p>
                  <p className="text-[11px] text-muted-foreground max-w-[260px] mx-auto">
                    Ask us anything about registering a Ghanaian company, compliance, or fees.
                  </p>
                </div>
                <div className="pt-2 flex flex-col gap-1.5 text-left">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground px-1 tracking-wider">
                    Quick questions:
                  </p>
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-foreground hover:bg-muted/80 hover:border-border transition-colors text-left"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat message bubbles */}
            {messages.map((msg) => {
              const isVisitor = msg.sender_type === "visitor"
              return (
                <div
                  key={msg.id}
                  className={cn("flex flex-col", isVisitor ? "items-end" : "items-start")}
                >
                  <span className="text-[10px] text-muted-foreground px-1 pb-1">
                    {isVisitor ? "You" : msg.sender_name || "Deevale Support"}
                  </span>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm break-words",
                      isVisitor
                        ? "bg-primary text-primary-foreground rounded-br-xs"
                        : "bg-muted text-foreground rounded-bl-xs border border-border/50"
                    )}
                  >
                    {msg.body}
                  </div>
                  <span className="text-[9px] text-muted-foreground/70 px-1 pt-1">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )
            })}

            {/* Typing Indicator */}
            {isStaffTyping && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse py-1">
                <div className="flex gap-1 items-center bg-muted px-2.5 py-1.5 rounded-full border border-border">
                  <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <span className="size-1.5 rounded-full bg-primary animate-bounce" />
                </div>
                <span className="text-[11px]">{staffTypingName} is typing...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer input */}
          <div className="border-t border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Type your message..."
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="flex-1 rounded-full border border-input bg-muted/30 px-3.5 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-colors"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim()}
                className="size-8 rounded-full shrink-0"
              >
                <Send className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        onClick={toggleChat}
        aria-label="Open live chat"
        className="group relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {isOpen ? (
          <X className="size-6 transition-transform group-hover:rotate-90" />
        ) : (
          <>
            <MessageCircle className="size-6" />
            <span className="absolute -top-0.5 -right-0.5 flex size-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-3.5 rounded-full bg-emerald-500 border-2 border-card" />
            </span>
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unreadCount}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  )
}
