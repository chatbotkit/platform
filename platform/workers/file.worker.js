// @ts-check
import { csv2blocks } from '@chatbotkit-dev/file-csv/parse'
import { docx2text } from '@chatbotkit-dev/file-docx/parse'
import { chunk as chunkJson } from '@chatbotkit-dev/file-json'
import { chunk as chunkJsonl } from '@chatbotkit-dev/file-jsonl'
import { pdf2pages } from '@chatbotkit-dev/file-pdf'
import { pptx2text } from '@chatbotkit-dev/file-pptx/parse'
import { xlsx2text } from '@chatbotkit-dev/file-xlsx/parse'

import { toaAsync } from '@/lib/it'
import {
  isCsvFile,
  isDocxFile,
  isJsonFile,
  isJsonlFile,
  isPdfFile,
  isPptxFile,
  isTextFile,
  isXlsxFile,
} from '@/lib/mime'
import { normalizeText } from '@/lib/string'

import '@/polyfills/client'

// @note polyfills are required but are not added to the bundle
// @todo find how to add the polyfills to web workers with next.config.js

self.onmessage = async function ({ data: { files } }) {
  const blocks = []

  for (const file of files) {
    switch (true) {
      case isPdfFile(file): {
        const pages = await pdf2pages(await file.arrayBuffer())

        blocks.push(pages.join('\n\n'))

        break
      }

      case isDocxFile(file): {
        const text = await docx2text(await file.arrayBuffer())

        blocks.push(text)

        break
      }

      case isPptxFile(file): {
        const text = await pptx2text(await file.arrayBuffer())

        blocks.push(text)

        break
      }

      case isXlsxFile(file): {
        const text = await xlsx2text(await file.arrayBuffer())

        blocks.push(text)

        break
      }

      case isCsvFile(file): {
        const text = await file.text()

        blocks.push(csv2blocks(text).join('\n\n'))

        break
      }

      case isTextFile(file): {
        const text = await file.text()

        blocks.push(text)

        break
      }

      case isJsonFile(file): {
        const text = await file // @note file is a blob

        blocks.push(
          (await toaAsync(chunkJson(text))).map(({ text }) => text).join('\n\n')
        )

        break
      }

      case isJsonlFile(file): {
        const text = await file // @note file is a blob

        blocks.push(
          (await toaAsync(chunkJsonl(text)))
            .map(({ text }) => text)
            .join('\n\n')
        )

        break
      }

      default:
        continue
    }
  }

  const text = normalizeText(blocks.join('\n\n'))

  self.postMessage({ text })
}
