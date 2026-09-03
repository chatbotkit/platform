/* eslint-disable import/no-anonymous-default-export */
// @ts-check

// @note when NEXT_OUTPUT_MODE=standalone, Next.js generates a standalone
// folder with all dependencies bundled for Docker deployment. This enables
// horizontal scaling without Vercel. Do not enable this for Vercel deployments.

const outputMode = process.env.NEXT_OUTPUT_MODE || undefined

/** @type {import('next').NextConfig} */
export default {
  // Enable standalone output for Docker deployments
  // @see https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
  ...(outputMode === 'standalone' && {
    output: 'standalone',
  }),

  // Some files are included in the Next tracing which is incorrect and the
  // files are huge, so we are excluding them to make sure we don't hit the
  // size limit for our lambda functions.

  outputFileTracingExcludes: {
    '*': [
      './**/node_modules/@swc/core-linux-x64-gnu',
      './**/node_modules/@swc/core-linux-x64-musl',
      './**/node_modules/esbuild/linux',
      './**/node_modules/webpack',
      './**/node_modules/rollup',
      './**/node_modules/terser',
    ],
  },
}
