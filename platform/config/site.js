// @ts-check
import { z } from 'zod'

// @note the server asserts its runtime environment strictly. The browser
// bundle carries no environment, so the document origin is the seed and the
// useHostname hooks overlay the request values from the data-* attributes.

// @note the deployment URLs are origins - a provided value that carries a
// path, query, or hash still validates as a URL but is normalised to its
// origin, with a warning rather than a silent trim.
/** @param {string} name */
const origin = (name) =>
  z
    .string()
    .url()
    .transform((value) => {
      const { origin } = new URL(value)

      if (value !== origin) {
        // eslint-disable-next-line no-console
        console.warn(
          `[config/site] ${name} is not a bare origin - using ${origin}`
        )
      }

      return origin
    })

const env =
  typeof window === 'undefined'
    ? z
        .object({
          SITE_URL: origin('SITE_URL'),
          STATIC_URL: origin('STATIC_URL').optional().or(z.literal('')),
          WIDGET_URL: origin('WIDGET_URL').optional().or(z.literal('')),
          API_URL: origin('API_URL').optional().or(z.literal('')),
        })
        .parse({
          SITE_URL: process.env.SITE_URL,
          STATIC_URL: process.env.STATIC_URL,
          WIDGET_URL: process.env.WIDGET_URL,
          API_URL: process.env.API_URL,
        })
    : {
        SITE_URL: process.env.SITE_URL || window.location.origin,
        STATIC_URL: process.env.STATIC_URL,
        WIDGET_URL: process.env.WIDGET_URL,
        API_URL: process.env.API_URL,
      }

export const siteUrl = env.SITE_URL

export const siteHostname = new URL(siteUrl).hostname

// @note the origin embed snippets and widget frames are served from. The
// hosted deployment fronts these through a dedicated static host
// (STATIC_URL=https://static.chatbotkit.com); any other deployment serves
// the same paths from its own origin, so the site URL is the fallback.

export const staticUrl = env.STATIC_URL || siteUrl

export const staticHostname = new URL(staticUrl).hostname

// @note the origin private MCP widget bundles are served from

export const widgetUrl = env.WIDGET_URL || siteUrl

export const widgetHostname = new URL(widgetUrl).hostname

// @note the origin the external API is advertised on. The site URL is the
// fallback - the API is then served under /api on the site host; a dedicated
// origin (API_URL=https://api.chatbotkit.com) serves it under /v1.

export const apiUrl = env.API_URL || siteUrl

export const apiHostname = new URL(apiUrl).hostname
