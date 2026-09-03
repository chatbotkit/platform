/**
 * Utility function used only in the sitemap integration sync function to
 * determine if HTML spidering should be skipped.
 */
export function shouldSkipHTML(selectors?: null | string | string[]): boolean {
  return !!selectors?.includes('@skiphtml')
}

/**
 * Utility function used only in the sitemap integration sync function to
 * determine if JSON-LD spidering should be skipped.
 */
export function shouldSkipJSONLD(
  selectors?: null | string | string[]
): boolean {
  return !selectors?.includes('@jsonld')
}

/**
 * Utility function used only in sitemap integration sync function to
 * determine if Microdata spidering should be skipped.
 */
export function shouldSkipMicrodata(
  selectors?: null | string | string[]
): boolean {
  return !selectors?.includes('@microdata')
}

/**
 * Utility function to determine if sitemap spidering should be skipped
 */
export function shouldSkipSitemap(
  selectors?: null | string | string[]
): boolean {
  return !!selectors?.includes('@skipsitemap')
}

/**
 * Utility function to determine if crawling should be skipped
 */
export function shouldSkipCrawl(selectors?: null | string | string[]): boolean {
  return !!selectors?.includes('@skipcrawl')
}
