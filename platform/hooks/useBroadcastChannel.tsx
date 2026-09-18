import { useEffect, useState } from 'react'

export default function useBroadcastChannel(
  channelName: string
): BroadcastChannel | null {
  const [channel, setChannel] = useState<BroadcastChannel | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.BroadcastChannel) {
      return
    }

    let bc: BroadcastChannel

    try {
      bc = new BroadcastChannel(channelName)
    } catch {
      // @note Firefox throws SecurityError when storage is blocked, as in a
      // third-party iframe under strict tracking protection

      return
    }

    setChannel(bc)

    return () => {
      bc.close()
    }
  }, [channelName])

  return channel
}
