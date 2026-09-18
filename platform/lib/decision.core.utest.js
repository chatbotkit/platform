import { createDecision } from '@/lib/decision.core'
import { decide as decideOpenRouter } from '@/lib/model.provider.openrouter'
import { decide as decideTypeSafe } from '@/lib/model.provider.typesafe'
import { decide as decideVercel } from '@/lib/model.provider.vercel'

jest.mock('@/config/models', () => {
  const actual = jest.requireActual('@/config/models')

  const pricing = { tokenRatio: 0.003 }

  return {
    ...actual,
    __esModule: true,
    decisionModels: {
      jev: { provider: 'typesafe', providerModel: 'jev-latest', pricing },
      'jev-vercel': {
        provider: 'vercel',
        providerModel: 'typesafe-ai/jev',
        providerOptions: { gateway: { only: ['typesafe-ai'] } },
        pricing,
      },
      'jev-openrouter': {
        provider: 'openrouter',
        providerModel: '~typesafe/jev-latest',
        pricing,
      },
    },
    defaultDecisionModel: 'jev',
  }
})

jest.mock('@/lib/model.provider.typesafe', () => ({ decide: jest.fn() }))
jest.mock('@/lib/model.provider.vercel', () => ({ decide: jest.fn() }))
jest.mock('@/lib/model.provider.openrouter', () => ({ decide: jest.fn() }))

const questions = {
  refunded: { type: 'boolean', instructions: 'Was a refund issued?' },
}

const answers = { refunded: { type: 'boolean', probability: 0.99 } }

const result = {
  answers,
  usage: { model: 'provider-side-id', inputTokens: 283, outputTokens: 21 },
}

describe('createDecision', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // @ts-ignore
    decideTypeSafe.mockResolvedValue(result)
    // @ts-ignore
    decideVercel.mockResolvedValue(result)
    // @ts-ignore
    decideOpenRouter.mockResolvedValue(result)
  })

  it.each([
    ['jev', decideTypeSafe, 'jev-latest', undefined],
    [
      'jev-vercel',
      decideVercel,
      'typesafe-ai/jev',
      { gateway: { only: ['typesafe-ai'] } },
    ],
    ['jev-openrouter', decideOpenRouter, '~typesafe/jev-latest', undefined],
  ])(
    'dispatches %s to its provider with the provider model id',
    async (model, decide, providerModel, modelOptions) => {
      await createDecision('a refund was issued', questions, { model })

      expect(decide).toHaveBeenCalledTimes(1)
      expect(decide).toHaveBeenCalledWith(
        expect.objectContaining({
          model: providerModel,
          modelOptions,
          state: 'a refund was issued',
          questions,
        })
      )

      for (const other of [
        decideTypeSafe,
        decideVercel,
        decideOpenRouter,
      ]) {
        if (other !== decide) {
          expect(other).not.toHaveBeenCalled()
        }
      }
    }
  )

  it('falls back to the default decision model', async () => {
    await createDecision('state', questions)

    expect(decideTypeSafe).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'jev-latest' })
    )
  })

  it('returns the answers and stamps the platform model name onto usage', async () => {
    expect(
      await createDecision('state', questions, { model: 'jev-vercel' })
    ).toEqual({
      answers,
      usage: { model: 'jev-vercel', inputTokens: 283, outputTokens: 21 },
    })
  })

  it('rejects a model the catalogue does not define', async () => {
    await expect(
      createDecision('state', questions, { model: 'gpt-image-2' })
    ).rejects.toThrow()

    expect(decideTypeSafe).not.toHaveBeenCalled()
  })

  it('leaves retrying to the provider, so a failure is not multiplied here', async () => {
    // @ts-ignore
    decideTypeSafe.mockRejectedValueOnce(
      Object.assign(new Error('bad gateway'), { status: 502 })
    )

    await expect(createDecision('state', questions)).rejects.toThrow(
      'bad gateway'
    )

    expect(decideTypeSafe).toHaveBeenCalledTimes(1)
  })

  it('does not retry a request the provider rejected', async () => {
    // @ts-ignore
    decideTypeSafe.mockRejectedValueOnce(
      Object.assign(new Error('unprocessable'), { status: 422 })
    )

    await expect(createDecision('state', questions)).rejects.toThrow(
      'unprocessable'
    )

    expect(decideTypeSafe).toHaveBeenCalledTimes(1)
  })
})
