import { useCallback, useRef, useState } from 'react'

import ProgressBar from '@/components/ProgressBar'

import usePopup from '@/hooks/usePopup'

function PopupJobContent({ progressDescription, completed = 0, total = 0 }) {
  return (
    <div className="space-y-2">
      {progressDescription ? (
        <p className="text-sm auto-text-gray-500">{progressDescription}</p>
      ) : null}
      {total ? (
        <>
          <p className="text-sm auto-text-gray-500">
            {completed} / {total} processed
          </p>
          <ProgressBar used={completed} total={total} />
        </>
      ) : null}
    </div>
  )
}

export default function usePopupJob(defaultOptions = {}) {
  const runningRef = useRef(false)
  const abortControllerRef = useRef(undefined)

  const [isRunning, setIsRunning] = useState(false)

  const { popup, openPopup, closePopup, setProps } = usePopup({
    closePopupOnClickOutside: false,
    cancelButtonCaption: 'Cancel',
    ...defaultOptions,
  })

  const cancelJob = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const runJob = useCallback(
    async (job, options = {}) => {
      if (runningRef.current) {
        return
      }

      const abortController = new AbortController()

      abortControllerRef.current = abortController
      runningRef.current = true
      setIsRunning(true)

      setProps({
        progressDescription: options.progressDescription,
        completed: 0,
        total: options.total,
      })

      openPopup((props) => <PopupJobContent {...props} />, {
        title: options.title || defaultOptions.title || 'Processing',
        description: options.description || defaultOptions.description,
        cancelButtonCaption:
          options.cancelButtonCaption || defaultOptions.cancelButtonCaption,
        closePopupOnClickOutside: false,
        onClose: () => {
          if (runningRef.current) {
            cancelJob()
          }
        },
      })

      const setProgress = (progress) => {
        setProps((props) => ({
          ...props,
          ...progress,
        }))
      }

      try {
        await job({
          signal: abortController.signal,
          isCancelled: () => abortController.signal.aborted,
          setProgress,
        })
      } finally {
        abortControllerRef.current = undefined
        runningRef.current = false
        setIsRunning(false)

        if (!abortController.signal.aborted) {
          closePopup()
        }
      }
    },
    [cancelJob, closePopup, defaultOptions, openPopup, setProps]
  )

  return {
    popup,
    runJob,
    cancelJob,
    isRunning,
  }
}
