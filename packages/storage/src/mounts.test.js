// @note `getMounts` and `assertConfigured` are the two entry points nothing
// else exercises: the sandbox depends on the first, and the deploy gate in
// platform/tests/config/providers.utest.js depends on the second. Neither is
// reachable from a platform test, because the platform mocks this module.
import { jest } from '@jest/globals'

const send = jest.fn()
const stsSend = jest.fn()

class Command {
  constructor(input) {
    this.input = input
  }
}

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send })),
  ListObjectsV2Command: class extends Command {},
  HeadObjectCommand: class extends Command {},
  GetObjectCommand: class extends Command {},
  PutObjectCommand: class extends Command {},
  CopyObjectCommand: class extends Command {},
  DeleteObjectCommand: class extends Command {},
  DeleteObjectsCommand: class extends Command {},
}))

jest.unstable_mockModule('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://signed.example.com'),
}))

jest.unstable_mockModule('@aws-sdk/client-sts', () => ({
  STSClient: jest.fn(() => ({ send: stsSend })),
  AssumeRoleCommand: class extends Command {},
}))

const SCOPES = {
  FILE_S3_BUCKET_NAME: 'files',
  IMAGE_S3_BUCKET_NAME: 'images',
  VIDEO_S3_BUCKET_NAME: 'videos',
  AUDIO_S3_BUCKET_NAME: 'audios',
  CONVERSATION_S3_BUCKET_NAME: 'conversations',
  NAMESPACE_S3_BUCKET_NAME: 'namespaces',
  SESSION_S3_BUCKET_NAME: 'sessions',
  SPACE_S3_BUCKET_NAME: 'spaces',
  TEMP_S3_BUCKET_NAME: 'temps',
  OUTPUT_S3_BUCKET_NAME: 'outputs',
}

// @note the environment and both clients are resolved on first use and cached,
// so every case loads its own copy of the module.
async function load(overrides = {}) {
  jest.resetModules()

  for (const key of Object.keys(SCOPES)) {
    delete process.env[key]
  }

  Object.assign(process.env, {
    STORAGE_REGION: 'eu-west-1',
    STORAGE_ACCESS_KEY_ID: 'key',
    STORAGE_SECRET_ACCESS_KEY: 'secret',
    STORAGE_ROLE_ARN: 'arn:aws:iam::123:role/storage',
    ...SCOPES,
    ...overrides,
  })

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key]
    }
  }

  return await import('./index')
}

const CREDENTIALS = {
  Credentials: {
    AccessKeyId: 'temp-key',
    SecretAccessKey: 'temp-secret',
    SessionToken: 'temp-token',
  },
}

beforeEach(() => {
  send.mockReset()
  stsSend.mockReset()
})

describe('getMounts', () => {
  it('resolves each scope to its container and derives the endpoint', async () => {
    stsSend.mockResolvedValue(CREDENTIALS)

    const { getMounts } = await load()

    const result = await getMounts([
      { scope: 'space', prefix: 'space-1/data' },
      { scope: 'conversation', prefix: 'conv-1' },
    ])

    expect(result).toEqual({
      endpoint: 'https://s3.eu-west-1.amazonaws.com',
      region: 'eu-west-1',

      credentials: {
        accessKeyId: 'temp-key',
        secretAccessKey: 'temp-secret',
        sessionToken: 'temp-token',
      },

      mounts: [
        { scope: 'space', container: 'spaces', prefix: 'space-1/data' },
        { scope: 'conversation', container: 'conversations', prefix: 'conv-1' },
      ],
    })
  })

  it('scopes the assumed policy to the requested prefixes', async () => {
    stsSend.mockResolvedValue(CREDENTIALS)

    const { getMounts } = await load()

    await getMounts([{ scope: 'space', prefix: 'space-1/data' }])

    const policy = JSON.parse(stsSend.mock.calls[0][0].input.Policy)

    // @note the whole point of assuming a role here is that a sandbox reaches
    // only its own prefix, so a policy that widened would be a data leak
    expect(JSON.stringify(policy)).toContain('spaces/space-1/data/*')
    expect(JSON.stringify(policy)).not.toContain('spaces/*')
  })

  it('refuses when the role returns incomplete credentials', async () => {
    stsSend.mockResolvedValue({ Credentials: { AccessKeyId: 'only-one' } })

    const { getMounts } = await load()

    await expect(
      getMounts([{ scope: 'space', prefix: 'p' }])
    ).rejects.toThrow(/incomplete credentials/)
  })

  it('says what to set when the role is not configured', async () => {
    const { getMounts } = await load({
      STORAGE_ROLE_ARN: undefined,
    })

    // @note deliberately an error, not null. Null means the backend cannot mint
    // scoped credentials at all and the caller degrades past it; this backend
    // can, and is simply not configured to.
    await expect(getMounts([{ scope: 'space', prefix: 'p' }])).rejects.toThrow(
      /STORAGE_ROLE_ARN is not set/
    )
  })
})

describe('assertConfigured', () => {
  it('passes when every store is set and reachable', async () => {
    send.mockResolvedValue({})

    const { assertConfigured } = await load()

    await expect(assertConfigured()).resolves.toBeUndefined()
  })

  it('names every unset store rather than only the first', async () => {
    const { assertConfigured } = await load({
      IMAGE_S3_BUCKET_NAME: undefined,
      TEMP_S3_BUCKET_NAME: undefined,
    })

    const error = await assertConfigured().catch((e) => e)

    expect(error.message).toContain('IMAGE_S3_BUCKET_NAME')
    expect(error.message).toContain('TEMP_S3_BUCKET_NAME')
  })

  it('requires the mount role', async () => {
    const { assertConfigured } = await load({
      STORAGE_ROLE_ARN: undefined,
    })

    await expect(assertConfigured()).rejects.toThrow(
      /STORAGE_ROLE_ARN is not set/
    )
  })

  it('proves the credentials by using them, not by their presence', async () => {
    send.mockRejectedValue(new Error('AccessDenied'))

    const { assertConfigured } = await load()

    // @note a present-but-wrong key reads exactly like a correct one until the
    // first request, which is why this reaches the backend at all
    await expect(assertConfigured()).rejects.toThrow(/not reachable/)
  })

  it('names the store and its variable when one is unreachable', async () => {
    send.mockImplementation(async (command) => {
      if (command.input.Bucket === 'videos') {
        throw new Error('NoSuchBucket')
      }

      return {}
    })

    const { assertConfigured } = await load()

    const error = await assertConfigured().catch((e) => e)

    expect(error.message).toContain('"video"')
    expect(error.message).toContain('VIDEO_S3_BUCKET_NAME')
  })
})
