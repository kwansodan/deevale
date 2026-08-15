import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { format } from "date-fns"
import { BellOff } from "lucide-react"

import { listNotifications, markNotificationRead } from "@/api/notifications"
import { NotificationPreferences } from "@/components/account/NotificationPreferences"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Never let a malformed timestamp throw and blank the page. */
function formatWhen(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : format(date, "d MMM yyyy, HH:mm")
}

function NotificationList() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: listNotifications,
  })

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })

  if (isLoading) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (!notifications || notifications.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-sm">
        <BellOff className="size-6" />
        {t("notificationsPage.empty")}
      </div>
    )
  }

  return (
    <ul className="grid gap-2">
      {notifications.map((n) => (
        <li
          key={n.id}
          className={cn(
            "border-border rounded-lg border p-3",
            !n.is_read && "border-primary/30 bg-primary-50 dark:bg-primary/10"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={cn("text-sm", !n.is_read && "font-medium")}>{n.title}</p>
              <p className="text-muted-foreground mt-0.5 text-sm">{n.body}</p>
              <p className="text-muted-foreground/70 mt-1 text-xs">{formatWhen(n.created_at)}</p>
            </div>
            {!n.is_read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markReadMutation.mutate(n.id)}
                disabled={markReadMutation.isPending}
              >
                {t("notificationsPage.markRead")}
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function NotificationsPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>{t("notificationsPage.title")}</CardTitle>
          <CardDescription>{t("notificationsPage.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="inbox">
            <TabsList>
              <TabsTrigger value="inbox">{t("notificationsPage.inbox")}</TabsTrigger>
              <TabsTrigger value="settings">{t("notificationsPage.settings")}</TabsTrigger>
            </TabsList>
            <TabsContent value="inbox" className="pt-4">
              <NotificationList />
            </TabsContent>
            <TabsContent value="settings" className="pt-4">
              <NotificationPreferences />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
