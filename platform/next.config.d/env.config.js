// @ts-check

/** @type {import('next').NextConfig} */
export default {
  env: {
    // Debug
    ...{
      DEBUG_KEYS: Object.entries(process.env)
        .filter(
          ([key, value]) =>
            key.startsWith('DEBUG_') &&
            value &&
            ['true', 'yes', 'y', '1'].includes(value.toLowerCase())
        )
        .map(([key]) => key.replace('DEBUG_', '').trim())
        .join(','),

      ERROR_KEYS: Object.entries(process.env)
        .filter(
          ([key, value]) =>
            key.startsWith('ERROR_') &&
            value &&
            ['true', 'yes', 'y', '1'].includes(value.toLowerCase())
        )
        .map(([key]) => key.replace('ERROR_', '').trim())
        .join(','),

      WARN_KEYS: Object.entries(process.env)
        .filter(
          ([key, value]) =>
            key.startsWith('WARN_') &&
            value &&
            ['true', 'yes', 'y', '1'].includes(value.toLowerCase())
        )
        .map(([key]) => key.replace('WARN_', '').trim())
        .join(','),
    },

    // Target
    ...{
      TARGET_ENV: process.env.TARGET_ENV || '',
    },

    // Experience
    ...{
      // @note hostnames that serve the builder experience (exact or
      // `*.example.com` wildcards, comma separated) - empty means every host
      // serves the platform experience (see lib/experience.ts)
      EXPERIENCE_BUILDER_HOSTS: process.env.EXPERIENCE_BUILDER_HOSTS || '',
    },
  },
}
