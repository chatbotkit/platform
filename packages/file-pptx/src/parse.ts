import { parseOffice } from 'officeparser'

export async function pptx2text(buffer: Uint8Array): Promise<string> {
  const result = await parseOffice(Buffer.from(buffer))

  return result.toText()
}
