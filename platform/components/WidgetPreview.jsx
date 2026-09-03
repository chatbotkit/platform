import {
  Button,
  Popup,
  RequiredWrappers,
} from '@/pages/integrations/widget/[widgetIntegrationId]/frame'

import clsx from 'clsx'

export default function WidgetPreview({
  title,
  intro,
  initial,
  banner,
  messages,
  theme,

  interactive,

  button,

  className,

  ...props
}) {
  return (
    <RequiredWrappers
      {...props}
      themeWrapperClassName={clsx(
        'widget-preview',

        'flex flex-col',

        '[&_.resize-wrapper]:flex [&_.resize-wrapper]:flex-1 [&_.resize-wrapper]:w-full [&_.resize-wrapper]:h-full',
        '[&_.modal-wrapper]:flex [&_.modal-wrapper]:flex-1 [&_.modal-wrapper]:w-full [&_.modal-wrapper]:h-full',

        {
          'pointer-events-none select-none': !interactive,
        },

        className
      )}
      integration={{}} // @todo is this really needed?
      title={title}
      intro={intro}
      initial={initial}
      banner={banner}
      autoScroll={false}
      autoFocus={false}
      theme={theme}
      disabled={true}
    >
      <div className="flex-1 w-full h-full flex flex-col gap-4">
        <Popup
          className="flex-1 w-full h-full"
          messages={messages}
          disabled={true}
        />
        {button ? <Button className="self-end" disabled={true} /> : null}
      </div>
    </RequiredWrappers>
  )
}
