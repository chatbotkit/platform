import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import {
  getAbilityFunctionName,
  getAbilityFunctionParameters,
} from '@/lib/ability.function'
import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import { unpackTemplateInstruction } from '@/lib/instruction.template.unpack'
import { logEvent } from '@/lib/log'
import type { AbilityTemplateSerializableTool } from '@/lib/tool.environment'
import {
  installEnvironmentTools,
  makeEnvironmentToolSource,
  uninstallEnvironmentTools,
} from '@/lib/tool.environment'
import { fastGetUserById } from '@/lib/user.get'
import { z } from '@/lib/zod.schema'

export const installSchema = z.object({
  abilities: z.array(
    z.union([
      z.string(),
      z.object({
        name: z.string(),
        description: z.string(),
        instruction: z.string(),
      }),
    ])
  ),
  prefix: z.string().optional(),
})

export type InstallSchema = z.infer<typeof installSchema>

export const INSTALL_OPERATION_NAME = 'install'

export const uninstallSchema = z.object({
  abilities: z.array(z.string()),
  prefix: z.string().optional(),
})

export type UninstallSchema = z.infer<typeof uninstallSchema>

export const UNINSTALL_OPERATION_NAME = 'uninstall'

interface DoPackInstallParams {
  input: ActionInput
  params: ActionParams
  options: ActionOptions
}

interface PackInstallResult {
  /**
   * Whether the installation was successful.
   */
  success: boolean
  /**
   * The names of the installed tools.
   */
  tools: string[]
}

/**
 * Installs pack abilities as environment tools. Each ability in the pack is
 * unpacked and registered as a callable tool in the conversation context,
 * allowing the main bot to use them directly.
 */
async function doPackInstall({
  input,
  params,
  options,
}: DoPackInstallParams): Promise<ActionReturn> {
  debug(`do pack install`, { input, params, options }).log(
    'action.exec.pack.doPackInstall'
  )

  const user = await fastGetUserById(options.userId)

  if (!user) {
    throw new Error(`User not found`)
  }

  const { abilities, prefix } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: installSchema,
    options,
  })

  await logEvent({
    user: { id: options.userId },
    type: 'action.pack.install',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  // @note scope this pack's tools to the installing ability so a re-install
  // replaces only this pack's tools and never collides with other sources

  const source = makeEnvironmentToolSource(
    'pack',
    options.contextResources?.abilityId ??
      options.contextResources?.skillsetId ??
      'inline',
    prefix
  )

  const tools: AbilityTemplateSerializableTool[] = abilities.map((template) => {
    if (typeof template === 'string') {
      const instance = unpackTemplateInstruction(template)

      if (!instance) {
        throw new Error(`Ability template not found: ${template}`)
      }

      return {
        name: getAbilityFunctionName({
          name: [prefix, instance.name].filter(Boolean).join(' '),
        }),

        source: source,

        description: instance.description,

        inputSchema: getAbilityFunctionParameters({
          instruction: instance.instruction,
          meta: null,
        }),

        handler: 'ability-template' as const,

        options: {
          userId: user.id,
          instruction: `@${template}`,
          abilityId: options.contextResources?.abilityId,
          linkedResources: options.linkedResources,
          inlineSecrets: options.inlineSecrets,
        },
      }
    } else {
      return {
        name: getAbilityFunctionName({
          name: [prefix, template.name].filter(Boolean).join(' '),
        }),

        source: source,

        description: template.description,

        inputSchema: getAbilityFunctionParameters({
          instruction: template.instruction,
          meta: null,
        }),

        handler: 'ability-template' as const,

        options: {
          userId: user.id,
          instruction: template.instruction,
          abilityId: options.contextResources?.abilityId,
          linkedResources: options.linkedResources,
          inlineSecrets: options.inlineSecrets,
        },
      }
    }
  })

  const success = await installEnvironmentTools(tools)

  const result: PackInstallResult = {
    success,

    tools: tools.map(({ name }) => name),
  }

  debug('using result', { result }).log('action.exec.pack.doPackInstall')

  return {
    result,
  }
}

/**
 * Uninstalls pack abilities by removing matching tools from the environment.
 */
async function doPackUninstall({
  input,
  params,
  options,
}: DoPackInstallParams): Promise<ActionReturn> {
  debug('do pack uninstall', { input, params, options }).log(
    'action.exec.pack.doPackUninstall'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.pack.uninstall',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const { abilities, prefix } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: uninstallSchema,
    options,
  })

  const namesToRemove = new Set(
    abilities.map((name) =>
      getAbilityFunctionName({
        name: [prefix, name].filter(Boolean).join('_'),
      })
    )
  )

  debug('using', { namesToRemove: [...namesToRemove] }).log(
    'action.exec.pack.doPackUninstall'
  )

  const { success, removedTools } = await uninstallEnvironmentTools(
    (tool) =>
      tool.handler === 'ability-template' && namesToRemove.has(tool.name)
  )

  return {
    result: {
      success,
      tools: removedTools,
    },
  }
}

/**
 * Executes a pack action with the specified operation.
 */
export async function executePackAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug('execute pack action', { input, params, options }).log(
    'action.exec.pack.executePackAction'
  )

  let operation: typeof INSTALL_OPERATION_NAME | typeof UNINSTALL_OPERATION_NAME

  {
    switch (true) {
      case 'install' in params: {
        operation = INSTALL_OPERATION_NAME

        break
      }

      case 'activate' in params: {
        operation = INSTALL_OPERATION_NAME

        break
      }

      case 'load' in params: {
        operation = INSTALL_OPERATION_NAME

        break
      }

      case 'uninstall' in params: {
        operation = UNINSTALL_OPERATION_NAME

        break
      }

      default: {
        throw new UserInputError(`Unknown pack operation`)
      }
    }
  }

  let response: ActionReturn

  switch (operation) {
    case INSTALL_OPERATION_NAME: {
      response = await doPackInstall({ input, params, options })

      break
    }

    case UNINSTALL_OPERATION_NAME: {
      response = await doPackUninstall({ input, params, options })

      break
    }

    default: {
      assertUnreachable(operation)
    }
  }

  return response
}

/**
 * @doc Skillsets
 * @index 48
 *
 * ## Packs - Installing Multiple Abilities at Once
 *
 * A pack is a special action type that installs multiple abilities into the
 * current conversation context. When triggered, the pack unpacks each ability
 * and registers them as callable tools, allowing the main bot to use them
 * directly without a sub-agent.
 *
 * For example, ChatBotKit has over 20 different Google Drive-related tasks. By
 * combining these into one pack, you can install all those capabilities through
 * a single ability call. The bot then has direct access to each individual tool.
 *
 * ### How Packs Work
 *
 * When a pack ability is triggered, it resolves each ability in the list
 * (either from the template catalogue or inline definitions), extracts their
 * parameters, and installs them as environment tools in the conversation. The
 * main bot can then call these tools directly.
 *
 * This approach has several benefits:
 *
 * - **Reduced token usage**: Only one ability description is sent to the main
 *   bot initially, instead of dozens of individual abilities
 * - **Better organization**: Related abilities are grouped logically
 * - **Direct execution**: The main bot calls tools directly for better accuracy
 * - **Simpler bot configuration**: Attach one pack instead of many abilities
 *
 * ### Properties
 *
 * - **abilities**: Array of ability templates or inline ability definitions
 * - **prefix**: Optional prefix for installed tool names
 *
 * ### Example
 *
 * `````markdown
 * ```pack
 * abilities:
 *   - google-drive-list-files
 *   - google-drive-create-file
 *   - google-drive-delete-file
 *   - google-drive-share-file
 * ```
 * `````
 *
 * ### When to Use Packs
 *
 * Use packs when you have:
 *
 * - **Many related abilities**: Group abilities for a single service (Google Drive,
 *   Slack, your internal API) into one pack
 * - **Dynamic tool loading**: When you want to install tools on demand rather than
 *   having them all available from the start
 * - **Token budget concerns**: Reduce the number of ability descriptions sent to
 *   the main bot until they are needed
 *
 * ### Tips for Creating Effective Packs
 *
 * - **Group by service or domain**: Keep abilities that work together in the same pack
 * - **Use prefixes**: Add a prefix to avoid name collisions when installing
 *   multiple packs
 * - **Mix templates and inline**: You can combine catalogue templates with custom
 *   inline ability definitions in the same pack
 */
