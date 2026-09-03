'use client'

import { useEffect, useState } from 'react'
import { LuMoon } from 'react-icons/lu'

import Toggle from '@/components/Toggle'

import useTheme from '@/hooks/useTheme'

import clsx from 'clsx'

export default function DarkModeSwitch() {
  const { forcedTheme, theme, setTheme } = useTheme()

  const disabled = !!forcedTheme

  function handleSetChecked(checked) {
    if (disabled) {
      return
    }

    setTheme(checked ? 'dark' : 'light')
  }

  useEffect(() => {
    if (theme !== 'dark') {
      return
    }

    window.followTheWhiteRabbit = () => {
      window.document.documentElement.classList.add('follow-the-white-rabbit')
    }

    return () => {
      delete window.followTheWhiteRabbit
    }
  }, [theme, setTheme])

  return (
    <Toggle
      className="default-input"
      checked={theme === 'dark'}
      setChecked={handleSetChecked}
      disabled={disabled}
      aria-label={
        theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
      }
    >
      <span>Dark Mode</span>
    </Toggle>
  )
}

DarkModeSwitch.Mini = function MiniDarkModeSwitch({ className, ...props }) {
  const { forcedTheme, theme, setTheme } = useTheme()

  const disabled = !!forcedTheme

  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  function handleToggleDarkMode() {
    if (disabled) {
      return
    }

    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <button
      {...props}
      className={clsx(
        'p-2 rounded-full auto-bg-gray-50 hover:auto-bg-gray-100 transition-colors duration-200',
        mounted && {
          'fill-white': theme === 'dark',
          'text-gray-500': theme !== 'dark',
        },
        className
      )}
      type="button"
      onClick={handleToggleDarkMode}
      disabled={disabled}
      aria-label={
        mounted
          ? theme === 'dark'
            ? 'Switch to light mode'
            : 'Switch to dark mode'
          : 'Toggle dark mode'
      }
    >
      <LuMoon />
    </button>
  )
}
