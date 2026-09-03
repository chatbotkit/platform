import AutoTextarea from '@/components/AutoTextarea'

import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'

const EDITABLE_TYPES = [
  'text/plain',
  'text/csv',
  'text/html',
  'text/markdown',
  'application/json',
  'application/jsonl',
]

/**
 * Returns true when the given content type can be edited as plain text.
 * When contentType is absent (file has no content yet) editing is also allowed.
 *
 * @param {string|undefined} contentType
 * @returns {boolean}
 */
export function isEditableFileType(contentType) {
  return (
    !contentType ||
    EDITABLE_TYPES.includes(contentType) ||
    /^text\//i.test(contentType)
  )
}

/**
 * A button that opens a text-editor popup for a file resource.
 * Handles downloading the current content, editing, re-uploading and syncing.
 * The button is automatically disabled for binary file types.
 */
export default function FileEditButton({
  fileId,
  fileName,
  contentType,
  disabled,
  className,
  children = 'Edit',
  ...props
}) {
  const { fetch } = useFetch()

  const { popup, openPopup } = usePopup()

  const handleEdit = async () => {
    const { error, data } = await fetch(`/api/v1/file/${fileId}/download`, {
      dataType: 'text',
      loadingMessage: 'Loading file content...',
      failureMessage: true,
    })

    if (error) {
      return
    }

    // @note data is '' when the file has no content yet (204 No Content)

    const resolvedContentType = contentType || 'text/plain'

    openPopup(
      <div className="space-y-4">
        <AutoTextarea
          name="content"
          className="default-input w-full max-h-96 !overflow-auto font-mono"
          defaultValue={data}
          placeholder="Edit file content..."
        />
      </div>,
      {
        title: fileName ? `Edit - ${fileName}` : 'Edit File Content',
        cancelButtonCaption: 'Close',
        actions: {
          Save: {
            default: true,

            async fn({ content }, { close }) {
              const blob = new Blob([content ?? ''], {
                type: resolvedContentType,
              })

              const fileObj = new File([blob], fileName || 'file.txt', {
                type: blob.type,
              })

              const { error: uploadError, data: uploadData } = await fetch(
                `/api/v1/file/${fileId}/upload`,
                {
                  method: 'POST',
                  data: {
                    file: {
                      size: fileObj.size,
                      type: fileObj.type,
                      name: fileObj.name,
                    },
                  },
                  loadingMessage: 'Creating file upload...',
                  failureMessage: true,
                }
              )

              if (uploadError) {
                return
              }

              const { error: uploadFileError } = await fetch(
                uploadData.uploadRequest.url,
                {
                  method: uploadData.uploadRequest.method,
                  headers: uploadData.uploadRequest.headers,
                  body: await fileObj.arrayBuffer(),
                  dataType: 'body',
                  loadingMessage: 'Updating file...',
                  successMessage: 'File updated!',
                  uploadProgress: true,
                  failureMessage: true,
                }
              )

              if (uploadFileError) {
                return
              }

              const { error: syncError } = await fetch(
                `/api/v1/file/${fileId}/sync`,
                {
                  data: {},
                  loadingMessage: 'Syncing file...',
                  failureMessage: true,
                }
              )

              if (syncError) {
                return
              }

              close()
            },
          },
        },
      }
    )
  }

  return (
    <>
      {popup}
      <button
        {...props}
        className={className}
        type="button"
        onClick={handleEdit}
        disabled={disabled || !isEditableFileType(contentType)}
      >
        {children}
      </button>
    </>
  )
}
