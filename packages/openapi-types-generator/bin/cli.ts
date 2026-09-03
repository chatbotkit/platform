#!/usr/bin/env -S npx tsx

/* eslint-disable no-console */

/**
 * CLI for OpenAPI Types Generator
 */
import {
  generateFromOpenAPI,
  getSupportedLanguages,
  isSupportedLanguage,
} from '../src'

import { Command } from 'commander'
import * as fs from 'node:fs/promises'

const program = new Command()

program
  .name('openapi-types-generator')
  .description(
    'Generate typed interfaces from OpenAPI specs for multiple languages'
  )
  .version('0.0.0')
  .argument('<input>', 'Path to OpenAPI spec file (JSON)')
  .requiredOption(
    '-l, --lang <language>',
    'Target language (go, python, rust, java, kotlin, swift, csharp, typescript, ruby, cpp)'
  )
  .option('-o, --output <file>', 'Output file path (defaults to stdout)')
  .option(
    '-p, --package <name>',
    'Package/module name for generated code',
    'types'
  )
  .option('--include-components', 'Include component schemas in output', false)
  .action(
    async (
      input: string,
      options: {
        lang: string
        output?: string
        package: string
        includeComponents: boolean
      }
    ) => {
      if (!isSupportedLanguage(options.lang)) {
        const supportedLanguages = getSupportedLanguages()

        console.error(`Error: Unsupported language "${options.lang}"`)
        console.error(`Supported languages: ${supportedLanguages.join(', ')}`)
        process.exit(1)
      }

      try {
        const specContent = await fs.readFile(input, 'utf-8')

        const output = await generateFromOpenAPI(specContent, {
          language: options.lang,
          packageName: options.package,
          includeComponents: options.includeComponents,
        })

        if (options.output) {
          await fs.writeFile(options.output, output, 'utf-8')

          console.error(`Generated ${options.output}`)
        } else {
          console.log(output)
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error: ${error.message}`)
        } else {
          console.error('An unexpected error occurred')
        }

        process.exit(1)
      }
    }
  )

program.parse()
