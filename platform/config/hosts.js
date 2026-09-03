// @ts-check
import { z } from 'zod'

const hostname = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .refine((value) => {
    if (!value || value.includes('*')) {
      return false
    }

    try {
      const url = new URL(`https://${value}`)

      return (
        !url.username &&
        !url.password &&
        url.host === value &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash
      )
    } catch {
      return false
    }
  }, 'Expected a hostname without a protocol, wildcard, path, query, or hash')

export const hostMappingSchema = z
  .object({
    match: z.array(hostname).min(1),
    site: hostname,
    api: hostname,
    static: hostname,
    widgets: hostname,
  })
  .strict()
  .superRefine((mapping, ctx) => {
    const seen = new Set()

    for (const [index, value] of mapping.match.entries()) {
      if (seen.has(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate match hostname: ${value}`,
          path: ['match', index],
        })
      }

      seen.add(value)
    }
  })

/**
 * Optional request-affine host mappings, keyed by an operator-defined name.
 * SITE_URL and the scalar host variables remain the requestless defaults.
 *
 * HOSTS_CONFIG shape:
 *
 *     {
 *       "example": {
 *         "match": ["example.com", "api.example.com"],
 *         "site": "example.com",
 *         "api": "api.example.com",
 *         "static": "static.example.com",
 *         "widgets": "widgets.example.com"
 *       }
 *     }
 *
 * Build-time routing consumes the flattened target lists. Request-context
 * setup selects one mapping when a trusted request or frontend host matches;
 * runtime URL helpers only read that resolved context.
 */
export const hostsSchema = z
  .record(hostMappingSchema)
  .superRefine((mappings, ctx) => {
    const matches = new Map()

    for (const [name, mapping] of Object.entries(mappings)) {
      if (!name.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Expected a non-empty host mapping name',
          path: [name],
        })
      }

      for (const value of mapping.match) {
        const existing = matches.get(value)

        if (existing) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Match hostname ${value} is already used by ${existing}`,
            path: [name, 'match'],
          })
        } else {
          matches.set(value, name)
        }
      }
    }
  })

const config = process.env.HOSTS_CONFIG || ''

export const hostsConfig = hostsSchema.parse(config ? JSON.parse(config) : {})

const mappings = Object.values(hostsConfig)

function unique(values) {
  return [...new Set(values)]
}

export const hosts = Object.freeze({
  match: unique(mappings.flatMap((mapping) => mapping.match)),
  site: unique(mappings.map((mapping) => mapping.site)),
  api: unique(mappings.map((mapping) => mapping.api)),
  static: unique(mappings.map((mapping) => mapping.static)),
  widgets: unique(mappings.map((mapping) => mapping.widgets)),
})
