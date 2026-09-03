// @ts-expect-error there are no type declarations for this package
import mensch from 'mensch'

export default function () {
  return {
    font: [
      ({
        htmlDom: $,
        url,
      }: {
        htmlDom: (a: unknown) => unknown
        url: string
      }) => {
        // @ts-expect-error no types
        const links: string[] = $('link[rel="stylesheet"]')
          // @ts-expect-error no types
          .map((_, el) => $(el).attr('href'))
          .get()
          // @ts-expect-error no types
          .map((link) => new URL(link, url).href)

        return new Promise(async (resolve) => {
          const sources: (string | null)[] = await Promise.all(
            links.map(async (link) => {
              // @note the runtime's fetch: this package has no platform fetch to import
              const response = await globalThis.fetch(link, {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
                  Accept: '*/*',
                },
              })

              if (!response.ok) {
                return null
              }

              return response.text()
            })
          )

          const styles = mensch.parse(
            sources.filter((source) => !!source).join('\n')
          )

          const _fonts = styles.stylesheet.rules
            .flatMap(({ declarations }: { declarations: unknown }) => {
              // @ts-expect-error no types
              return declarations?.filter?.(
                ({ type, name }: { type: string; name: string }) =>
                  type === 'property' && name === 'font-family'
              )
            })
            .filter(Boolean)
            .map(({ value }: { value: string }) => value)
            .filter((font: string) => !/inherit|var\(|KaTeX/i.test(font))

          // @todo: use the extracted fonts
          // fonts

          resolve(null)
        })
      },
    ],
  }
}
