import type { Session } from 'next-auth'

import type { AnyFunction } from '@chatbotkit-dev/typescript-utils/function'

import debug from '@/lib/debug'

import { AsyncLocalStorage } from 'async_hooks'

/**
 * To extend this object please change the next-auth.d.ts file.
 */
export type Store = Partial<Session>

/**
 * Async local storage for session context.
 */
const als = new AsyncLocalStorage<Store>()

/**
 * Wraps the given function in the session context.
 */
export function wrapInSessionContext<T extends AnyFunction>(
  fn: T
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  const handler = async function (
    ...args: Parameters<T>
  ): Promise<Awaited<ReturnType<T>>> {
    return await als.run(getSafeSessionStore(), async () => {
      debug(`running in session context`)

      return await fn(...args)
    })
  }

  return handler
}

/**
 * Runs the given function in the session context.
 */
export function runInSessionContext<T extends AnyFunction>(
  fn: T,
  ...args: Parameters<T>
): Promise<Awaited<ReturnType<T>>> {
  return wrapInSessionContext(fn)(...args)
}

/**
 * Gets the session store.
 *
 * @throws {Error}
 */
export function getSessionStore(): Store {
  const store = als.getStore()

  if (!store) {
    throw new Error('Session store not found')
  }

  return store
}

/**
 * Gets the session store.
 */
export function getSafeSessionStore(): Store {
  const store = als.getStore()

  return store || {}
}

/**
 * Update session store.
 */
export function updateSessionStore(store: Store): void {
  const sessionStore = getSessionStore()

  Object.assign(sessionStore, store)
}

/**
 * Type guard for Session.
 */
export function isSession(obj: unknown): obj is Session {
  // @todo ensure the validation is correct using types or write unit tests

  return Boolean(
    obj &&
      typeof obj === 'object' &&
      obj !== null &&
      'id' in obj &&
      typeof obj.id === 'string' &&
      'user' in obj
  )
}

/**
 * Get session
 *
 * @throws
 */
export function getSession(): Session {
  const session = getSessionStore()

  if (!isSession(session)) {
    throw new Error('Invalid session object')
  }

  return session
}

/**
 * Has session
 */
export function hasSession(): boolean {
  const session = getSafeSessionStore()

  return isSession(session)
}
