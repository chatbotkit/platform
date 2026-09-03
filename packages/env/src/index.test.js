import { jest } from '@jest/globals'

const ENV_KEYS = [
  'NODE_ENV',
  'TARGET_ENV',
  'VERCEL_ENV',
  'VERCEL_URL',
  'NEXT_PUBLIC_VERCEL_URL',
]

function setEnv(name, value) {
  if (value === undefined) {
    delete process.env[name]

    return
  }

  process.env[name] = value
}

async function withEnvironment(environment, fn) {
  const previousEnv = Object.fromEntries(
    ENV_KEYS.map((name) => [name, process.env[name]])
  )

  try {
    for (const name of ENV_KEYS) {
      setEnv(name, environment[name])
    }

    jest.resetModules()

    await jest.isolateModulesAsync(async () => {
      await fn(await import('./index'))
    })
  } finally {
    for (const [name, value] of Object.entries(previousEnv)) {
      setEnv(name, value)
    }

    jest.resetModules()
  }
}

describe('environment identity', () => {
  it('identifies test from NODE_ENV', async () => {
    await withEnvironment({ NODE_ENV: 'test' }, async (environment) => {
      expect(environment.isTest).toBe(true)
      expect(environment.isDevelopment).toBe(true)
      expect(environment.isStaging).toBe(false)
      expect(environment.isProduction).toBe(false)
    })
  })

  it('identifies staging from TARGET_ENV', async () => {
    await withEnvironment(
      { NODE_ENV: 'production', TARGET_ENV: 'staging' },
      async (environment) => {
        expect(environment.isTest).toBe(false)
        expect(environment.isDevelopment).toBe(false)
        expect(environment.isStaging).toBe(true)
        expect(environment.isProduction).toBe(false)
      }
    )
  })

  it('identifies production when TARGET_ENV is absent', async () => {
    await withEnvironment(
      { NODE_ENV: 'production' },
      async (environment) => {
        expect(environment.isTest).toBe(false)
        expect(environment.isDevelopment).toBe(false)
        expect(environment.isStaging).toBe(false)
        expect(environment.isProduction).toBe(true)
      }
    )
  })

  it('does not derive environment identity from Vercel variables', async () => {
    await withEnvironment(
      {
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'preview.example.com',
      },
      async (environment) => {
        expect(environment.isStaging).toBe(false)
        expect(environment.isProduction).toBe(true)
        expect(environment).not.toHaveProperty('isOnVercel')
        expect(environment).not.toHaveProperty('isOnVercelPreview')
      }
    )
  })
})
