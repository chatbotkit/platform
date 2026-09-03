import type { ComponentProps, JSX } from 'react'

import DynamicIcon from '@/components/DynamicIcon'

type DynamicImageProps = ComponentProps<typeof DynamicIcon>

export default function DynamicImage(props: DynamicImageProps): JSX.Element {
  return <DynamicIcon {...props} />
}
