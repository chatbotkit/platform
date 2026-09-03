import { useMemo, useState } from 'react'
import type React from 'react'

import type { ImageProps as NextImageProps } from 'next/image'
import { default as NextImage } from 'next/image'

const DEFAULT_ERROR_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAAJElEQVR4nO3BMQEAAADCoPVPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAMDhAAGGGwNTAAAAAElFTkSuQmCC'

interface ImageProps extends Omit<NextImageProps, 'src'> {
  src: string
  errorDataURL?: string | null
}

export default function Image({
  src: _src,
  errorDataURL = DEFAULT_ERROR_DATA_URL,
  ...props
}: ImageProps): React.ReactElement {
  const [src, setSrc] = useState<string>(_src)

  const extraProps = useMemo(() => {
    const extraProps: Partial<NextImageProps> = {}

    if (errorDataURL) {
      extraProps.onError = () => {
        setSrc(errorDataURL)
      }
    }

    return extraProps
  }, [errorDataURL])

  return <NextImage {...props} {...extraProps} src={src} />
}
