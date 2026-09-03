import { useEffect, useState } from 'react'

export default function useBroadcastChannel(
  channelName: string
): BroadcastChannel | null {
  const [channel, setChannel] = useState<BroadcastChannel | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      const bc = new BroadcastChannel(channelName)

      setChannel(bc)

      return () => {
        bc.close()
      }
    }
  }, [channelName])

  return channel
}
