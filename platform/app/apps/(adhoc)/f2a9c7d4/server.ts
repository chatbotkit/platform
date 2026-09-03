'use server'

import { randomUUID } from 'crypto'

import { appContactActionHandler } from '@/lib/app.action'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import { APP_NAME, CONTACT_NAMESPACE } from './const'
import type { Project, ProjectSummary } from './lib'
import { projectDir } from './lib'
import { ensureSpace, listProjectIds, readProject, writeProject } from './space'

/**
 * Lists every project (each a folder in the user's space) together with a
 * lightweight summary read from its project file.
 */
export const listProjects = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({}),
  async (_config, session, contact): Promise<{ projects: ProjectSummary[] }> => {
    const { client, spaceId } = await ensureSpace(session, contact)

    const ids = await listProjectIds(client, spaceId)

    const loaded = await Promise.all(
      ids.map((id) => readProject(client, spaceId, id))
    )

    const projects: ProjectSummary[] = []

    for (const project of loaded) {
      if (!project) {
        continue
      }

      projects.push({
        id: project.id,
        name: project.name,
        description: project.description,
        nodeCount: project.nodes?.length ?? 0,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })
    }

    projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    return { projects }
  }
)

/** Creates a new, empty project folder with a fresh project file. */
export const createProject = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
  async (
    _config,
    session,
    contact,
    { name, description }
  ): Promise<{ id: string }> => {
    const { client, spaceId } = await ensureSpace(session, contact)

    const now = new Date().toISOString()

    const project: Project = {
      id: randomUUID(),
      name,
      description,
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now,
    }

    await writeProject(client, spaceId, project)

    return { id: project.id }
  }
)

/** Updates the name/description of an existing project. */
export const updateProject = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
  }),
  async (
    _config,
    session,
    contact,
    { id, name, description }
  ): Promise<{ id: string }> => {
    const { client, spaceId } = await ensureSpace(session, contact)

    const project = await readProject(client, spaceId, id)

    if (!project) {
      throw new Error('Project not found')
    }

    await writeProject(client, spaceId, {
      ...project,
      name,
      description,
      updatedAt: new Date().toISOString(),
    })

    return { id }
  }
)

/** Deletes a project folder and everything inside it (graph + assets). */
export const deleteProject = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, contact, { id }): Promise<{ id: string }> => {
    const { client, spaceId } = await ensureSpace(session, contact)

    await client.space.storage.delete(spaceId, projectDir(id), {
      recursive: true,
    })

    return { id }
  }
)
