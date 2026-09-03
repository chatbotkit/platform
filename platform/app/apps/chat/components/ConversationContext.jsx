'use client'

import { createContext, useContext } from 'react'

export const ConversationContext = createContext({})

export function ConversationContextProvider({ children, ...props }) {
  return (
    <ConversationContext.Provider value={props}>
      {children}
    </ConversationContext.Provider>
  )
}

export function useConversationContext() {
  const context = useContext(ConversationContext)

  return context || {}
}

export default ConversationContext
