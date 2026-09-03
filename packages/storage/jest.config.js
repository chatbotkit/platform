export default {
  preset: 'ts-jest/presets/js-with-ts-esm',
  roots: ['<rootDir>/src'],
  testEnvironment: '@chatbotkit-dev/jest-jsdom',
  // @note the AWS SDK ships a `browser` export condition that is ESM-only;
  // under jsdom jest would otherwise resolve it instead of the CJS build
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
}
