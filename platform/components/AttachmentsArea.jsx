import { GoPaperclip as PaperclipIcon } from 'react-icons/go'

import { XMarkIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

export function Attachment({ className, type, name, url, ...props }) {
  return (
    <div {...props} className="attachment relative group/tooltip">
      {/image\//.test(type) ? (
        <img
          {...props}
          className={clsx('h-16 aspect-auto rounded-lg', className)}
          src={url}
          alt="attachment"
        />
      ) : (
        <div
          {...props}
          className={clsx(
            'w-16 h-16',
            'rounded-lg',
            'border auto-border-gray-200',
            'flex flex-col justify-center items-center',
            className
          )}
        >
          <PaperclipIcon className="w-8 h-8 fill-current" />
        </div>
      )}
      {name ? <div className="tooltip above w-36 truncate">{name}</div> : null}
    </div>
  )
}

export default function AttachmentsArea({
  className,

  attachments,
  setAttachments,

  children,

  ...props
}) {
  return attachments?.length ? (
    <div
      {...props}
      className={clsx(
        'attachments-area',
        'flex flex-row flex-wrap gap-2',
        className
      )}
    >
      {attachments.map((attachmentFile, index) => {
        return (
          <div key={index} className="inline-block relative group">
            <Attachment
              type={attachmentFile.type}
              name={attachmentFile.name}
              url={URL.createObjectURL(attachmentFile)}
            />
            <XMarkIcon
              className={clsx(
                'text-black bg-white',
                'rounded-full',
                'w-4 h-4',
                'p-0.5',
                'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto group-hover:cursor-pointer',
                'absolute top-1 right-1',
                'transition-all duration-200'
              )}
              onClick={() => {
                setAttachments(
                  attachments.filter(
                    (attachment) => attachment !== attachmentFile
                  )
                )
              }}
            />
          </div>
        )
      })}
      {children}
    </div>
  ) : null
}
