/**
 * @jest-environment node
 */
import { withEgressDispatcher } from '@/lib/egress.core'
import fetch from '@/lib/egress.fetch'
import baseFetch from '@/lib/fetch'

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/egress.core', () => ({
  withEgressDispatcher: jest.fn((init) => init),
}))

describe('egress.fetch', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    baseFetch.mockResolvedValue(new Response('ok'))
  })

  it('sends fetch through the egress dispatcher', async () => {
    const dispatcher = { egress: true }

    withEgressDispatcher.mockImplementation((init) => ({ ...init, dispatcher }))

    await fetch('https://example.com/', { method: 'POST' })

    expect(baseFetch).toHaveBeenCalledWith('https://example.com/', {
      method: 'POST',
      dispatcher,
    })
  })

  it('leaves options untouched where no dispatcher applies', async () => {
    withEgressDispatcher.mockImplementation((init) => init)

    await fetch('https://example.com/')

    expect(baseFetch).toHaveBeenCalledWith('https://example.com/', undefined)
  })
})
