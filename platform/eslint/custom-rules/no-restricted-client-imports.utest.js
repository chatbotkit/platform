/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { RuleTester } = require('eslint')

const rule = require('./no-restricted-client-imports')

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
})

const cwd = process.cwd()

const options = [
  {
    paths: [
      { source: '@/config/site', reason: 'build-frozen deployment identity.' },
      { source: '@/config/apexes' },
    ],
  },
]

ruleTester.run('no-restricted-client-imports', rule, {
  valid: [
    {
      name: 'server-side lib import',
      filename: `${cwd}/lib/host.ts`,
      code: "import { siteUrl } from '@/config/site'",
      options,
    },
    {
      name: 'api route import',
      filename: `${cwd}/pages/api/v1/thing.js`,
      code: "import { siteUrl } from '@/config/site'",
      options,
    },
    {
      name: 'app router route handler',
      filename: `${cwd}/app/apps/(index)/app.webmanifest/route.ts`,
      code: "import { siteUrl } from '@/config/site'",
      options,
    },
    {
      name: 'unrestricted config module',
      filename: `${cwd}/components/Thing.jsx`,
      code: "import messagesConfig from '@/config/messages'",
      options,
    },
    {
      name: 'test files are skipped',
      filename: `${cwd}/components/Thing.utest.jsx`,
      code: "import { siteUrl } from '@/config/site'",
      options,
    },
  ],
  invalid: [
    {
      name: 'component import',
      filename: `${cwd}/components/Thing.jsx`,
      code: "import { siteUrl } from '@/config/site'",
      options,
      errors: [{ messageId: 'noRestrictedClientImport' }],
    },
    {
      name: 'hook import without a configured reason',
      filename: `${cwd}/hooks/useThing.jsx`,
      code: "import { portalApex } from '@/config/apexes'",
      options,
      errors: [{ messageId: 'noRestrictedClientImport' }],
    },
    {
      name: 're-export',
      filename: `${cwd}/pages/thing/index.jsx`,
      code: "export { siteUrl } from '@/config/site'",
      options,
      errors: [{ messageId: 'noRestrictedClientImport' }],
    },
  ],
})
