import type { Contact } from '@/prisma/types'

export function canUseContact(
  userId: string | undefined | null,
  contact: Pick<Contact, 'userId'>
): boolean {
  return contact.userId === userId
}
