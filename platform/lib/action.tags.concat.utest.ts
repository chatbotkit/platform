/* eslint-disable no-undef */
import {
  BooleanField,
  Concat,
  NumberField,
  OMIT_FIELD,
  StringField,
  substituteFields,
} from '@/lib/action.tags'

describe('action.tags Concat.substitute', () => {
  // @note regression coverage: an optional field with no value and
  // no default resolves to the OMIT_FIELD symbol; the concat used to pass that
  // symbol straight into join(''), throwing "Cannot convert a Symbol value to a
  // string". Omitted optional fields must instead contribute nothing.

  it('omits an optional string field that was not provided', () => {
    const concat = new Concat([
      'Hello ',
      new StringField({ name: 'suffix', optional: true }),
      '!',
    ])

    expect(() => concat.substitute({})).not.toThrow()
    expect(concat.substitute({})).toBe('Hello !')
  })

  it('includes an optional string field when provided', () => {
    const concat = new Concat([
      'Hello ',
      new StringField({ name: 'suffix', optional: true }),
      '!',
    ])

    expect(concat.substitute({ suffix: 'world' })).toBe('Hello world!')
  })

  it('omits optional number and boolean fields that were not provided', () => {
    const concat = new Concat([
      'a',
      new NumberField({ name: 'n', optional: true }),
      new BooleanField({ name: 'b', optional: true }),
      'z',
    ])

    expect(() => concat.substitute({})).not.toThrow()
    expect(concat.substitute({})).toBe('az')
    // @note never emit the raw symbol description into the prompt
    expect(concat.substitute({})).not.toContain('Symbol')
    expect(concat.substitute({})).not.toContain(OMIT_FIELD.toString())
  })

  it('substitutes optional number and boolean fields when provided', () => {
    const concat = new Concat([
      new NumberField({ name: 'n', optional: true }),
      '-',
      new BooleanField({ name: 'b', optional: true }),
    ])

    expect(concat.substitute({ n: 42, b: true })).toBe('42-true')
  })

  it('handles an optional field inside a !concat end-to-end', () => {
    const input = [
      '!concat',
      '- "prefix-"',
      '- !string?',
      '    name: suffix',
    ].join('\n')

    expect(() => substituteFields(input, {})).not.toThrow()

    const result = substituteFields(input, {})

    expect(result).toContain('prefix-')
    expect(result).not.toContain('Symbol')
  })
})
