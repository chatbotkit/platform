'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { nameToType } from '@/lib/mime2'
import { encodePath } from '@/lib/path'
import { saveUrl } from '@/lib/save'
import toast from '@/lib/toast'

import CodeBlock from '@/components/CodeBlock'
import { useConfirmDelete } from '@/components/Confirm'
import DotsLoader from '@/components/DotsLoader'
import FileIcon from '@/components/FileIcon'
import List from '@/components/List'

import useDropzone from '@/hooks/useDropzone'
import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'

// @note byte thresholds for size formatting
const BYTES_PER_KB = 1024
const BYTES_PER_MB = BYTES_PER_KB * 1024

/**
 * Formats a file size in bytes to a human-readable string.
 *
 * @param {number} bytes - The file size in bytes
 * @returns {string} Formatted size (e.g., "1.5 KB", "2.3 MB")
 */
function formatFileSize(bytes) {
  if (!bytes) {
    return 'Unknown size'
  }

  if (bytes < BYTES_PER_KB) {
    return `${bytes} B`
  }

  if (bytes < BYTES_PER_MB) {
    return `${(bytes / BYTES_PER_KB).toFixed(2)} KB`
  }

  return `${(bytes / BYTES_PER_MB).toFixed(2)} MB`
}

/**
 * Extracts the filename from a file path.
 *
 * @param {string} path - The file path
 * @returns {string} The filename portion of the path
 */
function extractFileName(path) {
  return path.split('/').pop() || path
}

/**
 * Gets the syntax highlighting language from a filename.
 *
 * @param {string} fileName - The filename
 * @returns {string} The language for syntax highlighting
 */
function getLanguageFromFileName(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase()

  const extensionMap = {
    c: 'c',
    cpp: 'cpp',
    java: 'java',
    swift: 'swift',
    rs: 'rust',
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    json: 'json',
    jsonl: 'json',
    md: 'markdown',
    html: 'html',
    css: 'css',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    py: 'python',
    rb: 'ruby',
    sh: 'bash',
    bash: 'bash',
    sql: 'sql',
    csv: 'plain',
    txt: 'plain',
  }

  return extensionMap[ext] || 'plain'
}

/**
 * Checks if a file is previewable based on its MIME type.
 *
 * @param {string} mimeType - The MIME type of the file
 * @returns {{ previewable: boolean, type: 'image' | 'pdf' | 'text' | null }} Preview info
 */
function getPreviewInfo(mimeType) {
  if (!mimeType) {
    return { previewable: false, type: null }
  }

  // @note images can be displayed with img tag
  if (mimeType.startsWith('image/')) {
    return { previewable: true, type: 'image' }
  }

  // @note PDFs can be displayed with iframe
  if (mimeType === 'application/pdf') {
    return { previewable: true, type: 'pdf' }
  }

  // @note text-like files can be displayed in textarea
  const textTypes = [
    'text/plain',
    'text/csv',
    'text/html',
    'text/markdown',
    'text/xml',
    'text/css',
    'text/javascript',
    'application/json',
    'application/jsonl',
    'application/xml',
    'application/javascript',
    'application/x-sh',
  ]

  if (textTypes.includes(mimeType) || mimeType.startsWith('text/')) {
    return { previewable: true, type: 'text' }
  }

  return { previewable: false, type: null }
}

/**
 * FilePreviewContent displays file content based on its type.
 *
 * @param {object} props
 * @param {string} props.previewType - The type of preview ('image' | 'pdf' | 'text')
 * @param {string} props.url - The URL to the file content
 * @param {string} [props.textContent] - The text content for text files
 * @param {string} props.fileName - The name of the file
 * @param {string} [props.language] - The language for syntax highlighting
 * @param {boolean} props.loading - Whether the content is loading
 * @param {string} [props.error] - Error message if loading failed
 */
function FilePreviewContent({
  previewType,
  url,
  textContent,
  fileName,
  language,
  loading,
  error,
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <DotsLoader className="text-xl auto-text-gray-500" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-red-600">
          <p className="font-medium">Failed to load file</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  switch (previewType) {
    case 'image':
      return (
        <div className="flex items-center justify-center">
          <img
            src={url}
            alt={fileName}
            className="max-w-full max-h-[60vh] object-contain rounded"
          />
        </div>
      )

    case 'pdf':
      return (
        <iframe
          src={url}
          title={fileName}
          className="w-full h-[60vh] border-0 rounded"
        />
      )

    case 'text':
      if (!textContent) {
        return <em className="auto-text-gray-400 text-sm">No content</em>
      }

      return (
        <CodeBlock
          className="max-h-[60vh] text-xs"
          language={language || 'plain'}
        >
          {textContent}
        </CodeBlock>
      )

    default:
      return (
        <div className="text-center py-8 auto-text-gray-500">
          <p>Preview not available for this file type</p>
        </div>
      )
  }
}

/**
 * CreateFileContent renders the form content for the create-file popup.
 *
 * @param {object} props
 * @param {string} [props.defaultPath=''] - Pre-filled path value
 * @param {Function} [props.onSubmit] - Called with the file path when Enter is pressed
 */
function CreateFileContent({ defaultPath = '', onSubmit }) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium auto-text-gray-700">
          File path / name
        </span>
        <input
          className="default-input"
          type="text"
          name="filePath"
          defaultValue={defaultPath}
          placeholder="e.g. notes/readme.md"
          required
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSubmit?.(e.currentTarget.value)
            }
          }}
        />
        <span className="text-xs auto-text-gray-400">
          Use forward slashes for subdirectories.
        </span>
      </label>
    </div>
  )
}

/**
 * MoveFileContent renders the form content for the move-file popup.
 *
 * @param {object} props
 * @param {string} props.currentPath - The current file path to pre-fill
 * @param {Function} [props.onSubmit] - Called with the new path when Enter is pressed
 */
function MoveFileContent({ currentPath, onSubmit }) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium auto-text-gray-700">
          Destination file path / name
        </span>
        <input
          className="default-input"
          type="text"
          name="newPath"
          defaultValue={currentPath}
          placeholder="e.g. notes/readme.md"
          required
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSubmit?.(e.currentTarget.value)
            }
          }}
        />
        <span className="text-xs auto-text-gray-400">
          Use forward slashes for subdirectories.
        </span>
      </label>
    </div>
  )
}

/**
 * EditFileContent renders the textarea content for the edit-file popup.
 *
 * @param {object} props
 * @param {string} [props.defaultContent=''] - Pre-filled file content
 * @param {string} props.fileName - The name of the file being edited
 */
function EditFileContent({ defaultContent = '' }) {
  return (
    <div className="flex flex-col gap-1">
      <textarea
        className="default-input font-mono text-xs min-h-[50vh] resize-y"
        name="fileContent"
        defaultValue={defaultContent}
        autoFocus
        spellCheck={false}
      />
    </div>
  )
}

/**
 * Provides file preview, edit, and delete actions for space storage files.
 * Can be used by any component that needs to interact with individual files
 * in a space without rendering the full SpaceStorageList UI.
 *
 * @param {string} spaceId - The ID of the space
 * @param {{ onFilesChanged?: () => Promise<void> | void }} [options]
 * @returns {{ popup: import('react').JSX.Element, handleFilePreview: Function, handleFileMove: Function, handleFileEdit: Function, handleFileDelete: Function }}
 */
export function useSpaceFileActions(spaceId, { onFilesChanged } = {}) {
  const { fetch } = useFetch({ loadingMessage: false, failureMessage: false })

  const { popup, openPopup, closePopup, setDisabled } = usePopup()

  const confirmDelete = useConfirmDelete()

  const handleFileDelete = useCallback(
    async (file) => {
      const title = file.name || extractFileName(file.path)

      const confirmed = await confirmDelete(
        `Are you sure you want to delete ${title}?`
      )

      if (!confirmed) {
        return false
      }

      const toastId = toast.loading('Deleting file...', {})

      try {
        const targetPath = file.deletePath ?? file.path

        const recursive = file.deleteRecursive ?? false

        const { error } = await fetch(
          `/api/v1/space/${spaceId}/storage/delete/${encodePath(targetPath)}`,
          { data: { recursive } }
        )

        if (error) {
          throw new Error('Failed to delete file')
        }

        toast.success('File deleted!', { id: toastId })

        await onFilesChanged?.()

        return true
      } catch (e) {
        toast.error(e.message, { id: toastId })

        return false
      }
    },
    [spaceId, fetch, confirmDelete, onFilesChanged]
  )

  const handleFileMove = useCallback(
    async (file, { cancelButtonCaption = 'Cancel', onClose, onMoved } = {}) => {
      const fileName = extractFileName(file.path)
      const title = file.name || fileName

      const doMove = async (newPath) => {
        const trimmed = (newPath || '').trim()

        if (!trimmed) {
          toast.error('Please enter a destination path')

          return false
        }

        if (trimmed === file.path) {
          closePopup()

          return false
        }

        const toastId = toast.loading('Moving file...', {})

        try {
          const { error } = await fetch(
            `/api/v1/space/${spaceId}/storage/move/${encodePath(file.path)}`,
            {
              data: { destinationPath: trimmed },
            }
          )

          if (error) {
            throw new Error('Failed to move file')
          }

          const movedFile = {
            ...file,
            path: trimmed,
          }

          toast.success('File moved!', { id: toastId })

          await onFilesChanged?.()

          if (onMoved) {
            await onMoved(movedFile)
          } else {
            closePopup()
          }

          return movedFile
        } catch (e) {
          toast.error(e.message, { id: toastId })

          return false
        }
      }

      openPopup(
        () => <MoveFileContent currentPath={file.path} onSubmit={doMove} />,
        {
          title: `Move: ${title}`,
          cancelButtonCaption,
          onClose,
          actions: {
            Move: {
              default: true,
              fn: (data) => doMove(data.newPath),
            },
          },
        }
      )
    },
    [spaceId, fetch, openPopup, closePopup, onFilesChanged]
  )

  const handleFileEdit = useCallback(
    async (file) => {
      const fileName = extractFileName(file.path)
      const title = file.name || fileName
      const mimeType = nameToType(fileName)
      const { type: previewType } = getPreviewInfo(mimeType)

      if (previewType !== 'text') {
        toast.error('This file type cannot be edited')

        return
      }

      openPopup(
        <div className="flex items-center justify-center py-12">
          <DotsLoader className="text-xl auto-text-gray-500" />
        </div>,
        {
          title: `Edit: ${title}`,
          noActions: true,
          cancelButtonCaption: 'Cancel',
          dialogClassName: 'sm:max-w-3xl',
        }
      )

      try {
        const { error, data } = await fetch(
          `/api/v1/space/${spaceId}/storage/download/${encodePath(file.path)}`,
          { dataType: 'text', loadingMessage: false, failureMessage: false }
        )

        if (error) {
          throw new Error('Failed to load file content')
        }

        const doSave = async (formData) => {
          const content = formData.fileContent ?? ''

          const toastId = toast.loading('Saving file...', {})

          try {
            const blob = new Blob([content], { type: 'text/plain' })

            const { error: uploadError, data: uploadData } = await fetch(
              `/api/v1/space/${spaceId}/storage/upload/${encodePath(file.path)}`,
              { data: { file: { type: 'text/plain', size: blob.size } } }
            )

            if (uploadError || !uploadData) {
              throw new Error('Failed to get upload URL')
            }

            if (uploadData.uploadRequest) {
              const { method, url, headers } = uploadData.uploadRequest

              const response = await window.fetch(url, {
                method,
                headers: headers ?? {},
                body: blob,
              })

              if (!response.ok) {
                throw new Error('Failed to save file')
              }
            }

            toast.success('File saved!', { id: toastId })

            await onFilesChanged?.()

            // @note go back to the preview after saving instead of closing
            handleFilePreview(file)
          } catch (e) {
            toast.error(e.message, { id: toastId })
          }
        }

        openPopup(() => <EditFileContent defaultContent={data || ''} />, {
          title: `Edit: ${title}`,
          // @note "Back" closes the edit view and returns to the file preview
          cancelButtonCaption: 'Back',
          onClose: () => handleFilePreview(file),
          dialogClassName: 'sm:max-w-3xl',
          actions: {
            Save: { default: true, fn: doSave },
          },
        })
      } catch (e) {
        toast.error(e.message)

        closePopup()
      }
    },
    // @note handleFilePreview is omitted to avoid circular dependency - it is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spaceId, fetch, openPopup, closePopup, onFilesChanged]
  )

  const handleFileDownload = useCallback(
    async (file) => {
      const toastId = toast.loading('Preparing download...', {})

      try {
        const { error, data } = await fetch(
          `/api/v1/space/${spaceId}/storage/download/${encodePath(file.path)}`,
          {
            headers: {
              Accept: 'application/json',
            },
          }
        )

        if (error || !data) {
          throw new Error('Failed to get download URL')
        }

        toast.success('Download started!', { id: toastId })

        saveUrl(data.url, { name: extractFileName(file.path) })
      } catch (e) {
        toast.error(e.message, { id: toastId })
      }
    },
    [spaceId, fetch]
  )

  const handleFilePreview = useCallback(
    async (file) => {
      const fileName = extractFileName(file.path)
      const title = file.name || fileName
      const mimeType = nameToType(fileName)
      const previewInfo = getPreviewInfo(mimeType)

      const previewActions = {
        Download: {
          fn: () => handleFileDownload(file),
        },
        ...(previewInfo.type === 'text'
          ? {
              Edit: {
                fn: () => handleFileEdit(file),
              },
            }
          : {}),
        Move: {
          fn: () =>
            handleFileMove(file, {
              cancelButtonCaption: 'Back',
              onClose: () => handleFilePreview(file),
              onMoved: (movedFile) => handleFilePreview(movedFile),
            }),
        },
        Delete: {
          danger: true,
          fn: async () => {
            // @note disable the preview popup to prevent backdrop/Escape from
            // closing it while the confirm dialog is open on top
            setDisabled(true)

            try {
              const deleted = await handleFileDelete(file)

              if (deleted) {
                closePopup()
              }
            } finally {
              setDisabled(false)
            }
          },
        },
      }

      if (!previewInfo.previewable) {
        openPopup(
          <FilePreviewContent
            previewType={previewInfo.type}
            fileName={fileName}
            loading={false}
          />,
          {
            title,
            cancelButtonCaption: 'Close',
            dialogClassName: 'sm:max-w-3xl',
            actions: previewActions,
          }
        )

        return
      }

      openPopup(
        <FilePreviewContent
          previewType={previewInfo.type}
          fileName={fileName}
          loading={true}
        />,
        {
          title,
          noActions: true,
          cancelButtonCaption: 'Close',
          dialogClassName: 'sm:max-w-3xl',
        }
      )

      try {
        if (previewInfo.type === 'text') {
          const { error, data } = await fetch(
            `/api/v1/space/${spaceId}/storage/download/${encodePath(file.path)}`,
            { dataType: 'text', loadingMessage: false, failureMessage: false }
          )

          if (error) {
            throw new Error('Failed to load file content')
          }

          openPopup(
            <FilePreviewContent
              previewType={previewInfo.type}
              textContent={data}
              fileName={fileName}
              language={getLanguageFromFileName(fileName)}
              loading={false}
            />,
            {
              title,
              cancelButtonCaption: 'Close',
              dialogClassName: 'sm:max-w-3xl',
              actions: previewActions,
            }
          )
        } else {
          const { error, data } = await fetch(
            `/api/v1/space/${spaceId}/storage/download/${encodePath(file.path)}`,
            {
              headers: { Accept: 'application/json' },
              loadingMessage: false,
              failureMessage: false,
            }
          )

          if (error || !data?.url) {
            throw new Error('Failed to get file URL')
          }

          openPopup(
            <FilePreviewContent
              previewType={previewInfo.type}
              url={data.url}
              fileName={fileName}
              loading={false}
            />,
            {
              title,
              cancelButtonCaption: 'Close',
              dialogClassName: 'sm:max-w-3xl',
              actions: previewActions,
            }
          )
        }
      } catch (e) {
        openPopup(
          <FilePreviewContent
            previewType={previewInfo.type}
            fileName={fileName}
            loading={false}
            error={e.message}
          />,
          {
            title,
            noActions: true,
            cancelButtonCaption: 'Close',
            dialogClassName: 'sm:max-w-3xl',
          }
        )
      }
    },
    // @note handleFileDownload, handleFileEdit, handleFileMove, and handleFileDelete are omitted to avoid circular dependency - they are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spaceId, fetch, openPopup, closePopup, setDisabled]
  )

  return {
    popup,
    handleFilePreview,
    handleFileDownload,
    handleFileMove,
    handleFileEdit,
    handleFileDelete,
  }
}

/**
 * SpaceStorageList displays and manages files in a space's storage.
 *
 * @param {object} props
 * @param {string} props.spaceId - The ID of the space
 * @param {Array} [props.defaultItems=[]] - Initial list of files
 * @param {boolean} [props.uploadEnabled=true] - Whether to show upload controls
 * @param {boolean} [props.createEnabled=true] - Whether to show the create-file button
 * @param {boolean} [props.deleteEnabled=true] - Whether to allow file deletion
 * @param {number} [props.refreshInterval=60000] - Auto-refresh interval in milliseconds (0 to disable)
 */
export default function SpaceStorageList({
  spaceId,
  defaultItems = [],
  uploadEnabled = true,
  createEnabled = true,
  deleteEnabled = true,
  refreshInterval = 60_000,
}) {
  const [files, setFiles] = useState(defaultItems)
  const [isUploading, setIsUploading] = useState(false)
  const [_loading, setLoading] = useState(false)

  const fileInputRef = useRef(null)

  const { popup: mainPopup, openPopup, closePopup } = usePopup()

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDropAccepted: (acceptedFiles) => handleFileUpload(acceptedFiles),
    noClick: true,
    noKeyboard: true,
  })

  // Load files from API
  const loadFiles = useCallback(async () => {
    if (!spaceId) {
      return
    }

    setLoading(true)

    try {
      const { data, error } = await fetch(
        `/api/v1/space/${spaceId}/storage/list?recursive=true`,
        {
          loadingMessage: false,
          failureMessage: false,
        }
      )

      if (!error && data) {
        setFiles(data.items || [])
      }
    } catch {
      // @note silently fail to avoid spamming errors on refresh
    } finally {
      setLoading(false)
    }
  }, [spaceId, fetch])

  const {
    popup: fileActionsPopup,
    handleFilePreview,
    handleFileDownload,
    handleFileMove,
    handleFileEdit,
    handleFileDelete,
  } = useSpaceFileActions(spaceId, { onFilesChanged: loadFiles })

  // Initial load
  useEffect(() => {
    // @note only fetch if no default items provided
    if (defaultItems.length === 0) {
      loadFiles()
    }
  }, [defaultItems.length, loadFiles])

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(loadFiles, refreshInterval)

      return () => clearInterval(interval)
    }
  }, [loadFiles, refreshInterval])

  const handleFileUpload = async (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) {
      return
    }

    setIsUploading(true)

    const toastId = toast.loading('Uploading files...', {})

    try {
      const uploadedFiles = []

      for (const file of selectedFiles) {
        const { error, data } = await fetch(
          `/api/v1/space/${spaceId}/storage/upload/${encodePath(file.name)}`,
          {
            data: {
              file: {
                type: file.type || 'application/octet-stream',
                size: file.size,
              },
            },
          }
        )

        if (error || !data) {
          throw new Error('Failed to get upload URL')
        }

        if (data.uploadRequest) {
          const { method, url, headers } = data.uploadRequest

          const arrayBuffer = await file.arrayBuffer()

          const response = await window.fetch(url, {
            method,
            headers: headers ?? {},
            body: arrayBuffer,
          })

          if (!response.ok) {
            throw new Error(`Upload failed for ${file.name}`)
          }

          if (!data.path) {
            throw new Error(`Server did not return path for ${file.name}`)
          }

          uploadedFiles.push({
            path: data.path,
            size: file.size,
            updatedAt: Date.now(),
            isDirectory: false,
          })
        }
      }

      setFiles((prevFiles) => [...prevFiles, ...uploadedFiles])

      // @note refresh file list after upload
      await loadFiles()

      toast.success('Files uploaded!', { id: toastId })
    } catch (e) {
      toast.error(e.message, { id: toastId })
    } finally {
      setIsUploading(false)
    }
  }

  const handleCreateFile = () => {
    // @note shared logic called from both the action button and the Enter key handler
    const doCreate = async (filePath) => {
      const trimmed = (filePath || '').trim()

      if (!trimmed) {
        toast.error('Please enter a file path')

        return
      }

      const toastId = toast.loading('Creating file...', {})

      try {
        // @note create an empty plain-text file with the given path
        const emptyBlob = new Blob([''], { type: 'text/plain' })

        const { error, data: uploadData } = await fetch(
          `/api/v1/space/${spaceId}/storage/upload/${encodePath(trimmed)}`,
          {
            data: {
              file: {
                type: 'text/plain',
                size: 0,
              },
            },
          }
        )

        if (error || !uploadData) {
          throw new Error('Failed to get upload URL')
        }

        if (uploadData.uploadRequest) {
          const { method, url, headers } = uploadData.uploadRequest

          const response = await window.fetch(url, {
            method,
            headers: headers ?? {},
            body: emptyBlob,
          })

          if (!response.ok) {
            throw new Error('Failed to create file')
          }
        }

        toast.success('File created!', { id: toastId })

        // @note refresh file list after creation
        await loadFiles()

        closePopup()
      } catch (e) {
        toast.error(e.message, { id: toastId })
      }
    }

    // @note pass a component function (not a JSX element) so onSubmit prop reaches CreateFileContent via closure
    openPopup(() => <CreateFileContent onSubmit={doCreate} />, {
      title: 'Create File',
      cancelButtonCaption: 'Cancel',
      actions: {
        Create: {
          default: true,
          fn: (data) => doCreate(data.filePath),
        },
      },
    })
  }

  const filteredFiles = files.filter((file) => !file.isDirectory)

  return (
    <div {...getRootProps()} className="relative">
      {mainPopup}
      {fileActionsPopup}
      <input {...getInputProps()} />
      {uploadEnabled ? (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(Array.from(e.target.files || []))}
        />
      ) : null}
      {isDragActive && uploadEnabled ? (
        <div className="absolute -inset-2 z-50 flex items-center justify-center border-dashed border-2 border-indigo-600 dark:border-white ring ring-indigo-600 dark:ring-white rounded-lg auto-bg-white/95 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-base font-medium">Drop files here to upload</p>
          </div>
        </div>
      ) : null}
      <List
        actions={
          uploadEnabled || createEnabled ? (
            <div className="flex gap-2">
              {createEnabled ? (
                <button
                  className="default-button small"
                  type="button"
                  onClick={handleCreateFile}
                  disabled={isUploading}
                >
                  Create File
                </button>
              ) : null}
              {uploadEnabled ? (
                <button
                  className="primary-button small"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Upload Files'}
                </button>
              ) : null}
            </div>
          ) : null
        }
        emptyMessage="No files in this space. Upload files to get started."
      >
        {filteredFiles.map((file) => {
          const fileName = extractFileName(file.path)
          const mimeType = nameToType(fileName)
          const previewInfo = getPreviewInfo(mimeType)

          const actions = {
            Download: () => handleFileDownload(file),
            Move: () => handleFileMove(file),
          }

          // @note add preview and edit actions for previewable/editable files

          if (previewInfo.previewable) {
            actions.Preview = () => handleFilePreview(file)
          }

          if (previewInfo.type === 'text') {
            actions.Edit = () => handleFileEdit(file)
          }

          if (deleteEnabled) {
            actions.Delete = () => handleFileDelete(file)
          }

          return (
            <List.Item
              key={file.path}
              icon={<FileIcon className="w-8 h-8" name={fileName} />}
              title={file.path}
              body={`Size: ${formatFileSize(file.size)}`}
              timestamp={file.updatedAt}
              actions={actions}
              onClick={() => handleFilePreview(file)}
            />
          )
        })}
      </List>
    </div>
  )
}
