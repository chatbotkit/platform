/**
 * @jest-environment node
 */
import baseCall from '@/lib/call'
import call from '@/lib/egress.call'
import { withEgressDispatcher } from '@/lib/egress.core'

jest.mock('@/lib/call', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/egress.core', () => ({
  withEgressDispatcher: jest.fn((init) => init),
}))

describe('egress.call', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    baseCall.mockResolvedValue(new Response('ok'))
  })

  it('sends call through the egress dispatcher', async () => {
    const dispatcher = { egress: true }

    withEgressDispatcher.mockImplementation((init) => ({ ...init, dispatcher }))

    await call('https://example.com/', { headers: { a: 'b' } })

    expect(baseCall).toHaveBeenCalledWith('https://example.com/', {
      headers: { a: 'b' },
      dispatcher,
    })
  })

  it('leaves options untouched where no dispatcher applies', async () => {
    withEgressDispatcher.mockImplementation((init) => init)

    await call('https://example.com/', { method: 'GET' })

    expect(baseCall).toHaveBeenCalledWith('https://example.com/', {
      method: 'GET',
    })
  })
})
