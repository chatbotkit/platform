# @chatbotkit-dev/script

The harness the repository's command line scripts are built on: option parsing
via commander, confirmation prompts via inquirer, and consistent output.

Extracted from `platform/lib/script.ts` so that a script can live next
to the code it operates on instead of sitting in the application merely to
reach the command-line harness.

## Usage

```ts
import { log, runScript } from '@chatbotkit-dev/script'

runScript({
  name: 'example',
  description: 'Does something useful',
  options: {
    id: { type: 'string', description: 'The record to act on', required: true },
  },
  async handler({ id }) {
    log(`acting on ${id}`)
  },
})
```

## Feature flags

`applyFlagsToProcessEnv(flags)` takes the flags explicitly rather than importing
them, because which flags exist is an application concern. `platform` keeps a
thin `lib/script.ts` that applies its own flags on import and re-exports
everything here, so scripts in that application are unaffected.
