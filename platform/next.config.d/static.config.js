/* eslint-disable import/extensions */
// @ts-check
import { buildCaptureAllSource } from '../lib/nextjs.config.rewrites.js'

// @note the proxy selects static hosts at startup from STATIC_URL and
// HOSTS_CONFIG; path restrictions and exclusions remain in this config
const has = [
  {
    type: /** @type {'header'} */ ('header'),
    key: 'x-cbk-static',
    value: '1',
  },
]

/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/',
          has,
          destination: '/404.txt',
        },
        {
          source: buildCaptureAllSource({
            excludes: [
              // @note we want to whitelist integrations

              'integrations\\/widget',
            ],
          }),
          has,
          destination: `/404.txt`,
        },
      ],

      afterFiles: [],

      fallback: [
        {
          source: '/',
          has,
          destination: '/404.txt',
        },
      ],
    }
  },
}
