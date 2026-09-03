// @ts-check
import { useCallback, useRef } from 'react'

import { saveBlob } from '@/lib/save'

/**
 * @typedef {{
 *   onBeforeScreenshot?: () => (void|Promise<void>)
 *   onAfterScreenshot?: () => (void|Promise<void>)
 * }} UseScreenshotOptions
 *
 * @typedef {{
 *   targetRef: import('react').RefObject<any>
 *   takeScreenshot: () => Promise<void>
 * }} UseScreenshotReturn
 *
 * @param {UseScreenshotOptions} [options]
 * @returns {UseScreenshotReturn}
 */
export default function useScreenshot(options = {}) {
  const { onBeforeScreenshot, onAfterScreenshot } = options

  /** @type {import('react').RefObject<any>} */
  const targetRef = useRef(null)

  const takeScreenshot = useCallback(async () => {
    await onBeforeScreenshot?.()

    try {
      if (!targetRef.current) {
        throw new Error('No target element found')
      }

      // @note croptarget api requires a valid dom element reference

      const cropTarget = await window.CropTarget.fromElement(targetRef.current)

      // @note preferCurrentTab prevents the browser from showing a tab picker dialog

      const stream = await navigator.mediaDevices.getDisplayMedia({
        // @ts-ignore
        preferCurrentTab: true,
      })

      const [track] = stream.getVideoTracks()

      // @ts-ignore
      await track.cropTo(cropTarget)

      const video = document.createElement('video')

      {
        video.srcObject = stream
        video.play()
      }

      // @note wrap callback in promise so errors can be caught by caller

      await new Promise(
        /**
         * @param {(value?: any) => void} resolve
         * @param {(error: any) => void} reject
         */
        (resolve, reject) => {
          video.onloadedmetadata = async function () {
            try {
              const canvas = document.createElement('canvas')

              {
                canvas.width = video.videoWidth
                canvas.height = video.videoHeight
              }

              const context = canvas.getContext('2d')

              {
                context?.drawImage(video, 0, 0, canvas.width, canvas.height)
              }

              // @note wrap callback in promise so errors can be caught by caller

              await new Promise(
                /**
                 * @param {(value?: any) => void} resolveBlob
                 * @param {(error: any) => void} rejectBlob
                 */
                (resolveBlob, rejectBlob) => {
                  canvas.toBlob(function (blob) {
                    try {
                      if (!blob) {
                        // @note cleanup stream before throwing error

                        stream.getTracks().forEach((track) => track.stop())

                        throw new Error('Failed to create screenshot blob')
                      }

                      saveBlob(blob, { name: 'screenshot.png' })

                      // @note cleanup must happen after blob is created to
                      // prevent stream errors

                      stream.getTracks().forEach((track) => track.stop())

                      resolveBlob()
                    } catch (error) {
                      rejectBlob(error)
                    }
                  })
                }
              )

              await onAfterScreenshot?.()

              resolve()
            } catch (error) {
              reject(error)
            }
          }

          video.onerror = function (error) {
            // @note cleanup stream on video error

            stream.getTracks().forEach((track) => track.stop())

            reject(error)
          }
        }
      )
    } catch (error) {
      await onAfterScreenshot?.()

      throw error
    }
  }, [onBeforeScreenshot, onAfterScreenshot])

  return { targetRef, takeScreenshot }
}
