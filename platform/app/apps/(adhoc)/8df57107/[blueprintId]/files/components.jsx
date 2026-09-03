'use client'

import { useCallback, useState } from 'react'

import toast from '@/lib/toast'

import { AppScene } from '@/layouts/App'

import { useConfirmDelete } from '@/components/Confirm'
import FileDrop from '@/components/FileDrop'
import List from '@/components/List'

import usePopup from '@/hooks/usePopup'

import { deleteFile, uploadFile } from '../../server'

import clsx from 'clsx'

function Scene({ className, ...props }) {
  return (
    <AppScene
      {...props}
      className={clsx('scene', className)}
      name={null}
      headline="Manage Files"
      description="Upload and manage files in your datasets."
    />
  )
}

function FileUploadScreen({ datasets: _datasets, blueprintId: _blueprintId }) {
  const [selectedFiles, setSelectedFiles] = useState([])

  const removeFile = (index) => {
    setSelectedFiles((files) => files.filter((_, i) => i !== index))
  }

  const onDropAccepted = (acceptedFiles) => {
    setSelectedFiles((prev) => [...prev, ...acceptedFiles])
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="default-label">Files</label>
        <div className="mt-1">
          <FileDrop onDropAccepted={onDropAccepted} />
        </div>
        <p className="input-description">
          Drag and drop files or click to select.
        </p>
      </div>
      {selectedFiles.length > 0 && (
        <div>
          <label className="default-label">
            Selected Files ({selectedFiles.length})
          </label>
          <div className="mt-2 space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="ml-3 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FileList({ files: _files, setFiles, datasets, blueprintId }) {
  const { popup, openPopup, closePopup } = usePopup()

  const confirmDelete = useConfirmDelete()

  const openUploadScreen = useCallback(() => {
    openPopup(
      <FileUploadScreen datasets={datasets} blueprintId={blueprintId} />,
      {
        title: 'Upload Files',
        actions: {
          Upload: {
            fn: async (props) => {
              const { files } = props

              const datasetId = datasets[0]?.id

              if (!datasetId || !files || files.length === 0) {
                toast.error('Please select files to upload')

                return
              }

              closePopup()

              const toastId = toast.loading('Uploading files...', {})

              try {
                const uploadedFiles = []

                for (const file of files) {
                  const reader = new FileReader()

                  const data = await new Promise((resolve, reject) => {
                    reader.onload = () => resolve(reader.result)
                    reader.onerror = reject

                    reader.readAsDataURL(file)
                  })

                  const result = await uploadFile({
                    datasetId,
                    name: file.name,
                    type: file.type,
                    data: data,
                  })

                  if ('error' in result) {
                    toast.error(
                      `Failed to upload ${file.name}: ${result.error.message}`
                    )
                  } else {
                    uploadedFiles.push({
                      ...result,
                      datasetId,
                    })
                  }
                }

                if (uploadedFiles.length > 0) {
                  setFiles((items) => [...items, ...uploadedFiles])

                  toast.success(`${uploadedFiles.length} file(s) uploaded!`, {
                    id: toastId,
                  })
                } else {
                  toast.error('No files were uploaded', { id: toastId })
                }
              } catch {
                toast.error('Upload failed', { id: toastId })
              }
            },
            default: true,
          },
        },
      }
    )
  }, [datasets, blueprintId, closePopup, openPopup, setFiles])

  const handleDelete = useCallback(
    async (file) => {
      if (
        !(await confirmDelete(
          `Are you sure you want to delete "${file.name}"?`
        ))
      ) {
        return
      }

      const toastId = toast.loading('Deleting file...', {})

      const result = await deleteFile({
        fileId: file.id,
        datasetId: file.datasetId,
      })

      if ('error' in result) {
        toast.error(result.error.message, { id: toastId })

        return
      }

      setFiles((items) => items.filter((item) => item.id !== file.id))

      toast.success('File deleted!', { id: toastId })
    },
    [confirmDelete, setFiles]
  )

  const formatFileSize = (bytes) => {
    if (!bytes) {
      return 'Unknown'
    }

    const sizes = ['Bytes', 'KB', 'MB', 'GB']

    const i = Math.floor(Math.log(bytes) / Math.log(1024))

    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <>
      {popup}
      <List
        emptyMessage="No files uploaded yet."
        actions={
          <button
            className="primary-button small"
            type="button"
            onClick={openUploadScreen}
          >
            Upload Files
          </button>
        }
      >
        {_files.map((file) => (
          <List.Item
            key={file.id}
            title={file.name}
            body={`${file.type || 'Unknown'} • ${formatFileSize(file.size)}`}
            timestamp={file.updatedAt}
            actions={{
              Delete: () => handleDelete(file),
            }}
          />
        ))}
      </List>
    </>
  )
}

export function Main({ blueprintId, files: _files, datasets }) {
  const [files, setFiles] = useState(_files)

  return (
    <>
      <Scene compact={true} />
      <FileList
        files={files}
        setFiles={setFiles}
        datasets={datasets}
        blueprintId={blueprintId}
      />
    </>
  )
}
