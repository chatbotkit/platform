/* eslint-disable no-console */

/* eslint-disable react-hooks/rules-of-hooks */
import { useEffect } from 'react'

import usePrevious from '@/hooks/usePrevious'

/**
 * Props object type for trace tracking
 */
type Props = Record<string, unknown>

/**
 * Changed props tracking object showing [previousValue, currentValue] for each changed prop
 */
type ChangedProps = Record<string, [unknown, unknown]>

export default function useTraceUpdate(props: Props, id?: string): void {
  if (process.env.NODE_ENV === 'development') {
    const prev = usePrevious(props)

    useEffect(() => {
      if (!prev) {
        return
      }

      const changedProps = Object.entries(props).reduce<ChangedProps>(
        (acc, [key, value]) => {
          if (prev[key] !== value) {
            acc[key] = [prev[key], value]
          }

          return acc
        },
        {}
      )

      if (Object.keys(changedProps).length) {
        console.warn(
          `* ${id ? `(${id}) ` : ''}changed props (${Object.keys(
            changedProps
          ).join(',')}):`,
          changedProps
        )
      }
    })
  }
}
