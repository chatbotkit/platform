/* eslint-disable import/no-anonymous-default-export, import/extensions */
// @ts-check
import { APEXES } from '../config/apexes.js'
import { hosts } from '../config/hosts.js'
import { ORIGIN_HOSTS } from '../config/origins.js'

/** @type {import('next').NextConfig} */
export default {
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb', // @note load this from a constant so that the value can be used

      allowedOrigins: [
        // development environment

        ...(process.env.NODE_ENV === 'development'
          ? [...Array(10)].flatMap((_, i) => [
              `localhost:808${i}`,
              `localhost:909${i}`,
            ])
          : []),

        // the deployment's own host and every configured host surface - server
        // actions must be callable from all of them

        ...(process.env.SITE_URL ? [new URL(process.env.SITE_URL).host] : []),

        ...hosts.match,

        ...(ORIGIN_HOSTS.appMain ? [ORIGIN_HOSTS.appMain] : []),
        ...(ORIGIN_HOSTS.appLabs ? [ORIGIN_HOSTS.appLabs] : []),

        ...(APEXES.app ? [`*.${APEXES.app}`] : []),
        ...(APEXES.portal ? [`*.${APEXES.portal}`] : []),
        ...(APEXES.partners ? [`*.${APEXES.partners}`] : []),
        ...(APEXES.space ? [`*.${APEXES.space}`] : []),
      ],
    },
  },
}
