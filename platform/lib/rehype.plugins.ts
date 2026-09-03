import { newEmojiRegex } from '@/lib/emoji2'

import type { Node, Parent } from 'unist'
import { visit } from 'unist-util-visit'

// @todo import from @types/unist when possible

interface ElementNode extends Parent {
  type: 'element'
  tagName: string
  properties: Record<string, unknown>
  children: Node[]
}

// @todo import from @types/unist when possible

interface TextNode extends Node {
  type: 'text'
  value: string
}

export function wordsToSpans() {
  return (tree: Node) => {
    visit(
      tree,
      'text',
      (
        node: TextNode,
        index: number | null | undefined,
        parent: Parent | undefined
      ) => {
        if (index == null) {
          return
        }

        const elementParent = parent as ElementNode | undefined

        if (
          elementParent &&
          (elementParent.tagName === 'p' ||
            elementParent.tagName === 'li' ||
            elementParent.tagName === 'a')
        ) {
          // @note special case for a tags to avoid chunking links into spans
          {
            if (
              elementParent.tagName === 'a' &&
              /https?:\/\//.test(node.value)
            ) {
              return
            }
          }

          const words = node.value.split(/(\b[^\s]+\b)/g)

          elementParent.children[index] = {
            type: 'element',
            tagName: 'span',
            properties: {},
            children: words.map((word) => ({
              type: 'element',
              tagName: 'span',
              properties: {},
              children: [{ type: 'text', value: word }],
            })),
          } as ElementNode
        }
      }
    )
  }
}

export function textToEmojiSpans() {
  return (tree: Node) => {
    visit(
      tree,
      'text',
      (
        node: TextNode,
        index: number | null | undefined,
        parent: Parent | undefined
      ) => {
        if (index == null) {
          return
        }

        const elementParent = parent as ElementNode | undefined

        if (
          elementParent &&
          (elementParent.tagName === 'h1' ||
            elementParent.tagName === 'h2' ||
            elementParent.tagName === 'h3' ||
            elementParent.tagName === 'h4' ||
            elementParent.tagName === 'h5' ||
            elementParent.tagName === 'h6' ||
            elementParent.tagName === 'p' ||
            elementParent.tagName === 'li' ||
            elementParent.tagName === 'span' ||
            elementParent.tagName === 'strong' ||
            elementParent.tagName === 'a')
        ) {
          const erx = newEmojiRegex()

          // @note avoid chunking links into emoji spans unless needed
          {
            if (!erx.test(node.value)) {
              return
            }
          }

          elementParent.children[index] = {
            type: 'element',
            tagName: 'span',
            properties: {},
            children: node.value
              .split(new RegExp(`(${erx.source})`, erx.flags))
              .map((part) => {
                if (erx.test(part)) {
                  return {
                    type: 'element',
                    tagName: 'emoji',
                    properties: {},
                    children: [{ type: 'text', value: part }],
                  }
                } else {
                  return { type: 'text', value: part }
                }
              }),
          } as ElementNode
        }
      }
    )
  }
}
