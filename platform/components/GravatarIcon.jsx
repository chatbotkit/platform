import { useEffect, useState } from 'react'

import { sha256 } from '@/lib/webcrypto'

export default function GravatarIcon({ email, ...props }) {
  const [hash, setHash] = useState('')

  useEffect(() => {
    if (email == null) {
      return
    }

    async function genHash() {
      const hash = await sha256(email.trim().toLowerCase())

      setHash(hash)
    }

    genHash().catch(() => {})
  }, [email])

  return (
    hash && (
      <img
        src={`https://www.gravatar.com/avatar/${hash}?d=mp`}
        {...props}
        alt="gravatar"
      />
    )
  )
}
