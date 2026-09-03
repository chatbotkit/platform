'use client'

import { useCallback } from 'react'

import type {
  BuiltInProviderType,
  RedirectableProviderType,
} from 'next-auth/providers/index'
import type {
  LiteralUnion,
  SignInAuthorizationParams,
  SignInOptions,
  SignInResponse,
} from 'next-auth/react'
import { signIn } from 'next-auth/react'

import {
  RUNAS_TEAMID_COOKIE_NAME,
  RUNAS_TEAMNAME_COOKIE_NAME,
  RUNAS_USERID_COOKIE_NAME,
  RUNAS_USERNAME_COOKIE_NAME,
} from '@/config/cookie'

type SigninProvider = LiteralUnion<
  RedirectableProviderType | BuiltInProviderType,
  string
>

interface UseSigninReturn {
  signin: <P extends RedirectableProviderType | undefined = undefined>(
    provider?: SigninProvider,
    options?: SignInOptions,
    parameters?: SignInAuthorizationParams
  ) => Promise<
    P extends RedirectableProviderType ? SignInResponse | undefined : undefined
  >
}

/**
 * Hook that provides a signin function which clears team/user switch cookies
 * client-side before signing in via next-auth.
 */
export default function useSignin(): UseSigninReturn {
  const signin = useCallback(
    async <P extends RedirectableProviderType | undefined = undefined>(
      provider?: SigninProvider,
      options: SignInOptions = {},
      parameters?: SignInAuthorizationParams
    ): Promise<
      P extends RedirectableProviderType
        ? SignInResponse | undefined
        : undefined
    > => {
      // @note clear team and user switch cookies client-side before signing in

      const expired = 'expires=Thu, 01 Jan 1970 00:00:00 GMT'

      document.cookie = `${RUNAS_TEAMID_COOKIE_NAME}=; Path=/; SameSite=Lax; ${expired}`
      document.cookie = `${RUNAS_TEAMNAME_COOKIE_NAME}=; Path=/; SameSite=Lax; ${expired}`
      document.cookie = `${RUNAS_USERID_COOKIE_NAME}=; Path=/; SameSite=Lax; ${expired}`
      document.cookie = `${RUNAS_USERNAME_COOKIE_NAME}=; Path=/; SameSite=Lax; ${expired}`

      return signIn(provider, options, parameters) as Promise<
        P extends RedirectableProviderType
          ? SignInResponse | undefined
          : undefined
      >
    },
    []
  )

  return { signin }
}
