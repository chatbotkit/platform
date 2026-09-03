import { useState } from 'react'

import FileDrop from '@/components/FileDrop'
import FileIcon from '@/components/FileIcon'

import { XMarkIcon } from '@heroicons/react/24/outline'

export function FileList({ files, setFiles }) {
  return (
    <>
      {files &&
        files.map((file, index) => (
          <div
            key={index}
            className="flex items-center justify-between space-x-2 auto-bg-gray-50 py-2 pr-3 pl-4 rounded-md group my-4"
          >
            <div className="flex items-center space-x-2">
              <FileIcon className="w-5" name={file.name} />
              <p className="text-xs">{file.path}</p>
            </div>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 focus:outline-none p-1 hover:auto-bg-gray-200 rounded transition duration-150"
              onClick={() => {
                setFiles(files.filter((f) => f.path !== file.path))
              }}
            >
              <XMarkIcon height="16px" width="16px" />
            </button>
          </div>
        ))}
    </>
  )
}

export default function FileManager({ accept, files: f = [], setFiles: sf }) {
  const [files, setFiles] = useState(f)

  function onDropAccepted(acceptedFiles) {
    const newFiles = files.concat(
      acceptedFiles
        .map((file) =>
          Object.assign(file, {
            preview: URL.createObjectURL(file),
          })
        )
        .filter((file) => !files.some((f) => f.path === file.path))
    )

    setFiles(newFiles)

    if (sf) {
      sf(newFiles)
    }
  }

  function onSetFiles(files) {
    setFiles(files)

    if (sf) {
      sf(files)
    }
  }

  return (
    <div>
      <FileDrop onDropAccepted={onDropAccepted} accept={accept} />
      <FileList files={files} setFiles={onSetFiles} />
    </div>
  )
}
