/* eslint-disable import/no-anonymous-default-export */
// @ts-check

/** @type {import('next').NextConfig} */
export default {
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb', // @note load this from a constant so that the value can be used

      // @note deployed hosts need no exceptions when gateways preserve the
      // browser Origin and public forwarded host; deployment domains must not
      // automatically grant cross-origin access to actions
      allowedOrigins:
        process.env.NODE_ENV === 'development'
          ? [...Array(10)].flatMap((_, i) => [
              // @note the local proxy deliberately impersonates a platform
              // host while the browser stays on its localhost listen port
              `localhost:808${i}`,
              `localhost:909${i}`,
            ])
          : [],
    },
  },
}
