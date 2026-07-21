import { useEffect, useRef, useState } from "react"

/**
 * Fires once when the element first enters the viewport, for entrance reveals.
 *
 * Deliberately one-shot: re-animating on every scroll past is the thing that
 * makes a page feel restless. Elements start visible and are only hidden while
 * waiting if motion is actually allowed, so a reduced-motion or no-JS reader
 * never ends up with permanently invisible content.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(rootMargin = "-80px") {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  return { ref, inView }
}
