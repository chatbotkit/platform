// @note this suite used to construct a `BatchClient` and assert on the body it
// was handed. That client now lives behind `@chatbotkit-dev/batch`, along with
// its own tests, so what is left here is the platform's own half: the parameter
// names its callers use, and how long it waits.
//
// The provider is mocked rather than exercised. Whether the service accepts a
// job is not something this module can be wrong about.

import { runBatchJob, runBatchJobAsync } from '@/lib/batch'

const provider = {
  run: jest.fn(),
  get: jest.fn(),
}

jest.mock('@chatbotkit-dev/batch', () => ({
  __esModule: true,
  default: {
    run: (...args) => provider.run(...args),
    get: (...args) => provider.get(...args),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('runBatchJobAsync', () => {
  it('starts the job and returns its id', async () => {
    provider.run.mockResolvedValue({ id: 'job-123' })

    const result = await runBatchJobAsync({
      image: 'ghcr.io/chatbotkit/runner:latest',
      env: { TEST: 'value' },
    })

    expect(result).toEqual({ id: 'job-123' })
  })

  it('translates the platform parameter names into the contract', async () => {
    provider.run.mockResolvedValue({ id: 'job-123' })

    await runBatchJobAsync({
      image: 'test-image',
      manifest_ttl: 3600,
      env: { KEY: 'value' },
      timeout: 1800,
      memory: 1024,
      disk: 2048,
    })

    expect(provider.run).toHaveBeenCalledWith({
      image: 'test-image',
      env: { KEY: 'value' },
      timeout: 1800,
      manifestTtl: 3600,
      resources: { memoryMb: 1024, diskMb: 2048 },
    })
  })

  // @note a backend with nothing to allocate should not be handed an empty
  // preference to interpret
  it('omits resources when neither was asked for', async () => {
    provider.run.mockResolvedValue({ id: 'job-123' })

    await runBatchJobAsync({ image: 'test-image' })

    expect(provider.run).toHaveBeenCalledWith(
      expect.objectContaining({ resources: undefined })
    )
  })

  it('passes an empty environment through unchanged', async () => {
    provider.run.mockResolvedValue({ id: 'job-123' })

    await runBatchJobAsync({ image: 'test-image', env: {} })

    expect(provider.run).toHaveBeenCalledWith(
      expect.objectContaining({ env: {} })
    )
  })

  it('lets a failure to start reach the caller', async () => {
    provider.run.mockRejectedValue(new Error('Job creation failed'))

    await expect(runBatchJobAsync({ image: 'test-image' })).rejects.toThrow(
      'Job creation failed'
    )
  })
})

describe('runBatchJob', () => {
  it('polls until the job reaches a terminal state', async () => {
    provider.run.mockResolvedValue({ id: 'job-123' })

    provider.get
      .mockResolvedValueOnce({ id: 'job-123', status: 'queued' })
      .mockResolvedValueOnce({ id: 'job-123', status: 'running' })
      .mockResolvedValueOnce({
        id: 'job-123',
        status: 'completed',
        exitCode: 0,
      })

    const result = await runBatchJob({ image: 'test-image' }, { interval: 0 })

    expect(provider.get).toHaveBeenCalledTimes(3)

    expect(result).toEqual({ id: 'job-123', status: 'completed', exitCode: 0 })
  })

  // @note a failed job is an outcome, not an error - the caller wants the exit
  // code, and throwing here would lose it
  it('returns a failed job rather than throwing', async () => {
    provider.run.mockResolvedValue({ id: 'job-123' })

    provider.get.mockResolvedValue({
      id: 'job-123',
      status: 'failed',
      exitCode: 1,
      error: 'out of memory',
    })

    const result = await runBatchJob({ image: 'test-image' }, { interval: 0 })

    expect(result.status).toBe('failed')
    expect(result.error).toBe('out of memory')
  })

  it('treats a cancelled job as finished', async () => {
    provider.run.mockResolvedValue({ id: 'job-123' })

    provider.get.mockResolvedValue({ id: 'job-123', status: 'cancelled' })

    const result = await runBatchJob({ image: 'test-image' }, { interval: 0 })

    expect(result.status).toBe('cancelled')
  })

  it('gives up once the wait deadline passes', async () => {
    provider.run.mockResolvedValue({ id: 'job-123' })

    provider.get.mockResolvedValue({ id: 'job-123', status: 'running' })

    await expect(
      runBatchJob({ image: 'test-image' }, { interval: 0, timeout: 20 })
    ).rejects.toThrow('Job job-123 did not complete within 20ms')
  })

  it('lets a failure to read the job reach the caller', async () => {
    provider.run.mockResolvedValue({ id: 'job-123' })

    provider.get.mockRejectedValue(new Error('Wait timeout'))

    await expect(
      runBatchJob({ image: 'test-image' }, { interval: 0 })
    ).rejects.toThrow('Wait timeout')
  })
})
