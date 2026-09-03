// @note AWS Signature Version 4 over a plain fetch request. Small enough to
// carry here: pulling in an AWS SDK client for one JSON endpoint would make
// the community default's install several times larger than the rest of it.
import { createHash, createHmac } from 'node:crypto'

export interface SignOptions {
  method: string
  url: string
  headers: Record<string, string>
  body: string

  region: string
  service: string

  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string

  /** Signing time, defaults to now. */
  date?: Date
}

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}

function encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

// @note the pathname is already percent-encoded once by URL parsing, and
// every service except S3 expects each segment encoded a second time
function canonicalPath(pathname: string): string {
  return pathname.split('/').map(encode).join('/') || '/'
}

function canonicalQuery(params: URLSearchParams): string {
  return [...params.entries()]
    .map(([key, value]) => [encode(key), encode(value)])
    .sort(([ak, av], [bk, bv]) =>
      ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk)
    )
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}

/**
 * Signs a request and returns the headers to send it with, the caller's own
 * plus `x-amz-date`, `x-amz-security-token` when a session token is in play,
 * and `authorization`.
 */
export function sign(options: SignOptions): Record<string, string> {
  const {
    method,
    url,
    body,
    region,
    service,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    date = new Date(),
  } = options

  const { host, pathname, searchParams } = new URL(url)

  const amzDate = date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')

  const dateStamp = amzDate.slice(0, 8)

  const headers: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(options.headers).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ])
    ),

    host,
    'x-amz-date': amzDate,

    ...(sessionToken ? { 'x-amz-security-token': sessionToken } : null),
  }

  const signedHeaderNames = Object.keys(headers).sort()

  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name].trim().replace(/\s+/g, ' ')}\n`)
    .join('')

  const signedHeaders = signedHeaderNames.join(';')

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalPath(pathname),
    canonicalQuery(searchParams),
    canonicalHeaders,
    signedHeaders,
    sha256(body),
  ].join('\n')

  const scope = `${dateStamp}/${region}/${service}/aws4_request`

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join('\n')

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service),
    'aws4_request'
  )

  const signature = hmac(signingKey, stringToSign).toString('hex')

  // @note host is signed but not returned: fetch derives it from the URL and
  // refuses to have it set by hand
  const { host: _host, ...rest } = headers

  return {
    ...rest,

    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}
