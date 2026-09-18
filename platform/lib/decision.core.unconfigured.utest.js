import { createDecision } from '@/lib/decision.core'
import { decide as decideTypeSafe } from '@/lib/model.provider.typesafe'

jest.mock('@/config/models', () => ({
  ...jest.requireActual('@/config/models'),
  __esModule: true,
  decisionModels: {},
  defaultDecisionModel: 'jev',
}))

jest.mock('@/lib/model.provider.typesafe', () => ({ decide: jest.fn() }))
jest.mock('@/lib/model.provider.vercel', () => ({ decide: jest.fn() }))
jest.mock('@/lib/model.provider.openrouter', () => ({ decide: jest.fn() }))

const questions = { q: { type: 'boolean', instructions: 'Is it urgent?' } }

// @note a deployment serves decision models only when a provider key is set,
// so an empty catalogue is the normal state of a fresh install
describe('createDecision on a deployment that serves no decision model', () => {
  it.each([[undefined], ['jev'], ['anything']])(
    'answers a bad request rather than an internal error for model %s',
    async (model) => {
      await expect(
        createDecision('state', questions, { model })
      ).rejects.toMatchObject({
        message: 'No decision model is configured on this deployment',
        code: 'BAD_REQUEST',
      })

      expect(decideTypeSafe).not.toHaveBeenCalled()
    }
  )
})
