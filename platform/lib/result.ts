export class Result<T = unknown> {
  #result: T
  #meta?: Record<string, unknown>

  constructor(result: T, meta?: Record<string, unknown>) {
    this.#result = result
    this.#meta = meta
  }

  get result(): T {
    return this.#result
  }

  get meta(): Record<string, unknown> | undefined {
    return this.#meta
  }
}
