import type { Adapter, AdapterUser } from 'next-auth/adapters'

import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { isAllowedEmail } from '@/lib/email.validation'
import { captureException } from '@/lib/error'

import { sendEvent } from '@/pages/api/user/[userId]/queue'

import { PrismaAdapter } from '@next-auth/prisma-adapter'

export const adapter: Required<Adapter> = ((adapter) => {
  return new Proxy(adapter, {
    get(target, prop, receiver) {
      switch (prop) {
        case 'updateSession': {
          return async (data: {
            sessionToken: string
            [key: string]: unknown
          }) => {
            const { sessionToken, ...rest } = data

            // @note call prisma directly instead of target.updateSession to
            // strip sessionToken from the data payload - the default adapter
            // spreads the entire data object (including sessionToken) into both
            // the WHERE clause and the SET clause, causing Prisma to emit an
            // inefficient `id IN (<subquery>) AND (? = ?)` pattern on MariaDB

            return prisma.session.update({
              where: { sessionToken },
              data: rest,
            })
          }
        }

        case 'createVerificationToken': {
          return async (data: {
            identifier: string
            token: string
            expires: Date
          }) => {
            // @note one live sign-in code per address: issuing a new code
            // retires every earlier one, so repeated requests cannot stack up
            // outstanding codes that each widen a guesser's odds within the
            // verify budget

            await prisma.verificationToken.deleteMany({
              where: { identifier: data.identifier },
            })

            return target.createVerificationToken?.(data)
          }
        }

        case 'createUser': {
          return async (user: AdapterUser) => {
            debug(`creating user`, { user }).log('auth.adapter.createUser')

            // @note block account creation for disallowed emails (blacklisted /
            // disposable domains and throwaway-looking local parts) at the one
            // choke point where a User row is written. This covers every
            // provider - OAuth included - and every NextAuth callback ordering,
            // unlike the signIn callback which can run only after the email
            // provider has already created the row.

            if (user.email && !(await isAllowedEmail(user.email))) {
              debug(`blocked disallowed email`, { email: user.email }).log(
                'auth.adapter.createUser'
              )

              throw new Error('Email is not allowed')
            }

            const createdUser = await target.createUser?.(user)

            if (createdUser) {
              try {
                await sendEvent(createdUser.id, {
                  type: 'setup',
                  payload: {},
                })
              } catch (e) {
                await captureException(e)
              }
            }

            return createdUser
          }
        }
      }

      return Reflect.get(target, prop, receiver)
    },
  })
})(
  PrismaAdapter(
    // @todo find out why we need to ignore this error
    // @ts-ignore
    prisma
  )
) as Required<Adapter>

export default adapter
