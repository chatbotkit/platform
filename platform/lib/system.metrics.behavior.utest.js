/**
 * @jest-environment node
 */
import { debug } from '@/lib/debug'

import { reportTokenUsage } from './system.metrics'

jest.mock('@/lib/debug', () => ({
  debug: jest.fn(),
}))

describe('system.metrics behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    debug.mockReturnValue({
      log: jest.fn(),
    })
  })

  it('reports token usage through debug logger with metric name', () => {
    const usage = {
      model: 'gpt-4o-mini',
      totalTokens: 120,
      promptTokens: 70,
      completionTokens: 50,
    }

    reportTokenUsage(usage)

    expect(debug).toHaveBeenCalledWith('reporting token usage', { usage })
    expect(debug.mock.results[0].value.log).toHaveBeenCalledWith(
      'system.metrics.reportTokenUsage'
    )
  })
})
