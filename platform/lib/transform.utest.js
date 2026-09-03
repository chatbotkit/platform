import { rerank as rerankDocuments } from '@/lib/rerank'
import { recordRerankTokenUsage } from '@/lib/usage.record'

import {
  DEFAULT_RERANK_TOP_N,
  applyJmespath,
  applyJsonpath,
  applyMarkers,
  applyRerank,
  applyToon,
  detectError,
  detectFormat,
  isAtomContent,
  isAtomContentType,
  isErrorValue,
  isFeedContent,
  isFeedContentType,
  isHtmlContent,
  isHtmlContentType,
  isJsonContent,
  isJsonContentType,
  isNdjsonContentType,
  isRssContent,
  isRssContentType,
  isXmlContent,
  isXmlContentType,
  parseContent,
  parseNdjson,
  parseNestedJsonStrings,
  stripFeedHtml,
  stripXmlnsAttributes,
  transform,
  transformData,
  transformNestedStrings,
} from './transform'

jest.mock('@/lib/rerank', () => ({
  rerank: jest.fn(),
}))

jest.mock('@/lib/usage.record', () => ({
  recordRerankTokenUsage: jest.fn(),
}))

describe('transform', () => {
  describe('content type detection', () => {
    describe('isNdjsonContentType', () => {
      it('should detect x-ndjson content type', () => {
        expect(isNdjsonContentType('application/x-ndjson')).toBe(true)
      })

      it('should detect jsonl content type', () => {
        expect(isNdjsonContentType('application/jsonl')).toBe(true)
      })

      it('should not match regular json', () => {
        expect(isNdjsonContentType('application/json')).toBe(false)
      })
    })

    describe('isJsonContentType', () => {
      it('should detect application/json', () => {
        expect(isJsonContentType('application/json')).toBe(true)
      })

      it('should detect json with charset', () => {
        expect(isJsonContentType('application/json; charset=utf-8')).toBe(true)
      })

      it('should not match ndjson', () => {
        expect(isJsonContentType('application/x-ndjson')).toBe(false)
      })
    })

    describe('isHtmlContentType', () => {
      it('should detect text/html', () => {
        expect(isHtmlContentType('text/html')).toBe(true)
      })

      it('should detect html with charset', () => {
        expect(isHtmlContentType('text/html; charset=utf-8')).toBe(true)
      })
    })

    describe('isXmlContentType', () => {
      it('should detect application/xml', () => {
        expect(isXmlContentType('application/xml')).toBe(true)
      })

      it('should detect text/xml', () => {
        expect(isXmlContentType('text/xml')).toBe(true)
      })

      it('should not match html', () => {
        expect(isXmlContentType('text/html')).toBe(false)
      })
    })

    describe('isJsonContent', () => {
      it('should detect json object', () => {
        expect(isJsonContent('{"key": "value"}')).toBe(true)
      })

      it('should detect json array', () => {
        expect(isJsonContent('[1, 2, 3]')).toBe(true)
      })

      it('should handle whitespace before json', () => {
        expect(isJsonContent('  {"key": "value"}')).toBe(true)
      })

      it('should not match xml', () => {
        expect(isJsonContent('<root/>')).toBe(false)
      })

      it('should not match plain text', () => {
        expect(isJsonContent('hello world')).toBe(false)
      })
    })

    describe('isHtmlContent', () => {
      it('should detect doctype html', () => {
        expect(isHtmlContent('<!DOCTYPE html><html></html>')).toBe(true)
      })

      it('should detect html tag', () => {
        expect(isHtmlContent('<html><body>Hello</body></html>')).toBe(true)
      })

      it('should detect head tag', () => {
        expect(isHtmlContent('<head><title>Test</title></head>')).toBe(true)
      })

      it('should detect body tag', () => {
        expect(isHtmlContent('<body>Content</body>')).toBe(true)
      })

      it('should be case insensitive', () => {
        expect(isHtmlContent('<!DOCTYPE HTML><HTML></HTML>')).toBe(true)
        expect(isHtmlContent('<HTML><BODY></BODY></HTML>')).toBe(true)
      })

      it('should handle whitespace before html', () => {
        expect(isHtmlContent('  <!DOCTYPE html><html></html>')).toBe(true)
      })

      it('should not match generic xml', () => {
        expect(isHtmlContent('<root><item/></root>')).toBe(false)
      })

      it('should not match json', () => {
        expect(isHtmlContent('{"key": "value"}')).toBe(false)
      })
    })

    describe('isXmlContent', () => {
      it('should detect xml declaration', () => {
        expect(isXmlContent('<?xml version="1.0"?><root/>')).toBe(true)
      })

      it('should detect xml starting with tag', () => {
        expect(isXmlContent('<root><item>value</item></root>')).toBe(true)
      })

      it('should handle whitespace before xml', () => {
        expect(isXmlContent('  <?xml version="1.0"?><root/>')).toBe(true)
      })

      it('should not match json objects', () => {
        // @note this returns true because json starts with { which is not <
        // but isXmlContent is meant to be used after json parse fails
        expect(isXmlContent('{"key": "value"}')).toBe(false)
      })

      it('should not match html with doctype', () => {
        expect(isXmlContent('<!DOCTYPE html><html></html>')).toBe(false)
      })

      it('should not match html tag', () => {
        expect(isXmlContent('<html><body>Hello</body></html>')).toBe(false)
      })

      it('should not match head tag', () => {
        expect(isXmlContent('<head><title>Test</title></head>')).toBe(false)
      })

      it('should not match body tag', () => {
        expect(isXmlContent('<body>Content</body>')).toBe(false)
      })

      it('should not match RSS feeds', () => {
        expect(
          isXmlContent(
            '<rss version="2.0"><channel><title>Test</title></channel></rss>'
          )
        ).toBe(false)
      })

      it('should not match Atom feeds', () => {
        expect(
          isXmlContent(
            '<feed xmlns="http://www.w3.org/2005/Atom"><title>Test</title></feed>'
          )
        ).toBe(false)
      })
    })

    describe('isRssContentType', () => {
      it('should detect application/rss+xml', () => {
        expect(isRssContentType('application/rss+xml')).toBe(true)
      })

      it('should detect application/rss', () => {
        expect(isRssContentType('application/rss')).toBe(true)
      })

      it('should not match regular xml', () => {
        expect(isRssContentType('application/xml')).toBe(false)
      })
    })

    describe('isAtomContentType', () => {
      it('should detect application/atom+xml', () => {
        expect(isAtomContentType('application/atom+xml')).toBe(true)
      })

      it('should detect application/atom', () => {
        expect(isAtomContentType('application/atom')).toBe(true)
      })

      it('should not match regular xml', () => {
        expect(isAtomContentType('application/xml')).toBe(false)
      })
    })

    describe('isFeedContentType', () => {
      it('should detect RSS content types', () => {
        expect(isFeedContentType('application/rss+xml')).toBe(true)
      })

      it('should detect Atom content types', () => {
        expect(isFeedContentType('application/atom+xml')).toBe(true)
      })

      it('should not match regular xml', () => {
        expect(isFeedContentType('application/xml')).toBe(false)
      })
    })

    describe('isRssContent', () => {
      it('should detect RSS content', () => {
        const rss =
          '<rss version="2.0"><channel><title>Test</title></channel></rss>'

        expect(isRssContent(rss)).toBe(true)
      })

      it('should detect RSS with XML declaration', () => {
        const rss =
          '<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title></channel></rss>'

        expect(isRssContent(rss)).toBe(true)
      })

      it('should not match Atom', () => {
        const atom =
          '<feed xmlns="http://www.w3.org/2005/Atom"><title>Test</title></feed>'

        expect(isRssContent(atom)).toBe(false)
      })
    })

    describe('isAtomContent', () => {
      it('should detect Atom content', () => {
        const atom =
          '<feed xmlns="http://www.w3.org/2005/Atom"><title>Test</title></feed>'

        expect(isAtomContent(atom)).toBe(true)
      })

      it('should not match RSS', () => {
        const rss =
          '<rss version="2.0"><channel><title>Test</title></channel></rss>'

        expect(isAtomContent(rss)).toBe(false)
      })
    })

    describe('isFeedContent', () => {
      it('should detect RSS content', () => {
        const rss =
          '<rss version="2.0"><channel><title>Test</title></channel></rss>'

        expect(isFeedContent(rss)).toBe(true)
      })

      it('should detect Atom content', () => {
        const atom =
          '<feed xmlns="http://www.w3.org/2005/Atom"><title>Test</title></feed>'

        expect(isFeedContent(atom)).toBe(true)
      })

      it('should not match regular XML', () => {
        const xml = '<root><item>value</item></root>'

        expect(isFeedContent(xml)).toBe(false)
      })
    })

    describe('detectFormat', () => {
      it('should return explicit format when provided', () => {
        expect(
          detectFormat({ contentType: 'text/plain', format: 'json' })
        ).toBe('json')
      })

      it('should detect ndjson from content type', () => {
        expect(detectFormat({ contentType: 'application/x-ndjson' })).toBe(
          'ndjson'
        )
      })

      it('should detect json from content type', () => {
        expect(detectFormat({ contentType: 'application/json' })).toBe('json')
      })

      it('should detect html from html content type', () => {
        expect(detectFormat({ contentType: 'text/html' })).toBe('html')
      })

      it('should return raw for unknown content type', () => {
        expect(detectFormat({ contentType: 'application/octet-stream' })).toBe(
          'raw'
        )
      })

      it('should detect json from content inspection', () => {
        expect(detectFormat({ content: '{"key": "value"}' })).toBe('json')
        expect(detectFormat({ content: '[1, 2, 3]' })).toBe('json')
      })

      it('should detect html from content inspection', () => {
        expect(detectFormat({ content: '<!DOCTYPE html><html></html>' })).toBe(
          'html'
        )
        expect(
          detectFormat({ content: '<html><body>Hello</body></html>' })
        ).toBe('html')
      })

      it('should detect xml from XML content inspection', () => {
        expect(detectFormat({ content: '<?xml version="1.0"?><root/>' })).toBe(
          'xml'
        )
        expect(detectFormat({ content: '<root><item/></root>' })).toBe('xml')
      })

      it('should detect RSS from content type', () => {
        expect(detectFormat({ contentType: 'application/rss+xml' })).toBe('rss')
      })

      it('should detect Atom from content type', () => {
        expect(detectFormat({ contentType: 'application/atom+xml' })).toBe(
          'atom'
        )
      })

      it('should detect RSS from content inspection', () => {
        const rss =
          '<rss version="2.0"><channel><title>Test</title></channel></rss>'

        expect(detectFormat({ content: rss })).toBe('rss')
      })

      it('should detect Atom from content inspection', () => {
        const atom =
          '<feed xmlns="http://www.w3.org/2005/Atom"><title>Test</title></feed>'

        expect(detectFormat({ content: atom })).toBe('atom')
      })

      it('should prioritize explicit format over content type', () => {
        expect(detectFormat({ contentType: 'text/html', format: 'json' })).toBe(
          'json'
        )
      })

      it('should prioritize content type over content inspection', () => {
        expect(
          detectFormat({ contentType: 'application/json', content: '<xml/>' })
        ).toBe('json')
      })
    })
  })

  describe('parsing functions', () => {
    describe('parseNdjson', () => {
      it('should parse newline-delimited json', () => {
        const input = '{"a":1}\n{"b":2}\n{"c":3}'
        const result = parseNdjson(input)

        expect(result).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
      })

      it('should skip empty lines', () => {
        const input = '{"a":1}\n\n{"b":2}\n'
        const result = parseNdjson(input)

        expect(result).toEqual([{ a: 1 }, { b: 2 }])
      })

      it('should handle single line', () => {
        const input = '{"a":1}'
        const result = parseNdjson(input)

        expect(result).toEqual([{ a: 1 }])
      })

      it('should handle NDJSON with some invalid lines gracefully', () => {
        const input = '{\"a\":1}\\nnot valid json\\n{\"b\":2}'

        expect(() => parseNdjson(input)).toThrow()
      })
    })

    describe('parseNestedJsonStrings', () => {
      it('should parse json string in object value', () => {
        const input = { data: '{"nested": true}' }
        const result = parseNestedJsonStrings(input)

        expect(result).toEqual({ data: { nested: true } })
      })

      it('should parse json array string', () => {
        const input = { items: '[1, 2, 3]' }
        const result = parseNestedJsonStrings(input)

        expect(result).toEqual({ items: [1, 2, 3] })
      })

      it('should handle deeply nested json strings', () => {
        const input = { outer: '{"inner": "{\\"deep\\": true}"}' }
        const result = parseNestedJsonStrings(input)

        expect(result).toEqual({ outer: { inner: { deep: true } } })
      })

      it('should preserve non-json strings', () => {
        const input = { message: 'hello world' }
        const result = parseNestedJsonStrings(input)

        expect(result).toEqual({ message: 'hello world' })
      })

      it('should handle arrays', () => {
        const input = ['{"a": 1}', 'plain text']
        const result = parseNestedJsonStrings(input)

        expect(result).toEqual([{ a: 1 }, 'plain text'])
      })

      it('should preserve primitives', () => {
        expect(parseNestedJsonStrings(null)).toBe(null)
        expect(parseNestedJsonStrings(42)).toBe(42)
        expect(parseNestedJsonStrings(true)).toBe(true)
      })
    })

    describe('transformNestedStrings', () => {
      describe('json transformation', () => {
        it('should parse nested JSON strings with json: true', async () => {
          const input = { data: '{"nested": true}' }
          const result = await transformNestedStrings(input, { json: true })

          expect(result).toEqual({ data: { nested: true } })
        })

        it('should convert nested JSON to toon with json: toon', async () => {
          const input = { data: '{"key": "value", "num": 123}' }
          const result = await transformNestedStrings(input, { json: 'toon' })

          expect(typeof result.data).toBe('string')
          expect(result.data).toContain('key')
          expect(result.data).toContain('value')
        })

        it('should handle deeply nested JSON with toon', async () => {
          const input = { outer: '{"inner": {"deep": true}}' }
          const result = await transformNestedStrings(input, { json: 'toon' })

          expect(typeof result.outer).toBe('string')
        })
      })

      describe('html transformation', () => {
        it('should convert nested HTML to text', async () => {
          const input = {
            content: '<html><body><p>Hello World</p></body></html>',
          }
          const result = await transformNestedStrings(input, { html: 'text' })

          expect(result.content).toContain('Hello World')
          expect(result.content).not.toContain('<p>')
        })

        it('should convert nested HTML to JSON', async () => {
          const input = { content: '<html><body>text</body></html>' }
          const result = await transformNestedStrings(input, { html: 'json' })

          expect(typeof result.content).toBe('object')
          expect(result.content.html).toBeDefined()
        })

        it('should convert nested HTML to toon', async () => {
          const input = { content: '<html><body>text</body></html>' }
          const result = await transformNestedStrings(input, { html: 'toon' })

          expect(typeof result.content).toBe('string')
        })
      })

      describe('xml transformation', () => {
        it('should convert nested XML to text', async () => {
          const input = { data: '<root><item>Value</item></root>' }
          const result = await transformNestedStrings(input, { xml: 'text' })

          expect(result.data).toContain('Value')
          expect(result.data).not.toContain('<item>')
        })

        it('should convert nested XML to JSON', async () => {
          const input = { data: '<root><item>Value</item></root>' }
          const result = await transformNestedStrings(input, { xml: 'json' })

          expect(typeof result.data).toBe('object')
          expect(result.data.root).toBeDefined()
          expect(result.data.root.item).toBe('Value')
        })

        it('should convert nested XML to toon', async () => {
          const input = { data: '<root><item>Value</item></root>' }
          const result = await transformNestedStrings(input, { xml: 'toon' })

          expect(typeof result.data).toBe('string')
        })

        it('should strip namespace prefixes in XML to JSON', async () => {
          const input = {
            data: '<soap:Envelope><soap:Body>content</soap:Body></soap:Envelope>',
          }
          const result = await transformNestedStrings(input, { xml: 'json' })

          expect(result.data.Envelope).toBeDefined()
          expect(result.data.Envelope.Body).toBe('content')
        })
      })

      describe('combined transformations', () => {
        it('should apply multiple transformations', async () => {
          const input = {
            jsonField: '{"key": "value"}',
            xmlField: '<root><item>test</item></root>',
            textField: 'plain text',
          }
          const result = await transformNestedStrings(input, {
            json: true,
            xml: 'json',
          })

          expect(result.jsonField).toEqual({ key: 'value' })
          expect(result.xmlField.root.item).toBe('test')
          expect(result.textField).toBe('plain text')
        })

        it('should handle arrays with mixed content', async () => {
          const input = ['{"a": 1}', '<item>value</item>', 'plain']
          const result = await transformNestedStrings(input, {
            json: true,
            xml: 'text',
          })

          expect(result[0]).toEqual({ a: 1 })
          expect(result[1]).toContain('value')
          expect(result[2]).toBe('plain')
        })
      })

      describe('edge cases', () => {
        it('should preserve non-matching strings', async () => {
          const input = { message: 'hello world' }
          const result = await transformNestedStrings(input, { json: true })

          expect(result).toEqual({ message: 'hello world' })
        })

        it('should handle null and primitives', async () => {
          expect(await transformNestedStrings(null, { json: true })).toBe(null)
          expect(await transformNestedStrings(42, { json: true })).toBe(42)
          expect(await transformNestedStrings(true, { json: true })).toBe(true)
        })

        it('should handle empty options gracefully', async () => {
          const input = { data: '{"key": "value"}' }
          const result = await transformNestedStrings(input, {})

          expect(result).toEqual({ data: '{"key": "value"}' })
        })

        it('should handle invalid JSON gracefully', async () => {
          const input = { data: '{invalid json}' }
          const result = await transformNestedStrings(input, { json: true })

          expect(result).toEqual({ data: '{invalid json}' })
        })

        it('should handle invalid XML gracefully', async () => {
          const input = { data: '<unclosed' }
          const result = await transformNestedStrings(input, { xml: 'json' })

          expect(result).toEqual({ data: '<unclosed' })
        })
      })
    })

    describe('stripFeedHtml', () => {
      it('should strip HTML from description field', async () => {
        const input = {
          title: 'Test',
          description: '<p>Hello <strong>world</strong>!</p>',
        }
        const result = await stripFeedHtml(input)

        expect(result.title).toBe('Test')
        expect(result.description).not.toContain('<p>')
        expect(result.description).not.toContain('<strong>')
        expect(result.description).toContain('Hello')
        expect(result.description).toContain('world')
      })

      it('should strip HTML from content field', async () => {
        const input = {
          title: 'Post',
          content: '<article><p>Full article.</p></article>',
        }
        const result = await stripFeedHtml(input)

        expect(result.content).not.toContain('<article>')
        expect(result.content).not.toContain('<p>')
        expect(result.content).toContain('Full article')
      })

      it('should handle xml2js object with _ for text content', async () => {
        const input = {
          content: {
            _: '<p>HTML content</p>',
            type: 'html',
          },
        }
        const result = await stripFeedHtml(input)

        expect(result.content._).not.toContain('<p>')
        expect(result.content._).toContain('HTML content')
        expect(result.content.type).toBe('html')
      })

      it('should recursively process nested objects', async () => {
        const input = {
          channel: {
            item: {
              title: 'Story',
              description: '<b>Bold</b> text',
            },
          },
        }
        const result = await stripFeedHtml(input)

        expect(result.channel.item.description).not.toContain('<b>')
        expect(result.channel.item.description).toContain('Bold')
      })

      it('should process arrays', async () => {
        const input = {
          items: [
            { description: '<p>First</p>' },
            { description: '<p>Second</p>' },
          ],
        }
        const result = await stripFeedHtml(input)

        expect(result.items[0].description).not.toContain('<p>')
        expect(result.items[1].description).not.toContain('<p>')
      })

      it('should preserve non-HTML strings', async () => {
        const input = {
          title: 'Plain text',
          description: 'No HTML here',
        }
        const result = await stripFeedHtml(input)

        expect(result.title).toBe('Plain text')
        expect(result.description).toBe('No HTML here')
      })
    })

    describe('stripXmlnsAttributes', () => {
      it('should remove xmlns attribute from object', () => {
        const input = {
          feed: {
            xmlns: 'http://www.w3.org/2005/Atom',
            title: 'My Feed',
          },
        }
        const result = stripXmlnsAttributes(input)

        expect(result.feed.xmlns).toBeUndefined()
        expect(result.feed.title).toBe('My Feed')
      })

      it('should remove xmlns:prefix attributes', () => {
        const input = {
          rss: {
            'xmlns:content': 'http://purl.org/rss/1.0/modules/content/',
            'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
            channel: {
              title: 'Test',
            },
          },
        }
        const result = stripXmlnsAttributes(input)

        expect(result.rss['xmlns:content']).toBeUndefined()
        expect(result.rss['xmlns:dc']).toBeUndefined()
        expect(result.rss.channel.title).toBe('Test')
      })

      it('should remove xmlns$ prefixed attributes from xml2js', () => {
        const input = {
          feed: {
            xmlns$: { value: 'http://www.w3.org/2005/Atom' },
            title: 'Test',
          },
        }
        const result = stripXmlnsAttributes(input)

        expect(result.feed['xmlns$']).toBeUndefined()
        expect(result.feed.title).toBe('Test')
      })

      it('should recursively process nested objects', () => {
        const input = {
          rss: {
            xmlns: 'http://example.com',
            channel: {
              xmlns: 'http://nested.example.com',
              item: {
                xmlns: 'http://item.example.com',
                title: 'Item',
              },
            },
          },
        }
        const result = stripXmlnsAttributes(input)

        expect(result.rss.xmlns).toBeUndefined()
        expect(result.rss.channel.xmlns).toBeUndefined()
        expect(result.rss.channel.item.xmlns).toBeUndefined()
        expect(result.rss.channel.item.title).toBe('Item')
      })

      it('should process arrays', () => {
        const input = {
          items: [
            { xmlns: 'http://a.com', title: 'A' },
            { xmlns: 'http://b.com', title: 'B' },
          ],
        }
        const result = stripXmlnsAttributes(input)

        expect(result.items[0].xmlns).toBeUndefined()
        expect(result.items[0].title).toBe('A')
        expect(result.items[1].xmlns).toBeUndefined()
        expect(result.items[1].title).toBe('B')
      })

      it('should preserve string values', () => {
        const input = 'plain string'
        const result = stripXmlnsAttributes(input)

        expect(result).toBe('plain string')
      })

      it('should preserve null and primitives', () => {
        expect(stripXmlnsAttributes(null)).toBeNull()
        expect(stripXmlnsAttributes(123)).toBe(123)
        expect(stripXmlnsAttributes(true)).toBe(true)
      })
    })

    describe('parseContent', () => {
      it('should parse json content', async () => {
        const result = await parseContent('{"key": "value"}', {
          contentType: 'application/json',
        })

        expect(result).toEqual({ data: { key: 'value' } })
      })

      it('should parse ndjson content', async () => {
        const result = await parseContent('{"a":1}\n{"b":2}', {
          contentType: 'application/x-ndjson',
        })

        expect(result).toEqual({ data: [{ a: 1 }, { b: 2 }] })
      })

      it('should return raw content for unknown format', async () => {
        const result = await parseContent('some text', {
          contentType: 'text/plain',
        })

        expect(result).toEqual({ data: 'some text' })
      })

      it('should return error for invalid json', async () => {
        const result = await parseContent('not json', {
          contentType: 'application/json',
          format: 'json',
        })

        expect(result.error).toBeDefined()
        expect(result.error).toContain('Parse failed')
      })

      it('should use explicit format over content type', async () => {
        const result = await parseContent('{"key": "value"}', {
          contentType: 'text/plain',
          format: 'json',
        })

        expect(result).toEqual({ data: { key: 'value' } })
      })

      it('should convert HTML to text when format is text', async () => {
        const html =
          '<html><body><h1>Title</h1><p>Hello world</p></body></html>'
        const result = await parseContent(html, {
          contentType: 'text/html',
          format: 'text',
        })

        expect(result.error).toBeUndefined()
        expect(typeof result.data).toBe('string')
        // @note html2text converts headings to uppercase
        expect(result.data.toLowerCase()).toContain('title')
        expect(result.data).toContain('Hello world')
        expect(result.data).not.toContain('<h1>')
        expect(result.data).not.toContain('<p>')
      })

      it('should convert XML to JSON when format is json', async () => {
        const xml = '<root><item>value</item></root>'
        const result = await parseContent(xml, {
          contentType: 'application/xml',
          format: 'json',
        })

        expect(result.error).toBeUndefined()
        expect(result.data).toEqual({ root: { item: 'value' } })
      })

      it('should convert XML to JSON when content looks like XML', async () => {
        const xml = '<?xml version="1.0"?><data><id>123</id></data>'
        const result = await parseContent(xml, {
          format: 'json',
        })

        expect(result.error).toBeUndefined()
        expect(result.data).toEqual({ data: { id: '123' } })
      })

      it('should handle XML with attributes', async () => {
        const xml = '<item id="1" name="test">content</item>'
        const result = await parseContent(xml, {
          contentType: 'text/xml',
          format: 'json',
        })

        expect(result.error).toBeUndefined()
        expect(result.data.item).toBeDefined()
        expect(result.data.item.id).toBe('1')
        expect(result.data.item.name).toBe('test')
      })

      it('should strip namespace prefixes from XML tags', async () => {
        const xml = `<?xml version="1.0"?>
          <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <ns1:GetResponse xmlns:ns1="http://example.com">
                <ns1:Result>success</ns1:Result>
              </ns1:GetResponse>
            </soap:Body>
          </soap:Envelope>`
        const result = await parseContent(xml, {
          contentType: 'text/xml',
          format: 'json',
        })

        expect(result.error).toBeUndefined()
        // namespace prefixes should be stripped
        expect(result.data.Envelope).toBeDefined()
        expect(result.data.Envelope.Body).toBeDefined()
        expect(result.data.Envelope.Body.GetResponse).toBeDefined()
        expect(result.data.Envelope.Body.GetResponse.Result).toBe('success')
      })

      it('should parse RSS and strip HTML from descriptions', async () => {
        const rss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article</title>
      <description><![CDATA[<p>This is <strong>bold</strong> text.</p>]]></description>
    </item>
  </channel>
</rss>`
        const result = await parseContent(rss, { format: 'rss' })

        expect(result.error).toBeUndefined()
        expect(result.data.rss.channel.title).toBe('Test Feed')
        expect(result.data.rss.channel.item.title).toBe('Article')
        // HTML should be stripped
        expect(result.data.rss.channel.item.description).not.toContain('<p>')
        expect(result.data.rss.channel.item.description).not.toContain(
          '<strong>'
        )
        expect(result.data.rss.channel.item.description).toContain('bold')
      })

      it('should parse Atom and strip HTML from content', async () => {
        const atom = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Blog</title>
  <entry>
    <title>Post</title>
    <summary><![CDATA[<p>A <em>brief</em> summary.</p>]]></summary>
  </entry>
</feed>`
        const result = await parseContent(atom, { format: 'atom' })

        expect(result.error).toBeUndefined()
        expect(result.data.feed.title).toBe('Test Blog')
        expect(result.data.feed.entry.title).toBe('Post')
        // HTML should be stripped
        expect(result.data.feed.entry.summary).not.toContain('<p>')
        expect(result.data.feed.entry.summary).not.toContain('<em>')
        expect(result.data.feed.entry.summary).toContain('brief')
        // xmlns should be stripped
        expect(result.data.feed.xmlns).toBeUndefined()
      })

      it('should strip xmlns attributes from RSS feeds', async () => {
        const rss = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article</title>
      <content:encoded><![CDATA[<p>Full content</p>]]></content:encoded>
    </item>
  </channel>
</rss>`
        const result = await parseContent(rss, { format: 'rss' })

        expect(result.error).toBeUndefined()
        expect(result.data.rss['xmlns:content']).toBeUndefined()
        expect(result.data.rss['xmlns:dc']).toBeUndefined()
        expect(result.data.rss.channel.title).toBe('Test Feed')
        // content:encoded becomes encoded after namespace stripping
        expect(result.data.rss.channel.item.encoded).toBeDefined()
      })

      it('should auto-detect RSS and strip HTML', async () => {
        const rss = `<rss version="2.0">
  <channel>
    <title>News</title>
    <item>
      <title>Story</title>
      <description><![CDATA[<div>Content</div>]]></description>
    </item>
  </channel>
</rss>`
        const result = await parseContent(rss)

        expect(result.error).toBeUndefined()
        expect(result.data.rss.channel.item.description).not.toContain('<div>')
        expect(result.data.rss.channel.item.description).toContain('Content')
      })

      it('should handle empty content', async () => {
        const result = await parseContent('', {
          contentType: 'text/plain',
        })

        expect(result.data).toBe('')
      })

      it('should handle whitespace-only content', async () => {
        const result = await parseContent('   \n\t  ', {
          contentType: 'text/plain',
        })

        expect(result.data).toBe('   \n\t  ')
      })

      it('should handle HTML with custom selectors', async () => {
        const html = `
          <html>
            <body>
              <header>Header content</header>
              <article><p>Article content</p></article>
              <footer>Footer content</footer>
            </body>
          </html>
        `
        const result = await parseContent(html, {
          contentType: 'text/html',
          selectors: 'article',
        })

        expect(result.error).toBeUndefined()
        expect(result.data).toContain('Article content')
      })

      it('should handle malformed HTML gracefully', async () => {
        const html = '<div><p>Unclosed paragraph<div>Nested div</div>'
        const result = await parseContent(html, {
          contentType: 'text/html',
        })

        expect(result.error).toBeUndefined()
        expect(typeof result.data).toBe('string')
      })
    })
  })

  describe('error detection', () => {
    describe('isErrorValue', () => {
      it('should treat non-empty arrays as errors', () => {
        expect(isErrorValue(['error'])).toBe(true)
        expect(isErrorValue([])).toBe(false)
      })

      it('should treat false as error (Slack pattern)', () => {
        expect(isErrorValue(false)).toBe(true)
        expect(isErrorValue(true)).toBe(false)
      })

      it('should treat non-empty strings as errors', () => {
        expect(isErrorValue('error message')).toBe(true)
        expect(isErrorValue('')).toBe(false)
        expect(isErrorValue('   ')).toBe(false)
      })

      it('should treat non-zero numbers as errors', () => {
        expect(isErrorValue(1)).toBe(true)
        expect(isErrorValue(-1)).toBe(true)
        expect(isErrorValue(0)).toBe(false)
      })

      it('should treat non-null objects as errors', () => {
        expect(isErrorValue({ error: true })).toBe(true)
        expect(isErrorValue(null)).toBe(false)
        expect(isErrorValue(undefined)).toBe(false)
      })
    })

    describe('detectError', () => {
      it('should detect error via jsonpath', () => {
        const data = { ok: false, error: 'something went wrong' }
        const error = detectError(data, { errorJsonpath: '$.error' })

        expect(error).toContain('Error detected via JSONPath')
        expect(error).toContain('something went wrong')
      })

      it('should detect error via jmespath', () => {
        const data = { ok: false, error: 'something went wrong' }
        const error = detectError(data, { errorJmespath: 'error' })

        expect(error).toContain('Error detected via JMESPath')
        expect(error).toContain('something went wrong')
      })

      it('should return undefined when no error detected', () => {
        const data = { ok: true, result: 'success' }
        const error = detectError(data, { errorJsonpath: '$.error' })

        expect(error).toBeUndefined()
      })

      it('should return undefined for non-object data', () => {
        const error = detectError('string data', { errorJsonpath: '$.error' })

        expect(error).toBeUndefined()
      })

      it('should handle jsonpath query failure gracefully', () => {
        const data = { ok: true }
        const error = detectError(data, { errorJsonpath: '$[invalid' })

        expect(error).toBeUndefined()
      })

      it('should handle jmespath query failure gracefully', () => {
        const data = { ok: true }
        const error = detectError(data, { errorJmespath: '[invalid' })

        expect(error).toBeUndefined()
      })
    })
  })

  describe('transformation functions', () => {
    describe('applyJsonpath', () => {
      it('should extract data using jsonpath', () => {
        const data = { items: [{ id: 1 }, { id: 2 }] }
        const result = applyJsonpath(data, '$.items[*].id')

        expect(result.data).toEqual([1, 2])
        expect(result.error).toBeUndefined()
      })

      it('should handle jsonpath that returns no matches', () => {
        const data = { items: [] }
        const result = applyJsonpath(data, '$.nonexistent')

        // @note jsonpath-plus returns empty array for no matches, doesn't throw
        expect(result.error).toBeUndefined()
      })

      it('should handle malformed jsonpath gracefully', () => {
        const data = { items: [] }
        const result = applyJsonpath(data, '$[invalid')

        // @note jsonpath-plus is lenient with some syntax - returns undefined
        expect(result.error).toBeUndefined()
      })

      it('should not match on an empty filter expression', () => {
        const data = { items: [] }
        // @note jsonpath-plus >= 10 treats an empty filter as a non-match
        // rather than a syntax error
        const result = applyJsonpath(data, '$[?()')

        expect(result.error).toBeUndefined()
        expect(result.data).toBeUndefined()
      })
    })

    describe('applyJmespath', () => {
      it('should extract data using jmespath', () => {
        const data = { items: [{ id: 1 }, { id: 2 }] }
        const result = applyJmespath(data, 'items[*].id')

        expect(result.data).toEqual([1, 2])
        expect(result.error).toBeUndefined()
      })

      it('should return error for invalid jmespath', () => {
        const data = { items: [] }
        const result = applyJmespath(data, '[invalid')

        expect(result.error).toContain('JMESPath transformation failed')
      })
    })

    describe('applyToon', () => {
      it('should encode object to toon format', () => {
        const data = { name: 'test', value: 123 }
        const result = applyToon(data)

        expect(result.data).toBeDefined()
        expect(result.error).toBeUndefined()
        expect(typeof result.data).toBe('string')
      })

      it('should return primitive values unchanged', () => {
        expect(applyToon(null).data).toBe(null)
        expect(applyToon('string').data).toBe('string')
        expect(applyToon(42).data).toBe(42)
      })
    })

    describe('applyMarkers', () => {
      it('should apply custom marker transformations', () => {
        const data = { timestamp: 1706500000 }
        const markers = {
          $doubleValue: (value) =>
            typeof value === 'number' ? value * 2 : value,
        }
        const result = applyMarkers(data, markers)

        expect(result.error).toBeUndefined()
        expect(result.data).toBeDefined()
      })

      it('should handle empty markers object', () => {
        const data = { key: 'value' }
        const result = applyMarkers(data, {})

        expect(result.error).toBeUndefined()
        expect(result.data).toEqual({ key: 'value' })
      })

      it('should handle nested objects with markers', () => {
        const data = {
          outer: {
            inner: { value: 10 },
          },
        }
        const markers = {
          $increment: (value) =>
            typeof value === 'number' ? value + 1 : value,
        }
        const result = applyMarkers(data, markers)

        expect(result.error).toBeUndefined()
      })
    })

    describe('applyRerank', () => {
      // @note applyRerank now delegates to lib/rerank.ts, which returns
      // { documents: [{ id }], usage } - mock that shape.
      const mockRerank = (documents, outputTokens = 1) => {
        rerankDocuments.mockResolvedValue({
          documents,
          usage: { model: 'rerank-v4-fast', inputTokens: 0, outputTokens },
        })
      }

      beforeEach(() => {
        rerankDocuments.mockReset()
        recordRerankTokenUsage.mockReset()
      })

      it('should rerank array data', async () => {
        const data = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
          { id: 3, name: 'Item 3' },
        ]
        const query = 'find item 2'

        mockRerank([{ id: '1' }, { id: '2' }])

        const result = await applyRerank(data, query)

        expect(rerankDocuments).toHaveBeenCalledWith(
          query,
          expect.arrayContaining([
            { id: '0', text: JSON.stringify(data[0]) },
            { id: '1', text: JSON.stringify(data[1]) },
            { id: '2', text: JSON.stringify(data[2]) },
          ]),
          { topN: DEFAULT_RERANK_TOP_N }
        )
        expect(result.data).toEqual([data[1], data[2]])
        expect(result.error).toBeUndefined()
      })

      it('should record rerank usage when a user is provided', async () => {
        mockRerank([{ id: '0' }])

        await applyRerank([{ id: 1 }], 'query', { user: { id: 'user-1' } })

        expect(recordRerankTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-1' },
          count: 1,
          model: 'rerank-v4-fast',
        })
      })

      it('should not record rerank usage when no user is provided', async () => {
        mockRerank([{ id: '0' }])

        await applyRerank([{ id: 1 }], 'query')

        expect(recordRerankTokenUsage).not.toHaveBeenCalled()
      })

      it('should rerank object with results property', async () => {
        const items = [{ id: 1 }, { id: 2 }]
        const data = { results: items }

        mockRerank([{ id: '0' }])

        const result = await applyRerank(data, 'query')

        expect(result.data).toEqual([items[0]])
      })

      it('should rerank object with items property', async () => {
        const items = [{ id: 1 }, { id: 2 }]
        const data = { items }

        mockRerank([{ id: '1' }])

        const result = await applyRerank(data, 'query')

        expect(result.data).toEqual([items[1]])
      })

      it('should rerank object with data property', async () => {
        const items = [{ id: 1 }, { id: 2 }]
        const data = { data: items }

        mockRerank([{ id: '0' }, { id: '1' }])

        const result = await applyRerank(data, 'query')

        expect(result.data).toEqual(items)
      })

      it('should return unchanged for non-array non-object data', async () => {
        const result = await applyRerank('string data', 'query')

        expect(result.data).toBe('string data')
        expect(rerankDocuments).not.toHaveBeenCalled()
      })

      it('should return unchanged for object without array properties', async () => {
        const data = { name: 'test', value: 123 }

        const result = await applyRerank(data, 'query')

        expect(result.data).toEqual(data)
        expect(rerankDocuments).not.toHaveBeenCalled()
      })

      it('should flatten nested arrays before reranking', async () => {
        const data = [[{ id: 1 }], [{ id: 2 }, { id: 3 }]]

        mockRerank([{ id: '2' }, { id: '0' }])

        const result = await applyRerank(data, 'query')

        // @note after flattening: [{id:1}, {id:2}, {id:3}], returns items at index 2 and 0
        expect(result.data).toEqual([{ id: 3 }, { id: 1 }])
      })

      it('should handle empty array', async () => {
        mockRerank([], 0)

        const result = await applyRerank([], 'query')

        expect(result.data).toEqual([])
        expect(rerankDocuments).toHaveBeenCalled()
      })

      it('should handle reranker errors gracefully', async () => {
        rerankDocuments.mockRejectedValue(new Error('Reranker failed'))

        const result = await applyRerank([{ id: 1 }], 'query')

        expect(result.error).toContain('Rerank transformation failed')
        expect(result.data).toEqual([{ id: 1 }])
      })
    })

    describe('transformData', () => {
      it('should apply jsonpath transformation', async () => {
        const data = { users: [{ name: 'Alice' }, { name: 'Bob' }] }
        const result = await transformData(data, {
          jsonpath: '$.users[*].name',
        })

        expect(result.data).toEqual(['Alice', 'Bob'])
      })

      it('should apply jmespath transformation', async () => {
        const data = { users: [{ name: 'Alice' }, { name: 'Bob' }] }
        const result = await transformData(data, { jmespath: 'users[*].name' })

        expect(result.data).toEqual(['Alice', 'Bob'])
      })

      it('should apply transformNestedStrings with json: true', async () => {
        const data = { payload: '{"nested": true}' }
        const result = await transformData(data, {
          transformNestedStrings: { json: true },
        })

        expect(result.data).toEqual({ payload: { nested: true } })
      })

      it('should apply toon encoding', async () => {
        const data = { key: 'value' }
        // toon is an internal option passed from transform when format: 'toon'
        const result = await transformData(data, { toon: true })

        expect(typeof result.data).toBe('string')
      })

      it('should chain multiple transformations', async () => {
        const data = { items: [{ data: '{"x": 1}' }, { data: '{"x": 2}' }] }
        const result = await transformData(data, {
          jsonpath: '$.items[*].data',
          transformNestedStrings: { json: true },
        })

        expect(result.data).toEqual([{ x: 1 }, { x: 2 }])
      })
    })
  })

  describe('full pipeline', () => {
    describe('transform', () => {
      it('should parse and transform json content', async () => {
        const content = '{"items": [{"id": 1}, {"id": 2}]}'
        const result = await transform(content, {
          contentType: 'application/json',
          jsonpath: '$.items[*].id',
        })

        expect(result.data).toEqual([1, 2])
        expect(result.error).toBeUndefined()
        expect(result.format).toBe('json')
      })

      it('should return detected format', async () => {
        const jsonResult = await transform('{"a": 1}', {
          contentType: 'application/json',
        })

        expect(jsonResult.format).toBe('json')

        const ndjsonResult = await transform('{"a": 1}\n{"b": 2}', {
          contentType: 'application/x-ndjson',
        })

        expect(ndjsonResult.format).toBe('ndjson')

        const htmlResult = await transform('<html><body>Hello</body></html>', {
          contentType: 'text/html',
        })

        expect(htmlResult.format).toBe('html')

        const xmlResult = await transform('<root><item/></root>', {
          contentType: 'application/xml',
        })

        expect(xmlResult.format).toBe('xml')
      })

      it('should return format even on parse error', async () => {
        const result = await transform('not valid json', {
          format: 'json',
        })

        expect(result.error).toContain('Parse failed')
        expect(result.format).toBe('json')
      })

      it('should return format even on error detection', async () => {
        const result = await transform('{"ok": false, "error": "failed"}', {
          contentType: 'application/json',
          errorJsonpath: '$.error',
        })

        expect(result.error).toContain('Error detected')
        expect(result.format).toBe('json')
      })

      it('should detect errors before transformation', async () => {
        const content = '{"ok": false, "error": "auth_failed"}'
        const result = await transform(content, {
          contentType: 'application/json',
          errorJsonpath: '$.error',
        })

        expect(result.error).toContain('Error detected via JSONPath')
      })

      it('should handle ndjson with transformations', async () => {
        const content = '{"id":1,"name":"a"}\n{"id":2,"name":"b"}'
        const result = await transform(content, {
          contentType: 'application/x-ndjson',
          jmespath: '[*].id',
        })

        expect(result.data).toEqual([1, 2])
      })

      it('should apply toon format', async () => {
        const content = '{"key": "value"}'
        const result = await transform(content, {
          contentType: 'application/json',
          format: 'toon',
        })

        expect(typeof result.data).toBe('string')
      })

      it('should convert XML to toon format', async () => {
        const xml = '<root><name>test</name><value>123</value></root>'
        const result = await transform(xml, {
          contentType: 'application/xml',
          format: 'toon',
        })

        expect(result.error).toBeUndefined()
        expect(typeof result.data).toBe('string')
        expect(result.format).toBe('toon')
      })

      it('should return parse error for invalid json', async () => {
        const content = 'not valid json'
        const result = await transform(content, {
          format: 'json',
        })

        expect(result.error).toContain('Parse failed')
      })

      it('should convert XML to JSON in pipeline', async () => {
        const xml =
          '<response><status>ok</status><data><id>42</id></data></response>'
        const result = await transform(xml, {
          contentType: 'application/xml',
          format: 'json',
          jmespath: 'response.data.id',
        })

        expect(result.error).toBeUndefined()
        expect(result.data).toBe('42')
        expect(result.format).toBe('json')
      })

      it('should auto-convert XML to JSON when jsonpath is provided', async () => {
        const xml =
          '<items><item><id>1</id></item><item><id>2</id></item></items>'
        const result = await transform(xml, {
          contentType: 'application/xml',
          jsonpath: '$.items.item[*].id',
        })

        expect(result.error).toBeUndefined()
        expect(result.data).toEqual(['1', '2'])
      })

      it('should auto-convert XML to JSON when jmespath is provided', async () => {
        const xml = '<root><name>test</name><value>123</value></root>'
        const result = await transform(xml, {
          contentType: 'application/xml',
          jmespath: 'root.value',
        })

        expect(result.error).toBeUndefined()
        expect(result.data).toBe('123')
      })

      it('should auto-convert XML to JSON when content looks like XML and jsonpath provided', async () => {
        const xml = '<?xml version="1.0"?><data><id>42</id></data>'
        const result = await transform(xml, {
          jsonpath: '$.data.id',
        })

        expect(result.error).toBeUndefined()
        expect(result.data).toBe('42')
      })

      it('should use custom formatMap to convert XML to JSON', async () => {
        const xml = '<root><value>123</value></root>'
        const result = await transform(xml, {
          contentType: 'application/xml',
          formatMap: { xml: 'json' },
        })

        expect(result.error).toBeUndefined()
        expect(result.data).toEqual({ root: { value: '123' } })
        expect(result.format).toBe('xml')
      })

      it('should use custom formatMap to convert HTML to JSON', async () => {
        const html = '<html><body><div>content</div></body></html>'
        const result = await transform(html, {
          contentType: 'text/html',
          formatMap: { html: 'json' },
        })

        expect(result.error).toBeUndefined()
        expect(typeof result.data).toBe('object')
        expect(result.format).toBe('html')
      })

      it('should use default formatMap (auto) for HTML to text conversion', async () => {
        const html = '<html><body><p>Hello world</p></body></html>'
        const result = await transform(html, {
          contentType: 'text/html',
          formatMap: 'auto',
        })

        expect(result.error).toBeUndefined()
        expect(typeof result.data).toBe('string')
        expect(result.data).toContain('Hello world')
        expect(result.format).toBe('html')
      })

      it('should use empty formatMap to skip default conversions', async () => {
        const xml = '<root><value>123</value></root>'
        const result = await transform(xml, {
          contentType: 'application/xml',
          formatMap: {},
        })

        // @note with empty formatMap, XML is not auto-converted to text
        // it uses the detected format's default behavior
        expect(result.error).toBeUndefined()
        expect(result.format).toBe('xml')
      })

      it('should chain jsonpath + transformNestedStrings + toon transformations', async () => {
        const content = JSON.stringify({
          items: [{ payload: '{"x": 1}' }, { payload: '{"x": 2}' }],
        })
        const result = await transform(content, {
          contentType: 'application/json',
          format: 'toon',
          jsonpath: '$.items[*].payload',
          transformNestedStrings: { json: true },
        })

        expect(result.error).toBeUndefined()
        expect(typeof result.data).toBe('string')
        expect(result.format).toBe('toon')
      })

      it('should handle empty content', async () => {
        const result = await transform('', {
          contentType: 'text/plain',
        })

        expect(result.data).toBe('')
        expect(result.format).toBe('raw')
      })

      it('should handle whitespace-only content', async () => {
        const result = await transform('   ', {
          contentType: 'text/plain',
        })

        expect(result.data).toBe('   ')
        expect(result.format).toBe('raw')
      })

      it('should apply toon to nested objects', async () => {
        const content = JSON.stringify({
          user: {
            name: 'Bob',
            address: {
              city: 'NYC',
            },
          },
        })
        const result = await transform(content, {
          contentType: 'application/json',
          format: 'toon',
        })

        expect(typeof result.data).toBe('string')
        expect(result.data).toContain('user')
        expect(result.data).toContain('Bob')
        expect(result.data).toContain('NYC')
        expect(result.error).toBeUndefined()
      })

      it('should apply toon to arrays', async () => {
        const content = JSON.stringify({
          items: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' },
          ],
        })
        const result = await transform(content, {
          contentType: 'application/json',
          format: 'toon',
        })

        expect(typeof result.data).toBe('string')
        expect(result.data).toContain('items')
        expect(result.data).toContain('Item 1')
        expect(result.data).toContain('Item 2')
        expect(result.error).toBeUndefined()
      })

      it('should apply NDJSON with toon format', async () => {
        const ndjson = `{"id":1,"name":"Item 1"}
{"id":2,"name":"Item 2"}`
        const result = await transform(ndjson, {
          contentType: 'application/x-ndjson',
          format: 'toon',
        })

        expect(typeof result.data).toBe('string')
        expect(result.data).toContain('Item 1')
        expect(result.data).toContain('Item 2')
        expect(result.error).toBeUndefined()
        expect(result.format).toBe('toon')
      })

      it('should apply NDJSON with transformNestedStrings', async () => {
        const ndjson = `{"dt":"2026-01-11","raw":"{\\"message\\":\\"hello\\"}"}
{"dt":"2026-01-12","raw":"{\\"message\\":\\"world\\"}"}`
        const result = await transform(ndjson, {
          contentType: 'application/x-ndjson',
          transformNestedStrings: { json: true },
        })

        expect(result.data).toEqual([
          { dt: '2026-01-11', raw: { message: 'hello' } },
          { dt: '2026-01-12', raw: { message: 'world' } },
        ])
        expect(result.error).toBeUndefined()
      })

      it('should parse deeply nested JSON strings', async () => {
        const content = JSON.stringify({
          outer: '{"inner":"{\\"deep\\":\\"value\\"}"}',
        })
        const result = await transform(content, {
          contentType: 'application/json',
          transformNestedStrings: { json: true },
        })

        expect(result.data).toEqual({
          outer: { inner: { deep: 'value' } },
        })
        expect(result.error).toBeUndefined()
      })

      it('should apply jmespath + toon chaining', async () => {
        const content = JSON.stringify({
          users: [{ name: 'Carol' }, { name: 'Dave' }],
        })
        const result = await transform(content, {
          contentType: 'application/json',
          format: 'toon',
          jmespath: 'users[*].name',
        })

        expect(typeof result.data).toBe('string')
        expect(result.error).toBeUndefined()
      })

      it('should return parse error when toon format applied to non-JSON content', async () => {
        const result = await transform('plain text content', {
          contentType: 'text/plain',
          format: 'toon',
        })

        // toon requires JSON-parseable content, so plain text fails parsing
        expect(result.data).toBe('plain text content')
        expect(result.error).toContain('Parse failed')
      })

      it('should transform RSS feed with HTML items to toon', async () => {
        // Simulates an RSS feed where each item's description contains HTML
        const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Tech News</title>
    <item>
      <title>Article One</title>
      <description><![CDATA[<p>This is the <strong>first</strong> article with <a href="#">links</a>.</p>]]></description>
    </item>
    <item>
      <title>Article Two</title>
      <description><![CDATA[<div><h2>Second article</h2><p>More content here.</p></div>]]></description>
    </item>
  </channel>
</rss>`

        const result = await transform(rssFeed, {
          contentType: 'application/rss+xml',
          format: 'toon',
          transformNestedStrings: { html: 'text' },
        })

        expect(result.error).toBeUndefined()
        expect(typeof result.data).toBe('string')
        // toon output should contain the text content from HTML
        expect(result.data).toContain('Article One')
        expect(result.data).toContain('Article Two')
        expect(result.data).toContain('first')
        // html2text converts h2 headings to uppercase
        expect(result.data.toLowerCase()).toContain('second article')
        // HTML tags should be stripped
        expect(result.data).not.toContain('<p>')
        expect(result.data).not.toContain('<strong>')
        expect(result.data).not.toContain('<div>')
      })
    })
  })
})
