/* eslint-disable import/no-anonymous-default-export */
// @ts-check
import { ok } from 'assert'

ok(process.env.SITE_URL, 'site url not set')

// @note this application emits a plain, self-contained sitemap: its own
// rendered pages plus the paths and dynamic section sitemaps below. On
// deployments fronted by a zone application (see next.config.d/zone.config.js)
// the zone may overlay /sitemap.xml with a domain-wide index of its own; the
// generated chunk files (/sitemap-0.xml) and the section sitemaps stay
// reachable for such an index to reference.

export const additionalPaths = [
  // @todo make these dynamic

  '/llms.txt',

  '/bots',
  '/datasets',
  '/skillsets',
  '/integrations',

  '/hub',
  '/hub/blueprints',
  '/hub/blueprints/latest',
  '/hub/bots',
  '/hub/bots/latest',
  '/hub/datasets',
  '/hub/datasets/latest',
  '/hub/skillsets',
  '/hub/skillsets/latest',
  '/hub/widgets',
  '/hub/widgets/latest',

  '/apps',
  '/apps/chat',
  '/apps/inbox',
  '/apps/usage',
]

export const additionalSitemaps = [
  // @todo make these dynamic

  '/examples/sitemap.xml',
  '/connections/sitemap.xml',
  // hub

  '/hub/blueprints/latest/sitemap.xml',
  '/hub/bots/latest/sitemap.xml',
  '/hub/datasets/latest/sitemap.xml',
  '/hub/skillsets/latest/sitemap.xml',
  '/hub/widgets/latest/sitemap.xml',

  // platform

  '/platform/models/sitemap.xml',
]

export const exclude = [
  // @todo make these dynamic

  // next

  '/_next/*',

  // api

  '/api/v1/*',

  // landing

  '/landing',
  '/landing/*',

  // ui

  '/changelog/bar',

  // admin

  '/admin',
  '/admin/*',

  // experiments

  '/experiments/*',

  // dashboard

  '/signin',
  '/signin/verify',
  '/redirect',
  '/welcome',
  '/new',
  '/new/*',
  '/overview',
  '/billing',
  '/billing/*',
  '/usage',

  // utility

  '/**/404',
  '/**/500',

  // auxiliary, non-canonical views - marked noindex via X-Robots-Tag in
  // next.config.d/seo.config.js; keep them out of the sitemap too

  '/card',
  '/**/card',
  '/**/designer',

  // other

  // sitemaps

  ...additionalSitemaps.map((sitemap) => {
    return sitemap.replace('/sitemap.xml', '/*')
  }),
]

/** @type {import('next-sitemap').IConfig} */
export default {
  siteUrl: process.env.SITE_URL,

  generateRobotsTxt: true,
  generateIndexSitemap: true,

  sitemapSize: 10000,

  exclude: exclude,

  additionalPaths() {
    return additionalPaths.map((loc) => {
      return {
        loc: loc,
      }
    })
  },

  robotsTxtOptions: {
    transformRobotsTxt: async (_config, robotsTxt) => {
      return robotsTxt.replace(
        'Allow: /',
        `Allow: /\nContent-Signal: ai-train=no, search=yes, ai-input=yes`
      )
    },
    additionalSitemaps: additionalSitemaps.map((sitemap) => {
      return new URL(sitemap, process.env.SITE_URL).toString()
    }),
  },
}
