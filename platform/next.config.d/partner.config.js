/* eslint-disable import/no-anonymous-default-export */
// @ts-check

// @note the proxy selects partner hosts at runtime and replaces this marker;
// the config owns sign-in paths while branding and root redirects run in proxy
const has = [
  {
    type: /** @type {'header'} */ ('header'),
    key: 'x-cbk-partner',
    value: '(?<slug>.+)',
  },
]

/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/signin',
          has,
          destination: '/partner/signin/:slug',
        },
        {
          source: '/signin/:path*',
          has,
          destination: '/partner/signin/:slug/:path*',
        },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}
