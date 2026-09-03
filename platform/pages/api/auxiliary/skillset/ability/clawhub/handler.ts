import prisma from '@/prisma/client'

import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import call from '@/lib/call'
import debug from '@/lib/debug'
import type { Session } from '@/lib/session.handler'
import { uploadStorageFile } from '@/lib/space.storage'

import { z } from 'zod'

const CLAWHUB_BASE = 'https://clawhub.ai'

// --- Handler Names ---

export const LIST_SKILLS_HANDLER_NAME = 'listSkills' as const
export const READ_SKILL_HANDLER_NAME = 'readSkill' as const
export const INSTALL_TO_SPACE_HANDLER_NAME = 'installToSpace' as const

// --- Schemas ---

const listSkillsSchema = z.object({
  q: z.string().optional().describe('Search query to filter skills'),
})

export type ListSkillsSchema = z.infer<typeof listSkillsSchema>

const readSkillSchema = z.object({
  slug: z.string().min(1).describe('The skill slug to read'),
  path: z
    .string()
    .optional()
    .describe('File path within the skill, defaults to SKILL.md'),
})

export type ReadSkillSchema = z.infer<typeof readSkillSchema>

const installToSpaceSchema = z.object({
  spaceId: z
    .string()
    .min(1)
    .describe('The ID or alias of the space to install the skill into'),
  slug: z.string().min(1).describe('The skill slug to install'),
})

export type InstallToSpaceSchema = z.infer<typeof installToSpaceSchema>

// --- Handlers ---

async function listSkills(
  _session: Session,
  parameters: ListSkillsSchema,
  _headers: Headers
) {
  const q = (parameters.q ?? '').trim()

  if (!q) {
    return { items: [] }
  }

  const url = `${CLAWHUB_BASE}/api/v1/search?q=${encodeURIComponent(q)}&limit=50&nonSuspiciousOnly=true`

  debug('fetching ClawHub skills catalogue', { url }).log(
    'api.auxiliary.skillset.ability.clawhub.list'
  )

  const response = await call(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    debug('ClawHub catalogue fetch failed', { status: response.status }).log(
      'api.auxiliary.skillset.ability.clawhub.list'
    )

    throw new Error('Failed to fetch skills catalogue')
  }

  const data = (await response.json()) as {
    results?: Array<{
      slug: string
      displayName: string
      summary?: string
    }>
  }

  const items = (data.results || []).map((result) => ({
    id: result.slug,
    name: result.displayName,
    description: result.summary || '',
    installs: 0,
    tags: [],
  }))

  return { items }
}

async function readSkill(
  _session: Session,
  parameters: ReadSkillSchema,
  _headers: Headers
) {
  const { slug, path = 'SKILL.md' } = parameters

  const url = `${CLAWHUB_BASE}/api/v1/skills/${encodeURIComponent(slug)}/file?path=${encodeURIComponent(path)}`

  debug('fetching ClawHub skill file', { url }).log(
    'api.auxiliary.skillset.ability.clawhub.list'
  )

  const response = await call(url, {
    method: 'GET',
    headers: {
      Accept: 'text/plain',
    },
  })

  if (!response.ok) {
    debug('ClawHub skill file fetch failed', { status: response.status }).log(
      'api.auxiliary.skillset.ability.clawhub.list'
    )

    throw new Error('Failed to fetch skill file')
  }

  const content = await response.text()

  return { content }
}

async function installToSpace(
  session: Session,
  parameters: InstallToSpaceSchema,
  _headers: Headers
) {
  const { spaceId, slug } = parameters

  const space = await prisma.space.findUniqueByIdentifier(
    session.user,
    spaceId,
    {
      select: { id: true, userId: true },
    }
  )

  if (!space) {
    throw new Error('Space not found')
  }

  if (space.userId !== session.user.id) {
    throw new Error('Not authorized to install skills to this space')
  }

  const url = `${CLAWHUB_BASE}/api/v1/skills/${encodeURIComponent(slug)}/file?path=${encodeURIComponent('SKILL.md')}`

  debug('fetching ClawHub skill for install', { url }).log(
    'api.auxiliary.skillset.ability.clawhub.install'
  )

  const response = await call(url, {
    method: 'GET',
    headers: {
      Accept: 'text/plain',
    },
  })

  if (!response.ok) {
    debug('ClawHub skill install fetch failed', {
      status: response.status,
    }).log('api.auxiliary.skillset.ability.clawhub.install')

    throw new Error('Failed to fetch skill content from ClawHub')
  }

  const content = await response.text()
  const path = `.skills/${slug}/SKILL.md`

  await uploadStorageFile({
    spaceId: space.id,
    path,
    body: Buffer.from(content, 'utf-8'),
    contentType: 'text/markdown',
  })

  return { path }
}

// --- Export Multi Handler ---

export default authenticatedMultiHandler({
  [LIST_SKILLS_HANDLER_NAME]: {
    schema: listSkillsSchema,
    fn: listSkills,
  },
  [READ_SKILL_HANDLER_NAME]: {
    schema: readSkillSchema,
    fn: readSkill,
  },
  [INSTALL_TO_SPACE_HANDLER_NAME]: {
    schema: installToSpaceSchema,
    fn: installToSpace,
  },
})
