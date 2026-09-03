import { csv2blocks } from './parse'

import fs from 'node:fs'

describe('csv2blocks', () => {
  test('csv must produce blocks', () => {
    expect(csv2blocks('1,2,3\na,b,c')).toEqual(['1: a\n2: b\n3: c'])
    expect(csv2blocks('1,2,3\na,b,c\nx,y,z')).toEqual([
      '1: a\n2: b\n3: c',
      '1: x\n2: y\n3: z',
    ])
  })

  test('should return text', async () => {
    const data = fs.readFileSync('./data/test01.csv')

    const blocks = await csv2blocks(new Uint8Array(data))

    expect(blocks).toEqual(['column1: cell1\ncolumn2: cell2\ncolumn3: cell3'])
  })
})
