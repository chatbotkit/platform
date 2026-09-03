import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import call from '@/lib/call'
import debug from '@/lib/debug'
import type { Session } from '@/lib/session.handler'

import { z } from 'zod'

const SKILLS_SH_BASE = 'https://skills.sh'

// --- Handler Names ---

export const LIST_SKILLS_HANDLER_NAME = 'listSkills' as const

// --- Schemas ---

const listSkillsSchema = z.object({
  q: z.string().optional().describe('Search query to filter skills'),
})

export type ListSkillsSchema = z.infer<typeof listSkillsSchema>

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

  const url = `${SKILLS_SH_BASE}/api/search?q=${encodeURIComponent(q)}&limit=100`

  debug('fetching skills catalogue', { url }).log(
    'api.auxiliary.skillset.ability.skillssh.list'
  )

  const response = await call(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    debug('skills catalogue fetch failed', { status: response.status }).log(
      'api.auxiliary.skillset.ability.skillssh.list'
    )

    throw new Error('Failed to fetch skills catalogue')
  }

  const data = (await response.json()) as {
    skills?: Array<{
      id: string
      name: string
      installs?: number
      source?: string
    }>
  }

  const items = (data.skills || []).map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.source || '',
    installs: skill.installs || 0,
    tags: [],
  }))

  return { items }
}

// --- Export Multi Handler ---

export default authenticatedMultiHandler({
  [LIST_SKILLS_HANDLER_NAME]: {
    schema: listSkillsSchema,
    fn: listSkills,
  },
})
