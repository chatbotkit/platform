'use client'

import { useCallback, useState } from 'react'

import toast from '@/lib/toast'

import { AppNavExtra, AppScene, useInfobarToggle } from '@/layouts/App'

import BackstoryInput from '@/components/BackstoryInput'
import DescriptionInput from '@/components/DescriptionInput'
import Headline from '@/components/Headline'
import LanguageModelSelect from '@/components/LanguageModelSelect'

import { updateBot } from '../server'
import { useBlueprintContext } from './context'

export function WidgetPreview({ widget }) {
  if (!widget) {
    return null
  }

  return (
    <iframe
      src={`/integrations/widget/${widget.id}/test?open=true`}
      className="w-full h-full border-0"
      title="Widget Preview"
    />
  )
}

export function WidgetInfobar({ widget }) {
  const { toggle, toRender } = useInfobarToggle({
    id: 'widget-info',
    width: '45%',
    className: 'w-full h-full',
    render: useCallback(() => <WidgetPreview widget={widget} />, [widget]),
    renderNav: useCallback(() => <h1>Preview</h1>, []),
  })

  return (
    <>
      {toRender}
      <AppNavExtra>
        <button
          className="primary-button pointer-events-auto"
          type="button"
          onClick={toggle}
          title="Preview widget"
        >
          Preview Widget
        </button>
      </AppNavExtra>
    </>
  )
}

export function Main() {
  const { blueprint, bot: initialBot, allowedModels } = useBlueprintContext()

  const [saving, setSaving] = useState(false)

  const [bot, setBot] = useState(initialBot)

  const handleSaveBot = useCallback(
    async (e) => {
      e.preventDefault()

      if (!bot) {
        return
      }

      setSaving(true)

      const formData = new FormData(e.target)

      try {
        const result = await updateBot({
          id: bot.id,
          name: formData.get('name'),
          description: formData.get('description'),
          backstory: formData.get('backstory'),
          model: formData.get('model'),
        })

        if ('error' in result) {
          toast.error(result.error.message)
        } else {
          setBot(result)
          toast.success('Agent configuration saved')
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to save agent configuration'
        )
      } finally {
        setSaving(false)
      }
    },
    [bot]
  )

  return (
    <div className="main-page main-page-3xl main-page-left">
      <AppScene
        compact={true}
        name={null}
        headline={blueprint.name}
        description={blueprint.description}
      />
      <form className="divided-area" onSubmit={handleSaveBot}>
        <div className="divided-area">
          {/* bot configuration */}
          <div>
            <Headline title="Agent Configuration">
              Configure how your customer support agent responds to queries.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* name */}
              <div>
                <label className="default-label" htmlFor="name">
                  Agent Name
                </label>
                <div className="mt-1">
                  <input
                    className="default-input w-full"
                    id="name"
                    name="name"
                    type="text"
                    defaultValue={bot.name}
                    required
                  />
                </div>
                <p className="input-description">
                  The name of your customer support agent.
                </p>
              </div>
              {/* description */}
              <div>
                <label className="default-label" htmlFor="description">
                  Description
                </label>
                <div className="mt-1">
                  <DescriptionInput
                    className="default-input w-full"
                    name="description"
                    defaultValue={bot.description}
                  />
                </div>
                <p className="input-description">
                  Optionally write description.
                </p>
              </div>
              {/* backstory */}
              <div>
                <label className="default-label" htmlFor="backstory">
                  Backstory
                </label>
                <div className="mt-1">
                  <BackstoryInput
                    className="default-input w-full"
                    name="backstory"
                    defaultValue={bot.backstory}
                  />
                </div>
                <p className="input-description">
                  Write the agent backstory to define its behavior.
                </p>
              </div>
              {/* model */}
              <div>
                <label className="default-label" htmlFor="model">
                  Model
                </label>
                <div className="mt-1">
                  <LanguageModelSelect
                    className="default-input w-full max-w-xs"
                    name="model"
                    defaultValue={bot.model}
                    allowedModels={allowedModels}
                  />
                </div>
                <p className="input-description">
                  The AI model to power your agent.
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            <span className="action-area-space" />
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
