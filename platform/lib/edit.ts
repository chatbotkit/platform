/**
 * Text manipulation utilities for line-based editing operations.
 *
 * @note all line numbers are 1-indexed (line 1 is the first line)
 * @note endLine is always inclusive when specified
 */

/**
 * Result of extracting lines from content.
 */
export interface ExtractLineRangeResult {
  /** The extracted content (may be empty if range is out of bounds) */
  outputContent: string
  /** Total number of lines in the original content */
  totalLines: number
}

/**
 * Extracts lines from content based on 1-indexed line range.
 *
 * @param content - The full text content to extract from
 * @param startLine - The line number to start from (1-indexed, optional)
 * @param endLine - The line number to end at, inclusive (1-indexed, optional)
 * @returns The extracted content and total line count
 *
 * @note line numbers are 1-indexed (line 1 is the first line)
 * @note endLine is inclusive (if endLine is 5, lines 1-5 are returned)
 *
 * @example
 * // Extract lines 2-4 from "a\nb\nc\nd\ne"
 * extractLineRange("a\nb\nc\nd\ne", 2, 4)
 * // => { outputContent: "b\nc\nd", totalLines: 5 }
 */
export function extractLineRange(
  content: string,
  startLine?: number,
  endLine?: number
): ExtractLineRangeResult {
  const lines = content.split('\n')
  const totalLines = lines.length

  // @note if no range specified, return full content

  if (startLine === undefined && endLine === undefined) {
    return { outputContent: content, totalLines }
  }

  // @note convert 1-indexed to 0-indexed for array slicing

  const start = startLine !== undefined ? Math.max(0, startLine - 1) : 0

  // @note endLine is inclusive, so we use it directly for slice (which is exclusive on end)

  const end = endLine !== undefined ? Math.min(totalLines, endLine) : totalLines

  return {
    outputContent: lines.slice(start, end).join('\n'),
    totalLines,
  }
}

/**
 * Result of applying line-based text edit.
 */
export interface ApplyLineEditResult {
  /** The final text after the edit */
  finalText: string
  /** Total number of lines in the original content (before edit) */
  totalLines: number
}

/**
 * Applies a line-based edit to content.
 *
 * Behavior:
 * - No startLine, no endLine: overwrites entire content with newText
 * - startLine only: inserts newText before that line
 * - startLine and endLine: replaces lines in that range with newText
 * - endLine without startLine: treated as overwrite
 *
 * @param content - The original text content
 * @param newText - The text to insert or replace with
 * @param startLine - The line number to start from (1-indexed, optional)
 * @param endLine - The line number to end at, inclusive (1-indexed, optional)
 * @returns The edited content and original line count
 *
 * @note line numbers are 1-indexed (line 1 is the first line)
 * @note endLine is inclusive when replacing a range
 * @note passing empty newText with startLine and endLine will delete that range
 *
 * @example
 * // Insert "new" before line 2 of "a\nb\nc"
 * applyLineEdit("a\nb\nc", "new", 2)
 * // => { finalText: "a\nnew\nb\nc", totalLines: 3 }
 *
 * @example
 * // Replace lines 2-3 of "a\nb\nc\nd" with "x\ny"
 * applyLineEdit("a\nb\nc\nd", "x\ny", 2, 3)
 * // => { finalText: "a\nx\ny\nd", totalLines: 4 }
 */
export function applyLineEdit(
  content: string,
  newText: string,
  startLine?: number,
  endLine?: number
): ApplyLineEditResult {
  const lines = content.split('\n')
  const totalLines = lines.length

  // @note determine edit mode based on parameters

  if (startLine === undefined && endLine === undefined) {
    // @note overwrite entire content

    return { finalText: newText, totalLines }
  }

  if (startLine !== undefined && endLine === undefined) {
    // @note insert before startLine

    const insertIndex = Math.min(startLine - 1, totalLines)
    const newLines = newText ? newText.split('\n') : []

    lines.splice(insertIndex, 0, ...newLines)

    return { finalText: lines.join('\n'), totalLines }
  }

  if (startLine !== undefined && endLine !== undefined) {
    // @note replace lines from startLine to endLine (inclusive)

    const start = Math.max(0, startLine - 1)
    const end = Math.min(totalLines, endLine)
    const deleteCount = end - start
    const newLines = newText ? newText.split('\n') : []

    lines.splice(start, deleteCount, ...newLines)

    return { finalText: lines.join('\n'), totalLines }
  }

  // @note endLine without startLine - treat as overwrite

  return { finalText: newText, totalLines }
}

/**
 * The range of lines that changed between two texts, as 1-indexed line numbers
 * in the new content.
 */
export interface ChangedLineRange {
  /** First changed line in the new content (1-indexed) */
  startLine: number
  /**
   * Last changed line in the new content (1-indexed). May be `startLine - 1`
   * for a pure deletion (an empty range anchored at the join point).
   */
  endLine: number
}

/**
 * Computes the range of lines that differ between two texts, expressed as
 * 1-indexed line numbers in the new content.
 *
 * Uses common-prefix / common-suffix bracketing, so it works regardless of how
 * the edit was produced (line-range splice, search/replace, full overwrite).
 *
 * @param beforeText - the content before the edit
 * @param afterText - the content after the edit
 * @returns the changed range, or null when the texts are identical
 *
 * @example
 * getChangedLineRange("a\nb\nc", "a\nX\nc")
 * // => { startLine: 2, endLine: 2 }
 */
export function getChangedLineRange(
  beforeText: string,
  afterText: string
): ChangedLineRange | null {
  if (beforeText === afterText) {
    return null
  }

  const before = beforeText.split('\n')
  const after = afterText.split('\n')

  let start = 0

  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  ) {
    start++
  }

  let endBefore = before.length - 1
  let endAfter = after.length - 1

  while (
    endBefore >= start &&
    endAfter >= start &&
    before[endBefore] === after[endAfter]
  ) {
    endBefore--
    endAfter--
  }

  return {
    startLine: start + 1,
    endLine: endAfter + 1,
  }
}

/**
 * Options for rendering an edit preview.
 */
export interface BuildEditPreviewOptions {
  /** unchanged context lines to include before/after each anchor (default 3) */
  context?: number
  /** maximum characters per rendered line before truncation (default 240) */
  maxLineLength?: number
}

/**
 * Renders a compact, line-numbered preview of the content around a changed
 * range so an agent can self-verify an edit without a second read.
 *
 * Shows a window around the first changed line and a window around the last
 * changed line. When the two windows are close they merge into one; otherwise
 * they are separated by a divider so large edits stay bounded. Changed lines
 * are prefixed with `>` and context lines with a space.
 *
 * @param content - the content to preview (the new content, after the edit)
 * @param range - the changed range (1-indexed, in `content`)
 * @param options - rendering options
 */
export function buildEditPreview(
  content: string,
  range: ChangedLineRange,
  options: BuildEditPreviewOptions = {}
): string {
  const context = options.context ?? 3
  const maxLineLength = options.maxLineLength ?? 240

  const lines = content.split('\n')
  const total = lines.length

  const clamp = (n: number): number => Math.max(1, Math.min(total, n))

  // @note anchor windows around the first and last changed lines; for a pure
  // deletion (endLine < startLine) both anchors collapse to the join point

  const startAnchor = clamp(range.startLine)
  const endAnchor =
    range.endLine >= range.startLine ? clamp(range.endLine) : startAnchor

  const win1Start = clamp(startAnchor - context)
  const win1End = clamp(startAnchor + context)
  const win2Start = clamp(endAnchor - context)
  const win2End = clamp(endAnchor + context)

  const width = String(total).length

  const renderLine = (lineNo: number): string => {
    const changed = lineNo >= range.startLine && lineNo <= range.endLine
    const marker = changed ? '>' : ' '

    let text = lines[lineNo - 1] ?? ''

    if (text.length > maxLineLength) {
      text = `${text.slice(0, maxLineLength)}…`
    }

    return `${marker} ${String(lineNo).padStart(width)} | ${text}`
  }

  const renderRange = (from: number, to: number): string[] => {
    const out: string[] = []

    for (let i = from; i <= to; i++) {
      out.push(renderLine(i))
    }

    return out
  }

  // @note merge windows when adjacent/overlapping, otherwise render two blocks
  // separated by a divider to keep large edits bounded

  if (win2Start <= win1End + 1) {
    return renderRange(win1Start, win2End).join('\n')
  }

  return [
    ...renderRange(win1Start, win1End),
    `  ${'.'.repeat(width)} | …`,
    ...renderRange(win2Start, win2End),
  ].join('\n')
}

/**
 * Net bracket balance of a text (opens minus closes, per bracket type).
 *
 * @note intentionally naive: it does not skip brackets inside strings or
 * comments. It is meant for *relative* comparison (before vs after an edit),
 * where constant noise cancels out.
 */
export interface BracketBalance {
  curly: number
  paren: number
  square: number
}

/**
 * Counts the net bracket balance of a text. See {@link BracketBalance}.
 */
export function getBracketBalance(text: string): BracketBalance {
  let curly = 0
  let paren = 0
  let square = 0

  for (let i = 0; i < text.length; i++) {
    switch (text[i]) {
      case '{':
        curly++

        break
      case '}':
        curly--

        break
      case '(':
        paren++

        break
      case ')':
        paren--

        break
      case '[':
        square++

        break
      case ']':
        square--

        break
    }
  }

  return { curly, paren, square }
}

/**
 * Describes how an edit changed bracket balance, returning a soft warning when
 * the edit appears to leave brackets unbalanced. Compares before vs after so a
 * file that was already "unbalanced" by the naive count (e.g. braces inside
 * strings) does not trigger false positives.
 *
 * @returns a warning string, or undefined when the edit did not worsen balance
 */
export function describeBalanceChange(
  before: BracketBalance,
  after: BracketBalance
): string | undefined {
  const parts: string[] = []

  const report = (
    label: string,
    open: string,
    close: string,
    beforeVal: number,
    afterVal: number
  ): void => {
    // @note only warn when the edit moved this bracket type and the result is
    // non-zero (i.e. now unbalanced)

    if (afterVal !== beforeVal && afterVal !== 0) {
      const detail =
        afterVal > 0
          ? `${afterVal} unclosed "${open}"`
          : `${-afterVal} extra "${close}"`

      parts.push(`${label} (${detail})`)
    }
  }

  report('curly braces', '{', '}', before.curly, after.curly)
  report('parentheses', '(', ')', before.paren, after.paren)
  report('square brackets', '[', ']', before.square, after.square)

  if (parts.length === 0) {
    return undefined
  }

  return `this edit may have left the file unbalanced: ${parts.join(
    ', '
  )}. Read the file back or run a syntax check to verify.`
}

/**
 * Describes when a requested line range falls outside the file, returning a
 * warning so an agent can tell that an edit did not land where its line numbers
 * implied (e.g. a startLine past the end of the file causes an append rather
 * than a replace).
 *
 * @param totalLines - the number of lines in the file BEFORE the edit
 * @param startLine - the requested start line (1-indexed), if any
 * @param endLine - the requested end line, inclusive (1-indexed), if any
 * @returns a warning string, or undefined when the range is in bounds
 */
export function describeRangeBounds(
  totalLines: number,
  startLine?: number,
  endLine?: number
): string | undefined {
  // @note no startLine means overwrite (or endLine-only, treated as overwrite);
  // there is no targeted range to validate

  if (startLine === undefined) {
    return undefined
  }

  const lineWord = totalLines === 1 ? 'line' : 'lines'

  let detail: string | undefined

  if (endLine === undefined) {
    // @note insert mode: positions 1..totalLines+1 are valid (the last appends)

    if (startLine > totalLines + 1) {
      detail = `startLine ${startLine} is past the end of the file (only ${totalLines} ${lineWord}); content was appended at the end`
    }
  } else if (startLine > endLine) {
    detail = `startLine ${startLine} is greater than endLine ${endLine}`
  } else if (startLine > totalLines) {
    detail = `the range ${startLine}-${endLine} starts past the end of the file (only ${totalLines} ${lineWord}); content was appended at the end instead of replacing those lines`
  } else if (endLine > totalLines) {
    detail = `endLine ${endLine} is past the end of the file (only ${totalLines} ${lineWord}); the range was clamped to line ${totalLines}`
  }

  if (!detail) {
    return undefined
  }

  return `requested line range looks off: ${detail}. Verify the edit landed where intended.`
}

/**
 * A self-verification summary for an edit.
 */
export interface EditSummary {
  /** whether the edit changed the content at all */
  changed: boolean
  /** first changed line in the new content (1-indexed), when changed */
  changedStartLine?: number
  /** last changed line in the new content (1-indexed), when a non-empty range */
  changedEndLine?: number
  /** line-numbered preview around the changed region */
  preview?: string
  /** soft warning when the edit appears to leave brackets unbalanced */
  warning?: string
}

/**
 * Produces a self-verification summary for an edit: the changed line range, a
 * line-numbered preview around it, and a soft bracket-balance warning. Intended
 * to be attached to write/replace tool results so an agent can confirm the edit
 * landed where it intended - even when the supplied range was wrong - without a
 * second read.
 *
 * @param beforeText - the content before the edit
 * @param afterText - the content after the edit
 * @param options - preview rendering options plus `warnOnBalance` (default true)
 */
export function summarizeEdit(
  beforeText: string,
  afterText: string,
  options: BuildEditPreviewOptions & { warnOnBalance?: boolean } = {}
): EditSummary {
  const { warnOnBalance = true, ...previewOptions } = options

  const range = getChangedLineRange(beforeText, afterText)

  if (!range) {
    return { changed: false }
  }

  return {
    changed: true,
    changedStartLine: range.startLine,
    changedEndLine:
      range.endLine >= range.startLine ? range.endLine : undefined,
    preview: buildEditPreview(afterText, range, previewOptions),
    warning: warnOnBalance
      ? describeBalanceChange(
          getBracketBalance(beforeText),
          getBracketBalance(afterText)
        )
      : undefined,
  }
}
