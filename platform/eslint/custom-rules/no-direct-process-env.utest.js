/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { RuleTester } = require('eslint')

const rule = require('./no-direct-process-env')

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
})

const cwd = process.cwd()

ruleTester.run('no-direct-process-env', rule, {
  valid: [
    {
      name: 'server-side lib read',
      filename: `${cwd}/lib/host.ts`,
      code: 'const url = process.env.SITE_URL',
    },
    {
      name: 'api route read',
      filename: `${cwd}/pages/api/v1/thing.js`,
      code: 'const url = process.env.SITE_URL',
    },
    {
      name: 'NODE_ENV is allowed',
      filename: `${cwd}/components/Thing.jsx`,
      code: "const dev = process.env.NODE_ENV === 'development'",
    },
    {
      name: 'NEXT_PUBLIC_ is allowed',
      filename: `${cwd}/components/Thing.jsx`,
      code: 'const id = process.env.NEXT_PUBLIC_GTAG_ID',
    },
    {
      name: 'configured allow list',
      filename: `${cwd}/components/Thing.jsx`,
      code: 'const t = process.env.TARGET_ENV',
      options: [{ allow: ['TARGET_ENV'] }],
    },
    {
      name: 'read inside getServerSideProps',
      filename: `${cwd}/pages/thing/index.jsx`,
      code: 'export async function getServerSideProps() {\n  return { props: { url: process.env.SITE_URL } }\n}',
    },
    {
      name: 'read inside wrapped getStaticProps',
      filename: `${cwd}/pages/thing/index.jsx`,
      code: 'export const getStaticProps = withRevalidation(async function () {\n  return { props: { url: process.env.SITE_URL } }\n})',
    },
    {
      name: 'read inside class getInitialProps',
      filename: `${cwd}/pages/_document.jsx`,
      code: 'export default class Document {\n  static async getInitialProps() {\n    return { url: process.env.SITE_URL }\n  }\n}',
    },
    {
      name: 'test files are skipped',
      filename: `${cwd}/components/Thing.utest.jsx`,
      code: 'const url = process.env.SITE_URL',
    },
    {
      name: 'app router server module',
      filename: `${cwd}/app/apps/chat/server.tsx`,
      code: 'const url = process.env.SITE_URL',
    },
    {
      name: 'process.env passed as a value inside getServerSideProps',
      filename: `${cwd}/pages/thing/index.jsx`,
      code: 'export async function getServerSideProps() {\n  return { props: schema.parse(process.env) }\n}',
    },
  ],
  invalid: [
    {
      name: 'component render read',
      filename: `${cwd}/components/Thing.jsx`,
      code: 'export default function Thing() {\n  return process.env.SITE_URL\n}',
      errors: [{ messageId: 'noDirectProcessEnv' }],
    },
    {
      name: 'hook read',
      filename: `${cwd}/hooks/useThing.jsx`,
      code: 'const base = process.env.SITE_URL',
      errors: [{ messageId: 'noDirectProcessEnv' }],
    },
    {
      name: 'page module-level read',
      filename: `${cwd}/pages/thing/index.jsx`,
      code: 'const base = process.env.SITE_URL',
      errors: [{ messageId: 'noDirectProcessEnv' }],
    },
    {
      name: 'computed read',
      filename: `${cwd}/components/Thing.jsx`,
      code: "const url = process.env['SITE_URL']",
      errors: [{ messageId: 'noDirectProcessEnv' }],
    },
    {
      name: 'destructured read',
      filename: `${cwd}/components/Thing.jsx`,
      code: 'const { SITE_URL } = process.env',
      errors: [{ messageId: 'noDirectProcessEnv' }],
    },
    {
      name: 'embed bundle read',
      filename: `${cwd}/embeds/widget/v2.ts`,
      code: 'const url = process.env.STATIC_URL',
      errors: [{ messageId: 'noDirectProcessEnv' }],
    },
    {
      name: 'read in a regular function next to getServerSideProps',
      filename: `${cwd}/pages/thing/index.jsx`,
      code: 'export async function getServerSideProps() {\n  return { props: {} }\n}\n\nexport default function Thing() {\n  return process.env.SITE_URL\n}',
      errors: [{ messageId: 'noDirectProcessEnv' }],
    },
    {
      name: 'process.env passed as a value',
      filename: `${cwd}/components/Thing.jsx`,
      code: 'const env = schema.parse(process.env)',
      errors: [{ messageId: 'noBareProcessEnv' }],
    },
    {
      name: 'process.env spread',
      filename: `${cwd}/components/Thing.jsx`,
      code: 'const env = { ...process.env }',
      errors: [{ messageId: 'noBareProcessEnv' }],
    },
    {
      name: 'process.env aliased',
      filename: `${cwd}/components/Thing.jsx`,
      code: 'const env = process.env',
      errors: [{ messageId: 'noBareProcessEnv' }],
    },
    {
      name: 'process.env enumerated',
      filename: `${cwd}/components/Thing.jsx`,
      code: 'const keys = Object.entries(process.env)',
      errors: [{ messageId: 'noBareProcessEnv' }],
    },
  ],
})
