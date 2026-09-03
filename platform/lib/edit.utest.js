import {
  applyLineEdit,
  buildEditPreview,
  describeBalanceChange,
  describeRangeBounds,
  extractLineRange,
  getBracketBalance,
  getChangedLineRange,
  summarizeEdit,
} from '@/lib/edit'

describe('extractLineRange', () => {
  const content = 'line1\nline2\nline3\nline4\nline5'

  describe('no range specified', () => {
    it('should return full content when no startLine or endLine', () => {
      const result = extractLineRange(content)

      expect(result.outputContent).toEqual(content)
      expect(result.totalLines).toEqual(5)
    })

    it('should return full content when both undefined', () => {
      const result = extractLineRange(content, undefined, undefined)

      expect(result.outputContent).toEqual(content)
      expect(result.totalLines).toEqual(5)
    })
  })

  describe('startLine only', () => {
    it('should return lines from startLine to end (1-indexed)', () => {
      const result = extractLineRange(content, 2)

      expect(result.outputContent).toEqual('line2\nline3\nline4\nline5')
      expect(result.totalLines).toEqual(5)
    })

    it('should handle startLine at 1 (first line)', () => {
      const result = extractLineRange(content, 1)

      expect(result.outputContent).toEqual(content)
      expect(result.totalLines).toEqual(5)
    })

    it('should handle startLine at last line', () => {
      const result = extractLineRange(content, 5)

      expect(result.outputContent).toEqual('line5')
      expect(result.totalLines).toEqual(5)
    })

    it('should return empty string when startLine beyond content', () => {
      const result = extractLineRange(content, 10)

      expect(result.outputContent).toEqual('')
      expect(result.totalLines).toEqual(5)
    })
  })

  describe('endLine only', () => {
    it('should return lines from start to endLine (inclusive)', () => {
      const result = extractLineRange(content, undefined, 3)

      expect(result.outputContent).toEqual('line1\nline2\nline3')
      expect(result.totalLines).toEqual(5)
    })

    it('should handle endLine at last line', () => {
      const result = extractLineRange(content, undefined, 5)

      expect(result.outputContent).toEqual(content)
      expect(result.totalLines).toEqual(5)
    })

    it('should clamp endLine beyond content', () => {
      const result = extractLineRange(content, undefined, 100)

      expect(result.outputContent).toEqual(content)
      expect(result.totalLines).toEqual(5)
    })
  })

  describe('both startLine and endLine', () => {
    it('should return lines in range (both inclusive)', () => {
      const result = extractLineRange(content, 2, 4)

      expect(result.outputContent).toEqual('line2\nline3\nline4')
      expect(result.totalLines).toEqual(5)
    })

    it('should handle single line extraction', () => {
      const result = extractLineRange(content, 3, 3)

      expect(result.outputContent).toEqual('line3')
      expect(result.totalLines).toEqual(5)
    })

    it('should handle first line only', () => {
      const result = extractLineRange(content, 1, 1)

      expect(result.outputContent).toEqual('line1')
      expect(result.totalLines).toEqual(5)
    })

    it('should handle last line only', () => {
      const result = extractLineRange(content, 5, 5)

      expect(result.outputContent).toEqual('line5')
      expect(result.totalLines).toEqual(5)
    })

    it('should clamp endLine beyond content', () => {
      const result = extractLineRange(content, 4, 100)

      expect(result.outputContent).toEqual('line4\nline5')
      expect(result.totalLines).toEqual(5)
    })

    it('should return empty when startLine beyond content', () => {
      const result = extractLineRange(content, 10, 20)

      expect(result.outputContent).toEqual('')
      expect(result.totalLines).toEqual(5)
    })
  })

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const result = extractLineRange('')

      expect(result.outputContent).toEqual('')
      expect(result.totalLines).toEqual(1)
    })

    it('should handle single line content', () => {
      const result = extractLineRange('single')

      expect(result.outputContent).toEqual('single')
      expect(result.totalLines).toEqual(1)
    })

    it('should handle single line with range', () => {
      const result = extractLineRange('single', 1, 1)

      expect(result.outputContent).toEqual('single')
      expect(result.totalLines).toEqual(1)
    })

    it('should handle content with empty lines', () => {
      const contentWithEmpty = 'line1\n\nline3\n\nline5'
      const result = extractLineRange(contentWithEmpty, 2, 4)

      expect(result.outputContent).toEqual('\nline3\n')
      expect(result.totalLines).toEqual(5)
    })
  })
})

describe('applyLineEdit', () => {
  const content = 'line1\nline2\nline3\nline4\nline5'

  describe('overwrite mode (no line params)', () => {
    it('should overwrite entire content when no startLine or endLine', () => {
      const result = applyLineEdit(content, 'new content')

      expect(result.finalText).toEqual('new content')
      expect(result.totalLines).toEqual(5)
    })

    it('should overwrite with empty string', () => {
      const result = applyLineEdit(content, '')

      expect(result.finalText).toEqual('')
      expect(result.totalLines).toEqual(5)
    })

    it('should overwrite with multiline content', () => {
      const result = applyLineEdit(content, 'a\nb\nc')

      expect(result.finalText).toEqual('a\nb\nc')
      expect(result.totalLines).toEqual(5)
    })
  })

  describe('insert mode (startLine only)', () => {
    it('should insert before startLine', () => {
      const result = applyLineEdit(content, 'inserted', 2)

      expect(result.finalText).toEqual(
        'line1\ninserted\nline2\nline3\nline4\nline5'
      )
      expect(result.totalLines).toEqual(5)
    })

    it('should insert at beginning (startLine = 1)', () => {
      const result = applyLineEdit(content, 'first', 1)

      expect(result.finalText).toEqual(
        'first\nline1\nline2\nline3\nline4\nline5'
      )
      expect(result.totalLines).toEqual(5)
    })

    it('should insert at end when startLine beyond content', () => {
      const result = applyLineEdit(content, 'last', 10)

      expect(result.finalText).toEqual(
        'line1\nline2\nline3\nline4\nline5\nlast'
      )
      expect(result.totalLines).toEqual(5)
    })

    it('should insert multiline content', () => {
      const result = applyLineEdit(content, 'a\nb\nc', 3)

      expect(result.finalText).toEqual(
        'line1\nline2\na\nb\nc\nline3\nline4\nline5'
      )
      expect(result.totalLines).toEqual(5)
    })

    it('should handle empty insert (no-op)', () => {
      const result = applyLineEdit(content, '', 2)

      expect(result.finalText).toEqual(content)
      expect(result.totalLines).toEqual(5)
    })
  })

  describe('replace mode (startLine and endLine)', () => {
    it('should replace single line', () => {
      const result = applyLineEdit(content, 'replaced', 3, 3)

      expect(result.finalText).toEqual('line1\nline2\nreplaced\nline4\nline5')
      expect(result.totalLines).toEqual(5)
    })

    it('should replace range of lines', () => {
      const result = applyLineEdit(content, 'new', 2, 4)

      expect(result.finalText).toEqual('line1\nnew\nline5')
      expect(result.totalLines).toEqual(5)
    })

    it('should replace with multiline content', () => {
      const result = applyLineEdit(content, 'a\nb', 2, 3)

      expect(result.finalText).toEqual('line1\na\nb\nline4\nline5')
      expect(result.totalLines).toEqual(5)
    })

    it('should delete range when replacing with empty string', () => {
      const result = applyLineEdit(content, '', 2, 4)

      expect(result.finalText).toEqual('line1\nline5')
      expect(result.totalLines).toEqual(5)
    })

    it('should replace first line', () => {
      const result = applyLineEdit(content, 'first', 1, 1)

      expect(result.finalText).toEqual('first\nline2\nline3\nline4\nline5')
      expect(result.totalLines).toEqual(5)
    })

    it('should replace last line', () => {
      const result = applyLineEdit(content, 'last', 5, 5)

      expect(result.finalText).toEqual('line1\nline2\nline3\nline4\nlast')
      expect(result.totalLines).toEqual(5)
    })

    it('should clamp endLine beyond content', () => {
      const result = applyLineEdit(content, 'end', 4, 100)

      expect(result.finalText).toEqual('line1\nline2\nline3\nend')
      expect(result.totalLines).toEqual(5)
    })
  })

  describe('endLine only (treated as overwrite)', () => {
    it('should overwrite when only endLine provided', () => {
      const result = applyLineEdit(content, 'overwritten', undefined, 3)

      expect(result.finalText).toEqual('overwritten')
      expect(result.totalLines).toEqual(5)
    })
  })

  describe('edge cases', () => {
    it('should handle empty original content with overwrite', () => {
      const result = applyLineEdit('', 'new')

      expect(result.finalText).toEqual('new')
      expect(result.totalLines).toEqual(1)
    })

    it('should handle empty original content with insert', () => {
      const result = applyLineEdit('', 'new', 1)

      // @note empty string splits to [''], so inserting before line 1 produces ['new', '']
      expect(result.finalText).toEqual('new\n')
      expect(result.totalLines).toEqual(1)
    })

    it('should handle single line original content', () => {
      const result = applyLineEdit('single', 'replaced', 1, 1)

      expect(result.finalText).toEqual('replaced')
      expect(result.totalLines).toEqual(1)
    })

    it('should handle content with trailing newline', () => {
      const contentWithNewline = 'line1\nline2\n'
      const result = applyLineEdit(contentWithNewline, 'replaced', 2, 2)

      expect(result.finalText).toEqual('line1\nreplaced\n')
      expect(result.totalLines).toEqual(3)
    })
  })
})

describe('getChangedLineRange', () => {
  it('should return null when texts are identical', () => {
    expect(getChangedLineRange('a\nb\nc', 'a\nb\nc')).toBeNull()
  })

  it('should locate a single changed line (1-indexed)', () => {
    expect(getChangedLineRange('a\nb\nc', 'a\nX\nc')).toEqual({
      startLine: 2,
      endLine: 2,
    })
  })

  it('should locate a multi-line replacement that grows the file', () => {
    expect(getChangedLineRange('a\nb\nc', 'a\nX\nY\nZ\nc')).toEqual({
      startLine: 2,
      endLine: 4,
    })
  })

  it('should report an empty range (endLine < startLine) for a pure deletion', () => {
    // @note deleting line 2 from "a\nb\nc" => "a\nc"; the join point is line 2
    const range = getChangedLineRange('a\nb\nc', 'a\nc')

    expect(range.startLine).toEqual(2)
    expect(range.endLine).toEqual(1)
  })

  it('should locate an insertion', () => {
    expect(getChangedLineRange('a\nc', 'a\nb\nc')).toEqual({
      startLine: 2,
      endLine: 2,
    })
  })

  it('should treat a full overwrite as the whole new file', () => {
    expect(getChangedLineRange('old', 'new\nfile\nhere')).toEqual({
      startLine: 1,
      endLine: 3,
    })
  })
})

describe('buildEditPreview', () => {
  const content = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join('\n')

  // @note find the rendered row for a given source line (spacing-agnostic)
  const rowFor = (preview, text) =>
    preview.split('\n').find((line) => line.endsWith(`| ${text}`))

  it('should mark changed lines with ">" and show surrounding context', () => {
    const preview = buildEditPreview(content, { startLine: 10, endLine: 10 })

    expect(rowFor(preview, 'line10').startsWith('>')).toBe(true)
    expect(rowFor(preview, 'line9').startsWith('>')).toBe(false)
    expect(rowFor(preview, 'line9')).toBeDefined()
    expect(rowFor(preview, 'line11')).toBeDefined()
    // @note default context is 3 lines, so line 6 should not appear
    expect(rowFor(preview, 'line6')).toBeUndefined()
  })

  it('should merge windows when first and last changed lines are close', () => {
    const preview = buildEditPreview(content, { startLine: 9, endLine: 11 })

    // @note one continuous block, no divider
    expect(preview).not.toContain('| …')
    expect(rowFor(preview, 'line9').startsWith('>')).toBe(true)
    expect(rowFor(preview, 'line10').startsWith('>')).toBe(true)
    expect(rowFor(preview, 'line11').startsWith('>')).toBe(true)
  })

  it('should render two blocks with a divider for a large changed range', () => {
    const preview = buildEditPreview(content, { startLine: 2, endLine: 19 })

    expect(preview).toContain('| …')
    expect(rowFor(preview, 'line2').startsWith('>')).toBe(true)
    expect(rowFor(preview, 'line19').startsWith('>')).toBe(true)
    // @note middle lines are omitted
    expect(rowFor(preview, 'line10')).toBeUndefined()
  })

  it('should truncate very long lines', () => {
    const longContent = `short\n${'x'.repeat(50)}\nshort`
    const preview = buildEditPreview(
      longContent,
      { startLine: 2, endLine: 2 },
      { maxLineLength: 10 }
    )

    expect(preview).toContain(`${'x'.repeat(10)}…`)
    expect(preview).not.toContain('x'.repeat(11))
  })
})

describe('getBracketBalance', () => {
  it('should report zero for balanced text', () => {
    expect(getBracketBalance('function f() { return [1, 2] }')).toEqual({
      curly: 0,
      paren: 0,
      square: 0,
    })
  })

  it('should report positive counts for unclosed openers', () => {
    expect(getBracketBalance('a { b ( c [')).toEqual({
      curly: 1,
      paren: 1,
      square: 1,
    })
  })

  it('should report negative counts for extra closers', () => {
    expect(getBracketBalance('} ) )')).toEqual({
      curly: -1,
      paren: -2,
      square: 0,
    })
  })
})

describe('describeBalanceChange', () => {
  it('should return undefined when balance is unchanged', () => {
    const before = getBracketBalance('a { } b')
    const after = getBracketBalance('a { } c')

    expect(describeBalanceChange(before, after)).toBeUndefined()
  })

  it('should warn when an edit leaves an unclosed brace', () => {
    const before = getBracketBalance('a { }')
    const after = getBracketBalance('a {')

    const warning = describeBalanceChange(before, after)

    expect(warning).toContain('curly braces')
    expect(warning).toContain('1 unclosed')
  })

  it('should not warn about pre-existing imbalance that the edit did not change', () => {
    // @note a stray brace inside a string is naive-noise; if it is unchanged,
    // it must not trigger a false positive
    const before = getBracketBalance('const s = "{"')
    const after = getBracketBalance('const s = "{" // comment')

    expect(describeBalanceChange(before, after)).toBeUndefined()
  })
})

describe('describeRangeBounds', () => {
  it('should return undefined when there is no startLine (overwrite)', () => {
    expect(describeRangeBounds(10, undefined, undefined)).toBeUndefined()
  })

  it('should return undefined for an in-bounds replace range', () => {
    expect(describeRangeBounds(10, 2, 4)).toBeUndefined()
  })

  it('should return undefined for an in-bounds insert', () => {
    expect(describeRangeBounds(10, 5)).toBeUndefined()
  })

  it('should allow inserting at end-of-file + 1 (append)', () => {
    expect(describeRangeBounds(10, 11)).toBeUndefined()
  })

  it('should warn when an insert position is past end-of-file', () => {
    const warning = describeRangeBounds(10, 12)

    expect(warning).toContain('startLine 12 is past the end of the file')
    expect(warning).toContain('appended at the end')
  })

  it('should warn when a whole replace range starts past end-of-file', () => {
    const warning = describeRangeBounds(10, 50, 60)

    expect(warning).toContain('range 50-60 starts past the end of the file')
    expect(warning).toContain('only 10 lines')
  })

  it('should warn when endLine exceeds the file (clamped)', () => {
    const warning = describeRangeBounds(10, 4, 100)

    expect(warning).toContain('endLine 100 is past the end of the file')
    expect(warning).toContain('clamped to line 10')
  })

  it('should warn when startLine is greater than endLine', () => {
    const warning = describeRangeBounds(10, 6, 3)

    expect(warning).toContain('startLine 6 is greater than endLine 3')
  })

  it('should use singular "line" for a one-line file', () => {
    const warning = describeRangeBounds(1, 5, 8)

    expect(warning).toContain('only 1 line)')
  })
})

describe('summarizeEdit', () => {
  it('should report no change for identical content', () => {
    expect(summarizeEdit('a\nb', 'a\nb')).toEqual({ changed: false })
  })

  it('should produce a preview and changed range for an edit', () => {
    const before = 'a\nb\nc\nd\ne'
    const after = 'a\nb\nX\nd\ne'

    const summary = summarizeEdit(before, after)

    expect(summary.changed).toBe(true)
    expect(summary.changedStartLine).toBe(3)
    expect(summary.changedEndLine).toBe(3)

    const changedRow = summary.preview
      .split('\n')
      .find((line) => line.endsWith('| X'))

    expect(changedRow.startsWith('>')).toBe(true)
  })

  it('should surface a balance warning when the edit unbalances brackets', () => {
    const before = 'function f() {\n  return 1\n}'
    const after = 'function f() {\n  return 1'

    const summary = summarizeEdit(before, after)

    expect(summary.warning).toContain('unbalanced')
  })

  it('should omit the balance warning when warnOnBalance is false', () => {
    const before = 'function f() {\n  return 1\n}'
    const after = 'function f() {\n  return 1'

    const summary = summarizeEdit(before, after, { warnOnBalance: false })

    expect(summary.warning).toBeUndefined()
  })

  it('should omit changedEndLine for a pure deletion', () => {
    const summary = summarizeEdit('a\nb\nc', 'a\nc')

    expect(summary.changed).toBe(true)
    expect(summary.changedStartLine).toBe(2)
    expect(summary.changedEndLine).toBeUndefined()
  })
})
