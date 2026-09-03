import { useEffect, useState } from 'react'

import { captureException } from '@/lib/error'

interface WorkerMessageData {
  action: string
  result?: {
    length?: number
  }
}

interface WorkerMessage {
  data: WorkerMessageData
}

/**
 * Hook to calculate token count for text.
 */
export default function useTokenCount(text: string): number {
  const [tokenCount, setTokenCount] = useState<number>(0)

  const [gptWorker, setGptWorker] = useState<Worker | null>(null)

  useEffect(() => {
    if (typeof Worker === 'undefined' || typeof window === 'undefined') {
      return
    }

    let worker: Worker | null = null

    try {
      worker = new Worker(new URL('../workers/gpt.worker.js', import.meta.url))

      const handleMessage = ({ data: { action, result } }: WorkerMessage) => {
        if (!result) {
          return
        }

        const { length } = result

        if (action === 'getTextTokensLength') {
          setTokenCount(length || 0)
        }
      }

      worker.addEventListener('message', handleMessage)

      setGptWorker(worker)
    } catch (e) {
      void captureException(e)

      setGptWorker(null)
    }

    return () => {
      if (worker) {
        worker.terminate()

        setGptWorker(null)
      }
    }
  }, [])

  useEffect(() => {
    if (!text || !gptWorker) {
      setTokenCount(0)

      return
    }

    gptWorker.postMessage({
      action: 'getTextTokensLength',
      params: { text },
    })
  }, [text, gptWorker])

  return tokenCount
}
