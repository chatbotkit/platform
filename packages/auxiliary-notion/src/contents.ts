import type { fetch as chatbotkitFetch } from '@chatbotkit-dev/fetch'

import type { TrimmedNonEmptyString } from '@chatbotkit-dev/typescript-utils'

import { getClient } from './client'

import { NotionToMarkdown } from 'notion-to-md'

export async function getContents({
  auth,
  pageId,
  fetch,
}: {
  auth: TrimmedNonEmptyString
  pageId: TrimmedNonEmptyString
  fetch?: typeof chatbotkitFetch
}): Promise<string> {
  const notionClient = getClient(auth, { fetch })

  const n2m = new NotionToMarkdown({ notionClient })

  const mdblocks = await n2m.pageToMarkdown(pageId)
  const contents = n2m.toMarkdownString(mdblocks)

  return contents
}
