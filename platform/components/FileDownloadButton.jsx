import { saveUrl } from '@/lib/save'

import useFetch from '@/hooks/useFetch'

/**
 * A button that fetches a pre-signed download URL for the given file resource
 * and triggers a browser download.
 */
export default function FileDownloadButton({
  fileId,
  disabled,
  className,
  children = 'Download',
  ...props
}) {
  const { fetch } = useFetch()

  const handleDownload = async () => {
    const { error, data } = await fetch(`/api/v1/file/${fileId}/download`, {
      headers: {
        Accept: 'application/json',
      },
      loadingMessage: 'Preparing download...',
      failureMessage: true,
    })

    if (error) {
      return
    }

    saveUrl(data.url)
  }

  return (
    <button
      {...props}
      className={className}
      type="button"
      onClick={handleDownload}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
