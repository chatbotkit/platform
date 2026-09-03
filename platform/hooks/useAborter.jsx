import { useMemo } from 'react'

const ABORT_ERROR_NAME = 'AbortError'

class AbortError extends Error {
  constructor(message) {
    super(message)

    this.name = ABORT_ERROR_NAME
    this.message = message
  }
}

class Aborter {
  #abortController = null

  constructor() {
    this.#abortController = new AbortController()
  }

  get signal() {
    return this.#abortController.signal
  }

  get aborted() {
    return this.signal.aborted
  }

  abort(reason) {
    if (this.aborted) {
      return
    }

    this.#abortController.abort(reason)
  }

  reset(reason) {
    this.abort(reason)

    this.#abortController = new AbortController()
  }

  assertNotAborted() {
    if (this.aborted) {
      throw new AbortError(
        this.#abortController.signal.reason || 'Operation aborted'
      )
    }
  }

  isAbortError(error) {
    return (
      error instanceof AbortError ||
      (error != null && error.name === ABORT_ERROR_NAME)
    )
  }
}

export default function useAborter(deps = []) {
  return useMemo(
    () => {
      return new Aborter()
    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  )
}
