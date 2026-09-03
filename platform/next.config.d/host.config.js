/* eslint-disable import/no-anonymous-default-export */
// @ts-check

/** @type {import('next').NextConfig} */
export default {
  async headers() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: '(?<host>.+?)',
          },
        ],
        headers: [
          {
            key: 'set-cookie',
            value: 'chatbotkit.host=:host; Path=/; Secure; SameSite=Lax',
          },
        ],
      },
    ]
  },
}
