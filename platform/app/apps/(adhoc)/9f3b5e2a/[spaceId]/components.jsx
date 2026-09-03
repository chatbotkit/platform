'use client'

import { useRef, useState } from 'react'

import fetch from '@/lib/fetch'
import { saveUrl } from '@/lib/save'
import toast from '@/lib/toast'

import { AppScene } from '@/layouts/App'

import BackLink from '@/components/BackLink'
import { useConfirmDelete } from '@/components/Confirm'
import List from '@/components/List'

import useDropzone from '@/hooks/useDropzone'

import { APP_NAME } from '../const'
import { deleteFile, getDownloadUrl, getUploadUrl } from './server'

function FileManager({ spaceId, initialFiles = [] }) {
  const [files, setFiles] = useState(initialFiles)

  const [isUploading, setIsUploading] = useState(false)

  const fileInputRef = useRef(null)

  const confirmDelete = useConfirmDelete()

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDropAccepted: (acceptedFiles) => handleFileUpload(acceptedFiles),

    noClick: true,
    noKeyboard: true,
  })

  const handleFileUpload = async (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) {
      return
    }

    setIsUploading(true)

    const toastId = toast.loading('Uploading files...', {})

    try {
      const uploadedFiles = []

      for (const file of selectedFiles) {
        const result = await getUploadUrl({
          spaceId,
          path: file.name,
          file: {
            type: file.type,
            size: file.size,
          },
        })

        if (!result || 'error' in result) {
          throw new Error('Failed to get upload URL')
        }

        if (result.uploadRequest) {
          const { method, url, headers } = result.uploadRequest

          const arrayBuffer = await file.arrayBuffer()

          // @todo consider using useFetch hook

          const response = await fetch(url, {
            method,
            headers: headers ?? {},
            body: arrayBuffer,
          })

          if (!response.ok) {
            throw new Error(`Upload failed for ${file.name}`)
          }

          uploadedFiles.push({
            path: result.path || file.name,
            size: file.size,
            updatedAt: Date.now(),
            isDirectory: false,
          })
        }
      }

      setFiles((prevFiles) => [...prevFiles, ...uploadedFiles])

      toast.success('Files uploaded!', { id: toastId })
    } catch (e) {
      toast.error(e.message, { id: toastId })
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileDownload = async (file) => {
    const toastId = toast.loading('Preparing download...', {})

    try {
      const result = await getDownloadUrl({
        spaceId,
        path: file.path,
      })

      if (!result || 'error' in result) {
        throw new Error('Failed to get download URL')
      }

      toast.success('Download started!', { id: toastId })

      saveUrl(result.downloadUrl, {
        // @todo pass the original name for the file
      })
    } catch (e) {
      toast.error(e.message, { id: toastId })
    }
  }

  const handleFileDelete = async (file) => {
    if (
      !(await confirmDelete(`Are you sure you want to delete ${file.path}?`))
    ) {
      return
    }

    const toastId = toast.loading('Deleting file...', {})

    try {
      const result = await deleteFile({
        spaceId,
        path: file.path,
      })

      if (!result || 'error' in result) {
        throw new Error('Failed to delete file')
      }

      toast.success('File deleted!', { id: toastId })

      setFiles((prevFiles) => prevFiles.filter((f) => f.path !== file.path))
    } catch (e) {
      toast.error(e.message, { id: toastId })
    }
  }

  return (
    <div {...getRootProps()} className="relative">
      <input {...getInputProps()} />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(Array.from(e.target.files || []))}
      />
      {isDragActive && (
        // @todo standardize this overlay component area for file drop zones
        <div className="absolute -inset-2 z-50 flex items-center justify-center border-dashed border-2 border-indigo-600 dark:border-white ring ring-indigo-600 dark:ring-white rounded-lg auto-bg-white/95 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-base font-medium">Drop files here to upload</p>
          </div>
        </div>
      )}
      <List
        title={
          <BackLink
            className="default-button small push"
            href={`/apps/${APP_NAME}`}
          >
            Back to Spaces
          </BackLink>
        }
        actions={
          <button
            className="primary-button small"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </button>
        }
        emptyMessage="No files yet. Upload some files to get started or drag and drop files here."
      >
        {files
          .filter((file) => !file.isDirectory)
          .map((file) => {
            const fileSizeKB = (file.size / 1024).toFixed(2)
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
            const displaySize =
              file.size > 1024 * 1024 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`

            return (
              <List.Item
                key={file.path}
                title={file.path}
                body={`Size: ${displaySize}`}
                timestamp={file.updatedAt}
                actions={{
                  Download: () => handleFileDownload(file),
                  Delete: () => handleFileDelete(file),
                }}
              />
            )
          })}
      </List>
    </div>
  )
}

export function Main({ space: initialSpace, initialFiles = [] }) {
  return (
    <>
      {/* scene */}
      <AppScene
        className="scene"
        name={null}
        headline={initialSpace.name || 'Space Files'}
        description={initialSpace.description || 'Manage files for this space'}
      />
      <FileManager spaceId={initialSpace.id} initialFiles={initialFiles} />
    </>
  )
}
