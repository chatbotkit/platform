import { pdf2text } from './parse'

import fs from 'node:fs'

describe('pptx2text', () => {
  test('should return text', async () => {
    const data = fs.readFileSync('./data/test01.pdf')

    const text = await pdf2text(new Uint8Array(data))

    expect(text.trim()).toEqual('HELLO WORLD')
  })
})
