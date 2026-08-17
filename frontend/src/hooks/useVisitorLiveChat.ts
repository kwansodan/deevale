import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import { io, type Socket } from "socket.io-client"

import {
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

  // Initialize or resume session
  useEffect(() => {
    let isMounted = true
    initVisitorSession(visitorId, location.pathname, document.referrer)
      .then((sess) => {
        if (!isMounted) return
        setSession(sess)
        if (sess.messages) {
          setMessages(sess.messages)
        }
      })
      .catch((err) => {
        console.warn("Live chat session init error:", err)
      })

    return () => {
      isMounted = false
    }
  }, [visitorId])

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

    s.on("chat:incoming_message", (msg: LiveChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })

      if (msg.sender_type === "staff") {
        setUnreadCount((c) => c + 1)
        // If widget is closed, pop up proactive toast
        setProactiveMessage(msg)
        // Auto-dismiss proactive bubble after 10s if not clicked
        setTimeout(() => {
          setProactiveMessage(null)
        }, 10000)
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
  }, [visitorId])

  function handleOpen() {
    setIsOpen(true)
    setUnreadCount(0)
    setProactiveMessage(null)
  }

  function handleClose() {
    setIsOpen(false)
  }

  async function sendMessage(body: string) {
    if (!session || !body.trim()) return

    const tempMsg: LiveChatMessage = {
      id: "temp_" + Date.now(),
      session_id: session.id,
      sender_type: "visitor",
      sender_name: session.visitor_name || "You",
      body: body.trim(),
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempMsg])

    // Emit via socket for instant broadcast
    if (socketRef.current?.connected) {
      socketRef.current.emit("chat:message", {
        session_id: session.id,
        visitor_id: visitorId,
        body: body.trim(),
        sender_type: "visitor",
        sender_name: session.visitor_name || "Visitor",
      })
    } else {
      // Fallback via REST
      try {
        const saved = await sendVisitorMessage(session.id, body.trim(), session.visitor_name || undefined)
        setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? saved : m)))
      } catch (e) {
        console.error("Failed to send message via REST fallback:", e)
      }
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
    toggleChat: () => (isOpen ? handleClose() : handleOpen()),
    sendMessage,
    sendTyping,
    saveContact,
  }
}
