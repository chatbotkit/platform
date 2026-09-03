import { useDropzone as _useDropzone } from 'react-dropzone'
import type { DropzoneOptions, FileRejection } from 'react-dropzone'

import toast from '@/lib/toast'

/**
 * Hook that wraps react-dropzone and automatically displays error toasts
 * when files are rejected during drag-and-drop operations.
 */
export default function useDropzone(props: DropzoneOptions) {
  function onDropRejected(entries: FileRejection[]) {
    for (const { errors } of entries) {
      for (const error of errors) {
        toast.error(error.message)
      }
    }
  }

  return _useDropzone({ onDropRejected, ...props })
}
