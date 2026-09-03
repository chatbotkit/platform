// @note CommonJS transform: these tests use `jest.mock` hoisting and the `jest`
// global, neither of which is available under the ESM preset.

export default {
  preset: 'ts-jest',
  roots: ['<rootDir>/src'],
  testEnvironment: '@chatbotkit-dev/jest-jsdom',

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
