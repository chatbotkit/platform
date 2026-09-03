import { useEffect, useState } from 'react'

export default function useMouseOutsideWindow(): boolean {
  const [isMouseOutside, setIsMouseOutside] = useState<boolean>(false)

  useEffect(() => {
    const handleMouseOut = (event: MouseEvent): void => {
      // @note toElement is non-standard but kept for browser compatibility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!event.relatedTarget && !(event as any).toElement) {
        setIsMouseOutside(true)
      }
    }

    const handleMouseOver = (): void => {
      setIsMouseOutside(false)
    }

    window.addEventListener('mouseout', handleMouseOut)
    window.addEventListener('mouseover', handleMouseOver)

    return () => {
      window.removeEventListener('mouseout', handleMouseOut)
      window.removeEventListener('mouseover', handleMouseOver)
    }
  }, [])

  return isMouseOutside
}
