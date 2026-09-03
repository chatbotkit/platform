'use client'

import { useEffect, useRef } from 'react'

import { BANNER } from '@/lib/banner'
import { getSessionStorage } from '@/lib/browserstorage'
import { trimLines } from '@/lib/string'

import useFirst from '@/hooks/useFirst'

import { v5 as uuidv5 } from 'uuid'

export function useConsoleDebugFunctions(functions) {
  const functionsRef = useRef(functions)

  functionsRef.current = functions

  useFirst(() => {
    if (typeof window === 'undefined') {
      return
    }

    window['enableChatBotKitDebugFunctions'] = () => {
      window.localStorage.setItem('chatbotkit.debug', 'true')
    }

    window['disableChatBotKitDebugFunctions'] = () => {
      window.localStorage.removeItem('chatbotkit.debug')
    }

    window['enableChatBotKitTrace'] = () => {
      window.localStorage.setItem('chatbotkit.trace', 'true')
    }

    window['disableChatBotKitTrace'] = () => {
      window.localStorage.removeItem('chatbotkit.trace')
    }

    if (window.localStorage.getItem('chatbotkit.debug') !== 'true') {
      return
    }

    const entries = Object.entries(functions)

    if (entries.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`%c* debug functions:`, 'color: #4f46e5')
    }

    for (const [name, { description }] of entries) {
      // eslint-disable-next-line no-console
      console.log(
        `%c/ ${name} %c${description}`,
        'color: #7c3aed',
        'color: #9ca3af'
      )

      window[name] = (...args) => {
        // eslint-disable-next-line no-console
        console.log(`%c${name}`, 'color: #4f46e5', ...args)

        return functionsRef.current[name].fn(...args)
      }
    }
  })
}

export function useConsoleTrace() {
  const trace = useRef(useConsoleTrace.dummyTrace)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (window.localStorage.getItem('chatbotkit.trace') !== 'true') {
      return
    }

    trace.current = {
      log: (...args) => {
        // eslint-disable-next-line no-console
        console.log(`%c* trace`, 'color: #4f46e5', ...args)
      },
    }
  }, [])

  return trace.current
}

useConsoleTrace.dummyTrace = {
  log: () => {},
}

/**
 * @todo use a different method to print the message only once, in particular
 * we can utilize something like regex with overridden toString method to
 * intercept console.log calls and print the message only once
 */
export default function Console({ message = BANNER }) {
  useEffect(() => {
    const key = `console-printed-${uuidv5(
      message,
      '2cf9d381-2232-4f15-a4cd-4cb5d140679f'
    )}`

    function printConsole() {
      const sessionStorage = getSessionStorage()

      if (sessionStorage[key]) {
        return
      }

      sessionStorage[key] = true

      // eslint-disable-next-line no-console
      console.log(`%c\n${trimLines(message)}`, 'color: #4f46e5')
    }

    function clearConsole() {
      const sessionStorage = getSessionStorage()

      delete sessionStorage[key]
    }

    if (document.readyState === 'complete') {
      printConsole()
    } else {
      window.addEventListener('load', printConsole)
    }

    window.addEventListener('beforeunload', clearConsole)

    return () => {
      window.removeEventListener('load', printConsole)
      window.removeEventListener('beforeunload', clearConsole)
    }
  }, [message])

  return null
}
