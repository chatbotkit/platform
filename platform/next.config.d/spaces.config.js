/* eslint-disable import/extensions, import/no-anonymous-default-export */
// @ts-check
import { buildCaptureAllSource } from '../lib/nextjs.config.rewrites.js'

/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    // @note proxy.ts replaces this marker on every request using the runtime
    // SPACE_APEX; no deployment hostname is captured in the build
    const has = [
      {
        type: /** @type {'header'} */ ('header'),
        key: 'x-cbk-space-site',
        value: '1',
      },
    ]

    return {
      beforeFiles: [
        {
          source: buildCaptureAllSource({
            // @note all file extensions belong to the space's public storage
            allowedExtensions: [],
            excludes: ['redirect'],
          }),
          has,
          destination: '/api/v1/space/system/site/:path*',
        },
        // @note an explicit root also matches when Next prefixes the source
        // with a locale; the capture-all requires a slash after that locale
        {
          source: '/',
          has,
          destination: '/api/v1/space/system/site',
        },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}
