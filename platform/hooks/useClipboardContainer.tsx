import { useCallback } from 'react'

interface UseClipboardContainerReturn {
  copyToClipboard: (blob: Blob | BlobPart) => Promise<void>
  pasteFromClipboard: () => Promise<Blob | undefined>
}

export default function useClipboardContainer(
  contentType: string
): UseClipboardContainerReturn {
  const copyToClipboard = useCallback(
    async (blob: Blob | BlobPart): Promise<void> => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            [contentType]:
              blob instanceof Blob
                ? blob
                : new Blob([blob], { type: contentType }),
          }),
        ])
      } catch (e) {
        // @todo surface the error
      }
    },
    [contentType]
  )

  const pasteFromClipboard = useCallback(async (): Promise<Blob | undefined> => {
    try {
      const clipboardItems = await navigator.clipboard.read()

      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type === contentType) {
            const blob = await clipboardItem.getType(type)

            return blob
          }
        }
      }
    } catch (e) {
      // @todo surface the error
    }
  }, [contentType])

  return { copyToClipboard, pasteFromClipboard }
}
