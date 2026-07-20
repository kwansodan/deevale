import { useState } from "react"
import { BookOpen, Check, ChevronDown, Lock } from "lucide-react"

import type { BusinessCase, CaseStage, CaseTask } from "@/api/cases"
import { StatusChip } from "@/components/case/StatusChip"
import { STAGE_KB } from "@/components/case/stageKb"
import { cn } from "@/lib/utils"

function stageDisplay(stage: CaseStage): string {
  switch (stage.status) {
    case "completed":
      return "Done"
    case "in_progress":
      return "With government"
    case "blocked_on_payment":
      return "Blocked"
    default:
      return "Not started"
  }
}

function StageTasks({ tasks, onTaskClick }: { tasks: CaseTask[]; onTaskClick?: (task: CaseTask) => void }) {
  return (
    <ul className="mt-3 grid gap-2">
      {tasks.map((task) => {
        const clickable =
          onTaskClick && task.assignee_type === "client" && !["done", "skipped"].includes(task.status)
        return (
          <li key={task.id}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onTaskClick(task)}
              className={cn(
                "border-border flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm",
                clickable ? "hover:border-accent hover:bg-accent-50 dark:hover:bg-accent/10" : "cursor-default"
              )}
            >
              <span className={task.status === "done" ? "text-muted-foreground line-through" : ""}>
                {task.name}
              </span>
              <StatusChip label={task.status_display} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function StageTimeline({
  businessCase,
  onTaskClick,
}: {
  businessCase: BusinessCase
  onTaskClick?: (task: CaseTask) => void
}) {
  const activeStage = businessCase.stages.find((s) =>
    ["in_progress", "blocked_on_payment", "not_started"].includes(s.status)
  )
  const [expandedId, setExpandedId] = useState<string | null>(activeStage?.id ?? null)

  return (
    <ol className="grid gap-0" aria-label="Registration progress">
      {businessCase.stages.map((stage, index) => {
        const isDone = stage.status === "completed"
        const isActive = stage.id === activeStage?.id
        const isLocked = stage.status === "locked"
        const isLast = index === businessCase.stages.length - 1
        const isExpanded = expandedId === stage.id

        return (
          <li key={stage.id} className="relative flex gap-3">
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-8 left-[13px] h-[calc(100%-1.75rem)] w-0.5",
                  isDone ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <span
              className={cn(
                "z-[1] mt-1 flex size-7 shrink-0 items-center justify-center rounded-full",
                isDone && "bg-primary text-primary-foreground",
                isActive && "bg-accent text-accent-foreground ring-accent/40 ring-2",
                !isDone && !isActive && "bg-muted text-muted-foreground"
              )}
            >
              {isDone ? <Check className="size-4" /> : isLocked ? <Lock className="size-3.5" /> : index + 1}
            </span>

            <div className={cn("min-w-0 flex-1", !isLast && "pb-5")}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() => setExpandedId(isExpanded ? null : stage.id)}
                aria-expanded={isExpanded}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn("truncate font-medium", isActive && "text-foreground")}>{stage.name}</span>
                  <StatusChip label={stageDisplay(stage)} />
                </div>
                <ChevronDown
                  className={cn("text-muted-foreground size-4 shrink-0 transition-transform", isExpanded && "rotate-180")}
                />
              </button>

              {isActive && (
                <p className="text-muted-foreground mt-1 text-sm">
                  {stage.status === "blocked_on_payment"
                    ? "Waiting on payment — this stage unlocks as soon as your invoice is settled."
                    : STAGE_KB[stage.code]?.summary ?? "In progress."}
                </p>
              )}

              {isExpanded && STAGE_KB[stage.code]?.learnMore && (
                <details className="border-border bg-muted/40 mt-2 rounded-md border px-3 py-2">
                  <summary className="text-primary flex cursor-pointer items-center gap-1.5 text-xs font-medium select-none">
                    <BookOpen className="size-3.5" />
                    What happens in this stage?
                  </summary>
                  <p className="text-muted-foreground mt-2 text-sm">{STAGE_KB[stage.code].learnMore}</p>
                </details>
              )}

              {isExpanded && stage.tasks.length > 0 && (
                <StageTasks tasks={stage.tasks} onTaskClick={onTaskClick} />
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
