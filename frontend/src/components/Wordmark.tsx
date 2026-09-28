import { cn } from "@/lib/utils"

/**
 * The official Deevale GH brand mark and typography.
 * Combines the Concept 3 Financial Growth Monogram (a precision geometric 'D'
 * with an upward-surging golden trajectory arrow) with the refined serif wordmark.
 */
export function Wordmark({
  size = "md",
  className,
  showIcon = true,
}: {
  size?: "sm" | "md" | "lg"
  className?: string
  showIcon?: boolean
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 sm:gap-2.5", className)}>
      {showIcon && (
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className={cn(
            "shrink-0 text-primary transition-transform group-hover:scale-105",
            size === "sm" && "h-5 w-5",
            size === "md" && "h-6 w-6",
            size === "lg" && "h-8 w-8"
          )}
        >
          {/* D Monogram in Brand Slate Green */}
          <path
            d="M10 7 H23 C32.941 7 41 15.059 41 24 C41 32.941 32.941 41 23 41 H10 V7 Z"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Upward Financial Growth Trajectory in Gold */}
          <path
            d="M17 32 L32 17"
            stroke="#F4CE14"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M23 17 H32 V26"
            stroke="#F4CE14"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span
        className={cn(
          "text-primary font-heading font-semibold tracking-tight leading-none",
          size === "sm" && "text-lg",
          size === "md" && "text-xl",
          size === "lg" && "text-3xl"
        )}
      >
        Deevale GH
      </span>
    </span>
  )
}
