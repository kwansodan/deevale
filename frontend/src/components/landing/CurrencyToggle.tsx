import type { DisplayCurrency } from "@/hooks/useCurrency"
import { cn } from "@/lib/utils"

/** Small GHS | USD segmented toggle for the landing page's indicative prices. */
export function CurrencyToggle({
  currency,
  onChange,
  className,
}: {
  currency: DisplayCurrency
  onChange: (c: DisplayCurrency) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Display currency"
      className={cn("border-border inline-flex rounded-full border p-0.5 text-xs font-medium", className)}
    >
      {(["GHS", "USD"] as DisplayCurrency[]).map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={currency === c}
          onClick={() => onChange(c)}
          className={cn(
            "rounded-full px-3 py-1 transition-colors",
            currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {c}
        </button>
      ))}
    </div>
  )
}
