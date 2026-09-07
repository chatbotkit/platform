/** @jest-environment node */
import loadCustomRoutes from 'next/dist/lib/load-custom-routes'

import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const project = process.cwd()
const next = path.join(project, 'node_modules/next/dist/bin/next')

jest.setTimeout(120000)

// @note compile the real routing files into a small Next production app so
// build-time environment capture and framework rewrite behavior are exercised
// without rebuilding the platform or connecting to its database
describe.each(['', '/platform'])(
  'host routing in a production build with base path "%s"',
  (basePath) => {
    let directory
    let server
    let origin
    let standaloneConfig
    let output = ''

    const environment = {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      SPACE_APEX: 'cbk-space.localhost',
      PORTAL_APEX: 'cbk-portal.localhost',
      SITE_URL: 'http://platform.localhost:3000',
      HOSTS_CONFIG: '',
      STATIC_URL: 'http://build.static.example:3000',
      API_URL: 'http://build.api.example:3000',
      SENTRY_HEADERS_REPORT_URI: 'https://build.report.example/csp',
      APP_MAIN_ORIGIN: 'http://cbk-apps.localhost:3000',
      APP_LABS_ORIGIN: 'http://cbk-labs.localhost:3000',
      APP_APEX: 'cbk-app.localhost',
      PARTNERS_APEX: 'cbk-partners.localhost',
      FIXTURE_PARTNER_DOMAIN: 'build.partner.example',
    }

    async function write(file, content) {
      const target = path.join(directory, file)

      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, content)
    }

    async function start(
      apex = 'space.localhost',
      portalApex = 'portal.localhost',
      appConfiguration = {
        APP_APEX: 'app.localhost',
        APP_MAIN_ORIGIN: 'http://apps.localhost:3000',
        APP_LABS_ORIGIN: 'http://labs.localhost:3000',
      },
      partnerConfiguration = {
        PARTNERS_APEX: 'partners.localhost',
        FIXTURE_PARTNER_DOMAIN: 'partner.example',
      },
      hostConfiguration = {
        STATIC_URL: 'http://static.localhost:3000',
        HOSTS_CONFIG: '',
      }
    ) {
      const socket = createServer()

      socket.listen(0, '127.0.0.1')
      await once(socket, 'listening')

      const port = socket.address().port

      await new Promise((resolve) => socket.close(resolve))

      origin = `http://127.0.0.1:${port}`
      output = ''
      server = spawn(
        process.execPath,
        [next, 'start', '-H', '127.0.0.1', '-p', String(port)],
        {
          cwd: directory,
          env: {
            ...environment,
            SPACE_APEX: apex,
            PORTAL_APEX: portalApex,
            ...appConfiguration,
            ...partnerConfiguration,
            API_URL: 'http://api.localhost:3000',
            SENTRY_HEADERS_REPORT_URI: '',
            ...hostConfiguration,
            // @note use the same serialized configuration as Next's generated
            // standalone launcher; next start otherwise reloads next.config
            __NEXT_PRIVATE_STANDALONE_CONFIG: standaloneConfig,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      )
      server.stdout.on('data', (chunk) => {
        output += chunk
      })
      server.stderr.on('data', (chunk) => {
        output += chunk
      })

      for (let attempt = 0; attempt < 200; attempt++) {
        if (server.exitCode !== null) {
          throw new Error(`Next exited before startup: ${output}`)
        }

        try {
          const response = await request('127.0.0.1', '/api/health')

          if (response.ok) {
            return
          }
        } catch {
          // @note wait for the production server's listening socket
        }

        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      throw new Error(`Next did not start: ${output}`)
    }

    async function stop() {
      if (server && server.exitCode === null) {
        const exited = once(server, 'exit')

        server.kill('SIGTERM')
        await exited
      }

      server = undefined
    }

    function request(host, pathname = '/', init = {}) {
      // @note Node fetch replaces Host with the URL host; use HTTP directly to
      // exercise virtual hosts while connecting to the fixture's loopback socket
      return new Promise((resolve, reject) => {
        const req = httpRequest(
          `${origin}${basePath}${basePath && pathname === '/' ? '' : pathname}`,
          {
            ...init,
            headers: { host, ...init.headers },
          },
          (response) => {
            const chunks = []

            response.on('data', (chunk) => chunks.push(chunk))
            response.on('error', reject)
            response.on('end', () => {
              const headers = new Headers()

              for (const [name, value] of Object.entries(response.headers)) {
                for (const entry of [].concat(value || [])) {
                  headers.append(name, entry)
                }
              }

              resolve(
                new Response(
                  init.method === 'HEAD' ? null : Buffer.concat(chunks),
                  {
                    status: response.statusCode,
                    headers,
                  }
                )
              )
            })
          }
        )

        req.on('error', reject)
        req.end(init.body)
      })
    }

    beforeAll(async () => {
      directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cbk-host-routing-'))
      // @note supply a fixture partner catalogue through the public package
      // boundary without changing the workspace's installed catalogue
      await fs.mkdir(path.join(directory, 'node_modules/@chatbotkit-dev'), {
        recursive: true,
      })

      for (const name of await fs.readdir(path.join(project, 'node_modules'))) {
        if (name !== '@chatbotkit-dev') {
          await fs.symlink(
            path.join(project, 'node_modules', name),
            path.join(directory, 'node_modules', name)
          )
        }
      }

      for (const name of await fs.readdir(
        path.join(project, 'node_modules/@chatbotkit-dev')
      )) {
        if (name !== 'partners') {
          await fs.symlink(
            path.join(project, 'node_modules/@chatbotkit-dev', name),
            path.join(directory, 'node_modules/@chatbotkit-dev', name)
          )
        }
      }

      await write(
        'node_modules/@chatbotkit-dev/partners/package.json',
        JSON.stringify({
          name: '@chatbotkit-dev/partners',
          type: 'module',
          exports: './index.js',
        })
      )
      await write(
        'node_modules/@chatbotkit-dev/partners/index.js',
        `export default {
        acme: {
          id: 'partner-account', name: 'Acme Studio', logo: '/acme.svg',
          icon: '/acme.png', whitelabel: true, experience: 'builder',
          domain: process.env.FIXTURE_PARTNER_DOMAIN,
          auth: { allowGlobalLogin: true }, email: { send() {} },
        },
        plain: { id: 'plain-account', name: 'Plain Partner' },
      }`
      )
      await write(
        'package.json',
        JSON.stringify({ private: true, type: 'module' })
      )
      await write(
        'tsconfig.json',
        JSON.stringify({
          compilerOptions: {
            paths: { '@/*': ['./*'] },
            esModuleInterop: true,
            allowJs: true,
          },
        })
      )

      // @note build the actual runtime proxy and its configuration
      for (const file of [
        'proxy.ts',
        'config/apexes.js',
        'config/apps.ts',
        'config/site.js',
        'config/hosts.js',
        'config/origins.js',
        'config/debug.ts',
        'lib/portal.hostname.ts',
        'lib/context.store.js',
        'lib/debug.ts',
        'lib/redact.secrets.ts',
        'lib/space.site.ts',
        'lib/response.js',
        'lib/error.js',
        'lib/json.ts',
        'lib/struct.ts',
        'lib/nextjs.config.rewrites.js',
        'lib/security.headers.js',
        'next.config.d/portals.config.js',
        'next.config.d/apps.config.js',
        'next.config.d/partner.config.js',
        'next.config.d/actions.config.js',
        'next.config.d/spaces.config.js',
        'next.config.d/static.config.js',
        'next.config.d/api.config.js',
        'next.config.d/oauth.config.js',
        'next.config.d/proxy.config.js',
        'next.config.d/transpile.config.js',
      ]) {
        await write(file, await fs.readFile(path.join(project, file), 'utf8'))
      }

      await write(
        'next.config.mjs',
        `
      import spaces from './next.config.d/spaces.config.js'
      import transpile from './next.config.d/transpile.config.js'
      import portals from './next.config.d/portals.config.js'
      import actions from './next.config.d/actions.config.js'
      import apps from './next.config.d/apps.config.js'
      import partners from './next.config.d/partner.config.js'
      import staticConfig from './next.config.d/static.config.js'
      import apiConfig from './next.config.d/api.config.js'
      import oauthConfig from './next.config.d/oauth.config.js'
      import proxyConfig from './next.config.d/proxy.config.js'
      export default { ...transpile, ...proxyConfig, env: apps.env,
        headers: apiConfig.headers,
        experimental: { ...actions.experimental, cpus: 1 },
        basePath: ${JSON.stringify(basePath)},
        i18n: ${
          basePath
            ? "{ locales: ['en', 'fr'], defaultLocale: 'en' }"
            : 'undefined'
        },
        async rewrites() {
          const portalRules = await portals.rewrites()
          const spaceRules = await spaces.rewrites()
          const appRules = await apps.rewrites()
          const partnerRules = await partners.rewrites()
          const staticRules = await staticConfig.rewrites()
          const apiRules = await apiConfig.rewrites()
          const oauthRules = await oauthConfig.rewrites()
          return {
            beforeFiles: [...apiRules.beforeFiles, ...appRules.beforeFiles, ...partnerRules.beforeFiles, ...portalRules.beforeFiles, ...spaceRules.beforeFiles, ...staticRules.beforeFiles],
            afterFiles: [...appRules.afterFiles, ...oauthRules.afterFiles, ...portalRules.afterFiles, ...spaceRules.afterFiles],
            fallback: [...apiRules.fallback, ...appRules.fallback, ...portalRules.fallback, ...spaceRules.fallback, ...staticRules.fallback],
          }
        },
        typescript: { ignoreBuildErrors: true } }
    `
      )
      await write(
        'pages/index.js',
        `
      export default function Index() { return null }
      export function getServerSideProps() {
        return { redirect: { destination: '/signin?callbackUrl=%2Foverview', permanent: false } }
      }
    `
      )
      await write(
        'pages/api/health.js',
        'export default function handler(req, res) { res.json({ ok: true }) }'
      )
      await write(
        'pages/api/v1/probe.js',
        `export default function handler(req, res) {
          if (req.method === 'OPTIONS') { res.status(200).end(); return }
          res.json({ method: req.method, query: req.query, body: req.body, host: req.headers.host })
        }`
      )

      for (const route of ['index', '404']) {
        await write(
          `pages/api/${route}.js`,
          `export default function handler(req, res) { res.status(404).json({ api: 'not found' }) }`
        )
      }

      for (const route of [
        'oauth/probe',
        '.well-known/api-catalog',
        '.well-known/microsoft-identity-association.json',
      ]) {
        await write(
          `pages/api/${route}.js`,
          `export default function handler(req, res) { res.json({ route: ${JSON.stringify(
            route
          )} }) }`
        )
      }

      for (const route of [
        'apps/index',
        'apps/app.webmanifest',
        'signin',
        'welcome',
        'apps/chat/[[...path]]',
        'apps/oauth/callback',
        'apps/assets/[file]',
        'apps/404',
        'secrets/oauth/callback',
        'secrets/[secretId]/manager/authenticate',
        'secrets/[secretId]/manager/oauth/callback',
        'integrations/widget/v1.js',
        'integrations/widget/[integrationId]/frame',
        'integrations/widget/[integrationId]/test',
        'integrations/mcpserver/v1.js',
        'integrations/mcpserver/[integrationId]/frame',
        'integrations/mcpserver/[integrationId]/test',
        'redirect/target',
        'partner/signin/acme',
        'partner/signin/acme/verify',
        'partner/signin/plain',
      ]) {
        await write(
          `pages/${route}.js`,
          `
        export default function Page() { return null }
        export function getServerSideProps({ req, res, query }) {
          res.setHeader('x-fixture-route', ${JSON.stringify(route)})
          res.setHeader('x-fixture-host', req.headers.host)
          res.setHeader('x-fixture-query', JSON.stringify(query))
          return { props: {} }
        }
        `
        )
      }

      await write(
        'pages/integrations/widget/restricted/frame.js',
        `import { buildOriginRestrictedCsp } from '../../../../lib/security.headers.js'
        export default function Page() { return null }
        export function getServerSideProps({ res }) {
          res.setHeader('Content-Security-Policy', buildOriginRestrictedCsp('https://allowed.example'))
          return { props: {} }
        }`
      )

      // @note stand in only for database/storage access; routing into this
      // handler must happen through the actual compiled proxy or rewrite rules
      await write(
        'pages/api/v1/space/system/site/[[...path]].js',
        `
      export default function handler(req, res) {
        res.setHeader('x-space-site', 'public')
        res.json({ host: req.headers.host, path: req.query.path || [], query: req.query.q })
      }
    `
      )

      await write(
        'app/layout.jsx',
        `
        export default function Layout({ children }) {
          return <html><body>{children}</body></html>
        }
      `
      )
      await write(
        'app/apps/action-probe/actions.js',
        `
        'use server'
        import { appendFile } from 'node:fs/promises'
        import { cookies, headers } from 'next/headers'

        export async function submit(formData) {
          await appendFile('action-results.jsonl', JSON.stringify({
            value: formData.get('value'),
            session: (await cookies()).get('audit-session')?.value,
            host: (await headers()).get('host'),
          }) + '\\n')
        }
      `
      )
      await write(
        'app/apps/action-probe/page.jsx',
        `
        import { submit } from './actions'

        export const dynamic = 'force-dynamic'

        export default function Page() {
          return <form action={submit}><input name="value" /><button>Save</button></form>
        }
      `
      )

      for (const slug of ['chat', 'action-probe']) {
        await write(
          `app/apps/${slug}/app.manifest`,
          JSON.stringify({
            name: slug,
            description: `Fixture app ${slug}`,
            start: `/apps/${slug}`,
          })
        )
      }

      await write('public/favicon.ico', 'fixture favicon')
      await write('public/404.txt', 'fixture static fallback')

      await execute(process.execPath, [next, 'build', '--webpack'], {
        cwd: directory,
        env: environment,
        timeout: 90000,
        maxBuffer: 2 * 1024 * 1024,
      })

      standaloneConfig = JSON.stringify(
        JSON.parse(
          await fs.readFile(
            path.join(directory, '.next/required-server-files.json'),
            'utf8'
          )
        ).config
      )
    })

    afterEach(stop)
    afterAll(async () => {
      await stop()

      if (directory) {
        await fs.rm(directory, { recursive: true, force: true })
      }
    })

    it('does not bake the space domain into the rewrite manifest', async () => {
      const manifest = await fs.readFile(
        path.join(directory, '.next/routes-manifest.json'),
        'utf8'
      )

      const hostConditions = JSON.parse(manifest)
        .rewrites.beforeFiles.filter((rule) =>
          rule.destination.includes('/api/v1/space/system/site')
        )
        .flatMap((rule) => rule.has || [])
        .filter((condition) => condition.type === 'host')

      expect(hostConditions).toEqual([])
    })

    it('serves an anonymous space on the runtime apex instead of redirecting to sign-in', async () => {
      await start()

      const response = await request('test.space.localhost:3000')

      expect(response.status).toBe(200)
      expect(response.headers.get('x-space-site')).toBe('public')
      expect(response.headers.get('location')).toBeNull()
    })

    it('does not retain the space apex from the build', async () => {
      await start()

      const response = await request('test.cbk-space.localhost:3000')

      expect(response.headers.get('x-space-site')).toBeNull()
      expect(response.status).toBe(307)
    })

    it('preserves asset paths, encoded filenames, queries and HEAD requests', async () => {
      await start()

      const response = await request(
        'test.space.localhost:3000',
        '/assets/hello%20world.css?q=one%20two'
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        host: 'test.space.localhost:3000',
        path: ['assets', 'hello world.css'],
        query: 'one two',
      })

      const head = await request('test.space.localhost:3000', '/index.html', {
        method: 'HEAD',
      })

      expect(head.headers.get('x-space-site')).toBe('public')
      expect(await head.text()).toBe('')
    })

    it('leaves API requests and unrelated application hosts on their existing routes', async () => {
      await start()

      const api = await request('test.space.localhost:3000', '/api/health')

      expect(await api.json()).toEqual({ ok: true })

      const app = await request('cbk.localhost:3000')

      expect(app.status).toBe(307)
      expect(app.headers.get('x-space-site')).toBeNull()
    })

    it('supports the hosted space domain with the same build', async () => {
      await start('chatbotkit.space')

      const response = await request('test.chatbotkit.space')

      expect(response.status).toBe(200)
      expect(response.headers.get('x-space-site')).toBe('public')
    })

    it('routes space and portal paths with the configured base path and locales', async () => {
      await start()

      const locale = basePath ? '/fr' : ''
      const space = await request(
        'test.space.localhost:3000',
        `${locale}/docs?q=one`
      )
      const portal = await request(
        'test.portal.localhost:3000',
        `${locale}/chat`
      )

      expect(space.status).toBe(200)
      expect(await space.json()).toEqual({
        host: 'test.space.localhost:3000',
        path: ['docs'],
        query: 'one',
      })
      expect(portal.headers.get('x-fixture-route')).toBe(
        'apps/chat/[[...path]]'
      )
    })

    it('rejects spoofed space markers and prevents cross-routing between spaces and portals', async () => {
      await start()

      const headers = { 'x-cbk-space-site': '1', 'x-cbk-portal': '1' }
      const app = await request('cbk.localhost:3000', '/', { headers })
      const portal = await request('test.portal.localhost:3000', '/', {
        headers,
      })
      const space = await request('test.space.localhost:3000', '/', { headers })
      const excluded = await request(
        'test.space.localhost:3000',
        '/redirect/target',
        { headers }
      )

      expect(app.status).toBe(307)
      expect(app.headers.get('x-space-site')).toBeNull()
      expect(app.headers.get('x-fixture-route')).toBeNull()
      expect(portal.headers.get('x-space-site')).toBeNull()
      expect(portal.headers.get('x-fixture-route')).toBe('apps/index')
      expect(space.headers.get('x-space-site')).toBe('public')
      expect(space.headers.get('x-fixture-route')).toBeNull()
      expect(excluded.headers.get('x-fixture-route')).toBe('redirect/target')
    })

    it('disables space routing when the runtime apex is unset', async () => {
      await start('')

      const response = await request('test.cbk-space.localhost:3000')

      expect(response.status).toBe(307)
      expect(response.headers.get('x-space-site')).toBeNull()
    })

    it('serves a portal on the runtime apex instead of redirecting to platform sign-in', async () => {
      await start()

      const response = await request('test.portal.localhost:3000')

      expect(response.status).toBe(200)
      expect(response.headers.get('x-fixture-route')).toBe('apps/index')
      expect(response.headers.get('x-fixture-host')).toBe(
        'test.portal.localhost:3000'
      )
      expect(response.headers.get('location')).toBeNull()
    })

    it('does not bake the portal domain into the rewrite manifest', async () => {
      const manifest = await fs.readFile(
        path.join(directory, '.next/routes-manifest.json'),
        'utf8'
      )

      const hostConditions = Object.values(JSON.parse(manifest).rewrites)
        .flat()
        .flatMap((rule) => rule.has || [])
        .filter((condition) => condition.type === 'host')

      expect(hostConditions).toEqual([])
    })

    it('preserves portal app paths, OAuth, encoded assets, queries and HEAD', async () => {
      await start()

      for (const [pathname, route] of [
        ['/chat/conversation?q=one%20two', 'apps/chat/[[...path]]'],
        ['/oauth/callback', 'apps/oauth/callback'],
        ['/assets/hello%20world.css?q=one%20two', 'apps/assets/[file]'],
      ]) {
        const response = await request('test.portal.localhost:3000', pathname)

        expect(response.status).toBe(200)
        expect(response.headers.get('x-fixture-route')).toBe(route)
        expect(response.headers.get('x-fixture-host')).toBe(
          'test.portal.localhost:3000'
        )

        if (pathname.includes('?')) {
          expect(JSON.parse(response.headers.get('x-fixture-query')).q).toBe(
            'one two'
          )
        }

        if (pathname.includes('hello')) {
          expect(JSON.parse(response.headers.get('x-fixture-query')).file).toBe(
            'hello world.css'
          )
        }
      }

      const head = await request('test.portal.localhost:3000', '/chat', {
        method: 'HEAD',
      })

      expect(head.headers.get('x-fixture-route')).toBe('apps/chat/[[...path]]')
      expect(await head.text()).toBe('')
    })

    it('keeps existing portal callback, embed, redirect and API routes', async () => {
      await start()

      for (const [pathname, route] of [
        ['/secrets/oauth/callback', 'secrets/oauth/callback'],
        [
          '/secrets/demo/manager/authenticate',
          'secrets/[secretId]/manager/authenticate',
        ],
        [
          '/secrets/demo/manager/oauth/callback',
          'secrets/[secretId]/manager/oauth/callback',
        ],
        ['/integrations/widget/v1.js', 'integrations/widget/v1.js'],
        [
          '/integrations/widget/demo/frame',
          'integrations/widget/[integrationId]/frame',
        ],
        [
          '/integrations/widget/demo/test',
          'integrations/widget/[integrationId]/test',
        ],
        ['/integrations/mcpserver/v1.js', 'integrations/mcpserver/v1.js'],
        [
          '/integrations/mcpserver/demo/frame',
          'integrations/mcpserver/[integrationId]/frame',
        ],
        [
          '/integrations/mcpserver/demo/test',
          'integrations/mcpserver/[integrationId]/test',
        ],
        ['/redirect/target', 'redirect/target'],
        ['/partner/signin/acme', 'partner/signin/acme'],
      ]) {
        const response = await request('test.portal.localhost:3000', pathname)

        expect(response.headers.get('x-fixture-route')).toBe(route)
      }

      const api = await request('test.portal.localhost:3000', '/api/health')

      expect(await api.json()).toEqual({ ok: true })
    })

    it('uses the portal fallback only after an excluded route fails to resolve', async () => {
      await start()

      const existing = await request(
        'test.portal.localhost:3000',
        '/redirect/target'
      )
      const missing = await request(
        'test.portal.localhost:3000',
        '/redirect/missing'
      )

      expect(existing.headers.get('x-fixture-route')).toBe('redirect/target')
      expect(missing.headers.get('x-fixture-route')).toBe('apps/404')
    })

    it('does not route unrelated hosts or accept a client-supplied portal marker', async () => {
      await start()

      for (const host of [
        'test.cbk-portal.localhost:3000',
        'portal.localhost:3000',
        'testXportal.localhost:3000',
        'test.portal.localhost.attacker.example',
        'custom.example.com',
      ]) {
        const response = await request(host, '/', {
          headers: {
            'x-cbk-portal': '1',
            'x-forwarded-host': 'test.portal.localhost:3000',
          },
        })

        expect(response.status).toBe(307)
        expect(response.headers.get('x-fixture-route')).toBeNull()
      }

      const missing = await request('cbk.localhost:3000', '/redirect/missing', {
        headers: { 'x-cbk-portal': '1' },
      })

      expect(missing.status).toBe(404)
      expect(missing.headers.get('x-fixture-route')).toBeNull()
    })

    it('supports the hosted portal domain with the same build', async () => {
      await start('chatbotkit.space', 'chatbotkit.agency')

      const response = await request('test.chatbotkit.agency')

      expect(response.status).toBe(200)
      expect(response.headers.get('x-fixture-route')).toBe('apps/index')
    })

    it.each([
      {
        name: 'same-origin form on the runtime partner apex',
        host: 'acme.partners.localhost:3000',
        origin: 'http://acme.partners.localhost:3000',
        pathname: '/apps/action-probe',
        allowed: true,
      },
      {
        name: 'same-origin form on a partner custom domain',
        host: 'partner.example:3000',
        origin: 'http://partner.example:3000',
        pathname: '/apps/action-probe',
        allowed: true,
      },
      {
        name: 'foreign origin on a partner custom domain',
        host: 'partner.example:3000',
        origin: 'https://attacker.invalid',
        pathname: '/apps/action-probe',
        allowed: false,
      },
      {
        name: 'same-origin form on the runtime portal apex',
        host: 'test.portal.localhost:3000',
        origin: 'http://test.portal.localhost:3000',
        allowed: true,
      },
      {
        name: 'reverse proxy preserving the public forwarded host',
        host: 'test.portal.localhost:3000',
        origin: 'http://test.portal.localhost:3000',
        forwardedHost: 'test.portal.localhost:3000',
        allowed: true,
      },
      {
        name: 'internal host with the public host forwarded to an explicit app route',
        host: 'internal:3000',
        origin: 'http://test.portal.localhost:3000',
        forwardedHost: 'test.portal.localhost:3000',
        pathname: '/apps/action-probe',
        allowed: true,
      },
      {
        name: 'foreign origin with a valid portal host and session cookie',
        host: 'test.portal.localhost:3000',
        origin: 'https://attacker.invalid',
        allowed: false,
      },
      {
        name: 'forwarded host that disagrees with the public origin',
        host: 'test.portal.localhost:3000',
        origin: 'http://test.portal.localhost:3000',
        forwardedHost: 'internal:3000',
        allowed: false,
      },
      {
        name: 'build-time portal apex grants no cross-origin exception',
        host: 'test.portal.localhost:3000',
        origin: 'https://test.cbk-portal.localhost',
        allowed: false,
      },
      {
        name: 'runtime portal apex does not add a cross-origin exception to the standalone build',
        host: 'test.portal.localhost:3000',
        origin: 'https://test.portal.localhost',
        allowed: false,
      },
      {
        name: 'build-time shell origin grants no cross-origin exception',
        host: 'apps.localhost:3000',
        origin: 'http://cbk-apps.localhost:3000',
        allowed: false,
      },
      {
        name: 'custom portal domain preserved across a backend host rewrite',
        host: 'portal-customer-com.portal.localhost:3000',
        origin: 'https://portal.customer.com',
        forwardedHost: 'portal.customer.com',
        allowed: true,
      },
      {
        name: 'foreign origin forwarded through a custom portal domain',
        host: 'portal-customer-com.portal.localhost:3000',
        origin: 'https://attacker.invalid',
        forwardedHost: 'portal.customer.com',
        allowed: false,
      },
      {
        name: 'same-origin main shell after changing its runtime origin',
        host: 'apps.localhost:3000',
        origin: 'http://apps.localhost:3000',
        allowed: true,
      },
      {
        name: 'same-origin labs shell after changing its runtime origin',
        host: 'labs.localhost:3000',
        origin: 'http://labs.localhost:3000',
        allowed: true,
      },
      {
        name: 'same-origin registered app after changing the runtime apex',
        host: 'action-probe.app.localhost:3000',
        origin: 'http://action-probe.app.localhost:3000',
        pathname: '/',
        allowed: true,
      },
      {
        name: 'foreign origin on a registered app with a session cookie',
        host: 'action-probe.app.localhost:3000',
        origin: 'https://attacker.invalid',
        pathname: '/',
        allowed: false,
      },
    ])(
      'Server Actions: $name',
      async ({
        host,
        origin: actionOrigin,
        forwardedHost,
        pathname = '/action-probe',
        allowed,
      }) => {
        await start()

        const resultsPath = path.join(directory, 'action-results.jsonl')

        await fs.rm(resultsPath, { force: true })

        const page = await request(host, pathname)

        expect(page.status).toBe(200)

        const html = await page.text()
        const actionField = html.match(/name="(\$ACTION_ID_[^"]+)"/)

        expect(actionField).not.toBeNull()

        const form = new FormData()

        form.set(actionField[1], '')
        form.set('value', 'saved')

        const body = new Response(form)
        const result = await request(host, pathname, {
          method: 'POST',
          body: Buffer.from(await body.arrayBuffer()),
          headers: {
            origin: actionOrigin,
            cookie: 'audit-session=test-session',
            'content-type': body.headers.get('content-type'),
            ...(forwardedHost ? { 'x-forwarded-host': forwardedHost } : {}),
          },
        })

        if (allowed) {
          expect(result.status).toBe(200)
          expect(JSON.parse(await fs.readFile(resultsPath, 'utf8'))).toEqual({
            value: 'saved',
            session: 'test-session',
            host,
          })
        } else {
          expect(result.status).toBe(500)
          await expect(fs.stat(resultsPath)).rejects.toMatchObject({
            code: 'ENOENT',
          })
        }
      }
    )

    it('serves a registered app on the runtime app apex', async () => {
      await start()

      const response = await request('chat.app.localhost:3000')

      expect(response.status).toBe(200)
      expect(response.headers.get('x-fixture-route')).toBe(
        'apps/chat/[[...path]]'
      )
      expect(response.headers.get('x-fixture-host')).toBe(
        'chat.app.localhost:3000'
      )
    })

    it('serves both app shells on their runtime origins', async () => {
      await start()

      for (const host of ['apps.localhost:3000', 'labs.localhost:3000']) {
        const root = await request(host)
        const chat = await request(host, '/chat/conversation?q=one%20two')

        expect(root.status).toBe(200)
        expect(root.headers.get('x-fixture-route')).toBe('apps/index')
        expect(chat.headers.get('x-fixture-route')).toBe(
          'apps/chat/[[...path]]'
        )
        expect(JSON.parse(chat.headers.get('x-fixture-query')).path).toEqual([
          'conversation',
        ])
        expect(JSON.parse(chat.headers.get('x-fixture-query')).q).toBe(
          'one two'
        )
      }
    })

    it('preserves app paths, manifests, platform sign-in, callbacks and static files', async () => {
      await start()

      const app = await request(
        'chat.app.localhost:3000',
        '/conversation?q=one%20two&slug=spoofed'
      )

      expect(app.headers.get('x-fixture-route')).toBe('apps/chat/[[...path]]')
      expect(JSON.parse(app.headers.get('x-fixture-query')).path).toEqual([
        'conversation',
      ])
      expect(JSON.parse(app.headers.get('x-fixture-query')).q).toBe('one two')

      for (const host of [
        'apps.localhost:3000',
        'labs.localhost:3000',
        'chat.app.localhost:3000',
      ]) {
        for (const [pathname, route] of [
          ['/app.webmanifest', 'apps/app.webmanifest'],
          ['/signin', 'signin'],
          ['/welcome', 'welcome'],
          ['/secrets/oauth/callback', 'secrets/oauth/callback'],
          [
            '/secrets/demo/manager/authenticate',
            'secrets/[secretId]/manager/authenticate',
          ],
          [
            '/secrets/demo/manager/oauth/callback',
            'secrets/[secretId]/manager/oauth/callback',
          ],
          ['/redirect/target', 'redirect/target'],
          ['/partner/signin/acme', 'partner/signin/acme'],
        ]) {
          const response = await request(host, pathname)

          expect(response.headers.get('x-fixture-route')).toBe(route)
        }

        expect(await (await request(host, '/api/health')).json()).toEqual({
          ok: true,
        })
        expect(await (await request(host, '/favicon.ico')).text()).toBe(
          'fixture favicon'
        )
      }
    })

    it('redirects app overview to the same public host and preserves the query', async () => {
      await start()

      const response = await request(
        'chat.app.localhost:3000',
        '/overview?q=one%20two'
      )

      expect(response.status).toBe(307)

      const location = response.headers.get('location')
      const destination = new URL(location, 'http://chat.app.localhost:3000')

      expect(destination.origin).toBe('http://chat.app.localhost:3000')
      expect(destination.pathname).toBe(basePath || '/')
      expect(destination.searchParams.get('q')).toBe('one two')
    })

    it('keeps app fallback routing after existing platform routes', async () => {
      await start()

      const existing = await request(
        'chat.app.localhost:3000',
        '/redirect/target'
      )
      const missing = await request(
        'chat.app.localhost:3000',
        '/redirect/missing'
      )

      expect(existing.headers.get('x-fixture-route')).toBe('redirect/target')
      expect(missing.headers.get('x-fixture-route')).toBe(
        'apps/chat/[[...path]]'
      )
      expect(JSON.parse(missing.headers.get('x-fixture-query')).path).toEqual([
        '404',
      ])
    })

    it('preserves client-side page data routing and overview redirects', async () => {
      await start()

      const buildId = (
        await fs.readFile(path.join(directory, '.next/BUILD_ID'), 'utf8')
      ).trim()

      const locale = basePath ? '/en' : ''

      for (const [host, pathname, route] of [
        ['apps.localhost:3000', 'chat', 'apps/chat/[[...path]]'],
        ['chat.app.localhost:3000', 'history', 'apps/chat/[[...path]]'],
        ['test.portal.localhost:3000', 'chat', 'apps/chat/[[...path]]'],
      ]) {
        const response = await request(
          host,
          `/_next/data/${buildId}${locale}/${pathname}.json?q=one`,
          {
            headers: { 'x-nextjs-data': '1' },
          }
        )

        expect(response.status).toBe(200)
        expect(response.headers.get('x-fixture-route')).toBe(route)
        expect(await response.json()).toHaveProperty('pageProps')
      }

      const response = await request(
        'chat.app.localhost:3000',
        `/_next/data/${buildId}${locale}/overview.json?q=one`,
        {
          headers: { 'x-nextjs-data': '1' },
        }
      )

      expect(response.status).toBe(307)

      const destination = new URL(
        response.headers.get('x-nextjs-redirect'),
        'http://chat.app.localhost:3000'
      )

      expect(destination.origin).toBe('http://chat.app.localhost:3000')
      expect(destination.pathname).toBe(basePath || '/')
      expect(destination.searchParams.get('q')).toBe('one')
    })

    it('does not select app routes from stale, unknown, unrelated or spoofed hosts', async () => {
      await start()

      for (const host of [
        'cbk-apps.localhost:3000',
        'cbk-labs.localhost:3000',
        'chat.cbk-app.localhost:3000',
        'unknown.app.localhost:3000',
        'app.localhost:3000',
        'child.apps.localhost:3000',
        'chat.app.localhost.attacker.example',
        'chatXapp.localhost:3000',
      ]) {
        const response = await request(host, '/', {
          headers: {
            'x-cbk-app': 'chat',
            'x-cbk-app-shell': '1',
            'x-forwarded-host': 'chat.app.localhost:3000',
          },
        })

        expect(response.status).toBe(307)
        expect(response.headers.get('x-fixture-route')).toBeNull()
      }

      const portal = await request('test.portal.localhost:3000', '/', {
        headers: { 'x-cbk-app': 'chat', 'x-cbk-app-shell': '1' },
      })
      const space = await request('test.space.localhost:3000', '/', {
        headers: { 'x-cbk-app': 'chat', 'x-cbk-app-shell': '1' },
      })

      expect(portal.headers.get('x-fixture-route')).toBe('apps/index')
      expect(space.headers.get('x-space-site')).toBe('public')
    })

    it('supports hosted app domains with the same build', async () => {
      await start('chatbotkit.space', 'chatbotkit.agency', {
        APP_APEX: 'chatbotkit.app',
        APP_MAIN_ORIGIN: 'https://apps.chatbotkit.com',
        APP_LABS_ORIGIN: 'https://labs.chatbotkit.com',
      })

      for (const [host, route] of [
        ['chat.chatbotkit.app', 'apps/chat/[[...path]]'],
        ['apps.chatbotkit.com', 'apps/index'],
        ['labs.chatbotkit.com', 'apps/index'],
      ]) {
        expect((await request(host)).headers.get('x-fixture-route')).toBe(route)
      }
    })

    it('disables app host routing without disabling path-based apps', async () => {
      await start('space.localhost', 'portal.localhost', {
        APP_APEX: '',
        APP_MAIN_ORIGIN: '',
        APP_LABS_ORIGIN: '',
      })

      for (const host of [
        'chat.app.localhost:3000',
        'apps.localhost:3000',
        'labs.localhost:3000',
      ]) {
        expect((await request(host)).status).toBe(307)
      }

      expect(
        (await request('cbk.localhost:3000', '/apps/chat')).headers.get(
          'x-fixture-route'
        )
      ).toBe('apps/chat/[[...path]]')
    })

    it('keeps app hosts out of the built rewrite and redirect manifest', async () => {
      const manifest = JSON.parse(
        await fs.readFile(
          path.join(directory, '.next/routes-manifest.json'),
          'utf8'
        )
      )
      const appRules = Object.values(manifest.rewrites)
        .flat()
        .filter(
          (rule) =>
            rule.destination.startsWith(`${basePath}/`) &&
            rule.destination.includes('/apps/')
        )

      expect(appRules.length).toBeGreaterThan(0)
      expect(
        appRules
          .flatMap((rule) => rule.has || [])
          .filter((condition) => condition.type === 'host')
      ).toEqual([])
      expect(
        manifest.redirects
          .flatMap((rule) => rule.has || [])
          .filter((condition) => condition.type === 'host')
      ).toEqual([])
    })

    it('disables portal routing when the runtime apex is unset', async () => {
      await start('space.localhost', '')

      const response = await request('test.cbk-portal.localhost:3000', '/', {
        headers: { 'x-cbk-portal': '1' },
      })

      expect(response.status).toBe(307)
      expect(response.headers.get('x-fixture-route')).toBeNull()
    })

    it('serves partner sign-in on the runtime apex with the same build', async () => {
      await start()

      const response = await request(
        'acme.partners.localhost:3000',
        '/signin?callbackUrl=%2Foverview'
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('x-fixture-route')).toBe(
        'partner/signin/acme'
      )
      expect(
        JSON.parse(response.headers.get('x-fixture-query')).callbackUrl
      ).toBe('/overview')
    })

    it('routes partner verification and custom domains without leaking private branding fields', async () => {
      await start()

      for (const host of [
        'ACME.PARTNERS.LOCALHOST:3000',
        'partner.example:3000',
      ]) {
        for (const [pathname, route] of [
          ['/signin?slug=plain&callbackUrl=%2Foverview', 'partner/signin/acme'],
          ['/signin/verify?token=example', 'partner/signin/acme/verify'],
        ]) {
          const response = await request(host, pathname)

          expect(response.status).toBe(200)
          expect(response.headers.get('x-fixture-route')).toBe(route)

          const encoded = response.headers
            .get('server-timing')
            .match(/partner;desc="([^"]+)"/)[1]

          expect(JSON.parse(Buffer.from(encoded, 'base64').toString())).toEqual(
            {
              name: 'Acme Studio',
              logo: '/acme.svg',
              icon: '/acme.png',
              whitelabel: true,
              experience: 'builder',
            }
          )
        }
      }
    })

    it('redirects partner roots on the public host and includes branding on API responses', async () => {
      await start()

      for (const host of [
        'acme.partners.localhost:3000',
        'partner.example:3000',
      ]) {
        const response = await request(host, '/?campaign=one')

        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toBe(
          `http://${host}${basePath}/overview?campaign=one`
        )
        expect(response.headers.get('server-timing')).toContain('partner;desc=')

        const api = await request(host, '/api/health')

        expect(await api.json()).toEqual({ ok: true })
        expect(api.headers.get('server-timing')).toBe(
          response.headers.get('server-timing')
        )
      }
    })

    it('rejects stale partner domains and forged partner markers', async () => {
      await start()

      for (const host of [
        'acme.cbk-partners.localhost:3000',
        'build.partner.example:3000',
        'partners.localhost:3000',
        'acme.partners.localhost.attacker.example',
        'partnerXexample:3000',
        'unrelated.example:3000',
      ]) {
        const response = await request(host, '/signin', {
          headers: {
            'x-cbk-partner': 'acme',
            'x-forwarded-host': 'partner.example:3000',
          },
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('x-fixture-route')).toBe('signin')
        expect(response.headers.get('server-timing')).toBeNull()
      }
    })

    it('keeps unknown partner slugs on the partner route without inventing branding', async () => {
      await start()

      const response = await request(
        'unknown.partners.localhost:3000',
        '/signin'
      )

      expect(response.status).toBe(404)
      expect(response.headers.get('server-timing')).toBeNull()

      const plain = await request('plain.partners.localhost:3000', '/signin')
      const encoded = plain.headers
        .get('server-timing')
        .match(/partner;desc="([^"]+)"/)[1]

      expect(plain.status).toBe(200)
      expect(JSON.parse(Buffer.from(encoded, 'base64').toString())).toEqual({
        name: 'Plain Partner',
        whitelabel: false,
      })
    })

    it('changes partner domains and disables the apex without rebuilding', async () => {
      await start(undefined, undefined, undefined, {
        PARTNERS_APEX: '',
        FIXTURE_PARTNER_DOMAIN: 'new.partner.example',
      })

      expect(
        (await request('new.partner.example', '/signin')).headers.get(
          'x-fixture-route'
        )
      ).toBe('partner/signin/acme')

      for (const host of [
        'partner.example',
        'acme.partners.localhost',
        'acme.cbk-partners.localhost',
      ]) {
        const response = await request(host, '/signin')

        expect(response.headers.get('x-fixture-route')).toBe('signin')
        expect(response.headers.get('server-timing')).toBeNull()
      }
    })

    it.each([
      ['apps.localhost:3000', '/chat', 'apps/chat/[[...path]]'],
      ['chat.app.localhost:3000', '/conversation', 'apps/chat/[[...path]]'],
      ['test.portal.localhost:3000', '/chat', 'apps/chat/[[...path]]'],
    ])(
      'preserves partner sign-in alongside app routing on %s',
      async (host, pathname, route) => {
        await start(undefined, undefined, undefined, {
          PARTNERS_APEX: 'partners.localhost',
          FIXTURE_PARTNER_DOMAIN: host.split(':')[0],
        })

        expect(
          (await request(host, '/signin')).headers.get('x-fixture-route')
        ).toBe('partner/signin/acme')
        expect(
          (await request(host, pathname)).headers.get('x-fixture-route')
        ).toBe(route)

        const root = await request(host)

        expect(root.status).toBe(307)
        expect(root.headers.get('location')).toBe(
          `http://${host}${basePath}/overview`
        )

        const overview = await request(host, '/overview')

        expect(overview.headers.get('location')).not.toBe(
          `http://${host}${basePath}/`
        )
      }
    )

    it('preserves public space rendering alongside partner sign-in', async () => {
      await start(undefined, undefined, undefined, {
        PARTNERS_APEX: 'partners.localhost',
        FIXTURE_PARTNER_DOMAIN: 'test.space.localhost',
      })

      expect(
        (await request('test.space.localhost', '/signin')).headers.get(
          'x-fixture-route'
        )
      ).toBe('partner/signin/acme')

      const response = await request('test.space.localhost', '/docs')

      expect(response.headers.get('x-space-site')).toBe('public')
      expect(response.headers.get('server-timing')).toContain('partner;desc=')
    })

    it('keeps partner hosts and branding out of the built route manifest', async () => {
      const manifest = await fs.readFile(
        path.join(directory, '.next/routes-manifest.json'),
        'utf8'
      )

      expect(manifest).toContain('x-cbk-partner')
      expect(manifest).not.toContain('cbk-partners.localhost')
      expect(manifest).not.toContain('build.partner.example')
      expect(manifest).not.toContain('partner;desc=')
    })

    it('applies static host restrictions from the runtime URL with the same build', async () => {
      await start()

      const response = await request('static.localhost:3000', '/signin')

      expect(await response.text()).toBe('fixture static fallback')
      expect(response.headers.get('x-fixture-route')).toBeNull()
    })

    it('preserves static fallback status and allowed widgets, assets and API paths', async () => {
      await start()

      for (const pathname of ['/', '/overview', '/missing/path']) {
        const response = await request('STATIC.LOCALHOST:3000', pathname)

        expect(response.status).toBe(200)
        expect(await response.text()).toBe('fixture static fallback')
      }

      for (const [pathname, route] of [
        ['/integrations/widget/v1.js', 'integrations/widget/v1.js'],
        [
          '/integrations/widget/demo/frame?theme=dark',
          'integrations/widget/[integrationId]/frame',
        ],
        ['/partner/signin/acme', 'partner/signin/acme'],
      ]) {
        const response = await request('static.localhost:3000', pathname)

        expect(response.status).toBe(200)
        expect(response.headers.get('x-fixture-route')).toBe(route)
      }

      expect(
        await (await request('static.localhost:3000', '/favicon.ico')).text()
      ).toBe('fixture favicon')
      expect(
        await (await request('static.localhost:3000', '/api/health')).json()
      ).toEqual({ ok: true })
      expect(
        (await request('static.localhost:3000', '/missing.js')).status
      ).toBe(404)
      expect(
        (await request('static.localhost:3000', '/signin', { method: 'HEAD' }))
          .status
      ).toBe(200)
    })

    it('does not restrict stale or spoofed static hosts', async () => {
      await start()

      for (const host of [
        'build.static.example:3000',
        'unrelated.example',
        'staticXlocalhost',
        'static.localhost.attacker.example',
      ]) {
        const response = await request(host, '/signin', {
          headers: {
            'x-cbk-static': '1',
            'x-forwarded-host': 'static.localhost:3000',
          },
        })

        expect(response.headers.get('x-fixture-route')).toBe('signin')
      }
    })

    it('loads all mapped static targets at startup while keeping shared site hosts unrestricted', async () => {
      await start(undefined, undefined, undefined, undefined, {
        STATIC_URL: 'https://static.chatbotkit.com',
        HOSTS_CONFIG: JSON.stringify({
          family: {
            match: ['example.com'],
            site: 'example.com',
            api: 'api.example.com',
            static: 'static.example.com',
            widgets: 'widgets.example.com',
          },
          secondary: {
            match: ['legacy.example.com'],
            site: 'legacy.example.com',
            api: 'api.legacy.example.com',
            static: 'static.legacy.example.com',
            widgets: 'widgets.legacy.example.com',
          },
          single: {
            match: ['single.example.com'],
            site: 'single.example.com',
            api: 'single.example.com',
            static: 'single.example.com',
            widgets: 'single.example.com',
          },
        }),
      })

      for (const host of [
        'static.example.com',
        'static.legacy.example.com',
        'static.chatbotkit.com',
      ]) {
        expect(await (await request(host, '/signin')).text()).toBe(
          'fixture static fallback'
        )
      }

      for (const host of [
        'example.com',
        'legacy.example.com',
        'single.example.com',
        'platform.localhost:3000',
      ]) {
        expect(
          (await request(host, '/signin')).headers.get('x-fixture-route')
        ).toBe('signin')
      }
    })

    it.each(['', 'http://platform.localhost:3000'])(
      'disables static host restrictions with STATIC_URL=%s',
      async (staticUrl) => {
        await start(undefined, undefined, undefined, undefined, {
          STATIC_URL: staticUrl,
          HOSTS_CONFIG: '',
        })

        for (const host of [
          'static.localhost:3000',
          'build.static.example:3000',
          'platform.localhost:3000',
        ]) {
          expect(
            (await request(host, '/signin')).headers.get('x-fixture-route')
          ).toBe('signin')
        }
      }
    )

    it.each([
      'apps.localhost:3000',
      'chat.app.localhost:3000',
      'test.portal.localhost:3000',
    ])(
      'preserves static restrictions after app rewrites when hosts overlap at %s',
      async (host) => {
        await start(undefined, undefined, undefined, undefined, {
          STATIC_URL: `http://${host}`,
          HOSTS_CONFIG: '',
        })

        expect(await (await request(host, '/conversation')).text()).toBe(
          'fixture static fallback'
        )
        expect(
          (await request(host, '/integrations/widget/v1.js')).headers.get(
            'x-fixture-route'
          )
        ).toBe('integrations/widget/v1.js')
      }
    )

    it('preserves public space routing and partner sign-in when static hosts overlap', async () => {
      await start(undefined, undefined, undefined, undefined, {
        STATIC_URL: 'http://test.space.localhost:3000',
        HOSTS_CONFIG: JSON.stringify({
          partner: {
            match: ['partner.example'],
            site: 'example.com',
            api: 'api.example.com',
            static: 'partner.example',
            widgets: 'widgets.example.com',
          },
        }),
      })

      expect(
        (await request('test.space.localhost:3000', '/docs')).headers.get(
          'x-space-site'
        )
      ).toBe('public')
      expect(
        (await request('partner.example', '/signin')).headers.get(
          'x-fixture-route'
        )
      ).toBe('partner/signin/acme')
      expect((await request('partner.example')).headers.get('location')).toBe(
        `http://partner.example${basePath}/overview`
      )
    })

    it('keeps static hostnames out of the built route manifest', async () => {
      const manifest = await fs.readFile(
        path.join(directory, '.next/routes-manifest.json'),
        'utf8'
      )

      expect(manifest).toContain('x-cbk-static')
      expect(manifest).not.toContain('build.static.example')
    })

    it('serves the clean API path and CORS from the runtime API URL', async () => {
      await start()

      const response = await request('api.localhost:3000', '/v1/probe?q=one')

      expect(response.status).toBe(200)
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      expect((await response.json()).query.q).toBe('one')
    })

    it('preserves API preflight and POST requests on clean and shared-site paths', async () => {
      await start()

      for (const [host, pathname] of [
        ['api.localhost:3000', '/v1/probe'],
        ['api.localhost:3000', '/api/v1/probe'],
        ['platform.localhost:3000', '/api/v1/probe'],
      ]) {
        const preflight = await request(host, pathname, {
          method: 'OPTIONS',
          headers: {
            origin: 'https://browser.example',
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'authorization,content-type',
          },
        })

        expect(preflight.status).toBe(200)
        expect(preflight.headers.get('access-control-allow-origin')).toBe('*')
        expect(preflight.headers.get('access-control-allow-methods')).toBe(
          'GET,POST'
        )
        expect(preflight.headers.get('access-control-allow-headers')).toBe(
          'X-Requested-With, Accept, Content-Length, Content-Type, Authorization'
        )
        expect(
          preflight.headers.get('access-control-allow-credentials')
        ).toBeNull()

        const response = await request(host, `${pathname}?q=one%20two`, {
          method: 'POST',
          body: JSON.stringify({ value: 'example' }),
          headers: {
            origin: 'https://browser.example',
            'content-type': 'application/json',
            authorization: 'Bearer fixture-token',
          },
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
          method: 'POST',
          query: { q: 'one two' },
          body: { value: 'example' },
          host,
        })
        expect(response.headers.get('access-control-allow-origin')).toBe('*')
      }
    })

    it('preserves API root and fallback responses without broadening CORS', async () => {
      await start()

      for (const pathname of [
        '/',
        '/v1/missing',
        '/api/v1/missing',
        '/v10/missing',
        '/redirect/missing',
      ]) {
        const response = await request('api.localhost:3000', pathname)

        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({ api: 'not found' })
        expect(response.headers.get('access-control-allow-origin')).toBe(
          pathname.includes('/v1/') ? '*' : null
        )
      }
    })

    it('preserves API OAuth, well-known and callback exclusions', async () => {
      await start()

      for (const host of ['api.localhost:3000', 'platform.localhost:3000']) {
        for (const route of [
          'oauth/probe',
          '.well-known/api-catalog',
          '.well-known/microsoft-identity-association.json',
        ]) {
          const response = await request(host, `/${route}`)

          expect(response.status).toBe(200)
          expect(await response.json()).toEqual({ route })
        }
      }

      for (const [pathname, route] of [
        ['/redirect/target', 'redirect/target'],
        ['/secrets/oauth/callback', 'secrets/oauth/callback'],
        [
          '/secrets/demo/manager/authenticate',
          'secrets/[secretId]/manager/authenticate',
        ],
        [
          '/secrets/demo/manager/oauth/callback',
          'secrets/[secretId]/manager/oauth/callback',
        ],
      ]) {
        expect(
          (await request('api.localhost:3000', pathname)).headers.get(
            'x-fixture-route'
          )
        ).toBe(route)
      }
    })

    it('rejects stale API hosts and spoofed selection or forwarded headers', async () => {
      await start()

      for (const host of [
        'build.api.example:3000',
        'apiXlocalhost',
        'api.localhost.attacker.example',
        'unrelated.example',
      ]) {
        const response = await request(host, '/v1/probe', {
          headers: {
            'x-cbk-api': '1',
            'x-forwarded-host': 'api.localhost:3000',
          },
        })

        expect(response.status).toBe(404)
        expect(response.headers.get('access-control-allow-origin')).toBeNull()
      }
    })

    it('enables all mapped API hosts and the hosted scalar URL with the same build', async () => {
      await start(undefined, undefined, undefined, undefined, {
        API_URL: 'https://api.chatbotkit.com',
        HOSTS_CONFIG: JSON.stringify({
          primary: {
            match: ['example.com'],
            site: 'example.com',
            api: 'api.example.com',
            static: 'static.example.com',
            widgets: 'widgets.example.com',
          },
          secondary: {
            match: ['legacy.example.com'],
            site: 'legacy.example.com',
            api: 'api.legacy.example.com',
            static: 'static.legacy.example.com',
            widgets: 'widgets.legacy.example.com',
          },
          single: {
            match: ['single.example.com'],
            site: 'single.example.com',
            api: 'single.example.com',
            static: 'single.example.com',
            widgets: 'single.example.com',
          },
        }),
      })

      for (const host of [
        'api.example.com',
        'API.LEGACY.EXAMPLE.COM:3000',
        'api.chatbotkit.com',
      ]) {
        const response = await request(host, '/v1/probe')

        expect(response.status).toBe(200)
        expect(response.headers.get('access-control-allow-origin')).toBe('*')
      }

      for (const host of [
        'example.com',
        'legacy.example.com',
        'single.example.com',
      ]) {
        expect(
          (await request(host, '/signin')).headers.get('x-fixture-route')
        ).toBe('signin')
        expect(
          (await request(host, '/v1/probe')).headers.get(
            'access-control-allow-origin'
          )
        ).toBeNull()
        expect((await request(host, '/api/v1/probe')).status).toBe(200)
      }
    })

    it.each(['', 'http://platform.localhost:3000'])(
      'keeps the shared-site API when API_URL=%s',
      async (apiUrl) => {
        await start(undefined, undefined, undefined, undefined, {
          API_URL: apiUrl,
          HOSTS_CONFIG: '',
        })

        for (const host of [
          'api.localhost:3000',
          'build.api.example:3000',
          'platform.localhost:3000',
        ]) {
          expect(
            (await request(host, '/signin')).headers.get('x-fixture-route')
          ).toBe('signin')
          expect(
            (await request(host, '/v1/probe')).headers.get(
              'access-control-allow-origin'
            )
          ).toBeNull()

          const response = await request(host, '/api/v1/probe')

          expect(response.status).toBe(200)
          expect(response.headers.get('access-control-allow-origin')).toBe('*')
        }
      }
    )

    it.each([
      'apps.localhost:3000',
      'chat.app.localhost:3000',
      'test.portal.localhost:3000',
      'test.space.localhost:3000',
      'static.localhost:3000',
      'partner.example:3000',
    ])(
      'preserves API rewrite precedence on the overlapping host %s',
      async (host) => {
        await start(undefined, undefined, undefined, undefined, {
          API_URL: `http://${host}`,
          STATIC_URL: 'http://static.localhost:3000',
          HOSTS_CONFIG: '',
        })

        const response = await request(host, '/v1/probe')

        expect(response.status).toBe(200)
        expect((await response.json()).host).toBe(host)
        expect(response.headers.get('access-control-allow-origin')).toBe('*')
      }
    )

    it('keeps API hostnames out of the built rewrite and header manifest', async () => {
      const manifest = await fs.readFile(
        path.join(directory, '.next/routes-manifest.json'),
        'utf8'
      )

      expect(manifest).toContain('x-cbk-api')
      expect(manifest).not.toContain('build.api.example')
    })

    it('excludes the configured API host from browser security headers without relying on its prefix', async () => {
      await start(undefined, undefined, undefined, undefined, {
        API_URL: 'https://gateway.example.com',
        HOSTS_CONFIG: '',
      })

      const response = await request('gateway.example.com', '/v1/probe')

      expect(response.status).toBe(200)
      expect(response.headers.get('content-security-policy')).toBeNull()
      expect(response.headers.get('x-frame-options')).toBeNull()
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
    })

    it('protects an ordinary site whose hostname starts with api', async () => {
      await start()

      const response = await request('api.site.example', '/signin')

      expect(response.status).toBe(200)
      expect(response.headers.get('content-security-policy')).toContain(
        "frame-ancestors 'self'"
      )
      expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    })

    it('preserves embeddable policies across platform and static hosts', async () => {
      await start()

      for (const host of [
        'platform.localhost:3000',
        'static.localhost:3000',
        'api.site.example',
      ]) {
        for (const pathname of [
          '/integrations/widget/v1.js',
          '/integrations/widget/demo/frame',
        ]) {
          const response = await request(host, pathname)

          expect(response.status).toBe(200)
          expect(response.headers.get('x-frame-options')).toBeNull()
          expect(response.headers.get('content-security-policy')).toContain(
            'frame-ancestors * capacitor: ionic:'
          )
          expect(response.headers.get('content-security-policy')).toContain(
            "form-action 'self'"
          )
          expect(response.headers.get('cross-origin-resource-policy')).toBe(
            'cross-origin'
          )
          expect(
            response.headers.get('cross-origin-embedder-policy')
          ).toBeNull()
          expect(response.headers.get('cross-origin-opener-policy')).toBeNull()
          expect(response.headers.get('strict-transport-security')).toBe(
            'max-age=31536000'
          )
        }
      }
    })

    it('allows the frame handler to tighten CSP without an additional permissive policy', async () => {
      await start()

      const response = await request(
        'platform.localhost:3000',
        '/integrations/widget/restricted/frame'
      )
      const csp = response.headers.get('content-security-policy')

      expect(response.status).toBe(200)
      expect(response.headers.get('x-frame-options')).toBeNull()
      expect(csp).toContain("frame-ancestors 'self' https://allowed.example")
      expect(csp).not.toContain('frame-ancestors *')
      expect(csp.match(/frame-ancestors/g)).toHaveLength(1)
    })

    it('uses mapped API host classification and protects shared site/API hosts', async () => {
      await start(undefined, undefined, undefined, undefined, {
        API_URL: '',
        HOSTS_CONFIG: JSON.stringify({
          dedicated: {
            match: ['site.example'],
            site: 'site.example',
            api: 'gateway.example',
            static: 'static.example',
            widgets: 'widgets.example',
          },
          shared: {
            match: ['api.site.example'],
            site: 'api.site.example',
            api: 'api.site.example',
            static: 'api.site.example',
            widgets: 'api.site.example',
          },
        }),
      })

      const api = await request('gateway.example', '/v1/probe')
      const site = await request('api.site.example', '/signin')

      expect(api.status).toBe(200)
      expect(api.headers.get('content-security-policy')).toBeNull()
      expect(api.headers.get('access-control-allow-origin')).toBe('*')
      expect(site.headers.get('x-frame-options')).toBe('SAMEORIGIN')

      const sharedApi = await request('api.site.example', '/api/v1/probe')

      expect(sharedApi.status).toBe(200)
      expect(sharedApi.headers.get('content-security-policy')).toBeNull()
    })

    it('does not let forged routing headers disable the browser policy', async () => {
      await start()

      const response = await request('platform.localhost:3000', '/signin', {
        headers: { 'x-cbk-api': '1', 'x-forwarded-host': 'api.localhost:3000' },
      })

      expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN')
      expect(response.headers.get('content-security-policy')).toContain(
        "frame-ancestors 'self'"
      )
    })

    it('applies browser policies to proxy redirects and page errors', async () => {
      await start()

      for (const [host, pathname, status] of [
        ['partner.example', '/', 307],
        ['chat.app.localhost:3000', '/overview', 307],
        ['platform.localhost:3000', '/missing/page', 404],
      ]) {
        const response = await request(host, pathname)

        expect(response.status).toBe(status)
        expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN')
      }

      const apiError = await request('api.localhost:3000', '/v1/missing')

      expect(apiError.status).toBe(404)
      expect(apiError.headers.get('content-security-policy')).toBeNull()
    })

    it('matches the previous native redirect destinations and status codes', async () => {
      const paths = [
        '/signin/',
        '/favicon.ico/',
        ...(basePath ? ['/en/signin/', '/fr/signin/', '/fr/'] : []),
      ]

      async function redirects() {
        const results = []

        for (const pathname of paths) {
          const response = await request(
            'platform.localhost:3000',
            `${pathname}?q=one%20two&q=three`
          )

          results.push({
            status: response.status,
            location: new URL(
              response.headers.get('location'),
              'http://platform.localhost:3000'
            ).href,
          })
        }

        return results
      }

      await start()

      const runtimeRedirects = await redirects()

      await stop()

      // @note install the former native rules into the same fixture; they
      // run before the proxy and provide the framework's reference behavior
      const manifestPath = path.join(directory, '.next/routes-manifest.json')
      const manifest = await fs.readFile(manifestPath, 'utf8')
      const runtimeConfig = standaloneConfig
      const nativeConfig = {
        ...JSON.parse(standaloneConfig),
        skipTrailingSlashRedirect: false,
        skipProxyUrlNormalize: false,
      }
      const nativeRoutes = await loadCustomRoutes(nativeConfig)

      try {
        await fs.writeFile(
          manifestPath,
          JSON.stringify({
            ...JSON.parse(manifest),
            redirects: nativeRoutes.redirects,
          })
        )
        standaloneConfig = JSON.stringify(nativeConfig)
        await start()

        expect(runtimeRedirects).toEqual(await redirects())
      } finally {
        await stop()
        standaloneConfig = runtimeConfig
        await fs.writeFile(manifestPath, manifest)
      }
    })

    it('preserves security headers and destinations on permanent redirects', async () => {
      await start(undefined, undefined, undefined, undefined, {
        SITE_URL: 'https://site.example',
        API_URL: 'https://gateway.example',
        HOSTS_CONFIG: '',
        SENTRY_HEADERS_REPORT_URI: 'https://runtime.report.example/csp',
      })

      const paths = [
        ['/signin/', `${basePath}/signin`],
        ['/favicon.ico/', `${basePath}/favicon.ico`],
        [
          '/integrations/widget/test/frame/',
          `${basePath}/integrations/widget/test/frame`,
        ],
        ...(basePath
          ? [
              ['/en/signin/', `${basePath}/signin`],
              ['/fr/signin/', `${basePath}/fr/signin`],
            ]
          : []),
      ]

      for (const [pathname, target] of paths) {
        for (const host of ['site.example', 'gateway.example']) {
          const response = await request(
            host,
            `${pathname}?q=one%20two&q=three`,
            { method: 'POST', body: 'value=kept' }
          )
          const location = new URL(
            response.headers.get('location'),
            `http://${host}`
          )

          expect(response.status).toBe(308)
          expect(location.origin + location.pathname).toBe(
            new URL(target, `http://${host}`).href
          )
          expect(location.searchParams.getAll('q')).toEqual([
            'one two',
            'three',
          ])
          expect(response.headers.get('refresh')).toBe(
            `0;url=${response.headers.get('location')}`
          )

          if (host === 'gateway.example') {
            expect(response.headers.get('content-security-policy')).toBeNull()
            expect(response.headers.get('strict-transport-security')).toBeNull()
          } else {
            expect(response.headers.get('content-security-policy')).toContain(
              'report-uri https://runtime.report.example/csp'
            )
            expect(response.headers.get('strict-transport-security')).toBe(
              pathname.includes('/widget/')
                ? 'max-age=31536000'
                : 'max-age=31536000; includeSubDomains; preload'
            )
            expect(response.headers.get('referrer-policy')).toBe(
              pathname.includes('/widget/')
                ? 'strict-origin-when-cross-origin'
                : 'same-origin'
            )
          }
        }
      }
    })

    it('keeps canonical redirects ahead of host routing and preserves public ports', async () => {
      await start()

      for (const host of [
        'chat.app.localhost:3000',
        'apps.localhost:3000',
        'acme.partners.localhost:3000',
        'partner.example',
        'test.portal.localhost:3000',
        'test.space.localhost:3000',
        'static.localhost:3000',
      ]) {
        const response = await request(host, '/overview/?q=one', {
          method: 'HEAD',
        })
        const location = new URL(
          response.headers.get('location'),
          `http://${host}`
        )

        expect(response.status).toBe(308)
        expect(location.href).toBe(`http://${host}${basePath}/overview?q=one`)
        expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN')

        const secure = await request(host, '/signin/', {
          headers: { 'x-forwarded-proto': 'https' },
        })

        expect(secure.status).toBe(308)
        expect(secure.headers.get('location')).toBe(
          `https://${host}${basePath}/signin`
        )
      }
    })

    it('uses the runtime reporting URI and transport policy with the same build', async () => {
      await start(undefined, undefined, undefined, undefined, {
        API_URL: '',
        HOSTS_CONFIG: '',
        SITE_URL: 'https://site.example',
        SENTRY_HEADERS_REPORT_URI: 'https://runtime.report.example/csp',
      })

      const response = await request('site.example', '/signin')
      const csp = response.headers.get('content-security-policy')

      expect(response.status).toBe(200)
      expect(csp).toContain('report-uri https://runtime.report.example/csp')
      expect(csp).not.toContain('build.report.example')
      expect(csp).toContain("connect-src 'self' https: wss: blob: data:")
    })

    it('keeps browser security policy out of the built header manifest', async () => {
      const manifest = await fs.readFile(
        path.join(directory, '.next/routes-manifest.json'),
        'utf8'
      )

      expect(manifest).not.toContain('Content-Security-Policy')
      expect(manifest).not.toContain('X-Frame-Options')
      expect(JSON.parse(manifest).redirects).toEqual([])
    })
  }
)
