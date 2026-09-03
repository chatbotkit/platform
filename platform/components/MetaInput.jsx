import { useMemo, useState } from 'react'

import { parse, tryStringify } from '@/lib/yaml'

import DynamicIcon from '@/components/DynamicIcon'
import List from '@/components/List'
import ObjectInput from '@/components/ObjectInput'

import useControlledState from '@/hooks/useControlledState'
import useFuzzySearch from '@/hooks/useFuzzySearch'
import usePopup from '@/hooks/usePopup'

import { Square3Stack3DIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

// @note meta templates for common use cases

const META_TEMPLATES = []

function MetaTemplateDialog({ templates = [] }) {
  const [selectedId, setSelectedId] = useState()
  const [selectedConfig, setSelectedConfig] = useState('')
  const [search, setSearch] = useState('')

  const filteredTemplates = useFuzzySearch(templates, search, {
    keys: useMemo(() => ['id', 'name', 'description', 'tags'], []),
    threshold: 0.4,
    debounce: 1000,
    disabled: !search,
  })

  return (
    <div>
      <input type="hidden" name="config" value={selectedConfig} />
      <div className="space-y-4 max-h-[500px] h-screen flex flex-col">
        <p className="text-sm">
          Select a metadata template from the list below.
        </p>
        <input
          className="default-input w-full"
          type="search"
          placeholder="Search..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex-1 h-full overflow-auto">
          <List>
            {filteredTemplates.map(
              ({ id, icon, name, description, config, tags }) => {
                return (
                  <List.Item
                    key={id}
                    selected={id === selectedId}
                    icon={
                      <DynamicIcon
                        className="w-12 h-12 text-[3rem] rounded-full object-cover bg-white p-2"
                        icon={icon || '@heroicons/cube-transparent'}
                      />
                    }
                    title={name}
                    body={description}
                    onClick={() => {
                      setSelectedId(id)
                      setSelectedConfig(tryStringify(config) || '')
                    }}
                  >
                    <div className="space-y-2 w-full">
                      {tags?.length > 0 ? (
                        <div className="space-x-1">
                          {tags.map((tag, index) => (
                            <span key={index} className="tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </List.Item>
                )
              }
            )}
          </List>
        </div>
      </div>
    </div>
  )
}

function useMetaTemplateDialog() {
  const { popup, openPopup, closePopup } = usePopup()

  function open(options) {
    openPopup(<MetaTemplateDialog templates={META_TEMPLATES} />, {
      title: 'Metadata Templates',
      actions: {
        Use: {
          default: true,

          async fn(props) {
            options.callback(props)

            closePopup()
          },
        },
      },
    })
  }

  function close() {
    closePopup()
  }

  return [popup, open, close]
}

export default function MetaInput({
  defaultMeta: _defaultMeta,
  meta: _meta,
  setMeta: _setMeta,

  className,

  templates = true,

  onTemplateSelect,

  ...props
}) {
  const [meta, setMeta] = useControlledState(_defaultMeta, _meta, _setMeta)

  const [templateDialog, templateDialogOpen] = useMetaTemplateDialog()

  async function handleTemplateClick(event) {
    /**
     * @note required because we do not want to submit forms
     */
    event.preventDefault()
    event.stopPropagation()

    templateDialogOpen({
      callback: (template) => {
        // @note the template dialog returns the config as a YAML string in the form data

        const configValue = template.config

        if (configValue) {
          const parsedConfig = parse(configValue)

          if (parsedConfig) {
            setMeta(parsedConfig)
          }
        }

        onTemplateSelect?.(template)
      },
    })
  }

  return (
    <>
      {templateDialog}
      <ObjectInput
        {...props}
        className={clsx('default-input w-full', className)}
        object={meta}
        setObject={setMeta}
      >
        {templates && META_TEMPLATES.length > 0 ? (
          <div className="relative group/tooltip flex">
            <button
              className="default-button tiny"
              type="button"
              onClick={handleTemplateClick}
              disabled={props.disabled}
            >
              <Square3Stack3DIcon className="w-5 h-5" />
            </button>
            <div className="tooltip below w-24">Templates</div>
          </div>
        ) : null}
      </ObjectInput>
    </>
  )
}
