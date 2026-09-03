/**
 * Fixes LaTeX syntax by converting various LaTeX formats to standard formats.
 * 
 * Performs the following transformations:
 * - Converts inline LaTeX `\(...\)` to `$$...$$`
 * - Converts single-line display LaTeX `\[...\]` to `$$...$$`
 * - Converts multi-line display LaTeX `\[\n...\n\]` to ` ```math...``` `
 * - Converts multi-line $$ blocks `$$\n...\n$$` to ` ```math...``` `
 * 
 * @param input - The input string containing LaTeX expressions
 * @returns The input string with fixed LaTeX syntax
 * 
 * @example
 * ```typescript
 * fixLaTeXSyntax('The equation \\(x + y = z\\) is simple')
 * // Returns: 'The equation $$x + y = z$$ is simple'
 * 
 * fixLaTeXSyntax('\\[\nx = 1\n\\]')
 * // Returns: '```math\nx = 1\n```'
 * ```
 */
export function fixLaTeXSyntax(input: string): string {
  input = input.replace(/\\\((.*?)\\\)/g, '$$$$$1$$$$')
  input = input.replace(/\\\[(.*?)\\\]/g, '$$$$$1$$$$')
  input = input.replace(/^\s*\\\[\n([\s\S]*?)\n\s*\\\]$/gm, '```math\n$1\n```')
  input = input.replace(/^\s*\$\$\n([\s\S]*?)\n\s*\$\$$/gm, '```math\n$1\n```')

  return input
}
