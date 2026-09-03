import { TestEnvironment } from 'jest-environment-jsdom'

import crypto from 'node:crypto'

const nativeFetch = globalThis.fetch
const NativeRequest = globalThis.Request
const NativeAbortController = globalThis.AbortController
const NativeAbortSignal = globalThis.AbortSignal

/**
 * @param {AbortSignal | null | undefined} sourceSignal
 */
const bridgeAbortSignal = (sourceSignal) => {
  if (
    !sourceSignal ||
    NativeAbortSignal.prototype.isPrototypeOf(sourceSignal)
  ) {
    return {
      signal: sourceSignal,
      cleanup: () => {},
    }
  }

  const controller = new NativeAbortController()
  const abort = () => controller.abort(sourceSignal.reason)

  if (sourceSignal.aborted) {
    abort()
  } else {
    sourceSignal.addEventListener('abort', abort, { once: true })
  }

  return {
    signal: controller.signal,
    cleanup: () => sourceSignal.removeEventListener('abort', abort),
  }
}

export default class CustomTestEnvironment extends TestEnvironment {
  async setup() {
    await super.setup()

    // fetch
    {
      if (typeof this.global.fetch === 'undefined') {
        // @note bridge jsdom signals because node fetch performs a native brand check
        this.global.fetch = (input, init) => {
          const sourceSignal = init?.signal
          const { signal, cleanup } = bridgeAbortSignal(sourceSignal)

          return nativeFetch(input, {
            ...init,
            signal,
          }).finally(cleanup)
        }
      }
    }

    // Request
    {
      if (typeof this.global.Request === 'undefined') {
        // @note bridge jsdom signals because node Request performs a native brand check
        this.global.Request = class Request extends NativeRequest {
          /**
           * @param {RequestInfo | URL} input
           * @param {RequestInit} [init]
           */
          constructor(input, init) {
            const { signal } = bridgeAbortSignal(init?.signal)

            super(input, {
              ...init,
              signal,
            })
          }
        }
      }
    }

    // Response
    {
      if (typeof this.global.Response === 'undefined') {
        this.global.Response = Response
      }
    }

    // Headers
    {
      this.global.Headers = Headers
    }

    // TransformStream
    {
      if (typeof this.global.TransformStream === 'undefined') {
        this.global.TransformStream = TransformStream
      }
    }

    // BroadcastChannel
    {
      if (typeof this.global.BroadcastChannel === 'undefined') {
        this.global.BroadcastChannel = BroadcastChannel
      }
    }

    // MessageChannel
    {
      // @note React 19's server renderer schedules work through
      // MessageChannel, which jsdom does not provide
      if (typeof this.global.MessageChannel === 'undefined') {
        this.global.MessageChannel = MessageChannel
      }
    }

    // setImmediate
    {
      if (typeof this.global.setImmediate === 'undefined') {
        // @ts-expect-error because
        this.global.setImmediate = (fn, ...args) => {
          return setTimeout(fn, 0, ...args)
        }
      }
    }

    // CryptoKey
    {
      if (typeof this.global.CryptoKey === 'undefined') {
        this.global.CryptoKey = CryptoKey
      }
    }

    // webcrypto
    {
      if (typeof this.global.webcrypto === 'undefined') {
        Object.defineProperty(this.global, 'crypto', {
          value: crypto.webcrypto,
        })
      }
    }

    // AbortSignal.timeout
    {
      if (typeof this.global.AbortSignal.timeout !== 'function') {
        this.global.AbortSignal.timeout = (ms) => {
          const controller = new AbortController()

          setTimeout(() => controller.abort(), ms)

          return controller.signal
        }
      }
    }

    // ReadableStream
    {
      if (typeof this.global.ReadableStream === 'undefined') {
        this.global.ReadableStream = ReadableStream
      }
    }

    // WriteableStream
    {
      if (typeof this.global.WriteableStream === 'undefined') {
        this.global.WritableStream = WritableStream
      }
    }

    // TextEncoder
    {
      if (typeof this.global.TextEncoder === 'undefined') {
        // @ts-ignore-error because
        this.global.TextEncoder = TextEncoder
      }
    }

    // TextDecoder
    {
      if (typeof this.global.TextDecoder === 'undefined') {
        // @ts-ignore-error because
        this.global.TextDecoder = TextDecoder
      }
    }

    // Blob
    {
      this.global.Blob = Blob
    }

    // FormData
    {
      this.global.FormData = FormData
    }

    // Uint8Array
    {
      this.global.Uint8Array = Uint8Array
    }

    // setImmediate
    // @note not sure if this should be here
    {
      if (typeof this.global.setImmediate === 'undefined') {
        // @ts-expect-error because
        this.global.setImmediate = (fn, ...args) => {
          return setTimeout(fn, 0, ...args)
        }
      }
    }

    // structuredClone
    // @note not sure if this should be here
    {
      if (typeof this.global.structuredClone === 'undefined') {
        this.global.structuredClone = (value, options) => {
          return structuredClone(value, options)
        }
      }
    }

    // ResizeObserver
    {
      if (typeof this.global.ResizeObserver === 'undefined') {
        this.global.ResizeObserver = class ResizeObserver {
          observe() {}
          unobserve() {}
          disconnect() {}
        }
      }
    }
  }
}
