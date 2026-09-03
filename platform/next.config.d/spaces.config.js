/* eslint-disable import/extensions, import/no-anonymous-default-export */
// @ts-check
import { APEXES } from '../config/apexes.js'
import {
  buildCaptureAllSource,
  escapeRegex,
} from '../lib/nextjs.config.rewrites.js'

// @note SpaceSite static-website hosting. A `<slug>.<space apex>` host is
// rewritten to the public serving route, which resolves the SpaceSite by its
// slug and serves the backing space's storage. This is
// the SpaceSite analogue of portals.config.js (which maps portal hosts to
// `/apps`). Unlike portals there is no launcher at the root, so the bare `/`
// also routes to the serving handler (which serves the directory index).
//
// The destination `system` is a literal segment under `/api/v1/space`, so it
// takes precedence over the `[spaceId]` management routes (which only ever see
// real space ids).
// @note rules exist only when the deployment names a space apex - without
// one there are no space-site hosts to serve
const has = APEXES.space
  ? [
      {
        type: /** @type {'host'} */ ('host'),
        value: `(?<slug>.+?).${escapeRegex(APEXES.space)}`,
      },
    ]
  : null

/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    if (!has) {
      return { beforeFiles: [], afterFiles: [], fallback: [] }
    }

    return {
      beforeFiles: [
        {
          source: buildCaptureAllSource({
            // @note empty so any file extension is served from the space
            allowedExtensions: [],

            excludes: ['redirect'],
          }),
          has,
          destination: '/api/v1/space/system/site/:path*',
        },
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
