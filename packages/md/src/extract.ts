import type { Image, Link, Text } from 'mdast'
import parse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

interface ExtractedLink {
  title: string
  url: string
  start?: number
  end?: number
}

interface ExtractedImage {
  title: string
  url: string
  start?: number
  end?: number
}

export function extractUrlsFromMarkdown(markdown: string): string[] {
  const urls: string[] = []

  const processor = unified()
    .use(parse)
    .use(() => (tree) => {
      visit(tree, 'link', (node) => {
        const linkNode = node as Link

        if (
          linkNode.url &&
          (linkNode.url.startsWith('http://') ||
            linkNode.url.startsWith('https://'))
        ) {
          urls.push(linkNode.url)
        }
      })

      visit(tree, 'text', (node) => {
        const textNode = node as Text

        const urlRegex = /(https?:\/\/[^\s]+)/g
        const matches = textNode.value.match(urlRegex)

        if (matches) {
          urls.push(...matches.map((m) => m.replace(/[,.]$/, '')))
        }
      })
    })

  processor.runSync(processor.parse(markdown))

  return urls
}

export function extractLinksFromMarkdown(markdown: string): ExtractedLink[] {
  const links: ExtractedLink[] = []

  const processor = unified()
    .use(parse)
    .use(() => (tree) => {
      visit(tree, 'link', (node) => {
        const linkNode = node as Link

        let title: string | undefined

        if (linkNode.title) {
          title = linkNode.title
        } else if (
          linkNode.children.length > 0 &&
          linkNode.children[0].type === 'text'
        ) {
          title = (linkNode.children[0] as Text).value
        }

        if (title) {
          links.push({
            title,
            url: linkNode.url,
            start: linkNode.position?.start?.offset,
            end: linkNode.position?.end?.offset,
          })
        }
      })
    })

  processor.runSync(processor.parse(markdown))

  return links
}

export function extractImagesFromMarkdown(markdown: string): ExtractedImage[] {
  const images: ExtractedImage[] = []

  const processor = unified()
    .use(parse)
    .use(() => (tree) => {
      visit(tree, 'image', (node) => {
        const imageNode = node as Image

        let title: string | undefined

        if (imageNode.alt) {
          title = imageNode.alt
        } else if (imageNode.title) {
          title = imageNode.title
        }

        if (title) {
          images.push({
            title,
            url: imageNode.url,
            start: imageNode.position?.start?.offset,
            end: imageNode.position?.end?.offset,
          })
        }
      })
    })

  processor.runSync(processor.parse(markdown))

  return images
}
