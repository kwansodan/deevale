import { useEffect } from "react"

export interface SEOProps {
  title: string
  description: string
  canonicalUrl?: string
  keywords?: string
  ogType?: "website" | "article"
  ogImage?: string
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>
}

function setOrCreateMeta(nameOrProperty: string, content: string, isProperty = false) {
  const attr = isProperty ? "property" : "name"
  let el = document.querySelector(`meta[${attr}="${nameOrProperty}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute(attr, nameOrProperty)
    document.head.appendChild(el)
  }
  el.content = content
}

function setOrCreateLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement("link")
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

export function SEO({
  title,
  description,
  canonicalUrl,
  keywords,
  ogType = "website",
  ogImage = "https://deevalegh.com/deevalegh-icon.svg",
  jsonLd,
}: SEOProps) {
  const fullTitle = title.includes("Deevale GH") ? title : `${title} | Deevale GH`
  const currentUrl = canonicalUrl || window.location.href.split("?")[0].split("#")[0]

  useEffect(() => {
    // 1. Document title
    document.title = fullTitle

    // 2. Standard Meta Tags
    setOrCreateMeta("description", description)
    if (keywords) {
      setOrCreateMeta("keywords", keywords)
    }
    setOrCreateLink("canonical", currentUrl)

    // 3. OpenGraph Tags
    setOrCreateMeta("og:title", fullTitle, true)
    setOrCreateMeta("og:description", description, true)
    setOrCreateMeta("og:url", currentUrl, true)
    setOrCreateMeta("og:type", ogType, true)
    setOrCreateMeta("og:image", ogImage, true)
    setOrCreateMeta("og:site_name", "Deevale GH", true)

    // 4. Twitter Tags
    setOrCreateMeta("twitter:card", "summary_large_image")
    setOrCreateMeta("twitter:title", fullTitle)
    setOrCreateMeta("twitter:description", description)
    setOrCreateMeta("twitter:image", ogImage)

    // 5. JSON-LD Structured Data
    const scriptId = "dynamic-json-ld"
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null
    if (jsonLd) {
      if (!scriptEl) {
        scriptEl = document.createElement("script")
        scriptEl.id = scriptId
        scriptEl.type = "application/ld+json"
        document.head.appendChild(scriptEl)
      }
      scriptEl.textContent = JSON.stringify(jsonLd)
    } else if (scriptEl) {
      scriptEl.remove()
    }

    return () => {
      // Optional cleanup on unmount if needed
    }
  }, [fullTitle, description, currentUrl, keywords, ogType, ogImage, jsonLd])

  return null
}
