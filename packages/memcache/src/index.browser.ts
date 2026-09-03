// @note the browser and edge entry of the community key-value default.
//
// Bundlers resolve this file instead of ./index.ts through the export
// conditions in package.json. It serves the in-process backend only: the
// Redis backend is a TCP client (ioredis) that cannot exist in a browser or
// edge bundle, and REDIS_URL is server configuration that those bundles never
// see. Client-side callers get exactly the behaviour they always had - an
// isolated in-process store - while the node server picks between backends in
// ./index.ts.

// @todo drop this off once you find what is including it

export type * from '@chatbotkit-dev/memcache-spec'

export * from './memory'

export { memcache as default } from './memory'
