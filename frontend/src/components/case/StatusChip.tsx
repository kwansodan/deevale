import { cn } from "@/lib/utils"

// Exact PRD C3 chip vocabulary. Keys are the `status_display` strings the API
// returns; anything unknown falls back to a muted chip with the raw text.
const CHIP_STYLES: Record<string, string> = {
  "Not started": "bg-muted text-muted-foreground",
  "Awaiting client": "bg-accent-100 text-accent-900 dark:bg-accent-900 dark:text-accent-100",
  "In review": "bg-info/10 text-info",
  "With government": "bg-primary-100 text-primary-900 dark:bg-primary-900 dark:text-primary-100",
  Done: "bg-success/10 text-success",
  Blocked: "bg-error/10 text-error",
}

export function StatusChip({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        CHIP_STYLES[label] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {label}
    </span>
  )
}
