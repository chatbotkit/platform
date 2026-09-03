import useDropzone from '@/hooks/useDropzone'

import {
  ArrowDownIcon,
  CloudArrowUpIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

export default function FileDrop(props) {
  const {
    getRootProps,
    getInputProps,

    isDragActive,
    isDragReject,
  } = useDropzone({ ...props })

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {isDragActive && !isDragReject && (
        <div className="flex items-center flex-col py-12 justify-center border-dashed border border-indigo-600 dark:border-white ring ring-indigo-600 dark:ring-white rounded-lg w-full text-center cursor-pointer">
          <ArrowDownIcon className="h-6 w-6" />
          <p className="input-description">Drop your file here</p>
        </div>
      )}
      {!isDragActive && (
        <div className="flex items-center flex-col py-12 justify-center border-dashed border auto-border-gray-300 hover:auto-border-gray-500 shadow-sm auto-bg-white rounded-lg w-full text-center transition duration-150 cursor-pointer">
          <CloudArrowUpIcon className="h-6 w-6" />
          <p className="input-description">
            Drag & Drop your file here, or{' '}
            <span className="default-link">Click to select</span>
          </p>
        </div>
      )}
      {isDragReject && (
        <div className="flex items-center flex-col py-12 justify-center border-dashed border border-red-400 shadow-sm auto-bg-white rounded-lg w-full text-center hover:border-red-400 transition duration-150 text-red-400">
          <XCircleIcon className="h-6 w-6" />
          <p className="mt-2 text-red-400 text-sm">File type not accepted!</p>
        </div>
      )}
    </div>
  )
}
