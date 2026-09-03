/* eslint-disable import/extensions */
import nextJest from 'next/jest.js'

import { getWorkspacePatterns } from './jest/workspace.patterns.js'

import json5 from 'json5'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')

const tsconfig = json5.parse(fs.readFileSync('./tsconfig.json', 'utf8'))

const workspacePackagesBase = fs.existsSync(path.resolve('../packages'))
  ? '<rootDir>/../packages'
  : '<rootDir>/node_modules/@chatbotkit-dev'

const reactPromptKitBase = fs.existsSync(
  path.resolve('../packages/react-prompt-kit')
)
  ? '<rootDir>/../packages/react-prompt-kit'
  : '<rootDir>/node_modules/react-prompt-kit'

const chatbotkitSourcePackages = ['fetch', 'sdk', 'react', 'next'].filter(
  (pkg) =>
    fs.existsSync(path.resolve(`node_modules/@chatbotkit/${pkg}/src/index.js`))
)

const createNextJestConfig = nextJest({
  // @note omitting dir keeps the remote integration suite independent from the
  // Next application configuration while retaining the SWC Jest transformer
  // dir: './',
  //
  // testEnvironment: 'jsdom',
})

/** @type {import('jest').Config} */
const customJestConfig = {
  coverageProvider: 'v8',

  testEnvironment: '@chatbotkit-dev/jest-jsdom',

  resolver: `./jest/resolver.js`,

  roots: ['<rootDir>/'],

  testMatch: ['**/?(*.)+(itest).?([mc])[jt]s?(x)'],

  moduleDirectories: ['node_modules', '<rootDir>/'],

  modulePathIgnorePatterns: !!process.env.SKIP_TEST ? ['<rootDir>/'] : [],

  // @note CI runners are dedicated, so use every core there; locally half
  // keeps the machine responsive while the suite runs
  maxWorkers: process.env.CI ? '100%' : '50%',

  // @note pinned inside the project so CI can persist it between runs; the
  // default lands in the OS temp directory, which a fresh runner starts empty
  cacheDirectory: path.resolve('.jest-cache'),

  // @note long-lived workers accumulate V8 state that has crashed the suite
  // mid-run under the v8 coverage provider (fatal scope-iterator assert,
  // SIGTRAP/exit 133); recycling any worker that idles above this limit keeps
  // each process short-lived and bounds the suite's memory
  workerIdleMemoryLimit: '2GB',

  clearMocks: true,

  bail: true,
  verbose: true,

  setupFilesAfterEnv: ['jest-extended/all'],

  passWithNoTests: !!process.env.SKIP_TEST ? true : false,

  moduleNameMapper: {
    // map packages

    // @note those are not required for the local environment but for the CI/CD
    // pipeline - we need a better way to handle this

    ...Object.fromEntries(
      [
        'typescript-utils',
        'template',
        'time',
        'buffer',
        'encoding',
        'cloak',
        'gpt',
        'file',
        'file-txt',
        'file-md',
        'file-html',
        'file-csv',
        'file-json',
        'file-jsonl',
        'file-yaml',
        'file-pdf',
        'file-docx',
        'file-pptx',
        'file-xlsx',
        'sql',
      ].flatMap((pkg) => {
        return [
          [
            `^@chatbotkit-dev/${pkg}$`,
            `${workspacePackagesBase}/${pkg}/src/index.ts`,
          ],
          [
            `^@chatbotkit-dev/${pkg}/(.+?)$`,
            `${workspacePackagesBase}/${pkg}/src/$1.ts`,
          ],
        ]
      })
    ),

    // @note workspace-linked SDK packages expose source imports that Jest's
    // CommonJS resolver cannot select, so map those packages to source. A
    // standalone deployment installs the published packages without `src`;
    // leave those unmapped so Jest follows their `exports.require` entry.
    ...Object.fromEntries(
      chatbotkitSourcePackages.flatMap((pkg) => {
        const base = `<rootDir>/node_modules/@chatbotkit/${pkg}/src`

        return [
          [`^@chatbotkit/${pkg}$`, `${base}/index.js`],
          [`^@chatbotkit/${pkg}/(.+?\\.js)$`, `${base}/$1`],
          [`^@chatbotkit/${pkg}/(.+?)$`, `${base}/$1.js`],
        ]
      })
    ),

    ...Object.fromEntries(
      ['react-prompt-kit'].flatMap((pkg) => {
        return [
          [`^${pkg}$`, `${reactPromptKitBase}/src/index.ts`],
          [`^${pkg}/src$`, `${reactPromptKitBase}/src/index.ts`],
          [`^${pkg}/(.+?)$`, `${reactPromptKitBase}/src/$1.ts`],
        ]
      })
    ),

    // load tsconfig paths

    ...Object.fromEntries(
      Object.entries(tsconfig.compilerOptions.paths).map(([key, [value]]) => [
        // @note we need to anchor the pattern with ^ to avoid matching paths
        // like es5-ext/string/#/contains which contain # in the middle
        `^${key.replace('/*', '/(.*)')}`,
        `<rootDir>/${value.replace('/*', '/$1')}`,
      ])
    ),
  },

  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'yaml', 'json'],

  transform: {
    '\\.yaml$': 'jest-transform-yaml',
  },

  globals: {
    Uint8Array: Uint8Array,
  },

  collectCoverage: !!process.env.TEST_COVERAGE,

  testTimeout: 120000,
}

// workaround for https://github.com/vercel/next.js/issues/35634

export default async function () {
  // load env
  {
    const projectDir = process.cwd()

    loadEnvConfig(projectDir)
  }

  const jestConfig = await createNextJestConfig(customJestConfig)()

  // transpile packages
  {
    const packages = [
      // parse-domain and friends

      'parse-domain',
      'is-ip',
      'ip-regex',
      'super-regex',
      'function-timeout',
      'time-span',
      'clone-regexp',
      'is-regexp',

      // jose

      'jose',

      // mime

      'mime',

      // node-fetch-native

      'node-fetch-native',

      // uuid

      'uuid',

      // uncrypto

      'uncrypto',
    ]

    // @note this is a MINEFIELD - for whatever reason this is the only way to
    // make the transformIgnorePatterns to work

    // @note this is related somehow to next transpilePackages - when we add
    // packages to transpile this no longer work - it works otherwise - shifting
    // pushing or any other transformation on the array does not work

    // @note the workspace's own packages are published as TypeScript source, so
    // they always need transforming. Locally that happens by accident: pnpm
    // symlinks them, the resolved path is outside node_modules, and this
    // pattern never applies. `pnpm deploy` materialises them *inside*
    // node_modules/.pnpm instead, at which point jest stops transforming them
    // and feeds raw `.ts` to node - which fails only in CI, and only once a
    // shared module has been extracted into a package.
    //
    // Their store directory is `@scope+name@file+packages+name_<hash>`, so the
    // semver template below does not match them either.

    const workspacePatterns = getWorkspacePatterns()

    // @note next/jest 15+ emits two node_modules patterns when
    // transpilePackages is set (a plain one and a pnpm-store one), so every
    // node_modules pattern is replaced rather than only index 0 - the
    // non-node_modules entries (css modules) are kept.

    jestConfig.transformIgnorePatterns = [
      `node_modules/(?!(${[
        ...packages
          .map((pkg) => {
            return [
              `${pkg.replace(/\//g, '.')}`,
              `\\.pnpm/${pkg.replace(/\//g, '.')}@\\d+\\.\\d+\\.\\d+([-_].+?)?`,
            ]
          })
          .flat(1),
        ...workspacePatterns,
      ].join('|')})/)`,
      ...jestConfig.transformIgnorePatterns.filter(
        (pattern) => !pattern.includes('node_modules')
      ),
    ]
  }

  return jestConfig
}
