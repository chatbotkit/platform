// @ts-check
import 'dotenv/config'

import prisma from '@/prisma/client'

import { encode } from '@/lib/b64'
import { log, runScript } from '@/lib/script'
import { listStorage } from '@/lib/space.storage'

/**
 * List files in a space's storage.
 *
 * Usage:
 * ```bash
 * pnpm script:list-space-storage                              # Interactive mode
 * pnpm script:list-space-storage --spaceId space123           # CLI mode
 * pnpm script:list-space-storage -s space123 -p folder/path   # With path
 * pnpm script:list-space-storage -s space123 --recursive      # Recursive listing
 * OUTPUT=json pnpm script:list-space-storage -s space123      # JSON output
 * ```
 */
runScript({
  name: 'list-space-storage',
  description: 'List files in a space storage',
  options: {
    spaceId: {
      type: 'string',
      short: 's',
      description: 'Space ID',
      message: 'What is the space ID?',
      required: true,
    },
    path: {
      type: 'string',
      short: 'p',
      description: 'Directory path to list files from (default: root)',
      message: 'What is the path? (press Enter for root)',
      required: false,
    },
    recursive: {
      type: 'boolean',
      short: 'r',
      description: 'List files recursively',
      message: 'List files recursively?',
      required: false,
      default: false,
    },
  },
  handler: async ({ spaceId, path, recursive }) => {
    log(`locating space ${spaceId}`)

    const space = await prisma.space.findUnique({
      where: {
        id: spaceId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })

    if (!space) {
      log(`space not found`)

      return
    }

    log(`space found: ${space.name || 'Untitled'}`)
    log(`owner: ${space.user.email}`)

    if (space.description) {
      log(`description: ${space.description}`)
    }

    const pathToList = path || '.'
    const pathId = encode(pathToList, true)

    log(
      `listing files in ${pathToList === '.' ? 'root' : pathToList}${recursive ? ' (recursive)' : ''}`
    )

    try {
      const result = await listStorage({
        spaceId: space.id,
        pathId,
        recursive: recursive || false,
      })

      const { items } = result

      if (items.length === 0) {
        log(`no files found`)

        return
      }

      log(`found ${items.length} item(s)`)

      if (process.env.OUTPUT === 'json') {
        log(JSON.stringify(items, null, 2))
      } else {
        // @note group by directories and files
        const directories = items.filter((item) => item.isDirectory)
        const files = items.filter((item) => !item.isDirectory)

        if (directories.length > 0) {
          log('\nDirectories:')

          for (const dir of directories) {
            log(`  📁 ${dir.path}/`)
          }
        }

        if (files.length > 0) {
          log('\nFiles:')

          for (const file of files) {
            const size = formatFileSize(file.size)
            const date = new Date(file.updatedAt).toISOString()

            log(`  📄 ${file.path}`)
            log(`     Size: ${size}`)
            log(`     Modified: ${date}`)
          }
        }

        log('\nSummary:')
        log(
          `  ${directories.length} director${directories.length === 1 ? 'y' : 'ies'}, ${files.length} file${files.length === 1 ? '' : 's'}`
        )
        log(
          `  Total size: ${formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}`
        )
      }
    } catch (error) {
      log(`error listing storage: ${error.message}`)

      throw error
    }
  },
})

/**
 * Formats a file size in bytes to a human-readable string.
 *
 * @param {number} bytes - The file size in bytes
 * @returns {string} Formatted size (e.g., "1.5 KB", "2.3 MB")
 */
function formatFileSize(bytes) {
  if (bytes === 0) {
    return '0 B'
  }

  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
