import { useEffect } from "react"
import { io, type Socket } from "socket.io-client"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { useAuthStore } from "@/stores/auth"

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:5000"

let socket: Socket | null = null

/**
 * Connects the logged-in user's socket room and refreshes case/notification
 * queries whenever the backend pushes a notification -- this is what makes
 * the dashboard update live when staff transition a stage.
 */
export function useNotificationSocket() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!accessToken) return

    socket = io(SOCKET_URL, { auth: { token: accessToken }, transports: ["websocket", "polling"] })

    socket.on("notification", (payload: { title: string; body: string; related_case_id: string | null }) => {
      toast(payload.title, { description: payload.body })
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      if (payload.related_case_id) {
        queryClient.invalidateQueries({ queryKey: ["case", payload.related_case_id] })
        queryClient.invalidateQueries({ queryKey: ["case-documents", payload.related_case_id] })
      }
      queryClient.invalidateQueries({ queryKey: ["cases"] })
    })

    return () => {
      socket?.disconnect()
      socket = null
    }
  }, [accessToken, queryClient])
}
