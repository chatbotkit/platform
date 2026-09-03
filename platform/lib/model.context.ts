import debug from '@/lib/debug'

import { AsyncLocalStorage } from 'async_hooks'

interface Store {
  openaiKey?: string
  openaiUrl?: string
  mistralKey?: string
  mistralUrl?: string
  groqKey?: string
  groqUrl?: string
  openrouterKey?: string
  openrouterUrl?: string
  perplexityKey?: string
  perplexityUrl?: string
  deepseekKey?: string
  deepseekUrl?: string
  zaiKey?: string
  zaiUrl?: string
  moonshotKey?: string
  moonshotUrl?: string
  qwenKey?: string
  qwenUrl?: string
  vertexKey?: string
  vertexUrl?: string
  bedrockKey?: string
  bedrockUrl?: string
  vercelKey?: string
  vercelUrl?: string
  cloudflareKey?: string
  cloudflareUrl?: string
}

const als = new AsyncLocalStorage<Store>()

/**
 * Wraps the given function in the model context.
 */
export function wrapInModelContext<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async function (...args: TArgs) {
    return await als.run(getSafeModelStore(), async () => {
      debug(`running in model context`)

      return await fn(...args)
    })
  }
}

/**
 * Runs the given function in the model context.
 */
export function runInModelContext<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  ...args: TArgs
): Promise<TReturn> {
  return wrapInModelContext(fn)(...args)
}

/**
 * Gets the model store.
 *
 * @throws {Error} if model store is not found
 */
export function getModelStore(): Store {
  const store = als.getStore()

  if (!store) {
    throw new Error('Model store not found')
  }

  return store
}

/**
 * Gets the model store.
 */
export function getSafeModelStore(): Store {
  const store = als.getStore()

  return store || {}
}
