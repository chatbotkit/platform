import { useCallback, useEffect, useRef, useState } from 'react'

import useInitial from '@/hooks/useInitial'

export default function useClassNameOnNewElements({
  includeTypes: _includeTypes,
  excludeTypes: _excludeTypes,

  className,

  disabled,
}) {
  const includeTypes = useInitial(_includeTypes)
  const excludeTypes = useInitial(_excludeTypes)

  const [targetNode, setTargetNode] = useState(null)

  const seenElementsRef = useRef(new WeakSet())

  const callbackRef = useCallback((node) => {
    setTargetNode(node)
  }, [])

  useEffect(() => {
    if (disabled) {
      return
    }

    if (!targetNode) {
      return
    }

    const config = {
      childList: true,
      subtree: true,
    }

    const callback = (mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (
                (!includeTypes ||
                  includeTypes.length === 0 ||
                  includeTypes.includes(node.nodeName.toLowerCase())) &&
                (!excludeTypes ||
                  excludeTypes.length === 0 ||
                  !excludeTypes.includes(node.nodeName.toLowerCase())) &&
                !seenElementsRef.current.has(node) &&
                !node.classList.contains('skip-new-element-observer')
              ) {
                className.split(/\s+/).forEach((className) => {
                  className = className.trim()

                  if (className) {
                    node.classList.add(className)
                  }
                })

                seenElementsRef.current.add(node)
              }
            }
          })
        }
      }
    }

    const observer = new MutationObserver(callback)

    observer.observe(targetNode, config)

    return () => observer.disconnect()
  }, [includeTypes, excludeTypes, className, disabled, targetNode])

  return callbackRef
}
