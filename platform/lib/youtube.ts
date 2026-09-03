export function isYoutubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be|youtube-nocookie\.com/.test(url)
}

export function getYoutubeId(url: string): string | null {
  if (!url) {
    return null
  }

  const match = url.match(/(?:embed\/|watch\?v=|youtu\.be\/)(.*)/)

  if (match) {
    return match[1]
  } else {
    return null
  }
}

interface YoutubeEmbedOptions {
  autoplay?: boolean
  rel?: boolean
  controls?: boolean
  enablejsapi?: boolean
  disablekb?: boolean
  fs?: boolean
  ivLoadPolicy?: 1 | 3
  loop?: boolean
  playsinline?: boolean
  origin?: string
}

export function getYoutubeEmbedUrl(
  id: string,
  options?: YoutubeEmbedOptions
): string {
  // @see https://support.google.com/youtube/answer/171780?hl=en#zippy=%2Cturn-on-privacy-enhanced-mode

  const url = new URL(`https://www.youtube-nocookie.com/embed/${id}`)

  if (options?.autoplay === true) {
    url.searchParams.set('autoplay', '1')
  }

  if (options?.rel === false) {
    url.searchParams.set('rel', '0')
  }

  if (options?.controls === false) {
    url.searchParams.set('controls', '0')
  }

  if (options?.enablejsapi === true) {
    url.searchParams.set('enablejsapi', '1')
  }

  if (options?.disablekb === true) {
    url.searchParams.set('disablekb', '1')
  }

  if (options?.fs === false) {
    url.searchParams.set('fs', '0')
  }

  if (options?.ivLoadPolicy !== undefined) {
    url.searchParams.set('iv_load_policy', String(options.ivLoadPolicy))
  }

  if (options?.playsinline === true) {
    // @note without this iOS takes any playback fullscreen, which breaks
    // inline autoplay on iPhone
    url.searchParams.set('playsinline', '1')
  }

  if (options?.origin) {
    // @note the IFrame API docs recommend pinning the embedding origin
    // whenever enablejsapi is set
    url.searchParams.set('origin', options.origin)
  }

  if (options?.loop === true) {
    // @note the loop parameter only works when the player is treated as a
    // single-item playlist of the same video
    url.searchParams.set('loop', '1')
    url.searchParams.set('playlist', id)
  }

  return url.toString()
}

export function getYoutubeThumbnailUrl(id: string): string {
  return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`
}
