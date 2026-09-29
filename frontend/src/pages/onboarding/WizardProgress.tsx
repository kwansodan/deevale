import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

// Keys into wizard.steps.* (see i18n locales); order matches the wizard flow.
const STEP_KEYS = ["aboutYou", "business", "ownership", "recommendation", "quote", "review"] as const

export function WizardProgress({ currentStep }: { currentStep: number }) {
  const { t } = useTranslation()
  const activeKey = STEP_KEYS[currentStep - 1] ?? STEP_KEYS[0]
  const activeLabel = t(`wizard.steps.${activeKey}`)
  const percent = Math.round((currentStep / STEP_KEYS.length) * 100)

  return (
    <div className="w-full">
      {/* Mobile view (< 640px) */}
      <div className="sm:hidden space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-primary">
            Step {currentStep} of {STEP_KEYS.length}: {activeLabel}
          </span>
          <span className="text-muted-foreground font-medium">{percent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Tablet & Desktop view (>= 640px) */}
      <ol className="hidden sm:flex items-center justify-between gap-1" aria-label={t("wizard.title")}>
        {STEP_KEYS.map((key, index) => {
          const label = t(`wizard.steps.${key}`)
          const stepNumber = index + 1
          const isDone = stepNumber < currentStep
          const isActive = stepNumber === currentStep
          return (
            <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                  isDone && "bg-primary text-primary-foreground",
                  isActive && "bg-accent text-accent-foreground ring-accent/40 ring-2",
                  !isDone && !isActive && "bg-muted text-muted-foreground"
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {isDone ? <Check className="size-4" /> : stepNumber}
              </span>
              <span
                className={cn(
                  "text-center text-[11px] leading-tight",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
