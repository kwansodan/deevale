import type { Logo } from "@/api/public"

/**
 * "Trusted by" strip of REAL clients/partners (admin-managed). Renders an image
 * when one is provided, otherwise the name as a serif wordmark. Auto-scrolls as
 * a seamless marquee -- two copies of the row sliding -50% -- pausing on hover
 * and holding still under reduced motion (see .marquee in index.css).
 *
 * Renders nothing when there are no logos: we never invent a client.
 */
export function LogoStrip({ logos }: { logos: Logo[] }) {
  if (logos.length === 0) return null
  // Duplicate the row so the -50% translate loops without a visible seam. The
  // second copy is decorative, hence aria-hidden.
  const doubled = [...logos, ...logos]

  return (
    <section className="border-border bg-secondary/30 border-y py-8">
      <p className="text-muted-foreground mb-6 text-center text-xs font-semibold tracking-wide uppercase">
        Trusted by teams registering across Ghana
      </p>
      <div className="marquee mx-auto max-w-6xl">
        <ul className="marquee-track items-center gap-12">
          {doubled.map((logo, i) => (
            <li key={`${logo.name}-${i}`} className="flex shrink-0 items-center" aria-hidden={i >= logos.length}>
              <LogoItem logo={logo} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function LogoItem({ logo }: { logo: Logo }) {
  const content = logo.imageUrl ? (
    <img
      src={logo.imageUrl}
      alt={logo.name}
      loading="lazy"
      className="h-8 w-auto opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0"
    />
  ) : (
    <span className="font-heading text-muted-foreground text-xl font-semibold whitespace-nowrap">
      {logo.name}
    </span>
  )
  return logo.url ? (
    <a href={logo.url} target="_blank" rel="noreferrer noopener" className="hover:opacity-100">
      {content}
    </a>
  ) : (
    content
  )
}
