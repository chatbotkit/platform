import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import type { Session } from '@/lib/session.handler'
import call, { getCallError } from '@/lib/call'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import { typeToFileName } from '@/lib/mime'
import { throwNotAuthenticated } from '@/lib/response'
import { getRandomUserAgent } from '@/lib/ua'
import { filename } from '@/lib/url'
import { z } from '@/lib/zod.schema'

// --- Constants ---

const REDDIT_API = 'https://oauth.reddit.com'

const USER_AGENT = getRandomUserAgent()

// --- Handler Names ---

export const POST_IMAGE_CREATE_HANDLER_NAME = 'post/image/create'
export const POST_GALLERY_CREATE_HANDLER_NAME = 'post/gallery/create'
export const POST_VIDEO_CREATE_HANDLER_NAME = 'post/video/create'

// --- Schemas ---

export const postImageCreateSchema = z.object({
  subreddit: z.string(),
  title: z.string(),
  imageUrl: z.string(),
  nsfw: z.boolean().optional().default(false),
  spoiler: z.boolean().optional().default(false),
})

export type PostImageCreateSchema = z.infer<typeof postImageCreateSchema>

export const postGalleryCreateSchema = z.object({
  subreddit: z.string(),
  title: z.string(),
  imageUrls: z.string(),
  nsfw: z.boolean().optional().default(false),
  spoiler: z.boolean().optional().default(false),
})

export type PostGalleryCreateSchema = z.infer<typeof postGalleryCreateSchema>

export const postVideoCreateSchema = z.object({
  subreddit: z.string(),
  title: z.string(),
  videoUrl: z.string(),
  posterImageUrl: z.string(),
  nsfw: z.boolean().optional().default(false),
  spoiler: z.boolean().optional().default(false),
})

export type PostVideoCreateSchema = z.infer<typeof postVideoCreateSchema>

// --- Helpers ---

/**
 * Get the Reddit OAuth access token from headers or throw an authentication
 * error. The value is the full `Authorization` header (e.g. `Bearer <token>`)
 * and is passed through to {@link call} which proxies the request to Reddit.
 */
function getAccessToken(headers: Headers): string {
  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  return token
}

const submitResultSchema = z.object({
  json: z.object({
    errors: z.array(z.array(z.string())).default([]),
    data: z
      .object({
        url: z.string().optional(),
        id: z.string().optional(),
        name: z.string().optional(),
      })
      .optional(),
  }),
})

/**
 * Parse a Reddit submit response, surfacing any API-level errors (which come
 * back with a 200 status inside a `json.errors` array) as user input errors.
 *
 * @throws UserInputError if Reddit returns any submission errors, with the message
 */
function parseSubmitResult(data: unknown) {
  const { json } = submitResultSchema.parse(data)

  if (json.errors.length) {
    const message = json.errors
      .map((error) => error.slice(1).filter(Boolean).join(': ') || error[0])
      .join('; ')

    throw new UserInputError(`Reddit rejected the post: ${message}`)
  }

  return {
    id: json.data?.id,
    name: json.data?.name,
    url: json.data?.url,
  }
}

const leaseSchema = z.object({
  args: z.object({
    action: z.string(),
    fields: z.array(z.object({ name: z.string(), value: z.string() })),
  }),
  asset: z.object({
    asset_id: z.string(),
  }),
})

/**
 * Fetch a media file from a URL and upload it to Reddit's media bucket.
 *
 * Reddit media submission is a three step flow: request an upload lease,
 * upload the bytes to the returned S3 bucket, then reference the uploaded
 * media when submitting the post. This helper performs the first two steps so
 * callers only need to deal with URLs.
 *
 * @param expectedType - the expected media category ('image' or 'video') used
 * to validate the fetched content type.
 * @returns the asset id (used for galleries / video posts) and the uploaded
 * media URL (used for single image posts).
 */
async function uploadMedia(
  token: string,
  mediaUrl: string,
  expectedType: 'image' | 'video' = 'image'
): Promise<{ assetId: string; mediaUrl: string }> {
  let url: URL

  try {
    url = new URL(mediaUrl)
  } catch {
    throw new UserInputError(`Invalid ${expectedType} URL: ${mediaUrl}`)
  }

  // @note fetch the media bytes - no auth header so the request is not proxied

  const mediaResponse = await call(url.href)

  if (!mediaResponse.ok) {
    throw await getCallError(mediaResponse)
  }

  const blob = await mediaResponse.blob()
  const mimetype = blob.type

  if (!new RegExp(`^${expectedType}/`).test(mimetype)) {
    throw new UserInputError(
      `The URL does not point to ${expectedType === 'image' ? 'an image' : 'a video'} (got "${mimetype || 'unknown'}"): ${mediaUrl}`
    )
  }

  const name = filename(url.href) || typeToFileName(mimetype)

  // @note step 1: request an upload lease from Reddit

  const leaseResponse = await call(`${REDDIT_API}/api/media/asset.json`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({ filepath: name, mimetype }).toString(),
  })

  if (!leaseResponse.ok) {
    throw await getCallError(leaseResponse)
  }

  const { args, asset } = leaseSchema.parse(await leaseResponse.json())

  // @note step 2: upload the bytes to the S3 bucket described by the lease.
  // The action is protocol relative (e.g. //bucket.s3.amazonaws.com) and the
  // fields are presigned form values that must be sent verbatim before the
  // file. This is a direct upload to AWS - no Reddit auth header is attached.

  const uploadUrl = args.action.startsWith('//')
    ? `https:${args.action}`
    : args.action

  const form = new FormData()

  for (const field of args.fields) {
    form.append(field.name, field.value)
  }

  form.append('file', blob, name)

  const uploadResponse = await call(uploadUrl, {
    method: 'POST',
    body: form,
  })

  if (!uploadResponse.ok) {
    throw await getCallError(uploadResponse)
  }

  const key = args.fields.find((field) => field.name === 'key')?.value

  const uploadedUrl =
    uploadResponse.headers.get('location') ||
    (key ? `${uploadUrl}/${key}` : uploadUrl)

  return { assetId: asset.asset_id, mediaUrl: uploadedUrl }
}

// --- Handlers ---

async function postImageCreateHandler(
  _session: Session,
  parameters: PostImageCreateSchema,
  headers: Headers
) {
  debug(`reddit/post/image/create`, { parameters }).log(
    'auxiliary.reddit.post.postImageCreateHandler'
  )

  const { subreddit, title, imageUrl, nsfw, spoiler } = parameters

  const token = getAccessToken(headers)

  const { mediaUrl } = await uploadMedia(token, imageUrl)

  const body = new URLSearchParams({
    api_type: 'json',
    sr: subreddit,
    kind: 'image',
    title,
    url: mediaUrl,
    nsfw: String(nsfw),
    spoiler: String(spoiler),
  })

  const response = await call(`${REDDIT_API}/api/submit`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: body.toString(),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  return parseSubmitResult(await response.json())
}

async function postGalleryCreateHandler(
  _session: Session,
  parameters: PostGalleryCreateSchema,
  headers: Headers
) {
  debug(`reddit/post/gallery/create`, { parameters }).log(
    'auxiliary.reddit.post.postGalleryCreateHandler'
  )

  const { subreddit, title, imageUrls, nsfw, spoiler } = parameters

  const token = getAccessToken(headers)

  const urls = imageUrls
    .split(/\s+/)
    .map((url) => url.trim())
    .filter(Boolean)

  // @note Reddit galleries must contain between 2 and 20 images

  if (urls.length < 2) {
    throw new UserInputError(
      'A gallery requires at least two image URLs - use the single image post ability for one image'
    )
  }

  if (urls.length > 20) {
    throw new UserInputError('A gallery can contain at most 20 images')
  }

  // @note upload all images first, then reference them by asset id

  const uploads = await Promise.all(urls.map((url) => uploadMedia(token, url)))

  const items = uploads.map(({ assetId }) => ({
    caption: '',
    outbound_url: '',
    media_id: assetId,
  }))

  const response = await call(`${REDDIT_API}/api/submit_gallery_post.json`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      api_type: 'json',
      sr: subreddit,
      title,
      items,
      nsfw,
      spoiler,
      show_error_list: true,
    }),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  return parseSubmitResult(await response.json())
}

async function postVideoCreateHandler(
  _session: Session,
  parameters: PostVideoCreateSchema,
  headers: Headers
) {
  debug(`reddit/post/video/create`, { parameters }).log(
    'auxiliary.reddit.post.postVideoCreateHandler'
  )

  const { subreddit, title, videoUrl, posterImageUrl, nsfw, spoiler } =
    parameters

  const token = getAccessToken(headers)

  // @note Reddit requires a poster image for video posts. Upload both the
  // video and its thumbnail, then reference their media URLs in the submit.

  const [video, poster] = await Promise.all([
    uploadMedia(token, videoUrl, 'video'),
    uploadMedia(token, posterImageUrl, 'image'),
  ])

  const body = new URLSearchParams({
    api_type: 'json',
    sr: subreddit,
    kind: 'video',
    title,
    url: video.mediaUrl,
    video_poster_url: poster.mediaUrl,
    nsfw: String(nsfw),
    spoiler: String(spoiler),
  })

  const response = await call(`${REDDIT_API}/api/submit`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: body.toString(),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  return parseSubmitResult(await response.json())
}

// --- Export Multi Handler ---

export default authenticatedMultiHandler({
  [POST_IMAGE_CREATE_HANDLER_NAME]: {
    schema: postImageCreateSchema,
    fn: postImageCreateHandler,
  },
  [POST_GALLERY_CREATE_HANDLER_NAME]: {
    schema: postGalleryCreateSchema,
    fn: postGalleryCreateHandler,
  },
  [POST_VIDEO_CREATE_HANDLER_NAME]: {
    schema: postVideoCreateSchema,
    fn: postVideoCreateHandler,
  },
})
