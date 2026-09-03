/* global globalThis */
// @note the platform's side of the database.
//
// The engine, the schema, the adaptor and the generated client all live in
// `@chatbotkit-dev/db`, which pnpm resolves to whichever database module this
// deployment installs. What stays here is the part that is genuinely the
// platform's: its own extensions - audit, cache, retry, the custom model
// methods - and the lifecycle of the one shared instance.
//
// This file used to be generated: db:gen copied an adaptor variant over it on
// every build. The variants and their selection moved into the installed
// module, so this is now an ordinary committed file.
import {
  Prisma,
  createInstance as createBaseInstance,
} from '@chatbotkit-dev/db'

import { withAudit } from '@/prisma/audit'
import { withCache } from '@/prisma/cache'
import { withEncryption } from '@/prisma/encryption'
import { withMethods } from '@/prisma/methods'
import { withRetry } from '@/prisma/retry'

import debug from '@/lib/debug'

export { Prisma }

function createInstance() {
  debug(`creating prisma client`)

  return createBaseInstance()
    .$extends(withCache())
    .$extends(withRetry())
    .$extends(withEncryption())
    .$extends(withAudit())
    .$extends(withMethods())
}

function getInstance() {
  const globalKey = '8fff8a7e-c64d-4558-9000-15cefc53a31a'

  const globalStore = globalThis as unknown as {
    [globalKey]: Prisma | undefined
  }

  if (!globalStore[globalKey]) {
    globalStore[globalKey] = createInstance()
  }

  return globalStore[globalKey]
}

export type Prisma = ReturnType<typeof createInstance>

const handler = {
  get(_target, prop, receiver) {
    return Reflect.get(getInstance(), prop, receiver)
  },
}

const prisma: Prisma = new Proxy({}, handler)

export default prisma
