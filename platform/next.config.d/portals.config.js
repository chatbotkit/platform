/* eslint-disable import/extensions, import/no-anonymous-default-export */
// @ts-check
import { buildCaptureAllSource } from '../lib/nextjs.config.rewrites.js'

/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    // @note proxy.ts replaces this marker on every request using the runtime
    // PORTAL_APEX; no deployment hostname is captured in the build
    const has = [
      {
        type: /** @type {'header'} */ ('header'),
        key: 'x-cbk-portal',
        value: '1',
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
          has,
          destination: '/apps/:path*',
        },
        // @note localized roots need an explicit match after the catch-all;
        // putting it first would let the catch-all prefix /apps a second time
        {
          source: '/',
          has,
          destination: '/apps',
        },
      ],

      afterFiles: [],

      fallback: [
        {
          source: '/:path*',
          has,
          destination: '/apps/404',
        },
      ],
    }
  },
}
