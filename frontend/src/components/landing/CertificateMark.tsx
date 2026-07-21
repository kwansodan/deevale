/**
 * A stylised certificate, used as ornament beside the closing call to action.
 *
 * Deliberately NOT a facsimile: the text is abstracted into rules, there are no
 * field labels, no registration number, and the seal is the product's own
 * triangle mark rather than anything resembling the Registrar's. It should read
 * as "a certificate" at a glance and as obviously decorative on inspection.
 */
export function CertificateMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 300"
      className={className}
      role="presentation"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="0.5"
        y="0.5"
        width="239"
        height="299"
        rx="4"
        className="fill-card stroke-border"
      />
      {/* Guilloche-ish inner frame: two hairlines, the security-print gesture
          every certificate has, without imitating any real document. */}
      <rect x="12" y="12" width="216" height="276" rx="2" className="stroke-border" />
      <rect x="17" y="17" width="206" height="266" rx="1" className="stroke-border/60" />

      {/* Abstracted heading */}
      <rect x="60" y="44" width="120" height="7" rx="3.5" className="fill-primary" />
      <rect x="84" y="59" width="72" height="4" rx="2" className="fill-muted-foreground/40" />

      {/* Abstracted body lines */}
      {[92, 106, 120, 134, 148].map((y, i) => (
        <rect
          key={y}
          x={40 + (i % 2) * 6}
          y={y}
          width={160 - (i % 3) * 26}
          height="3"
          rx="1.5"
          className="fill-muted-foreground/25"
        />
      ))}

      {/* Seal: the product's own mark, embossed rather than official */}
      <circle cx="120" cy="205" r="30" className="fill-accent/10 stroke-accent/50" />
      <circle cx="120" cy="205" r="23" className="stroke-accent/30" />
      <path d="M120 191 L133 213 H107 Z" className="fill-accent" />

      {/* Signature rules */}
      <rect x="40" y="256" width="64" height="2" rx="1" className="fill-muted-foreground/35" />
      <rect x="136" y="256" width="64" height="2" rx="1" className="fill-muted-foreground/35" />
    </svg>
  )
}
