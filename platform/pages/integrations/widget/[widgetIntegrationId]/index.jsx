import { useEffect, useState } from 'react'

import { WIDGET_SESSION_DURATION_MAX_IN_MILLISECONDS } from '@/config/widget'

import prisma from '@/prisma/client'
import {
  FileVisibility,
  WidgetIntegrationFileAttachmentType,
} from '@/prisma/types'

import { getExamplesWithExportedThemes } from '@/lib/example.fetch'
import { formToData } from '@/lib/form'
import { getExternalHostURL } from '@/lib/host'
import { typeToFileName } from '@/lib/mime'
import { getSoftSession } from '@/lib/session.get'
import { withWidgetIntegrationResources } from '@/lib/solution'
import { makeJsonSafe } from '@/lib/struct'
import { buildTheme, themes as builtinThemes, parseTheme } from '@/lib/theme'
import toast from '@/lib/toast'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import BotSelect from '@/components/BotSelect'
import CodeAction from '@/components/CodeAction'
import CodeBlock from '@/components/CodeBlock'
import CommaListSelect from '@/components/CommaListSelect'
import { useConfirm, useConfirmDelete } from '@/components/Confirm'
import ConversationManager from '@/components/ConversationManager'
import DocsLink from '@/components/DocsLink'
import DurationSelect from '@/components/DurationSelect'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import HubOptions from '@/components/HubOptions'
import MarkdownCheatsheet from '@/components/MarkdownCheatsheet'
import MetaInput from '@/components/MetaInput'
import MultiLanguageSelect from '@/components/MultiLanguageSelect'
import PageSections from '@/components/PageSections'
import ThemeBuilder from '@/components/ThemeBuilder'
import ThisSolution from '@/components/ThisSolution'
import Toggle from '@/components/Toggle'
import WidgetPluginsSelect from '@/components/WidgetPluginsSelect'

import useControlledState from '@/hooks/useControlledState'
import useDropzone from '@/hooks/useDropzone'
import useFetch from '@/hooks/useFetch'
import { useStaticHostname } from '@/hooks/useHostname'
import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-integrations-widget.yaml'

import { XMarkIcon } from '@heroicons/react/20/solid'
import { CloudArrowUpIcon } from '@heroicons/react/24/outline'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

function getAttributes(options) {
  const div = document.createElement('div')

  for (const [key, value] of Object.entries(options)) {
    if (value) {
      div.dataset[key] = value
    }
  }

  return div.outerHTML.replace(/^<div|><\/div>$/g, '').trim()
}

export function getInstallCode(integration, staticHostname) {
  return `<script id="chatbotkit-widget" src="${getExternalHostURL(
    '/integrations/widget/v2.js',
    staticHostname
  )}" ${getAttributes({ widget: integration.id })}></script>`
}

export function Install({ integration }) {
  const staticHostname = useStaticHostname()

  const code = getInstallCode(integration, staticHostname)

  return (
    <>
      <input className="hidden" type="hidden" name="code" value={code} />
      <div className="prose prose-sm prose-sizeless dark:prose-invert">
        <p>
          To install the widget simply copy and paste the following code into
          your website:
        </p>
        <Expando
          titleClassName="default-link text-sm"
          title="Show Code"
          defaultOpen={true}
        >
          <CodeBlock className="max-h-96 text-sm" language="javascript">
            {code}
          </CodeBlock>
        </Expando>
        <p>
          The code can be inserted in any part of an HTML page. For more
          information see the{' '}
          <DocsLink className="default-link" slug="widget">
            integration docs
          </DocsLink>
          .
        </p>
      </div>
    </>
  )
}

function Icon({ type, value, onChange, onRemove }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
    },

    multiple: false,

    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]

        onChange?.(URL.createObjectURL(file))
      }
    },
  })

  function handleRemove(event) {
    event.stopPropagation()

    onRemove?.()
  }

  return (
    <div className="relative group">
      <div {...getRootProps()} className="cursor-pointer">
        <input {...getInputProps()} />
        <div className="flex flex-col gap-2 text-center">
          <div
            className={`w-16 h-16 rounded-xl border border-dashed ${
              isDragActive
                ? 'border-indigo-600 dark:border-white ring ring-indigo-600 dark:ring-white'
                : 'border-gray-400'
            } ${!value ? 'flex items-center justify-center' : ''}`}
          >
            {value ? (
              <img
                className="w-full h-full rounded-xl object-cover"
                src={value}
                alt={type}
              />
            ) : (
              <CloudArrowUpIcon className="h-6 w-6 text-gray-400" />
            )}
          </div>
          <div className="capitalize text-sm">{type}</div>
        </div>
      </div>
      {value ? (
        <XMarkIcon
          className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-hover:cursor-pointer w-5 h-5 absolute top-2 right-2 sepia transition-all duration-200"
          onClick={handleRemove}
        />
      ) : null}
    </div>
  )
}

export function Icons({ icons, setIcons }) {
  const types = Object.keys(WidgetIntegrationFileAttachmentType)

  function handleIconChange(type, value) {
    setIcons({ ...icons, [type]: value })
  }

  function handleIconRemove(type) {
    setIcons({ ...icons, [type]: undefined })
  }

  return (
    <div className="flex flex-row gap-4">
      {types.map((type) => (
        <Icon
          key={type}
          type={type}
          value={icons[type]}
          onChange={(value) => handleIconChange(type, value)}
          onRemove={() => handleIconRemove(type)}
        />
      ))}
    </div>
  )
}

export function Form({ integration, themes: _themes, variant = 'full' }) {
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const [title, setTitle] = useState(integration.title || '')
  const [intro, setIntro] = useState(integration.intro || '')
  const [initial, setInitial] = useState(integration.initial || '')
  const [placeholder, setPlaceholder] = useState(integration.placeholder || '')
  const [theme, setTheme] = useState(integration.theme || '')
  const [icons, setIcons] = useState({})

  const [themes, setThemes] = useControlledState(_themes)

  const { popup, openPopup } = usePopup()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const showConfiguration = ['configuration', 'full'].includes(variant)
  const showContent = ['content', 'full'].includes(variant)
  const showTheme = ['theme', 'full'].includes(variant)
  const showManagementActions = variant === 'configuration'
  const showTestAction = variant === 'theme'

  useEffect(() => {
    const newIcons = {}

    for (const file of integration.files) {
      newIcons[file.type] = `/api/v1/file/${
        file.fileId
      }/download?thumbnail=true&cache=false&version=${Date.now()}`
    }

    setIcons((icons) => ({ ...icons, ...newIcons }))
  }, [integration.files])

  async function updateIcons(widgetIntegrationId) {
    const newIcons = { ...icons }

    const subjectsToUpsert = Object.entries(icons).filter(([, url]) =>
      url?.startsWith('blob:')
    )

    for (const [type, url] of subjectsToUpsert) {
      const blob = await window.fetch(url).then((res) => res.blob())

      let fileId = integration.files.find((file) => file.type === type)?.fileId

      if (!fileId) {
        const { error: fileCreateError, data: fileCreateData } = await fetch(
          `/api/v1/file/create`,
          {
            data: scopeCreateData({
              visibility: FileVisibility.public,

              meta: {
                app: 'widget',
              },
            }),

            successMessage: `Creating file for ${type} icon`,
          }
        )

        if (fileCreateError) {
          return
        }

        fileId = fileCreateData.id

        const { error: fileAttachError } = await fetch(
          `/api/v1/integration/widget/${widgetIntegrationId}/file/${fileId}/attach`,
          {
            data: {
              type,
            },
            successMessage: `Creating file attachment for ${type} icon`,
          }
        )

        if (fileAttachError) {
          return
        }
      }

      const { error: fileUploadError, data: uploadData } = await fetch(
        `/api/v1/file/${fileId}/upload`,
        {
          method: 'POST',
          data: {
            file: {
              size: blob.size,
              type: blob.type || 'application/octet-stream',
              name: typeToFileName(type),
            },
          },
          successMessage: `Uploading file for ${type} icon`,
        }
      )

      if (fileUploadError) {
        return
      }

      await fetch(uploadData.uploadRequest.url, {
        method: uploadData.uploadRequest.method,
        headers: uploadData.uploadRequest.headers,
        body: await blob.arrayBuffer(),
        dataType: 'body',
        loadingMessage: 'Uploading file...',
        uploadProgress: true,
      })

      newIcons[type] =
        `/api/v1/file/${fileId}/thumbnail/download?cache=false&version=${Date.now()}`
    }

    const subjectsToRemove = integration.files
      .filter(({ type }) => !icons[type])
      .map(({ type, fileId }) => [type, fileId])

    for (const [type, fileId] of subjectsToRemove) {
      const { error: fileDetachError } = await fetch(
        `/api/v1/integration/widget/${widgetIntegrationId}/file/${fileId}/detach`,
        {
          data: {
            type,
          },
          successMessage: `Deleting file attachment for ${type} icon`,
        }
      )

      if (fileDetachError) {
        return
      }

      delete newIcons[type]
    }

    setIcons(newIcons)
  }

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (data.theme) {
      const { name, config } = parseTheme(data.theme)

      data.theme = buildTheme(name, { ...config, name: data.name })

      // @todo disabled because it does not work
      // {
      //   let v = !integration?.id ? 0 : updateCounter + 1

      //   const theme = buildTheme(name, {
      //     ...config,
      //     name: `Current Theme v${v}`,
      //   })

      //   setThemes((themes) => [...themes, theme])
      //   setTheme(theme)
      // }
    }

    if (integration.id) {
      const { error } = await fetch(
        `/api/v1/integration/widget/${integration.id}/update`,
        {
          data,

          successMessage: 'Widget integration updated.',
        }
      )

      if (!error) {
        Object.assign(integration, data)

        await updateIcons(integration.id)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: widgetIntegrationId },
      } = await fetch(`/api/v1/integration/widget/create`, {
        data: scopeCreateData(data),

        successMessage: 'Widget integration created.',
      })

      if (widgetIntegrationId) {
        await updateIcons(widgetIntegrationId)

        router.push(`/integrations/widget/${widgetIntegrationId}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (
      !(await confirmDelete('Do you really want to delete this integration?'))
    ) {
      return
    }

    const { error } = await fetch(
      `/api/v1/integration/widget/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'Widget integration deleted...',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  async function handleClone(event) {
    event.preventDefault()

    if (
      !(await confirm('Do you really want to clone this integration?', {
        actions: {
          Clone: { result: true, default: true },
        },
      }))
    ) {
      return
    }

    const { error, data } = await fetch(
      `/api/v1/integration/widget/${integration.id}/clone`,
      {
        data: {},

        successMessage: 'Widget integration cloned...',
      }
    )

    if (error) {
      return
    }

    router.push(`/integrations/widget/${data.id}`)
  }

  async function handleSetup(event) {
    event.preventDefault()

    await handleOnSubmit(event)

    await fetch(`/api/v1/integration/widget/${integration.id}/setup`, {
      data: {},

      successMessage: 'Widget setup completed.',
    })
  }

  function handleTest(event) {
    event.preventDefault()

    const a = document.createElement('a')

    a.href = `/integrations/widget/${integration.id}/test`
    a.target = '_blank'

    a.click()
  }

  function handleInstall(event) {
    event.preventDefault()

    openPopup(<Install integration={integration} />, {
      title: 'Install Instructions',
      cancelButtonCaption: 'I am done',

      actions: {
        Test: {
          fn() {
            const a = document.createElement('a')

            a.href = `/integrations/widget/${integration.id}/test`
            a.target = '_blank'

            a.click()
          },
        },

        Copy: {
          default: true,

          async fn({ code }) {
            try {
              await window.navigator?.clipboard?.writeText(code)

              toast.success('Code copied to your clipboard')
            } catch {
              // @note clipboard API may be blocked by permissions policy

              toast.error('Failed to copy code to clipboard')
            }
          },
        },
      },
    })
  }

  return (
    <>
      {popup}
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="integrations/widget"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          {showConfiguration ? (
            <div>
              <Headline title="Widget Integration Configuration">
                This information is used to configure some general options
                around the integration.
              </Headline>
              <div className="mt-6 space-y-6">
                {/* general basic options */}
                <GeneralBasicOptions instance={integration} />
                {/* botId */}
                <div>
                  <label className="default-label" htmlFor="botId">
                    Bot
                  </label>
                  <div className="mt-1">
                    <BotSelect
                      className="default-input w-full max-w-xs"
                      name="botId"
                      defaultValue={integration.botId}
                    />
                  </div>
                  <p className="input-description">Select an existing bot.</p>
                </div>
              </div>
            </div>
          ) : null}
          {/* application configuration */}
          {showTheme || showContent || showConfiguration ? (
            <div>
              <Headline
                title={
                  variant === 'theme'
                    ? 'Widget Theme Configuration'
                    : variant === 'content'
                      ? 'Widget Content Configuration'
                      : 'Widget Application Configuration'
                }
              >
                {variant === 'theme'
                  ? 'This information is used to configure the widget theme and appearance.'
                  : variant === 'content'
                    ? 'This information is used to configure the widget content and visible text.'
                    : 'This information is used to configure additional options related to your widget security.'}
              </Headline>
              <div className="mt-6 space-y-6">
                {/* title */}
                {showContent ? (
                  <div>
                    <label className="default-label" htmlFor="title">
                      Title
                    </label>
                    <div className="mt-1">
                      <input
                        className="default-input w-full sm:text-sm"
                        name="title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>
                    <p className="input-description">
                      A title for the widget top bar. There will be no title if
                      not provided.
                    </p>
                  </div>
                ) : null}
                {/* intro */}
                {showContent ? (
                  <div>
                    <label className="default-label" htmlFor="intro">
                      Intro
                    </label>
                    <div className="mt-1">
                      <AutoTextarea
                        className="default-input w-full sm:text-sm max-h-96 !overflow-auto"
                        name="intro"
                        type="text"
                        value={intro}
                        onChange={(e) => setIntro(e.target.value)}
                      />
                    </div>
                    <p className="input-description">
                      Text to be included before the conversation. It supports
                      markdown. Multiple lines will appear as separate messages
                      depending on the widget message style. You can also
                      customize this parameter with a widget customization
                      parameters. See the{' '}
                      <DocsLink className="default-link" slug="widget">
                        docs
                      </DocsLink>{' '}
                      for more information.
                    </p>
                    <MarkdownCheatsheet
                      className="mt-2"
                      markdownStyles={['widget']}
                    />
                  </div>
                ) : null}
                {/* initial */}
                {showContent ? (
                  <div>
                    <label className="default-label" htmlFor="initial">
                      Initial
                    </label>
                    <div className="mt-1">
                      <AutoTextarea
                        className="default-input w-full sm:text-sm max-h-96 !overflow-auto"
                        name="initial"
                        type="text"
                        value={initial}
                        onChange={(e) => setInitial(e.target.value)}
                      />
                    </div>
                    <p className="input-description">
                      Initial message to include before the conversation. It
                      supports markdown. Multiple lines will appear as separate
                      messages depending on the widget message style. You can
                      also customize this parameter with a widget customization
                      parameters. See the{' '}
                      <DocsLink className="default-link" slug="widget">
                        docs
                      </DocsLink>{' '}
                      for more information.
                    </p>
                    <MarkdownCheatsheet
                      className="mt-2"
                      markdownStyles={['widget']}
                    />
                  </div>
                ) : null}
                {/* placeholder */}
                {showContent ? (
                  <div>
                    <label className="default-label" htmlFor="placeholder">
                      Placeholder
                    </label>
                    <div className="mt-1">
                      <input
                        className="default-input w-full sm:text-sm"
                        name="placeholder"
                        type="text"
                        value={placeholder}
                        onChange={(e) => setPlaceholder(e.target.value)}
                      />
                    </div>
                    <p className="input-description">
                      Placeholder text that will be displayed in the chat input
                      field. See the{' '}
                      <DocsLink className="default-link" slug="widget">
                        docs
                      </DocsLink>{' '}
                      for more information.
                    </p>
                  </div>
                ) : null}
                {/* theme */}
                {showTheme ? (
                  <div>
                    <label className="default-label" htmlFor="theme">
                      Theme
                    </label>
                    <div className="mt-1">
                      <div className="space-y-4">
                        <div className="[&_.not-main-page]:rounded-xl">
                          <ThemeBuilder
                            className="w-full h-[800px] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden"
                            name="theme"
                            themes={themes}
                            setThemes={setThemes}
                            value={theme}
                            setValue={setTheme}
                            title={title}
                            onTitleChange={setTitle}
                            intro={intro}
                            onIntroChange={setIntro}
                            initial={initial}
                            onInitialChange={setInitial}
                            placeholder={placeholder}
                            barIcon={icons.bar}
                            userIcon={icons.user}
                            botIcon={icons.bot}
                            buttonIcon={icons.button}
                            tools={integration.tools}
                            poweredBy={integration.poweredBy}
                          />
                        </div>
                        <Icons icons={icons} setIcons={setIcons} />
                      </div>
                    </div>
                    <p className="input-description">
                      The theme for this widget. You can choose one of the
                      pre-made themes or build your own. See the{' '}
                      <DocsLink className="default-link" slug="widget">
                        docs
                      </DocsLink>{' '}
                      for more information.
                    </p>
                  </div>
                ) : null}
                {/* layout */}
                {showTheme ? (
                  <div>
                    <label className="default-label" htmlFor="layout">
                      Layout
                      <sup className="beta">BETA</sup>
                    </label>
                    <div className="mt-1">
                      <select
                        className="default-input w-full max-w-xs sm:text-sm"
                        name="layout"
                        defaultValue={integration.layout}
                      >
                        <option value="popover">Pop Over</option>
                        <option value="popout">Pop Out</option>
                      </select>
                    </div>
                    <p className="input-description">
                      The layout for this widget. You can choose one of the
                      pre-made layouts. See the{' '}
                      <DocsLink className="default-link" slug="widget">
                        docs
                      </DocsLink>{' '}
                      for more information.
                    </p>
                  </div>
                ) : null}
                {/* poweredBy */}
                {showConfiguration ? (
                  <div>
                    <label className="default-label" htmlFor="poweredBy">
                      Powered By
                      <sup className="ml-2 bg-gray-800 text-white p-0.5 rounded">
                        PRO
                      </sup>
                    </label>
                    <div className="mt-1">
                      <Toggle
                        className="default-input w-full sm:text-sm"
                        name="poweredBy"
                        defaultChecked={integration.poweredBy}
                      />
                    </div>
                    <p className="input-description">
                      Display the <q>powered by ChatBotKit</q> text from the
                      Widget. This option does not have any effect unless you
                      are on a<q>Pro</q> plan. Upgrade options are available in
                      your billing settings. Note that this change can take
                      up-to 10 minutes to take effect.
                    </p>
                  </div>
                ) : null}
                {/* advanced options */}
                {showConfiguration ? (
                  <Expando
                    titleClassName="default-link text-sm"
                    title="Advanced Options"
                  >
                    {/* alias */}
                    <div>
                      <label className="default-label" htmlFor="alias">
                        Alias
                      </label>
                      <div className="mt-1">
                        <input
                          className="default-input w-full max-w-xs"
                          name="alias"
                          type="text"
                          defaultValue={integration.alias}
                          pattern="[a-z0-9_-]*"
                          maxLength={128}
                        />
                      </div>
                      <p className="input-description">
                        Optional unique alias for this integration. Use
                        lowercase letters, numbers, hyphens, and underscores
                        only. Can be used to reference this integration via
                        @alias.
                      </p>
                    </div>
                    {/* origin */}
                    <div>
                      <label className="default-label" htmlFor="origin">
                        Origin
                      </label>
                      <div className="mt-1">
                        <CommaListSelect
                          className="default-input w-full sm:text-sm"
                          name="origin"
                          type="text"
                          defaultValue={integration.origin}
                          placeholder="https://..."
                        />
                      </div>
                      <p className="input-description">
                        The origin is the web page address without the path
                        (referred to as the <strong>base URL</strong> or{' '}
                        <strong>root URL.</strong>). It is the portion of the
                        URL that includes the protocol (e.g.{' '}
                        <strong>http</strong>
                        or <strong>https</strong>), the domain name, and any
                        subdomains (e.g.
                        <strong>www</strong>), but not the specific page or
                        resource being accessed (the path).
                      </p>
                      <p className="input-description">
                        <strong>
                          For security reasons, it is advisable to use this
                          feature to ensure that the your widget can only be
                          used on your own web site alone.
                        </strong>
                      </p>
                    </div>
                    {/* sessionDuration */}
                    <div>
                      <label
                        className="default-label"
                        htmlFor="sessionDuration"
                      >
                        Session Duration
                      </label>
                      <div className="mt-1">
                        <DurationSelect
                          className="default-input w-full max-w-xs sm:text-sm"
                          name="sessionDuration"
                          nullable
                          allowNoSession={false}
                          maximum={WIDGET_SESSION_DURATION_MAX_IN_MILLISECONDS}
                          defaultCaption="automatic (1 day)"
                          defaultValue={integration.sessionDuration || ''}
                        />
                      </div>
                      <p className="input-description">
                        The user will be able to continue the same conversation
                        for the specified time period.
                      </p>
                    </div>
                    {/* language */}
                    <div>
                      <label className="default-label" htmlFor="language">
                        Language
                      </label>
                      <div className="mt-1">
                        <MultiLanguageSelect
                          className="default-input w-full sm:text-sm"
                          name="language"
                          defaultValue={integration.language}
                        />
                      </div>
                      <p className="input-description">
                        The language of the widget. The widget will use this
                        language to display the conversation and the user
                        interface.
                      </p>
                    </div>
                    {/* plugins */}
                    <div>
                      <label className="default-label" htmlFor="plugins">
                        Plugins
                        <sup className="beta">BETA</sup>
                      </label>
                      <div className="mt-1">
                        <WidgetPluginsSelect
                          className="default-input w-full sm:text-sm"
                          name="plugins"
                          defaultValue={integration.plugins}
                          placeholder="Type the plugin and press enter..."
                        />
                      </div>
                      <p className="input-description">
                        The plugins that will be used by the widget. You can use
                        this field to specify the plugins that will be used by
                        the widget.
                      </p>
                    </div>
                    {/* stream */}
                    <div>
                      <label className="default-label" htmlFor="stream">
                        Stream
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="stream"
                          defaultChecked={integration.stream}
                        />
                      </div>
                      <p className="input-description">
                        When activated the chat bot will stream its response one
                        word at the time. While this may increase initial
                        responsiveness sometimes may be necessary not to do
                        that.
                      </p>
                    </div>
                    {/* verbose */}
                    <div>
                      <label className="default-label" htmlFor="verbose">
                        Verbose
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="verbose"
                          defaultChecked={integration.verbose}
                        />
                      </div>
                      <p className="input-description">
                        If enabled the widget will output additional information
                        such as what is searching for in your dataset or what
                        actions it will execute in your skillset.
                      </p>
                    </div>
                    {/* tools */}
                    <div>
                      <label className="default-label" htmlFor="tools">
                        Tools
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="tools"
                          defaultChecked={integration.tools}
                        />
                      </div>
                      <p className="input-description">
                        If enabled, users will see various content tools such as
                        copy to clipboard, and message voting.
                      </p>
                    </div>
                    {/* unfurl */}
                    <div>
                      <label className="default-label" htmlFor="unfurl">
                        Unfurl
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="unfurl"
                          defaultChecked={integration.unfurl}
                        />
                      </div>
                      <p className="input-description">
                        If enabled the widget will automatically unfurl links.
                      </p>
                    </div>
                    {/* math */}
                    <div>
                      <label className="default-label" htmlFor="math">
                        Math
                        <sup className="beta">BETA</sup>
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="math"
                          defaultChecked={integration.math}
                        />
                      </div>
                      <p className="input-description">
                        If enabled the widget will automatically display math
                        equations.
                      </p>
                    </div>
                    {/* carousel */}
                    <div>
                      <label className="default-label" htmlFor="carousel">
                        Carousel
                        <sup className="beta">BETA</sup>
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="carousel"
                          defaultChecked={integration.carousel}
                        />
                      </div>
                      <p className="input-description">
                        If enabled the widget will automatically display
                        carousels. This is a useful feature to display multiple
                        items with images and text in a single message.
                      </p>
                    </div>
                    {/* form */}
                    <div>
                      <label className="default-label" htmlFor="form">
                        Form
                        <sup className="beta">BETA</sup>
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="form"
                          defaultChecked={integration.form}
                        />
                      </div>
                      <p className="input-description">
                        If enabled the widget will automatically display forms.
                      </p>
                    </div>
                    {/* attachments */}
                    <div>
                      <label className="default-label" htmlFor="attachments">
                        Attachments
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="attachments"
                          defaultChecked={integration.attachments}
                        />
                      </div>
                      <p className="input-description">
                        If enabled the widget will automatically support upload
                        and processing of attachments.
                      </p>
                    </div>
                    {/* autoScroll */}
                    <div>
                      <label className="default-label" htmlFor="autoScroll">
                        Auto Scroll
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="autoScroll"
                          defaultChecked={integration.autoScroll}
                        />
                      </div>
                      <p className="input-description">
                        The widget will scroll automatically.
                      </p>
                    </div>
                    {/* startFirst */}
                    <div>
                      <label className="default-label" htmlFor="startFirst">
                        Start First
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="startFirst"
                          defaultChecked={integration.startFirst}
                        />
                      </div>
                      <p className="input-description">
                        The bot will start the conversation first. A play button
                        will be displayed to the user.
                      </p>
                    </div>
                    {/* contactCollection */}
                    <div>
                      <label
                        className="default-label"
                        htmlFor="contactCollection"
                      >
                        Contact Collection
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="contactCollection"
                          defaultChecked={integration.contactCollection}
                        />
                      </div>
                      <p className="input-description">
                        Collect contact details such as name and email. The form
                        will be displayed on the second step of the
                        conversation.
                      </p>
                    </div>
                    {/* exportConversation */}
                    <div>
                      <label
                        className="default-label"
                        htmlFor="exportConversation"
                      >
                        Export Conversation
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="exportConversation"
                          defaultChecked={integration.exportConversation}
                        />
                      </div>
                      <p className="input-description">
                        A toggle that controls if the user can export the
                        current conversation.
                      </p>
                    </div>
                    {/* restartConversation */}
                    <div>
                      <label
                        className="default-label"
                        htmlFor="restartConversation"
                      >
                        Restart Conversation
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="restartConversation"
                          defaultChecked={integration.restartConversation}
                        />
                      </div>
                      <p className="input-description">
                        A toggle that controls if the user can restart the
                        conversation.
                      </p>
                    </div>
                    {/* maximize */}
                    <div>
                      <label className="default-label" htmlFor="maximize">
                        Maximize
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="maximize"
                          defaultChecked={integration.maximize}
                        />
                      </div>
                      <p className="input-description">
                        A toggle that controls if the user can maximize the
                        widget.
                      </p>
                    </div>
                    {/* messagePeek */}
                    <div>
                      <label className="default-label" htmlFor="messagePeek">
                        Message Peek
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="messagePeek"
                          defaultChecked={integration.messagePeek}
                        />
                      </div>
                      <p className="input-description">
                        A toggle that controls if the user can peek at the
                        initial message. Peeked messages will be displayed on
                        top of the open chat button.
                      </p>
                    </div>
                    {/* voiceIn */}
                    <div>
                      <label className="default-label" htmlFor="voiceIn">
                        Voice In
                        <sup className="beta">BETA</sup>
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="voiceIn"
                          defaultChecked={integration.voiceIn}
                        />
                      </div>
                      <p className="input-description">
                        A toggle that controls if the user can input voice
                        messages.
                      </p>
                    </div>
                    {/* voiceOut */}
                    <div>
                      <label className="default-label" htmlFor="voiceOut">
                        Voice Out
                        <sup className="beta">BETA</sup>
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="voiceOut"
                          defaultChecked={integration.voiceOut}
                        />
                      </div>
                      <p className="input-description">
                        A toggle that controls if the user can output voice
                        messages.
                      </p>
                    </div>
                    {/* meta */}
                    <div>
                      <label className="default-label" htmlFor="meta">
                        Meta
                      </label>
                      <div className="mt-1">
                        <MetaInput name="meta" defaultMeta={integration.meta} />
                      </div>
                      <p className="input-description">
                        Custom metadata for this integration.
                      </p>
                    </div>
                  </Expando>
                ) : null}
                {/* hub options */}
                {showConfiguration && integration?.id ? (
                  <HubOptions type="widget" instance={integration} />
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackButton
              type="button"
              className="default-button"
              href="/integrations"
            >
              Back To Integrations
            </BackButton> */}
            {showManagementActions && integration.id ? (
              <button
                className="danger-button"
                type="button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            {showManagementActions && integration.id ? (
              <button
                className="default-button"
                type="button"
                onClick={handleClone}
              >
                Clone
              </button>
            ) : null}
            {showManagementActions && integration.id ? (
              <button
                type="button"
                className="default-button"
                onClick={handleSetup}
              >
                Setup
              </button>
            ) : null}
            {showManagementActions && integration.id ? (
              <button
                type="button"
                className="primary-button"
                onClick={handleInstall}
              >
                Install
              </button>
            ) : null}
            {showTestAction && integration.id ? (
              <button
                type="button"
                className="default-button"
                onClick={handleTest}
              >
                Test
              </button>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {integration.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export function Chat({ integration }) {
  return (
    <ConversationManager
      instance={integration}
      autoStart={true}
      autoAddBackstory={false}
      advancedOptions={false}
      stream={true}
      verbose={true}
      conversationLink={true}
      situationLink={true}
    />
  )
}

export default function Index({ integration, themes }) {
  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/integrations" caption="integrations" title="Widget">
          <p>
            With this integration, you can embed an AI bot directly into your
            website to help with customer support, improve engagement and for
            entertainment. Detailed instructions on how to set up this
            integration can be found at{' '}
            <DocsLink className="default-link" slug="widget">
              ChatBotKit Integrations
            </DocsLink>{' '}
            docs.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        {integration.id ? (
          <section
            data-page-section-title="Theme"
            data-page-section-index="100"
            data-page-section-default
          >
            <div className="main-page">
              <Form integration={integration} themes={themes} variant="theme" />
            </div>
          </section>
        ) : null}
        {integration.id ? (
          <section
            data-page-section-title="Content"
            data-page-section-index="90"
          >
            <div className="main-page">
              <Form
                integration={integration}
                themes={themes}
                variant="content"
              />
            </div>
          </section>
        ) : null}
        <section
          data-page-section-title="Configuration"
          data-page-section-index="200"
        >
          <div className="main-page">
            <Form
              integration={integration}
              themes={themes}
              variant={integration.id ? 'configuration' : 'full'}
            />
          </div>
        </section>
        {/* @note disabled because it is confusing */}
        {/* {integration.id ? (
          <section>
            <div className="main-page">
              <Headline title="Conversation Tester">
                Are you ready to test your chatbot skills? Use this section to
                put your creation to the test!
              </Headline>
              <Chat key={integration.id} integration={integration} />
            </div>
          </section>
        ) : null} */}
        {integration.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Widget Integration Events">
                Keep tabs on the progress of your Widget integration&apos;s
                events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ widgetIntegrationId: integration.id }}
                filter={false}
              />
            </div>
          </section>
        ) : null}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { integration }) {
  return (
    <Dashboard
      breadcrumbs={['Widget', 'Integrations', 'ChatBotKit']}
      title={integration.name || integration.id || 'New'}
      authenticated={true}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${context.resolvedUrl}`,
        permanent: false,
      },
    }
  }

  const themes = [].concat(
    Object.entries(builtinThemes).map(([name, config]) =>
      buildTheme(name, config)
    ),

    getExamplesWithExportedThemes().map(({ title, theme }) => {
      if (typeof theme === 'string') {
        return buildTheme(parseTheme(theme), { name: title })
      } else {
        return buildTheme(theme.name, { ...theme.config, name: title })
      }
    })
  )

  if (context.query.widgetIntegrationId === 'new') {
    return {
      props: makeJsonSafe({
        integration: {
          // url parameters

          botId: context.query.botId,

          // internal parameters

          files: [],

          // default parameters

          theme: themes.find((theme) => theme.includes('AI Answers')), // use AI Answers theme as default
          initial: 'Hi 👋 How can I help you?',
          placeholder: 'Type here...',
          stream: true,
          verbose: true,
          tools: false,
          unfurl: true,
          math: false,
          attachments: true,
          autoScroll: true,
          startFirst: false,
          contactCollection: false,
          exportConversation: true,
          restartConversation: true,
          maximize: true,
          messagePeek: true,
          poweredBy: true,
        },

        themes,
      }),
    }
  }

  const integration = await prisma.widgetIntegration.findUnique({
    where: {
      id: context.query.widgetIntegrationId,
    },

    include: {
      files: true,

      ...withWidgetIntegrationResources(session.user.id),

      hubWidgetPage: true,
    },
  })

  if (!integration) {
    return {
      notFound: true,
    }
  }

  if (integration.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  {
    if (integration.theme) {
      const { name, config } = parseTheme(integration.theme)

      integration.theme = buildTheme(name, {
        ...config,

        // @todo disabled because it does not work
        // name: `Current Theme v0`,
        name: `Current Theme`,
      })

      themes.push(integration.theme)
    }
  }

  return {
    props: makeJsonSafe({
      integration: integration,

      themes,
    }),
  }
}

/**
 * @doc Widget
 * @description Learn how to integrate ChatBotKit's widget onto your website to enhance user experience. Easily customize the widget to fit your needs with various options.
 * @category Integrations
 * @tags ChatBotKit, widget integration, user experience, chat
 * @icon heroicons/puzzle-piece
 * @index 202
 * @date Tue, Apr 15, 2025, 12:00 AM
 * @share 📚 Exciting news! AI Widgets now support attachments. Attachments can be used to create powerful AI bots with troubleshooting capabilities.\n\nCheck it out 👉 https://chatbotkit.com/docs/widget
 *
 * In addition to the [Slack](https://chatbotkit.com/docs/slack), [Discord](https://chatbotkit.com/docs/discord) and [WhatsApp](https://chatbotkit.com/docs/whatsapp), ChatBotKit also offers a Widget integration, which allows users to embed ChatBotKit directly on any website or other platforms where iframe embedding is allowed. This feature allows users to engage with AI chatbots directly from a website, providing a convenient and seamless experience for customers. The widget integration is fully customizable, allowing users to tailor the appearance and functionality of their chatbot to fit their specific needs.
 *
 * For technical details on the Widget SDK, including TypeScript types, React hooks, data attributes, and programmatic control, see the [Widget SDK](https://chatbotkit.com/docs/widget-sdk) documentation.
 *
 * ## Setup
 *
 * Follow these steps to create a new website widget:
 *
 * 1. Go to [Integrations](https://chatbotkit.com/integrations) and then click the [Create Widget Integration](https://chatbotkit.com/integrations/widget/new) button.
 * 2. Fill in the name and optional description.
 * 3. Connect to an existing [Bot](https://chatbotkit.com/docs/bots) or select a [Backstory](https://chatbotkit.com/docs/backstories), [Model](https://chatbotkit.com/docs/models), [Dataset](https://chatbotkit.com/docs/datasets) and [Skillset](https://chatbotkit.com/docs/skillsets).
 * 4. Save the integration by clicking the **Create** button.
 *
 * Now that the integration is saved you can embed it into a website.
 *
 * 1. Click the **Install** button.
 * 2. Copy the widget snippet (code).
 * 3. Paste the snippet into your website.
 *
 * ## Features
 *
 * ### Theme Designer
 *
 * The Theme Designer feature allows you to fully customize the appearance of your widget to match your brand identity. You can modify colors, fonts, spacing, and other visual elements to create a cohesive look that integrates seamlessly with your website. The designer provides real-time preview capabilities so you can see how your changes will appear before deploying them.
 *
 * ### Markdown
 *
 * Both the intro and each individual message support markdown formatting. This means that you can include links, images, tables and other embeddable content. The following syntax is supported.
 *
 * | Element                           | Markdown Syntax                              |
 * | --------------------------------- | -------------------------------------------- |
 * | Heading                           | `# H1`                                       |
 * | Heading                           | `## H2`                                      |
 * | Heading                           | `### H3`                                     |
 * | Bold                              | `**bold text**`                              |
 * | Italic                            | `*italicized text*`                          |
 * | Blockquote                        | `> blockquote`                               |
 * | Ordered List                      | `1. First item`                              |
 * | Unordered List                    | `- First item`                               |
 * | Code                              | `` `code` ``                                 |
 * | Link                              | `[Link text](https://path/to/link)`          |
 * | Link Button                       | `[Button text](https://path/to/link#button)` |
 * | Link Button (open in frame)       | `[Button text](https://path/to/link#frame)`  |
 * | Text / question suggestion button | `[Button text]()`                            |
 *
 * ### Themes
 *
 * The widget integration offers a variety of themes to choose from. By default, the theme is set to "light". You can customise the primary color. Additional themes are available in the [Examples](https://chatbotkit.com/examples) and you can even build your own via the [Theme Builder](https://chatbotkit.com/playground/theme).
 *
 * Themes are an extremely useful tool for crafting bespoke chat user experiences without the need for coding. By personalizing the look and feel of your chat interface, you can enhance the user experience and create a more engaging and interactive environment for your users. With themes, you can easily tailor your chatbot to match your brand's aesthetic, incorporating your company's logo, color palette, and fonts. Additionally, you can experiment with different themes to identify which designs are most effective at engaging your target audience. With the ability to customize every aspect of your chat user experience through themes, the possibilities for creating an immersive and engaging chatbot are endless.
 *
 * ### Layouts
 *
 * The ChatBotKit AI Widgets supports a number of different layouts. A layout indicates how the widgets needs to be rendered on the screen. The default layout is popover, meaning that the popup is over the widget button. You can also selected the popout layout where the popup is in the middle of the screen.
 *
 * The widget layout can also be controlled via the layout property that can be passed during the widget initialization. It can be also setup manually when creating the widget component.
 *
 * Layouts allow to create more interesting interfaces to support various types of scenarios such as AI-native search interfaces and more.
 *
 * ### Icons
 *
 * The widget integration allows you to customize the icons displayed within the chatbot interface. There are four types of icons that can be customized: the bar icon, the user icon, the bot icon and the button icon. Each of these icons can be set to a custom image.
 *
 * To customize the icons:
 *
 * 1. Go to the [Integrations](https://chatbotkit.com/integrations) page and select your widget integration.
 * 2. Scroll down to the **"Icons"** section.
 * 3. Customize the icons by selecting the icon files from your disk.
 *
 * By customizing the icons, you can create a more personalized and engaging chat experience for your users. Incorporating your brand's iconography or using fun and expressive emojis can help to create a chatbot that feels more like a natural conversation partner.
 *
 * ### Origins
 *
 * Your Widget can be configured to only run on specific websites. This is a recommended security feature to ensure that chat sessions can only be initialized from your website alone.
 *
 * The origin is the web page address without the path (referred to as the "base URL" or "root URL."). It is the portion of the URL that includes the protocol (e.g. "http" or "https"), the domain name, and any subdomains (e.g. "www"), but not the specific page or resource being accessed (the path).
 *
 * It is advisable to use this feature to ensure that your Widget can only be used from specific locations.
 *
 * You can use comma (,) to specify multiple origins.
 *
 * ### Languages
 *
 * Configuring multiple languages for your widget is a straightforward process. You have the flexibility to add as many languages as you want to cater to a global audience. To do this, you simply need to type out the names of the languages you wish to include, and arrange them in the order you desire.
 *
 * Once you have completed these steps and saved the widget, our system will automatically update your internationalisation settings. This automatic update ensures that your widget remains current and user-friendly, providing a seamless experience for users across different regions.
 *
 * The result of this configuration is that your users will now have the ability to interact with the widget by selecting their language of choice from the list. This feature is crucial in ensuring your widget is accessible and user-friendly, allowing users to engage with it in the language they are most comfortable with. This not only enhances user experience but also broadens the reach of your widget to a more diverse audience.
 *
 * Users can choose their preferred language for the widget from a list, with the first language set as the default. To select a different default language when embedding the frame, use the `?language=` or `?locale=` query parameters. For example, appending `/frame?language=spanish` to your frame's URL will set Spanish as the default language.
 *
 * ### Streaming
 *
 * The `streaming` feature allows for continuous updates to the chatbot user interface. This is useful for scenarios where the chatbot is being used for real-time communication, such as customer support. To enable this feature, simply toggle the `stream` option when updating your widget integration.
 *
 * ### Verbosity
 *
 * When the verbose option is turned on, the widget will display additional context information such as what the chatbot is searching for or what actions it executes. This option improves the overall user experience.
 *
 * ### Tools
 *
 * ChatBotKit's widget includes a set of auxiliary tools that can be included with each message produced by the AI bot. These tools include the ability to copy the message to the clipboard, as well as a thumbs up and thumbs down rating system.
 *
 * Enabling the Tools feature can be done by toggling the **"Tools"** option in the widget configuration. When enabled, each message produced by the bot will include a small toolbar with the auxiliary tools. This allows users to easily copy important information from the chat interface or provide feedback on the quality of the AI bot's responses.
 *
 * The copy to clipboard feature is particularly useful for chatbots that are used for customer support or e-commerce, as it allows users to easily copy important information such as order numbers or tracking information without having to leave the chat interface. Additionally, the thumbs up and thumbs down rating system can be a useful tool for gathering feedback from users on the quality of the AI bot's responses. This feedback can be used to improve the chatbot over time and ensure that it is providing the best possible experience for users.
 *
 * ### Unfurling
 *
 * URL unfurling is a feature that allows the ChatBotKit widget to display a preview of a URL that has been shared in the chat. This preview typically includes a title, description, and image associated with the URL. This feature is particularly useful for chatbots that are used for customer support or e-commerce, as it allows chat bots to easily share product pages or other relevant information in a graphical way without forcing the user to leave the chat interface.
 *
 * To enable URL unfurling, simply instruct the bot to include the URL in a message. The ChatBotKit widget will automatically detect the URL and generate a preview.
 *
 * ### Contacts
 *
 * ChatBotKit's widget also offers a Contact Collection feature, which allows customers to collect the name and email address of visitors who are using the widget.
 *
 * When enabled, the Contact Collection feature will prompt visitors to enter their name and email address before starting a chat session with the chatbot. The collected information will be stored in ChatBotKit's conversation and can be accessed by the customer.
 *
 * The Contact Collection feature is particularly useful for businesses that want to collect leads or customer information. By collecting the name and email address of visitors who are using the chatbot, businesses can follow up with potential customers and build a relationship with them over time.
 *
 * ### Forms
 *
 * ChatBotKit's AI Widget also supports HTML forms, enabling a direct and efficient method for collecting structured information from users during conversations. This feature enhances the interactivity of the ChatBotKit AI Widget, making it possible to gather data, feedback, and other user inputs through familiar form interfaces within the chat environment.
 *
 * To implement a form within a conversation, the user (or the developer configuring the AI Widget) must provide clear instructions to the AI agent specifying that a form is required for a particular type of interaction. The AI will then generate and display the form directly in the chat widget.
 *
 * The forms feature can also be used in the initial message as well. This is also a good way to start the conversation - i.e. by allow for the bot to collect custom information before the collection starts.
 *
 * ### Branding
 *
 * Plans that include branding removal have the option to turn off the **"Powered By ChatBotKit"** branding in their Widget integrations. This option can be found in the **"Advanced Options"** section of the Widget configuration. To turn off the branding, simply toggle the switch.
 *
 * Please note that this option only takes effect if your plan includes branding removal.
 *
 * ### Media
 *
 * The ChatBotKit widget supports the display of images and videos as long as they are generated by the chatbot in markdown format. The markdown image embedding syntax applies for both cases. Customers who wish to display media need to instruct the chatbot to output images, YouTube videos, or any other form of video and audio content using the markdown image embedding format: `![](url)`.
 *
 * By using this syntax, chatbot creators can easily integrate visuals and multimedia into their chatbots. This can be particularly useful for chatbots that are used for e-commerce or customer support, as it allows chatbots to easily share product images or instructional videos without forcing the user to leave the chat interface. Additionally, by incorporating multimedia into your chatbot, you can create a more engaging and interactive experience for your users, helping to improve customer satisfaction and engagement.
 *
 * ### Math
 *
 * The ChatBotKit widget offers comprehensive support for mathematical expressions through LaTeX syntax. This powerful feature enables the seamless integration of complex mathematical formulas and equations within the chat interface, enhancing the widget's capabilities for educational, scientific, or technical applications. Users can effortlessly incorporate a wide range of mathematical notations, from simple algebraic expressions to advanced calculus formulas, ensuring precise and visually appealing representation of mathematical concepts.
 *
 * ### Carousel
 *
 * The ChatBotKit widget includes an innovative carousel feature that allows users to present information in a visually engaging way. This feature automatically identifies suitable content for carousel display, transforming it into a scrollable list of items that enhances user interaction. Ideal for showcasing products, options, or any list-oriented data, the carousel seamlessly integrates with other widget functionalities, offering an immersive and interactive user experience. By leveraging this tool, businesses can create dynamic and intuitive interfaces perfect for shopping platforms and beyond, facilitating a more engaging and streamlined interaction with users.
 *
 * ### Attachments
 *
 * Once the attachment feature is activated, your widget will gain the capability to receive various file attachments, including but not limited to images, documents, and other types of files. These attachments are integrated into the conversation, enhancing its richness and interactivity. Additionally, attachments can be processed by specialized Skillsets, such as Vision Skillset Actions and other similar tools. This functionality allows attachments to be directly utilized within widgets, enabling the creation of robust troubleshooting chatbots and other advanced applications.
 *
 * ### VoiceIn & VoiceOut
 *
 * VoiceIn and VoiceOut add voice interaction to the ChatBotKit widget. VoiceIn lets users speak to the chatbot through their microphone, while VoiceOut generates spoken responses. With VoiceIn, users can activate a microphone button to convert speech to text input, making the chat hands-free and more accessible. VoiceOut converts bot responses into natural-sounding speech with customizable voices and speaking rates.
 *
 * Both features can be toggled independently in the widget settings, giving users the flexibility to choose between voice and text interactions.
 *
 * ### Client-side Functions
 *
 * The "Client-side Functions" feature is a versatile enhancement to the ChatBotKit AI Widgets, designed to bridge the gap between your application logic and ChatBotKit AI bots. This powerful tool enables direct interactions between your user interface and the AI, facilitating real-time data updates and dynamic responses based on user interactions. Whether it's adjusting to new user inputs, such as changing locations in a weather app, or processing live data feeds, "Client-side Functions" ensure that your AI agent remains synchronized with the application's state, delivering a seamless and responsive user experience. This feature is ideal for developers looking to create more intuitive and interactive applications by embedding advanced AI capabilities directly into their existing systems.
 *
 * ### Messages
 *
 * You can pass some initial contextual messages before establishing a chat session. These message will be included as part of the conversation and will be taken into account. There are some limitations, such as only user messages can be passed in. This is to prevent model hallucination and other types of injection attacks.
 *
 * For detailed instructions how to pass meta data review our [tutorial](https://chatbotkit.com/tutorials/how-to-use-the-messages-feature-in-the-chatbotkit-widget).
 *
 * ### Meta-data
 *
 * All conversations initiated through the widget can be associated with specific meta-data. This meta-data can include information about the user, the context of the conversation, or any other relevant data. The meta-data is passed to the widget during its initialisation and can be used to personalize the chat experience or to provide context for the AI bot.
 *
 * For detailed instructions how to pass meta data review our [tutorial](https://chatbotkit.com/tutorials/how-to-use-the-meta-data-feature-in-the-chatbotkit-widget).
 *
 * ### Caching
 *
 * By default the Widget uses an aggressive caching policy the performance. We cache the widget page for maximum of 60 seconds. This behaviour can be turned off by setting `cache` property to `false`. This change can be done with URL query parameters or when embedding the widget through the widget component properties, data properties and all other available configuration mechanisms.
 *
 * ### Sessions
 *
 * The ChatBotKit Widget supports continuous user sessions. A single session is one continuous conversation with a chat bot. Sessions are preserved across tabs and windows and automatically synchronized. This means the user can continue the conversation even when navigating to a different part of your website or switching tabs.
 *
 * This is often the expected best possible experience for your end customers. Still, there are times when you may want to control when and how to chat sessions are created. In these situations, you can use the `session` parameter to define your unique identifier to distinguish between separate continuous conversations.
 *
 * The `session` parameter can be any value - an id or just a random sequence of characters. By default each user gets a unique session every day. Once you set up the `session`, conversations will continue on the same conversation channel. For example, you may want to distinguish chat sessions that have started from one area of your website from others. Or perhaps, your landing pages might need a completely new chat session. In this case, you can use the `session` parameter to start separate continuous chats.
 *
 * It is also equally possible that every page has its own chat session. This means the session will not be preserved when navigating different pages. To do so, use the current page address for the `session`, for example.
 *
 * You can also pass the special value `none`. This means that you don't want any session. This is means that no matter how many times a user visit the widget they will have a fresh conversation window.
 *
 * In summary here is a table for all possible `session` values.
 *
 * | Value                          | Description                                                     |
 * | ------------------------------ | --------------------------------------------------------------- |
 * | `<blank>`                      | When no value provided the session is pinned to the current day |
 * | `<your random session string>` | The session is pinned to the provided string.                   |
 * | `none`                         | No session - no history                                         |
 *
 * ### User Interaction Controls
 *
 * The widget provides several toggles to customize what actions users can perform:
 *
 * - **Auto Scroll** - The widget automatically scrolls to the latest message during conversation.
 * - **Start First** - The bot initiates the conversation with a greeting message. Users can restart the conversation by clicking a play button.
 * - **Export Conversation** - Users can download or export the conversation history.
 * - **Restart Conversation** - Users can clear the conversation and start fresh.
 * - **Maximize** - Users can expand the widget to fullscreen or a larger view.
 * - **Message Peek** - Displays a preview of the initial bot message on top of the widget button before opening.
 *
 * ### Advanced Configuration
 *
 * In addition to the main features, the widget provides advanced configuration options:
 *
 * - **Alias** - Optional unique alias for this widget integration that can be used for programmatic reference via @alias notation.
 * - **Session Duration** - Controls how long users can continue the same conversation. Once the duration expires, the conversation history is cleared on the next interaction.
 * - **Powered By** - Toggle the ChatBotKit branding footer. Only available on plans that include branding removal.
 * - **Plugins** - Extend widget functionality with additional plugins (beta feature).
 *
 * ### Contact Collection Settings
 *
 * The **Contact Collection** feature allows you to gather visitor information automatically:
 *
 * - When enabled, the widget prompts users to enter their name and email address before starting a chat session (typically shown on the second interaction).
 * - Collected contact information is stored in ChatBotKit and can be accessed from the contacts list.
 * - This is useful for lead generation, customer relationship management, and personalizing responses based on collected identities.
 *
 * ## Embedding The Widget
 *
 * The recommended way to embed the widget is through the Widget SDK like this:
 *
 * ```html
 * <script src="https://static.chatbotkit.com/integrations/widget/v2.js" data-widget="{WIDGET_ID}"></script>
 * ```
 *
 * Additional parameters (see next section) can also be passed as data attributes. For example:
 *
 * ```html
 * <script src="https://static.chatbotkit.com/integrations/widget/v2.js" data-widget="{WIDGET_ID}" data-open="true"></script>
 * ```
 *
 * If no data-widget property is present then the SDK will be initialised but no widget will be instantiated. In this case you will need to instantiate the widget using its HTML custom tag. For example:
 *
 * ```html
 * <!-- embed the widget sdk -->
 * <script src="https://static.chatbotkit.com/integrations/widget/v2.js"></script>
 * <!-- instantiate a widget somewhere inside your application -->
 * <chatbotkit-widget widget="{WIDGET_ID}" open="true"/>
 * ```
 *
 * ## Embedding The Frame
 *
 * You can also embed the Widget frame directly. This method gives you to a greater degree of control over the widget without the need to include the SDK. For example:
 *
 * ```html
 * <iframe src="https://static.chatbotkit.com/integrations/widget/{WIDGET_ID}/frame"></iframe>
 * ```
 *
 * Because the widget frame is directly embedded we can also control how the widget is displayed. For example the following code puts the frame in fullscreen:
 *
 * ```html
 * <iframe src="https://static.chatbotkit.com/integrations/widget/{WIDGET_ID}/frame" style="position:absolute;top:0;left:0;bottom:0;right:0;width:100%;height:100%"></iframe>
 * ```
 *
 * When you embed the frame directly inside an `iframe`, links rendered by the widget do not stay inside that `iframe` by default.
 *
 * - Relative links and same-origin absolute links open with the `_top` target.
 * - Cross-origin absolute links open with the `_blank` target.
 * - If you add `?target=...` to the link URL, that value overrides the default target selection.
 *
 * This is especially important when you pass the `origin` query parameter to the frame URL. The widget uses that origin to resolve relative links and to decide whether an absolute link is same-origin. For example, embedding the frame as shown below causes `/pricing` and `https://example.com/docs` to resolve to `_top`, while `https://other-site.com` still resolves to `_blank`.
 *
 * ```html
 * <iframe src="https://static.chatbotkit.com/integrations/widget/{WIDGET_ID}/frame?origin=https://example.com"></iframe>
 * ```
 *
 * If you want a link to stay inside the embedded frame, set the target explicitly in the URL hash. For example, use `#target=_self`.
 *
 * ```md
 * [Open inside the iframe](https://example.com/docs#target=_self)
 * ```
 *
 * ## Direct Embedding
 *
 * Here is a quick example how to embed the Widget iframe directly:
 *
 * ```html
 * <iframe src="https://static.chatbotkit.com/integrations/widget/{WIDGET_ID}/frame?...parameters"></iframe>
 * ```
 *
 * Use your own widget integration id instead of `{WIDGET_ID}`.
 *
 * A working example of this embedding technique can be found [here](https://codepen.io/pdparchitect/pen/xxJyJXd).
 *
 * ## SDK Embedding
 *
 * It is also possible to embed the widget iframe with the SDK. Follow the same steps as normal widget setup but do not specify the widget id. For example:
 *
 * ```html
 * <script src="https://static.chatbotkit.com/integrations/widget/v2.js"></script>
 * ```
 *
 * Notice that we simply include the ChatBotKit SDK but we do not indicate which widget we want to load. Now we can include the widget anywhere on the page by using a custom tag like this:
 *
 * ```html
 * <chatbotkit-widget id="my-widget" widget="{WIDGET_ID}" ...parameters/>
 * ```
 *
 * The custom widget tag also supports several built-in methods which allow you to interact with the widget. For example:
 *
 * ```javascript
 * const widget = document.getElementById("chatbotkit-widget");
 * widget.restartConversation();
 * ```
 *
 * The following methods are supported:
 *
 * | Method                                                        | Description                                                                                     |
 * | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
 * | `restartConversation()`                                       | Restarts the current conversation.                                                              |
 * | `sendMessage(string)`                                         | Send user message.                                                                              |
 * | `assignContact({name: string, email: string, phone: string})` | Assign a contact to this widget session.  You must enable contact collection option before use. |
 * | `hide()`                                                      | Hide the widget.                                                                                |
 * | `show()`                                                      | Show the widget.                                                                                |
 *
 * The following getters and setters are also supported:
 *
 * | Getter / Setter       | Description              |
 * | --------------------- | ------------------------ |
 * | `open = true / false` | Open or close the widget |
 *
 * Developers can also subscribe to the following events:
 *
 * | Event     | Data                                                                | Description                           |
 * | --------- | ------------------------------------------------------------------- | ------------------------------------- |
 * | `send`    | `{ conversationId: string, message: { id: string, text: string } }` | Triggered when a message is sent.     |
 * | `receive` | `{ conversationId: string, message: { id: string, text: string } }` | Triggered when a message is received. |
 *
 * A working example of this embedding technique can be found [here](https://codepen.io/pdparchitect/pen/LYgVjJK).
 *
 * ## Widget Parameters
 *
 * The following parameters can be passed to the frame or the custom HTML tag no matter the method of embedding:
 *
 * | Parameter     | Description                                                                                     |
 * | ------------- | ----------------------------------------------------------------------------------------------- |
 * | `open`        | Boolean property to indicate if widget should be open.                                          |
 * | `origin`      | Base origin used to resolve relative links and decide whether links open as `_top` or `_blank`. |
 * | `session`     | The session for this frame.                                                                     |
 * | `layout`      | The layout which can be either popover (default) or popout (center in the screen).              |
 * | `position`    | The position of the widget on the screen: `bottom-right` (default), `bottom-left`.              |
 * | `barIcon`     | The URL for the bar icon.                                                                       |
 * | `userIcon`    | The URL for the user icon.                                                                      |
 * | `botIcon`     | The URL for the bot icon.                                                                       |
 * | `buttonIcon`  | The URL for the button icon.                                                                    |
 * | `placeholder` | Placeholder text for the main chat input area.                                                  |
 * | `messages`    | A list of messages to pass to the conversation at initilization.                                |
 * | `meta`        | A meta data field to pass to the conversation at initialization.                                |
 *
 * ## Advanced Topics
 *
 * ### Widget Frame Direct Communication
 *
 * Developers can use the `postMessage` API to send messages to the ChatBotKit Widget frame. This allows for an alternative programmatic interaction. To use this API, developers must have access to the iframe element containing the Widget frame. Once access is granted, developers can use the following code to send a message:
 *
 * ```javascript
 * const iframe = document.getElementById("chatbotkit-widget-frame");
 * iframe.contentWindow.postMessage({ type: "restartConversation", props: {} }, "*");
 * ```
 *
 * The `postMessage` API can be used to trigger various actions and events within the Widget frame.
 *
 * The following event types are supported:
 *
 * | Type                  | Props                                            | Description                                                                                    |
 * | --------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
 * | `restartConversation` | `{}`                                             | Restarts the current conversation.                                                             |
 * | `sendMessage`         | `{ message: string }`                            | Send user message.                                                                             |
 * | `assignContact`       | `{ name: string, email: string, phone: string }` | Assign a contact to this widget session. You must enable contact collection option before use. |
 *
 * Similarly, developers can receive events via the `postMessage` API as well. Here is an example:
 *
 * ```javascript
 * window.addEventListener('message', (event) => {
 *   if (event.origin === 'https://static.chatbotkit.com') {
 *     // TODO: process event
 *   }
 * });
 * ```
 */
