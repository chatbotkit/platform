const activePromises = new Map<string, Promise<unknown>>()

/**
 * Run a function once per key. If the key is already active, the function is
 * not executed again and the result of the first call is returned. The key is
 * cleared after the function is resolved.
 */
export async function runOncePerKey<T>(
  key: string,
  fn: (...args: unknown[]) => Promise<T>
): Promise<T> {
  let promise = activePromises.get(key) as Promise<T> | undefined

  if (promise) {
    return promise
  }

  promise = fn()
    .catch((e) => {
      activePromises.delete(key)

      throw e
    })
    .finally(() => {
      // @note not sure if we need to even cleanup the activePromises map in a
      // non-dev environment because the assumption is that these are run on
      // serverless functions and the process will be terminated after the
      // function is done
      // @todo perhaps detect if the process is running in dev mode and only then
      // cleanup the map
      setTimeout(() => {
        activePromises.delete(key)
      }, 1)
    })

  activePromises.set(key, promise)

  return promise
}
