import type { AuthOptions } from 'next-auth'

import {
  ONE_MINUTE_IN_SECONDS,
  ONE_MONTH_IN_SECONDS,
} from '@chatbotkit-dev/time'

import adapter from '@/lib/auth.adapter'
import callbacks from '@/lib/auth.callbacks'

export const authOptions: AuthOptions = {
  adapter: adapter,

  providers: [], // @note we don't assign providers to avoid adding dependencies

  session: {
    // Here are the reasons why we should never use JWT and nobody else should
    // be wasting their time on this problem.
    //
    // 1. JWT cannot be properly invalidated. It is simply not possible to
    // revoke an active JWT token unless we look it up somehow which defeats
    // the purpose of having JWT to begin with.
    //
    // 2. It is subject to various security concerns. A signed JWT token is
    // useful for as long as the token is valid. This is particularly terrible
    // security problem when an account is already compromised.
    //
    // 3. Our API tokens are not based on JWT for the same reasons so even in
    // the case of serverless we still need to support databases somehow.
    //
    // The only reason we want to use JWT is to make the bloody serverless work
    // because it does not support prisma. The whole architecture just becomes
    // so much harder without a database and it is unclear if it is worth the
    // effort.
    //
    // For these reasons, using JWT is just simply not a good fit for this app.

    strategy: 'database',

    maxAge: ONE_MONTH_IN_SECONDS,
    updateAge: ONE_MINUTE_IN_SECONDS,
  },

  pages: {
    signIn: '/signin',
    error: '/signin',
    verifyRequest: '/signin/verify',
  },

  callbacks: callbacks,

  debug: !!process.env.DEBUG,
}

export default authOptions
