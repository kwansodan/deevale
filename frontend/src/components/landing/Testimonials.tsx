import { Quote, Star } from "lucide-react"

import type { Testimonial } from "@/api/public"
import { cn } from "@/lib/utils"

/**
 * REAL client/officer quotes (admin-managed) in a horizontal scroll-snap rail --
 * a carousel feel with no carousel dependency. Renders nothing when empty; we
 * never show a placeholder quote.
 */
export function Testimonials({ items }: { items: Testimonial[] }) {
  if (items.length === 0) return null

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4">
      {items.map((t, i) => (
        <figure
          key={i}
          className="bg-card border-border shadow-card hover-lift flex w-[min(85vw,22rem)] shrink-0 snap-start flex-col rounded-2xl border p-6"
        >
          <Quote className="text-accent-600 size-7 shrink-0" aria-hidden />
          {t.rating != null && Number(t.rating) > 0 && <Stars rating={Number(t.rating)} />}
          <blockquote className="font-heading mt-3 flex-1 text-lg leading-relaxed text-balance">
            &ldquo;{t.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-5 flex items-center gap-3">
            {t.avatarUrl ? (
              <img src={t.avatarUrl} alt="" loading="lazy" className="size-10 rounded-full object-cover" />
            ) : (
              <span className="bg-secondary text-primary font-heading flex size-10 items-center justify-center rounded-full font-semibold">
                {t.name.charAt(0)}
              </span>
            )}
            <span className="text-sm">
              <span className="text-foreground block font-semibold">{t.name}</span>
              {(t.role || t.company) && (
                <span className="text-muted-foreground block">
                  {[t.role, t.company].filter(Boolean).join(", ")}
                </span>
              )}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

function Stars({ rating }: { rating: number }) {
  const filled = Math.round(rating)
  return (
    <div className="mt-3 flex gap-0.5" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn("size-4", i < filled ? "fill-accent text-accent-600" : "text-border")}
        />
      ))}
    </div>
  )
}
