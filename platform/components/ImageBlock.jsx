import { useRef, useState } from 'react'
import { MdDownload } from 'react-icons/md'

import { saveUrl } from '@/lib/save'

import clsx from 'clsx'

// @todo consider if image block should be treated as a block element instead
// of inline element

export default function ImageBlock({ className, src, alt, ...props }) {
  const imgRef = useRef(null)

  const [loaded, setLoaded] = useState(false)

  // @note we use span because images are inline elements by default and use of
  // div cannot technically appear inside a <p> tag

  return (
    <span
      {...props}
      className={clsx(
        'relative inline-block',
        'transition-all duration-300',
        {
          'opacity-0 blur-sm': !loaded,
          'opacity-100 blur-none': loaded,
        },
        className
      )}
    >
      <img
        className={clsx('block')}
        ref={imgRef}
        src={src}
        alt={alt}
        // crossOrigin="anonymous"
        onLoad={() => {
          setLoaded(true)
        }}
      />
      <span className={clsx('absolute top-2 right-2', 'flex flex-row gap-2')}>
        {/* <MdOutlineContentCopy
          className="cursor-pointer sepia text-gray-500 hover:text-gray-100 w-4 h-4"
          onClick={() => {
            const img = imgRef.current

            const canvas = document.createElement('canvas')
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight

            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight)

            canvas.toBlob(async (blob) => {
              try {
                await navigator.clipboard.write([
                  new ClipboardItem({
                    [blob.type]: blob,
                  }),
                ])

                toast.success('Image copied to clipboard!')
              } catch (error) {
                toast.error('Failed to copy image to clipboard!')
              }
            })
          }}
        /> */}
        <MdDownload
          className={clsx(
            'cursor-pointer',
            'sepia',
            'text-gray-500 hover:text-gray-100',
            'w-4 h-4',
            'transition-all duration-300'
          )}
          onClick={() => {
            saveUrl(src, { name: alt })
          }}
        />
      </span>
    </span>
  )
}
