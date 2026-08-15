import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreference,
} from "@/api/notifications"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Client-facing categories only (staff categories are filtered out). Shared by
// the account section and the notifications page, which stay in sync through the
// ["notification-preferences"] query key.
const CATEGORY_LABELS: Record<string, string> = {
  stage_completed: "Stage completed",
  action_required: "Action required",
  document_rejected: "Document rejected",
  payment_due: "Payment due",
  payment_received: "Payment received",
  gov_processing_update: "Progress updates",
  mail_received: "Mail received",
  message_received: "New messages",
  deadline_countdown: "Deadline reminders",
  case_blocked: "Case blocked",
}

/** Accessible on/off switch. No `ui/switch` exists in this project, so it's a
 *  small role="switch" button -- reused across the preferences grid. */
export function PreferenceToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted-foreground/30"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform",
          checked && "translate-x-4"
        )}
      />
    </button>
  )
}

export function NotificationPreferences() {
  const queryClient = useQueryClient()
  const { data: preferences, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferences,
  })

  const updateMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] })
      toast.success("Preferences saved.")
    },
    onError: () => toast.error("Couldn't save preferences."),
  })

  if (isLoading || !preferences) {
    return <Skeleton className="h-40 w-full" />
  }

  const clientPreferences = preferences.filter((p) => CATEGORY_LABELS[p.category])
  const digestPref = preferences.find((p) => p.category === "weekly_digest")

  function toggleChannel(
    pref: NotificationPreference,
    channel: "email_enabled" | "sms_enabled" | "whatsapp_enabled",
    enabled: boolean
  ) {
    updateMutation.mutate([{ ...pref, [channel]: enabled }])
  }

  const columns = "grid-cols-[1fr_3rem_3rem_4.5rem]"

  return (
    <div className="grid gap-1">
      <div className={cn("text-muted-foreground grid items-center gap-2 px-1 pb-2 text-xs font-medium", columns)}>
        <span>Notification type</span>
        <span className="text-center">Email</span>
        <span className="text-center">SMS</span>
        <span className="text-center">WhatsApp</span>
      </div>
      {clientPreferences.map((pref) => (
        <div
          key={pref.category}
          className={cn("border-border grid items-center gap-2 rounded-lg border px-3 py-2.5", columns)}
        >
          <span className="text-sm">{CATEGORY_LABELS[pref.category]}</span>
          <div className="justify-self-center">
            <PreferenceToggle
              checked={pref.email_enabled}
              onChange={(next) => toggleChannel(pref, "email_enabled", next)}
              label={`Email for ${CATEGORY_LABELS[pref.category]}`}
            />
          </div>
          <div className="justify-self-center">
            <PreferenceToggle
              checked={pref.sms_enabled ?? false}
              onChange={(next) => toggleChannel(pref, "sms_enabled", next)}
              label={`SMS for ${CATEGORY_LABELS[pref.category]}`}
            />
          </div>
          <div className="justify-self-center">
            <PreferenceToggle
              checked={pref.whatsapp_enabled ?? false}
              onChange={(next) => toggleChannel(pref, "whatsapp_enabled", next)}
              label={`WhatsApp for ${CATEGORY_LABELS[pref.category]}`}
            />
          </div>
        </div>
      ))}

      {digestPref && (
        <div className="border-border mt-3 flex items-center justify-between rounded-lg border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Weekly digest email</p>
            <p className="text-muted-foreground text-xs">
              A Sunday-evening summary of your case progress and upcoming deadlines.
            </p>
          </div>
          <PreferenceToggle
            checked={digestPref.email_enabled}
            onChange={(next) => toggleChannel(digestPref, "email_enabled", next)}
            label="Weekly digest email"
          />
        </div>
      )}

      <p className="text-muted-foreground mt-2 text-xs">
        In-app notifications stay on so you never miss a required action. SMS pauses overnight
        (21:00-07:00) - anything urgent is delivered at 7 am.
      </p>
    </div>
  )
}
