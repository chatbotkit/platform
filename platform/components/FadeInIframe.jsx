import { useState } from 'react'

import clsx from 'clsx'

/**
 * An iframe that starts fully transparent and fades in once its content has
 * loaded, so embeds appear smoothly instead of flashing a blank frame.
 */
export default function FadeInIframe({ className, onLoad, ...props }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <iframe
      {...props}
      className={clsx(
        className,
        'transition-opacity duration-300',
        loaded ? 'opacity-100' : 'opacity-0'
      )}
      onLoad={(event) => {
        setLoaded(true)

        if (onLoad) {
          onLoad(event)
        }
      }}
    />
  )
}
