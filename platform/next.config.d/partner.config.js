/* eslint-disable import/no-anonymous-default-export, import/extensions */
// @ts-check
import partnersConfig from '@chatbotkit-dev/partners'
import { APEXES } from '../config/apexes.js'
import { escapeRegex } from '../lib/nextjs.config.rewrites.js'

/**
 * Select the partner based on the subdomain and rewrite the URL to the
 * partner's signin page.
 */

/**
 * Define the conditions for matching partner hostnames.
 *
 * @type {Array<{ type: 'host'; value: string }> | null}
 */
// @note apex-derived partner hosts exist only when PARTNERS_APEX is set;
// partners with a custom domain keep their own rules
const has = APEXES.partners
  ? [
      {
        type: /** @type {'host'} */ ('host'),
        value: `(?<slug>.+?).${escapeRegex(APEXES.partners)}`,
      },
    ]
  : null

/**
 * Extract the subset of partners that have a custom domain configured.
 * Used to generate per-host rewrites and redirects below.
 *
 * @type {Array<{ slug: string; domain: string }>}
 */
const customDomainEntries = Object.entries(partnersConfig).reduce(
  (result, [slug, partner]) => {
    if (typeof partner.domain === 'string') {
      result.push({ slug, domain: partner.domain })
    }

    return result
  },
  /** @type {Array<{ slug: string; domain: string }>} */ ([])
)

function encodeBranding(partner) {
  const branding = {
    name: partner.name,
    logo: partner.logo,
    icon: partner.icon,
    whitelabel: !!partner.whitelabel,
    experience: partner.experience,
  }

  // @note base64 keeps the JSON safe inside the Server-Timing desc token
  return Buffer.from(JSON.stringify(branding), 'utf8').toString('base64')
}

/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    return {
      beforeFiles: [
        ...(has
          ? [
              {
                source: '/signin',
                has: has,
                destination: '/partner/signin/:slug',
              },
              {
                source: '/signin/:path*',
                has: has,
                destination: '/partner/signin/:slug/:path*',
              },
            ]
          : []),

        ...customDomainEntries.map(({ slug, domain }) => ({
          source: '/signin',
          has: [
            {
              type: /** @type {'host'} */ ('host'),
              value: domain,
            },
          ],
          destination: `/partner/signin/${slug}`,
        })),

        ...customDomainEntries.map(({ slug, domain }) => ({
          source: '/signin/:path*',
          has: [
            {
              type: /** @type {'host'} */ ('host'),
              value: domain,
            },
          ],
          destination: `/partner/signin/${slug}/:path*`,
        })),
      ],

      afterFiles: [],

      fallback: [],
    }
  },

  async headers() {
    // @note server-timing headers are added but they do not have effect in the
    // vercel environment at all - it is a known issue

    return [
      ...(APEXES.partners
        ? Object.entries(partnersConfig).map(([slug, partner]) => ({
            source: '/:path*',
            has: [
              {
                type: /** @type {'host'} */ ('host'),
                value: `${slug}.${APEXES.partners}`,
              },
            ],
            headers: [
              {
                key: 'Server-Timing',
                value: `partner;desc="${encodeBranding(partner)}"`,
              },
            ],
          }))
        : []),

      ...customDomainEntries.map(({ slug, domain }) => ({
        source: '/:path*',
        has: [
          {
            type: /** @type {'host'} */ ('host'),
            value: domain,
          },
        ],
        headers: [
          {
            key: 'Server-Timing',
            value: `partner;desc="${encodeBranding(partnersConfig[slug])}"`,
          },
        ],
      })),
    ]
  },

  async redirects() {
    return [
      ...(has
        ? [
            {
              source: '/',
              has: has,
              destination: '/overview',
              permanent: false,
            },
          ]
        : []),

      ...customDomainEntries.map(({ domain }) => ({
        source: '/',
        has: [
          {
            type: /** @type {'host'} */ ('host'),
            value: domain,
          },
        ],
        destination: '/overview',
        permanent: false,
      })),
    ]
  },
}
