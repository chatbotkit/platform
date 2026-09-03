'use client'

import { useCallback, useMemo, useState } from 'react'

import { captureException } from '@/lib/error'
import { TIMEOUT_ERROR_NAME, fetchPlusPlus } from '@/lib/fetch'
import { either } from '@/lib/helpers'
import {
  SERVICE_UNAVAILABLE_CODE,
  TIMEOUT_CODE,
  statusToCodeMap,
  statusToMessageMap,
} from '@/lib/response'
import toast from '@/lib/toast'
import { isURL, joinPathsAndGetPathname } from '@/lib/url'

import useRouter from '@/hooks/useRouter'

/**
 * @param {{
 *   trackLoading?: boolean,
 *   trackStreaming?: boolean,
 *   loadingMessage?: boolean|string,
 *   failureMessage?: boolean|string,
 *   successMessage?: boolean|string,
 *   streamingMessage?: boolean|string,
 *   loadingMessageDuration?: number,
 *   failureMessageDuration?: number,
 *   successMessageDuration?: number,
 *   streamingMessageDuration?: number,
 *   toastId?: string,
 *   headers?: Record<string, any>,
 *   timeout?: number,
 *   retries?: number,
 *   retryDelay?: number,
 *   xRequestedWith?: string,
 *   dataType?: string,
 *   basePrefix?: string,
 *   driver?: typeof fetchPlusPlus,
 * }} [options]
 */
export function useFetch(options) {
  const {
    trackLoading = true,
    trackStreaming = true,

    loadingMessage = false,
    failureMessage = false,
    successMessage = false,
    streamingMessage = false,

    loadingMessageDuration = Infinity,
    failureMessageDuration = 6000,
    successMessageDuration = 3000,
    streamingMessageDuration = Infinity,

    uploadProgress = false, // @todo implement upload progress
    downloadProgress = false, // @todo implement download progress

    toastId,

    headers: _headers,

    timeout = Infinity,

    retries = 5,
    retryDelay = 250,

    xRequestedWith = 'XMLHttpRequest',

    dataType = 'json',

    basePrefix,

    driver = fetchPlusPlus,
  } = options || {}

  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)

  const [error, setError] = useState(null)
  const [code, setCode] = useState(null)
  const [data, setData] = useState({})

  const headers = useMemo(() => {
    // @note we want to avoid common errors where the headers are set up
    // incorrectly as an object, which will result in doFetch callback updating
    // on every render

    // @note this implementation does not achieve that but this code remains
    // here for future reference

    return _headers
  }, [_headers])

  const basePath = router.basePath

  const fetch = useCallback(
    async (url, options = {}) => {
      if (!isURL(url)) {
        if (url.startsWith('!')) {
          url = url.slice(1)
        } else {
          if (basePrefix) {
            url = joinPathsAndGetPathname(basePrefix, url)
          }

          if (basePath) {
            url = joinPathsAndGetPathname(basePath, url)
          }

          // @todo basePath should be taken into account wen using the
          // resolveHref function, but it is not

          url = router.resolveHref(url)
        }
      }

      const tl = either(options.trackLoading, trackLoading)
      const ts = either(options.trackStreaming, trackStreaming)

      const lm = either(options.loadingMessage, loadingMessage)
      const fm = either(options.failureMessage, failureMessage)
      const sm = either(options.successMessage, successMessage)
      const gm = either(options.streamingMessage, streamingMessage)

      const lmd = either(options.loadingMessageDuration, loadingMessageDuration)
      const fmd = either(options.failureMessageDuration, failureMessageDuration)
      const smd = either(options.successMessageDuration, successMessageDuration)
      const gmd = either(
        options.streamingMessageDuration,
        streamingMessageDuration
      )

      const tt = either(options.timeout, timeout)
      const rs = either(options.retries, retries)
      const rd = either(options.retryDelay, retryDelay)

      const xrw = either(options.xRequestedWith, xRequestedWith)

      const dt = either(options.dataType, dataType)

      if (tl) {
        setLoading(options.loading ?? true)
      }

      let tid = either(options.toastId, toastId)

      if (lm) {
        tid = toast.loading(typeof lm === 'boolean' ? 'Loading...' : lm, {
          id: tid,
          duration: lmd,
        })
      }

      const fetchOptions = {
        ...options,

        headers: {
          ...headers,

          ...options.headers,
        },

        timeout: tt,

        retries: rs,
        retryDelay: rd,
      }

      // @note for convenience we are removing all undefined header values
      // because standard fetch will use them as strings and we don't want that
      {
        const headers = fetchOptions.headers

        for (const key in headers) {
          if (headers[key] === undefined) {
            delete headers[key]
          }
        }
      }

      if (fetchOptions.data) {
        const data = fetchOptions.data

        const body = JSON.stringify(data)

        delete fetchOptions.data

        if (!fetchOptions.method) {
          fetchOptions.method = 'POST'
        }

        fetchOptions.headers['Content-Type'] = 'application/json'

        fetchOptions.body = body
      }

      if (xrw) {
        // this is needed to ensure that we can differentiate requests made by
        // XMLHttpRequest for CSRF protection

        fetchOptions.headers['X-Requested-With'] = xrw
      }

      let res

      try {
        res = await driver(url, fetchOptions)
      } catch (e) {
        // @note a rejection here is a transport-level failure - the request
        // never produced a response (connection dropped, device offline, an
        // embedded WebView backgrounded mid-request, a DNS/TLS failure, or a
        // timeout). The driver has already exhausted its retries by this point.
        // On mobile Safari/WKWebView this surfaces as `TypeError: Load failed`.
        //
        // Historically this rejection escaped the hook and bubbled to the global
        // `unhandledrejection` handler, where Sentry reported it as a frameless
        // `TypeError: Load failed`. Instead we fold it into the
        // hook's normal `{ data, error, code }` contract so that every caller -
        // and everything built on top of this hook, such as `fetchStream` (which
        // turns an `{ error }` result into an in-band error event) - surfaces it
        // as a handled error state rather than an uncaught rejection.

        const isTimeout = [e?.name, e?.message].includes(TIMEOUT_ERROR_NAME)

        const error = isTimeout
          ? 'The request timed out. Please try again.'
          : 'There was a problem reaching the server. Please check your connection and try again.'

        const code = isTimeout ? TIMEOUT_CODE : SERVICE_UNAVAILABLE_CODE

        if (tl) {
          setLoading(false)
        }

        setError(error)
        setCode(code)

        if (fm) {
          toast.error(typeof fm === 'boolean' ? error : fm, {
            id: tid,
            duration: fmd,
          })
        } else {
          toast.dismiss(tid)
        }

        return { data: {}, error, code }
      }

      let error = undefined
      let code = undefined

      let data = {}

      let streamingStarted = false

      try {
        if (res.ok) {
          if (dt === 'body') {
            const reader = res.body.getReader()

            data = new ReadableStream({
              async start(controller) {
                streamingStarted = true

                if (ts) {
                  setStreaming(true)
                }

                if (gm) {
                  tid = toast.loading(
                    typeof gm === 'boolean' ? 'Streaming...' : gm,
                    {
                      id: tid,
                      duration: gmd,
                    }
                  )
                }

                try {
                  while (true) {
                    const { done, value } = await reader.read()

                    if (done) {
                      break
                    }

                    controller.enqueue(value)
                  }

                  controller.close()
                } finally {
                  if (ts) {
                    setStreaming(false)
                  }

                  toast.dismiss(tid)
                }
              },
            })
          } else {
            data = await res[dt]()
          }

          setData(data)
        } else {
          data = await res.text()

          // @note handle empty response bodies (e.g., HTTP 304 Not Modified)
          // which would cause JSON.parse('') to throw SyntaxError
          if (data) {
            // @note skip JSON parsing for HTML error pages (e.g. Next.js error
            // pages) to avoid noisy captureException calls in Sentry
            if (data.trimStart().startsWith('<')) {
              error = statusToMessageMap[res.status] || 'Error'
              code = statusToCodeMap[res.status] || 'BAD_REQUEST'
            } else {
              const { message: _error = 'Error', code: _code = 'BAD_REQUEST' } =
                JSON.parse(data)

              error = _error
              code = _code
            }
          } else {
            error = res.statusText || 'Error'
            code = statusToCodeMap[res.status] || 'BAD_REQUEST'
          }
        }
      } catch (e) {
        // @note enhance the error with request context for better debugging
        // in Sentry. The captureException function will pass e.data to Sentry.

        if (e && typeof e === 'object') {
          e.data = {
            ...e.data,

            url,

            status: res.status,
            statusText: res.statusText,

            dataType: dt,

            // @note include truncated response body to help diagnose parse failures
            responseBody:
              typeof data === 'string' ? data.slice(0, 500) : undefined,
          }
        }

        captureException(e)

        error =
          'There was an unexpected error. Please contact our support team for more information!'
        code = statusToCodeMap[res.status]
      } finally {
        if (error) {
          // the reason we disable this is because it is way too noise and if
          // there is an API error it should be manifested elsewhere

          // await captureError(data || error)

          setError(error)
        } else {
          setError(null)
        }

        if (code) {
          setCode(code)
        } else {
          setCode(null)
        }

        if (tl) {
          setLoading(false)
        }
      }

      if (error) {
        if (fm) {
          toast.error(typeof fm === 'boolean' ? error : fm, {
            id: tid,
            duration: fmd,
          })
        } else {
          toast.dismiss(tid)
        }
      } else {
        if (data) {
          if (sm) {
            toast.success(
              typeof sm === 'boolean' ? data.message || 'Success' : sm,
              { id: tid, duration: smd }
            )
          } else {
            if (!streamingStarted) {
              toast.dismiss(tid)
            }
          }
        } else {
          toast.dismiss(tid)
        }
      }

      return { data, error, code }
    },
    [
      trackLoading,
      trackStreaming,
      basePath,
      basePrefix,
      dataType,
      failureMessage,
      failureMessageDuration,
      headers,
      loadingMessage,
      loadingMessageDuration,
      retries,
      retryDelay,
      streamingMessage,
      streamingMessageDuration,
      successMessage,
      successMessageDuration,
      timeout,
      toastId,
      xRequestedWith,
      driver,
      router,
    ]
  )

  const reportError = useCallback(
    async (error, options) => {
      const fm = either(options?.failureMessage, failureMessage)

      const tid = either(options?.toastId, toastId)

      if (fm) {
        toast.error(error.message || error.code || '🙁', {
          id: tid,
          duration: 6000,
        })
      }
    },
    [failureMessage, toastId]
  )

  return {
    loading,
    setLoading,

    streaming,
    setStreaming,

    error,
    setError,

    code,
    setCode,

    data,
    setData,

    fetch,

    reportError,
  }
}

export default useFetch
