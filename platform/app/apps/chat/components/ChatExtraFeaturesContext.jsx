'use client'

import { createContext, useCallback, useContext, useState } from 'react'

/**
 * Context that holds client-side extra feature toggles for the chat engine.
 * Extra features are flags that are forwarded to the server with each message
 * and gate capabilities in the conversation engine (e.g. reprogramming mode).
 *
 * - `extraFeatures` – current toggle state, e.g. `{ reprogramming: true }`
 * - `toggleFeature` – flip a named feature on/off
 */
export const ChatExtraFeaturesContext = createContext({
  extraFeatures: {},
  toggleFeature: () => {},
})

/**
 * Self-contained provider. Owns toggle state internally.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function ChatExtraFeaturesProvider({ children }) {
  const [extraFeatures, setExtraFeatures] = useState({})

  const toggleFeature = useCallback((name) => {
    setExtraFeatures((prev) => ({ ...prev, [name]: !prev[name] }))
  }, [])

  return (
    <ChatExtraFeaturesContext.Provider value={{ extraFeatures, toggleFeature }}>
      {children}
    </ChatExtraFeaturesContext.Provider>
  )
}

/**
 * Consume the chat extra features context.
 *
 * @returns {{ extraFeatures: object, toggleFeature: function }}
 */
export function useChatExtraFeatures() {
  return useContext(ChatExtraFeaturesContext)
}

export default ChatExtraFeaturesContext
