// @note the node environment, not the shared jsdom one. `just-bash` picks its
// bundle from the resolver's export conditions, and under jsdom it resolves the
// browser build - whose `python3` is a stub that reports "not available in
// browser environments". The platform runs these commands in node, so testing
// against the browser bundle would be testing a build nothing uses.

export default {
  preset: 'ts-jest/presets/js-with-ts-esm',
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
}
