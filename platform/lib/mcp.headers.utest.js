import prisma from '@/prisma/client'

import { swapSecrets } from '@/lib/secret.value'

import {
  resolveMcpHeaders,
  swapMcpHeaders,
  withDefaultSecretHeader,
} from './mcp.headers'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: { ability: { findUnique: jest.fn() } },
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
}))

jest.mock('@/lib/secret.value', () => ({
  ...jest.requireActual('@/lib/secret.value'),
  swapSecrets: jest.fn(),
}))

const user = { id: 'user-1' }

beforeEach(() => {
  jest.clearAllMocks()

  // echo the template back as if every placeholder resolved to itself
  swapSecrets.mockImplementation(async (headers) => new Headers(headers))
})

describe('withDefaultSecretHeader', () => {
  it('injects the default secret when a secret is linked and nothing authenticates', () => {
    expect(withDefaultSecretHeader({}, 'secret-1')).toEqual({
      Authorization: '${SECRET_DEFAULT}',
    })
  })

  it('leaves headers alone without a linked secret', () => {
    expect(withDefaultSecretHeader({ 'X-Custom': 'v' }, undefined)).toEqual({
      'X-Custom': 'v',
    })
  })

  it('does not override an explicit Authorization header', () => {
    const headers = { Authorization: 'Bearer own' }

    expect(withDefaultSecretHeader(headers, 'secret-1')).toBe(headers)
  })

  it('does not inject when the headers already reference a secret', () => {
    const headers = { 'X-Api-Key': '${SECRET_API}' }

    expect(withDefaultSecretHeader(headers, 'secret-1')).toBe(headers)
  })
})

describe('swapMcpHeaders', () => {
  it('returns undefined when there is nothing to send', async () => {
    await expect(
      swapMcpHeaders(user, { headerTemplate: {} })
    ).resolves.toBeUndefined()

    expect(swapSecrets).not.toHaveBeenCalled()
  })

  it('swaps the template against the given context', async () => {
    const result = await swapMcpHeaders(user, {
      headerTemplate: { 'X-Api-Key': '${SECRET_API}' },
      abilityId: 'ability-1',
      secretId: 'secret-1',
      inlineSecrets: { api: { value: 'k' } },
    })

    expect(swapSecrets).toHaveBeenCalledWith(
      { 'X-Api-Key': '${SECRET_API}' },
      {
        userId: 'user-1',
        abilityId: 'ability-1',
        secretId: 'secret-1',
        inlineSecrets: { api: { value: 'k' } },
        discardSecretPlaceholders: true,
      }
    )
    expect(result).toEqual({ 'x-api-key': '${SECRET_API}' })
  })
})

describe('resolveMcpHeaders', () => {
  it('re-reads the linked secret from the installing ability', async () => {
    prisma.ability.findUnique.mockResolvedValue({
      linkedSecretId: 'secret-rotated',
    })

    await resolveMcpHeaders(user, {
      headerTemplate: {},
      abilityId: 'ability-1',
      secretId: 'secret-installed',
    })

    expect(prisma.ability.findUnique).toHaveBeenCalledWith({
      where: { id: 'ability-1' },
      select: { linkedSecretId: true },
    })
    expect(swapSecrets).toHaveBeenCalledWith(
      { Authorization: '${SECRET_DEFAULT}' },
      expect.objectContaining({ secretId: 'secret-rotated' })
    )
  })

  it('drops the default secret header once the ability is unlinked', async () => {
    prisma.ability.findUnique.mockResolvedValue({ linkedSecretId: null })

    const result = await resolveMcpHeaders(user, {
      headerTemplate: {},
      abilityId: 'ability-1',
      secretId: 'secret-installed',
    })

    expect(result).toBeUndefined()
    expect(swapSecrets).not.toHaveBeenCalled()
  })

  it('falls back to the stored secret when the ability is gone', async () => {
    prisma.ability.findUnique.mockResolvedValue(null)

    await resolveMcpHeaders(user, {
      headerTemplate: {},
      abilityId: 'ability-deleted',
      secretId: 'secret-installed',
    })

    expect(swapSecrets).toHaveBeenCalledWith(
      { Authorization: '${SECRET_DEFAULT}' },
      expect.objectContaining({ secretId: 'secret-installed' })
    )
  })

  it('skips the lookup for inline abilities', async () => {
    await resolveMcpHeaders(user, {
      headerTemplate: { 'X-Custom': 'v' },
      inlineSecrets: {},
    })

    expect(prisma.ability.findUnique).not.toHaveBeenCalled()
  })
})
