import '@/lib/scope.server'

import type { Session } from 'next-auth'

import { getUserAppConfig } from '@/lib/app.router.app.config'
import { getSoftAppSession } from '@/lib/app.session'

import { AsyncLocalStorage } from 'async_hooks'

export type StoreConfig = Record<string, unknown>
export type StoreSession = Session

export interface Store {
  config?: StoreConfig | null
  session?: StoreSession | null
  meta: Record<string, unknown>
}

const als = new AsyncLocalStorage<Store>()

export function runInAppContext<T>(
  fn: (...args: unknown[]) => Promise<T>
): (...args: unknown[]) => Promise<T> {
  const handler = async function (...args) {
    if (als.getStore()) {
      return await fn(...args)
    } else {
      return await als.run(getSafeStore(), async () => {
        const result = await fn(...args)

        return result
      })
    }
  }

  return handler
}

export function getStore(): Store {
  const store = als.getStore()

  if (!store) {
    throw new Error('Store not found')
  }

  store.meta ??= {}

  return store
}

export function getSafeStore(): Store {
  const store = als.getStore()

  return store || { meta: {} }
}

export async function getContextAppConfig(
  app: string
): Promise<StoreConfig | null> {
  const store = getStore()

  if (!store.config) {
    store.config = await getUserAppConfig(app)
  }

  return store.config
}

export async function getContextAppSession(
  app: string,
  req?: Request
): Promise<StoreSession | null> {
  const store = getStore()

  if (!store.session) {
    store.session = await getSoftAppSession(app, req)
  }

  return store.session
}
