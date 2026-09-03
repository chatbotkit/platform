'use server'

import { randomUUID } from 'crypto'

import type { Session } from 'next-auth'

import { appContactActionHandler } from '@/lib/app.action'
import fetch from '@/lib/fetch'
import { createImage, editImage } from '@/lib/image'
import { accountLimitsOk } from '@/lib/limit.core'
import { Usage } from '@/lib/usage.model'
import { recordImageUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'
import { z } from '@/lib/zod.schema'

import ConfigSchema from '../../config'
import { APP_NAME, CONTACT_NAMESPACE } from '../../const'
import type { Project } from '../../lib'
import {
  DEFAULT_MODEL,
  DEFAULT_SIZE,
  assetPath,
  buildModelId,
  extFromMimeType,
} from '../../lib'
import type { Client } from '../../space'
import { ensureSpace, readProject, writeProject } from '../../space'

const NodeSchema = z.object({
  id: z.string(),
  type: z.literal('image'),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    prompt: z.string(),
    model: z.string(),
    size: z.string(),
    assetPath: z.string().nullable(),
    status: z.enum(['empty', 'pending', 'ready', 'error']),
    error: z.string().optional(),
  }),
})

const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
})

/**
 * Builds presigned download URLs for the given asset paths. Returns a map keyed
 * by asset path so the client can render images without exposing storage.
 */
async function buildAssetUrls(
  client: Client,
  spaceId: string,
  paths: string[]
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    [...new Set(paths)].map(async (path) => {
      try {
        const { url } = await client.space.storage.download(spaceId, path)

        return [path, url] as const
      } catch {
        return null
      }
    })
  )

  return Object.fromEntries(
    entries.filter((entry): entry is readonly [string, string] => entry !== null)
  )
}

/** Ensures the account is within limits before spending on image generation. */
async function assertWithinLimits(session: Session): Promise<void> {
  const user = await fastGetUserById(session.user.id)

  if (!user) {
    throw new Error('User not found')
  }

  if (!(await accountLimitsOk(user, ['token', 'image']))) {
    throw new Error('You have reached your usage limit.')
  }
}

/** Records token and image usage for a single generation, mirroring the API. */
async function recordUsage(
  session: Session,
  usage: { inputTokens: number; outputTokens: number; model: string },
  count: number,
  reason: 'image/create' | 'image/edit'
): Promise<void> {
  const usageRecorder = new Usage()

  usageRecorder.addImageTokens(usage.inputTokens, usage.model, 'input')
  usageRecorder.addImageTokens(usage.outputTokens, usage.model, 'output')

  await usageRecorder.recordBaseTokens({
    user: { id: session.user.id },
    meta: { reason },
  })

  await recordImageUsage({
    user: { id: session.user.id },
    count,
    model: usage.model,
    meta: { reason },
  })
}

/**
 * Loads a project graph along with freshly signed URLs for every asset
 * referenced by its nodes.
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

/** Persists the full graph (nodes + edges) for a project. */
export const saveProject = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    projectId: z.string(),
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
  }),
  async (
    _config,
    session,
    contact,
    { projectId, nodes, edges }
  ): Promise<{ id: string }> => {
    const { client, spaceId } = await ensureSpace(session, contact)

    const project = await readProject(client, spaceId, projectId)

    if (!project) {
      throw new Error('Project not found')
    }

    await writeProject(client, spaceId, {
      ...project,
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    })

    return { id: projectId }
  }
)

/**
 * Refreshes presigned download URLs for the requested asset paths. Used when
 * URLs returned by `getProject` expire during a long editing session.
 */
export const getAssetUrls = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    projectId: z.string(),
    paths: z.array(z.string()),
  }),
  async (
    _config,
    session,
    contact,
    { paths }
  ): Promise<{ assetUrls: Record<string, string> }> => {
    const { client, spaceId } = await ensureSpace(session, contact)

    const assetUrls = await buildAssetUrls(client, spaceId, paths)

    return { assetUrls }
  }
)

/**
 * Mints a presigned upload request for a dropped image file. The browser PUTs
 * the bytes directly to storage, so the file never passes through the server
 * action body. Returns the asset path and the upload request to perform.
 */
export const createAssetUpload = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    projectId: z.string(),
    file: z.object({
      type: z.string(),
      size: z.number(),
    }),
  }),
  async (
    _config,
    session,
    contact,
    { projectId, file }
  ): Promise<{
    path: string
    uploadRequest?: { method: string; url: string; headers: object }
  }> => {
    const { client, spaceId } = await ensureSpace(session, contact)

    const path = assetPath(projectId, randomUUID(), extFromMimeType(file.type))

    const data = await client.space.storage.upload(spaceId, path, {
      file: {
        type: file.type || 'application/octet-stream',
        size: file.size,
      },
    })

    return { path: data.path, uploadRequest: data.uploadRequest }
  }
)

/**
 * Generates a brand new image from a prompt and stores it as an asset in the
 * project's assets folder. Returns the stored path and a download URL.
 */
export const generateImage = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    projectId: z.string(),
    prompt: z.string().min(1),
    model: z.string().optional(),
    size: z.string().optional(),
  }),
  async (
    _config,
    session,
    contact,
    { projectId, prompt, model, size }
  ): Promise<{ assetPath: string; assetUrl: string }> => {
    const { client, spaceId } = await ensureSpace(session, contact)

    await assertWithinLimits(session)

    const { urls, usage } = await createImage(prompt, {
      model: buildModelId(model || DEFAULT_MODEL, size || DEFAULT_SIZE),
      user: session.user.id,
    })

    await recordUsage(session, usage, urls.length, 'image/create')

    const [url] = urls

    if (!url) {
      throw new Error('Image generation returned no result')
    }

    return storeAsset(client, spaceId, projectId, url)
  }
)

/**
 * Creates a new image by transforming one or more source images with a prompt
 * (the `image/edit` flow). The new image is stored as a fresh asset.
 */
export const editImageNode = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    projectId: z.string(),
    prompt: z.string().min(1),
    sourceAssetPaths: z.array(z.string()).min(1),
    model: z.string().optional(),
    size: z.string().optional(),
  }),
  async (
    _config,
    session,
    contact,
    { projectId, prompt, sourceAssetPaths, model, size }
  ): Promise<{ assetPath: string; assetUrl: string }> => {
    const { client, spaceId } = await ensureSpace(session, contact)

    await assertWithinLimits(session)

    // @note fetch each source asset as a blob to feed the edit model
    const imageBlobs = await Promise.all(
      sourceAssetPaths.map(async (path) => {
        const { url } = await client.space.storage.download(spaceId, path)

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error('Failed to load a source image')
        }

        return response.blob()
      })
    )

    const { urls, usage } = await editImage(prompt, imageBlobs, {
      model: buildModelId(model || DEFAULT_MODEL, size || DEFAULT_SIZE),
      user: session.user.id,
    })

    await recordUsage(session, usage, urls.length, 'image/edit')

    const [url] = urls

    if (!url) {
      throw new Error('Image edit returned no result')
    }

    return storeAsset(client, spaceId, projectId, url)
  }
)

/**
 * Ingests a generated image URL into the project's assets folder and returns
 * the stored path together with a download URL for immediate display.
 */
async function storeAsset(
  client: Client,
  spaceId: string,
  projectId: string,
  url: string
): Promise<{ assetPath: string; assetUrl: string }> {
  const path = assetPath(projectId, randomUUID())

  await client.space.storage.upload(spaceId, path, { file: url })

  const { url: assetUrl } = await client.space.storage.download(spaceId, path)

  return { assetPath: path, assetUrl }
}
