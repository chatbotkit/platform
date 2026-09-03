import { extractText, getDocumentProxy } from 'unpdf'

export async function pdf2pages(data: Uint8Array): Promise<string[]> {
  const document = await getDocumentProxy(data)

  const { text: pages } = await extractText(document)

  return pages
}

export async function pdf2text(data: Uint8Array): Promise<string> {
  const pages = await pdf2pages(data)

  return pages.join('\n\n')
}
