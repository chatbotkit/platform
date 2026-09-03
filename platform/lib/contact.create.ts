import prisma from '@/prisma/client'
import type { Contact, User } from '@/prisma/types'

import debug, { assert } from '@/lib/debug'

import { v5 as uuidv5 } from 'uuid'

export const TRUSTED_NAMESPACE = '4c8e1df2-06f0-47d6-8911-892a351fcc3a'
export const UNTRUSTED_NAMESPACE = '83eac369-0401-4a2c-992f-dd9b914420af'

type ContactData = Partial<
  Pick<
    Contact,
    'name' | 'description' | 'email' | 'phone' | 'nick' | 'preferences' | 'meta'
  >
>

/**
 * Creates a fingerprint for contact identification
 */
export function createContactFingerprint(
  namespace: string,
  parts: (string | number | boolean | null | undefined)[]
): string {
  return uuidv5(parts.slice(0).sort().join(';'), namespace).toLowerCase()
}

/**
 * Ensures a trusted contact exists, creating it if necessary
 */
export async function ensureTrustedContact(
  user: Pick<User, 'id'>,
  contact: ContactData,
  fingerprint: string
): Promise<Contact> {
  debug('ensuring trusted contact', {
    userId: user.id,
    contact,
    fingerprint,
  }).log('contact.create.createTrustedContact')

  assert(fingerprint, 'fingerprint is required')
  assert(fingerprint.length > 16, 'fingerprint is too short')

  // @todo cache contact for performance improvement

  // @note in the pass we have made the mistake to pass a non-existing user id
  // which caused some issues - we need better defense here to ensure that the
  // user exists

  // @todo add more defensive checks to ensure the user exists

  {
    const existingContact = await prisma.contact.findFirst({
      where: {
        userId: user.id,

        fingerprint: fingerprint,
      },
    })

    if (existingContact) {
      if (!existingContact.verifiedAt) {
        throw new Error('Contact is not verified')
      }

      return existingContact
    }
  }

  return await prisma.contact.create({
    data: {
      ...contact,

      fingerprint: fingerprint,

      verifiedAt: new Date(),

      userId: user.id,
    },
  })
}

/**
 * Ensures an untrusted contact exists, creating it if necessary
 */
export async function ensureUntrustedContact(
  user: Pick<User, 'id'>,
  contact: ContactData
): Promise<Contact> {
  debug('ensuring untrusted contact', { userId: user.id, contact }).log(
    'contact.create.createUntrustedContact'
  )

  const fingerprint = createContactFingerprint(UNTRUSTED_NAMESPACE, [
    contact.name,
    contact.email,
    contact.phone,
    contact.nick,
  ])

  assert(fingerprint, 'fingerprint is required')
  assert(fingerprint.length > 16, 'fingerprint is too short')

  // @todo cache contact for performance improvement

  // @note in the pass we have made the mistake to pass a non-existing user id
  // which caused some issues - we need better defense here to ensure that the
  // user exists

  // @todo add more defensive checks to ensure the user exists

  {
    const existingContact = await prisma.contact.findFirst({
      where: {
        userId: user.id,

        fingerprint: fingerprint,
      },
    })

    if (existingContact) {
      if (existingContact.verifiedAt) {
        throw new Error('Contact is verified')
      }

      return existingContact
    }
  }

  return await prisma.contact.create({
    data: {
      ...contact,

      fingerprint: fingerprint,

      userId: user.id,
    },
  })
}
