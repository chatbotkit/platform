'use client'

import { useEffect, useMemo, useState } from 'react'
import { IoIosOptions } from 'react-icons/io'

import {
  defaultLanguageModel,
  languageModels,
  visibleLanguageModels,
} from '@/config/models'

import { either } from '@/lib/helpers'
import {
  buildLanguageModel,
  modelSupportsAudioInput,
  modelSupportsFileInput,
  modelSupportsImageInput,
  modelSupportsInterpreter,
  modelSupportsRealtime,
  modelSupportsReasoningEffort,
  modelSupportsVideoInput,
  parseLanguageModel,
} from '@/lib/model.utils'
import toast from '@/lib/toast'

import Expando from '@/components/Expando'
import List from '@/components/List'
import RevealToken from '@/components/RevealToken'

import useAvailableModels, {
  useAvailableDefaultModel,
} from '@/hooks/useAvailableModels'
import useControlledState from '@/hooks/useControlledState'
import useDebounce from '@/hooks/useDebounce'
import usePopup from '@/hooks/usePopup'

import Toggle from './Toggle'

import clsx from 'clsx'

const languageModelCreditConsumptionLabels = {
  free: 'free',
  low: 'low credit',
  medium: 'medium credit',
  high: 'high credit',
  'very-high': 'very high credit',
}

const languageModelCreditConsumptionThresholds = {
  low: 0.1,
  medium: 1,
  high: 1.5,
}

function getLanguageModelCreditConsumptionTier(modelConfig) {
  const tokenRatio = modelConfig?.pricing?.tokenRatio

  if (typeof tokenRatio !== 'number') {
    return null
  }

  if (tokenRatio === 0) {
    return 'free'
  }

  if (tokenRatio < languageModelCreditConsumptionThresholds.low) {
    return 'low'
  }

  if (tokenRatio < languageModelCreditConsumptionThresholds.medium) {
    return 'medium'
  }

  if (tokenRatio < languageModelCreditConsumptionThresholds.high) {
    return 'high'
  }

  return 'very-high'
}

export function getLanguageModelSortPriority(modelName, modelConfig) {
  if (modelName === defaultLanguageModel) {
    return 0
  }

  if (modelConfig.featured) {
    return 1
  }

  return 2
}

export function compareVisibleLanguageModels(
  [aName, aConfig],
  [bName, bConfig]
) {
  const priorityDifference =
    getLanguageModelSortPriority(aName, aConfig) -
    getLanguageModelSortPriority(bName, bConfig)

  if (priorityDifference !== 0) {
    return priorityDifference
  }

  const aDate = aConfig.addedDate || ''
  const bDate = bConfig.addedDate || ''

  if (aDate !== bDate) {
    return bDate.localeCompare(aDate)
  }

  return aName.localeCompare(bName)
}

const languageModelSortOptions = [
  { id: 'default', label: 'Default' },
  { id: 'cost', label: 'Cost' },
  { id: 'provider', label: 'Provider' },
  { id: 'newest', label: 'Newest' },
]

function getLanguageModelTokenRatio(modelConfig) {
  const tokenRatio = modelConfig?.pricing?.tokenRatio

  return typeof tokenRatio === 'number' ? tokenRatio : Infinity
}

function compareVisibleLanguageModelsBySort(sort) {
  return (a, b) => {
    const [aName, aConfig] = a
    const [bName, bConfig] = b

    switch (sort) {
      case 'cost': {
        const ratioDifference =
          getLanguageModelTokenRatio(aConfig) -
          getLanguageModelTokenRatio(bConfig)

        if (ratioDifference !== 0) {
          return ratioDifference
        }

        return aName.localeCompare(bName)
      }

      case 'provider': {
        const providerDifference = (aConfig.provider || '').localeCompare(
          bConfig.provider || ''
        )

        if (providerDifference !== 0) {
          return providerDifference
        }

        return aName.localeCompare(bName)
      }

      case 'newest': {
        const aDate = aConfig.addedDate || ''
        const bDate = bConfig.addedDate || ''

        if (aDate !== bDate) {
          return bDate.localeCompare(aDate)
        }

        return aName.localeCompare(bName)
      }

      default:
        return compareVisibleLanguageModels(a, b)
    }
  }
}

function SelectPopup({ currentModel, onSelect, allowedModels, availableModels }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('default')

  const debouncedSearch = useDebounce(search, 300)

  const filteredModels = useMemo(() => {
    let models = Object.entries(visibleLanguageModels)

    // @note availability comes from the platform model list API at runtime;
    // while it is unknown the compiled catalogue stands in
    if (availableModels) {
      models = models.filter(([modelName]) =>
        availableModels.includes(modelName)
      )
    }

    if (allowedModels && allowedModels.length > 0) {
      models = models.filter(([modelName]) => allowedModels.includes(modelName))
    }

    if (!debouncedSearch) {
      return models
    }

    const searchLower = debouncedSearch.toLowerCase()

    return models.filter(([modelName, modelConfig]) => {
      return [
        modelName,
        modelConfig.description,
        modelConfig.provider,
        modelConfig.family,
        ...(modelConfig.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(searchLower)
    })
  }, [debouncedSearch, allowedModels, availableModels])

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Select a language model from the list below. You can configure
        additional parameters after selecting a model.
      </p>
      <div className="default-input flex items-center gap-2 !p-1.5">
        <input
          className="none-input flex-1 min-w-0 px-2 text-sm"
          type="search"
          placeholder="Search models..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
        {languageModelSortOptions.map(({ id, label }) => (
          <button
            key={id}
            className={clsx(
              'text-xs px-2 py-1 rounded-md transition-colors flex-shrink-0',
              id === sort
                ? 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
            )}
            type="button"
            onClick={() => setSort(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="max-h-[500px] h-screen flex flex-col overflow-auto">
        <List>
          {filteredModels
            .sort(compareVisibleLanguageModelsBySort(sort))
            .map(([modelName, modelConfig]) => {
              const creditConsumptionTier =
                getLanguageModelCreditConsumptionTier(modelConfig)

              return (
                <List.Item
                  key={modelName}
                  selected={modelName === currentModel}
                  title={modelName}
                  body={modelConfig.description}
                  timestamp={
                    modelConfig.addedDate
                      ? new Date(modelConfig.addedDate)
                      : undefined
                  }
                  onClick={() => onSelect(modelName)}
                >
                  {creditConsumptionTier ? (
                    <span className="relative inline-flex group/tooltip cursor-help">
                      <span className="tag">
                        {
                          languageModelCreditConsumptionLabels[
                            creditConsumptionTier
                          ]
                        }
                      </span>
                      <span className="tooltip above w-32">
                        ratio: {modelConfig.pricing.tokenRatio}
                      </span>
                    </span>
                  ) : null}
                  <span className="tag">
                    {modelConfig.maxTokens?.toLocaleString()} tokens
                  </span>
                  {modelConfig.features?.map((feature) => (
                    <span key={feature} className="tag">
                      {feature}
                    </span>
                  ))}
                  {modelConfig.tags?.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </List.Item>
              )
            })}
        </List>
      </div>
    </div>
  )
}

export function ConfigPopup({ name, config }) {
  return (
    <div className="space-y-6">
      {/* description */}
      {languageModels[name] ? (
        <p className="text-sm">{languageModels[name].description}</p>
      ) : null}
      {name === 'custom' ? (
        <>
          {/* callout */}
          <p className="text-sm">
            Custom models are a <strong>beta</strong> feature and available only
            on some plans. You can use your own custom language model by
            providing the necessary credentials.
          </p>
          {/* name */}
          <div>
            <label className="default-label" htmlFor="name">
              Name
            </label>
            <div className="mt-1">
              <input
                className="default-input w-full sm:text-sm"
                name="name"
                type="text"
                defaultValue={config.name}
                spellCheck={false}
                required
              />
            </div>
            <p className="input-description">
              The name of the custom language model.
            </p>
          </div>
          {/* provider */}
          <div>
            <label className="default-label" htmlFor="provider">
              Provider
            </label>
            <div className="mt-1">
              <select
                className="default-input w-full sm:text-sm"
                name="provider"
                defaultValue={config.provider}
              >
                <option value="openai">OpenAI</option>
                <option value="mistral">Mistral</option>
                <option value="groq">Groq</option>
                <option value="openrouter">OpenRouter</option>
                {/* the following are disabled because they are complicated and do not support OpenAI compatible API */}
                {/* <option value="vertex">Google</option> */}
                {/* <option value="bedrock">Bedrock</option> */}
              </select>
            </div>
            <p className="input-description">
              The provider of the custom language model.
            </p>
          </div>
          {/* credentials */}
          <div>
            <label className="default-label" htmlFor="credentials">
              Credentials
            </label>
            <div className="mt-1">
              <RevealToken
                className="default-input w-full sm:text-sm"
                name="credentials"
                defaultToken={config.credentials}
                required
              />
            </div>
            <p className="input-description">
              The credentials of the custom language model.
            </p>
          </div>
          {/* endpoint */}
          <div>
            <label className="default-label" htmlFor="endpoint">
              Endpoint
            </label>
            <div className="mt-1">
              <input
                className="default-input w-full sm:text-sm"
                name="endpoint"
                type="url"
                defaultValue={config.endpoint}
              />
            </div>
            <p className="input-description">
              The endpoint of the custom language model. This is the URL that
              will be used to send requests to. Leave empty to use the default
              endpoint.
            </p>
          </div>
        </>
      ) : null}
      {/* maxTokens */}
      <div>
        <label className="default-label" htmlFor="maxTokens">
          Max Tokens (context window)
        </label>
        <div className="mt-1">
          <input
            className="default-input w-full sm:text-sm"
            name="maxTokens"
            type="number"
            defaultValue={either(
              config.maxTokens,
              languageModels[name].maxTokens
            )}
            min={2000}
            max={languageModels[name].maxTokens}
            step={1} // @note more than 1 will cause the input to start as invalid
          />
        </div>
        <p className="input-description">
          The maximum number of tokens that the chatbot will use for each
          interaction. A smaller value means that the bot will use fewer tokens,
          which ultimately results in a shorter short-term memory span. The
          default value is <strong>{languageModels[name].maxTokens}</strong>.
        </p>
      </div>
      {/* temperature */}
      <div>
        <label className="default-label" htmlFor="temperature">
          Temperature
        </label>
        <div className="mt-1">
          <input
            className="default-input w-full sm:text-sm"
            name="temperature"
            type="number"
            defaultValue={either(
              config.temperature,
              languageModels[name].temperature
            )}
            min={0}
            max={2}
            step={0.1}
          />
        </div>
        <p className="input-description">
          Higher values like 0.8 will make the output more random, while lower
          values like 0.2 will make it more focused and deterministic. The
          default value is <strong>{languageModels[name].temperature}</strong>.
        </p>
      </div>
      {/* interactionMaxMessages */}
      <div>
        <label className="default-label" htmlFor="interactionMaxMessages">
          Interaction Max Messages
        </label>
        <div className="mt-1">
          <input
            className="default-input w-full sm:text-sm"
            name="interactionMaxMessages"
            type="number"
            defaultValue={either(
              config.interactionMaxMessages,
              languageModels[name].interactionMaxMessages
            )}
            min={2}
            step={1}
          />
        </div>
        <p className="input-description">
          The maximum number of messages to send to the model per interaction. A
          lower value reduces context but saves tokens. A higher value gives the
          model more conversational context. For Q&A-style conversations it is
          recommended to keep the value low. The default value for model is{' '}
          <strong>{languageModels[name].interactionMaxMessages}</strong>.
        </p>
      </div>
      {/* threshold strategy */}
      <div>
        <label className="default-label" htmlFor="thresholdStrategy">
          Threshold Strategy
        </label>
        <div className="mt-1">
          <select
            className="default-input w-full sm:text-sm"
            id="thresholdStrategy"
            name="thresholdStrategy"
            defaultValue={either(
              config.thresholdStrategy,
              languageModels[name].thresholdStrategy
            )}
          >
            <option value="truncate">Truncate</option>
            <option value="compact">Compact</option>
          </select>
        </div>
        <p className="input-description">
          Choose how conversation history is reduced when token thresholds are
          reached. The default value is{' '}
          <strong>{languageModels[name]?.thresholdStrategy}</strong>.
        </p>
      </div>
      {name === 'custom' ? null : (
        <>
          {/* region */}
          <div>
            <label className="default-label" htmlFor="region">
              Region
            </label>
            <div className="mt-1">
              <select
                className="default-input w-full sm:text-sm"
                name="region"
                defaultValue={either(
                  config.region,
                  languageModels[name].region
                )}
              >
                {[/* '', */ ...languageModels[name].availableRegions].map(
                  (region) => {
                    return (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    )
                  }
                )}
              </select>
            </div>
            <p className="input-description">
              The region where the model is hosted. The default value for this
              model is <strong>{languageModels[name].region}</strong>.
            </p>
          </div>
        </>
      )}
      {/* advanced options */}
      <Expando titleClassName="default-link text-sm" title="Advanced Options">
        {modelSupportsRealtime(name) &&
        languageModels[name]?.availableVoices?.length > 0 ? (
          <>
            {/* voice */}
            <div>
              <label className="default-label" htmlFor="voice">
                Voice
              </label>
              <div className="mt-1">
                <select
                  className="default-input w-full sm:text-sm"
                  name="voice"
                  defaultValue={either(
                    config.voice,
                    languageModels[name].voice
                  )}
                >
                  {languageModels[name].availableVoices.map((voice) => {
                    return (
                      <option key={voice} value={voice}>
                        {voice}
                      </option>
                    )
                  })}
                </select>
                <p className="input-description">
                  Use this voice when the selected realtime model responds with
                  audio. The default value for this model is{' '}
                  <strong>{languageModels[name].voice}</strong>.
                </p>
              </div>
            </div>
          </>
        ) : null}
        {/* frequencyPenalty */}
        {/* @note disabled because no longer relevant */}
        {/* <div>
          <label className="default-label" htmlFor="frequencyPenalty">
            Frequency Penalty
          </label>
          <div className="mt-1">
            <input
              className="default-input w-full sm:text-sm"
              name="frequencyPenalty"
              type="number"
              defaultValue={either(
                config.frequencyPenalty,
                languageModels[name].frequencyPenalty
              )}
              min={-2}
              max={2}
              step={0.1}
            />
          </div>
          <p className="input-description">
            Positive values penalize new tokens based on their existing
            frequency in the text so far, decreasing the model&apos;s likelihood
            to repeat the same line verbatim. The default value for this model
            is <strong>{languageModels[name].frequencyPenalty}</strong>.
          </p>
        </div> */}
        {/* presencePenalty */}
        {/* @note disabled because no longer relevant */}
        {/* <div>
          <label className="default-label" htmlFor="presencePenalty">
            Presence Penalty
          </label>
          <div className="mt-1">
            <input
              className="default-input w-full sm:text-sm"
              name="presencePenalty"
              type="number"
              defaultValue={either(
                config.presencePenalty,
                languageModels[name].presencePenalty
              )}
              min={-2}
              max={2}
              step={0.1}
            />
          </div>
          <p className="input-description">
            Positive values penalize new tokens based on whether they appear in
            the text so far, increasing the model&apos;s likelihood to talk
            about new topics. The default value for this model is{' '}
            <strong>{languageModels[name].frequencyPenalty}</strong>.
          </p>
        </div> */}
        {modelSupportsInterpreter(name) ? (
          <>
            {/* interpreter */}
            <div>
              <label className="default-label" htmlFor="interpreter">
                Interpreter
              </label>
              <div className="mt-1">
                <Toggle
                  name="interpreter"
                  defaultChecked={config.interpreter}
                />
                <p className="input-description">
                  Use native code interpreter capabilities of the selected
                  model.
                </p>
              </div>
            </div>
          </>
        ) : null}
        {modelSupportsImageInput(name) ? (
          <>
            {/* image */}
            <div>
              <label className="default-label" htmlFor="image">
                Image
              </label>
              <div className="mt-1">
                <Toggle name="image" defaultChecked={config.image} />
                <p className="input-description">
                  Use native image input capabilities of the selected model.
                </p>
              </div>
            </div>
          </>
        ) : null}
        {modelSupportsAudioInput(name) ? (
          <>
            {/* audio */}
            <div>
              <label className="default-label" htmlFor="audio">
                Audio
              </label>
              <div className="mt-1">
                <Toggle name="audio" defaultChecked={config.audio} />
                <p className="input-description">
                  Use native audio input capabilities of the selected model.
                </p>
              </div>
            </div>
          </>
        ) : null}
        {modelSupportsVideoInput(name) ? (
          <>
            {/* video */}
            <div>
              <label className="default-label" htmlFor="video">
                Video
              </label>
              <div className="mt-1">
                <Toggle name="video" defaultChecked={config.video} />
                <p className="input-description">
                  Use native video input capabilities of the selected model.
                </p>
              </div>
            </div>
          </>
        ) : null}
        {modelSupportsFileInput(name) ? (
          <>
            {/* file */}
            <div>
              <label className="default-label" htmlFor="file">
                File
              </label>
              <div className="mt-1">
                <Toggle name="file" defaultChecked={config.file} />
                <p className="input-description">
                  Use native file input capabilities of the selected model.
                </p>
              </div>
            </div>
          </>
        ) : null}
        {modelSupportsReasoningEffort(name) ? (
          <>
            {/* reasoning effort */}
            <div>
              <label className="default-label" htmlFor="effort">
                Reasoning Effort
              </label>
              <div className="mt-1">
                <select
                  className="default-input w-full sm:text-sm"
                  name="reasoningEffort"
                  defaultValue={config.reasoningEffort}
                >
                  <option value="auto">Automatic</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <p className="input-description">
                  Use native reasoning effort capabilities of the selected
                  model.
                </p>
              </div>
            </div>
          </>
        ) : null}
        {/* force function */}
        <div>
          <label className="default-label" htmlFor="forceFunction">
            Force Function
          </label>
          <div className="mt-1">
            <input
              className="default-input w-full sm:text-sm"
              name="forceFunction"
              type="text"
              defaultValue={config.forceFunction || undefined}
              placeholder="e.g., query"
            />
          </div>
          <p className="input-description">
            Force the model to always use a specific function. Leave empty to
            allow automatic function selection based on conversation context.
          </p>
        </div>
      </Expando>
    </div>
  )
}

export default function LanguageModelSelect({
  wrapperClassName,
  containerClassName,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  name,

  disabled,

  allowedModels,

  ...props
}) {
  const [value, setValue] = useControlledState(_defaultValue, _value, _setValue)

  const availableModels = useAvailableModels('language')
  const availableDefaultModel = useAvailableDefaultModel('language')

  const [modelName, setModelName] = useState('')
  const [modelConfig, setModelConfig] = useState({})

  useEffect(() => {
    if (!value) {
      setModelName('')
      setModelConfig({})

      return
    }

    let model

    try {
      model = parseLanguageModel(value)
    } catch (e) {
      toast.error(e.message)

      return
    }

    setModelName(model.name)
    setModelConfig(model.config)
  }, [value])

  useEffect(() => {
    if (!modelName) {
      return
    }

    if (
      modelName === 'custom' &&
      (!modelConfig.name || !modelConfig.provider || !modelConfig.credentials)
    ) {
      return
    }

    let model

    try {
      model = buildLanguageModel(modelName, modelConfig)
    } catch (e) {
      toast.error(e.message)

      return
    }

    setValue(model)
  }, [modelName, modelConfig, setValue])

  const { popup, openPopup, closePopup } = usePopup({})

  function commitModelSelection(name, config) {
    if (
      name === 'custom' &&
      (!config.name || !config.provider || !config.credentials)
    ) {
      toast.error(
        'Custom models require a name, provider and credentials before they can be selected.'
      )

      return false
    }

    setModelName(name)
    setModelConfig(config)

    return true
  }

  function openCustomModelConfig(initialConfig) {
    openPopup(<ConfigPopup name="custom" config={initialConfig} />, {
      closePopupOnClickOutside: true,
      title: 'Model Configuration',
      actions: {
        Commit: {
          default: true,

          fn: async (config) => {
            if (commitModelSelection('custom', config)) {
              closePopup()
            }
          },
        },
      },
    })
  }

  function handleModelSelect(selectedModel) {
    if (selectedModel === 'custom') {
      // @note a custom model is only committable with a complete config -
      // collect it before committing so the selection cannot silently dangle
      // in local state and get lost on remount (e.g. deselecting a designer
      // node); closing the popup without committing keeps the previous model
      openCustomModelConfig(modelName === 'custom' ? modelConfig : {})

      return
    }

    setModelName(selectedModel)
    setModelConfig({})
    closePopup()
  }

  function handleInputClick() {
    if (disabled) {
      return
    }

    openPopup(
      <SelectPopup
        currentModel={modelName}
        onSelect={handleModelSelect}
        allowedModels={allowedModels}
        availableModels={availableModels}
      />,
      {
        closePopupOnClickOutside: true,
        title: 'Select Language Model',
        dialogClassName: 'sm:max-w-4xl',
      }
    )
  }

  function handleOptionsClick() {
    if (disabled) {
      return
    }

    openPopup(<ConfigPopup name={modelName} config={modelConfig} />, {
      closePopupOnClickOutside: true,
      title: 'Model Configuration',
      actions: {
        Commit: {
          default: true,

          fn: async (config) => {
            if (commitModelSelection(modelName, config)) {
              closePopup()
            }
          },
        },
      },
    })
  }

  // @note extract just the model name for display, removing any parameters

  const displayName = modelName || availableDefaultModel || defaultLanguageModel
  const hasPendingConfiguration = Boolean(modelName || value)

  return (
    <div className={wrapperClassName}>
      {popup}
      <div
        className={clsx('flex flex-row gap-2 items-center', containerClassName)}
      >
        <input
          className="hidden"
          name={name}
          type="text"
          value={value}
          onChange={() => {}} // no handler
        />
        <input
          {...props}
          type="text"
          value={displayName}
          onClick={handleInputClick}
          readOnly
          disabled={disabled}
          className={clsx(
            'cursor-pointer',
            props.className,
            disabled && 'cursor-not-allowed'
          )}
          spellCheck={false}
          autoComplete="off"
        />
        {hasPendingConfiguration ? (
          <IoIosOptions
            className={clsx('h-5 w-5 default-link', { disabled: disabled })}
            onClick={handleOptionsClick}
          />
        ) : null}
      </div>
    </div>
  )
}

/**
 * @doc Models
 * @index 200
 *
 * ## Bring Your Own Model
 *
 * ChatBotKit offers the unique option of bringing your own model and keys to the platform. This feature is designed for those who desire more control over their models and costs. If you have a model that you've trained and perfected over time for your specific use case or requirement, you're free to bring it to our platform. This means you can use your own keys, which allows you to handle the payment for the model usage directly. This could be beneficial, especially if you have particular budget constraints or specific cost strategies. In essence, with ChatBotKit, you're not just limited to using our pre-built models, but you can also introduce your custom-made models, providing you with more flexibility and control to meet your specific needs.
 *
 * Here is an outline of the steps required to create your own custom model.
 *
 * 1. Navigate to the Bot Configuration Screen
 * 	- From the main dashboard, click on the "Bots" section in the left-hand menu.
 * 	- Select the bot you want to configure or create a new bot.
 * 2. Choose the Model
 * 	- Under the "Model" section, select "custom" from the dropdown menu.
 * 	- The model configuration window opens automatically.
 * 3. Model Configuration Window
 * 	- Enter the name of the model in the "Name" field (e.g. the model identifier from the provider).
 * 	- Choose the provider from the "Provider" dropdown menu (e.g. OpenAI, Anthropic, etc.).
 * 	- Provide the necessary credentials for accessing the custom model. Click on the credentials field and enter the required information.
 * 	- Define the maximum number of tokens the chatbot will use for each interaction in the "Max Tokens" field.
 *
 * <details>
 *   <summary>BYOK Caveats</summary>
 *
 * When you opt to use your own key (BYOK) for model access, you assume full responsibility for the model's availability and operational limits. This shift occurs because you are no longer utilizing the default ChatBotKit service tiers, which may offer different capabilities and restrictions.
 *
 *   </details>
 *
 * ## Customizing Model Settings
 *
 * To customize a model, click the settings icon next to the selected model.
 *
 * ### Core options
 *
 * - **Max Tokens (context window):** Maximum tokens available to each interaction. Lower values reduce cost and context depth. Higher values preserve more context.
 * - **Temperature:** Controls randomness. Lower values are more deterministic. Higher values are more creative.
 * - **Interaction Max Messages:** Maximum number of messages sent to the model for each interaction.
 * - **Threshold Strategy:** Controls history reduction when thresholds are reached.
 *   - **Truncate** keeps the latest conversation turns.
 *   - **Compact** summarizes prior turns into checkpoint-style context.
 *
 * ### Model and provider options
 *
 * - **Region:** Selects where the model runs when the provider supports regions.
 * - **Force Function:** Forces the model to call a specific function.
 *
 * For custom models (`custom`), these additional options are available:
 *
 * - **Name:** Provider model identifier.
 * - **Provider:** Language model provider (for example OpenAI or Anthropic).
 * - **Credentials:** Provider credentials used for requests.
 * - **Endpoint:** Optional custom endpoint URL.
 *
 * ### Advanced options
 *
 * - **Frequency Penalty:** Reduces repeated phrases by penalizing frequent tokens.
 * - **Presence Penalty:** Encourages topic exploration by penalizing already-used tokens.
 * - **Interpreter:** Enables native code interpreter for supported models.
 * - **Image / Audio / Video / File:** Enables native multimodal input capabilities when supported by the selected model.
 * - **Reasoning Effort:** Adjusts reasoning intensity for models that expose reasoning effort controls.
 *
 * These settings let teams tune quality, cost, latency, and memory behavior per bot or conversation.
 */
