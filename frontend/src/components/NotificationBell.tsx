import { Bell } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"

import { getUnreadCount, listNotifications } from "@/api/notifications"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

export function NotificationBell() {
  const queryClient = useQueryClient()
  const { data: unreadCount } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
  })
  const { data: notifications } = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: listNotifications,
  })

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) queryClient.invalidateQueries({ queryKey: ["notifications"] })
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="size-5" />
            {!!unreadCount && unreadCount > 0 && (
              <Badge className="bg-error absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!notifications || notifications.length === 0 ? (
          <div className="text-muted-foreground p-4 text-center text-sm">No notifications yet.</div>
        ) : (
          notifications.slice(0, 6).map((n) => (
            <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 whitespace-normal">
              <span className={`text-sm ${n.is_read ? "text-muted-foreground" : "font-medium"}`}>
                {n.title}
              </span>
              <span className="text-muted-foreground text-xs">{n.body}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link to="/app/notifications" className="text-primary justify-center text-sm font-medium">
              View all
            </Link>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
