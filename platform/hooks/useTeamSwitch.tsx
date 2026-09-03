'use client'

import type { Dispatch, SetStateAction } from 'react'

import { useEffect, useState } from 'react'

import {
  RUNAS_TEAMID_COOKIE_NAME,
  RUNAS_TEAMNAME_COOKIE_NAME,
} from '@/config/cookie'

import { parse as parseCookie } from '@/lib/cookie'

import useRouter from '@/hooks/useRouter'

interface UseTeamSwitchResult {
  isSwitched: boolean
  setIsSwitched: Dispatch<SetStateAction<boolean>>
  id: string
  setId: Dispatch<SetStateAction<string>>
  name: string
  setName: Dispatch<SetStateAction<string>>
}

export default function useTeamSwitch(): UseTeamSwitchResult {
  const router = useRouter()

  const [isSwitched, setIsSwitched] = useState(false)

  const [id, setId] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    const cookies = parseCookie(document.cookie)

    const idCookie = cookies.get(RUNAS_TEAMID_COOKIE_NAME)

    if (idCookie) {
      setIsSwitched(true)

      setId(idCookie)

      const nameCookie = cookies.get(RUNAS_TEAMNAME_COOKIE_NAME)

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
