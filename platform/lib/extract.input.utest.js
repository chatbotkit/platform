import { extractInput } from '@/lib/extract.input'

describe('extractInput', () => {
  it('should gracefully handle null input', () => {
    const input = null

    const expected = ''

    expect(extractInput(input)).toEqual(expected)
  })

  it('should gracefully handle undefined input', () => {
    const input = undefined

    const expected = ''

    expect(extractInput(input)).toEqual(expected)
  })

  it('should return an empty string when input is an empty object', () => {
    const input = {}

    const expected = ''

    expect(extractInput(input)).toEqual(expected)
  })

  it('should return the same string when input is a string', () => {
    const input = 'Hello, world!'

    const expected = 'Hello, world!'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should extract the "text" property from an object', () => {
    const input = {
      text: 'This is a sample text.',
      otherProp: 123,
    }

    const expected = 'This is a sample text.'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should extract the "input" property of an object', () => {
    const input = {
      input: 'This is another sample input.',
      otherProp: 456,
    }

    const expected = 'This is another sample input.'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should prioritize "text" over "input" if both are present', () => {
    const input = {
      text: 'Text property takes precedence.',
      input: 'Input property.',
    }

    const expected = 'Text property takes precedence.'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should extract the "query" property from an object', () => {
    const input = {
      query: 'This is a query string.',
      otherProp: 789,
    }

    const expected = 'This is a query string.'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should extract the "search" property from an object', () => {
    const input = {
      search: 'This is a search string.',
      otherProp: 789,
    }

    const expected = 'This is a search string.'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should extract the "action" property from an object', () => {
    const input = {
      action: 'This is an action string.',
      otherProp: 789,
    }

    const expected = 'This is an action string.'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should extract the "reason" property from an object', () => {
    const input = {
      reason: 'This is a reason string.',
      otherProp: 789,
    }

    const expected = 'This is a reason string.'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should extract the "url" property from an object', () => {
    const input = {
      url: 'https://example.com',
      otherProp: 789,
    }

    const expected = 'https://example.com'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should prioritize properties in correct order: text > input > query > search > action > reason > url', () => {
    const input = {
      url: 'https://example.com',
      reason: 'Some reason',
      action: 'Some action',
      search: 'Some search',
      query: 'Some query',
      input: 'Some input',
      text: 'Some text',
    }

    const expected = 'Some text'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should prioritize "input" over lower precedence properties', () => {
    const input = {
      url: 'https://example.com',
      reason: 'Some reason',
      action: 'Some action',
      search: 'Some search',
      query: 'Some query',
      input: 'Some input',
    }

    const expected = 'Some input'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should prioritize "query" over lower precedence properties', () => {
    const input = {
      url: 'https://example.com',
      reason: 'Some reason',
      action: 'Some action',
      search: 'Some search',
      query: 'Some query',
    }

    const expected = 'Some query'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should fall back to yaml if property exists but is not a string', () => {
    const input = {
      text: 123, // not a string
      input: null, // not a string
      query: undefined, // not a string
      otherProp: 'value',
    }

    const expected = 'text: 123 input: null query: undefined otherProp: value'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should handle mixed string and non-string properties correctly', () => {
    const input = {
      text: 123, // not a string, should be skipped
      input: 'Valid input string', // string, should be returned
      query: null, // not a string, should be skipped
    }

    const expected = 'Valid input string'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should return a yaml representation of the input object if no priority properties are present', () => {
    // @note the yaml should remove new lines and extra spaces

    const input = {
      otherProp: 'No relevant properties here.',
      anotherProp: 789,
    }

    const expected = 'otherProp: No relevant properties here. anotherProp: 789'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should recurse into a nested "input" object instead of rendering "[object Object]"', () => {
    const input = {
      input: {
        query: 'find cats',
      },
    }

    const expected = 'find cats'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should recurse into a nested priority object and respect inner precedence', () => {
    const input = {
      input: {
        url: 'https://example.com',
        reason: 'Some reason',
        text: 'Inner text wins',
      },
    }

    const expected = 'Inner text wins'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should not render "[object Object]" for object values in the yaml fallback', () => {
    const input = {
      otherProp: {
        nested: 'value',
      },
    }

    const expected = 'otherProp: nested: value'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should render array values as compact json in the yaml fallback', () => {
    const input = {
      items: ['a', 'b'],
    }

    const expected = 'items: ["a","b"]'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should fall back to the next priority key when a nested object yields nothing', () => {
    const input = {
      input: {},
      query: 'fallback query',
    }

    const expected = 'fallback query'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should remove HTML markup from string input', () => {
    const input = '<p>Hello <strong>world</strong>!</p>'

    const expected = 'Hello world!'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should remove XML markup from string input', () => {
    const input =
      '<message><greeting>Hello</greeting> <name>John</name></message>'

    const expected = 'Hello John'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should remove HTML markup from text property', () => {
    const input = {
      text: '<div>This is <em>formatted</em> text with <a href="#">links</a></div>',
      otherProp: 123,
    }

    const expected = 'This is formatted text with links'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should remove HTML markup from input property', () => {
    const input = {
      input: '<h1>Title</h1><p>Some content with <span>spans</span></p>',
      otherProp: 456,
    }

    const expected = 'Title Some content with spans'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should remove HTML markup from query property', () => {
    const input = {
      query: '<script>alert("test")</script>Find <b>bold</b> text',
      otherProp: 789,
    }

    const expected = 'alert("test") Find bold text'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should handle self-closing HTML tags', () => {
    const input = {
      text: 'Line 1<br/>Line 2<hr/>Line 3<img src="test.jpg"/>End',
    }

    const expected = 'Line 1 Line 2 Line 3 End'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should handle malformed HTML gracefully', () => {
    const input = {
      text: '<div>Unclosed tag<p>Another <span>nested content</div>',
    }

    const expected = 'Unclosed tag Another nested content'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should preserve entities after HTML removal', () => {
    const input = {
      text: '<p>&lt; &gt; &amp; &quot; &#39;</p>',
    }

    const expected = '&lt; &gt; &amp; &quot; &#39;'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should handle nested HTML tags', () => {
    const input = {
      text: '<div class="outer"><span class="inner"><strong>Nested <em>content</em></strong></span></div>',
    }

    const expected = 'Nested content'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should remove HTML from multiple line content', () => {
    const input = {
      text: `<html>
        <body>
          <h1>Title</h1>
          <p>First paragraph</p>
          <p>Second paragraph</p>
        </body>
      </html>`,
    }

    const expected = 'Title First paragraph Second paragraph'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should handle mixed content with HTML and plain text', () => {
    const input = {
      text: 'Plain text <strong>bold text</strong> more plain text',
    }

    const expected = 'Plain text bold text more plain text'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should parse JSON string with text property', () => {
    const input = JSON.stringify({
      text: 'This is text from JSON',
      otherProp: 123,
    })

    const expected = 'This is text from JSON'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should parse JSON string with input property', () => {
    const input = JSON.stringify({
      input: 'This is input from JSON',
      otherProp: 456,
    })

    const expected = 'This is input from JSON'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should parse JSON string and respect property precedence', () => {
    const input = JSON.stringify({
      url: 'https://example.com',
      reason: 'Some reason',
      action: 'Some action',
      search: 'Some search',
      query: 'Some query',
      input: 'Some input',
      text: 'Some text',
    })

    const expected = 'Some text'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should parse JSON string and fall back to YAML if no priority properties', () => {
    const input = JSON.stringify({
      otherProp: 'No relevant properties here.',
      anotherProp: 789,
    })

    const expected = 'otherProp: No relevant properties here. anotherProp: 789'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should parse JSON string with HTML content', () => {
    const input = JSON.stringify({
      text: '<p>HTML <strong>content</strong> in JSON</p>',
      otherProp: 123,
    })

    const expected = 'HTML content in JSON'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should handle nested JSON objects', () => {
    const input = JSON.stringify({
      text: 'Top level text',
      nested: {
        text: 'Nested text should be ignored',
      },
    })

    const expected = 'Top level text'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should return original string if JSON parsing fails', () => {
    const input = 'This is not valid JSON {'

    const expected = 'This is not valid JSON {'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should return original string if JSON parses to primitive', () => {
    const input = '"Just a string"'

    const expected = '"Just a string"'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should return original string if JSON parses to number', () => {
    const input = '123'

    const expected = '123'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should return original string if JSON parses to boolean', () => {
    const input = 'true'

    const expected = 'true'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should return original string if JSON parses to null', () => {
    const input = 'null'

    const expected = 'null'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should handle JSON array (should return original string)', () => {
    const input = '["item1", "item2"]'

    const expected = '["item1", "item2"]'

    expect(extractInput(input)).toEqual(expected)
  })

  it('should handle empty JSON object from string', () => {
    const input = '{}'

    const expected = ''

    expect(extractInput(input)).toEqual(expected)
  })

  it('should handle complex JSON with mixed property types', () => {
    const input = JSON.stringify({
      text: 123, // not a string, should be skipped
      input: 'Valid input from JSON',
      query: null, // not a string, should be skipped
      other: 'value',
    })

    const expected = 'Valid input from JSON'

    expect(extractInput(input)).toEqual(expected)
  })
})
