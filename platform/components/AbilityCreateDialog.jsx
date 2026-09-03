'use client'

import { useState } from 'react'

import { SecretKind } from '@/prisma/enums'

import { findSecretTemplate, getSecretTemplateKey } from '@/lib/ability.secret'
import { canAuthenticateSecret } from '@/lib/secret.authenticate'
import { joinWithAnd } from '@/lib/string'

import AbilityTemplateBrowser, {
  getTemplateRequirements,
} from '@/components/AbilityTemplateBrowser'

import useAbilityTemplates from '@/hooks/useAbilityTemplates'
import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'
import useProjectScope from '@/hooks/useProjectScope'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'
import useSecretTemplates from '@/hooks/useSecretTemplates'

import pluralize from 'pluralize'

/**
 * The distinct secret templates a selection needs, deduplicated - a handful of
 * Gmail abilities all want the one Google Mail secret.
 */
function getRequiredSecretTemplates(templates, secretTemplates) {
  const required = new Map()

  for (const { secret } of templates) {
    const secretTemplate = findSecretTemplate(secret, secretTemplates)

    if (secretTemplate) {
      required.set(secretTemplate.template, secretTemplate)
    }
  }

  return [...required.values()]
}

/**
 * Templates carrying a requirement we cannot resolve - a file, bot or space to
 * pick, or a secret the catalogue has no template for.
 */
function getTemplatesNeedingSetup(templates, secretTemplates) {
  return templates.filter((template) => {
    return getTemplateRequirements(template).some((requirement) => {
      if (requirement !== 'secret') {
        return true
      }

      return !findSecretTemplate(template.secret, secretTemplates)
    })
  })
}

// @note a personal secret is connected by each contact when they first use the
// ability, so it is never the owner's to finish. Only a shared one is: an oauth
// secret gets authenticated, anything else gets a value pasted in.

function isPerContact({ kind }) {
  return kind === SecretKind.personal
}

function needsValue(secret) {
  return !isPerContact(secret) && !canAuthenticateSecret(secret)
}

/**
 * What the owner has left to do to these secrets, naming them.
 */
function getSecretsTodo(secrets) {
  const authenticate = secrets
    .filter(canAuthenticateSecret)
    .map(({ name }) => name)

  const fill = secrets.filter(needsValue).map(({ name }) => name)

  return [
    ...(authenticate.length
      ? [`authenticate ${joinWithAnd(authenticate)}`]
      : []),
    ...(fill.length ? [`add a value to ${joinWithAnd(fill)}`] : []),
  ]
}

function getAddedMessage(count, createdSecrets) {
  const added = `${count} ${pluralize('ability', count)} added.`

  const todo = getSecretsTodo(createdSecrets)

  if (!todo.length) {
    return added
  }

  return `${added} Now ${joinWithAnd(todo)}.`
}

function AbilityCreateDialog({ onBlank }) {
  const { templates, loading } = useAbilityTemplates()

  const { secretTemplates } = useSecretTemplates()

  const [selected, setSelected] = useState([])

  function handleSelect(template) {
    setSelected((selected) => {
      if (selected.some(({ id }) => id === template.id)) {
        return selected.filter(({ id }) => id !== template.id)
      }

      return [...selected, template]
    })
  }

  const requiredSecrets = getRequiredSecretTemplates(selected, secretTemplates)

  const needingSetup = getTemplatesNeedingSetup(selected, secretTemplates)

  const ownerTodo = getSecretsTodo(requiredSecrets)

  const perContactSecrets = requiredSecrets.filter(isPerContact)

  return (
    <div className="space-y-4 max-h-[560px] h-screen flex flex-col">
      {/* @note the popup collects its actions from the surrounding form, so the
      selection travels with it */}
      <input type="hidden" name="templates" value={JSON.stringify(selected)} />
      <AbilityTemplateBrowser
        className="flex-1"
        templates={templates}
        loading={loading}
        selectedIds={selected.map(({ id }) => id)}
        onSelect={handleSelect}
        grouped={true}
        requirements={true}
      />
      <div className="space-y-1">
        {requiredSecrets.length ? (
          <p className="text-sm">
            {pluralize('Secret', requiredSecrets.length)} needed:{' '}
            {joinWithAnd(requiredSecrets.map(({ name }) => name))}. Reused if
            this project already has{' '}
            {requiredSecrets.length === 1 ? 'it' : 'them'}, otherwise created
            and linked.
            {ownerTodo.length ? ` You then ${joinWithAnd(ownerTodo)}.` : ''}
            {perContactSecrets.length
              ? ` Your users connect their own ${joinWithAnd(
                  perContactSecrets.map(({ name }) => name)
                )} ${pluralize('account', perContactSecrets.length)}.`
              : ''}
          </p>
        ) : null}
        {needingSetup.length ? (
          <p className="text-sm">
            {needingSetup.length === 1
              ? '1 selected ability also needs'
              : `${needingSetup.length} selected abilities also need`}{' '}
            a resource only you can pick - a file, bot or space. Add now and
            link it from the ability page, or use Customize to set it up first.
          </p>
        ) : null}
        <p className="text-sm">
          {selected.length ? (
            <>
              {selected.length} {pluralize('ability', selected.length)}{' '}
              selected.{' '}
              <button
                type="button"
                className="default-link"
                onClick={() => setSelected([])}
              >
                Clear
              </button>
            </>
          ) : (
            <>
              Select one or more abilities to add.{' '}
              <button type="button" className="default-link" onClick={onBlank}>
                Or start from a blank ability
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

/**
 * Add abilities to a skillset straight from the catalogue.
 *
 * Picking templates creates the abilities in place, so the common case never
 * leaves the skillset page. Customize and blank both fall back to the full
 * ability form for anyone who wants to write one by hand.
 */
export default function useAbilityCreateDialog({
  skillsetId,
  blueprintId,
  onCreate,
}) {
  const router = useRouter()

  const { scope } = useProjectScope()

  const scopeCreateData = useScopedCreateData()

  const { secretTemplates } = useSecretTemplates()

  const { popup, openPopup, closePopup, setDisabled } = usePopup()

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  // @note everything we create here belongs to the skillset, so it belongs to
  // the skillset's blueprint - not to whichever project happens to be selected.
  // Only when the skillset has no blueprint do we fall back to the scope, which
  // is what scopeCreateData does with an untouched payload.

  const targetBlueprintId = blueprintId ?? scope?.id ?? null

  function withBlueprint(data) {
    return scopeCreateData(blueprintId ? { ...data, blueprintId } : data)
  }

  function parseSelected(data) {
    try {
      return JSON.parse(data?.templates || '[]')
    } catch {
      return []
    }
  }

  /**
   * Resolves the secrets a selection needs into ids, reusing the ones the
   * skillset's blueprint already has and creating the rest from their platform
   * template.
   *
   * Returns the ids keyed by secret template, plus the ones we had to create so
   * the caller can say what is left to do to them.
   */
  async function resolveSecrets(selected) {
    const required = getRequiredSecretTemplates(selected, secretTemplates)

    const secretIds = new Map()

    if (!required.length) {
      return { secretIds, created: [] }
    }

    // @note look where a new one would land, or we would reuse a secret from
    // one blueprint while creating the rest in another

    const { error, data } = await fetch(
      `/api/v1/secret/list${targetBlueprintId ? `?blueprintId=${targetBlueprintId}` : ''}`
    )

    if (!error) {
      const existing = (data?.items || []).filter((secret) => {
        return (secret.blueprintId ?? null) === targetBlueprintId
      })

      for (const { template, name } of required) {
        const match = existing.find((secret) => secret.name === name)

        if (match) {
          secretIds.set(template, match.id)
        }
      }
    }

    const created = []

    for (const secretTemplate of required) {
      const { template, name, description, type, kind, config } = secretTemplate

      if (secretIds.has(template)) {
        continue
      }

      // @note created unfinished on purpose - we can wire the ability up, but
      // only the user can authorize an oauth secret or supply a plain value.
      // A personal secret is rejected outright if it carries one.

      const { error, data } = await fetch('/api/v1/secret/create', {
        data: withBlueprint({
          name,
          description,

          type,
          kind,
          config,

          ...(kind === SecretKind.personal ? {} : { value: '' }),
        }),
      })

      if (error) {
        continue
      }

      secretIds.set(template, data.id)

      created.push(secretTemplate)
    }

    return { secretIds, created }
  }

  function gotoAbilityForm(templateId) {
    closePopup()

    // @note `none` keeps the form from auto-opening its own template dialog
    router.push(
      `/skillsets/${skillsetId}/abilities/new?template=${templateId || 'none'}`
    )
  }

  async function handleAdd(data) {
    const selected = parseSelected(data)

    if (!selected.length) {
      return
    }

    setDisabled(true)

    try {
      const { secretIds, created: createdSecrets } =
        await resolveSecrets(selected)

      const created = []

      for (const template of selected) {
        const { name, description, instruction } = template

        const secretId = secretIds.get(getSecretTemplateKey(template.secret))

        const last = created.length === selected.length - 1

        const { error, data } = await fetch(
          `/api/v1/skillset/${skillsetId}/ability/create`,
          {
            data: withBlueprint({
              name,
              description,
              instruction,

              ...(secretId ? { linkedSecretId: secretId } : {}),
            }),

            successMessage: last
              ? getAddedMessage(selected.length, createdSecrets)
              : `${created.length + 1} of ${selected.length} abilities added.`,
          }
        )

        if (error) {
          break
        }

        created.push({
          id: data.id,

          name,
          description,
          instruction,

          linkedSecretId: secretId,

          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }

      if (created.length) {
        onCreate?.(created)

        closePopup()
      }
    } finally {
      setDisabled(false)
    }
  }

  function open() {
    openPopup(<AbilityCreateDialog onBlank={() => gotoAbilityForm(null)} />, {
      title: 'Add Ability',
      description:
        'Pick one or more abilities from the catalogue to add them to this skillset, or customize one in the full editor first.',
      // @note the catalogue browses by provider, which needs the room
      dialogClassName: 'sm:max-w-4xl',
      // @note a stray click outside would throw away a selection built up across
      // several providers, so this one closes only on Cancel
      closePopupOnClickOutside: false,
      actions: {
        Customize: {
          fn: (data) => gotoAbilityForm(parseSelected(data)[0]?.id),
        },

        Add: {
          default: true,

          fn: handleAdd,
        },
      },
    })
  }

  return [popup, open]
}
