/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { RuleTester } = require('eslint')

const rule = require('./no-direct-documentation-links')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

ruleTester.run('no-direct-documentation-links', rule, {
  valid: [
    {
      name: 'product documentation component',
      code: '<DocsLink slug="bots">Bots</DocsLink>',
    },
    {
      name: 'technical manual component',
      code: '<ManualLink slug="node-sdk">Node SDK</ManualLink>',
    },
    {
      name: 'ordinary application link',
      code: '<Link href="/support">Support</Link>',
    },
    {
      name: 'unrelated external docs path',
      code: '<a href="https://example.com/docs">Example docs</a>',
    },
    {
      name: 'documentation helper in navigation data',
      code: "const item = { href: getDocsHref('bots') }",
    },
    {
      name: 'dynamic href',
      code: '<Link href={href}>Resource</Link>',
    },
  ],
  invalid: [
    {
      name: 'relative product documentation link',
      code: '<Link href="/docs/bots">Bots</Link>',
      errors: [
        { messageId: 'useLinkComponent', data: { component: 'DocsLink' } },
      ],
    },
    {
      name: 'absolute product documentation link',
      code: '<a href="https://chatbotkit.com/docs/bots">Bots</a>',
      errors: [
        { messageId: 'useLinkComponent', data: { component: 'DocsLink' } },
      ],
    },
    {
      name: 'technical manual link',
      code: '<Link href="https://docs.cbk.ai/node-sdk">Node SDK</Link>',
      errors: [
        { messageId: 'useLinkComponent', data: { component: 'ManualLink' } },
      ],
    },
    {
      name: 'templated product documentation link',
      code: '<Link href={`/docs/${slug}`}>Documentation</Link>',
      errors: [
        { messageId: 'useLinkComponent', data: { component: 'DocsLink' } },
      ],
    },
    {
      name: 'concatenated technical manual link',
      code: "<Link href={'https://docs.cbk.ai/' + slug}>Manual</Link>",
      errors: [
        { messageId: 'useLinkComponent', data: { component: 'ManualLink' } },
      ],
    },
    {
      name: 'legacy manual path',
      code: '<Link href="/manuals/node-sdk">Node SDK</Link>',
      errors: [
        { messageId: 'useLinkComponent', data: { component: 'ManualLink' } },
      ],
    },
    {
      name: 'manual URL passed to product documentation component',
      code: '<DocsLink href="https://docs.cbk.ai/users">Users</DocsLink>',
      errors: [
        { messageId: 'useLinkComponent', data: { component: 'ManualLink' } },
      ],
    },
    {
      name: 'direct product documentation href in navigation data',
      code: "const item = { href: '/docs' }",
      errors: [{ messageId: 'useLinkHelper', data: { component: 'DocsLink' } }],
    },
    {
      name: 'direct manual href in navigation data',
      code: "const item = { href: 'https://docs.cbk.ai/spec/v1' }",
      errors: [
        { messageId: 'useLinkHelper', data: { component: 'ManualLink' } },
      ],
    },
  ],
})
