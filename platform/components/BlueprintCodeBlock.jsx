import { MdCopyAll } from 'react-icons/md'

import CopyButton from '@/components/CopyButton'

import clsx from 'clsx'

export function getBlueprintPreviewSrc(source) {
  return `/playground/blueprint/embed/preview?controls=false&minZoom=0.2#blueprint=${encodeURIComponent(source.trim())}`
}

export default function BlueprintCodeBlock({ className, children }) {
  const source = String(children || '').trim()

  if (!source) {
    return null
  }

  return (
    <div
      className={clsx(
        'blueprint-code-block not-prose relative p-0 text-sm',
        className
      )}
    >
      <iframe
        className="blueprint !w-full !ml-0"
        src={getBlueprintPreviewSrc(source)}
        title="Blueprint Preview"
      />
      <div className="absolute top-2 right-2 flex flex-row gap-2">
        <CopyButton
          className="cursor-pointer rounded-xl auto-text-gray-400 hover:auto-text-gray-800 w-4 h-4 transition-all"
          text={source}
          message="Blueprint copied to your clipboard"
          title="Copy blueprint"
          aria-label="Copy blueprint"
        >
          <MdCopyAll className="w-4 h-4" />
        </CopyButton>
      </div>
    </div>
  )
}
