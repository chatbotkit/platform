import { docx2text } from './parse'

import fs from 'node:fs'

describe('pptx2text', () => {
  test('should return text', async () => {
    const data = fs.readFileSync('./data/test01.docx')

    const text = await docx2text(data)

    expect(text.trim()).toEqual('HELLO WORLD')
  })
})
