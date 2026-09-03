import { useState } from 'react'

type AwaitableStatus = 'idle' | 'awaiting' | 'resolved' | 'rejected'

type ResolveFunction<T> = (value: T) => void
type RejectFunction = (reason?: unknown) => void

interface AwaitableState<T> {
  status: AwaitableStatus
  resolve: ResolveFunction<T> | null
  reject: RejectFunction | null
}

type UseAwaitableComponentReturn<T> = [
  AwaitableStatus,
  () => Promise<T>,
  (value: T) => void,
  (error?: unknown) => void,
  () => void,
]

export default function useAwaitableComponent<T = unknown>(): UseAwaitableComponentReturn<T> {
  const [data, setData] = useState<AwaitableState<T>>({
    status: 'idle',
    resolve: null,
    reject: null,
  })

  const handleResolve = (val: T): void => {
    if (data.status !== 'awaiting') {
      throw new Error('Awaitable component is not awaiting.')
    }

    if (data.resolve) {
      data.resolve(val)
    }

    setData({ status: 'resolved', resolve: null, reject: null })
  }

  const handleReject = (err?: unknown): void => {
    if (data.status !== 'awaiting') {
      throw new Error('Awaitable component is not awaiting.')
    }

    if (data.reject) {
      data.reject(err)
    }

    setData({ status: 'rejected', resolve: null, reject: null })
  }

  const handleReset = (): void => {
    setData({ status: 'idle', resolve: null, reject: null })
  }

  const handleExecute = (): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      setData({ status: 'awaiting', resolve, reject })
    })
  }

  return [data.status, handleExecute, handleResolve, handleReject, handleReset]
}
