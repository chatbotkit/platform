import { generateMarkdownTable } from './table'

describe('generateMarkdownTable', () => {
  it('should generate a table with headers and data', () => {
    const headers = ['Name', 'Age', 'City']
    const data = [
      ['Alice', '30', 'New York'],
      ['Bob', '25', 'London'],
    ]

    const result = generateMarkdownTable(headers, data)

    expect(result).toBe(
      '| Name | Age | City |\n' +
        '| --- | --- | --- |\n' +
        '| Alice | 30 | New York |\n' +
        '| Bob | 25 | London |\n'
    )
  })

  it('should generate a table with single column', () => {
    const headers = ['Item']
    const data = [['Apple'], ['Banana']]

    const result = generateMarkdownTable(headers, data)

    expect(result).toBe(
      '| Item |\n' + '| --- |\n' + '| Apple |\n' + '| Banana |\n'
    )
  })

  it('should generate a table without headers when empty array is provided', () => {
    const headers = []
    const data = [
      ['Alice', '30', 'New York'],
      ['Bob', '25', 'London'],
    ]

    const result = generateMarkdownTable(headers, data)

    expect(result).toBe(
      '|  |  |  |\n' +
        '| --- | --- | --- |\n' +
        '| Alice | 30 | New York |\n' +
        '| Bob | 25 | London |\n'
    )
  })

  it('should handle empty data array', () => {
    const headers = ['Name', 'Age']
    const data = []

    const result = generateMarkdownTable(headers, data)

    expect(result).toBe('| Name | Age |\n' + '| --- | --- |\n')
  })

  it('should return empty string when both headers and data are empty', () => {
    const headers = []
    const data = []

    const result = generateMarkdownTable(headers, data)

    expect(result).toBe('')
  })

  it('should handle rows with different content lengths', () => {
    const headers = ['Col1', 'Col2']
    const data = [
      ['Short', 'This is a longer text'],
      ['X', 'Y'],
    ]

    const result = generateMarkdownTable(headers, data)

    expect(result).toBe(
      '| Col1 | Col2 |\n' +
        '| --- | --- |\n' +
        '| Short | This is a longer text |\n' +
        '| X | Y |\n'
    )
  })

  it('should handle special characters in cells', () => {
    const headers = ['Name', 'Symbol']
    const data = [
      ['Pipe', '|'],
      ['Dash', '-'],
    ]

    const result = generateMarkdownTable(headers, data)

    expect(result).toBe(
      '| Name | Symbol |\n' +
        '| --- | --- |\n' +
        '| Pipe | | |\n' +
        '| Dash | - |\n'
    )
  })

  it('should handle empty string values in cells', () => {
    const headers = ['A', 'B', 'C']
    const data = [
      ['', 'value', ''],
      ['x', '', 'z'],
    ]

    const result = generateMarkdownTable(headers, data)

    expect(result).toBe(
      '| A | B | C |\n' +
        '| --- | --- | --- |\n' +
        '|  | value |  |\n' +
        '| x |  | z |\n'
    )
  })

  it('should generate table with numeric values', () => {
    const headers = ['ID', 'Price', 'Quantity']
    const data = [
      ['1', '10.99', '5'],
      ['2', '25.50', '2'],
    ]

    const result = generateMarkdownTable(headers, data)

    expect(result).toBe(
      '| ID | Price | Quantity |\n' +
        '| --- | --- | --- |\n' +
        '| 1 | 10.99 | 5 |\n' +
        '| 2 | 25.50 | 2 |\n'
    )
  })
})
