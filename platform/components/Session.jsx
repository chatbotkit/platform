'use client'

import { SessionProvider } from 'next-auth/react'

export default function Session({ session, basePath, children }) {
  return (
    <SessionProvider session={session} basePath={basePath}>
      {children}
    </SessionProvider>
  )
}
