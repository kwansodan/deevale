import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { getExchangeRates } from "@/api/public"

export type DisplayCurrency = "GHS" | "USD"

const STORAGE_KEY = "deevalegh.currency"

/**
 * Guesses the visitor's display currency from their country: GHS for visitors in
 * Ghana, USD for everyone else. Uses a free, no-key IP lookup and fails safe to
 * GHS (the home market). Client-side so it needs no backend IP handling.
 */
async function detectCurrency(): Promise<DisplayCurrency> {
  try {
    const res = await fetch("https://ipwho.is/?fields=country_code", {
      signal: AbortSignal.timeout(4000),
    })
    const json = (await res.json()) as { country_code?: string }
    return json?.country_code === "GH" ? "GHS" : "USD"
  } catch {
    return "GHS"
  }
}

function formatAmount(amount: number, currency: DisplayCurrency): string {
  const rounded = Math.round(amount)
  const grouped = rounded.toLocaleString("en-US")
  return currency === "USD" ? `$${grouped}` : `GHS ${grouped}`
}

/**
 * Currency display for the public landing page. Prices are entered by the admin
 * in a base currency; this converts them to GHS or USD for the visitor. Real
 * billing is unaffected (always GHS via Paystack) -- this is indicative only.
 */
export function useCurrency() {
  const stored = (localStorage.getItem(STORAGE_KEY) as DisplayCurrency | null) ?? null
  const [currency, setCurrencyState] = useState<DisplayCurrency>(stored ?? "GHS")
  // Only auto-detect if the visitor hasn't chosen (persisted) a currency.
  const [resolved, setResolved] = useState<boolean>(stored !== null)

  useEffect(() => {
    if (resolved) return
    let active = true
    detectCurrency().then((c) => {
      if (active) {
        setCurrencyState(c)
        setResolved(true)
      }
    })
    return () => {
      active = false
    }
  }, [resolved])

  const setCurrency = (c: DisplayCurrency) => {
    localStorage.setItem(STORAGE_KEY, c)
    setCurrencyState(c)
    setResolved(true)
  }

  const { data: ratesData } = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: getExchangeRates,
    staleTime: 60 * 60 * 1000,
  })

  /** Convert a numeric amount in `from` (the admin's base currency) to the
   *  visitor's display currency, formatted. Degrades to the base amount if rates
   *  aren't available. */
  const convert = (amount: number, from: string): string => {
    const rates = ratesData?.rates
    if (from === currency) return formatAmount(amount, currency)
    if (!rates || !rates[from] || !rates[currency]) {
      // No usable rate -> show in the base currency rather than a wrong figure.
      return from === "GHS" || from === "USD"
        ? formatAmount(amount, from as DisplayCurrency)
        : `${from} ${Math.round(amount).toLocaleString("en-US")}`
    }
    const converted = (amount / rates[from]) * rates[currency]
    return formatAmount(converted, currency)
  }

  return { currency, setCurrency, convert }
}
