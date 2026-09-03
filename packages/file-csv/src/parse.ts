import { parse } from 'csv-parse/sync'

export function csv2blocks(input: string | Uint8Array): string[] {
  const records = parse(input as string | Buffer, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  })

  return records.map((record: Record<string, string>) => {
    return Object.entries(record)
      .map(([name, value]) => {
        name = name.replace(/\s+/g, ' ').trim()
        value = value.replace(/\s+/g, ' ').trim()

        if (!name || !value) {
          return
        }

        return `${name}: ${value}`
      })
      .filter((b) => b)
      .join('\n')
  })
}
