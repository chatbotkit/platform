import { useEffect } from 'react'

export default function usePreventLeave(
  isModified: boolean,
  disabled: boolean = false
): void {
  useEffect(() => {
    if (disabled) {
      return
    }

    if (!isModified) {
      return
    }

    const listener = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', listener)

    return () => {
      window.removeEventListener('beforeunload', listener)
    }
  }, [isModified, disabled])
}
