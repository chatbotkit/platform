import { useRef } from 'react'
import type React from 'react'

import useIsContainerScrolled from '@/hooks/useIsContainerScrolled'

interface UseIsScrolledOptions {
  anchor?: 'top' | 'bottom'
  threshold?: number
  interval?: number
  delay?: number
  defaultValue?: boolean
}

export default function useIsScrolled({
  anchor = 'top',
  threshold = 0,
  interval = 0,
  delay = 0,
  defaultValue = false,
}: UseIsScrolledOptions = {}): [React.RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement>(null)

  const isScrolled = useIsContainerScrolled(ref, {
    anchor,
    threshold,
    interval,
    delay,
    defaultValue,
  })

  return [ref, isScrolled]
}
