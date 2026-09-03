// @note the community storage default: an S3-protocol implementation of the
// object storage contract in @chatbotkit-dev/storage-spec. It returns the
// contract's neutral shapes rather than the SDK's, so that callers never
// depend on which service is behind them.
//
// It speaks the protocol, not the vendor: point SERVICE_AWS_ENDPOINT at any
// S3-compatible store (Garage, SeaweedFS, R2, or AWS itself, which is also
// the default when no endpoint is set). Sandbox storage mounts are the one
// AWS-shaped exception - they mint prefix-scoped credentials through STS
// AssumeRole, so they need a store with a compatible STS behind it.
//
// A deployment with different storage needs replaces this package with a
// pnpm override. See packages/AGENTS.md.
import { ONE_DAY_IN_SECONDS } from '@chatbotkit-dev/time'

import type {
  ListObjectsOptions,
  StorageMountRequest,
  StorageMounts,
  StorageScope,
  ObjectDownloadUrlOptions,
  ObjectUploadUrlOptions,
  PutObjectOptions,
  StorageListing,
  StorageObject,
  StorageObjectBody,
  StorageObjectInfo,
  StorageWritableBody,
} from '@chatbotkit-dev/storage-spec'

import debug, { assert } from '@chatbotkit-dev/debug'
import { join as joinPaths } from '@chatbotkit-dev/path'
import { normalizeText } from '@chatbotkit-dev/string'

import type { PutObjectCommandInput } from '@aws-sdk/client-s3'
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { z } from 'zod'

import { getBucketAccessCredentials, getStorageRoleArn } from './sts'

export type * from '@chatbotkit-dev/storage-spec'

const schema = z.object({
  SERVICE_AWS_REGION: z.string(),
  SERVICE_AWS_ACCESS_KEY_ID: z.string(),
  SERVICE_AWS_SECRET_ACCESS_KEY: z.string(),

  // @note unset means AWS proper. Any S3-compatible endpoint works here;
  // self-hosted stores usually need path-style addressing too, since
  // virtual-host style implies wildcard DNS in front of the store.
  SERVICE_AWS_ENDPOINT: z.string().url().optional(),
  SERVICE_AWS_FORCE_PATH_STYLE: z.enum(['true', 'false']).optional(),
})

// @note which bucket backs which logical store is this package's business
// alone. The platform names a scope; these variables are documented in this
// package's README, not in the platform's .env.example.

const BUCKET_ENV: Record<StorageScope, string> = {
  file: 'FILE_S3_BUCKET_NAME',
  image: 'IMAGE_S3_BUCKET_NAME',
  video: 'VIDEO_S3_BUCKET_NAME',
  audio: 'AUDIO_S3_BUCKET_NAME',
  conversation: 'CONVERSATION_S3_BUCKET_NAME',
  namespace: 'NAMESPACE_S3_BUCKET_NAME',
  session: 'SESSION_S3_BUCKET_NAME',
  space: 'SPACE_S3_BUCKET_NAME',
  temp: 'TEMP_S3_BUCKET_NAME',
  output: 'OUTPUT_S3_BUCKET_NAME',
}

function getBucket(scope: StorageScope): string {
  const name = BUCKET_ENV[scope]
  const bucket = process.env[name]

  if (!bucket) {
    throw new Error(
      `${name} is not set, so the "${scope}" store has no bucket behind it`
    )
  }

  return bucket
}

// @note configuration is resolved on first use, not at import. Parsing here
// would mean that anything transitively importing storage - markup handling,
// for one - needs this vendor's credentials merely to be loaded. See
// packages/AGENTS.md.

let cachedEnv: z.infer<typeof schema> | undefined

const globalObject = typeof global !== 'undefined' ? global : globalThis

// @note polyfill FileReader for Node.js environments where it's missing
{
  // @note aws sdk's stream-collector.js uses FileReader which may not be available in all environments

  if (
    typeof globalObject !== 'undefined' &&
    typeof globalObject.FileReader === 'undefined'
  ) {
    // @note create a minimal FileReader implementation for Node.js

    class FileReaderPolyfill {
      readyState: number
      result: string | null
      error: unknown
      onloadend: (() => void) | null
      onabort: (() => void) | null
      onerror: (() => void) | null

      constructor() {
        this.readyState = 0
        this.result = null
        this.error = null
        this.onloadend = null
        this.onabort = null
        this.onerror = null
      }

      readAsDataURL(blob: Blob) {
        this.readyState = 1

        blob
          .arrayBuffer()
          .then((buffer) => {
            const base64 = Buffer.from(buffer).toString('base64')

            this.result = `data:${
              blob.type || 'application/octet-stream'
            };base64,${base64}`

            this.readyState = 2

            if (this.onloadend) {
              this.onloadend()
            }
          })
          .catch((error) => {
            this.error = error
            this.readyState = 2

            if (this.onerror) {
              this.onerror()
            }
          })
      }

      abort() {
        this.readyState = 2

        if (this.onabort) {
          this.onabort()
        }
      }
    }

    // @ts-ignore - minimal polyfill is sufficient for AWS SDK stream-collector usage
    globalObject.FileReader = FileReaderPolyfill
  }
}

function getEnv(): z.infer<typeof schema> {
  if (!cachedEnv) {
    cachedEnv = schema.parse(process.env)
  }

  return cachedEnv
}

let cachedClient: S3Client | undefined

function getClient(): S3Client {
  if (!cachedClient) {
    const env = getEnv()

    cachedClient = new S3Client({
      region: env.SERVICE_AWS_REGION,

      ...(env.SERVICE_AWS_ENDPOINT && { endpoint: env.SERVICE_AWS_ENDPOINT }),

      forcePathStyle: env.SERVICE_AWS_FORCE_PATH_STYLE === 'true',

      credentials: {
        accessKeyId: env.SERVICE_AWS_ACCESS_KEY_ID,
        secretAccessKey: env.SERVICE_AWS_SECRET_ACCESS_KEY,
      },
    })
  }

  return cachedClient
}

/**
 * The SDK's `Body` is a stream augmented with transform helpers, and which
 * helpers exist depends on the runtime. This narrows it to the three the
 * contract promises.
 */
interface SdkStreamBody {
  transformToByteArray: () => Promise<Uint8Array>
  transformToString: () => Promise<string>
  transformToWebStream: () => ReadableStream<Uint8Array>
}

function toStorageObjectBody(body: unknown): StorageObjectBody | undefined {
  if (!body) {
    return undefined
  }

  const stream = body as SdkStreamBody

  return {
    async arrayBuffer() {
      const bytes = await stream.transformToByteArray()

      return bytes.buffer as ArrayBuffer
    },

    async text() {
      return await stream.transformToString()
    },

    stream() {
      return stream.transformToWebStream()
    },
  }
}

/**
 * Validates the security of the key.
 */
function assertValidKey(key: string): void {
  // @note prevents path traversal attacks by blocking ../ sequences in s3 keys
  assert(!key.includes('../'), 'key must not contain ../ sequences')
}

/**
 * Validates the security of the prefix.
 */
function assertValidPrefix(prefix: string): void {
  // @note prevents path traversal attacks by blocking ../ sequences in s3 prefixes
  assert(!prefix.includes('../'), 'prefix must not contain ../ sequences')

  // @note ensure the prefix is not empty
  assert(prefix.length > 0, 'prefix must be non-empty')
}

/**
 * Sanitizes an S3 object key according to AWS best practices.
 * Replaces characters that should be avoided in S3 keys with underscores.
 *
 * @see https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html
 */
export function sanitizeObjectKey(key: string): string {
  // @note remove or replace characters that should be avoided in S3 keys
  // @note characters to avoid: \ { } ^ % ` ] " > [ ~ < # | and non-printable ASCII (128-255)

  const avoidChars = /[\\{}^%`\]">\[~<#|]/g
  const nonPrintableAscii = /[\x80-\xFF]/g

  let sanitized = key
    .replace(avoidChars, '_') // @note replace avoided characters with underscore
    .replace(nonPrintableAscii, '_') // @note replace non-printable ASCII with underscore

  // @note remove control characters (ASCII 0-31 and 127)

  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '')

  return sanitized
}

/**
 * Lists objects in a bucket with the given prefix.
 */
export async function listObjects(
  scope: StorageScope,
  prefix: string,
  options?: ListObjectsOptions
): Promise<StorageListing> {
  debug(`listing objects in bucket`, { scope, prefix, options }).log(
    'aws.s3.listObjects'
  )

  const bucket = getBucket(scope)

  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    Delimiter: options?.delimiter,
    MaxKeys: options?.maxKeys,
    ContinuationToken: options?.continuationToken,
  })

  const response = await getClient().send(command)

  return {
    items: (response.Contents || [])
      .filter((object) => object.Key != null)
      .map((object) => ({
        key: object.Key as string,
        size: object.Size || 0,
        updatedAt: object.LastModified || new Date(),
      })),

    prefixes: (response.CommonPrefixes || [])
      .map((entry) => entry.Prefix)
      .filter((prefix): prefix is string => prefix != null),

    nextToken: response.NextContinuationToken,

    truncated: !!response.IsTruncated,
  }
}

/**
 * Gets object information for the given bucket and key.
 */
export async function headObject(
  scope: StorageScope,
  key: string
): Promise<StorageObjectInfo> {
  debug(`getting object head from bucket`, { scope, key }).log(
    'aws.s3.headObject'
  )

  const bucket = getBucket(scope)

  assertValidKey(key)

  const response = await getClient().send(
    new HeadObjectCommand({ Bucket: bucket, Key: key })
  )

  return {
    contentType: response.ContentType,
    contentDisposition: response.ContentDisposition,
    size: response.ContentLength,
    metadata: response.Metadata,
    updatedAt: response.LastModified,
  }
}

export async function getObject(
  scope: StorageScope,
  key: string
): Promise<StorageObject> {
  debug(`getting object from bucket`, { scope, key }).log('aws.s3.getObject')

  const bucket = getBucket(scope)

  assertValidKey(key)

  const response = await getClient().send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  )

  return {
    body: toStorageObjectBody(response.Body),
    contentType: response.ContentType,
    contentDisposition: response.ContentDisposition,
    size: response.ContentLength,
    metadata: response.Metadata,
    updatedAt: response.LastModified,
  }
}

export async function putObject(
  scope: StorageScope,
  key: string,
  body: StorageWritableBody,
  options?: PutObjectOptions
): Promise<void> {
  debug(`putting object in bucket`, { scope, key, options }).log(
    'aws.s3.putObject'
  )

  const bucket = getBucket(scope)

  assertValidKey(key)

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,

    // @note the contract's write union is deliberately narrower than the SDK's
    // `StreamingBlobPayloadInputTypes`, which names Node stream types a
    // backend-neutral contract has no business mentioning. Every member of the
    // narrower union is accepted by the SDK at runtime.
    Body: body as PutObjectCommandInput['Body'],

    ContentType: options?.contentType,
    Metadata: options?.metadata,
  })

  await getClient().send(command)
}

/**
 * Copies an object within a bucket to a new key.
 *
 * @note The CopySource parameter must be URL-encoded per AWS S3 API requirements.
 *       The AWS SDK v3 does NOT automatically encode the CopySource value, so we must
 *       do it ourselves. This is necessary for filenames containing special characters
 *       such as colons (:), plus signs (+), umlauts, spaces, or other non-ASCII characters.
 *
 * @see https://docs.aws.amazon.com/AmazonS3/latest/API/API_CopyObject.html
 *      (x-amz-copy-source: "The value must be URL-encoded.")
 * @see https://github.com/aws/aws-sdk-js-v3/issues/5475
 */
export async function copyObject(
  scope: StorageScope,
  sourceKey: string,
  destinationKey: string
): Promise<void> {
  debug(`copying object in bucket`, { scope, sourceKey, destinationKey }).log(
    'aws.s3.copyObject'
  )

  const bucket = getBucket(scope)

  assertValidKey(sourceKey)
  assertValidKey(destinationKey)

  const copySource = encodeURIComponent(joinPaths(bucket, sourceKey))

  const copyCommand = new CopyObjectCommand({
    Bucket: bucket,
    CopySource: copySource,
    Key: destinationKey,
  })

  await getClient().send(copyCommand)
}

/**
 * Moves an object within a bucket to a new key (copy + delete).
 *
 * @see copyObject for why CopySource is URL-encoded here.
 */
export async function moveObject(
  scope: StorageScope,
  sourceKey: string,
  destinationKey: string
): Promise<void> {
  debug(`moving object in bucket`, { scope, sourceKey, destinationKey }).log(
    'aws.s3.moveObject'
  )

  // @note no bucket resolution here: this delegates, and both callees resolve
  // the scope themselves

  await copyObject(scope, sourceKey, destinationKey)

  await deleteObject(scope, sourceKey)
}

/**
 * Deletes a single object from the given bucket.
 */
export async function deleteObject(scope: StorageScope, key: string): Promise<void> {
  debug(`deleting object from bucket`, { scope, key }).log(
    'aws.s3.deleteObject'
  )

  const bucket = getBucket(scope)

  assertValidKey(key)

  const command = new DeleteObjectCommand({ Bucket: bucket, Key: key })

  await getClient().send(command)
}

/**
 * Deletes all objects matching the given prefix in the given bucket.
 */
export async function deleteObjects(
  scope: StorageScope,
  prefix: string
): Promise<void> {
  debug(`deleting objects from bucket`, { scope, prefix }).log(
    'aws.s3.deleteObjects'
  )

  const bucket = getBucket(scope)

  prefix = prefix.trim()

  assertValidPrefix(prefix)

  if (!prefix.endsWith('/')) {
    prefix += '/'
  }

  const listing = await listObjects(scope, prefix)

  if (listing.items.length === 0) {
    return
  }

  await getClient().send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: listing.items.map((item) => ({ Key: item.key })),
        Quiet: true,
      },
    })
  )

  if (listing.truncated) {
    await deleteObjects(scope, prefix)
  }
}

export async function getObjectDownloadUrl(
  scope: StorageScope,
  key: string,
  options?: ObjectDownloadUrlOptions
): Promise<string> {
  debug(`generating download url for object`, { scope, key, options }).log(
    'aws.s3.getObjectDownloadUrl'
  )

  const bucket = getBucket(scope)

  assertValidKey(key)

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,

    ...(options?.download && {
      // @todo consider RFC 5987 for UTF-8 filenames based on the key if aws
      // does not do this automatically

      ResponseContentDisposition: 'attachment',
    }),
  })

  return await getSignedUrl(getClient(), command, {
    expiresIn: options?.expiresIn || ONE_DAY_IN_SECONDS,
  })
}

export async function getObjectUploadUrl(
  scope: StorageScope,
  key: string,
  options?: ObjectUploadUrlOptions
): Promise<string> {
  debug(`generating upload url for object`, { scope, key, options }).log(
    'aws.s3.getObjectUploadUrl'
  )

  const bucket = getBucket(scope)

  assertValidKey(key)

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,

    ...(options?.size && { ContentLength: options.size }),
    ...(options?.type && { ContentType: normalizeText(options.type) }),
    ...(options?.name && {
      ContentDisposition: `attachment; filename=${normalizeText(options.name)}`,
    }),
    ...(options?.metadata && { Metadata: options.metadata }),
  })

  return await getSignedUrl(getClient(), command, {
    expiresIn: options?.expiresIn || ONE_DAY_IN_SECONDS,
  })
}

/**
 * @note the shape of a presigned S3 URL: any host, with the signature's expiry
 * carried in the query string. Owned here rather than by the markup code so
 * that changing backend cannot leave the platform recognising the wrong thing.
 *
 * @note deliberately not anchored to a host: the endpoint is configurable, and
 * the SigV4 expiry marker is what makes a URL ephemeral, wherever it points.
 * Kept loose on the separator too - expired links pasted through third parties
 * arrive with their query strings mangled.
 */
export const ephemeralUrlPattern = /https?:\/\/\S+?X-Amz-Expires\S+/g

/**
 * Mounts for the requested stores.
 *
 * @note the endpoint is derived here rather than assembled by the caller. It
 * used to be built as `https://s3.${region}.amazonaws.com` inside the sandbox
 * code, which meant the platform knew which vendor was behind its storage - and
 * the bucket names came from the platform's own configuration too.
 */
export async function getMounts(
  requests: StorageMountRequest[]
): Promise<StorageMounts | null> {
  const locations: Record<string, string> = {}

  for (const { scope, prefix } of requests) {
    locations[getBucket(scope)] = `/${prefix}`
  }

  const access = await getBucketAccessCredentials(locations)

  const credentials = access.Credentials

  if (
    !credentials?.AccessKeyId ||
    !credentials.SecretAccessKey ||
    !credentials.SessionToken
  ) {
    throw new Error(
      'assuming the storage role returned incomplete credentials, so storage ' +
        'cannot be mounted'
    )
  }

  const env = getEnv()

  const region = env.SERVICE_AWS_REGION

  return {
    endpoint: env.SERVICE_AWS_ENDPOINT ?? `https://s3.${region}.amazonaws.com`,
    region,

    credentials: {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
    },

    mounts: requests.map(({ scope, prefix }) => ({
      scope,
      container: getBucket(scope),
      prefix,
    })),
  }
}

/**
 * @note this replaces a set of cases that used to live in the platform's own
 * unit suite and reached real AWS from there. Verifying that every configured
 * bucket is actually reachable with the configured credentials belongs to
 * whoever owns the credentials, and belongs in the environment-loaded
 * `providers` suite rather than in a package run with no environment at all.
 */
export async function assertConfigured(): Promise<void> {
  const scopes = Object.keys(BUCKET_ENV) as StorageScope[]

  const missing = scopes.filter((scope) => !process.env[BUCKET_ENV[scope]])

  if (missing.length) {
    throw new Error(
      `storage is not configured: ${missing
        .map((scope) => `${BUCKET_ENV[scope]} (${scope})`)
        .join(', ')} unset`
    )
  }

  if (!getStorageRoleArn()) {
    throw new Error(
      'SERVICE_AWS_STORAGE_ROLE_ARN is not set, so sandboxes cannot mount ' +
        'storage. It replaces a role ARN that used to be hardcoded in the ' +
        'platform source, so it must be supplied by the environment now.'
    )
  }

  // @note credentials are only proven by using them: a present-but-wrong key
  // reads exactly like a correct one until the first request.

  await Promise.all(
    scopes.map(async (scope) => {
      try {
        await listObjects(scope, '', { maxKeys: 1 })
      } catch (error) {
        throw new Error(
          `the "${scope}" store (${BUCKET_ENV[scope]}) is not reachable with ` +
            `the configured credentials: ${
              error instanceof Error ? error.message : String(error)
            }`
        )
      }
    })
  )
}
