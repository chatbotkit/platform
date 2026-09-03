export function generateMarkdownTable(
  headers: string[],
  data: string[][]
): string {
  // If no headers provided but we have data, use empty headers based on first row
  const effectiveHeaders =
    headers.length > 0 ? headers : data.length > 0 ? data[0].map(() => '') : []

  if (effectiveHeaders.length === 0) {
    return ''
  }

  let table = '| ' + effectiveHeaders.join(' | ') + ' |\n'

  table += '| ' + effectiveHeaders.map(() => '---').join(' | ') + ' |\n'

  data.forEach((row) => {
    table += '| ' + row.join(' | ') + ' |\n'
  })

  return table
}
