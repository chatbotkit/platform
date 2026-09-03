import { subscriptionsConfig as subscriptions } from '@chatbotkit-dev/billing'

import handler from './list'

// @note SUBSCRIPTIONS_CONFIG is read from the environment, which the test
// environment does not carry; the endpoint serves the table only when the
// deployment sells (__esModule restored because the spread drops the real
// module's non-enumerable marker)
jest.mock('@/lib/billing.core', () => ({
  ...jest.requireActual('@/lib/billing.core'),

  __esModule: true,

  isSellable: true,
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

describe('/api/v1/platform/subscription/list', () => {
  it('should return subscriptions payload', async () => {
    const response = await handler({})

    expect(response.status).toBe(200)
    expect(response.body).toEqual(subscriptions)
  })
})
