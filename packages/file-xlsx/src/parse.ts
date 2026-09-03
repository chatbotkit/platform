import { parseOffice } from 'officeparser'

export async function xlsx2text(buffer: Uint8Array): Promise<string> {
  const result = await parseOffice(Buffer.from(buffer))

  return result.toText()
}
