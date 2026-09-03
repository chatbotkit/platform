/* eslint-disable import/no-anonymous-default-export */
// @ts-check

// @note these sections already have matching /llms pages that serve the
// markdown variant of their HTML content. Sections owned by the zone
// application (guides, tutorials) are NOT listed - it serves their markdown
// twins itself, and these rules run before the zone rules would.
const llmsSections = ['manuals', 'docs'].join('|')

// @note the Accept header pattern that triggers markdown responses from our /llms pages. This is intentionally broad to cover any agent that prefers
// markdown in general, not just our specific markdown-based API docs format.
const llmsAcceptHeaderPattern = '.*text/markdown.*'

// @note exclude route names that already mean something special under these
// sections so only real content slugs rewrite to /llms.
const llmsSlugPattern = '(?!index|llms|rss\\.xml|sitemap\\.xml|topics).+'

/** @type {import('next').NextConfig & { index: number }} */
export default {
  index: 0,

  async rewrites() {
    return {
      beforeFiles: [
        // @note the homepage does not have a dedicated /llms twin yet, so for
        // markdown-preferring agents we fall back to the site-wide llms.txt.
        {
          source: '/',
          has: [
            {
              type: 'header',
              key: 'accept',
              value: llmsAcceptHeaderPattern,
            },
          ],
          destination: '/llms.txt',
        },
        // @note explicit .md aliases for clients that request the markdown
        // twin directly by URL rather than through Accept negotiation.
        {
          source: `/:section(${llmsSections})/index.md`,
          destination: '/:section/llms',
        },
        {
          source: `/:section(${llmsSections})/:slug(${llmsSlugPattern}).md`,
          destination: '/:section/:slug/llms',
        },
        // @note content negotiation path: when an agent asks for markdown on
        // an HTML page URL, rewrite to the existing /llms page for that route.
        {
          source: `/:section(${llmsSections})`,
          has: [
            {
              type: 'header',
              key: 'accept',
              value: llmsAcceptHeaderPattern,
            },
          ],
          destination: '/:section/llms',
        },
        {
          source: `/:section(${llmsSections})/:slug(${llmsSlugPattern})`,
          has: [
            {
              type: 'header',
              key: 'accept',
              value: llmsAcceptHeaderPattern,
            },
          ],
          destination: '/:section/:slug/llms',
        },
      ],

      afterFiles: [],

      fallback: [],
    }
  },

  async headers() {
    return [
      {
        source: '/',
        headers: [
          {
            // @note the homepage can now resolve to either its normal HTML
            // flow or llms.txt for markdown-preferring agents.
            key: 'Vary',
            value: 'Accept',
          },
        ],
      },
      {
        source: `/:section(${llmsSections})`,
        headers: [
          {
            // @note these routes can return either HTML or Markdown depending
            // on the request Accept header, so caches must vary by Accept to
            // avoid serving a Markdown response to browsers or HTML to agents.
            key: 'Vary',
            value: 'Accept',
          },
        ],
      },
      {
        source: `/:section(${llmsSections})/:path*`,
        headers: [
          {
            // @note same cache-safety rule as above for slug pages rewritten
            // to their /llms twins when Accept: text/markdown is requested.
            key: 'Vary',
            value: 'Accept',
          },
        ],
      },
    ]
  },
}
