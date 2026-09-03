// @note the object storage contract.
//
// The platform stores files, images, video, conversation attachments and space
// data. Where any of that physically lives is a deployment's choice, so the
// platform is written against this contract rather than against a vendor's SDK
// - and, just as importantly, is never configured with the locations either.
//
// The types below are deliberately not the AWS shapes. An implementation that
// returned `GetObjectOutput` would not be swappable: the next implementation
// would have to reproduce another vendor's response objects to satisfy callers
// that read `.Body`, `.Contents` and `.ContentLength`.

/**
 * The logical stores the platform keeps things in.
 *
 * @note the platform names one of these; it does not name a bucket, a
 * directory or a path. Where a scope actually lives is the implementation's
 * decision - ten buckets, one bucket with ten prefixes, ten directories on a
 * disk - and the platform is not entitled to an opinion about it, nor to the
 * configuration that expresses it.
 */
export type StorageScope =
  | 'file'
  | 'image'
  | 'video'
  | 'audio'
  | 'conversation'
  | 'namespace'
  | 'session'
  | 'space'
  | 'temp'
  | 'output'

/**
 * The contents of a stored object.
 *
 * @note this is the reason the contract exists. Callers previously reached into
 * an AWS `SdkStream` three incompatible ways - as a `ReadableStream`, via
 * `transformToByteArray`, and by bare truthiness. All three reduce to the three
 * methods here, and all three are implementable by any backend.
 */
export interface StorageObjectBody {
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  stream(): ReadableStream<Uint8Array>
}

/**
 * What is known about a stored object without reading it.
 */
export interface StorageObjectInfo {
  contentType?: string
  contentDisposition?: string
  size?: number
  metadata?: Record<string, string>
  updatedAt?: Date
}

export interface StorageObject extends StorageObjectInfo {
  /** Absent when the object exists but carries no content. */
  body?: StorageObjectBody
}

/**
 * Accepted when writing. Callers normalise to `Uint8Array` in practice; the
 * wider union exists so a caller holding a string or a stream does not have to
 * buffer it first.
 */
export type StorageWritableBody =
  | string
  | Uint8Array
  | ArrayBuffer
  | Blob
  | ReadableStream<Uint8Array>

export interface StorageListingItem {
  key: string
  size: number
  updatedAt: Date
}

export interface StorageListing {
  items: StorageListingItem[]

  /**
   * Keys grouped by the requested delimiter - the "directories" of a listing.
   */
  prefixes: string[]

  /** Pass back as `continuationToken` to read the next page. */
  nextToken?: string

  truncated: boolean
}

export interface ListObjectsOptions {
  delimiter?: string
  maxKeys?: number
  continuationToken?: string
}

export interface PutObjectOptions {
  contentType?: string
  metadata?: Record<string, string>
}

export interface ObjectDownloadUrlOptions {
  expiresIn?: number

  /** Serve with `Content-Disposition: attachment` rather than inline. */
  download?: boolean
}

/**
 * @note upload is presigned PUT only. The S3 presigned-POST form was carried in
 * the original module but had no callers, and it is the one operation whose
 * shape is an S3 protocol detail rather than a storage concept - so it is not
 * part of the contract. The client already uploads by PUT.
 */
export interface ObjectUploadUrlOptions {
  size?: number
  type?: string
  name?: string
  metadata?: Record<string, string>
  expiresIn?: number
}

/**
 * A request to make one logical store reachable inside a sandbox.
 */
export interface StorageMountRequest {
  scope: StorageScope
  prefix: string
}

/**
 * Everything a sandbox needs to mount the requested stores directly, so that
 * sandboxed code reaches storage without proxying every read through the
 * platform.
 *
 * @note `container` is the backend's own name for a store - a bucket, for an
 * S3-backed implementation. The platform relays it to the sandbox rather than
 * choosing it, which is the difference that matters: it never has to be
 * configured with one.
 */
export interface StorageMounts {
  endpoint: string
  region?: string

  credentials: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }

  mounts: {
    scope: StorageScope
    container: string
    prefix: string
  }[]
}

export interface StorageProvider {
  listObjects(
    scope: StorageScope,
    prefix: string,
    options?: ListObjectsOptions
  ): Promise<StorageListing>

  headObject(scope: StorageScope, key: string): Promise<StorageObjectInfo>

  getObject(scope: StorageScope, key: string): Promise<StorageObject>

  putObject(
    scope: StorageScope,
    key: string,
    body: StorageWritableBody,
    options?: PutObjectOptions
  ): Promise<void>

  copyObject(
    scope: StorageScope,
    sourceKey: string,
    destinationKey: string
  ): Promise<void>

  moveObject(
    scope: StorageScope,
    sourceKey: string,
    destinationKey: string
  ): Promise<void>

  deleteObject(scope: StorageScope, key: string): Promise<void>

  /** Deletes everything under `prefix`, paging until the prefix is empty. */
  deleteObjects(scope: StorageScope, prefix: string): Promise<void>

  getObjectDownloadUrl(
    scope: StorageScope,
    key: string,
    options?: ObjectDownloadUrlOptions
  ): Promise<string>

  getObjectUploadUrl(
    scope: StorageScope,
    key: string,
    options?: ObjectUploadUrlOptions
  ): Promise<string>

  /**
   * Matches URLs this backend issues that carry their own expiry.
   *
   * @note the platform strips these out of model output before persisting it,
   * so that a conversation does not end up holding links that are dead within
   * the day. That check used to be a regex on `amazonaws.com` and
   * `X-Amz-Expires` living in the markup code, which would have gone quietly
   * false the first time a deployment changed backend - the links would still
   * be written, just never recognised. It belongs to whoever mints the URLs.
   */
  ephemeralUrlPattern: RegExp

  /**
   * Normalises a key to what the backend can address. Backends differ on which
   * characters are safe, so this belongs to the implementation.
   */
  sanitizeObjectKey(key: string): string

  /**
   * Mounts for the requested stores, or null when the backend cannot issue
   * scoped credentials at all - in which case the caller degrades rather than
   * failing.
   */
  getMounts(requests: StorageMountRequest[]): Promise<StorageMounts | null>

  /**
   * @note the convention every swappable module follows. See
   * packages/AGENTS.md.
   */
  assertConfigured(): Promise<void>
}
