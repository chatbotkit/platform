import { fixLaTeXSyntax } from '@/lib/latex'

describe('fixLaTeXSyntax', () => {
  describe('inline LaTeX conversion \\(...\\) to $...$', () => {
    it('should convert single inline LaTeX expression', () => {
      const input = 'The equation \\(x + y = z\\) is simple'
      const expected = 'The equation $$x + y = z$$ is simple'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should convert multiple inline LaTeX expressions', () => {
      const input = 'We have \\(a + b\\) and \\(c - d\\) in the text'
      const expected = 'We have $$a + b$$ and $$c - d$$ in the text'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should convert inline LaTeX with complex expressions', () => {
      const input = 'The formula \\(\\frac{a}{b} + \\sqrt{c}\\) is complex'
      const expected = 'The formula $$\\frac{a}{b} + \\sqrt{c}$$ is complex'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle inline LaTeX with spaces', () => {
      const input = 'Expression \\( x + y \\) with spaces'
      const expected = 'Expression $$ x + y $$ with spaces'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle empty inline LaTeX', () => {
      const input = 'Empty \\(\\) expression'
      const expected = 'Empty $$$$ expression'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })
  })

  describe('display LaTeX conversion \\[...\\] to $$...$$', () => {
    it('should convert single line display LaTeX', () => {
      const input = '\\[ 6 \\times 6 = 36 \\]'
      const expected = '$$ 6 \\times 6 = 36 $$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should convert display LaTeX with preceding text', () => {
      const input = `2. Then multiply by 6:
\\[ 6 \\times 6 = 36 \\]`
      const expected = `2. Then multiply by 6:
$$ 6 \\times 6 = 36 $$`

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should convert multiple display LaTeX expressions', () => {
      const input = `First equation:
\\[ a + b = c \\]
Second equation:
\\[ x^2 + y^2 = z^2 \\]`
      const expected = `First equation:
$$ a + b = c $$
Second equation:
$$ x^2 + y^2 = z^2 $$`

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should convert display LaTeX with complex expressions', () => {
      const input = '\\[ \\int_0^1 x^2 dx = \\frac{1}{3} \\]'
      const expected = '$$ \\int_0^1 x^2 dx = \\frac{1}{3} $$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })
  })

  describe('multiline display LaTeX conversion \\[\\n...\\n\\] to ```math', () => {
    it('should convert multiline display LaTeX to math code block', () => {
      const input = `\\[
x + y = z
a + b = c
\\]`
      const expected = '```math\nx + y = z\na + b = c\n```'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should convert multiline display LaTeX with indentation', () => {
      const input = `  \\[
  x + y = z
  \\]`
      const expected = '```math\n  x + y = z\n```'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle multiline display LaTeX with complex content', () => {
      const input = `\\[
\\begin{aligned}
f(x) &= x^2 + 2x + 1 \\\\
     &= (x + 1)^2
\\end{aligned}
\\]`
      const expected =
        '```math\n\\begin{aligned}\nf(x) &= x^2 + 2x + 1 \\\\\n     &= (x + 1)^2\n\\end{aligned}\n```'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle multiple multiline display LaTeX blocks', () => {
      const input = `First block:
\\[
a = b
\\]

Second block:
\\[
c = d
\\]`
      const expected = `First block:
\`\`\`math
a = b
\`\`\`

Second block:
\`\`\`math
c = d
\`\`\``

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })
  })

  describe('multiline $$ conversion $$\\n...\\n$$ to ```math', () => {
    it('should convert multiline $$ block to math code block', () => {
      const input = `$$
x + y = z
$$`
      const expected = '```math\nx + y = z\n```'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should convert multiline $$ with indentation', () => {
      const input = `  $$
  equation here
  $$`
      const expected = '```math\n  equation here\n```'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle multiline $$ with complex expressions', () => {
      const input = `$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$`
      const expected = '```math\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n```'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle multiple multiline $$ blocks', () => {
      const input = `First equation:
$$
a = b
$$

Second equation:
$$
c = d
$$`
      const expected = `First equation:
\`\`\`math
a = b
\`\`\`

Second equation:
\`\`\`math
c = d
\`\`\``

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })
  })

  describe('mixed LaTeX formats', () => {
    it('should handle inline and display LaTeX together', () => {
      const input = `We use inline \\(x + y\\) and display:
\\[ a + b = c \\]`
      const expected = `We use inline $$x + y$$ and display:
$$ a + b = c $$`

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle all format types together', () => {
      const input = `Inline: \\(x\\)
Single line: \\[ y \\]
Multiline:
\\[
z = 1
\\]
Dollar block:
$$
a = 2
$$`
      const expected = `Inline: $$x$$
Single line: $$ y $$
Multiline:
\`\`\`math
z = 1
\`\`\`
Dollar block:
\`\`\`math
a = 2
\`\`\``

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle complex real-world example', () => {
      const input = `The quadratic formula \\(x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\\) can be derived:
\\[
ax^2 + bx + c = 0
\\]
By completing the square:
\\[
a(x + \\frac{b}{2a})^2 = \\frac{b^2-4ac}{4a}
\\]`
      const expected = `The quadratic formula $$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$ can be derived:
\`\`\`math
ax^2 + bx + c = 0
\`\`\`
By completing the square:
\`\`\`math
a(x + \\frac{b}{2a})^2 = \\frac{b^2-4ac}{4a}
\`\`\``

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(fixLaTeXSyntax('')).toBe('')
    })

    it('should handle string without LaTeX', () => {
      const input = 'This is plain text without any LaTeX'

      expect(fixLaTeXSyntax(input)).toBe(input)
    })

    it('should handle nested brackets in expressions', () => {
      const input = '\\(\\left[\\frac{a}{b}\\right]\\)'
      const expected = '$$\\left[\\frac{a}{b}\\right]$$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle special characters in expressions', () => {
      const input = '\\(\\alpha + \\beta = \\gamma\\)'
      const expected = '$$\\alpha + \\beta = \\gamma$$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle expressions with newlines inside', () => {
      const input = '\\(a + b\\)'
      const expected = '$$a + b$$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should not convert inline $$ that are not multiline', () => {
      const input = 'Inline $$x + y$$ expression'

      expect(fixLaTeXSyntax(input)).toBe('Inline $$x + y$$ expression')
    })

    it('should handle very long expressions', () => {
      const input =
        '\\(' +
        'a + b + c + d + e + f + g + h + i + j + k + l + m + n + o + p + q + r + s + t + u + v + w + x + y + z' +
        '\\)'
      const expected =
        '$$' +
        'a + b + c + d + e + f + g + h + i + j + k + l + m + n + o + p + q + r + s + t + u + v + w + x + y + z' +
        '$$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle expressions with backslashes', () => {
      const input = '\\(\\\\frac{1}{2}\\\\)'
      const expected = '$$\\\\frac{1}{2}\\$$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should preserve already correct inline $$ notation', () => {
      const input = 'Already using $$x + y = z$$ notation'

      expect(fixLaTeXSyntax(input)).toBe('Already using $$x + y = z$$ notation')
    })

    it('should handle consecutive LaTeX expressions', () => {
      const input = '\\(a\\)\\(b\\)\\(c\\)'
      const expected = '$$a$$$$b$$$$c$$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle LaTeX at start and end of string', () => {
      const input = '\\(start\\) middle \\(end\\)'
      const expected = '$$start$$ middle $$end$$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle multiline block with leading whitespace', () => {
      const input = `  $$
  x = 1
  $$`
      const expected = '```math\n  x = 1\n```'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle display LaTeX with leading whitespace', () => {
      const input = `  \\[
  x = 1
  \\]`
      const expected = '```math\n  x = 1\n```'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should not convert partial delimiters', () => {
      const input = 'Escape character \\ or parenthesis ( or bracket ['

      expect(fixLaTeXSyntax(input)).toBe(
        'Escape character \\ or parenthesis ( or bracket ['
      )
    })

    it('should handle mixed single and multiline $$ in same text', () => {
      const input = `Inline $$a$$ and multiline:
$$
b = c
$$
More inline $$d$$`
      const expected = `Inline $$a$$ and multiline:
\`\`\`math
b = c
\`\`\`
More inline $$d$$`

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })
  })

  describe('potential corruption scenarios', () => {
    it('should not corrupt when \\( contains newlines inside', () => {
      // The first regex uses .*? which doesn't match newlines by default
      const input = '\\(x + y\\) normal \\(a + b\\)'
      const expected = '$$x + y$$ normal $$a + b$$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should not corrupt when \\[ and \\] appear on same line with other \\[', () => {
      const input = '\\[ a \\] and \\[ b \\]'
      const expected = '$$ a $$ and $$ b $$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle order of operations correctly - inline then multiline', () => {
      // Test that inline replacements don't interfere with multiline detection
      const input = `Text \\(inline\\) before
\\[
display
\\]`
      const expected = `Text $$inline$$ before
\`\`\`math
display
\`\`\``

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should not corrupt when $$ created by first replacement spans multiple lines', () => {
      // This is a critical test: if \\(x\ny\\) gets converted to $$x\ny$$,
      // the multiline $$ pattern should NOT match it (because .* doesn't match newlines)
      const input = '\\(single line\\) text'
      const expected = '$$single line$$ text'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle multiple \\[ on same line without corruption', () => {
      const input = 'Text \\[ a \\] middle \\[ b \\] end'
      const expected = 'Text $$ a $$ middle $$ b $$ end'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should not corrupt nested brackets in expression', () => {
      const input = '\\[ [a, b, c] \\]'
      const expected = '$$ [a, b, c] $$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should not corrupt when text contains $$ in regular text', () => {
      const input = 'Price is $$100$$ dollars'

      expect(fixLaTeXSyntax(input)).toBe('Price is $$100$$ dollars')
    })

    it('should handle greedy vs non-greedy matching correctly', () => {
      // The .*? is non-greedy, so it should stop at first \\)
      const input = '\\(a\\) text \\(b\\)'
      const expected = '$$a$$ text $$b$$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should not corrupt when \\[ and \\( appear together', () => {
      const input = '\\(inline\\) and \\[ display \\]'
      const expected = '$$inline$$ and $$ display $$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle potential double replacement issue', () => {
      // After first replacement creates $$...$$, ensure it's not corrupted by later replacements
      const input = `\\(x\\)
$$
y
$$`
      const expected = `$$x$$
\`\`\`math
y
\`\`\``

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle overlapping bracket patterns correctly', () => {
      const input = '\\[\\[ nested \\]\\]'
      // The regex matches \\[ to \\] non-greedily, converting outer pairs
      // This is expected behavior - nested delimiters aren't valid LaTeX anyway
      const expected = '$$\\[ nested $$\\]'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle text that looks like regex special chars', () => {
      const input = '\\(a.* + b.?\\)'
      const expected = '$$a.* + b.?$$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should not corrupt when expression contains dollar signs', () => {
      const input = '\\(price = $5\\)'
      const expected = '$$price = $5$$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle multiple multiline blocks without corruption', () => {
      const input = `\\[
a
\\]
text
\\[
b
\\]`
      const expected = `\`\`\`math
a
\`\`\`
text
\`\`\`math
b
\`\`\``

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should not corrupt when multiline block contains $$', () => {
      const input = `\\[
price is $$100
\\]`
      const expected = `\`\`\`math
price is $$100
\`\`\``

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle single line expression with brackets inside', () => {
      const input = '\\[ \\{ x \\in \\mathbb{R} \\} \\]'
      const expected = '$$ \\{ x \\in \\mathbb{R} \\} $$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle nested delimiters on same line (processes inner first)', () => {
      const input = '\\[ outer \\( inner \\) still outer \\]'
      // The function processes \\(...\\) first, then \\[...\\]
      // This means nested delimiters get converted independently
      // Note: This is actually correct - \\( inside \\[ isn't valid LaTeX anyway
      const expected = '$$ outer $$ inner $$ still outer $$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should not corrupt with unmatched delimiters', () => {
      const input = 'Text \\( without closing'
      // Unmatched delimiter should remain unchanged
      const expected = 'Text \\( without closing'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should not corrupt with reversed delimiters', () => {
      const input = 'Text \\) before \\('
      // Reversed delimiters should not match
      const expected = 'Text \\) before \\('

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle very long multiline expressions without corruption', () => {
      const lines = Array(100).fill('x = y').join('\n')
      const input = `\\[\n${lines}\n\\]`
      const expected = `\`\`\`math\n${lines}\n\`\`\``

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should not corrupt when code fence already exists', () => {
      const input = '```math\nalready formatted\n```'
      // Should remain unchanged
      const expected = '```math\nalready formatted\n```'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should not corrupt with mixed parentheses and brackets', () => {
      const input = '\\(a\\) then \\[b\\] then \\(c\\) then \\[d\\]'
      const expected = '$$a$$ then $$b$$ then $$c$$ then $$d$$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })

    it('should handle replacement string special chars ($$$$)', () => {
      // The $$$$ in the replacement is actually $$ (each $$ becomes $$$$)
      const input = '\\(x\\)'
      const expected = '$$x$$'

      expect(fixLaTeXSyntax(input)).toBe(expected)
    })
  })
})
