import type { Session } from 'next-auth'

import { buildContact } from '@/lib/app.contact'
import { getSessionClient } from '@/lib/cbk.sdk'
import fetch from '@/lib/fetch'

import { APP_NAME, CONTACT_NAMESPACE, PROJECTS_PREFIX } from './const'
import type { Project } from './lib'
import { projectFilePath } from './lib'

/**
 * @file Server-only helpers shared across the app's server actions. This module
 * is never imported by client components, so it may use server libraries.
 */

export type Client = Awaited<ReturnType<typeof getSessionClient>>

interface MinimalContact {
  id: string
}

interface SpaceRecord {
  id: string
  contactId?: string | null
}

interface StorageListItem {
  path: string
  size: number
  updatedAt: number
  isDirectory: boolean
}

/**
 * Computes the deterministic space alias for a contact. We use the app id
 * followed by the contact fingerprint so the per-user space can always be
 * referenced without first knowing its id. The fingerprint is re-derived from
 * the session the same way `ensureContact` derives it.
 */
export async function spaceAlias(session: Session): Promise<string> {
  const { fingerprint } = await buildContact({
    namespace: CONTACT_NAMESPACE,
    session,
    app: APP_NAME,
  })

  return `${APP_NAME}-${fingerprint}`
}

/**
 * Returns the user's space for this app, creating it (and associating it with
 * the contact) on first use. The space is looked up by its alias so we never
 * need to persist its id anywhere.
 */
export async function ensureSpace(
  session: Session,
  contact: MinimalContact
): Promise<{ client: Client; spaceId: string }> {
  const client = await getSessionClient(session)

  const alias = await spaceAlias(session)

  let space: SpaceRecord | undefined

  try {
    space = await client.clientFetch<SpaceRecord, undefined>(
      `/api/v1/space/@${alias}/fetch`
    )
  } catch {
    // @note a missing space throws - fall through to creation below
    space = undefined
  }

  if (!space) {
    space = await client.space.create({
      alias,
      name: 'Media Graph',
      description: 'Media graph projects created with the Media Graph app.',
      contactId: contact.id,
    })
  }

  return { client, spaceId: space.id }
}

/** Reads and parses a project graph file. Returns `null` when it is missing. */
export async function readProject(
  client: Client,
  spaceId: string,
  projectId: string
): Promise<Project | null> {
  try {
    const { url } = await client.space.storage.download(
      spaceId,
      projectFilePath(projectId)
    )

    const response = await fetch(url)

    if (!response.ok) {
      return null
    }

    return (await response.json()) as Project
  } catch {
    return null
  }
}

/** Writes a project graph file by ingesting an inline data URL. */
export async function writeProject(
  client: Client,
  spaceId: string,
  project: Project
): Promise<void> {
  const json = JSON.stringify(project)

  const dataUrl = `data:application/json;base64,${Buffer.from(json).toString(
    'base64'
  )}`

  await client.space.storage.upload(spaceId, projectFilePath(project.id), {
    file: dataUrl,
  })
}

/**
 * Lists the project ids stored in the space. The storage list returns paths
 * relative to the listed directory, so we take the trailing folder segment.
 */
export async function listProjectIds(
  client: Client,
  spaceId: string
): Promise<string[]> {
  try {
    const data = await client.space.storage.list(spaceId, PROJECTS_PREFIX)

    return (data.items as StorageListItem[])
      .filter((item) => item.isDirectory)
      .map((item) => item.path.replace(/\/+$/, '').split('/').pop() || '')
      .filter(Boolean)
  } catch {
    // @note the projects directory does not exist until the first project is
    // created, in which case listing returns a not-found error
    return []
  }
}
