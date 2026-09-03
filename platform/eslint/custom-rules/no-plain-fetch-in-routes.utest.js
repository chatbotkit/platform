/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { RuleTester } = require('eslint')

const rule = require('./no-plain-fetch-in-routes')

// @note the plugin-prefixed disable comment used in the routes cannot be
// exercised here - RuleTester registers the rule unprefixed - so that path is
// covered by the real `next lint` run over the annotated routes
const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
})

const ROUTE = '/repo/pages/api/v1/url/fetch.js'
const APP_ROUTE = '/repo/app/api/v1/url/route.ts'
const LIB = '/repo/lib/url3.ts'

ruleTester.run('no-plain-fetch-in-routes', rule, {
  valid: [
    {
      name: 'egress fetch in a route',
      filename: ROUTE,
      code: "import fetch from '@/lib/egress.fetch'",
    },
    {
      name: 'helper-only named imports in a route',
      filename: ROUTE,
      code: "import { getFetchError, withTimeout, anySignal } from '@/lib/fetch'",
    },
    {
      name: 'imported fetch called in a route',
      filename: ROUTE,
      code: "import fetch from '@/lib/egress.fetch'\nfetch(url)",
    },
    {
      name: 'locally declared fetch called in a route',
      filename: ROUTE,
      code: 'const fetch = withTimeout(baseFetch)\nfetch(url)',
    },
    {
      name: 'member call named fetch in a route',
      filename: ROUTE,
      code: 'await prisma.bot.fetch(id)',
    },
    {
      name: 'bare global fetch outside the route directories',
      filename: LIB,
      code: 'fetch(url)',
    },
    {
      name: 'plain fetch outside the route directories',
      filename: LIB,
      code: "import fetch from '@/lib/fetch'",
    },
    {
      name: 'plain fetch in a test beside a route',
      filename: '/repo/pages/api/v1/url/_fetch.utest.js',
      code: "import fetch from '@/lib/fetch'",
    },
  ],
  invalid: [
    {
      name: 'bare global fetch in a pages route',
      filename: ROUTE,
      code: 'await fetch(url)',
      errors: [{ messageId: 'noGlobalFetch' }],
    },
    {
      name: 'bare global fetch in an app route',
      filename: APP_ROUTE,
      code: 'await fetch(url)',
      errors: [{ messageId: 'noGlobalFetch' }],
    },
    {
      name: 'default import in a pages route',
      filename: ROUTE,
      code: "import fetch from '@/lib/fetch'",
      errors: [{ messageId: 'noPlainFetch' }],
    },
    {
      name: 'default import in an app route',
      filename: APP_ROUTE,
      code: "import fetch from '@/lib/fetch'",
      errors: [{ messageId: 'noPlainFetch' }],
    },
    {
      name: 'default import alongside helpers',
      filename: ROUTE,
      code: "import fetch, { getFetchError } from '@/lib/fetch'",
      errors: [{ messageId: 'noPlainFetch' }],
    },
    {
      name: 'named plain fetch and fetchPlusPlus',
      filename: ROUTE,
      code: "import { fetch, fetchPlusPlus, getFetchError } from '@/lib/fetch'",
      errors: [{ messageId: 'noPlainFetch' }, { messageId: 'noPlainFetch' }],
    },
  ],
})
