import { cn } from "@/lib/utils"

/**
 * The Deevale GH wordmark. Previously duplicated as a bare styled span across
 * eight pages, which meant a brand change had to be made eight times and drifted
 * between them. Set in the heading serif with slightly tightened tracking.
 */
export function Wordmark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  return (
    <span
      className={cn(
        "text-primary font-heading font-semibold tracking-tight",
        size === "sm" && "text-lg",
        size === "md" && "text-xl",
        size === "lg" && "text-3xl",
        className
      )}
    >
      Deevale GH
    </span>
  )
}
