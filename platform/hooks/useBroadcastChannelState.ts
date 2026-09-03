import { useCallback, useEffect, useRef, useState } from 'react'

import { getRandomId } from '@/lib/string'

const uniquePrefix = getRandomId('broadcast-channel-')

export default function useBroadcastChannelState<T>(
  channelName: string,
  initialValue: T,
  messageType: string = 'set',
  propertyKey: string = 'value'
): [T, (newValue: T | ((prevValue: T) => T)) => void] {
  const [channel, setChannel] = useState<BroadcastChannel | null>(null)
  const [value, setValue] = useState<T>(initialValue)

  const valueRef = useRef<T>(value)

  useEffect(() => {
    const channel = new BroadcastChannel(`${uniquePrefix}-${channelName}`)

    setChannel(channel)

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === messageType && propertyKey in event.data) {
        setValue(event.data[propertyKey])
      }
    }

    channel.addEventListener('message', handleMessage)

    return () => {
      channel.removeEventListener('message', handleMessage)
      channel.close()
    }
  }, [channelName, messageType, propertyKey])

  const sendValue = useCallback(
    (newValue: T | ((prevValue: T) => T)) => {
      if (!channel) {
        return
      }

      const value =
        typeof newValue === 'function'
          ? (newValue as (prevValue: T) => T)(valueRef.current)
          : newValue

      const message = {
        type: messageType,
        [propertyKey]: value,
      }

      try {
        channel.postMessage(message)
      } catch (e) {
        // @todo we try/catch because the broadcast channel can be closed
      }
    },
    [channel, messageType, propertyKey]
  )

  return [value, sendValue]
}
