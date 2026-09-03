// @note CommonJS transform: these tests use `jest.mock` hoisting and the `jest`
// global, neither of which is available under the ESM preset.

export default {
  preset: 'ts-jest',
  roots: ['<rootDir>/src'],
  testEnvironment: '@chatbotkit-dev/jest-jsdom',

  // @note matches the platform configuration these tests were written under;
  // several of them exercise timing behaviour that exceeds the jest default
  testTimeout: 120000,

  transform: {
    '^.+\\.[jt]sx?$': [
      'ts-jest',
      {
        useESM: false,
        // @note transpile only. Type checking is the `check` script's job.
        tsconfig: { module: 'commonjs', esModuleInterop: true, allowJs: true },
      },
    ],
  },
}
