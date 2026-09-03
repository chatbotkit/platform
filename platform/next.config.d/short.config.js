/* eslint-disable import/no-anonymous-default-export */
// @ts-check

// @note short links are minted on the deployment's own host as `/s/<id>`
// (see lib/short.ts) - there is no dedicated short-link host

/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/s/:path*',
          destination: '/api/short/:path*/redirect',
        },
      ],

      afterFiles: [],

      fallback: [],
    }
  },
}
