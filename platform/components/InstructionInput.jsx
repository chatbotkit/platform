import { useEffect, useMemo, useRef, useState } from 'react'

import { parseText } from '@/lib/action.parse'
import { parseTemplateInstruction } from '@/lib/instruction.template.parse'
import { getInstructionType } from '@/lib/instruction.type'
import { extractSecrets } from '@/lib/secret.extract'
import { getRandomId } from '@/lib/string'

import AbilityTemplateBrowser from '@/components/AbilityTemplateBrowser'
import ObjectView from '@/components/ObjectView'
import TextareaHighlighter from '@/components/TextareaHighlighter'
import TokenAutoTextarea from '@/components/TokenAutoTextarea'
import { useExtendWidgetFunctions } from '@/components/Widget'
import ZoomableArea from '@/components/ZoomableArea'

import useAbilityTemplates from '@/hooks/useAbilityTemplates'
import useControllableInput from '@/hooks/useControllableInput'
import useDOMQuerySelector from '@/hooks/useDOMQuerySelector'
import useDashboardWidgetSend from '@/hooks/useDashboardWidgetSend'
import useDebounce from '@/hooks/useDebounce'
import useFetch from '@/hooks/useFetch'
import useMagicDialog from '@/hooks/useMagicDialog'
import usePopup from '@/hooks/usePopup'
import useTabIndent from '@/hooks/useTabIndent'

import {
  ArrowsPointingOutIcon,
  SparklesIcon,
  Square3Stack3DIcon,
} from '@heroicons/react/24/outline'

import clsx from 'clsx'
import pluralize from 'pluralize'

const ACTION_MATCHERS = [/\`\`\`(?<action>\w+)/gi]

const REFERENCE_MATCHERS = [
  /\$\{(?<reference>(SECRET|CONVERSATION)[^}]*)\}/gi,
  /\{\{(?<reference>(SECRET|CONVERSATION)[^}]*)\}\}/gi,
]

const PARAMETER_MATCHERS = [
  /\$\[(?<parameter>[^\]]+)\]/gi,
  /\[\[(?<parameter>[^\]]+)\]\]/gi,
]

const PLACEHOLDER_MATCHERS = [/(?<placeholder>\(\([^\)]+\)\))/gi]

const ERROR_MATCHERS = [/(?<error>\(\(\s*\)\))/gi]

const YAML_TAG_MATCHERS = [/!(?<yamltag>\w+)/gi]

const YAML_KEY_MATCHERS = [/^[ ]*(?<yamlkey>[^\s:]+:(?=\s|$))/gim]

function InstructionType({ value, inputId, templates = [], loading = false }) {
  const debouncedValue = useDebounce(value, 1000)

  const { send: widgetSend } = useDashboardWidgetSend()

  const { popup, openPopup } = usePopup()

  const { fetch } = useFetch()

  const type = useMemo(() => {
    try {
      return getInstructionType(debouncedValue || '')
    } catch {
      // pass
    }

    return null
  }, [debouncedValue])

  const [valid, setValid] = useState(true)

  useEffect(() => {
    if (type !== 'template') {
      setValid(true)

      return
    }

    if (loading) {
      setValid(true)

      return
    }

    try {
      const { template } = parseTemplateInstruction(debouncedValue)

      // @note validate by checking if template exists in the templates list

      const exists = templates.some(
        (t) => t.template === template || t.id === template
      )

      setValid(exists)
    } catch {
      setValid(false)
    }
  }, [debouncedValue, type, templates, loading])

  async function handleClick(event) {
    if (!valid) {
      event.preventDefault()
      event.stopPropagation()

      widgetSend(
        `Please investigate the instruction in input field ${inputId}. The instruction appears to be invalid.`,
        { hidden: true, respond: true }
      )

      return
    }

    event.preventDefault()
    event.stopPropagation()

    const { data, error } = await fetch('/api/auxiliary/playground/ability', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-chatbotkit-handler-name': 'toolCall',
      },
      body: JSON.stringify({ instruction: debouncedValue }),
    })

    if (error || !data) {
      return
    }

    openPopup(<ObjectView className="text-sm" object={data} />, {
      title: 'JSON Schema Tool Call',
      cancelButtonCaption: 'Close',
    })
  }

  return type ? (
    <>
      {popup}
      <div
        className={clsx(
          'relative group/tooltip flex justify-center select-none cursor-pointer'
        )}
        onClick={handleClick}
      >
        <div
          className={clsx(
            'flex justify-center items-center text-xs rounded pt-1 pb-1 pr-2 pl-2 auto-bg-gray-200 auto-text-gray-500',
            {
              '!bg-red-500 !text-white': !valid,
              '!bg-orange-500 !text-white':
                type === 'automatic' || type === 'complex',
            }
          )}
        >
          <div className="truncate">{valid ? type : `invalid ${type}`}</div>
        </div>
        <div className="tooltip below w-44">
          {!valid
            ? 'Click to investigate and fix this invalid instruction'
            : {
                automatic:
                  'The action of this instruction will be automatically detected, which may lead to unexpected results',
                simple:
                  'Simple instructions are the most versatile instruction types suitable for all needs',
                complex:
                  'Complex instructions are processed by a language model before being used, which may lead to unexpected results',
                template:
                  'A template instruction (in YAML format) is a pre-defined instruction that can be customized with parameters',
                structured:
                  'Structured instructions use YAML tags like !string, !number, !boolean to define fields with rich metadata including type, description, required flag, default values, and enum constraints',
              }[type]}
        </div>
      </div>
    </>
  ) : null
}

function ActionsInfo({ value }) {
  const debouncedValue = useDebounce(value, 1000)

  const actions = useMemo(() => {
    try {
      const parsed = parseText(debouncedValue || '')

      return parsed.actions
    } catch {
      // pass
    }

    return []
  }, [debouncedValue])

  return (
    <div className="relative group/tooltip flex justify-center cursor-help select-none">
      <div className="flex justify-center items-center text-xs min-w-[1.5rem] rounded pt-1 pb-1 pr-2 pl-2 auto-bg-gray-200 auto-text-gray-500">
        <div className="truncate">{actions.length}</div>
      </div>
      <div className="tooltip below w-44">
        There {pluralize('is', actions.length)}{' '}
        <strong>{actions.length}</strong> {pluralize('action', actions.length)}{' '}
        in this instruction
      </div>
    </div>
  )
}

function FieldsInfo({ value }) {
  const debouncedValue = useDebounce(value, 1000)

  const fields = useMemo(() => {
    if (!debouncedValue) {
      return []
    }

    const fields = []

    for (const matcher of PARAMETER_MATCHERS) {
      const matches = debouncedValue.matchAll(matcher) || []

      for (const match of matches) {
        const parameter = match.groups.parameter

        if (parameter && !fields.includes(parameter)) {
          fields.push(parameter)
        }
      }
    }

    for (const matcher of REFERENCE_MATCHERS) {
      const matches = debouncedValue.matchAll(matcher) || []

      for (const match of matches) {
        const reference = match.groups.reference

        if (reference && !fields.includes(reference)) {
          fields.push(reference)
        }
      }
    }

    return fields
  }, [debouncedValue])

  return (
    <div className="relative group/tooltip flex justify-center cursor-help select-none">
      <div className="flex justify-center items-center text-xs min-w-[1.5rem] rounded pt-1 pb-1 pr-2 pl-2 auto-bg-gray-200 auto-text-gray-500">
        <div className="truncate">{fields.length}</div>
      </div>
      <div className="tooltip below w-44">
        There {pluralize('is', fields.length)} <strong>{fields.length}</strong>{' '}
        {pluralize('field', fields.length)} in this instruction
      </div>
    </div>
  )
}

function ErrorsInfo({ value }) {
  const [errors, setErrors] = useState([])

  useEffect(() => {
    if (value === undefined) {
      return
    }

    const errors = []

    for (const matcher of ERROR_MATCHERS) {
      const matches = value?.matchAll(matcher) || []

      for (const match of matches) {
        const error = match.groups.error

        if (error) {
          errors.push(error)
        }
      }
    }

    setErrors(errors)
  }, [value])

  return (
    <div className="relative group/tooltip flex justify-center cursor-help select-none">
      <div
        className={clsx(
          'flex justify-center items-center text-xs min-w-[1.5rem] rounded pt-1 pb-1 pr-2 pl-2',
          {
            'auto-bg-gray-200 auto-text-gray-500': errors.length === 0,
            'bg-red-500 text-white': errors.length > 0,
          }
        )}
      >
        <div className="truncate">{errors.length}</div>
      </div>
      <div className="tooltip below w-44">
        There {pluralize('is', errors.length)} <strong>{errors.length}</strong>{' '}
        {pluralize('error', errors.length)} in this instruction that requires a
        fix
      </div>
    </div>
  )
}

function PlaceholdersInfo({ value }) {
  const [placeholders, setPlaceholders] = useState([])

  useEffect(() => {
    if (value === undefined) {
      return
    }

    const placeholders = []

    for (const matcher of PLACEHOLDER_MATCHERS) {
      const matches = value?.matchAll(matcher) || []

      for (const match of matches) {
        const placeholder = match.groups.placeholder

        if (placeholder) {
          placeholders.push(placeholder)
        }
      }
    }

    setPlaceholders(placeholders)
  }, [value])

  return (
    <div className="relative group/tooltip flex justify-center cursor-help select-none">
      <div
        className={clsx(
          'flex justify-center items-center text-xs min-w-[1.5rem] rounded pt-1 pb-1 pr-2 pl-2',
          {
            'auto-bg-gray-200 auto-text-gray-500': placeholders.length === 0,
            'bg-blue-500 text-white': placeholders.length > 0,
          }
        )}
      >
        <div className="truncate">{placeholders.length}</div>
      </div>
      <div className="tooltip below w-44">
        There {pluralize('is', placeholders.length)}{' '}
        <strong>{placeholders.length}</strong>{' '}
        {pluralize('placeholder', placeholders.length)} in this instruction -{' '}
        <strong>
          provide value or leave empty for the AI agent to fill in
        </strong>
      </div>
    </div>
  )
}

function SecretsInfo({ value }) {
  const [secrets, setSecrets] = useState([])

  useEffect(() => {
    if (value === undefined) {
      return
    }

    setSecrets(extractSecrets(value))
  }, [value])

  return (
    <div className="relative group/tooltip flex justify-center cursor-help select-none">
      <div
        className={clsx(
          'flex justify-center items-center text-xs min-w-[1.5rem] rounded pt-1 pb-1 pr-2 pl-2',
          {
            'auto-bg-gray-200 auto-text-gray-500': secrets.length >= 0,
          }
        )}
      >
        <div className="truncate">{secrets.length}</div>
      </div>
      <div className="tooltip below w-44">
        There {pluralize('is', secrets.length)}{' '}
        <strong>{secrets.length}</strong> {pluralize('secret', secrets.length)}{' '}
        in this instruction
      </div>
    </div>
  )
}

function InstructionTextarea({
  className,

  containerClassName,
  textareaWrapperClassName,

  value,
  onChange,

  children,

  ...props
}) {
  const containerRef = useRef()

  const [textarea] = useDOMQuerySelector(':scope .instruction-input-area', {
    parent: containerRef.current,
    waitForElements: true,
  })

  const { handleKeyDown, selection } = useTabIndent(onChange)

  useEffect(() => {
    if (!textarea) {
      return
    }

    textarea.selectionStart = selection.start
    textarea.selectionEnd = selection.end
  }, [selection, textarea])

  const keywords = useMemo(() => {
    return [
      // actions
      ...ACTION_MATCHERS,
      // references
      ...REFERENCE_MATCHERS,
      // parameters
      ...PARAMETER_MATCHERS,
      // placeholders
      ...PLACEHOLDER_MATCHERS,
      // yaml
      ...YAML_TAG_MATCHERS,
      ...YAML_KEY_MATCHERS,
      // errors
      ...ERROR_MATCHERS,
    ]
  }, [])

  return (
    <div className={clsx('relative', containerClassName)} ref={containerRef}>
      <TextareaHighlighter
        key="text-area-highlighter"
        className={clsx(
          'instruction-input-highlighter',

          'z-10', // place the text highlighter below the textarea

          'auto-text-black', // default text color

          // @note do not use opacity or alpha background colors for the
          // markers otherwise you risk making the text appear bolder

          '[&_mark]:bg-indigo-500 [&_mark]:text-white',
          '[&_mark.action]:auto-bg-gray-200 [&_mark.action]:auto-text-black ',
          '[&_mark.reference]:auto-bg-gray-200 [&_mark.reference]:auto-text-black ',
          '[&_mark.parameter]:bg-indigo-200 [&_mark.parameter]:text-black dark:[&_mark.var]:text-white',
          '[&_mark.error]:bg-red-300 [&_mark.error]:text-white',
          '[&_mark.placeholder]:bg-blue-300 [&_mark.placeholder]:text-white',
          '[&_mark.yamltag]:bg-blue-300 [&_mark.yamltag]:text-white',
          '[&_mark.yamlkey]:auto-bg-gray-50 [&_mark.yamlkey]:auto-text-gray-500'
        )}
        keywords={keywords}
        textarea={textarea}
        value={value}
        top={false}
      />
      <TokenAutoTextarea
        key="token-auto-textarea"
        spellCheck={false}
        {...props}
        className={clsx(
          'instruction-input-area',

          'font-mono', // @note because the instruction includes special code for actions and placeholders

          '!text-transparent !bg-transparent caret-black dark:caret-white',

          'relative z-20', // place the textarea above the text highlighter

          className
        )}
        wrapperClassName={textareaWrapperClassName}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
      >
        {children}
      </TokenAutoTextarea>
    </div>
  )
}

function InstructionTemplateDialog({ templates = [] }) {
  const [selected, setSelected] = useState()

  return (
    <div>
      <input type="hidden" name="name" value={selected?.name || ''} />
      <input
        type="hidden"
        name="description"
        value={selected?.description || ''}
      />
      <input
        type="hidden"
        name="instruction"
        value={selected?.instruction || ''}
      />
      <div className="space-y-4 max-h-[500px] h-screen flex flex-col">
        <p className="text-sm">
          Select an instruction template from the list below.
        </p>
        <AbilityTemplateBrowser
          className="flex-1"
          templates={templates}
          selectedIds={selected ? [selected.id] : []}
          onSelect={setSelected}
        />
      </div>
    </div>
  )
}

function useInstructionTemplateDialog({ templates }) {
  const { popup, openPopup, closePopup } = usePopup()

  function open(options) {
    openPopup(<InstructionTemplateDialog templates={templates} />, {
      title: 'Instruction Templates',
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

function useInstructionMagicDialog() {
  const { dialog, open, close } = useMagicDialog({
    promptId: '@instruction',

    title: 'Ability',

    children: (
      <p className="text-sm">
        Let&apos;s try to generate the perfect ability for you. Describe below
        what you need and we will do the rest.
      </p>
    ),

    placeholder: 'i.e. fetch tickets from zendesk',
  })

  return [dialog, open, close]
}

export default function InstructionInput({
  className,
  wrapperClassName,
  containerClassName,
  textareaWrapperClassName,

  defaultValue: _defaultValue,
  value: _value,
  setValue: _setValue,
  onChange: _onChange,

  onTemplateSelect,

  instructionInfo = true,
  placeholderInfo = true,
  secretsInfo = true,
  errorsInfo = true,
  fieldsInfo = true,
  actionsInfo = true,

  zoom = true,

  magic = true,

  // @note apply this template as soon as the catalogue loads, as if the user
  // had picked it out of the template dialog themselves
  templateId,

  autoOpenTemplate = false,

  children,

  ...props
}) {
  const inputId = useMemo(() => getRandomId(), [])

  const [value, onChange, setValue] = useControllableInput({
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    onChange: _onChange,
  })

  // @note register widget functions for AI assistant to get/set the instruction value

  useExtendWidgetFunctions(
    useMemo(
      () => ({
        [`instruction_input_get_${inputId}`]: {
          description:
            'Get the current value of the instruction input field. Use this to read what the user has entered in the instruction.',
          parameters: {
            type: 'object',
            properties: {},
          },
          handler: async () => {
            return {
              value: value || '',
              type: getInstructionType(value || ''),
            }
          },
        },
        [`instruction_input_set_${inputId}`]: {
          description:
            'Set the value of the instruction input field. Use this to update or fix the instruction content.',
          parameters: {
            type: 'object',
            properties: {
              value: {
                type: 'string',
                description: 'The new instruction value to set',
              },
            },
            required: ['value'],
          },
          handler: async ({ value: newValue }) => {
            setValue(newValue)

            return {
              success: true,
              value: newValue,
              type: getInstructionType(newValue || ''),
            }
          },
        },
      }),
      [inputId, value, setValue]
    )
  )

  const { templates, loading: templatesLoading } = useAbilityTemplates()

  const [templateDialog, templateDialogOpen] = useInstructionTemplateDialog({
    templates,
  })

  const [magicDialog, magicDialogOpen] = useInstructionMagicDialog()

  const [zoomed, setZoomed] = useState(false)

  function applyTemplate(template) {
    setValue(template.instruction)

    onTemplateSelect?.(template)
  }

  useEffect(() => {
    // @note only act once the templates are fully loaded

    if (!templates.length || value) {
      return
    }

    // @note a caller which already knows the template skips the dialog

    if (templateId) {
      const template = templates.find(({ id }) => id === templateId)

      if (template) {
        applyTemplate(template)
      }

      return
    }

    if (autoOpenTemplate) {
      templateDialogOpen({
        callback: applyTemplate,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]) // @note run when templates are loaded

  async function handleTemplateClick(event) {
    /**
     * @note required because we do not want to submit forms
     */
    event.preventDefault()
    event.stopPropagation()

    templateDialogOpen({
      callback: applyTemplate,
    })
  }

  async function handleMagicClick(event) {
    /**
     * @note required because we do not want to submit forms
     */
    event.preventDefault()
    event.stopPropagation()

    magicDialogOpen({
      callback: (value) => {
        setValue(value)
      },
    })
  }

  return (
    <ZoomableArea
      className={wrapperClassName}
      zoomedContainerClassName="overflow-auto"
      zoomedContentClassName="max-w-3xl mx-auto px-10 py-20 overflow-auto"
      zoomed={zoomed}
      setZoomed={setZoomed}
    >
      {magicDialog}
      {templateDialog}
      <InstructionTextarea
        {...props}
        containerClassName={containerClassName}
        textareaWrapperClassName={textareaWrapperClassName}
        className={clsx(
          'max-h-96 !overflow-auto', // @note large editable areas are kind of funky to edit so we need to constrain the height

          className,

          // @note positioned at the end to override preceding rules
          {
            '!max-h-none !border-none !outline-none !ring-0 !shadow-none [&:not(.unimportant)]:!text-base':
              zoomed,
          }
        )}
        value={value}
        onChange={onChange}
      >
        {children}
        {instructionInfo ? (
          <InstructionType
            value={value}
            inputId={inputId}
            templates={templates}
            loading={templatesLoading}
          />
        ) : null}
        {placeholderInfo ? <PlaceholdersInfo value={value} /> : null}
        {secretsInfo ? <SecretsInfo value={value} /> : null}
        {errorsInfo ? <ErrorsInfo value={value} /> : null}
        {fieldsInfo ? <FieldsInfo value={value} /> : null}
        {actionsInfo ? <ActionsInfo value={value} /> : null}
        <div className="relative group/tooltip flex">
          <button
            className="default-button tiny push"
            type="button"
            onClick={handleTemplateClick}
            disabled={props.disabled || templates.length === 0}
          >
            <Square3Stack3DIcon className="w-5 h-5" />
          </button>
          <div className="tooltip below w-24">Templates</div>
        </div>
        {zoom && !zoomed ? (
          <div className="relative group/tooltip flex">
            <button
              className="default-button tiny push"
              type="button"
              onClick={() => setZoomed(true)}
              disabled={props.disabled}
            >
              <ArrowsPointingOutIcon className="w-5 h-5" />
            </button>
            <div className="tooltip below w-24">Zoom</div>
          </div>
        ) : null}
        {magic ? (
          <div className="relative group/tooltip flex">
            <button
              className="default-button tiny push"
              type="button"
              onClick={handleMagicClick}
              disabled={props.disabled}
            >
              <SparklesIcon className="w-5 h-5" />
            </button>
            <div className="tooltip below w-24">Magic</div>
          </div>
        ) : null}
      </InstructionTextarea>
    </ZoomableArea>
  )
}
