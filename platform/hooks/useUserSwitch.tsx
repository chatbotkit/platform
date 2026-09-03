'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

import {
  RUNAS_USERID_COOKIE_NAME,
  RUNAS_USERNAME_COOKIE_NAME,
} from '@/config/cookie'

import { parse as parseCookie } from '@/lib/cookie'

import useRouter from '@/hooks/useRouter'

/**
 * Return type for the useUserSwitch hook
 */
interface UseUserSwitchResult {
  isSwitched: boolean
  setIsSwitched: Dispatch<SetStateAction<boolean>>
  id: string
  setId: Dispatch<SetStateAction<string>>
  name: string
  setName: Dispatch<SetStateAction<string>>
}

/**
 * Hook for detecting and managing user switching state based on cookies.
 * Used for admin functionality to impersonate other users.
 */
export default function useUserSwitch(): UseUserSwitchResult {
  const router = useRouter()

  const [isSwitched, setIsSwitched] = useState<boolean>(false)

  const [id, setId] = useState<string>('')
  const [name, setName] = useState<string>('')

  useEffect(() => {
    const cookies = parseCookie(document.cookie)

    const idCookie = cookies.get(RUNAS_USERID_COOKIE_NAME) as string | undefined

    if (idCookie) {
      setIsSwitched(true)

      setId(idCookie)

      const nameCookie = cookies.get(RUNAS_USERNAME_COOKIE_NAME) as
        | string
        | undefined

      if (nameCookie) {
        setName(nameCookie)
      }
    } else {
      setIsSwitched(false)

      setId('')
      setName('')
    }
  }, [router.asPath])

  return { isSwitched, setIsSwitched, id, setId, name, setName }
}
