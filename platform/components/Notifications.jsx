'use client'

import { Toaster } from 'react-hot-toast'

import useTheme from '@/hooks/useTheme'

export default function Notifications({ children }) {
  const { theme } = useTheme()

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          // default configuration

          duration: 3000,

          style: {
            backgroundColor:
              theme === 'light'
                ? 'var(--color-gray-100)'
                : 'var(--color-gray-900)',

            color:
              theme === 'light' ? 'var(--color-black)' : 'var(--color-white)',

            fontSize: 'var(--text-xs)',

            padding: '5px 8px 5px 8px',

            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor:
              theme === 'light'
                ? 'var(--color-gray-200)'
                : 'var(--color-gray-800)',
            borderRadius: 'var(--rounding-lg)',
          },

          // type configuration

          loading: {
            style: {},
          },

          success: {
            style: {},
          },

          error: {
            style: {
              borderColor: 'var(--color-red-500)',
            },
          },
        }}
      />
      {children}
    </>
  )
}
