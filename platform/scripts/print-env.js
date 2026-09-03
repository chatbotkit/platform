import { log, runScript } from '@/lib/script'

/**
 * Print environment variables for debugging.
 *
 * Usage:
 * ```bash
 * pnpm script:print-env  # No options required
 * ```
 *
 * This script prints various environment variables including Node, Vercel,
 * Next.js, NextAuth, and build-related variables.
 *
 * @see https://vercel.com/docs/concepts/projects/environment-variables/system-environment-variables
 */
runScript({
  name: 'print-env',
  description: 'Print environment variables for debugging',
  options: {},
  handler: async () => {
    // node
    {
      const envs = ['NODE_OPTIONS']

      envs.forEach((env) => {
        log(`${env}=${process.env[env]}`)
      })
    }

    // vercel
    {
      const envs = ['CI']

      envs.forEach((env) => {
        log(`${env}=${process.env[env]}`)
      })
    }

    // platform (vercel)
    {
      const envs = [
        'VERCEL',
        'VERCEL_ENV',
        'VERCEL_URL',
        'VERCEL_REGION',
        'VERCEL_GIT_PROVIDER',
        'VERCEL_GIT_REPO_SLUG',
        'VERCEL_GIT_REPO_OWNER',
        'VERCEL_GIT_REPO_ID',
        'VERCEL_GIT_COMMIT_REF',
        'VERCEL_GIT_COMMIT_SHA',
        'VERCEL_GIT_COMMIT_MESSAGE',
        'VERCEL_GIT_COMMIT_AUTHOR_LOGIN',
        'VERCEL_GIT_COMMIT_AUTHOR_NAME',
        'VERCEL_GIT_PREVIOUS_SHA',
        'VERCEL_GIT_PULL_REQUEST_ID',
      ]

      envs.forEach((env) => {
        log(`${env}=${process.env[env]}`)
      })
    }

    // framework (next)
    {
      const envs = [
        'NEXT_PUBLIC_VERCEL_ENV',
        'NEXT_PUBLIC_VERCEL_URL',
        'NEXT_PUBLIC_VERCEL_GIT_PROVIDER',
        'NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG',
        'NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER',
        'NEXT_PUBLIC_VERCEL_GIT_REPO_ID',
        'NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF',
        'NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA',
        'NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE',
        'NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_LOGIN',
        'NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_NAME',
        'NEXT_PUBLIC_VERCEL_GIT_PULL_REQUEST_ID',
      ]

      envs.forEach((env) => {
        log(`${env}=${process.env[env]}`)
      })
    }

    // nextauth
    {
      const envs = ['NEXTAUTH_URL']

      envs.forEach((env) => {
        log(`${env}=${process.env[env]}`)
      })
    }

    // build
    {
      const envs = ['SKIP_STATIC_GENERATION']

      envs.forEach((env) => {
        log(`${env}=${process.env[env]}`)
      })
    }
  },
})
