import { useState } from 'react'
import {
  MdAddPhotoAlternate,
  MdContentCopy,
  MdDownload,
  MdEdit,
  MdImage,
} from 'react-icons/md'

import { defaultImageModel } from '@/config/models'

import { saveUrl } from '@/lib/save'
import toast from '@/lib/toast'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import FAQ from '@/components/FAQ'
import ImageModelSelect from '@/components/ImageModelSelect'
import NavHeader from '@/components/NavHeader'
import SendInstructions from '@/components/SendInstructions'
import SimpleTabs from '@/components/SimpleTabs'

import useDropzone from '@/hooks/useDropzone'
import useFetch from '@/hooks/useFetch'

import faq from '@/content/faqs/website-playground-image.yaml'

import clsx from 'clsx'

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)

    reader.readAsDataURL(file)
  })
}

function newImage(url, overrides = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url,
    ...overrides,
  }
}

function ImageDropzone({
  id,
  title,
  description,
  disabled,
  multiple,
  onDropAccepted,
}) {
  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      accept: {
        'image/*': [],
      },
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
      <MdAddPhotoAlternate className="h-8 w-8 shrink-0" />
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

function ImageActions({ onEdit, onCopy, onDownload, onRemove }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {onEdit ? (
        <button
          type="button"
          className="default-button tiny inline-flex items-center gap-1"
          onClick={onEdit}
        >
          <MdEdit className="h-4 w-4" />
          <span>Edit</span>
        </button>
      ) : null}
      {onCopy ? (
        <button
          type="button"
          className="default-button tiny inline-flex items-center gap-1"
          onClick={onCopy}
        >
          <MdContentCopy className="h-4 w-4" />
          <span>Copy</span>
        </button>
      ) : null}
      {onDownload ? (
        <button
          type="button"
          className="default-button tiny inline-flex items-center gap-1"
          onClick={onDownload}
        >
          <MdDownload className="h-4 w-4" />
          <span>Download</span>
        </button>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          className="default-button tiny"
          onClick={onRemove}
        >
          Remove
        </button>
      ) : null}
    </div>
  )
}

function ImagePreview({ image, label, onEdit, onDownload, onCopy, onRemove }) {
  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
        <img
          src={image.url}
          alt={image.name || label || 'Generated image'}
          className="block h-auto max-h-[70vh] w-full object-contain"
        />
      </div>
      <ImageActions
        onEdit={onEdit}
        onCopy={onCopy}
        onDownload={onDownload}
        onRemove={onRemove}
      />
    </div>
  )
}

function EditSourceImage({ image, label, onRemove }) {
  return (
    <div className="min-w-0">
      <div className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
        <img
          src={image.url}
          alt={image.name || label}
          className="h-full w-full object-cover"
        />
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

function ModeTabs({ mode, loading, setMode }) {
  return (
    <SimpleTabs
      selectedIndex={mode === 'edit' ? 1 : 0}
      onChange={(index) => {
        if (loading) {
          return
        }

        setMode(index === 1 ? 'edit' : 'generate')
      }}
      tabs={{
        Create: <></>,
        Edit: <></>,
      }}
      panelsClassName="hidden"
    />
  )
}

export default function Index() {
  const [mode, setMode] = useState('generate')

  const [prompt, setPrompt] = useState('')

  const [model, setModel] = useState(defaultImageModel)

  const [images, setImages] = useState([])
  const [sourceImages, setSourceImages] = useState([])
  const [maskImage, setMaskImage] = useState(null)

  const { loading, fetch } = useFetch({
    loadingMessage: mode === 'edit' ? 'Editing...' : 'Generating...',
    failureMessage: true,
  })

  const canSubmit =
    prompt.trim().length > 0 &&
    !loading &&
    (mode === 'generate' || sourceImages.length > 0)

  async function submitImages() {
    const endpoint =
      mode === 'edit' ? `/api/v1/image/edit` : `/api/v1/image/create`

    const payload =
      mode === 'edit'
        ? {
            prompt,
            model,
            images: sourceImages.map((image) => image.url),
            mask: maskImage?.url,
          }
        : {
            prompt,
            model,
          }

    const { error, data } = await fetch(endpoint, {
      data: payload,
    })

    if (error) {
      return
    }

    if (!Array.isArray(data?.urls)) {
      toast.error(data?.message || 'Failed to create image')

      return
    }

    const nextImages = data.urls.map((url, index) =>
      newImage(url, {
        name: `${mode === 'edit' ? 'Edited' : 'Generated'} ${index + 1}`,
        prompt,
        mode,
      })
    )

    setImages(nextImages)
  }

  function handleOnKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.keyCode === 13) {
      event.preventDefault()
      event.stopPropagation()

      if (canSubmit) {
        submitImages()
      }
    }
  }

  function handleOnClick(event) {
    event.preventDefault()
    event.stopPropagation()

    submitImages()
  }

  async function handleSourceFiles(files) {
    files = Array.from(files || [])

    if (!files.length) {
      return
    }

    const nextImages = await Promise.all(
      files.map(async (file) =>
        newImage(await fileToDataUrl(file), {
          name: file.name,
          source: 'upload',
        })
      )
    )

    setSourceImages((images) => [...images, ...nextImages])
    setMode('edit')
  }

  async function handleMaskFile(files) {
    const [file] = Array.from(files || [])

    if (!file) {
      return
    }

    setMaskImage(
      newImage(await fileToDataUrl(file), {
        name: file.name,
        source: 'mask',
      })
    )
    setMode('edit')
  }

  function addImageToSources(image) {
    setSourceImages((images) => [
      ...images,
      newImage(image.url, {
        name: image.name || 'Image result',
        source: 'result',
      }),
    ])
    setMode('edit')
  }

  async function copyImageUrl(image) {
    try {
      await navigator.clipboard.writeText(image.url)
      toast.success('Image URL copied to your clipboard')
    } catch {
      toast.error('Failed to copy image URL')
    }
  }

  return (
    <section className="section-white">
      <div className="main-page main-page-left">
        <NavHeader
          link="/playground"
          caption="playgrounds"
          title="Image"
          beta={true}
        >
          The Image playground allows you to create custom images using various
          types of pre-trained models. Experiment with different models and
          parameters to generate unique images that can be used in your chatbot
          or other projects.
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
                    ? 'Describe the change to make...'
                    : 'Describe the image to create...'
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
              message={mode === 'edit' ? 'edit an image' : 'create an image'}
            />
          </div>
          {mode === 'edit' ? (
            <div className="space-y-3">
              <div>
                <label className="default-label">Edit Inputs</label>
                <div className="mt-1 grid gap-3 sm:grid-cols-2">
                  <ImageDropzone
                    id="source-images"
                    title="Drop source images here"
                    description="Drag images here, or click to choose one or more."
                    multiple={true}
                    disabled={loading}
                    onDropAccepted={handleSourceFiles}
                  />
                  <ImageDropzone
                    id="mask-image"
                    title="Drop an optional mask"
                    description="Use a mask image to guide where edits should apply."
                    disabled={loading}
                    onDropAccepted={handleMaskFile}
                  />
                </div>
                <p className="input-description">
                  Add one or more source images. A mask is optional and can be
                  replaced by dropping another mask.
                </p>
              </div>
              {sourceImages.length ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {sourceImages.map((image, index) => (
                    <EditSourceImage
                      key={image.id}
                      image={image}
                      label={`Source ${index + 1}`}
                      onRemove={() =>
                        setSourceImages((images) =>
                          images.filter((item) => item.id !== image.id)
                        )
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-500">
                  <MdImage className="h-8 w-8" />
                  <span>Add an image to enable editing.</span>
                </div>
              )}
              {maskImage ? (
                <div>
                  <label className="default-label">Mask</label>
                  <div className="mt-1 max-w-32">
                    <EditSourceImage
                      image={maskImage}
                      label="Mask"
                      onRemove={() => setMaskImage(null)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div>
            <label className="default-label" htmlFor="model">
              Model
            </label>
            <div className="mt-1">
              <ImageModelSelect
                className="default-input w-full"
                value={model}
                setValue={setModel}
                disabled={loading}
              />
            </div>
            <p className="input-description">
              The model to use for generating or editing the image.
            </p>
          </div>
        </div>
        {images.length ? (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Results
            </h2>
            <div className="space-y-6">
              {images.map((image, index) => (
                <ImagePreview
                  key={image.id}
                  image={image}
                  label={`Result ${index + 1}`}
                  onEdit={() => addImageToSources(image)}
                  onCopy={() => copyImageUrl(image)}
                  onDownload={() =>
                    saveUrl(image.url, { name: image.name || 'image.png' })
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
      title="Generative AI Image Playground"
      description="Use this playground to experiment with different models and parameters to generate unique images that can be used in your chatbot or other projects."
      keywords="chatbot, playground, image, images, models, parameters"
      image={`/playground/image/card`}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

/**
 * @doc Playgrounds
 * @index 70
 *
 * ## Image
 *
 * The [Image Playground](https://chatbotkit.com/playground/image) lets you generate images with different prompts and model settings. It is useful for experimenting with visual output before you incorporate generated images into a workflow or experience.
 *
 * Use it when you want to compare models, refine prompts, and quickly see how changes affect the generated result.
 */
