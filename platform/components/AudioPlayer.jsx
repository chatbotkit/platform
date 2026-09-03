import { memo, useEffect, useRef, useState } from 'react'

import { PauseIcon, PlayIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

export default function AudioPlayer({ src, className, ...props }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const audioRef = useRef(null)
  const progressBarRef = useRef(null)

  useEffect(() => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    const setAudioData = () => {
      setDuration(audio.duration)
    }

    const setAudioProgress = () => {
      setProgress(audio.currentTime)
    }

    audio.addEventListener('loadeddata', setAudioData)
    audio.addEventListener('timeupdate', setAudioProgress)
    audio.addEventListener('ended', () => setIsPlaying(false))

    return () => {
      audio.removeEventListener('loadeddata', setAudioData)
      audio.removeEventListener('timeupdate', setAudioProgress)

      audio.removeEventListener('ended', () => {
        setIsPlaying(false)
      })
    }
  }, [])

  const togglePlayPause = async () => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    try {
      if (isPlaying) {
        audio.pause()

        setIsPlaying(false)
      } else {
        const playPromise = audio.play()

        if (playPromise !== undefined) {
          await playPromise

          setIsPlaying(true)
        } else {
          setIsPlaying(true)
        }
      }
    } catch {
      setIsPlaying(false)
    }
  }

  const handleProgressChange = (e) => {
    const audio = audioRef.current
    const progressBar = progressBarRef.current

    if (!audio || !progressBar) {
      return
    }

    const rect = progressBar.getBoundingClientRect()

    const percent = (e.clientX - rect.left) / rect.width

    audio.currentTime = percent * duration
  }

  return (
    <div {...props} className={clsx('flex flex-col gap-2 w-full', className)}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-center gap-3">
        <button
          className={clsx(
            'flex items-center justify-center',
            'w-5 h-5',
            'rounded-full',
            'text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
            'transition-colors duration-200'
          )}
          type="button"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          onClick={togglePlayPause}
        >
          {isPlaying ? (
            <PauseIcon className="w-full h-full" />
          ) : (
            <PlayIcon className="w-full h-full" />
          )}
        </button>
        <div
          ref={progressBarRef}
          className={clsx(
            'relative',
            'flex-1 h-1.5 overflow-hidden',
            'bg-gray-200 dark:bg-gray-800',
            'rounded-full',
            'cursor-pointer'
          )}
          onClick={handleProgressChange}
        >
          <div
            className={clsx(
              'absolute top-0 left-0',
              'h-full',
              'bg-indigo-500 dark:bg-gray-500',
              'rounded-full'
            )}
            style={{ width: `${(progress / duration) * 100 || 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}

AudioPlayer.Memo = memo(AudioPlayer)
