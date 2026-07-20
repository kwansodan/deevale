import { CalendarClock, ChevronRight } from "lucide-react"
import { format } from "date-fns"

import type { BusinessCase, CaseTask } from "@/api/cases"
import { Badge } from "@/components/ui/badge"

export function actionNeededTasks(businessCase: BusinessCase): CaseTask[] {
  return businessCase.stages
    .filter((stage) => ["in_progress", "not_started"].includes(stage.status))
    .flatMap((stage) => stage.tasks)
    .filter((task) => task.assignee_type === "client" && !["done", "skipped"].includes(task.status))
}

export function TaskInbox({
  businessCase,
  onTaskClick,
}: {
  businessCase: BusinessCase
  onTaskClick: (task: CaseTask) => void
}) {
  const tasks = actionNeededTasks(businessCase)

  if (tasks.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing needed from you right now — we'll let you know the moment that changes. 🎉
      </p>
    )
  }

  return (
    <ul className="grid gap-2">
      {tasks.map((task) => (
        <li key={task.id}>
          <button
            type="button"
            onClick={() => onTaskClick(task)}
            className="border-accent/40 bg-accent-50 hover:border-accent flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors dark:bg-accent/10"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{task.name}</p>
              {task.deadline_at && (
                <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                  <CalendarClock className="size-3" />
                  Due {format(new Date(task.deadline_at), "d MMM yyyy")}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge className="bg-accent text-accent-foreground">Action needed</Badge>
              <ChevronRight className="text-muted-foreground size-4" />
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
