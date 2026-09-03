import 'dotenv/config'

import { exec, readFile, runCode, writeFile } from '@/lib/sandbox.shell'
import { log, print, runScript } from '@/lib/script'
import { getRandomId } from '@/lib/string'

/**
 * Explore and test the sandbox through the platform's own interface.
 *
 * @note everything here goes through `@/lib/sandbox.shell`, so it exercises
 * whichever sandbox implementation is installed rather than one deployment's
 * service. Operations that only a particular backend has - desktop VMs, VNC
 * session URLs - are not here; they live with the implementation that has them.
 *
 * This script allows you to interact with the sandbox environment to:
 * - Execute shell commands with configurable timeouts
 * - Run Python or JavaScript code
 * - Read and write files
 * - Test different sandbox options and configurations
 *
 * Usage:
 * ```bash
 * # Execute a shell command
 * pnpm script:explore-sandbox --exec "echo 'Hello World'"
 *
 * # Execute with custom timeout
 * pnpm script:explore-sandbox --exec "sleep 2 && echo 'done'" --timeout 5000
 *
 * # Run Python code
 * pnpm script:explore-sandbox --eval "print('Hello from Python')" --language python
 *
 * # Run JavaScript code
 * pnpm script:explore-sandbox --eval "console.log('Hello from Node')" --language javascript
 *
 * # Write a file
 * pnpm script:explore-sandbox --write /tmp/test.txt --contents "Hello file"
 *
 * # Read a file
 * pnpm script:explore-sandbox --read /tmp/test.txt
 *
 * # Execute with file creation
 * pnpm script:explore-sandbox --exec "python3 script.py" --file-path script.py --file-contents "print('Generated script')"
 * ```
 */
runScript({
  name: 'explore-sandbox',
  description: 'Explore and test the sandbox API with various operations',
  options: {
    exec: {
      type: 'string',
      short: 'e',
      description: 'Execute a shell command',
    },
    eval: {
      type: 'string',
      description: 'Evaluate code (requires --language)',
    },
    language: {
      type: 'string',
      short: 'l',
      description: 'Language for eval (python or javascript)',
      default: 'python',
    },
    read: {
      type: 'string',
      short: 'r',
      description: 'Read file from sandbox',
    },
    write: {
      type: 'string',
      short: 'w',
      description: 'Write file to sandbox (requires --contents)',
    },
    contents: {
      type: 'string',
      description: 'Contents for write operation',
    },
    filePath: {
      type: 'string',
      description: 'File path to create before exec',
    },
    fileContents: {
      type: 'string',
      description: 'File contents to create before exec',
    },
    timeout: {
      type: 'string',
      short: 't',
      description: 'Timeout in milliseconds (default: 60000, max: 300000)',
    },
    sandboxId: {
      type: 'string',
      description: 'Custom sandbox ID (default: auto-generated)',
    },
    sessionId: {
      type: 'string',
      description: 'Custom session ID (default: auto-generated)',
    },
    spaceId: {
      type: 'string',
      description: 'Space ID for storage',
    },
    conversationId: {
      type: 'string',
      description: 'Conversation ID for storage',
    },
    json: {
      type: 'boolean',
      description: 'Output result as JSON',
    },
  },
  handler: async ({
    exec: execCmd,
    eval: evalCode,
    language,
    read: readPath,
    write: writePath,
    contents,
    filePath,
    fileContents,
    timeout,
    sandboxId,
    sessionId,
    spaceId,
    conversationId,
    json,
  }) => {
    // @note generate random IDs if not provided
    const actualSandboxId = sandboxId || getRandomId('sandbox-')
    const actualSessionId = sessionId || getRandomId('session-')

    log(`Using sandbox ID: ${actualSandboxId}`)
    log(`Using session ID: ${actualSessionId}`)
    log()

    const baseOptions = {
      sandboxId: actualSandboxId,
      sessionId: actualSessionId,
      timeout: timeout ? parseInt(timeout) : undefined,
      spaceId,
      conversationId,
    }

    try {
      let result

      if (execCmd) {
        log(`Executing command: ${execCmd}`)

        if (timeout) {
          log(`Timeout: ${timeout}ms`)
        }

        const files =
          filePath && fileContents
            ? [{ path: filePath, contents: fileContents }]
            : undefined

        if (files) {
          log(`Creating file: ${filePath}`)
        }

        result = await exec({
          ...baseOptions,
          cmd: execCmd,
          files,
        })

        if (json) {
          print(JSON.stringify(result, null, 2))
        } else {
          print('─'.repeat(80))
          print(`RESULT: exec`)
          print('─'.repeat(80))
          print(`Status: ${result.success ? '✓ Success' : '✗ Failed'}`)
          print(`Exit Code: ${result.exitCode}`)

          if (result.stdout) {
            print()
            print('STDOUT:')
            print(result.stdout)
          }

          if (result.stderr) {
            print()
            print('STDERR:')
            print(result.stderr)
          }

          if (result.mounts && result.mounts.length > 0) {
            print()
            print('MOUNTS:')
            result.mounts.forEach((mount) => {
              print(
                `  ${mount.folder} -> ${mount.spaceId || mount.conversationId}`
              )
            })
          }

          print('─'.repeat(80))
        }
      } else if (evalCode) {
        log(`Evaluating ${language} code`)

        if (timeout) {
          log(`Timeout: ${timeout}ms`)
        }

        log()

        result = await runCode({
          ...baseOptions,
          code: evalCode,
          language,
        })

        if (json) {
          print(JSON.stringify(result, null, 2))
        } else {
          print('─'.repeat(80))
          print(`RESULT: eval (${language})`)
          print('─'.repeat(80))
          print(`Status: ${result.success ? '✓ Success' : '✗ Failed'}`)

          if (result.output) {
            print()
            print('OUTPUT:')
            print(result.output)
          }

          if (result.error) {
            print()
            print('ERROR:')
            print(result.error)
          }

          if (result.mounts && result.mounts.length > 0) {
            print()
            print('MOUNTS:')
            result.mounts.forEach((mount) => {
              print(
                `  ${mount.folder} -> ${mount.spaceId || mount.conversationId}`
              )
            })
          }

          print('─'.repeat(80))
        }
      } else if (readPath) {
        log(`Reading file: ${readPath}`)
        log()

        result = await readFile({
          ...baseOptions,
          path: readPath,
        })

        if (json) {
          print(JSON.stringify(result, null, 2))
        } else {
          print('─'.repeat(80))
          print(`RESULT: read`)
          print('─'.repeat(80))
          print(`Status: ${result.success ? '✓ Success' : '✗ Failed'}`)
          print(`Path: ${readPath}`)

          if (result.contents) {
            print()
            print('CONTENTS:')
            print(result.contents)
          }

          if (result.error) {
            print()
            print('ERROR:')
            print(result.error)
          }

          print('─'.repeat(80))
        }
      } else if (writePath) {
        if (!contents) {
          log('Error: --contents required with --write')

          return
        }

        log(`Writing file: ${writePath}`)
        log(`Content length: ${contents.length} bytes`)
        log()

        result = await writeFile({
          ...baseOptions,
          path: writePath,
          contents,
        })

        if (json) {
          print(JSON.stringify(result, null, 2))
        } else {
          print('─'.repeat(80))
          print(`RESULT: write`)
          print('─'.repeat(80))
          print(`Status: ${result.success ? '✓ Success' : '✗ Failed'}`)
          print(`Path: ${writePath}`)
          print(`Bytes written: ${contents.length}`)

          if (result.error) {
            print()
            print('ERROR:')
            print(result.error)
          }

          print('─'.repeat(80))
        }
      } else {
        log(
          'No operation specified. Use --exec, --eval, --read or --write options.'
        )
        log()
        log('Examples:')
        log('  pnpm script:explore-sandbox --exec "echo Hello"')
        log(
          '  pnpm script:explore-sandbox --eval "print(42)" --language python'
        )
        log(
          '  pnpm script:explore-sandbox --write /tmp/test.txt --contents "Hello"'
        )
        log('  pnpm script:explore-sandbox --read /tmp/test.txt')
      }
    } catch (error) {
      log(`Error: ${error.message}`)

      if (!json) {
        if (error.stack) {
          log()
          log('Stack trace:')
          log(error.stack)
        }
      } else {
        print(
          JSON.stringify(
            {
              error: error.message,
              stack: error.stack,
            },
            null,
            2
          )
        )
      }
    }
  },
})
