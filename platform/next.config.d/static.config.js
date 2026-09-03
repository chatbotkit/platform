/* eslint-disable import/extensions */
// @ts-check
import { hosts } from '../config/hosts.js'
import { siteHostname, staticHostname } from '../config/site.js'
import {
  buildCaptureAllSource,
  buildHostPattern,
} from '../lib/nextjs.config.rewrites.js'

// @note every configured static target is routed unconditionally; runtime
// application logic decides which target belongs to the current request.
// A static host that is also a site host - STATIC_URL left at its site URL
// default, or a single-domain HOSTS_CONFIG mapping - derives no routing, as
// the capture-all below would otherwise swallow the site itself.

const siteHostnames = new Set([siteHostname, ...hosts.site])

const staticHostnames = [...new Set([...hosts.static, staticHostname])].filter(
  (hostname) => !siteHostnames.has(hostname)
)

const staticHostPattern = buildHostPattern(staticHostnames, 'host')

const forStaticHost = (rules) => (staticHostPattern ? rules : [])

/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    return {
      beforeFiles: forStaticHost([
        {
          source: '/',
          has: [
            {
              type: /** @type {'host'} */ ('host'),
              value: staticHostPattern,
            },
          ],
          destination: '/404.txt',
        },
        {
          source: buildCaptureAllSource({
            excludes: [
              // @note we want to whitelist integrations

              'integrations\\/widget',
            ],
          }),
          has: [
            {
              type: /** @type {'host'} */ ('host'),
              value: staticHostPattern,
            },
          ],
          destination: `/404.txt`,
        },
      ]),

      afterFiles: [],

      fallback: forStaticHost([
        {
          source: '/',
          has: [
            {
              type: /** @type {'host'} */ ('host'),
              value: staticHostPattern,
            },
          ],
          destination: '/404.txt',
        },
      ]),
    }
  },
}
