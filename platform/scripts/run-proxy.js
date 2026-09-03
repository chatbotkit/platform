import 'dotenv/config'

import { getInternalAssertionHeaders } from '@/lib/header.assertion'
import { log, runScript } from '@/lib/script'

import http from 'http'
import httpProxy from 'http-proxy'

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
        'Host header and bind host (default: PROXY_HOST or localhost)',
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

    const resolvedTarget =
      target || process.env.PROXY_TARGET || 'http://localhost:8080'

    log(`using host ${resolvedHost}`)
    log(`running proxy on port ${resolvedPort}`)

    log(`proxying to target ${resolvedTarget}`)

    if (resolvedFrontendHost) {
      log(`asserting frontend host ${resolvedFrontendHost}`)
    }

    const assertionHeaders = getInternalAssertionHeaders({
      frontendHost: resolvedFrontendHost,
    })

    const proxy = httpProxy.createProxyServer({
      timeout: 10 * 60 * 1000, // 10 minutes
      proxyTimeout: 10 * 60 * 1000, // 10 minutes
    })

    // @note the proxy is the trust boundary: an upstream tunnel's
    // x-forwarded-host would displace the portal host once the app trusts
    // proxy headers, so the proxy claims the header rather than passing it on

    const setProxyHeaders = (proxyReq) => {
      proxyReq.setHeader('Host', resolvedHost)
      proxyReq.setHeader('x-forwarded-host', resolvedHost)

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
