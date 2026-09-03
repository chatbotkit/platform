import { useCallback } from 'react'

import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'

import type { ChatBotKitWidgetElementV2, SendMessageOptions } from '@chatbotkit/widget/v2'

/**
 * Options for the send function, excluding the text which is provided separately.
 */
type SendOptions = Omit<SendMessageOptions, 'text'>

/**
 * Return type for the useDashboardWidgetSend hook.
 */
interface UseDashboardWidgetSendReturn {
  /** Function to send a message to the dashboard widget */
  send: (text: string, options?: SendOptions) => void
  /** The widget instance, or null if not yet available */
  instance: ChatBotKitWidgetElementV2 | null
}

/**
 * Hook that provides a send function to send messages to the dashboard widget.
 * This allows components to programmatically send messages to the AI assistant.
 */
export default function useDashboardWidgetSend(): UseDashboardWidgetSendReturn {
  const instance = useWidgetInstance('#chatbotkit-widget-dashboard-assistant')

  const send = useCallback(
    (text: string, options?: SendOptions): void => {
      if (!instance) {
        return
      }

      // @note open the widget if it's not already open
      instance.open = true

      // @note send the message to the widget
      instance.sendMessage({ ...options, text })
    },
    [instance]
  )

  return { send, instance }
}
