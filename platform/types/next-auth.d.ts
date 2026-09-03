import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    id: string

    name?: string
    description?: string

    user: {
      id: string

      email: string
      displayEmail?: string

      name?: string
      description?: string

      image?: string

      parentId?: string | null
    } & DefaultSession['user']

    billing?: {
      plan?: string
      available?: boolean
      trialPlan?: string
      upgradeAvailable?: boolean
    }

    options: Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >, // @todo we need better type for this

    payload: {
      aud: string
    }
  }
}
