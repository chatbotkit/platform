import type { ComponentProps, JSX } from 'react'

import DynamicIcon from '@/components/DynamicIcon'

type DynamicLogoProps = ComponentProps<typeof DynamicIcon>

export default function DynamicLogo(props: DynamicLogoProps): JSX.Element {
  return <DynamicIcon {...props} />
}
