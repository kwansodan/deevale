import { Component, type ErrorInfo, type ReactNode } from "react"

import { Button } from "@/components/ui/button"

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * A stale service worker can leave the page referencing JS chunks that 404 after
 * a redeploy; the failed dynamic import throws inside Suspense and, with no
 * boundary, React unmounts the whole tree and the user gets a blank white screen
 * (this is what made /app/notifications appear to "break"). This boundary catches
 * any render error so the app degrades to a readable card instead of a blank
 * page, and for the chunk-load case it reloads once to pick up the fresh bundle.
 */
const CHUNK_ERROR = /Loading chunk|dynamically imported module|Importing a module script failed/i
const RELOAD_FLAG = "deevalegh.chunk-reloaded"

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // On a chunk-load failure, reload once to fetch the current bundle. The
    // sessionStorage flag stops an infinite reload loop if it is a real error.
    if (CHUNK_ERROR.test(error.message) && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, "1")
      window.location.reload()
      return
    }
    console.error("Uncaught render error:", error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    if (CHUNK_ERROR.test(this.state.error.message)) {
      // Reload already triggered; render nothing to avoid a flash of the card.
      return null
    }
    return (
      <div className="bg-background flex min-h-svh items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="font-heading text-lg font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            This page hit an unexpected error. Reloading usually fixes it.
          </p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    )
  }
}
