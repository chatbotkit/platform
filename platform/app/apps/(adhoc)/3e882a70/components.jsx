'use client'

import { useState } from 'react'

import fetch from '@/lib/fetch'
import { fileIconDataUri } from '@/lib/file.icon'
import { getAccept } from '@/lib/mime'
import { nameToType } from '@/lib/mime2'
import { getRandomId } from '@/lib/string'
import toast from '@/lib/toast'

import { AppScene } from '@/layouts/App'

import { useConfirmDelete } from '@/components/Confirm'
import DynamicImage from '@/components/DynamicImage'
import List from '@/components/List'

import useDropzone from '@/hooks/useDropzone'
import useRouter from '@/hooks/useRouter'

import manifest from './app.manifest'
import { APP_NAME } from './const'
import {
  attachDatasetFile,
  createFile,
  deleteFile,
  detachDatasetFile,
  syncDatasetFile,
  uploadFile,
} from './server'

import { ArrowPathIcon, PlusIcon, XMarkIcon } from '@heroicons/react/20/solid'

import clsx from 'clsx'

export function DatasetDetail({ dataset, initialFiles }) {
  const router = useRouter()
  const confirmDelete = useConfirmDelete()

  const [files, setFiles] = useState(initialFiles || [])

  const { getRootProps, getInputProps } = useDropzone({
    noKeyboard: true,
    noDragEventsBubbling: true,

    accept: getAccept([
      '.md',
      '.txt',
      '.pdf',
      '.docx',
      '.pptx',
      '.xlsx',
      '.csv',
      '.json',
      '.yaml',
      '.html',
    ]),

    onDropAccepted: async (acceptedFiles) => {
      /** @type {File} */
      const file = acceptedFiles[0]

      if (!file) {
        return
      }

      const toastId = getRandomId()

      toast.loading('Creating file...', { id: toastId })

      const createResult = await createFile({
        name: file.name,
      })

      if ('error' in createResult) {
        toast.error('Failed to create file', { id: toastId })

        return
      }

      toast.loading('Creating file upload...', { id: toastId })

      const uploadResult = await uploadFile({
        fileId: createResult.id,
        file: {
          size: file.size,
          type: file.type || nameToType(file.name),
          name: file.name,
        },
      })

      if ('error' in uploadResult) {
        toast.error('Failed to prepare upload', { id: toastId })

        return
      }

      toast.loading('Uploading file...', { id: toastId })

      // @todo consider using useFetch hook

      const uploadResponse = await fetch(uploadResult.uploadRequest.url, {
        method: uploadResult.uploadRequest.method,
        headers: uploadResult.uploadRequest.headers,
        body: await file.arrayBuffer(),
      })

      if (!uploadResponse.ok) {
        toast.error('Failed to upload file', { id: toastId })

        return
      }

      toast.loading('Attaching file...', { id: toastId })

      const attachResult = await attachDatasetFile({
        datasetId: dataset.id,
        fileId: createResult.id,
      })

      if ('error' in attachResult) {
        toast.error('Failed to attach file', { id: toastId })

        return
      }

      toast.loading('Syncing file...', { id: toastId })

      const syncResult = await syncDatasetFile({
        datasetId: dataset.id,
        fileId: createResult.id,
      })

      if ('error' in syncResult) {
        toast.error('Failed to sync file', { id: toastId })

        return
      }

      toast.success('File uploaded successfully', { id: toastId })

      setFiles([
        ...files,
        {
          fileId: createResult.id,
          file: { name: file.name },
        },
      ])
    },
  })

  async function handleSyncFile(fileId, event) {
    event.preventDefault()

    const toastId = toast.loading('Syncing file...')

    const result = await syncDatasetFile({
      datasetId: dataset.id,
      fileId,
    })

    if ('error' in result) {
      toast.error('Failed to sync file', { id: toastId })

      return
    }

    toast.success('File synced successfully', { id: toastId })
  }

  async function handleDeleteFile(fileId, event) {
    event.preventDefault()

    const deleteFileAction = await confirmDelete(
      'Do you really want to delete this file?',
      {
        actions: {
          Detach: 'detach',
        },
      }
    )

    if (!deleteFileAction) {
      toast.error('Operation cancelled.')

      return
    }

    const deleteRecordsAction = await confirmDelete(
      'Do you want to delete all records associated with this file?',
      {
        actions: {
          Keep: 'keep',
        },
      }
    )

    if (!deleteRecordsAction) {
      toast.error('Operation cancelled.')

      return
    }

    const toastId = toast.loading('Processing...')

    if (deleteFileAction === 'detach' || deleteRecordsAction) {
      toast.loading('Detaching file...', { id: toastId })

      const detachResult = await detachDatasetFile({
        datasetId: dataset.id,
        fileId,
        deleteRecords: deleteRecordsAction !== 'keep',
      })

      if ('error' in detachResult) {
        toast.error('Failed to detach file', { id: toastId })

        return
      }
    }

    if (deleteFileAction !== 'detach') {
      toast.loading('Deleting file...', { id: toastId })

      const deleteResult = await deleteFile({
        fileId,
      })

      if ('error' in deleteResult) {
        toast.error('Failed to delete file', { id: toastId })

        return
      }
    }

    toast.success('File removed successfully', { id: toastId })

    setFiles(files.filter((f) => f.fileId !== fileId))
  }

  return (
    <AppScene
      title={dataset.name}
      description={dataset.description || 'Manage files for this dataset'}
      className="py-6"
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={() => router.push(`/apps/${APP_NAME}`)}
            className="default-button"
          >
            ← Back to Datasets
          </button>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Dataset Files</h2>
          <div className="flex flex-wrap gap-3">
            <div
              {...getRootProps()}
              className="w-[150px] h-[240px] default-input overflow-hidden flex justify-center items-center cursor-pointer"
              tabIndex={0}
            >
              <div>
                <input {...getInputProps()} />
                <PlusIcon className="w-20 h-20" />
              </div>
            </div>
            {files.map((fileItem) => {
              // @note handle both flat file objects and nested { fileId, file } structure
              const fileId = fileItem.fileId || fileItem.id
              const fileName = fileItem.file?.name || fileItem.name

              return (
                <div key={fileId} className="space-y-2 w-[150px]">
                  <div
                    className="w-[150px] h-[240px] default-input overflow-hidden flex justify-center items-center relative group/file transition-all duration-200"
                    tabIndex={0}
                  >
                    <DynamicImage
                      className="w-full h-full dark:invert dark:hue-rotate-180 object-cover"
                      src={fileIconDataUri(fileName)}
                    />
                    <div className="opacity-0 group-hover/file:opacity-100 flex flex-row gap-1 absolute bottom-2 right-2 transition-all duration-200">
                      <div className="relative group/tooltip">
                        <div
                          className={clsx(
                            'bg-gray-900 dark:bg-gray-100 text-white dark:text-black',
                            'rounded-xl p-1 pl-2 pr-2 text-sm cursor-pointer flex justify-center items-center'
                          )}
                          onClick={handleSyncFile.bind(null, fileId)}
                        >
                          <ArrowPathIcon className="w-[1em] h-[1em]" />
                        </div>
                        <div className="tooltip below w-36">Sync</div>
                      </div>
                      <div className="relative group/tooltip">
                        <div
                          className={clsx(
                            'bg-red-600 text-white',
                            'rounded-xl p-1 pl-2 pr-2 text-sm cursor-pointer flex justify-center items-center'
                          )}
                          onClick={handleDeleteFile.bind(null, fileId)}
                        >
                          <XMarkIcon className="w-[1em] h-[1em]" />
                        </div>
                        <div className="tooltip below w-36">Delete</div>
                      </div>
                    </div>
                  </div>
                  <div
                    className="px-2 text-xs text-gray-500 dark:text-gray-500 truncate"
                    title={fileName || fileId}
                  >
                    {fileName || fileId}
                  </div>
                </div>
              )
            })}
          </div>

          {files.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No files attached to this dataset. Drop a file above to get
              started.
            </div>
          )}
        </div>
      </div>
    </AppScene>
  )
}

export function DatasetList({ datasets: _datasets }) {
  return (
    <List emptyMessage="No datasets found. Create one from the main dashboard.">
      {_datasets.map((dataset) => (
        <List.Item
          key={dataset.id}
          link={`/apps/${APP_NAME}/${dataset.id}`}
          title={dataset.name}
          body={dataset.description || 'No description'}
          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900"
        />
      ))}
    </List>
  )
}

function Scene({ className, ...props }) {
  return (
    <AppScene
      {...props}
      className={clsx('scene', className)}
      name={null}
      headline="Manage Your Datasets"
      description={manifest.description}
    />
  )
}

export function Main({ datasets: _datasets }) {
  return (
    <>
      {/* scene */}
      <Scene compact={true} />
      {/* datasets */}
      <DatasetList datasets={_datasets} />
    </>
  )
}
