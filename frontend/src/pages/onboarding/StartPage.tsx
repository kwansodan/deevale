import { useEffect, useState } from "react"

import { getOnboardingDraft, saveOnboardingDraft } from "@/api/cases"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { WizardProgress } from "./WizardProgress"
import { EMPTY_WIZARD_DATA, type WizardData } from "./types"
import { StepAboutYou } from "./steps/StepAboutYou"
import { StepBusiness } from "./steps/StepBusiness"
import { StepOwnership } from "./steps/StepOwnership"
import { StepRecommendation } from "./steps/StepRecommendation"
import { StepQuote } from "./steps/StepQuote"
import { StepReview } from "./steps/StepReview"

export default function StartPage() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>(EMPTY_WIZARD_DATA)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getOnboardingDraft()
      .then((draft) => {
        if (cancelled) return
        if (draft.payload && Object.keys(draft.payload).length > 0) {
          setData({ ...EMPTY_WIZARD_DATA, ...(draft.payload as Partial<WizardData>) })
          setStep(Math.min(Math.max(draft.current_step, 1), 6))
        }
      })
      .catch(() => {
        // No draft or fetch failure -- start fresh, nothing to surface.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function advance(values: Partial<WizardData>) {
    const merged = { ...data, ...values }
    const nextStep = Math.min(step + 1, 6)
    setData(merged)
    setStep(nextStep)
    // Fire-and-forget: a failed draft save shouldn't interrupt the flow.
    saveOnboardingDraft({ payload: merged, current_step: nextStep }).catch(() => {})
  }

  function back() {
    setStep((s) => Math.max(s - 1, 1))
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold">Start your business</h1>
      <p className="text-muted-foreground mt-1 mb-6 text-sm">
        Six quick steps — your progress is saved as you go.
      </p>
      <Card className="border-border">
        <CardHeader>
          <WizardProgress currentStep={step} />
        </CardHeader>
        <CardContent>
          {!loaded ? (
            <div className="grid gap-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-2/3" />
            </div>
          ) : (
            <>
              {step === 1 && <StepAboutYou data={data} onNext={advance} />}
              {step === 2 && <StepBusiness data={data} onNext={advance} onBack={back} />}
              {step === 3 && <StepOwnership data={data} onNext={advance} onBack={back} />}
              {step === 4 && <StepRecommendation data={data} onNext={advance} onBack={back} />}
              {step === 5 && <StepQuote data={data} onNext={advance} onBack={back} />}
              {step === 6 && <StepReview data={data} onBack={back} />}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
