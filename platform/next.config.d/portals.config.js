/* eslint-disable import/extensions, import/no-anonymous-default-export */
// @ts-check
import {
  buildCaptureAllSource,
  escapeRegex,
} from '../lib/nextjs.config.rewrites.js'
import { APEXES } from '../config/apexes.js'

/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    // @note rules exist only when the deployment names a portal apex -
    // custom portal domains are routed by their own host handling
    if (!APEXES.portal) {
      return { beforeFiles: [], afterFiles: [], fallback: [] }
    }

    const has = [
      {
        type: /** @type {'host'} */ ('host'),
        value: `(?<slug>.+?).${escapeRegex(APEXES.portal)}`,
      },
    ]

    return {
      beforeFiles: [
        // @note portal catch-all route
        {
          source: buildCaptureAllSource({
            allowedExtensions: [
              // @note replace the default allowed extensions to allow any app
              // to serve their own files
            ],

            excludes: [
              // @note we want to whitelist common pages

              'redirect',

              // @note portals can also serve secret callbacks

              'secrets\\/oauth\\/callback',
              'secrets\\/.+?\\/manager\\/authenticate',
              'secrets\\/.+?\\/manager\\/oauth\\/callback',

              // @note portals can also serve widget embeds

              'integrations\\/widget\\/v\\d\\.js',
              'integrations\\/widget\\/.+?\\/frame',
              'integrations\\/widget\\/.+?\\/test',

              // @note portals can also serve mcpserver embeds

              'integrations\\/mcpserver\\/v\\d\\.js',
              'integrations\\/mcpserver\\/.+?\\/frame',
              'integrations\\/mcpserver\\/.+?\\/test',
            ],

            doNotProxy: {
              oauth: true,
            },
          }),
          has: has,
          destination: '/apps/:path*',
        },
      ],

      afterFiles: [],

      fallback: [
        // 404

        ...[
          // the portal apex hosts

          ...[
            {
              source: '/:path*',
              has: has,
              destination: `/apps/404`,
            },
          ],
        ],
      ],
    }
  },
}
