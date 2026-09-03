import prisma from '@/prisma/client'

import { runTasksBatch } from '@/lib/job'
import queue from '@/lib/queue'
import { parseAsync } from '@/lib/zod.schema'

import {
  CLEANUP_EVENT_TYPE,
  CleanupPayloadSchema,
  MAX_CONCURRENT_WORKERS,
  MAX_RECORD_BATCH,
  MAX_RECORD_TAKE,
  handleCleanupEvent,
  sendEvent,
} from './queue'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      memory: {
        paginate: jest.fn(),
        deleteMany: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/job', () => ({
  runTasksBatch: jest.fn(),
}))

jest.mock('@/lib/queue', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/queue2', () => ({
  __esModule: true,
  withQueueHandler: jest.fn((handlers) => handlers),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
}))

jest.mock('@/lib/error', () => ({
  captureInputError: jest.fn(),
}))

jest.mock('@/lib/zod.schema', () => ({
  parseAsync: jest.fn().mockResolvedValue(undefined),
}))

describe('memory queue constants', () => {
  it('CLEANUP_EVENT_TYPE should be "cleanup"', () => {
    expect(CLEANUP_EVENT_TYPE).toBe('cleanup')
  })

  it('MAX_RECORD_TAKE should be 1000', () => {
    expect(MAX_RECORD_TAKE).toBe(1000)
  })

  it('MAX_RECORD_BATCH should be 100', () => {
    expect(MAX_RECORD_BATCH).toBe(100)
  })

  it('MAX_CONCURRENT_WORKERS should be 10', () => {
    expect(MAX_CONCURRENT_WORKERS).toBe(10)
  })
})

describe('CleanupPayloadSchema', () => {
  it('should accept an empty object', () => {
    const result = CleanupPayloadSchema.safeParse({})

    expect(result.success).toBe(true)
  })

  it('should accept an object with extra properties', () => {
    const result = CleanupPayloadSchema.safeParse({ extra: 'ignored' })

    expect(result.success).toBe(true)
  })
})

describe('handleCleanupEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should paginate expired memories with the correct filter', async () => {
    const expiredMemoriesIterator = (async function* () {})()

    prisma.memory.paginate.mockReturnValue(expiredMemoriesIterator)
    runTasksBatch.mockResolvedValue(undefined)

    await handleCleanupEvent({})

    expect(prisma.memory.paginate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
        take: MAX_RECORD_TAKE,
      })
    )
  })

  it('should call runTasksBatch with the correct concurrency and batch size', async () => {
    const expiredMemoriesIterator = (async function* () {})()

    prisma.memory.paginate.mockReturnValue(expiredMemoriesIterator)
    runTasksBatch.mockResolvedValue(undefined)

    await handleCleanupEvent({})

    expect(runTasksBatch).toHaveBeenCalledWith(
      MAX_CONCURRENT_WORKERS,
      expiredMemoriesIterator,
      expect.any(Function),
      MAX_RECORD_BATCH
    )
  })

  it('should delete the memories passed to the batch worker', async () => {
    const expiredMemoriesIterator = (async function* () {})()
    const batchMemories = [{ id: 'mem-1' }, { id: 'mem-2' }]

    prisma.memory.paginate.mockReturnValue(expiredMemoriesIterator)

    // Capture the batch worker and invoke it directly to test deletion logic
    runTasksBatch.mockImplementation(async (_workers, _iter, batchFn, _size) => {
      await batchFn(batchMemories)
    })

    prisma.memory.deleteMany.mockResolvedValue({ count: 2 })

    await handleCleanupEvent({})

    expect(prisma.memory.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['mem-1', 'mem-2'],
        },
      },
    })
  })

  it('should propagate errors thrown by runTasksBatch', async () => {
    const expiredMemoriesIterator = (async function* () {})()

    prisma.memory.paginate.mockReturnValue(expiredMemoriesIterator)
    runTasksBatch.mockRejectedValue(new Error('batch failure'))

    await expect(handleCleanupEvent({})).rejects.toThrow('batch failure')
  })

  it('should pass a date in the past as the expiry cutoff', async () => {
    const before = new Date()
    const expiredMemoriesIterator = (async function* () {})()

    prisma.memory.paginate.mockReturnValue(expiredMemoriesIterator)
    runTasksBatch.mockResolvedValue(undefined)

    await handleCleanupEvent({})

    const calledWith = prisma.memory.paginate.mock.calls[0][0]
    const cutoff = calledWith.where.expiresAt.lt

    expect(cutoff.getTime()).toBeLessThanOrEqual(new Date().getTime())
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000)
  })
})

describe('sendEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should enqueue the event to the memory queue route', async () => {
    const event = { type: CLEANUP_EVENT_TYPE, payload: {} }

    await sendEvent(event)

    expect(queue).toHaveBeenCalledWith('/api/v1/memory/queue', event)
  })

  it('should validate the cleanup payload before enqueuing', async () => {
    const event = { type: CLEANUP_EVENT_TYPE, payload: {} }

    await sendEvent(event)

    expect(parseAsync).toHaveBeenCalledWith(
      CleanupPayloadSchema,
      {},
      expect.any(Function)
    )
  })

  it('should enqueue an event with additional payload properties', async () => {
    const event = { type: CLEANUP_EVENT_TYPE, payload: { extra: 'metadata' } }

    await sendEvent(event)

    expect(queue).toHaveBeenCalledWith('/api/v1/memory/queue', event)
  })
})
