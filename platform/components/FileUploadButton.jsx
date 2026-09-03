import { nameToType } from '@/lib/mime2'

import useDropzone from '@/hooks/useDropzone'
import useFetch from '@/hooks/useFetch'

/**
 * A button that accepts a file drop or click-to-browse, uploads the file to
 * the given file resource, and syncs it afterwards.
 */
export default function FileUploadButton({
  fileId,
  disabled,
  className,
  children = 'Upload',
  ...props
}) {
  const { fetch } = useFetch()

  const { getRootProps, getInputProps } = useDropzone({
    onDropAccepted: async (acceptedFiles) => {
      const acceptedFile = acceptedFiles[0]

      const { error: uploadError, data: uploadData } = await fetch(
        `/api/v1/file/${fileId}/upload`,
        {
          method: 'POST',
          data: {
            file: {
              size: acceptedFile.size,
              type: acceptedFile.type || nameToType(acceptedFile.name),
              name: acceptedFile.name,
            },
          },
          loadingMessage: 'Creating file upload...',
          failureMessage: true,
        }
      )

      if (uploadError) {
        return
      }

      await fetch(uploadData.uploadRequest.url, {
        method: uploadData.uploadRequest.method,
        headers: uploadData.uploadRequest.headers,
        body: await acceptedFile.arrayBuffer(),
        dataType: 'body',
        loadingMessage: 'Uploading file...',
        successMessage: 'File uploaded successfully!',
        uploadProgress: true,
        failureMessage: true,
      })

      const { error: syncError } = await fetch(`/api/v1/file/${fileId}/sync`, {
        data: {},
        loadingMessage: 'Syncing file...',
        failureMessage: true,
      })

      if (syncError) {
        return
      }
    },
  })

  return (
    <>
      <button
        {...props}
        {...getRootProps()}
        className={className}
        type="button"
        disabled={disabled}
      >
        {children}
      </button>
      <input {...getInputProps()} />
    </>
  )
}
