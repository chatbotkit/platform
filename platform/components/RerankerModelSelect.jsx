'use client'

import { useEffect, useMemo, useState } from 'react'
import { IoIosOptions } from 'react-icons/io'

import {
  defaultRerankModel,
  rerankModels,
  visibleRerankModels,
} from '@/config/models'

import { either } from '@/lib/helpers'
import { buildRerankModel, parseRerankModel } from '@/lib/model.utils'
import toast from '@/lib/toast'

import List from '@/components/List'

import useAvailableModels, {
  useAvailableDefaultModel,
} from '@/hooks/useAvailableModels'
import useControlledState from '@/hooks/useControlledState'
import useDebounce from '@/hooks/useDebounce'
import usePopup from '@/hooks/usePopup'

import clsx from 'clsx'

// @note default shown for the Max Records config input; mirrors the dataset
// store prefetch default in lib/dataset.search.ts.
const DEFAULT_RERANK_MAX_RECORDS = 20

const rerankModelCreditConsumptionLabels = {
  free: 'free',
  low: 'low credit',
  medium: 'medium credit',
  high: 'high credit',
  'very-high': 'very high credit',
}

const rerankModelCreditConsumptionThresholds = {
  low: 100,
  medium: 130,
  high: 200,
}

function getRerankModelCreditConsumptionTier(modelConfig) {
  const tokenRatio = modelConfig?.pricing?.tokenRatio

  if (typeof tokenRatio !== 'number') {
    return null
  }

  if (tokenRatio === 0) {
    return 'free'
  }

  if (tokenRatio < rerankModelCreditConsumptionThresholds.low) {
    return 'low'
  }

  if (tokenRatio < rerankModelCreditConsumptionThresholds.medium) {
    return 'medium'
  }

  if (tokenRatio < rerankModelCreditConsumptionThresholds.high) {
    return 'high'
  }

  return 'very-high'
}

export function getRerankModelSortPriority(modelName, modelConfig) {
  if (modelName === defaultRerankModel) {
    return 0
  }

  if (modelConfig.featured) {
    return 1
  }

  return 2
}

export function compareVisibleRerankModels([aName, aConfig], [bName, bConfig]) {
  const priorityDifference =
    getRerankModelSortPriority(aName, aConfig) -
    getRerankModelSortPriority(bName, bConfig)

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

const rerankModelSortOptions = [
  { id: 'default', label: 'Default' },
  { id: 'cost', label: 'Cost' },
  { id: 'provider', label: 'Provider' },
  { id: 'newest', label: 'Newest' },
]

function getRerankModelTokenRatio(modelConfig) {
  const tokenRatio = modelConfig?.pricing?.tokenRatio

  return typeof tokenRatio === 'number' ? tokenRatio : Infinity
}

function compareVisibleRerankModelsBySort(sort) {
  return (a, b) => {
    const [aName, aConfig] = a
    const [bName, bConfig] = b

    switch (sort) {
      case 'cost': {
        const ratioDifference =
          getRerankModelTokenRatio(aConfig) - getRerankModelTokenRatio(bConfig)

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
        return compareVisibleRerankModels(a, b)
    }
  }
}

function SelectPopup({ currentModel, onSelect, availableModels }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('default')

  const debouncedSearch = useDebounce(search, 300)

  const filteredModels = useMemo(() => {
    let models = Object.entries(visibleRerankModels)

    // @note availability comes from the platform model list API at runtime;
    // while it is unknown the compiled catalogue stands in
    if (availableModels) {
      models = models.filter((entry) => availableModels.includes(entry[0]))
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
  }, [debouncedSearch, availableModels])

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Select a reranker model from the list below. You can configure
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
        {rerankModelSortOptions.map(({ id, label }) => (
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
            .sort(compareVisibleRerankModelsBySort(sort))
            .map(([modelName, modelConfig]) => {
              const creditConsumptionTier =
                getRerankModelCreditConsumptionTier(modelConfig)

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
                          rerankModelCreditConsumptionLabels[
                            creditConsumptionTier
                          ]
                        }
                      </span>
                      <span className="tooltip above w-32">
                        ratio: {modelConfig.pricing.tokenRatio}
                      </span>
                    </span>
                  ) : null}
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
      {rerankModels[name] ? (
        <p className="text-sm">{rerankModels[name].description}</p>
      ) : null}
      <div>
        <label className="default-label" htmlFor="maxRecords">
          Max Records
        </label>
        <div className="mt-1">
          <input
            className="default-input w-full sm:text-sm"
            type="number"
            name="maxRecords"
            defaultValue={either(config.maxRecords, DEFAULT_RERANK_MAX_RECORDS)}
          />
        </div>
        <p className="input-description">
          The maximum number of records the reranker considers from the dataset
          store before reordering. The default is{' '}
          <strong>{DEFAULT_RERANK_MAX_RECORDS}</strong>.
        </p>
      </div>
      <div>
        <label className="default-label" htmlFor="region">
          Region
        </label>
        <div className="mt-1">
          <select
            className="default-input w-full sm:text-sm"
            name="region"
            defaultValue={either(config.region, rerankModels[name].region)}
          >
            {[...rerankModels[name].availableRegions].map((region) => {
              return (
                <option key={region} value={region}>
                  {region}
                </option>
              )
            })}
          </select>
        </div>
        <p className="input-description">
          The region where the model is hosted. The default value for this model
          is <strong>{rerankModels[name].region}</strong>.
        </p>
      </div>
    </div>
  )
}

export default function RerankerModelSelect({
  wrapperClassName,
  containerClassName,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,

  name,

  disabled,

  ...props
}) {
  const [value, setValue] = useControlledState(_defaultValue, _value, _setValue)

  const availableModels = useAvailableModels('rerank')
  const availableDefaultModel = useAvailableDefaultModel('rerank')

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
      model = parseRerankModel(value)
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

    let model

    try {
      model = buildRerankModel(modelName, modelConfig)
    } catch (e) {
      toast.error(e.message)

      return
    }

    setValue(model)
  }, [modelName, modelConfig, setValue])

  const { popup, openPopup, closePopup } = usePopup({})

  function handleModelSelect(selectedModel) {
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
        availableModels={availableModels}
      />,
      {
        closePopupOnClickOutside: true,
        title: 'Select Reranker Model',
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
            setModelConfig(config)

            closePopup()
          },
        },
      },
    })
  }

  const displayName = modelName || availableDefaultModel || defaultRerankModel

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
          onChange={() => {}}
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
        {value ? (
          <IoIosOptions
            className={clsx('h-5 w-5 default-link', { disabled: disabled })}
            onClick={handleOptionsClick}
          />
        ) : null}
      </div>
    </div>
  )
}
