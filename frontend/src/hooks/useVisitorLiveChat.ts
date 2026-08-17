import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import { io, type Socket } from "socket.io-client"

import {
  getSessionMessages,
  initVisitorSession,
  sendVisitorMessage,
  updateVisitorContact,
  type LiveChatMessage,
  type LiveChatSession,
} from "@/api/liveChat"
import { SOCKET_URL } from "@/config/env"

const VISITOR_STORAGE_KEY = "deevalegh.visitor_id"

export function getOrCreateVisitorId(): string {
  let id = localStorage.getItem(VISITOR_STORAGE_KEY)
  if (!id) {
    id = "vis_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
    localStorage.setItem(VISITOR_STORAGE_KEY, id)
  }
  return id
}

export function useVisitorLiveChat() {
  const location = useLocation()
  const [visitorId] = useState<string>(getOrCreateVisitorId)
  const [session, setSession] = useState<LiveChatSession | null>(null)
  const [messages, setMessages] = useState<LiveChatMessage[]>([])
  const [isStaffTyping, setIsStaffTyping] = useState(false)
  const [staffTypingName, setStaffTypingName] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [proactiveMessage, setProactiveMessage] = useState<LiveChatMessage | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const typingTimeoutRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  function playVisitorChime() {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === "suspended") ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15) // E5
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } catch {
      // Audio not permitted yet
    }
  }

  // Initialize or resume session
  useEffect(() => {
    let isMounted = true
    initVisitorSession(visitorId, location.pathname, document.referrer)
      .then((sess) => {
        if (!isMounted) return
        setSession(sess)
        if (sess.messages && sess.messages.length > 0) {
          setMessages(sess.messages)
        }
        // Emit explicit join if socket is already connected
        if (socketRef.current?.connected) {
          socketRef.current.emit("chat:join", {
            visitor_id: visitorId,
            session_id: sess.id,
          })
        }
      })
      .catch((err) => {
        console.warn("Live chat session init error:", err)
      })

    return () => {
      isMounted = false
    }
  }, [visitorId, location.pathname])

  // Track page views
  useEffect(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("visitor:page_view", {
        visitor_id: visitorId,
        page: location.pathname,
      })
    }
  }, [location.pathname, visitorId])

  // Setup visitor Socket.IO connection
  useEffect(() => {
    const s = io(SOCKET_URL, {
      auth: {
        visitor_id: visitorId,
        page: location.pathname,
        referrer: document.referrer,
      },
      transports: ["websocket", "polling"],
    })

    socketRef.current = s

    s.on("connect", () => {
      if (session?.id) {
        s.emit("chat:join", { visitor_id: visitorId, session_id: session.id })
      }
    })

    s.on("chat:incoming_message", (msg: LiveChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })

      if (msg.sender_type === "staff") {
        playVisitorChime()
        setUnreadCount((c) => c + 1)
        // If widget is closed, set proactive bubble
        setProactiveMessage(msg)
      }
    })

    s.on(
      "chat:typing",
      (data: { is_typing: boolean; sender_type: string; sender_name?: string }) => {
        if (data.sender_type === "staff") {
          setIsStaffTyping(data.is_typing)
          setStaffTypingName(data.sender_name || "Staff")
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
          if (data.is_typing) {
            typingTimeoutRef.current = window.setTimeout(() => {
              setIsStaffTyping(false)
            }, 4000)
          }
        }
      }
    )

    // Periodic heartbeat
    const interval = setInterval(() => {
      if (s.connected) {
        s.emit("visitor:heartbeat", { visitor_id: visitorId })
      }
    }, 30000)

    return () => {
      clearInterval(interval)
      s.disconnect()
      socketRef.current = null
    }
  }, [visitorId, session?.id, location.pathname])

  // Fetch latest messages from API
  const refreshMessages = useCallback(async () => {
    if (!session?.id) return
    try {
      const latest = await getSessionMessages(session.id)
      if (latest && latest.length > 0) {
        setMessages(latest)
      }
    } catch {
      // Best-effort sync
    }
  }, [session?.id])

  // Periodic sync while widget is open to guarantee no missed messages
  useEffect(() => {
    if (!isOpen || !session?.id) return

    refreshMessages()
    const pollInterval = setInterval(() => {
      refreshMessages()
    }, 4000)

    return () => {
      clearInterval(pollInterval)
    }
  }, [isOpen, session?.id, refreshMessages])

  function handleOpen() {
    setIsOpen(true)
    setUnreadCount(0)
    setProactiveMessage(null)
    refreshMessages()
  }

  function handleClose() {
    setIsOpen(false)
  }

  function dismissProactive() {
    setProactiveMessage(null)
  }

  async function sendMessage(body: string) {
    const text = body.trim()
    if (!text) return

    // Ensure session is initialized
    let currentSession = session
    if (!currentSession) {
      try {
        currentSession = await initVisitorSession(visitorId, location.pathname, document.referrer)
        setSession(currentSession)
      } catch (err) {
        console.error("Failed to initialize session before sending:", err)
        return
      }
    }

    const tempMsg: LiveChatMessage = {
      id: "temp_" + Date.now(),
      session_id: currentSession.id,
      sender_type: "visitor",
      sender_name: currentSession.visitor_name || "You",
      body: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempMsg])

    // Emit via socket
    if (socketRef.current?.connected) {
      socketRef.current.emit("chat:message", {
        session_id: currentSession.id,
        visitor_id: visitorId,
        body: text,
        sender_type: "visitor",
        sender_name: currentSession.visitor_name || "Visitor",
      })
    }

    // Always persist through REST to ensure durability and trigger backend tasks
    try {
      const saved = await sendVisitorMessage(currentSession.id, text, currentSession.visitor_name || undefined)
      setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? saved : m)))
    } catch (e) {
      console.warn("REST message send completed or socket handled it:", e)
    }
  }

  function sendTyping(isTyping: boolean) {
    if (socketRef.current?.connected && session) {
      socketRef.current.emit("chat:typing", {
        session_id: session.id,
        visitor_id: visitorId,
        is_typing: isTyping,
        sender_type: "visitor",
        sender_name: session.visitor_name || "Visitor",
      })
    }
  }

  async function saveContact(contact: { visitor_name?: string; visitor_email?: string; visitor_phone?: string }) {
    if (!session) return
    const updated = await updateVisitorContact(session.id, contact)
    setSession(updated)
  }

  return {
    visitorId,
    session,
    messages,
    isOpen,
    unreadCount,
    isStaffTyping,
    staffTypingName,
    proactiveMessage,
    openChat: handleOpen,
    closeChat: handleClose,
    dismissProactive,
    toggleChat: () => (isOpen ? handleClose() : handleOpen()),
    sendMessage,
    sendTyping,
    saveContact,
  }
}
