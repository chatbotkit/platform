'use server'

import { appContactActionHandler } from '@/lib/app.action'
import { z } from '@/lib/zod.schema'

import ConfigSchema from '../../config'
import { APP_NAME, CONTACT_NAMESPACE } from '../../const'
import type { Project } from '../../lib'
import { buildAssetUrls, ensureSpace, readProject } from '../../space'

/**
 * Loads a project graph along with freshly signed URLs for every asset
 * referenced by its nodes.
 *
 * @note this is the only editor operation left as a server action: the page
 * calls it during server rendering. Everything the editor triggers from the
 * browser goes through the route handlers in `../../api` so requests can run
 * concurrently.
 */
export const getProject = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    projectId: z.string(),
  }),
  async (
    _config,
    session,
    contact,
    { projectId }
  ): Promise<{ project: Project; assetUrls: Record<string, string> }> => {
    const { client, spaceId } = await ensureSpace(session, contact)

    const project = await readProject(client, spaceId, projectId)

    if (!project) {
      throw new Error('Project not found')
    }

    const assetPaths = project.nodes
      .map((node) => node.data.assetPath)
      .filter((path): path is string => Boolean(path))

    const assetUrls = await buildAssetUrls(client, spaceId, assetPaths)

    return { project, assetUrls }
  }
)
