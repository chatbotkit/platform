import { xlsx2text } from './parse'

import fs from 'node:fs'

describe('xlsx2text', () => {
  test('should return text', async () => {
    const data = fs.readFileSync('./data/test01.xlsx')

    const text = await xlsx2text(data)

    expect(text.trim()).toEqual(
      'column1\ncolumn2\ncolumn3\ncell1\ncell2\ncell3'
    )
  })
})
