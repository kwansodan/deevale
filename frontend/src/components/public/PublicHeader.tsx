import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  Menu,
  Calculator,
  BookOpen,
  Briefcase,
  FileCheck2,
  LogIn,
  ArrowRight,
  PhoneCall,
  Sparkles,
} from "lucide-react"

import { Wordmark } from "@/components/Wordmark"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { CurrencyToggle } from "@/components/landing/CurrencyToggle"
import { type DisplayCurrency } from "@/hooks/useCurrency"
import { cn } from "@/lib/utils"

export interface PublicHeaderProps {
  scrolled?: boolean
  currency?: DisplayCurrency
  onCurrencyChange?: (c: DisplayCurrency) => void
  onQuoteClick?: (e?: React.MouseEvent) => void
}

export function PublicHeader({
  scrolled = false,
  currency,
  onCurrencyChange,
  onQuoteClick,
}: PublicHeaderProps) {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const navLinks = [
    {
      to: "/services/accounting-and-bookkeeping",
      label: "Accounting & Tax",
      icon: Briefcase,
      badge: "Popular",
    },
    {
      to: "/services",
      label: "Services",
      icon: FileCheck2,
    },
    {
      to: "/calculator",
      label: "Fee Calculator",
      icon: Calculator,
    },
    {
      to: "/guides",
      label: "Statutory Guides",
      icon: BookOpen,
    },
  ]

  const handleQuoteClick = (e?: React.MouseEvent) => {
    setOpen(false)
    if (onQuoteClick) {
      onQuoteClick(e)
    }
  }

  return (
    <header
      className={cn(
        "border-border bg-background/90 sticky top-0 z-30 border-b backdrop-blur transition-shadow",
        scrolled && "shadow-card"
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="focus-visible:ring-ring shrink-0 rounded focus-visible:outline-none focus-visible:ring-2">
          <Wordmark size="md" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-3 lg:flex" aria-label="Main Navigation">
          <Link
            to="/services/accounting-and-bookkeeping"
            className={cn(
              "text-muted-foreground hover:text-foreground text-sm font-medium transition-colors",
              location.pathname.startsWith("/services/accounting") && "text-foreground font-semibold"
            )}
          >
            Accounting &amp; Tax
          </Link>
          <Link
            to="/services"
            className={cn(
              "text-muted-foreground hover:text-foreground text-sm font-medium transition-colors",
              location.pathname === "/services" && "text-foreground font-semibold"
            )}
          >
            Services
          </Link>
          <Link
            to="/calculator"
            className={cn(
              "text-muted-foreground hover:text-foreground text-sm font-medium transition-colors",
              location.pathname === "/calculator" && "text-foreground font-semibold"
            )}
          >
            Fee Calculator
          </Link>
          <Link
            to="/guides"
            className={cn(
              "text-muted-foreground hover:text-foreground text-sm font-medium transition-colors",
              location.pathname.startsWith("/guides") && "text-foreground font-semibold"
            )}
          >
            Statutory Guides
          </Link>

          {currency && onCurrencyChange && (
            <div className="ml-1">
              <CurrencyToggle currency={currency} onChange={onCurrencyChange} />
            </div>
          )}

          <div className="ml-2 flex items-center gap-2">
            <Button
              render={<Link to="/login">Log in</Link>}
              nativeButton={false}
              variant="ghost"
              size="sm"
            />
            {onQuoteClick ? (
              <Button
                onClick={onQuoteClick}
                size="sm"
                className="bg-accent text-accent-foreground hover:bg-accent-300 font-semibold"
              >
                Free Quote
              </Button>
            ) : (
              <Button
                render={<Link to="/quote">Free Quote</Link>}
                nativeButton={false}
                size="sm"
                className="bg-accent text-accent-foreground hover:bg-accent-300 font-semibold"
              />
            )}
            <Button
              render={<Link to="/signup">Get started</Link>}
              nativeButton={false}
              size="sm"
            />
          </div>
        </nav>

        {/* Medium screens (tablet, between 768px and 1024px) */}
        <div className="hidden sm:flex lg:hidden items-center gap-2">
          {currency && onCurrencyChange && (
            <CurrencyToggle currency={currency} onChange={onCurrencyChange} />
          )}
          <Button
            render={<Link to="/login">Log in</Link>}
            nativeButton={false}
            variant="ghost"
            size="sm"
          />
          {onQuoteClick ? (
            <Button
              onClick={onQuoteClick}
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent-300 text-xs font-semibold"
            >
              Free Quote
            </Button>
          ) : (
            <Button
              render={<Link to="/quote">Free Quote</Link>}
              nativeButton={false}
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent-300 text-xs font-semibold"
            />
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <button
                  type="button"
                  className="hover:bg-muted text-muted-foreground hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-md border border-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open menu"
                >
                  <Menu className="size-5" />
                </button>
              }
            />
            <SheetContent side="right" className="w-[85vw] max-w-sm p-0 flex flex-col justify-between">
              <div>
                <SheetHeader className="border-border border-b p-4 text-left">
                  <SheetTitle>
                    <Wordmark size="sm" />
                  </SheetTitle>
                </SheetHeader>
                <div className="p-4 space-y-1">
                  {navLinks.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname.startsWith(item.to)
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                          isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="size-4 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && !isActive && (
                          <span className="bg-accent/20 text-accent-700 dark:text-accent-300 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div className="border-border border-t p-4 space-y-3 bg-muted/30">
                <div className="grid gap-2">
                  {onQuoteClick ? (
                    <Button
                      onClick={handleQuoteClick}
                      className="w-full bg-accent text-accent-foreground hover:bg-accent-300 font-semibold min-h-[44px]"
                    >
                      <Sparkles className="size-4 mr-2" /> Free Instant Quote
                    </Button>
                  ) : (
                    <Button
                      render={<Link to="/quote">Free Instant Quote</Link>}
                      onClick={() => setOpen(false)}
                      nativeButton={false}
                      className="w-full bg-accent text-accent-foreground hover:bg-accent-300 font-semibold min-h-[44px]"
                    />
                  )}
                  <Button
                    render={<Link to="/signup">Get Started</Link>}
                    onClick={() => setOpen(false)}
                    nativeButton={false}
                    className="w-full min-h-[44px]"
                  >
                    Start Business Registration <ArrowRight className="size-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Mobile Navigation (< 640px) */}
        <div className="flex sm:hidden items-center gap-2">
          {onQuoteClick ? (
            <Button
              onClick={onQuoteClick}
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent-300 px-2.5 text-xs font-semibold h-8"
            >
              Quote
            </Button>
          ) : (
            <Button
              render={<Link to="/quote">Quote</Link>}
              nativeButton={false}
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent-300 px-2.5 text-xs font-semibold h-8"
            />
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <button
                  type="button"
                  className="hover:bg-muted text-muted-foreground hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-md border border-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open navigation menu"
                >
                  <Menu className="size-5" />
                </button>
              }
            />
            <SheetContent side="right" className="w-[85vw] max-w-sm p-0 flex flex-col justify-between">
              <div>
                <SheetHeader className="border-border border-b p-4 text-left">
                  <SheetTitle>
                    <Wordmark size="sm" />
                  </SheetTitle>
                </SheetHeader>

                <div className="p-4 space-y-1">
                  {currency && onCurrencyChange && (
                    <div className="mb-3 flex items-center justify-between px-3 py-2 bg-muted/40 rounded-lg">
                      <span className="text-xs font-medium text-muted-foreground">Display currency:</span>
                      <CurrencyToggle currency={currency} onChange={onCurrencyChange} />
                    </div>
                  )}

                  {navLinks.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname.startsWith(item.to)
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                          isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="size-4 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && !isActive && (
                          <span className="bg-accent/20 text-accent-700 dark:text-accent-300 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}

                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors min-h-[44px]"
                  >
                    <LogIn className="size-4 shrink-0 text-muted-foreground" />
                    <span>Client Portal Login</span>
                  </Link>
                </div>
              </div>

              <div className="border-border border-t p-4 space-y-3 bg-muted/30">
                <div className="grid gap-2">
                  {onQuoteClick ? (
                    <Button
                      onClick={handleQuoteClick}
                      className="w-full bg-accent text-accent-foreground hover:bg-accent-300 font-semibold min-h-[44px]"
                    >
                      <Sparkles className="size-4 mr-2" /> Free Instant Quote
                    </Button>
                  ) : (
                    <Button
                      render={<Link to="/quote">Free Instant Quote</Link>}
                      onClick={() => setOpen(false)}
                      nativeButton={false}
                      className="w-full bg-accent text-accent-foreground hover:bg-accent-300 font-semibold min-h-[44px]"
                    />
                  )}
                  <Button
                    render={<Link to="/signup">Get Started</Link>}
                    onClick={() => setOpen(false)}
                    nativeButton={false}
                    className="w-full min-h-[44px]"
                  >
                    Start Business Registration <ArrowRight className="size-4 ml-1.5" />
                  </Button>
                </div>

                <div className="pt-2 text-center">
                  <a
                    href="tel:+233543164478"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <PhoneCall className="size-3.5" /> +233 54 316 4478
                  </a>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
