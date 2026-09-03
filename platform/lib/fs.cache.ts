import { roundToNearestNMinutes } from '@chatbotkit-dev/time'

import fs from 'fs/promises'
import { v5 as uuidv5 } from 'uuid'

export function getTempFileLocation({
  namespace,
  name,
  ext,
  ttlInMinutes,
}: {
  namespace: string
  name: string
  ext: string
  ttlInMinutes: number
}): string {
  const dir = `/tmp`

  const id = uuidv5(name, namespace)

  const time = roundToNearestNMinutes(ttlInMinutes)

  const normalizedExt = ext.startsWith('.') ? ext.replace(/^\.+/, '') : ext

  const suffix = normalizedExt ? `.${normalizedExt}` : ''

  return `${dir}/${id}-${time.getTime()}${suffix}`
}

export async function readTimeFileMeta({
  namespace,
  name,
  ttlInMinutes,
}: {
  namespace: string
  name: string
  ttlInMinutes: number
}): Promise<{ name: string; ext: string; type: string } | null> {
  const metaLocation = getTempFileLocation({
    namespace,
    name,
    ext: '.meta',
    ttlInMinutes,
  })

  try {
    const content = await fs.readFile(metaLocation, 'utf-8')

    const meta = JSON.parse(content)

    return meta
  } catch {
    return null
  }
}

export async function writeTempFileMeta({
  namespace,
  name,
  ttlInMinutes,
  meta,
}: {
  namespace: string
  name: string
  ttlInMinutes: number
  meta: { name: string; ext: string; type: string }
}): Promise<void> {
  const metaLocation = getTempFileLocation({
    namespace,
    name,
    ext: '.meta',
    ttlInMinutes,
  })

  await fs.writeFile(metaLocation, JSON.stringify(meta), 'utf-8')
}

type TTLFileLoaderResult = {
  buffer: ArrayBuffer
  meta: { name: string; ext: string; type: string }
}

export async function ttlFileLocation({
  namespace,
  name,
  ttlInMinutes,
  loader,
}: {
  namespace: string
  name: string
  ttlInMinutes: number
  loader: () => Promise<TTLFileLoaderResult>
}): Promise<{
  location: string
  meta: TTLFileLoaderResult['meta']
  created: boolean
}> {
  const meta = await readTimeFileMeta({ namespace, name, ttlInMinutes })

  if (meta) {
    const location = getTempFileLocation({
      namespace,
      name,
      ext: meta.ext,
      ttlInMinutes,
    })

    return { location, meta, created: false }
  }

  const { buffer, meta: newMeta } = await loader()

  const location = getTempFileLocation({
    namespace,
    name,
    ext: newMeta.ext,
    ttlInMinutes,
  })

  await fs.writeFile(location, Buffer.from(buffer))

  await writeTempFileMeta({ namespace, name, ttlInMinutes, meta: newMeta })

  return { location, meta: newMeta, created: true }
}

export async function ttlFileBuffer({
  namespace,
  name,
  ttlInMinutes,
  loader,
}: {
  namespace: string
  name: string
  ttlInMinutes: number
  loader: () => Promise<TTLFileLoaderResult>
}): Promise<TTLFileLoaderResult> {
  const meta = await readTimeFileMeta({ namespace, name, ttlInMinutes })

  if (meta) {
    const location = getTempFileLocation({
      namespace,
      name,
      ext: meta.ext,
      ttlInMinutes,
    })

    const fileBuffer = await fs.readFile(location)
    const arrayBuffer = new Uint8Array(fileBuffer).buffer

    return { buffer: arrayBuffer, meta }
  }

  const { buffer, meta: newMeta } = await loader()

  const location = getTempFileLocation({
    namespace,
    name,
    ext: newMeta.ext,
    ttlInMinutes,
  })

  await fs.writeFile(location, Buffer.from(buffer))

  await writeTempFileMeta({ namespace, name, ttlInMinutes, meta: newMeta })

  return { buffer, meta: newMeta }
}
