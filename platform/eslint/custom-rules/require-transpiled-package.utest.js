/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { RuleTester } = require('eslint')

const rule = require('./require-transpiled-package')
const {
  isSourceOnlyManifest,
  parseTranspiledPackages,
  packageNameOf,
  selectExportEntry,
  subpathOf,
} = require('./lib/transpiled-packages')

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

const cwd = process.cwd()

const options = [
  {
    transpiled: ['@chatbotkit-dev/math', 'listed-pkg'],
    sourceOnly: ['@chatbotkit-dev/math', '@chatbotkit-dev/time', 'listed-pkg', 'raw-pkg'],
  },
]

ruleTester.run('require-transpiled-package', rule, {
  valid: [
    {
      name: 'source-only and listed',
      filename: `${cwd}/config/records.ts`,
      options,
      code: "import { clamp } from '@chatbotkit-dev/math'",
    },
    {
      name: 'source-only, listed, deep subpath',
      filename: `${cwd}/config/records.ts`,
      options,
      code: "import { clamp } from '@chatbotkit-dev/math/src/index'",
    },
    {
      name: 'compiled package unlisted',
      filename: `${cwd}/lib/thing.ts`,
      options,
      code: "import React from 'react'",
    },
    {
      name: 'relative import',
      filename: `${cwd}/lib/thing.ts`,
      options,
      code: "import { a } from './raw-pkg'",
    },
    {
      name: 'alias import',
      filename: `${cwd}/lib/thing.ts`,
      options,
      code: "import { a } from '@/lib/raw-pkg'",
    },
    {
      name: 'node builtin',
      filename: `${cwd}/lib/thing.ts`,
      options,
      code: "import fs from 'node:fs'\nimport path from 'path'",
    },
    {
      name: 'type-only import from a source-only unlisted package',
      filename: `${cwd}/lib/thing.ts`,
      options,
      code: "import type { Duration } from '@chatbotkit-dev/time'",
    },
    {
      name: 'type-only re-export from a source-only unlisted package',
      filename: `${cwd}/lib/thing.ts`,
      options,
      code: "export type { Duration } from '@chatbotkit-dev/time'",
    },
    {
      name: 'test file is skipped',
      filename: `${cwd}/lib/thing.utest.ts`,
      options,
      code: "import { a } from 'raw-pkg'",
    },
    {
      name: 'file outside the app is skipped',
      filename: `/somewhere/else/thing.ts`,
      options,
      code: "import { a } from 'raw-pkg'",
    },
    {
      name: 'no node_modules on disk reports nothing',
      filename: `${cwd}/lib/thing.ts`,
      code: "import { a } from 'definitely-not-installed-anywhere-xyz'",
    },
  ],
  invalid: [
    {
      name: 'source-only and unlisted',
      filename: `${cwd}/lib/thing.ts`,
      options,
      code: "import { a } from 'raw-pkg'",
      errors: [{ messageId: 'notTranspiled', data: { name: 'raw-pkg' } }],
    },
    {
      name: 'scoped source-only and unlisted',
      filename: `${cwd}/lib/thing.ts`,
      options,
      code: "import { now } from '@chatbotkit-dev/time'",
      errors: [
        { messageId: 'notTranspiled', data: { name: '@chatbotkit-dev/time' } },
      ],
    },
    {
      name: 'value re-export from source-only unlisted',
      filename: `${cwd}/lib/thing.ts`,
      options,
      code: "export { now } from '@chatbotkit-dev/time'",
      errors: [{ messageId: 'notTranspiled' }],
    },
    {
      name: 'export star from source-only unlisted',
      filename: `${cwd}/lib/thing.ts`,
      options,
      code: "export * from '@chatbotkit-dev/time'",
      errors: [{ messageId: 'notTranspiled' }],
    },
    {
      name: 'dynamic import from source-only unlisted',
      filename: `${cwd}/lib/thing.ts`,
      options,
      code: "const m = await import('@chatbotkit-dev/time')",
      errors: [{ messageId: 'notTranspiled' }],
    },
    {
      name: 'require of source-only unlisted',
      filename: `${cwd}/scripts/job.js`,
      options,
      code: "const m = require('raw-pkg')",
      errors: [{ messageId: 'notTranspiled' }],
    },
  ],
})

describe('transpiled-packages helpers', () => {
  it('detects source-only manifests', () => {
    expect(isSourceOnlyManifest({ main: './src/index.ts' })).toBe(true)
    expect(isSourceOnlyManifest({ module: './src/index.tsx' })).toBe(true)
    expect(
      isSourceOnlyManifest({
        exports: { '.': { types: './types/index.d.ts', import: './src/index.ts' } },
      })
    ).toBe(true)
    expect(
      isSourceOnlyManifest({
        main: './dist/index.js',
        types: './dist/index.d.ts',
        exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
      })
    ).toBe(false)
    expect(isSourceOnlyManifest({ exports: { '.': { types: './src/index.ts' } } })).toBe(false)
    expect(
      isSourceOnlyManifest({
        exports: {
          '.': {
            '@zod/source': './src/index.ts',
            source: './src/index.ts',
            types: './index.d.ts',
            import: './index.js',
            require: './index.cjs',
          },
        },
      })
    ).toBe(false)
    expect(
      isSourceOnlyManifest({
        exports: { './sub': { node: { import: './src/sub.ts' } } },
      }, './sub')
    ).toBe(true)
    expect(isSourceOnlyManifest(null)).toBe(false)
  })

  it('only looks at the exports entry the specifier resolves to', () => {
    // @note lucide-react: compiled root, a `./src/*` subpath that ships `.ts`
    const lucide = {
      main: 'dist/esm/lucide-react.js',
      exports: {
        '.': { types: './dist/lucide-react.d.ts', import: './dist/esm/lucide-react.js' },
        './icons/*': { import: './dist/esm/icons/*.js' },
        './src/*': './src/*.ts',
        './package.json': './package.json',
      },
    }

    expect(isSourceOnlyManifest(lucide, '.')).toBe(false)
    expect(isSourceOnlyManifest(lucide, './icons/x')).toBe(false)
    expect(isSourceOnlyManifest(lucide, './src/x')).toBe(true)
    expect(isSourceOnlyManifest({ exports: './src/index.ts' }, '.')).toBe(true)
    expect(isSourceOnlyManifest({ exports: './src/index.ts' }, './x')).toBe(false)
    expect(isSourceOnlyManifest({ main: './dist/index.js' }, './src/x.ts')).toBe(true)
    expect(isSourceOnlyManifest({ main: './dist/index.js' }, './dist/x.js')).toBe(false)
    expect(selectExportEntry({ './a/*': 1, './a/b/*': 2 }, './a/b/c')).toBe(2)
  })

  it('parses the packages array by whole name', () => {
    const names = parseTranspiledPackages(
      "const other = ['x']\nconst packages = [\n  '@chatbotkit-dev/math',\n  \"react-prompt-kit\",\n]\nconst after = ['y']"
    )

    expect([...names]).toEqual(['@chatbotkit-dev/math', 'react-prompt-kit'])
    expect(names.has('@chatbotkit-dev/mat')).toBe(false)
    expect(names.has('x')).toBe(false)
  })

  it('extracts bare package names', () => {
    expect(packageNameOf('react')).toBe('react')
    expect(packageNameOf('react/jsx-runtime')).toBe('react')
    expect(packageNameOf('@scope/pkg/deep')).toBe('@scope/pkg')
    expect(packageNameOf('./x')).toBeNull()
    expect(packageNameOf('@/lib/x')).toBeNull()
    expect(packageNameOf('node:fs')).toBeNull()
    expect(packageNameOf('fs')).toBeNull()
    expect(subpathOf('react', 'react')).toBe('.')
    expect(subpathOf('@scope/pkg/deep/x', '@scope/pkg')).toBe('./deep/x')
  })
})
