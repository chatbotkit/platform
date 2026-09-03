/* eslint-disable import/no-anonymous-default-export */
// @ts-check

/** @type {import('next').NextConfig} */
export default {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Document-Policy',
            value: 'js-profiling',
          },
        ],
      },
    ]
  },
}
