import { buf2str } from '@chatbotkit-dev/buffer'

import prisma from '@/prisma/client'

import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import debug from '@/lib/debug'
import { BotInputError, UserInputError } from '@/lib/error'
import type { Session } from '@/lib/session.handler'
import {
  deleteStorageDirectory,
  downloadStorageFile,
  listStorage,
  moveStorageFile,
  storageDirectoryExists,
  uploadStorageFile,
} from '@/lib/space.storage'

import yaml from 'js-yaml'
import { z } from 'zod'

// --- Path and Handler Constants ---

export const SKILL_API_PATH =
  '/api/auxiliary/skillset/ability/space/skill' as const

export const LIST_SKILLS_HANDLER_NAME = 'listSkills' as const

export const READ_SKILLS_HANDLER_NAME = 'readSkills' as const

export const CREATE_SKILL_HANDLER_NAME = 'createSkill' as const

export const DELETE_SKILL_HANDLER_NAME = 'deleteSkill' as const

export const MOVE_SKILL_HANDLER_NAME = 'moveSkill' as const

const SKILL_DIRECTORIES = ['.skills', '.github/skills', '.claude/skills']

const SKILL_FILENAME = 'SKILL.md'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// --- Schemas ---

const listSkillsSchema = z.object({
  spaceId: z
    .string()
    .min(1)
    .describe('The ID of the space to list skills from'),
})

const readSkillsSchema = z.object({
  spaceId: z
    .string()
    .min(1)
    .describe('The ID of the space to read skills from'),
  paths: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      "One or more paths to read. Each is typically a SKILL.md returned by the list ability, but can also be any supporting file within that skill's folder (such as references, scripts, or templates) that the SKILL.md links to."
    ),
})

const createSkillSchema = z.object({
  spaceId: z
    .string()
    .min(1)
    .describe('The ID of the space to create the skill(s) in'),
  skills: z
    .array(
      z.object({
        slug: z
          .string()
          .min(1)
          .regex(SLUG_REGEX, 'Must be a lowercase kebab-case slug')
          .describe(
            'The slug for the skill, used as the directory name under .skills/'
          ),
        name: z.string().min(1).describe('The display name of the skill'),
        description: z
          .string()
          .min(1)
          .describe('A short description of what the skill does'),
        content: z.string().describe('The main body content of the skill'),
      })
    )
    .min(1)
    .describe('One or more skills to create'),
})

const deleteSkillsSchema = z.object({
  spaceId: z
    .string()
    .min(1)
    .describe('The ID of the space to delete the skill(s) from'),
  slugs: z
    .array(
      z
        .string()
        .min(1)
        .regex(SLUG_REGEX, 'Must be a lowercase kebab-case slug')
        .describe(
          'The slug of the skill to delete, matching its directory name under .skills/'
        )
    )
    .min(1)
    .describe('One or more skill slugs to delete'),
})

const moveSkillsSchema = z.object({
  spaceId: z
    .string()
    .min(1)
    .describe('The ID of the space to rename the skill(s) in'),
  skills: z
    .array(
      z.object({
        from: z
          .string()
          .min(1)
          .regex(SLUG_REGEX, 'Must be a lowercase kebab-case slug')
          .describe(
            'The current slug of the skill to rename, matching its directory name under .skills/'
          ),
        to: z
          .string()
          .min(1)
          .regex(SLUG_REGEX, 'Must be a lowercase kebab-case slug')
          .describe('The new slug for the skill'),
      })
    )
    .min(1)
    .describe('One or more skill rename operations'),
})

export type ListSkillsSchema = z.infer<typeof listSkillsSchema>

export type ReadSkillSchema = z.infer<typeof readSkillsSchema>

export type CreateSkillSchema = z.infer<typeof createSkillSchema>

export type DeleteSkillSchema = z.infer<typeof deleteSkillsSchema>

export type MoveSkillSchema = z.infer<typeof moveSkillsSchema>

// --- Helpers ---

async function getAuthorizedSpace(session: Session, spaceId: string) {
  const space = await prisma.space.findUniqueByIdentifier(
    session.user,
    spaceId,
    {
      select: {
        id: true,
        userId: true,
      },
    }
  )

  if (!space) {
    throw new UserInputError('Space not found')
  }

  if (space.userId !== session.user.id) {
    throw new UserInputError('Not authorized to access this space')
  }

  return space
}

async function readFileContent(spaceId: string, path: string): Promise<string> {
  const file = await downloadStorageFile({ spaceId, path })

  if (!file.body) {
    return ''
  }

  const buf = await file.body.arrayBuffer()

  return buf2str(buf)
}

function parseFrontmatter(content: string): {
  data: Record<string, unknown>
  body: string
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)

  if (!match) {
    return { data: {}, body: content }
  }

  try {
    const data = (yaml.load(match[1]) as Record<string, unknown>) || {}

    return { data, body: match[2] }
  } catch {
    return { data: {}, body: content }
  }
}

// --- Handlers ---

async function listSkills(
  session: Session,
  parameters: z.infer<typeof listSkillsSchema>,
  _headers: Headers
) {
  debug('list skills', { parameters }).log(
    'api.auxiliary.skillset.ability.space.skill.listSkills'
  )

  const { spaceId } = parameters

  const space = await getAuthorizedSpace(session, spaceId)

  const skills: Array<{ path: string; name: string; description: string }> = []

  for (const dir of SKILL_DIRECTORIES) {
    let items

    try {
      const result = await listStorage({
        spaceId: space.id,
        path: dir,
        recursive: true,
      })

      items = result.items
    } catch {
      // @note directory does not exist or is not accessible, skip
      continue
    }

    const skillFiles = items.filter(
      (item) =>
        !item.isDirectory &&
        (item.path.endsWith(`/${SKILL_FILENAME}`) ||
          item.path === SKILL_FILENAME)
    )

    for (const file of skillFiles) {
      const fullPath = `${dir}/${file.path}`

      try {
        const content = await readFileContent(space.id, fullPath)
        const { data } = parseFrontmatter(content)

        skills.push({
          path: fullPath,
          name: typeof data.name === 'string' ? data.name : '',
          description:
            typeof data.description === 'string' ? data.description : '',
        })
      } catch {
        // @note skip unreadable or unparseable skill files
      }
    }
  }

  return {
    skills,
  }
}

async function readSkills(
  session: Session,
  parameters: z.infer<typeof readSkillsSchema>,
  _headers: Headers
) {
  debug('read skills', { parameters }).log(
    'api.auxiliary.skillset.ability.space.skill.readSkills'
  )

  const { spaceId, paths } = parameters

  const space = await getAuthorizedSpace(session, spaceId)

  const items = await Promise.all(
    paths.map(async (path) => {
      try {
        const content = await readFileContent(space.id, path)

        return { path, content }
      } catch (e: unknown) {
        // @note a missing S3 object means the bot asked for a path that does
        // not exist (e.g. a hallucinated path or a link the SKILL.md does not
        // actually point to). Surface it as bot input rather than an unexpected
        // exception so it is returned to the agent and kept out of Sentry.
        if ((e as { name?: string }).name === 'NoSuchKey') {
          throw new BotInputError(`Skill file not found: ${path}`)
        }

        throw e
      }
    })
  )

  return {
    items,
  }
}

async function createSkill(
  session: Session,
  parameters: z.infer<typeof createSkillSchema>,
  _headers: Headers
) {
  debug('create skill', { parameters }).log(
    'api.auxiliary.skillset.ability.space.skill.createSkill'
  )

  const { spaceId, skills } = parameters

  const space = await getAuthorizedSpace(session, spaceId)

  const items = await Promise.all(
    skills.map(async ({ slug, name, description, content }) => {
      const path = `.skills/${slug}/${SKILL_FILENAME}`

      const { data: existingFrontmatter, body } = parseFrontmatter(content)

      const frontmatter = { ...existingFrontmatter, name, description }

      const fileContent = `---\n${yaml.dump(frontmatter).trimEnd()}\n---\n${body}`

      await uploadStorageFile({
        spaceId: space.id,
        path,
        body: fileContent,
        contentType: 'text/markdown',
      })

      return { path, slug, name, description }
    })
  )

  return { items }
}

async function deleteSkill(
  session: Session,
  parameters: z.infer<typeof deleteSkillsSchema>,
  _headers: Headers
) {
  debug('delete skill', { parameters }).log(
    'api.auxiliary.skillset.ability.space.skill.deleteSkill'
  )

  const { spaceId, slugs } = parameters

  const space = await getAuthorizedSpace(session, spaceId)

  const items = await Promise.all(
    slugs.map(async (slug) => {
      const path = `.skills/${slug}`

      const exists = await storageDirectoryExists({ spaceId: space.id, path })

      if (!exists) {
        throw new UserInputError(`Skill not found: ${slug}`)
      }

      await deleteStorageDirectory({ spaceId: space.id, path })

      return { slug, path }
    })
  )

  return { items }
}

async function moveSkill(
  session: Session,
  parameters: z.infer<typeof moveSkillsSchema>,
  _headers: Headers
) {
  debug('move skill', { parameters }).log(
    'api.auxiliary.skillset.ability.space.skill.moveSkill'
  )

  const { spaceId, skills } = parameters

  const space = await getAuthorizedSpace(session, spaceId)

  const items = await Promise.all(
    skills.map(async ({ from, to }) => {
      const fromPath = `.skills/${from}`
      const toPath = `.skills/${to}`

      if (from === to) {
        throw new UserInputError(
          `Source and destination slugs must differ: ${from}`
        )
      }

      const { items: contents } = await listStorage({
        spaceId: space.id,
        path: fromPath,
        recursive: true,
      })

      const files = contents.filter((item) => !item.isDirectory)

      if (files.length === 0) {
        throw new UserInputError(`Skill not found: ${from}`)
      }

      const destinationExists = await storageDirectoryExists({
        spaceId: space.id,
        path: toPath,
      })

      if (destinationExists) {
        throw new UserInputError(`A skill already exists at: ${to}`)
      }

      await Promise.all(
        files.map((file) =>
          moveStorageFile({
            spaceId: space.id,
            path: `${fromPath}/${file.path}`,
            destinationPath: `${toPath}/${file.path}`,
          })
        )
      )

      return { from, to, fromPath, toPath }
    })
  )

  return { items }
}

export default authenticatedMultiHandler({
  [LIST_SKILLS_HANDLER_NAME]: {
    schema: listSkillsSchema,
    fn: listSkills,
  },
  [READ_SKILLS_HANDLER_NAME]: {
    schema: readSkillsSchema,
    fn: readSkills,
  },
  [CREATE_SKILL_HANDLER_NAME]: {
    schema: createSkillSchema,
    fn: createSkill,
  },
  [DELETE_SKILL_HANDLER_NAME]: {
    schema: deleteSkillsSchema,
    fn: deleteSkill,
  },
  [MOVE_SKILL_HANDLER_NAME]: {
    schema: moveSkillsSchema,
    fn: moveSkill,
  },
})
