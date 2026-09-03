import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import prisma from '@/prisma/client'
import { type Ability, ResourceState } from '@/prisma/types'

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
import { getExtendedDescription } from '@/lib/description.parse'
import { UserInputError } from '@/lib/error'
import { logEvent } from '@/lib/log'
import { getActiveSkillsetAbilities } from '@/lib/skillset.abilities'
import { canUseSkillset } from '@/lib/skillset.access'
import type { AbilitySerializableTool } from '@/lib/tool.environment'
import {
  installEnvironmentTools,
  makeEnvironmentToolSource,
  uninstallEnvironmentTools,
} from '@/lib/tool.environment'
import { fastGetUserById } from '@/lib/user.get'
import { z } from '@/lib/zod.schema'

// @see data/abilities/catalogue/cbk.skillset.ts for ability definitions related
// to these schemas

export const installSchema = z.object({
  skillsetId: z.string(),
  prefix: z.string().optional(),
})

export type InstallSchema = z.infer<typeof installSchema>

export const INSTALL_OPERATION_NAME = 'install'

export const uninstallSchema = z.object({
  skillsetId: z.string(),
})

export type UninstallSchema = z.infer<typeof uninstallSchema>

export const UNINSTALL_OPERATION_NAME = 'uninstall'

interface DoSkillsetInstallParams {
  input: string
  params: ActionParams
  options: ActionOptions
}

interface SkillsetInstallResult {
  /**
   * Whether the installation was successful.
   */
  success: boolean
  /**
   * The names of the installed tools.
   */
  tools: string[]
  /**
   * The extended description of the skillset (after the --- separator).
   * This is returned when the skillset has additional context that should be
   * injected into the conversation after installation, providing richer detail
   * than what appears in the backstory listing.
   */
  extendedDescription?: string
}

/**
 * Installs a skillset and its abilities as environment tools
 */
export async function doSkillsetInstall({
  input,
  params,
  options,
}: DoSkillsetInstallParams): Promise<ActionReturn> {
  debug('do skillset install', { input, params, options }).log(
    'action.exec.skillset.doSkillsetInstall'
  )

  const user = await fastGetUserById(options.userId)

  if (!user) {
    throw new Error(`User not found`)
  }

  await logEvent({
    user: { id: options.userId },
    type: 'action.skillset.install',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: params,
  })

  const { skillsetId, prefix } = getConfigBySchema({
    input,
    params,
    initial: {
      skillsetId: input,
    },
    schema: installSchema,
    options,
  })

  debug('using', { skillsetId, prefix }).log(
    'action.exec.skillset.doSkillsetActivate'
  )

  const skillset = await prisma.skillset.findUniqueByIdentifier(
    user,
    skillsetId,
    {
      include: {
        abilities: true,
      },
    }
  )

  if (!skillset) {
    throw new UserInputError(`Skillset not found`)
  }

  if ((await canUseSkillset(options.userId, skillset)) === false) {
    throw new UserInputError(`Cannot use skillset`)
  }

  // @note a disabled skillset is kept/configured but cannot be installed -
  // mirrors the engine's getFunctions gate so tools installed via this path
  // honour the same lifecycle state. Blacklist on `=== disabled` (not
  // `!== enabled`) for robustness, matching action.exec.blueprint.
  if (skillset.state === ResourceState.disabled) {
    throw new UserInputError(`Skillset is disabled`)
  }

  // @note scope this skillset's tools so a re-install replaces only its own
  // tools and never evicts a same-named tool installed from another source

  const source = makeEnvironmentToolSource('skillset', skillset.id, prefix)

  const tools: AbilitySerializableTool[] = getActiveSkillsetAbilities(
    skillset
  ).map((ability: Ability) => {
    return {
      ...ability,

      name: getAbilityFunctionName({
        name: [prefix, `${ability.name}`].filter(Boolean).join(' '),
      }),

      source: source,

      inputSchema: getAbilityFunctionParameters(ability),

      options: {
        userId: skillset.userId, // @note use the skillset owner's user ID

        skillsetId: skillset.id,
        abilityId: ability.id,
      },

      handler: 'ability',
    }
  })

  const success = await installEnvironmentTools(tools)

  // @note we extract the extended description (after the --- separator) from
  // the skillset description to provide additional context now that the
  // skillset is installed - this supplements the short description that was
  // shown in the backstory listing

  const extendedDescription = getExtendedDescription(skillset.description)

  const result: SkillsetInstallResult = {
    success,

    tools: tools.map(({ name }) => name),

    ...(extendedDescription && { extendedDescription }),
  }

  debug('using result', { result }).log(
    'action.exec.skillset.doSkillsetActivate'
  )

  return {
    result,
  }
}

/**
 * Uninstalls a skillset by removing its tools from the environment.
 */
export async function doSkillsetUninstall({
  input,
  params,
  options,
}: DoSkillsetInstallParams): Promise<ActionReturn> {
  debug('do skillset uninstall', { input, params, options }).log(
    'action.exec.skillset.doSkillsetUninstall'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.skillset.uninstall',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: params,
  })

  const { skillsetId } = getConfigBySchema({
    input,
    params,
    initial: {
      skillsetId: input,
    },
    schema: uninstallSchema,
    options,
  })

  debug('using', { skillsetId }).log('action.exec.skillset.doSkillsetUninstall')

  const { success, removedTools } = await uninstallEnvironmentTools(
    (tool) =>
      tool.handler === 'ability' && tool.options.skillsetId === skillsetId
  )

  return {
    result: {
      success,
      tools: removedTools,
    },
  }
}

/**
 * Executes a skillset action with the specified operation.
 */
export async function executeSkillsetAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug('execute skillset action', { input, params, options }).log(
    'action.exec.skillset.executeSkillsetAction'
  )

  let operation: typeof INSTALL_OPERATION_NAME | typeof UNINSTALL_OPERATION_NAME

  {
    switch (true) {
      case 'install' in params: {
        operation = 'install'

        break
      }

      case 'activate' in params: {
        operation = 'install'

        break
      }

      case 'load' in params: {
        operation = 'install'

        break
      }

      case 'uninstall' in params: {
        operation = 'uninstall'

        break
      }

      default: {
        throw new UserInputError(`Unknown skillset operation`)
      }
    }
  }

  let response: ActionReturn

  switch (operation) {
    case 'install': {
      response = await doSkillsetInstall({ input, params, options })

      break
    }

    case 'uninstall': {
      response = await doSkillsetUninstall({ input, params, options })

      break
    }

    default: {
      assertUnreachable(operation)
    }
  }

  return response
}
