import { ASSETS_DIR, PROJECT_FILE, PROJECTS_PREFIX } from './const'

/**
 * @file Pure helpers and shared types for the Media Graph app. This module is
 * intentionally free of server-only imports so it can be consumed by both the
 * server actions and the client canvas components.
 */

export const DEFAULT_MODEL = 'gpt-image-2'
export const DEFAULT_SIZE = 'auto'

/** Image sizes offered in the node editor (mirrors the image action sizes). */
export const SIZES = [
  'auto',
  '1024x1024',
  '1536x1024',
  '1024x1536',
  '512x512',
  '256x256',
] as const

/**
 * The lifecycle status of a single image node.
 *
 * - `empty`   - created but never generated (has a prompt, no image yet)
 * - `pending` - a generation/edit request is in flight
 * - `ready`   - has a generated asset
 * - `error`   - the last generation attempt failed
 */
export type NodeStatus = 'empty' | 'pending' | 'ready' | 'error'

export interface GraphNodeData {
  /** user provided prompt that drives generation/editing */
  prompt: string
  /** image model id, e.g. `gpt-image-2` */
  model: string
  /** image size, e.g. `auto` or `1024x1024` */
  size: string
  /** storage path of the generated image, relative to the space root */
  assetPath: string | null
  status: NodeStatus
  /** last error message, when status is `error` */
  error?: string
}

export interface GraphNode {
  id: string
  type: 'image'
  position: { x: number; y: number }
  data: GraphNodeData
}

export interface GraphEdge {
  id: string
  source: string
  target: string
}

export interface Project {
  id: string
  name: string
  description?: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  createdAt: string
  updatedAt: string
}

/** Lightweight project summary used by the project list view. */
export interface ProjectSummary {
  id: string
  name: string
  description?: string
  nodeCount: number
  createdAt: string
  updatedAt: string
}

/** Directory that holds a single project (the project folder). */
export function projectDir(projectId: string): string {
  return `${PROJECTS_PREFIX}/${projectId}`
}

/** Path of the project graph file inside the project folder. */
export function projectFilePath(projectId: string): string {
  return `${PROJECTS_PREFIX}/${projectId}/${PROJECT_FILE}`
}

/** The assets folder that lives alongside the project file. */
export function assetsDir(projectId: string): string {
  return `${PROJECTS_PREFIX}/${projectId}/${ASSETS_DIR}`
}

/** Path of a single asset (image) inside a project's assets folder. */
export function assetPath(
  projectId: string,
  assetId: string,
  ext = 'png'
): string {
  return `${PROJECTS_PREFIX}/${projectId}/${ASSETS_DIR}/${assetId}.${ext}`
}

/** Maps a common image mime type to a file extension. */
export function extFromMimeType(type?: string): string {
  switch (type) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    case 'image/avif':
      return 'avif'
    default:
      return 'png'
  }
}

/**
 * Builds the model identifier passed to the image lib. The size is encoded
 * using the `model/size=...` config syntax understood by `parseImageModel`.
 */
export function buildModelId(model: string, size?: string): string {
  if (!size || size === 'auto') {
    return model
  }

  return `${model}/size=${size}`
}
