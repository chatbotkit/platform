import 'dotenv/config'

import { getInternalAssertionHeaders } from '@/lib/header.assertion'
import { log, runScript } from '@/lib/script'

import http from 'http'
import httpProxy from 'http-proxy'
import { isIP } from 'node:net'

/**
 * Run a local reverse proxy with a configured host.
 *
 * Usage:
 * ```bash
 * pnpm script:run-proxy                                    # Start with defaults
 * pnpm script:run-proxy --host localhost --port 9090       # Custom host/port
 * pnpm script:run-proxy --target http://localhost:8080     # Custom target
 * pnpm script:run-proxy --help                             # Show usage
 * ```
 */
runScript({
  name: 'run-proxy',
  description: 'Run a local reverse proxy',
  options: {
    host: {
      type: 'string',
      short: 'h',
      description:
        'Host the app records for requests (default: PROXY_HOST or localhost)',
      required: false,
    },
    port: {
      type: 'string',
      short: 'p',
      description: 'Proxy listen port (default: PROXY_PORT or 9090)',
      required: false,
    },
    target: {
      type: 'string',
      short: 't',
      description:
        'Proxy target URL (default: PROXY_TARGET or http://localhost:8080)',
      required: false,
    },
    frontendHost: {
      type: 'string',
      description:
        'Asserted frontend host (default: PROXY_FRONTEND_HOST or unset)',
      required: false,
    },
  },
  handler: async ({ host, port, target, frontendHost }) => {
    const resolvedHost = host || process.env.PROXY_HOST || 'localhost'

    const resolvedFrontendHost =
      frontendHost || process.env.PROXY_FRONTEND_HOST || ''

    const resolvedPort = Number(port || process.env.PROXY_PORT || 9090)

    // @note the browser reaches the proxy on its port, so that is the host
    // the app must record - a bare hostname would have it build links to
    // the default port; the default ports themselves stay implicit
    const withProxyPort = (host) => {
      const normalizedHost = isIP(host) === 6 ? `[${host}]` : host

      return /:\d+$/.test(normalizedHost) || [80, 443].includes(resolvedPort)
        ? normalizedHost
        : `${normalizedHost}:${resolvedPort}`
    }

    const forwardedHost = withProxyPort(resolvedHost)

    // @note the asserted frontend host is reached on the same proxy port, so
    // it carries the port too unless it already names one
    const forwardedFrontendHost =
      resolvedFrontendHost && withProxyPort(resolvedFrontendHost)

    const resolvedTarget =
      target || process.env.PROXY_TARGET || 'http://localhost:8080'

    log(`using host ${forwardedHost}`)
    log(`running proxy on port ${resolvedPort}`)

    log(`proxying to target ${resolvedTarget}`)

    if (forwardedFrontendHost) {
      log(`asserting frontend host ${forwardedFrontendHost}`)
    }

    const assertionHeaders = getInternalAssertionHeaders({
      frontendHost: forwardedFrontendHost,
    })

    const proxy = httpProxy.createProxyServer({
      timeout: 10 * 60 * 1000, // 10 minutes
      proxyTimeout: 10 * 60 * 1000, // 10 minutes
    })

    // @note the proxy is the trust boundary: an upstream tunnel's
    // x-forwarded-host would displace the portal host once the app trusts
    // proxy headers, so the proxy claims the header rather than passing it on

    const setProxyHeaders = (proxyReq) => {
      proxyReq.setHeader('Host', forwardedHost)
      proxyReq.setHeader('x-forwarded-host', forwardedHost)

      for (const [name, value] of Object.entries(assertionHeaders)) {
        proxyReq.setHeader(name, value)
      }
    }

    proxy.on('proxyReq', (proxyReq, _req, _res, _options) => {
      setProxyHeaders(proxyReq)
    })

    proxy.on('proxyReqWs', (proxyReq, _req, _socket, _options, _head) => {
      setProxyHeaders(proxyReq)
    })

    // @note host selects the simulated partner or app upstream; relative
    // redirects back to that authority retain the browser's origin even when
    // a tunnel rewrites the incoming host, scheme or port
    proxy.on('proxyRes', (proxyRes) => {
      const rewriteRedirect = (location) => {
        if (!/^(https?:)?\/\//i.test(location)) {
          return location
        }

        try {
          const url = new URL(location, `http://${forwardedHost}`)

          if (
            !['http:', 'https:'].includes(url.protocol) ||
            url.username ||
            url.password ||
            url.host !== new URL(`${url.protocol}//${forwardedHost}`).host
          ) {
            return location
          }

          // @note a leading double slash would become another authority when
          // resolved by the browser; a dot segment keeps it in the URL path
          const pathname = url.pathname.startsWith('//')
            ? `/.${url.pathname}`
            : url.pathname

          return `${pathname}${url.search}${url.hash}`
        } catch {
          return location
        }
      }

      for (const name of ['location', 'x-nextjs-redirect']) {
        if (proxyRes.headers[name]) {
          proxyRes.headers[name] = rewriteRedirect(proxyRes.headers[name])
        }
      }

      if (proxyRes.headers['x-action-redirect']) {
        proxyRes.headers['x-action-redirect'] = proxyRes.headers[
          'x-action-redirect'
        ].replace(/^(.*);(push|replace)$/, (_, location, mode) => {
          return `${rewriteRedirect(location)};${mode}`
        })
      }

      if (proxyRes.headers.refresh) {
        proxyRes.headers.refresh = proxyRes.headers.refresh.replace(
          /^(\s*\d+\s*;\s*url=)(.*)$/i,
          (_, prefix, location) => prefix + rewriteRedirect(location)
        )
      }
    })

    proxy.on('error', (err, _req, res) => {
      log(`proxy error: ${err.message}`)

      if (res && typeof res.writeHead === 'function') {
        res.writeHead(502, {
          'Content-Type': 'text/plain',
        })

        res.end('Bad gateway')
      } else if (res && typeof res.destroy === 'function') {
        // @note upgrade failures hand back the raw socket
        res.destroy()
      }
    })

    const server = http.createServer((req, res) => {
      log(`${req.method} ${req.url}`)

      proxy.web(req, res, { target: resolvedTarget })
    })

    // @note upgrade events fire on the http server, not the proxy - handling
    // them there is what carries WebSockets (HMR, the dev flight debug
    // channel) across; without it Next 16 dev pages never finish hydrating
    server.on('upgrade', (req, socket, head) => {
      log(`UPGRADE ${req.url}`)

      proxy.ws(req, socket, head, { target: resolvedTarget })
    })

    server.listen(resolvedPort)
  },
})
