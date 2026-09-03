// @note the self-hosting smoke test: proves that a fresh, vendor-free
// checkout can start the application and run one useful end-to-end
// interaction, and that the planless deployment shape holds - no plan name
// is exposed, nothing is refused on entitlement grounds, and no billing
// route exists.
//
// It runs the dev server against a throwaway SQLite database with the
// minimal environment (site url + NextAuth dummies) and DELIBERATELY none of
// the deployment configuration variables (LIMITS_CONFIG and friends), signs
// in through the email code flow (the code is scraped from the server log,
// exactly as a developer would read it), creates a bot and lists it back.
//
// Usage: node scripts/smoke-selfhost.js
// Exits 0 on success; prints the failing assertion otherwise.

/* eslint-disable no-restricted-globals -- a plain node script outside the app: no path aliases, the global fetch is the whole point */

/* eslint-disable custom-eslint-rules/no-global-fetch -- standalone node script without path aliases; talks only to the dev server it just started */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

// @note the smoke test requires the community database module, which supports
// SQLite. The check below refuses early with a clear message when a deployment
// has replaced that module with an implementation that does not.

const PORT = process.env.SMOKE_PORT || 4123
const BASE = `http://localhost:${PORT}`
const EMAIL = 'smoke@example.com'

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbk-smoke-'))

const env = {
  ...Object.fromEntries(
    // @note start from a clean slate: only the toolchain basics survive, so
    // a configured shell cannot leak deployment configuration into the run
    Object.entries(process.env).filter(([key]) =>
      /^(PATH|HOME|USER|SHELL|TMPDIR|NODE|COREPACK|PNPM|NPM)/.test(key)
    )
  ),

  NODE_ENV: 'development',

  SITE_URL: BASE,
  NEXTAUTH_URL: BASE,
  NEXTAUTH_SECRET: 'smoke-test-secret-smoke-test-secret',
  JWT_TOKEN_SECRET_KEY: 'smoke-test-secret-smoke-test-secret',

  PRISMA_DATABASE_URL: `file:${path.join(workdir, 'smoke.db')}`,

  SKIP_VERIFICATION_REQUEST: 'true',
}

const logs = []

/** @param {string} message */
function step(message) {
  process.stdout.write(`[smoke] ${message}\n`)
}

/** @param {string} message */
function fail(message) {
  process.stderr.write(`[smoke] FAIL: ${message}\n`)
  process.stderr.write(logs.slice(-40).join(''))
  process.exit(1)
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env,
      ...options,
    })

    child.on('exit', (code) =>
      code === 0
        ? resolve(undefined)
        : reject(new Error(`${command} exited ${code}`))
    )
  })
}

// --- a minimal cookie jar ----------------------------------------------------

const jar = new Map()

function storeCookies(response) {
  for (const value of response.headers.getSetCookie?.() ?? []) {
    const [pair] = value.split(';')
    const [name, ...rest] = pair.split('=')

    jar.set(name.trim(), rest.join('='))
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

async function request(pathname, options = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    redirect: 'manual',
    ...options,
    headers: {
      cookie: cookieHeader(),
      // @note cookie-authenticated API calls need CSRF protection - the
      // XMLHttpRequest marker is what the platform's own frontend sends
      'x-requested-with': 'XMLHttpRequest',
      ...(options.headers || {}),
    },
  })

  storeCookies(response)

  return response
}

// --- the run -----------------------------------------------------------------

async function main() {
  step(`workdir ${workdir}`)

  // resolve the workspace root (the directory holding pnpm-workspace.yaml)
  let root = process.cwd()

  while (!fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(root)

    if (parent === root) {
      fail('no pnpm workspace root found above ' + process.cwd())
    }

    root = parent
  }

  {
    const resolve = createRequire(
      path.join(process.cwd(), 'package.json')
    ).resolve
    const dbManifest = resolve('@chatbotkit-dev/db/package.json')
    const { name } = JSON.parse(fs.readFileSync(dbManifest, 'utf8'))

    if (name !== '@chatbotkit-dev/db') {
      fail(
        `the database module resolves to ${name}; run this test with the community @chatbotkit-dev/db module, which supports SQLite`
      )
    }
  }

  step('generating the database client and pushing the schema (sqlite)')
  await run('pnpm', ['-F', '@chatbotkit-dev/db', 'db:gen'], { cwd: root })
  await run('pnpm', ['-F', '@chatbotkit-dev/db', 'db:push'], { cwd: root })

  step('starting the dev server')

  const server = spawn('pnpm', ['next', 'dev', '-p', String(PORT)], {
    env,
    cwd: process.cwd(),
  })

  server.stdout.on('data', (chunk) => logs.push(chunk.toString()))
  server.stderr.on('data', (chunk) => logs.push(chunk.toString()))

  const cleanup = () => {
    try {
      process.kill(-server.pid, 'SIGTERM')
    } catch {
      server.kill('SIGTERM')
    }
  }

  process.on('exit', cleanup)

  try {
    // 1. the server comes up

    step('waiting for the server')

    const deadline = Date.now() + 300_000

    for (;;) {
      try {
        const response = await fetch(`${BASE}/`, { redirect: 'manual' })

        if (response.status < 500) {
          break
        }
      } catch {
        // not up yet
      }

      if (Date.now() > deadline) {
        fail('server did not come up in time')
      }

      await new Promise((r) => setTimeout(r, 2000))
    }

    // 2. planless shape: no plans are served, no billing surface exists

    step('asserting the planless shape')
    {
      const response = await request('/api/v1/platform/subscription/list')
      const body = await response.json().catch(() => null)

      if (response.status !== 200 || !body || Object.keys(body).length > 0) {
        fail(
          `subscription/list should serve an empty shape, got ${
            response.status
          }: ${JSON.stringify(body)}`
        )
      }
    }

    {
      const response = await request('/billing/upgrade')

      if (response.status !== 404) {
        fail(
          `/billing/upgrade should 404 without billing, got ${response.status}`
        )
      }
    }

    {
      const response = await request('/api/billing/session', { method: 'POST' })

      if (response.status !== 404) {
        fail(
          `/api/billing/session should 404 without billing, got ${response.status}`
        )
      }
    }

    // 3. sign in through the email code flow

    step('signing in via the email code flow')

    const csrfResponse = await request('/api/auth/csrf')
    const { csrfToken } = await csrfResponse.json()

    if (!csrfToken) {
      fail('no csrf token')
    }

    await request('/api/auth/signin/email', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken, email: EMAIL }).toString(),
    })

    // the dev flow prints the sign-in code to the server log
    let token = null
    const tokenDeadline = Date.now() + 30_000

    while (!token && Date.now() < tokenDeadline) {
      // @note `log('login token', { token })` pretty-prints the object, so
      // the value sits on its own line below the label
      const match = logs
        .join('')
        .match(/login token[\s\S]{0,200}?["']token["']\s*:\s*["']([^"']+)["']/)

      if (match) {
        token = match[1]
      } else {
        await new Promise((r) => setTimeout(r, 500))
      }
    }

    if (!token) {
      fail('sign-in code never appeared in the server log')
    }

    const callbackResponse = await request(
      `/api/auth/callback/email?${new URLSearchParams({ email: EMAIL, token })}`
    )

    if (![302, 307].includes(callbackResponse.status)) {
      fail(`auth callback should redirect, got ${callbackResponse.status}`)
    }

    const sessionResponse = await request('/api/auth/session')
    const session = await sessionResponse.json().catch(() => null)

    if (!session?.user) {
      fail(`no session after sign-in: ${JSON.stringify(session)}`)
    }

    step(`signed in as ${session.user.email || EMAIL}`)

    // 4. the session exposes no plan name

    {
      const response = await request('/api/v1/me/fetch')
      const body = await response.json().catch(() => null)

      if (response.status !== 200) {
        fail(`me/fetch returned ${response.status}`)
      }

      if (body && 'plan' in body) {
        fail(
          `me/fetch leaks a plan name in a planless deployment: ${JSON.stringify(
            body
          )}`
        )
      }
    }

    // 5. one useful end-to-end interaction: create a bot and list it back,
    //    proving the write path passes the (planless, unlimited) limit checks

    step('creating a bot')

    const createResponse = await request('/api/v1/bot/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke Bot' }),
    })
    const created = await createResponse.json().catch(() => null)

    if (createResponse.status !== 200 || !created?.id) {
      fail(
        `bot/create failed with ${createResponse.status}: ${JSON.stringify(
          created
        )}`
      )
    }

    const listResponse = await request('/api/v1/bot/list')
    const listed = await listResponse.text()

    if (listResponse.status !== 200 || !listed.includes(created.id)) {
      fail(`bot/list did not return the created bot (${listResponse.status})`)
    }

    step('OK - fresh install boots, sells nothing, refuses nothing, and works')
  } finally {
    cleanup()
    fs.rmSync(workdir, { recursive: true, force: true })
  }
}

main().catch((error) => fail(error.stack || String(error)))
