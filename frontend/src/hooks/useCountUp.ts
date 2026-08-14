import { useEffect, useRef, useState } from "react"

/**
 * Counts from 0 up to `target` once, the first time `active` turns true.
 *
 * Respects prefers-reduced-motion: when motion is reduced it snaps straight to
 * the target, so the figure is always correct and fully visible -- the animation
 * is decoration, never the source of truth. Pair with useInView so the count
 * runs when the number scrolls into view rather than on mount.
 */
export function useCountUp(target: number, active: boolean, durationMs = 1100) {
  const [value, setValue] = useState(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduce || target === 0) {
      setValue(target)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setValue(Math.round(eased * target))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [target, active, durationMs])

  return value
}
