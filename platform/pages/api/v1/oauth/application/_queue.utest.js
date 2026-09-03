/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import queueHandler, {
  CLEANUP_EVENT_TYPE,
  handleCleanupEvent,
  sendEvent,
} from './queue'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      oAuthApplicationToken: {
        deleteMany: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/queue', () => jest.fn())

jest.mock('@/lib/queue2', () => ({
  withQueueHandler: jest.fn((config) => config),
}))

const queue = require('@/lib/queue').default || require('@/lib/queue')
const prisma = require('@/prisma/client').default

describe('/api/v1/oauth/application/queue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deletes expired oauth application refresh tokens during cleanup', async () => {
    await handleCleanupEvent({})

    expect(prisma.oAuthApplicationToken.deleteMany).toHaveBeenCalledTimes(1)

    const args = prisma.oAuthApplicationToken.deleteMany.mock.calls[0][0]

    expect(args.where.refreshTokenExpiresAt.lt).toBeInstanceOf(Date)
  })

  it('queues validated cleanup events', async () => {
    const event = { type: CLEANUP_EVENT_TYPE, payload: {} }

    await sendEvent(event)

    expect(queue).toHaveBeenCalledWith('/api/oauth/queue', event)
  })

  it('exposes cleanup handler through queue configuration', () => {
    expect(queueHandler[CLEANUP_EVENT_TYPE]).toEqual(
      expect.objectContaining({
        handler: handleCleanupEvent,
      })
    )
  })
})
