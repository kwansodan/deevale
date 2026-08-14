import { useInView } from "@/hooks/useInView"
import { useCountUp } from "@/hooks/useCountUp"

/**
 * One figure from the derived stats row, counting up when it scrolls into view.
 * Splits a value like "72h" into the number it animates and a suffix it keeps;
 * a non-numeric value (none today) is rendered verbatim. The gold suffix uses
 * accent-600, not the raw fill-only yellow.
 */
export function StatCounter({ value, label }: { value: string; label: string }) {
  const { ref, inView } = useInView<HTMLDivElement>()
  const match = value.match(/^(\d+)(.*)$/)
  const target = match ? Number(match[1]) : 0
  const suffix = match ? match[2] : ""
  const n = useCountUp(target, inView)

  return (
    <div ref={ref}>
      <dt className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
        {match ? (
          <>
            <span className="tabular-nums">{n}</span>
            {suffix && <span className="text-accent-600">{suffix}</span>}
          </>
        ) : (
          value
        )}
      </dt>
      <dd className="text-muted-foreground mt-1 text-sm">{label}</dd>
    </div>
  )
}
