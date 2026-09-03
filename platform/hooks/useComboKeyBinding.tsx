import { useEffect } from 'react'

/**
 * Hook that handles keyboard combo shortcuts (Ctrl+key on Windows/Linux, Cmd+key on Mac).
 * Automatically prevents default behavior and skips execution when certain elements are focused.
 *
 * @param key - The key to listen for (e.g., 's', 'k', 'Enter')
 * @param action - Callback function to execute when the combo is triggered
 * @param skip - Array of element tag names (lowercase) to skip when focused (default: ['textarea', 'input'])
 */
export default function useComboKeybinding(
  key: string,
  action: () => void,
  skip: string[] = ['textarea', 'input']
): void {
  useEffect(() => {
    function onKeydown(e: KeyboardEvent): void {
      if (e.key === key) {
        if (
          (e.ctrlKey && !navigator.platform.match('Mac')) ||
          (e.metaKey && navigator.platform.match('Mac'))
        ) {
          if (
            document.activeElement &&
            skip.includes(document.activeElement.tagName.toLowerCase())
          ) {
            return
          } else {
            e.preventDefault()
            e.stopPropagation()

            action()
          }
        }
      }
    }

    window.addEventListener('keydown', onKeydown)

    return () => {
      window.removeEventListener('keydown', onKeydown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, action])
}
