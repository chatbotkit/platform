/** @jest-environment node */
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
      APP_MAIN_ORIGIN: 'http://cbk-apps.localhost:3000',
      APP_LABS_ORIGIN: 'http://cbk-labs.localhost:3000',
      APP_APEX: 'cbk-app.localhost',
      PARTNERS_APEX: '',
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
      await fs.symlink(
        path.join(project, 'node_modules'),
        path.join(directory, 'node_modules'),
        'dir'
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
        'next.config.d/portals.config.js',
        'next.config.d/apps.config.js',
        'next.config.d/actions.config.js',
        'next.config.d/spaces.config.js',
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
      export default { ...transpile, env: apps.env,
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
          return {
            beforeFiles: [...appRules.beforeFiles, ...portalRules.beforeFiles, ...spaceRules.beforeFiles],
            afterFiles: [...appRules.afterFiles, ...portalRules.afterFiles, ...spaceRules.afterFiles],
            fallback: [...appRules.fallback, ...portalRules.fallback, ...spaceRules.fallback],
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
  }
)
