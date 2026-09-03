import {
  LIMITS_REACHED_CODE,
  NOT_AUTHENTICATED_CODE,
  NO_SUBSCRIPTION_CODE,
} from '@/lib/response'
import { bodySchema } from '@/pages/api/billing/checkout'

import CodeAction from './CodeAction'

import { act, render } from '@testing-library/react'

const mockPush = jest.fn()
const mockFetch = jest.fn()
const mockOpenPopup = jest.fn()

// @note SUBSCRIPTIONS_CONFIG is read from the environment, which the test
// environment does not carry; the trial-pairing behaviour under test needs a
// configured pro trial

jest.mock('@/config/limits', () => {
  const actual = jest.requireActual('@/config/limits')

  return {
    ...actual,
    __esModule: true,
    default: { pro: {}, ...actual.default },
    PLAN_KEYS: [...new Set(['pro', ...actual.PLAN_KEYS])],
    hasPlans: true,
  }
})

jest.mock('@chatbotkit-dev/billing', () => ({
  ...jest.requireActual('@chatbotkit-dev/billing'),

  __esModule: true,

  isConfigured: true,

  subscriptionsConfig: {
    trialDays: 7,

    trialPlans: ['pro'],

    pricing: {},
  },

}))

jest.mock('@/prisma/client', () => ({ __esModule: true, default: {} }))

jest.mock('@/hooks/useRouter', () => () => ({
  push: mockPush,
  asPath: '/current-path',
}))

jest.mock('@/hooks/useFetch', () => () => ({
  fetch: mockFetch,
}))

// @note self-serve actions render only when the session carries a billing
// context - the default here is a selling deployment; the unsellable case
// overrides it per test
// @note the deployment's primary trial plan rides in the session - the
// component's default plan and trial flag derive from it
let mockSessionData = { billing: { available: true, trialPlan: 'pro' } }

jest.mock('@/hooks/useSession', () => () => ({
  data: mockSessionData,
}))

jest.mock('@/hooks/usePopup', () => () => ({
  popup: null,
  openPopup: mockOpenPopup,
}))

describe('CodeAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('opens login popup and redirects to signin for not authenticated code', () => {
    render(<CodeAction code={NOT_AUTHENTICATED_CODE} />)

    expect(mockOpenPopup).toHaveBeenCalledTimes(1)

    const popupOptions = mockOpenPopup.mock.calls[0][1]

    expect(popupOptions.title).toBe('Login')

    popupOptions.actions.Login.fn()

    expect(mockPush).toHaveBeenCalledWith('/signin?callbackUrl=/current-path')
  })

  it('opens subscribe popup with Plans action when clickToSubscribe is false', () => {
    render(<CodeAction code={NO_SUBSCRIPTION_CODE} />)

    const popupOptions = mockOpenPopup.mock.calls[0][1]

    expect(popupOptions.title).toBe('Subscribe')

    popupOptions.actions.Plans.fn()

    expect(mockPush).toHaveBeenCalledWith('/pricing')
  })

  it('starts checkout and redirects when subscribing succeeds', async () => {
    mockFetch.mockResolvedValue({
      data: { redirectUrl: '/checkout' },
      error: null,
    })

    render(
      <CodeAction
        code={NO_SUBSCRIPTION_CODE}
        clickToSubscribe
        trial={false}
        plan="starter"
        returnTo="/return"
      />
    )

    const popupOptions = mockOpenPopup.mock.calls[0][1]

    await act(async () => {
      await popupOptions.actions.Subscribe.fn()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/billing/checkout', {
      data: {
        trial: false,
        plan: 'starter',
        returnTo: '/return',
      },
    })
    expect(mockPush).toHaveBeenCalledWith('/checkout')
  })

  it('defaults to a plan and trial pairing that checkout accepts', async () => {
    // @note checkout rejects a trial on a plan that does not offer one, so the
    // default plan and the default trial flag have to agree

    mockFetch.mockResolvedValue({
      data: { redirectUrl: '/checkout' },
      error: null,
    })

    render(<CodeAction code={NO_SUBSCRIPTION_CODE} clickToSubscribe />)

    const popupOptions = mockOpenPopup.mock.calls[0][1]

    await act(async () => {
      await popupOptions.actions['Start Trial'].fn()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/billing/checkout', {
      data: {
        trial: true,
        plan: 'pro',
        returnTo: expect.any(String),
      },
    })

    expect(
      bodySchema.validate(mockFetch.mock.calls[0][1].data).error
    ).toBeUndefined()
  })

  it('does not redirect when subscribe checkout returns an error', async () => {
    mockFetch.mockResolvedValue({
      data: { redirectUrl: '/checkout' },
      error: { message: 'checkout failed' },
    })

    render(<CodeAction code={NO_SUBSCRIPTION_CODE} clickToSubscribe />)

    const popupOptions = mockOpenPopup.mock.calls[0][1]

    await act(async () => {
      await popupOptions.actions['Start Trial'].fn()
    })

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('opens upgrade popup with usage action when clickToUpgrade is false', () => {
    render(<CodeAction code={LIMITS_REACHED_CODE} />)

    const popupOptions = mockOpenPopup.mock.calls[0][1]

    expect(popupOptions.title).toBe('Upgrade')

    popupOptions.actions['See Your Usage'].fn()

    expect(mockPush).toHaveBeenCalledWith('/usage')
  })

  it('starts checkout and redirects when upgrading succeeds', async () => {
    mockFetch.mockResolvedValue({
      data: { redirectUrl: '/upgrade' },
      error: null,
    })

    render(
      <CodeAction code={LIMITS_REACHED_CODE} clickToUpgrade trial={false} />
    )

    const popupOptions = mockOpenPopup.mock.calls[0][1]

    await act(async () => {
      await popupOptions.actions.Upgrade.fn()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/billing/checkout', {
      data: {
        trial: false,
        plan: expect.any(String),
        returnTo: '/current-path',
      },
    })
    expect(mockPush).toHaveBeenCalledWith('/upgrade')
  })

  describe('when embedded in an iframe', () => {
    let openSpy

    const originalTop = Object.getOwnPropertyDescriptor(window, 'top')

    beforeEach(() => {
      openSpy = jest.spyOn(window, 'open').mockImplementation(() => null)

      // @note make window.top differ from window.self so the component treats
      // itself as embedded
      Object.defineProperty(window, 'top', { configurable: true, value: {} })
    })

    afterEach(() => {
      openSpy.mockRestore()

      if (originalTop) {
        Object.defineProperty(window, 'top', originalTop)
      } else {
        Object.defineProperty(window, 'top', {
          configurable: true,
          value: window,
        })
      }
    })

    it('opens usage in a new tab instead of routing', () => {
      render(<CodeAction code={LIMITS_REACHED_CODE} />)

      const popupOptions = mockOpenPopup.mock.calls[0][1]

      popupOptions.actions['See Your Usage'].fn()

      expect(openSpy).toHaveBeenCalledWith('/usage', '_blank')
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('opens signin in a new tab instead of routing', () => {
      render(<CodeAction code={NOT_AUTHENTICATED_CODE} />)

      const popupOptions = mockOpenPopup.mock.calls[0][1]

      popupOptions.actions.Login.fn()

      expect(openSpy).toHaveBeenCalledWith(
        '/signin?callbackUrl=/current-path',
        '_blank'
      )
      expect(mockPush).not.toHaveBeenCalled()
    })
  })
  describe('unsellable deployment', () => {
    beforeEach(() => {
      mockSessionData = {}
    })

    afterEach(() => {
      mockSessionData = { billing: { available: true } }
    })

    it('explains reached limits without offering a dead-end upgrade', () => {
      render(<CodeAction code={LIMITS_REACHED_CODE} clickToUpgrade />)

      const popupOptions = mockOpenPopup.mock.calls[0][1]

      expect(popupOptions.actions['Start Trial']).toBeUndefined()
      expect(popupOptions.actions['Upgrade']).toBeUndefined()
      expect(popupOptions.actions['See Your Usage']).toBeDefined()
    })

    it('explains a missing subscription without offering checkout or plans', () => {
      render(<CodeAction code={NO_SUBSCRIPTION_CODE} clickToSubscribe />)

      const popupOptions = mockOpenPopup.mock.calls[0][1]

      expect(popupOptions.actions['Start Trial']).toBeUndefined()
      expect(popupOptions.actions['Subscribe']).toBeUndefined()
      expect(popupOptions.actions['Plans']).toBeUndefined()
    })
  })
})
