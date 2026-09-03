'use client'

import { useCallback } from 'react'

import { signOut } from 'next-auth/react'

import {
  RUNAS_TEAMID_COOKIE_NAME,
  RUNAS_TEAMNAME_COOKIE_NAME,
  RUNAS_USERID_COOKIE_NAME,
  RUNAS_USERNAME_COOKIE_NAME,
} from '@/config/cookie'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'

/**
 * Options for the signout function.
 */
interface SignoutOptions {
  /** URL to redirect to after signout */
  callbackUrl?: string
}

/**
 * Return type for the useSignout hook.
 */
interface UseSignoutReturn {
  /** Function to sign out the user */
  signout: (options?: SignoutOptions) => Promise<void>
}

/**
 * Hook that provides a signout function which clears team/user switch cookies
 * before signing out via next-auth.
 */
export default function useSignout(): UseSignoutReturn {
  const router = useRouter()

  const { fetch } = useFetch({
    loadingMessage: false,
    failureMessage: false,
  })

  const signout = useCallback(
    async (options: SignoutOptions = {}): Promise<void> => {
      // @note clear team and user switch cookies before signing out

      await fetch('/api/me/team/unswitch', { data: {} })

      // @note fallback client-side cookie clearing in case the API call did not clear them
      const expired = 'expires=Thu, 01 Jan 1970 00:00:00 GMT'

      document.cookie = `${RUNAS_TEAMID_COOKIE_NAME}=; Path=/; SameSite=Lax; ${expired}`
      document.cookie = `${RUNAS_TEAMNAME_COOKIE_NAME}=; Path=/; SameSite=Lax; ${expired}`
      document.cookie = `${RUNAS_USERID_COOKIE_NAME}=; Path=/; SameSite=Lax; ${expired}`
      document.cookie = `${RUNAS_USERNAME_COOKIE_NAME}=; Path=/; SameSite=Lax; ${expired}`

      signOut({
        callbackUrl: options.callbackUrl ?? router.asPath,
      })
    },
    [fetch, router.asPath]
  )

  return { signout }
}
