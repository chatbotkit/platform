// @note CommonJS transform: these tests use `jest.mock` hoisting, which is not
// available under ESM.

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
