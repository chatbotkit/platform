import { useEffect, useRef } from 'react'

import useRouter from '@/hooks/useRouter'

export default function Redirect() {
  const router = useRouter()

  const formRef = useRef()

  useEffect(() => {
    // ensure this is not a bot that will expire the link
    {
      const botPattern = /Outlook/i

      if (
        window?.navigator?.userAgent &&
        botPattern.test(window.navigator.userAgent)
      ) {
        return
      }
    }

    const url = new URL(router.query.callbackUrl || '/', window.location.origin)

    formRef.current.method = 'GET'
    formRef.current.action = url.pathname

    url.searchParams.forEach((value, name) => {
      const input = document.createElement('input')

      input.style.visibility = 'hidden'

      input.name = name
      input.value = value

      formRef.current.append(input)
    })

    formRef.current.submit()
  }, [router.query.callbackUrl])

  return <form ref={formRef} />
}
