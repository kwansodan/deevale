import { useMemo, useState } from "react"
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const DEFAULT_COUNTRY: CountryCode = "GH"

function renderCountry(c: Country) {
  return (
    <SelectItem key={c.code} value={c.code}>
      <span>
        {c.name} <span className="text-muted-foreground tabular-nums">+{c.dial}</span>{" "}
        {flagOf(c.code)}
      </span>
    </SelectItem>
  )
}

/** 🇬🇭 from "GH" — regional indicator letters, no flag asset needed. */
function flagOf(code: string): string {
  return String.fromCodePoint(
    ...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - "A".charCodeAt(0))
  )
}

type Country = { code: CountryCode; name: string; dial: string }

/**
 * Pinned to the top of the list. Base UI's Select has no typeahead or search,
 * so without this a UK founder scrolls past ~230 entries. Ghana plus the
 * countries the diaspora and inbound investors actually dial from covers the
 * overwhelming majority of signups.
 */
const COMMON: CountryCode[] = ["GH", "NG", "GB", "US", "CA", "ZA", "DE", "NL", "CN", "IN", "AE"]

function buildCountries(): { common: Country[]; rest: Country[] } {
  // Intl.DisplayNames is built into every browser we support, so country names
  // cost nothing in bundle size.
  const names = new Intl.DisplayNames(["en"], { type: "region" })
  const all: Country[] = getCountries()
    .map((code) => ({
      code,
      name: names.of(code) ?? code,
      dial: String(getCountryCallingCode(code)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const byCode = new Map<CountryCode, Country>(all.map((c) => [c.code, c]))
  const common = COMMON.map((code) => byCode.get(code)).filter(
    (c): c is Country => c !== undefined
  )
  return { common, rest: all.filter((c) => !COMMON.includes(c.code)) }
}

/**
 * A country selector plus a national-number input that together emit a single
 * E.164 string, which is what the API and the database store.
 *
 * The emitted value is E.164 as soon as the number parses; before that it is a
 * best-effort "+<dial><digits>" so the form's own validator can show an error
 * rather than the field silently swallowing input.
 */
export function PhoneField({
  value,
  onChange,
  onBlur,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  ariaLabel?: string
}) {
  const { common, rest } = useMemo(buildCountries, [])

  // Seeded from the incoming value once; thereafter this component owns the
  // split, and the parent only ever sees the combined E.164 string.
  const [country, setCountry] = useState<CountryCode>(() => {
    const parsed = value ? parsePhoneNumberFromString(value) : undefined
    return parsed?.country ?? DEFAULT_COUNTRY
  })
  const [national, setNational] = useState(() => {
    const parsed = value ? parsePhoneNumberFromString(value) : undefined
    return parsed?.nationalNumber ?? ""
  })

  function emit(nextCountry: CountryCode, nextNational: string) {
    const digits = nextNational.replace(/\D/g, "")
    if (!digits) {
      onChange("")
      return
    }
    const parsed = parsePhoneNumberFromString(digits, nextCountry)
    onChange(parsed ? parsed.number : `+${getCountryCallingCode(nextCountry)}${digits}`)
  }

  return (
    <div className="flex gap-2">
      <Select
        value={country}
        onValueChange={(next) => {
          const code = next as CountryCode
          setCountry(code)
          emit(code, national)
        }}
      >
        <SelectTrigger className="h-9 w-[7.5rem] shrink-0" aria-label="Country code">
          <SelectValue>
            <span className="tabular-nums">
              {flagOf(country)} +{getCountryCallingCode(country)}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectGroup>
            <SelectLabel>Common</SelectLabel>
            {common.map(renderCountry)}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>All countries</SelectLabel>
            {rest.map(renderCountry)}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={national}
        onBlur={onBlur}
        onChange={(e) => {
          setNational(e.target.value)
          emit(country, e.target.value)
        }}
      />
    </div>
  )
}
