import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef } from 'react'

import usePopup from '@/hooks/usePopup'

interface SetPropertiesMessageData {
  type: 'setProperties'
  data: Record<string, unknown>
}

type MessageData = SetPropertiesMessageData | { type: string; data?: unknown }

export default function useCopyWebsiteTheme(
  onChange?: (data?: Record<string, unknown>) => void
): [ReactNode, () => void] {
  const widgetsPreviewRef = useRef<HTMLIFrameElement>(null)

  const { popup, openPopup, closePopup } = usePopup({
    dialogClassName:
      'w-screen h-screen lg:max-w-[calc(100vw*0.8)] lg:max-h-[calc(100vh*0.8)] !p-0',

    noActions: true,

    onClose: useCallback(() => {
      onChange?.()
    }, [onChange]),
  })

  useEffect(() => {
    function onMessage(event: MessageEvent<MessageData>): void {
      if (event.source !== widgetsPreviewRef.current?.contentWindow) {
        return
      }

      if (event.data.type === 'setProperties') {
        if (onChange) {
          onChange((event.data as SetPropertiesMessageData).data)
        }

        closePopup()
      }
    }

    window.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [closePopup, onChange])

  const handleOpenPopup = useCallback(() => {
    openPopup(
      <iframe
        ref={widgetsPreviewRef}
        className="w-full h-full"
        src="/widgets/preview"
      />
    )
  }, [openPopup])

  return [popup, handleOpenPopup]
}
