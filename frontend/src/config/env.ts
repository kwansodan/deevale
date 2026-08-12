/**
 * Backend URLs, resolved once and baked into the bundle at build time.
 *
 * There is deliberately NO localhost fallback in a production build. A bundle
 * shipped without VITE_API_BASE_URL would silently call the visitor's own
 * machine — the confusing "cannot reach the API / cannot sign up" failure.
 * In dev we keep the localhost default for convenience; in a production build a
 * missing value throws a clear, actionable error the moment the app loads,
 * rather than failing mysteriously on every request.
 */
function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configured) {
    // Must be absolute. Without a scheme, axios treats the value as a path on
    // the current origin, so "api.deevalegh.com" becomes
    // https://<frontend>/api.deevalegh.com/... and every request 404/405s.
    if (!/^https?:\/\//i.test(configured)) {
      throw new Error(
        `VITE_API_BASE_URL must start with http:// or https:// — got "${configured}". ` +
          "Use the full URL, e.g. https://api.deevalegh.com, then redeploy.",
      )
    }
    return configured
  }
  if (import.meta.env.DEV) return "http://localhost:5000"
  throw new Error(
    "VITE_API_BASE_URL is not set. Set it to the backend URL " +
      "(e.g. https://api.deevalegh.com) in the Vercel project environment and " +
      "redeploy — the value is baked in at build time, so a redeploy is required.",
  )
}

export const API_BASE_URL = resolveApiBaseUrl()

/**
 * The realtime socket host. Defaults to the API host, since they are usually
 * the same origin; set VITE_SOCKET_URL only when the socket lives elsewhere.
 */
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL?.trim() || API_BASE_URL
