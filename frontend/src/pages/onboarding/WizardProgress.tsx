import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { WIZARD_STEPS } from "./constants"

export function WizardProgress({ currentStep }: { currentStep: number }) {
  return (
    <ol className="flex items-center justify-between gap-1" aria-label="Onboarding progress">
      {WIZARD_STEPS.map((label, index) => {
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
                "hidden text-center text-[11px] leading-tight sm:block",
                isActive ? "text-foreground font-medium" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
