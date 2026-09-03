import { useSession as useSessionOriginal } from 'next-auth/react'

export { signIn, signOut } from 'next-auth/react'

export default function useSession(): ReturnType<typeof useSessionOriginal> {
  return useSessionOriginal()
}
