// @note CommonJS transform: these tests use `jest.mock` hoisting.
//
// The remark and unified ecosystem is ESM only, so those packages have to be
// transformed rather than ignored. platform carries the same allowlist in its
// jest configuration for the same reason.

const ESM_PACKAGES = [
  'unified',
  'remark(-.+?)?',
  'rehype(-.+?)?',
  'micromark(-.+?)?',
  'mdast(-.+?)?',
  'unist(-.+?)?',
  'vfile(-.+?)?',
  'hast(-.+?)?',
  'devlop',
  'trim-lines',
  'zwitch',
  'longest-streak',
  'ccount',
  'escape-string-regexp',
  'stringify-entities',
  'character-entities(-.+?)?',
  'decode-named-character-reference',
  'comma-separated-tokens',
  'space-separated-tokens',
  'property-information',
  'html-void-elements',
  'web-namespaces',
  'is-plain-obj',
  'bail',
  'trough',
  'markdown(-.+?)?',
]

export default {
  preset: 'ts-jest',
  roots: ['<rootDir>/src'],
  testEnvironment: '@chatbotkit-dev/jest-jsdom',
  testTimeout: 120000,

  transformIgnorePatterns: [
    `node_modules/(?!(${ESM_PACKAGES.flatMap((pkg) => [
      pkg,
      `\\.pnpm/${pkg}@\\d+\\.\\d+\\.\\d+([-_].+?)?`,
    ]).join('|')})/)`,
  ],

  transform: {
    '^.+\\.[jt]sx?$': [
      'ts-jest',
      {
        useESM: false,
        // @note transpile only. Type checking is the `check` script's job, and
        // doing it here would also type check sources pulled in from sibling
        // packages against this package's configuration.
        tsconfig: { module: 'commonjs', esModuleInterop: true, allowJs: true },
      },
    ],
  },
}
