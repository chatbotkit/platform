import { assertConfigured, get, run } from './index'

// @note this default refuses, so what is worth testing is that it refuses
// *legibly*. A backend that cannot run containers is a normal deployment state;
// one that fails without naming the override is a support ticket.

describe('run', () => {
  it('refuses with UNSUPPORTED_OPERATION', async () => {
    await expect(
      run({ image: 'ghcr.io/chatbotkit/runner-sitemap:latest' })
    ).rejects.toMatchObject({
      batch: true,
      code: 'UNSUPPORTED_OPERATION',
    })
  })

  // @note the message has to name the public override point and contract
  it('names the override point and the contract in the message', async () => {
    await expect(run({ image: 'example:latest' })).rejects.toThrow(
      /@chatbotkit-dev\/batch.*BatchProvider.*@chatbotkit-dev\/batch-spec/
    )
  })

  it('names the image it was asked to run in the detail', async () => {
    await expect(run({ image: 'example:latest' })).rejects.toMatchObject({
      detail: expect.stringContaining('example:latest'),
    })
  })

  // @note the brand is what the platform detects errors with - structurally,
  // never `instanceof` - so a missing one is silently a different failure path
  it('brands the error so the platform recognises it', async () => {
    const error = await run({ image: 'example:latest' }).catch((e) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error.batch).toBe(true)
    expect(typeof error.code).toBe('string')
  })
})

describe('get', () => {
  it('reports JOB_NOT_FOUND rather than refusing', async () => {
    await expect(get('job-123')).rejects.toMatchObject({
      batch: true,
      code: 'JOB_NOT_FOUND',
    })
  })
})

describe('assertConfigured', () => {
  // @note unlike most public defaults this one throws, because nothing can be
  // served from it - see the note in index.ts
  it('fails the deployment readiness check', async () => {
    await expect(assertConfigured()).rejects.toThrow(
      /@chatbotkit-dev\/batch-spec/
    )
  })
})
