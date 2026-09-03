// @ts-check

/** @type {import('next').NextConfig} */
export default {
  typescript: {
    ignoreBuildErrors: !!process.env.SKIP_CHECK,
  },
}
