import type React from 'react'

import useFetch from '@/hooks/useFetch'

interface TextCompletionResult {
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => Promise<void>
}

export default function useTextCompletion(): TextCompletionResult {
  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.keyCode === 13) {
      event.preventDefault()

      const { data, error } = await fetch('/api/v1/text/complete', {
        data: {
          prompt: (event.target as HTMLTextAreaElement).value,
        },
      })

      if (!error) {
        document.execCommand('insertText', false, data.completion)
      }
    }
  }

  return { onKeyDown }
}
