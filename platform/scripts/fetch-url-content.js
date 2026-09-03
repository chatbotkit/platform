// @ts-check
import 'dotenv/config'

import { html2text } from '@chatbotkit-dev/file-html/parse'

import fetch from '@/lib/fetch'
import { log, print, runScript } from '@/lib/script'

/**
 * Fetches a URL and extracts its text content using the file-html utility.
 *
 * This script is useful for extracting readable text content from web pages
 * for content analysis and competitor monitoring.
 *
 * Usage:
 * ```bash
 * pnpm script:fetch-url-content --url https://example.com/blog/post
 * pnpm script:fetch-url-content --url https://example.com/blog/post --selectors "article,.post-content"
 * pnpm script:fetch-url-content --url https://example.com/blog/post --json
 * ```
 */
runScript({
  name: 'fetch-url-content',
  description: 'Fetch a URL and extract its text content',
  options: {
    url: {
      type: 'string',
      short: 'u',
      description: 'URL to fetch and extract content from',
      message: 'What URL should be fetched?',
      required: true,
    },
    selectors: {
      type: 'string',
      short: 's',
      description:
        'CSS selectors to extract content from (comma-separated, e.g., "article,main,.content")',
      message: 'What CSS selectors should be used? (leave empty for default)',
      required: false,
    },
    json: {
      type: 'boolean',
      short: 'j',
      description: 'Output results as JSON',
      default: false,
    },
  },
  handler: async ({ url, selectors, json }) => {
    log(`Fetching URL: ${url}`)

    // Fetch the page

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          `Mozilla/5.0 (compatible; ChatBotKit/1.0; +${process.env.SITE_URL || 'https://chatbotkit.com'})`,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      throw new Error(
        `Failed to fetch URL: ${response.status} ${response.statusText}`
      )
    }

    const html = await response.text()

    log(`Fetched ${html.length} bytes of HTML`)

    // Extract title from HTML

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)

    const title = titleMatch ? titleMatch[1].trim() : ''

    // Extract meta description

    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i
    )

    const description = descMatch ? descMatch[1].trim() : ''

    // Convert HTML to text using file-html utility

    const selectorList = selectors
      ? selectors.split(',').map((s) => s.trim())
      : undefined

    const text = html2text(html, {
      url,
      selectors: selectorList,
    })

    log(`Extracted ${text.length} characters of text`)

    // Output results

    if (json) {
      print(
        JSON.stringify(
          {
            url,
            title,
            description,
            textLength: text.length,
            text,
          },
          null,
          2
        )
      )
    } else {
      if (title) {
        print(`# ${title}\n`)
      }

      if (description) {
        print(`> ${description}\n`)
      }

      print(text)
    }
  },
})
