/* eslint-disable import/extensions, import/no-anonymous-default-export */
// @ts-check
import {
  DEFAULT_SECURITY_HEADERS,
  EMBEDDABLE_PATHS,
  EMBEDDABLE_SECURITY_HEADERS,
  EXCLUDE_HOSTS,
  EXCLUDE_PATHS,
  REPORT_URI,
} from '../lib/security.headers.js'

/**
 * Convert security headers config to header array format for Next.js
 *
 * @param {import('../lib/security.headers').SecurityHeadersConfig} config
 * @returns {Array<{ key: string, value: string}>}
 */
function configToHeaders(config) {
  let headers = []

  if (config.xFrameOptions) {
    headers.push({ key: 'X-Frame-Options', value: config.xFrameOptions })
  }

  if (config.contentSecurityPolicy) {
    let cspValue = config.contentSecurityPolicy

    if (REPORT_URI) {
      cspValue += `; report-uri ${REPORT_URI}`
    }

    headers.push({
      key: 'Content-Security-Policy',
      value: cspValue,
    })
  }

  if (config.xContentTypeOptions) {
    headers.push({
      key: 'X-Content-Type-Options',
      value: config.xContentTypeOptions,
    })
  }

  if (config.referrerPolicy) {
    headers.push({ key: 'Referrer-Policy', value: config.referrerPolicy })
  }

  if (config.permissionsPolicy) {
    headers.push({ key: 'Permissions-Policy', value: config.permissionsPolicy })
  }

  if (config.strictTransportSecurity) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: config.strictTransportSecurity,
    })
  }

  if (config.xXssProtection) {
    headers.push({ key: 'X-XSS-Protection', value: config.xXssProtection })
  }

  if (config.crossOriginEmbedderPolicy) {
    headers.push({
      key: 'Cross-Origin-Embedder-Policy',
      value: config.crossOriginEmbedderPolicy,
    })
  }

  if (config.crossOriginOpenerPolicy) {
    headers.push({
      key: 'Cross-Origin-Opener-Policy',
      value: config.crossOriginOpenerPolicy,
    })
  }

  if (config.crossOriginResourcePolicy) {
    headers.push({
      key: 'Cross-Origin-Resource-Policy',
      value: config.crossOriginResourcePolicy,
    })
  }

  // Filter out any empty values
  {
    headers = headers.filter(
      (header) => header.value && header.value.length > 0
    )
  }

  return headers
}

/** @type {import('next').NextConfig} */
export default {
  async headers() {
    const headers = []

    // Build dynamic regex patterns

    const embeddablePathPattern = EMBEDDABLE_PATHS.map((path) =>
      path.replace(/^\//, '')
    ).join('|')

    const excludePathPattern = EXCLUDE_PATHS.map((path) =>
      path.replace(/^\//, '')
    ).join('|')

    const excludeHostPattern = EXCLUDE_HOSTS.map((host) => `(${host})`).join(
      '|'
    )

    // Add security headers for default routes
    {
      const configHeaders = configToHeaders(DEFAULT_SECURITY_HEADERS)

      if (configHeaders.length > 0) {
        headers.push({
          source: `/:path((?!${embeddablePathPattern}|${excludePathPattern}).*)`,
          has: [
            {
              type: /** @type {'host'} */ ('host'),
              value: `(?!${excludeHostPattern}).*`,
            },
          ],
          headers: configHeaders,
        })
      }
    }

    // Add security headers for embeddable routes
    {
      const configHeaders = configToHeaders(EMBEDDABLE_SECURITY_HEADERS)

      if (configHeaders.length > 0) {
        headers.push({
          source: `/:path(${embeddablePathPattern})`,
          has: [
            {
              type: /** @type {'host'} */ ('host'),
              value: `(?!${excludeHostPattern}).*`,
            },
          ],
          headers: configHeaders,
        })
      }
    }

    return headers
  },
}
