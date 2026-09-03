/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { RuleTester } = require('eslint')

const rule = require('./no-global-fetch')

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
})

const cwd = process.cwd()

ruleTester.run('no-global-fetch', rule, {
  valid: [
    {
      name: 'imported plain fetch in lib',
      filename: `${cwd}/lib/thing.ts`,
      code: "import fetch from '@/lib/fetch'\nfetch('https://example.com')",
    },
    {
      name: 'imported egress fetch in a route',
      filename: `${cwd}/pages/api/v1/url/fetch.js`,
      code: "import fetch from '@/lib/egress.fetch'\nfetch(url)",
    },
    {
      name: 'locally declared fetch',
      filename: `${cwd}/lib/thing.ts`,
      code: 'const fetch = makeFetch()\nfetch(url)',
    },
    {
      name: 'fetch declared in an enclosing function scope',
      filename: `${cwd}/scripts/job.js`,
      code: 'function run(fetch) {\n  return fetch(url)\n}',
    },
    {
      name: 'member call named fetch',
      filename: `${cwd}/lib/thing.ts`,
      code: 'client.bot.fetch(id)',
    },
    {
      name: 'test file beside a lib module is skipped',
      filename: `${cwd}/lib/thing.utest.js`,
      code: "fetch('https://example.com')",
    },
    {
      name: 'client component is out of scope',
      filename: `${cwd}/components/Thing.jsx`,
      code: "fetch('/api/v1/bot/list')",
    },
    {
      name: 'client page is out of scope',
      filename: `${cwd}/pages/bots/index.jsx`,
      code: "fetch('/api/v1/bot/list')",
    },
    {
      name: 'app page (not server.ts) is out of scope',
      filename: `${cwd}/app/apps/code/page.tsx`,
      code: "fetch('/api/v1/bot/list')",
    },
  ],
  invalid: [
    {
      name: 'bare global fetch in lib',
      filename: `${cwd}/lib/thing.ts`,
      code: "fetch('https://example.com')",
      errors: [{ messageId: 'noGlobalFetch' }],
    },
    {
      name: 'bare global fetch in a pages route',
      filename: `${cwd}/pages/api/v1/url/fetch.js`,
      code: 'await fetch(url)',
      errors: [{ messageId: 'noGlobalFetch' }],
    },
    {
      name: 'bare global fetch in an app route',
      filename: `${cwd}/app/api/v1/route.ts`,
      code: 'await fetch(url)',
      errors: [{ messageId: 'noGlobalFetch' }],
    },
    {
      name: 'bare global fetch in an app server module',
      filename: `${cwd}/app/apps/inbox/server.ts`,
      code: 'await fetch(url)',
      errors: [{ messageId: 'noGlobalFetch' }],
    },
    {
      name: 'bare global fetch in a script',
      filename: `${cwd}/scripts/job.js`,
      code: 'await fetch(url)',
      errors: [{ messageId: 'noGlobalFetch' }],
    },
    {
      name: 'window.fetch shadow does not count as a declaration',
      filename: `${cwd}/lib/thing.ts`,
      code: 'async function run() {\n  return fetch(url)\n}',
      errors: [{ messageId: 'noGlobalFetch' }],
    },
  ],
})
