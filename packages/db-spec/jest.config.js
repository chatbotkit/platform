// @note diagnostics are off. This package sets `checkJs`, because its source is
// JavaScript and the JSDoc annotation is what enforces the spec - see
// src/index.js - and ts-jest would then type check every .js file it transforms,
// including the test environment itself, which was never written against this
// tsconfig. Tests are run, not compiled; `pnpm check` is what type checks this
// package. See packages/AGENTS.md.

export default {
  preset: 'ts-jest/presets/js-with-ts-esm',
  roots: ['<rootDir>/src'],
  testEnvironment: '@chatbotkit-dev/jest-jsdom',

  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { useESM: true, diagnostics: false }],
  },
}
