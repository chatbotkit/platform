import { forwardRef, useEffect, useRef, useState } from 'react'

import { getYoutubeEmbedUrl, getYoutubeId, isYoutubeUrl } from '@/lib/youtube'

import clsx from 'clsx'

/**
 * Sends a player command to an embedded YouTube iframe. The embed must have
 * been created with `enablejsapi` for the player to listen.
 *
 * @param {HTMLIFrameElement|null} el
 * @param {string} func - e.g. 'playVideo', 'pauseVideo', 'mute', 'unMute'
 * @returns {void}
 */
export function command(el, func) {
  el?.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args: [] }),
    'https://www.youtube-nocookie.com'
  )
}

/**
 * Renders a YouTube video as a privacy-enhanced (youtube-nocookie) embed.
 * Accepts any youtube.com / youtu.be URL, or a bare video id.
 *
 * With `autoplayOnVisible` the player starts when the frame is fully in view
 * and pauses when it leaves. Browsers only permit muted autoplay, so the
 * player is muted before playing - the viewer unmutes with one click.
 *
 * With `chromeless` the player hides its control bar, disables its keyboard
 * shortcuts, drops the fullscreen button, and loops - looping is what keeps the
 * end-screen recommendations away, since `rel=0` only narrows suggestions to
 * the same channel rather than removing them.
 *
 * What chromeless cannot do: YouTube still shows its watermark, the title and
 * channel avatar before playback and while paused, and a transient centered
 * play/pause flash on state changes. There is no parameter for any of those,
 * and covering them is not an option either - the API's Required Minimum
 * Functionality terms forbid placing overlays in front of any part of the
 * player, including its controls. A landing page that needs a genuinely clean,
 * fully controllable surface should self-host the file and use the `<video>`
 * path instead of an embed.
 *
 * @param {object} props
 * @param {string} props.src - a YouTube URL or a bare video id
 * @param {string} [props.title]
 * @param {string} [props.className]
 * @param {boolean} [props.autoplay] - autoplay immediately on load
 * @param {boolean} [props.autoplayOnVisible] - autoplay when fully in view,
 *   pause when out of view
 * @param {boolean} [props.chromeless] - hide controls and overlays, loop
 * @param {() => void} [props.onAutoMute] - called whenever autoplayOnVisible
 *   mutes the player, so external mute toggles can stay in sync
 * @returns {import('react').JSX.Element}
 */
const YoutubePlayer = forwardRef(function YoutubePlayer(
  {
    src,
    title,
    className = 'w-full aspect-video',
    autoplay,
    autoplayOnVisible,
    chromeless,
    onAutoMute,
  },
  forwardedRef
) {
  const iframeRef = useRef(null)

  // @note the observer writes the latest visibility here so the iframe's load
  // handler can consult it - commands sent before the frame has loaded go
  // nowhere, so a frame that mounts already in view (e.g. swapping videos in a
  // tabbed player) must be started from onLoad, not from the observer
  const visibleRef = useRef(false)

  // @note kept in a ref so a new callback identity per render does not tear
  // down and recreate the observer
  const onAutoMuteRef = useRef(onAutoMute)

  useEffect(() => {
    onAutoMuteRef.current = onAutoMute
  })

  function mutePlay(el) {
    // @note browsers block unmuted autoplay - mute first so playback is
    // allowed; the viewer can unmute via the player controls or an external
    // toggle
    command(el, 'mute')
    command(el, 'playVideo')

    onAutoMuteRef.current?.()
  }

  function setRefs(el) {
    iframeRef.current = el

    if (typeof forwardedRef === 'function') {
      forwardedRef(el)
    } else if (forwardedRef) {
      forwardedRef.current = el
    }
  }

  // @note the IFrame API docs recommend pinning `origin` whenever enablejsapi
  // is set. this site answers on several hosts, so it is read from the browser
  // rather than baked in from SITE_URL - a mismatched origin would make the
  // player ignore our commands. the server render omits it and the iframe
  // remounts once the effect fills it in, which is unobservable because the
  // showcase sits below the fold
  const [origin, setOrigin] = useState(undefined)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const id = isYoutubeUrl(src) ? getYoutubeId(src) : src

  const jsapi = autoplayOnVisible || chromeless

  const url = getYoutubeEmbedUrl(id, {
    rel: false,
    autoplay,
    // @note iOS otherwise forces fullscreen, which breaks inline playback on
    // iPhone - and paid traffic skews mobile
    playsinline: true,
    enablejsapi: jsapi ? true : undefined,
    origin: jsapi ? origin : undefined,
    ...(chromeless
      ? {
          controls: false,
          disablekb: true,
          fs: false,
          ivLoadPolicy: 3,
          loop: true,
        }
      : {}),
  })

  useEffect(() => {
    if (!autoplayOnVisible) {
      return
    }

    const el = iframeRef.current

    if (!el || typeof IntersectionObserver === 'undefined') {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting

        if (entry.isIntersecting) {
          mutePlay(el)
        } else {
          command(el, 'pauseVideo')
        }
      },
      // @note fire only when (nearly) the whole frame is on screen - the small
      // margin below 1 guards against sub-pixel rounding never reaching a full
      // intersection ratio on some viewports
      { threshold: 0.98 }
    )

    observer.observe(el)

    return () => observer.disconnect()
  }, [autoplayOnVisible, url])

  function handleLoad() {
    if (autoplayOnVisible && visibleRef.current) {
      mutePlay(iframeRef.current)
    }
  }

  return (
    <iframe
      ref={setRefs}
      key={url}
      className={clsx(className, chromeless && 'pointer-events-none')}
      src={url}
      title={title}
      allow="autoplay; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen={!chromeless}
      onLoad={handleLoad}
    />
  )
})

export default YoutubePlayer
