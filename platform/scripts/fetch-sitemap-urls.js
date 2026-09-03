// @ts-check
import 'dotenv/config'

import fetch from '@/lib/fetch'
import { log, print, runScript } from '@/lib/script'

import { minimatch } from 'minimatch'

/**
 * @typedef {Object} SitemapEntry
 * @property {string} url - The URL from the sitemap
 * @property {string} [lastmod] - The last modified date from the sitemap
 */

/**
 * Parse sitemap XML and extract URL entries with their lastmod dates.
 *
 * @param {string} xml - The sitemap XML content
 * @returns {SitemapEntry[]}
 */
function parseSitemap(xml) {
  const entries = []

  // Match each <url> block

  const urlBlockRegex = /<url>([\s\S]*?)<\/url>/g

  let blockMatch

  // eslint-disable-next-line no-cond-assign
  while ((blockMatch = urlBlockRegex.exec(xml)) !== null) {
    const block = blockMatch[1]

    // Extract <loc>

    const locMatch = block.match(/<loc>([^<]+)<\/loc>/)

    if (!locMatch) {
      continue
    }

    const url = locMatch[1].trim()

    // Extract <lastmod> if present

    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/)

    const lastmod = lastmodMatch ? lastmodMatch[1].trim() : undefined

    entries.push({ url, lastmod })
  }

  return entries
}

/**
 * Extract title from HTML content.
 *
 * @param {string} html - The HTML content to parse
 * @returns {string}
 */
function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)

  return titleMatch ? titleMatch[1].trim() : ''
}

/**
 * Fetch title for a URL.
 *
 * @param {SitemapEntry} entry - The sitemap entry
 * @returns {Promise<SitemapEntry & { title: string }>}
 */
async function fetchUrlTitle(entry) {
  try {
    const response = await fetch(entry.url, {
      headers: {
        'User-Agent':
          `Mozilla/5.0 (compatible; ChatBotKit/1.0; +${process.env.SITE_URL || 'https://chatbotkit.com'})`,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      return { ...entry, title: '' }
    }

    const html = await response.text()

    const title = extractTitle(html)

    return { ...entry, title }
  } catch {
    return { ...entry, title: '' }
  }
}

/**
 * Fetches URLs from a sitemap.xml and filters them by a glob pattern.
 * Includes lastmod dates from the sitemap and optionally fetches page titles.
 *
 * This script is useful for extracting specific URLs from competitor sitemaps
 * for content analysis and monitoring purposes.
 *
 * Usage:
 * ```bash
 * pnpm script:fetch-sitemap-urls --sitemap https://example.com/sitemap.xml --glob "glob-pattern"
 * pnpm script:fetch-sitemap-urls --sitemap https://example.com/sitemap.xml --glob "glob-pattern" --title
 * pnpm script:fetch-sitemap-urls --sitemap https://example.com/sitemap.xml --glob "glob-pattern" --json
 * ```
 */
runScript({
  name: 'fetch-sitemap-urls',
  description: 'Fetch URLs from a sitemap.xml and filter by glob pattern',
  options: {
    sitemap: {
      type: 'string',
      short: 's',
      description: 'URL of the sitemap.xml to fetch',
      message: 'What is the sitemap URL?',
      required: true,
    },
    glob: {
      type: 'string',
      short: 'g',
      description: 'Glob pattern to filter URLs (e.g., "**/blog/**")',
      message: 'What glob pattern should be used to filter URLs?',
      required: true,
    },
    title: {
      type: 'boolean',
      short: 't',
      description: 'Fetch page titles for each URL (slower)',
      default: false,
    },
    json: {
      type: 'boolean',
      short: 'j',
      description: 'Output results as JSON',
      default: false,
    },
    limit: {
      type: 'string',
      short: 'l',
      description: 'Maximum number of URLs to return',
    },
  },
  handler: async ({ sitemap, glob, title: fetchTitles, json, limit }) => {
    log(`Fetching sitemap: ${sitemap}`)

    // Fetch the sitemap

    const response = await fetch(sitemap)

    if (!response.ok) {
      throw new Error(
        `Failed to fetch sitemap: ${response.status} ${response.statusText}`
      )
    }

    const xml = await response.text()

    // Parse URLs and lastmod dates from sitemap XML

    const entries = parseSitemap(xml)

    log(`Found ${entries.length} total URLs in sitemap`)

    // Filter entries by glob pattern

    let matchedEntries = entries.filter((entry) => {
      try {
        const urlObj = new URL(entry.url)

        // Match against full URL or just pathname

        return minimatch(entry.url, glob) || minimatch(urlObj.pathname, glob)
      } catch {
        return false
      }
    })

    log(`Matched ${matchedEntries.length} URLs with pattern: ${glob}`)

    // Sort by date (newest first)

    matchedEntries.sort((a, b) => {
      if (!a.lastmod && !b.lastmod) {
        return 0
      }

      if (!a.lastmod) {
        return 1
      }

      if (!b.lastmod) {
        return -1
      }

      return new Date(b.lastmod).getTime() - new Date(a.lastmod).getTime()
    })

    // Apply limit if specified (before fetching titles for efficiency)

    if (limit) {
      const limitNum = parseInt(limit, 10)

      if (limitNum > 0) {
        matchedEntries = matchedEntries.slice(0, limitNum)

        log(`Limited to ${matchedEntries.length} URLs`)
      }
    }

    // Fetch titles if requested

    /** @type {Array<SitemapEntry & { title?: string }>} */
    let results

    if (fetchTitles) {
      log(`Fetching titles for ${matchedEntries.length} URLs...`)

      results = []

      // Fetch in batches to avoid overwhelming the server

      const batchSize = 5

      for (let i = 0; i < matchedEntries.length; i += batchSize) {
        const batch = matchedEntries.slice(i, i + batchSize)

        const batchResults = await Promise.all(batch.map(fetchUrlTitle))

        results.push(...batchResults)

        log(
          `Fetched ${Math.min(i + batchSize, matchedEntries.length)}/${matchedEntries.length}`
        )
      }
    } else {
      results = matchedEntries
    }

    // Output results

    if (json) {
      print(
        JSON.stringify(
          {
            sitemap,
            glob,
            total: entries.length,
            matched: matchedEntries.length,
            urls: results,
          },
          null,
          2
        )
      )
    } else {
      for (const result of results) {
        const dateStr = result.lastmod
          ? new Date(result.lastmod).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : 'No date'

        if (fetchTitles) {
          print(`${dateStr} | ${result.title || 'No title'} | ${result.url}`)
        } else {
          print(`${dateStr} | ${result.url}`)
        }
      }
    }
  },
})
