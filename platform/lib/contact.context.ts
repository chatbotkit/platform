import type { Contact } from '@/prisma/types'

import { getContextContact } from '@/lib/context.store'

export function getBareContextContact(): Omit<
  Contact,
  | 'id'
  | 'userId'
  | 'createdAt'
  | 'preferences'
  | 'updatedAt'
  | 'verifiedAt'
  | 'meta'
> | null {
  const contact = getContextContact()

  if (!contact) {
    return null
  }

  return {
    fingerprint: contact.fingerprint,
    name: contact.name,
    description: contact.description,
    email: contact.email,
    phone: contact.phone,
    nick: contact.nick,
  }
}
