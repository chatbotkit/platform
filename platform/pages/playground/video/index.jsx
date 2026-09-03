import { useEffect, useMemo, useState } from 'react'
import {
  MdContentCopy,
  MdDownload,
  MdEdit,
  MdMovie,
  MdUploadFile,
} from 'react-icons/md'

import { defaultVideoModel, visibleVideoModels } from '@/config/models'

import { parseAndRevealVideoModel } from '@/lib/model.utils'
import { saveUrl } from '@/lib/save'
import toast from '@/lib/toast'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import NavHeader from '@/components/NavHeader'
import SendInstructions from '@/components/SendInstructions'
import SimpleTabs from '@/components/SimpleTabs'
import VideoModelSelect from '@/components/VideoModelSelect'

import useFetch from '@/hooks/useFetch'
import useDropzone from '@/hooks/useDropzone'

import clsx from 'clsx'

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)

    reader.readAsDataURL(file)
  })
}

function newMedia(url, overrides = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url,
    ...overrides,
  }
}

function MediaDropzone({
  id,
  icon: Icon,
  title,
  description,
  accept,
  disabled,
  multiple,
  onDropAccepted,
}) {
  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      accept,
      disabled,
      multiple,
      onDropAccepted,
    })

  return (
    <div
      {...getRootProps({
        className: clsx(
          'group flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center transition',
          {
            'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-900/60':
              isDragActive && !isDragReject,
            'border-red-400 bg-red-50 text-red-600 dark:border-red-500 dark:bg-red-950/30 dark:text-red-300':
              isDragReject,
            'border-gray-300 text-gray-500 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-500 dark:hover:border-gray-600 dark:hover:bg-gray-900/50':
              !isDragActive && !isDragReject && !disabled,
            'cursor-not-allowed border-gray-200 text-gray-400 opacity-70 dark:border-gray-800 dark:text-gray-600':
              disabled,
          }
        ),
      })}
    >
      <input {...getInputProps({ id })} />
      <Icon className="h-8 w-8 shrink-0" />
      <div>
        <p className="text-sm font-medium text-gray-900 group-hover:text-gray-950 dark:text-gray-100 dark:group-hover:text-white">
          {isDragReject ? 'File type not accepted' : title}
        </p>
        <p className="mt-1 text-xs">
          {isDragActive ? 'Drop to add' : description}
        </p>
      </div>
      <span
        className={clsx('default-button tiny pointer-events-none mt-1', {
          disabled,
        })}
      >
        Browse files
      </span>
    </div>
  )
}

function ModeTabs({ mode, loading, setMode }) {
  return (
    <SimpleTabs
      selectedIndex={mode === 'edit' ? 1 : 0}
      onChange={(index) => {
        if (loading) {
          return
        }

        setMode(index === 1 ? 'edit' : 'create')
      }}
      tabs={{
        Create: <></>,
        Edit: <></>,
      }}
      panelsClassName="hidden"
    />
  )
}

function MediaInputPreview({ item, label, onRemove }) {
  return (
    <div className="min-w-0">
      <div className="aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
        {item.type === 'video' ? (
          <video
            src={item.url}
            className="h-full w-full object-cover"
            controls
            loop
            muted
          />
        ) : item.type === 'audio' ? (
          <div className="flex h-full items-center justify-center p-3">
            <audio src={item.url} controls className="w-full" />
          </div>
        ) : (
          <img
            src={item.url}
            alt={item.name || label}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-500">
          {label}
        </span>
        <button
          type="button"
          className="default-link text-xs"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </div>
  )
}

function VideoPreview({ video, onEdit, onCopy, onDownload }) {
  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
        <video
          src={video.url}
          className="block max-h-[70vh] w-full bg-black"
          controls
          loop
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="default-button tiny inline-flex items-center gap-1"
          onClick={onEdit}
        >
          <MdEdit className="h-4 w-4" />
          <span>Edit</span>
        </button>
        <button
          type="button"
          className="default-button tiny inline-flex items-center gap-1"
          onClick={onCopy}
        >
          <MdContentCopy className="h-4 w-4" />
          <span>Copy</span>
        </button>
        <button
          type="button"
          className="default-button tiny inline-flex items-center gap-1"
          onClick={onDownload}
        >
          <MdDownload className="h-4 w-4" />
          <span>Download</span>
        </button>
      </div>
    </div>
  )
}

export default function Index() {
  const [mode, setMode] = useState('create')
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState(defaultVideoModel)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [resolution, setResolution] = useState('720p')
  const [duration, setDuration] = useState('8')
  const [videos, setVideos] = useState([])
  const [frames, setFrames] = useState([])
  const [audios, setAudios] = useState([])
  const [results, setResults] = useState([])

  const { loading, fetch } = useFetch({
    loadingMessage: mode === 'edit' ? 'Editing...' : 'Creating...',
    failureMessage: true,
  })

  const videoModel = useMemo(() => {
    try {
      return parseAndRevealVideoModel(model).config
    } catch {
      return visibleVideoModels[defaultVideoModel]
    }
  }, [model])

  const aspectRatios = useMemo(
    () => videoModel?.availableAspectRatios || ['16:9'],
    [videoModel]
  )
  const durations = useMemo(
    () => videoModel?.availableDurations || [8],
    [videoModel]
  )
  const resolutions = useMemo(
    () => videoModel?.availableResolutions || ['720p'],
    [videoModel]
  )

  useEffect(() => {
    if (!aspectRatios.includes(aspectRatio)) {
      setAspectRatio(
        videoModel?.aspectRatio && aspectRatios.includes(videoModel?.aspectRatio)
          ? videoModel?.aspectRatio
          : aspectRatios[0]
      )
    }
  }, [aspectRatio, aspectRatios, videoModel?.aspectRatio])

  useEffect(() => {
    if (!durations.includes(Number(duration))) {
      const nextDuration =
        videoModel?.duration && durations.includes(videoModel?.duration)
          ? videoModel?.duration
          : durations[0]

      setDuration(String(nextDuration))
    }
  }, [duration, durations, videoModel?.duration])

  useEffect(() => {
    if (!resolutions.includes(resolution)) {
      setResolution(
        videoModel?.resolution && resolutions.includes(videoModel?.resolution)
          ? videoModel?.resolution
          : resolutions[0]
      )
    }
  }, [resolution, resolutions, videoModel?.resolution])

  const canSubmit =
    prompt.trim().length > 0 &&
    !loading &&
    (mode === 'create' ||
      videos.length > 0 ||
      frames.length > 0 ||
      audios.length > 0)

  async function submitVideos() {
    const endpoint =
      mode === 'edit' ? '/api/v1/video/edit' : '/api/v1/video/create'

    const payload =
      mode === 'edit'
        ? {
            prompt,
            model,
            aspectRatio,
            resolution,
            duration: Number(duration),
            videos: videos.map((video) => video.url),
            frames: frames.map((frame) => frame.url),
            audios: audios.map((audio) => audio.url),
          }
        : {
            prompt,
            model,
            aspectRatio,
            resolution,
            duration: Number(duration),
          }

    const { error, data } = await fetch(endpoint, {
      data: payload,
    })

    if (error) {
      return
    }

    if (!Array.isArray(data?.urls)) {
      toast.error(data?.message || 'Failed to create video')

      return
    }

    setResults(
      data.urls.map((url, index) =>
        newMedia(url, {
          name: `${mode === 'edit' ? 'Edited' : 'Created'} ${index + 1}`,
          mode,
          prompt,
        })
      )
    )
  }

  function handleOnKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.keyCode === 13) {
      event.preventDefault()
      event.stopPropagation()

      if (canSubmit) {
        submitVideos()
      }
    }
  }

  function handleOnClick(event) {
    event.preventDefault()
    event.stopPropagation()

    submitVideos()
  }

  async function handleFiles(files, type, setItems, limit) {
    files = Array.from(files || []).slice(0, limit)

    if (!files.length) {
      return
    }

    const items = await Promise.all(
      files.map(async (file) =>
        newMedia(await fileToDataUrl(file), {
          name: file.name,
          type,
          source: 'upload',
        })
      )
    )

    setItems((existingItems) => [...existingItems, ...items].slice(-limit))
    setMode('edit')
  }

  function addResultToEdit(video) {
    setVideos([
      newMedia(video.url, {
        name: video.name || 'Video result',
        type: 'video',
        source: 'result',
      }),
    ])
    setMode('edit')
  }

  async function copyVideoUrl(video) {
    try {
      await navigator.clipboard.writeText(video.url)
      toast.success('Video URL copied to your clipboard')
    } catch {
      toast.error('Failed to copy video URL')
    }
  }

  return (
    <section className="section-white">
      <div className="main-page main-page-left">
        <NavHeader
          link="/playground"
          caption="playgrounds"
          title="Video"
          beta={true}
        >
          The Video playground lets you create and edit short generated videos
          with a small set of experimental controls.
        </NavHeader>
        <div className="space-y-4">
          <ModeTabs mode={mode} loading={loading} setMode={setMode} />
          <div className="space-y-2">
            <div className="relative">
              <AutoTextarea
                className="default-input pr-28"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handleOnKeyDown}
                disabled={loading}
                placeholder={
                  mode === 'edit'
                    ? 'Describe the video edit...'
                    : 'Describe the video to create...'
                }
              />
              <div className="absolute bottom-2.5 right-1">
                <button
                  className="primary-button small"
                  type="button"
                  onClick={handleOnClick}
                  disabled={!canSubmit}
                >
                  {mode === 'edit' ? 'Edit' : 'Create'}
                </button>
              </div>
            </div>
            <SendInstructions
              message={mode === 'edit' ? 'edit a video' : 'create a video'}
            />
          </div>
          {mode === 'edit' ? (
            <div className="space-y-3">
              <div>
                <label className="default-label">Edit Inputs</label>
                <div className="mt-1 grid gap-3 lg:grid-cols-3">
                  <MediaDropzone
                    id="source-video"
                    icon={MdMovie}
                    title="Drop a source video"
                    description="Use one video as the edit source."
                    accept={{ 'video/*': [] }}
                    disabled={loading}
                    onDropAccepted={(files) =>
                      handleFiles(files, 'video', setVideos, 1)
                    }
                  />
                  <MediaDropzone
                    id="source-frame"
                    icon={MdUploadFile}
                    title="Drop start or end frames"
                    description="Add up to two image frames."
                    accept={{ 'image/*': [] }}
                    multiple={true}
                    disabled={loading || frames.length >= 2}
                    onDropAccepted={(files) =>
                      handleFiles(files, 'frame', setFrames, 2)
                    }
                  />
                  <MediaDropzone
                    id="source-audio"
                    icon={MdUploadFile}
                    title="Drop optional audio"
                    description="Use one audio file for the edit."
                    accept={{ 'audio/*': [] }}
                    disabled={loading}
                    onDropAccepted={(files) =>
                      handleFiles(files, 'audio', setAudios, 1)
                    }
                  />
                </div>
                <p className="input-description">
                  Add one source video. You can optionally add up to two frames
                  and one audio file.
                </p>
              </div>
              {videos.length || frames.length || audios.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {videos.map((video) => (
                    <MediaInputPreview
                      key={video.id}
                      item={video}
                      label="Video"
                      onRemove={() => setVideos([])}
                    />
                  ))}
                  {frames.map((frame, index) => (
                    <MediaInputPreview
                      key={frame.id}
                      item={frame}
                      label={index === 0 ? 'Start frame' : 'End frame'}
                      onRemove={() =>
                        setFrames((items) =>
                          items.filter((item) => item.id !== frame.id)
                        )
                      }
                    />
                  ))}
                  {audios.map((audio) => (
                    <MediaInputPreview
                      key={audio.id}
                      item={audio}
                      label="Audio"
                      onRemove={() => setAudios([])}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-500">
                  <MdMovie className="h-8 w-8" />
                  <span>Add a source video to enable editing.</span>
                </div>
              )}
            </div>
          ) : null}
          <div>
            <label className="default-label" htmlFor="model">
              Model
            </label>
            <div className="mt-1">
              <VideoModelSelect
                className="default-input w-full"
                value={model}
                setValue={setModel}
                disabled={loading}
              />
            </div>
            <p className="input-description">
              The model to use for creating or editing the video.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="default-label" htmlFor="aspectRatio">
                Aspect Ratio
              </label>
              <div className="mt-1">
                <select
                  id="aspectRatio"
                  className="default-input w-full"
                  value={aspectRatio}
                  disabled={loading}
                  onChange={(event) => setAspectRatio(event.target.value)}
                >
                  {aspectRatios.map((ratio) => (
                    <option key={ratio} value={ratio}>
                      {ratio}
                    </option>
                  ))}
                </select>
              </div>
              <p className="input-description">
                The output frame shape requested from the video model.
              </p>
            </div>
            <div>
              <label className="default-label" htmlFor="resolution">
                Resolution
              </label>
              <div className="mt-1">
                <select
                  id="resolution"
                  className="default-input w-full"
                  value={resolution}
                  disabled={loading}
                  onChange={(event) => setResolution(event.target.value)}
                >
                  {resolutions.map((resolution) => (
                    <option key={resolution} value={resolution}>
                      {resolution}
                    </option>
                  ))}
                </select>
              </div>
              <p className="input-description">
                The requested output quality. Support varies by model.
              </p>
            </div>
            <div>
              <label className="default-label" htmlFor="duration">
                Duration
              </label>
              <div className="mt-1">
                <select
                  id="duration"
                  className="default-input w-full"
                  value={duration}
                  disabled={loading}
                  onChange={(event) => setDuration(event.target.value)}
                >
                  {durations.map((duration) => (
                    <option key={duration} value={duration}>
                      {duration} seconds
                    </option>
                  ))}
                </select>
              </div>
              <p className="input-description">
                The requested video length. Support varies by model.
              </p>
            </div>
          </div>
        </div>
        {results.length ? (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Results
            </h2>
            <div className="space-y-6">
              {results.map((video, index) => (
                <VideoPreview
                  key={video.id}
                  video={video}
                  label={`Result ${index + 1}`}
                  onEdit={() => addResultToEdit(video)}
                  onCopy={() => copyVideoUrl(video)}
                  onDownload={() =>
                    saveUrl(video.url, { name: video.name || 'video.mp4' })
                  }
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['Playground', 'ChatBotKit']}
      title="Generative AI Video Playground"
      description="Use this playground to experiment with experimental video generation and editing."
      keywords="chatbot, playground, video, models"
      image={`/playground/video/card`}
    >
      {children}
    </Dashboard>
  )
}
