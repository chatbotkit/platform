// @ts-check

/**
 * Wraps a hub clone in its own project. Every clone lands in a fresh blueprint
 * named after the resource it came from, so the resource is never left loose
 * outside a project and pages/new/success.jsx always has a project to send the
 * builder experience to. Mirrors what the example clone endpoint does.
 *
 * @param {(url: string, options: any) => any} fetch
 * @param {{name?: string, description?: string}} ref
 * @returns {Promise<{id: string}|null>} the blueprint, or null when it failed
 */
async function createBlueprint(fetch, ref) {
  const { name, description } = ref

  const { error, data } = await fetch(`/api/v1/blueprint/create`, {
    data: {
      name,
      description,
    },

    loadingMessage: 'Creating your project...',
    failureMessage: true,
  })

  if (error) {
    return null
  }

  return data
}

/**
 * @type {import('./index').Template}
 */
export const template = {
  templateId: 'hub',
  icon: '',
  templateName: 'Hub',
  templateDescription: 'Create a solution from the hub.',

  steps: [':disabled', '/new/hub'],

  options: {},

  values: {},

  async task({ options, fetch }) {
    const instance = options.instance

    if (!instance) {
      throw new Error('No instance selected')
    }

    const { type, ref } = instance

    switch (type) {
      case 'bot': {
        const { widget: widgetData, ...botData } = ref

        const blueprint = await createBlueprint(fetch, ref)

        if (!blueprint) {
          return
        }

        const { error: createError, data: createData } = await fetch(
          `/api/v1/bot/create`,
          {
            data: {
              blueprintId: blueprint.id,

              ...botData,
            },

            loadingMessage: 'Creating your bot...',
            failureMessage: true,
          }
        )

        if (createError) {
          return
        }

        const project = {
          createdBlueprintId: blueprint.id,
          createdBlueprintName: ref.name || 'Untitled',
        }

        if (!widgetData) {
          return {
            ...project,

            successButtonAction: `/bots/${createData.id}`,
            successButtonCaption: 'Go to bot',
          }
        }

        const { error: widgetCreateError, data: widgetCreateData } =
          await fetch(`/api/v1/integration/widget/create`, {
            data: {
              blueprintId: blueprint.id,

              botId: createData.id,

              ...widgetData,
            },

            loadingMessage: 'Creating your widget...',
            failureMessage: true,
          })

        if (widgetCreateError) {
          return
        }

        return {
          ...project,

          successButtonAction: `/integrations/widget/${widgetCreateData.id}`,
          successButtonCaption: 'Go to widget',
        }
      }

      case 'widget': {
        const blueprint = await createBlueprint(fetch, ref)

        if (!blueprint) {
          return
        }

        const { error: createError, data: createData } = await fetch(
          `/api/v1/integration/widget/create`,
          {
            method: 'POST',

            data: {
              blueprintId: blueprint.id,

              ...ref,
            },

            loadingMessage: 'Cloning widget...',
            failureMessage: true,
          }
        )

        if (createError) {
          return
        }

        return {
          createdBlueprintId: blueprint.id,
          createdBlueprintName: ref.name || 'Untitled',

          successButtonAction: `/integrations/widget/${createData.id}`,
          successButtonCaption: 'Go to widget',
        }
      }

      case 'dataset': {
        const blueprint = await createBlueprint(fetch, ref)

        if (!blueprint) {
          return
        }

        const { error: createError, data: createData } = await fetch(
          `/api/v1/dataset/create`,
          {
            method: 'POST',

            data: {
              blueprintId: blueprint.id,

              ...ref,
            },

            loadingMessage: 'Cloning dataset...',
            failureMessage: true,
          }
        )

        if (createError) {
          return
        }

        return {
          createdBlueprintId: blueprint.id,
          createdBlueprintName: ref.name || 'Untitled',

          successButtonAction: `/datasets/${createData.id}`,
          successButtonCaption: 'Go to dataset',
        }
      }

      case 'skillset': {
        const { abilities = [], ...skillsetData } = ref

        const blueprint = await createBlueprint(fetch, ref)

        if (!blueprint) {
          return
        }

        const { error: createError, data: createData } = await fetch(
          `/api/v1/skillset/create`,
          {
            method: 'POST',

            data: {
              blueprintId: blueprint.id,

              ...skillsetData,
            },

            loadingMessage: 'Cloning skillset...',
            failureMessage: true,
          }
        )

        if (createError) {
          return
        }

        for (const ability of abilities) {
          const { error: abilityCreateError } = await fetch(
            `/api/v1/skillset/${createData.id}/ability/create`,
            {
              method: 'POST',

              data: {
                name: ability.name,
                description: ability.description,
                instruction: ability.instruction,
              },

              loadingMessage: `Cloning ability "${ability.name}"...`,
              failureMessage: true,
            }
          )

          if (abilityCreateError) {
            return
          }
        }

        return {
          createdBlueprintId: blueprint.id,
          createdBlueprintName: ref.name || 'Untitled',

          successButtonAction: `/skillsets/${createData.id}`,
          successButtonCaption: 'Go to skillset',
        }
      }

      case 'blueprint': {
        const { error: cloneError, data: cloneData } = await fetch(
          `/api/v1/blueprint/${ref.id}/clone`,
          {
            method: 'POST',

            data: {},

            loadingMessage: 'Cloning blueprint...',
            failureMessage: true,
          }
        )

        if (cloneError) {
          return
        }

        return {
          createdBlueprintId: cloneData.id,
          createdBlueprintName: ref.name || 'Untitled',

          // @note the designer is a platform experience surface. The builder
          // experience never reaches it: pages/new/success.jsx redirects any
          // template that created a project to the project-scoped overview.
          successButtonAction: `/blueprints/${cloneData.id}/designer`,
          successButtonCaption: 'Continue to your blueprint',
        }
      }

      default: {
        throw new Error(`Unknown type ${type}`)
      }
    }
  },

  hidden: true, // we hide it because there is no way to select an example at this stage
}

export default template
