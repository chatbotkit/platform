import { pptx2text } from './parse'

import fs from 'node:fs'

describe('pptx2text', () => {
  test('should return text', async () => {
    const data = fs.readFileSync('./data/test01.pptx')

    const text = await pptx2text(data)

    expect(text.trim()).toEqual('HELLO\nWORLD')
  })
})
