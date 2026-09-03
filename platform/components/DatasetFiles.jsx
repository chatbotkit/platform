import { useState } from 'react'

import { fileIconDataUri } from '@/lib/file.icon'
import { runTasksMap } from '@/lib/job'
import { getAccept } from '@/lib/mime'
import { nameToType } from '@/lib/mime2'
import { getRandomId } from '@/lib/string'
import toast from '@/lib/toast'

import { useConfirmDelete } from '@/components/Confirm'
import DynamicImage from '@/components/DynamicImage'
import Link from '@/components/Link'

import useDropzone from '@/hooks/useDropzone'
import useFetch from '@/hooks/useFetch'
import usePopupJob from '@/hooks/usePopupJob'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import { ArrowPathIcon, PlusIcon, XMarkIcon } from '@heroicons/react/20/solid'

import clsx from 'clsx'

const FILE_UPLOAD_BATCH_SIZE = 5

export default function DatasetFiles({ dataset }) {
  const confirmDelete = useConfirmDelete()

  const [files, setFiles] = useState(dataset.files || [])

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const scopeCreateData = useScopedCreateData()

  const { popup: uploadJobPopup, runJob: runUploadJob } = usePopupJob()

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
      if (!acceptedFiles.length) {
        return
      }

      const uploadFiles = async ({
        signal,
        isCancelled = () => false,
        setProgress,
        showToast = true,
      } = {}) => {
        let completed = 0

        await runTasksMap(
          FILE_UPLOAD_BATCH_SIZE,
          acceptedFiles,
          async (file) => {
            if (isCancelled()) {
              return
            }

            const toastId = getRandomId()

            try {
              const { error: createError, data: createData } = await fetch(
                `/api/v1/file/create`,
                {
                  data: scopeCreateData({
                    name: file.name,
                  }),

                  signal,

                  toastId: toastId,
                  loadingMessage: showToast ? 'Creating file...' : false,
                  failureMessage: showToast,
                }
              )

              if (createError || isCancelled()) {
                return
              }

              const { error: uploadError, data: uploadData } = await fetch(
                `/api/v1/file/${createData.id}/upload`,
                {
                  data: {
                    file: {
                      size: file.size,
                      type: file.type || nameToType(file.name),
                      name: file.name,
                    },
                  },

                  signal,

                  toastId: toastId,
                  loadingMessage: showToast ? 'Creating file upload...' : false,
                  failureMessage: showToast,
                }
              )

              if (uploadError || isCancelled()) {
                return
              }

              const { error: uploadContentError } = await fetch(
                uploadData.uploadRequest.url,
                {
                  method: uploadData.uploadRequest.method,

                  headers: uploadData.uploadRequest.headers,

                  body: await file.arrayBuffer(),

                  signal,

                  dataType: 'body',

                  toastId: toastId,
                  loadingMessage: showToast ? 'Uploading file...' : false,
                  failureMessage: showToast,
                }
              )

              if (uploadContentError || isCancelled()) {
                return
              }

              const { error: attachError } = await fetch(
                `/api/v1/dataset/${dataset.id}/file/${createData.id}/attach`,
                {
                  data: {
                    type: 'source',
                  },

                  signal,

                  toastId: toastId,
                  loadingMessage: showToast ? 'Attaching file...' : false,
                  failureMessage: showToast,
                }
              )

              if (attachError || isCancelled()) {
                return
              }

              const { error: syncError } = await fetch(
                `/api/v1/dataset/${dataset.id}/file/${createData.id}/sync`,
                {
                  data: {},

                  signal,

                  toastId: toastId,
                  loadingMessage: showToast ? 'Syncing file...' : false,
                  failureMessage: showToast,
                }
              )

              if (syncError || isCancelled()) {
                return
              }

              setFiles((files) => [
                ...files,
                { fileId: createData.id, file: { name: file.name } },
              ])
            } catch (error) {
              if (!isCancelled()) {
                throw error
              }
            } finally {
              completed += 1

              setProgress?.({ completed })
            }
          }
        )
      }

      if (acceptedFiles.length > FILE_UPLOAD_BATCH_SIZE) {
        await runUploadJob(
          (context) => uploadFiles({ ...context, showToast: false }),
          {
            title: 'Uploading Files',
            description: 'Uploading files to your dataset.',
            progressDescription: 'You can cancel this operation at any time.',
            cancelButtonCaption: 'Cancel Upload',
            total: acceptedFiles.length,
          }
        )

        return
      }

      await uploadFiles({ showToast: true })
    },
  })

  async function syncFile(fileId, event) {
    event.preventDefault()

    const { error: syncError } = await fetch(`/api/v1/file/${fileId}/sync`, {
      data: {},
      loadingMessage: 'Syncing file...',
    })

    if (syncError) {
      return
    }
  }

  async function deleteFile(fileId, event) {
    event.preventDefault()

    const deleteFile = await confirmDelete(
      'Do you really want to delete this file?',
      {
        actions: {
          Detach: 'detach',
        },
      }
    )

    if (!deleteFile) {
      toast.error('Operation cancelled.')

      return
    }

    const deleteRecords = await confirmDelete(
      'Do you want to delete all records associated with this file?',
      {
        actions: {
          Keep: 'keep',
        },
      }
    )

    if (!deleteRecords) {
      toast.error('Operation cancelled.')

      return
    }

    if (deleteFile === 'detach' || deleteRecords) {
      const { error: detachError } = await fetch(
        `/api/v1/dataset/${dataset.id}/file/${fileId}/detach`,
        {
          data: {
            deleteRecords: deleteRecords !== 'keep',
          },

          loadingMessage: 'Detaching file...',
        }
      )

      if (detachError) {
        return
      }
    }

    if (deleteFile !== 'detach') {
      const { error: deleteError } = await fetch(
        `/api/v1/file/${fileId}/delete`,
        {
          data: {},
          loadingMessage: 'Deleting file...',
        }
      )

      if (deleteError) {
        return
      }
    }

    setFiles((files) => files.filter((file) => file.fileId !== fileId))
  }

  return (
    <>
      {uploadJobPopup}
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
        {files.map(({ fileId, file }) => {
          return (
            <div key={fileId} className="space-y-2 w-[150px]">
              <Link
                className="w-[150px] h-[240px] default-input overflow-hidden flex justify-center items-center relative group/file transition-all duration-200"
                href={`/files/${fileId}`}
                target="_blank"
                tabIndex={0}
              >
                <DynamicImage
                  className="w-full h-full dark:invert dark:hue-rotate-180 object-cover"
                  src={`/api/v1/file/${fileId}/portrait/download`}
                  fallbackSrc={fileIconDataUri(file?.name)}
                />
                <div className="opacity-0 group-hover/file:opacity-100 flex flex-row gap-1 absolute bottom-2 right-2 transition-all duration-200">
                  <div className="relative group/tooltip">
                    <div
                      className={clsx(
                        'bg-gray-900 dark:bg-gray-100 text-white dark:text-black',
                        'rounded-xl p-1 pl-2 pr-2 text-sm cursor-pointer flex justify-center items-center'
                      )}
                      onClick={syncFile.bind(null, fileId)}
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
                      onClick={deleteFile.bind(null, fileId)}
                    >
                      <XMarkIcon className="w-[1em] h-[1em]" />
                    </div>
                    <div className="tooltip below w-36">Delete</div>
                  </div>
                </div>
              </Link>
              <div className="px-2 text-xs text-gray-500 dark:text-gray-500 truncate text-ellipsis">
                {file.name || fileId}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
