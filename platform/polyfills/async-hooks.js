// No-op polyfill for the async_hooks Node.js built-in.
// The browser has no concept of async context tracking, so all exports are
// stubbed with functions that do nothing and return safe default values.

export class AsyncLocalStorage {
  getStore() {
    return undefined
  }

  run(_store, callback, ...args) {
    return callback(...args)
  }

  exit(callback, ...args) {
    return callback(...args)
  }

  enterWith() {}

  disable() {}
}

export class AsyncResource {
  constructor() {}

  runInAsyncScope(fn, _thisArg, ...args) {
    return fn(...args)
  }

  bind(fn) {
    return fn
  }

  static bind(fn) {
    return fn
  }

  emitDestroy() {
    return this
  }
}

export function createHook() {
  return { enable() {}, disable() {} }
}

export function executionAsyncId() {
  return 0
}

export function triggerAsyncId() {
  return 0
}

export function executionAsyncResource() {
  return {}
}

export const asyncWrapProviders = {}
